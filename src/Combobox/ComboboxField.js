/** @import {ListboxWithChildren} from "./Combobox.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import ComboboxListbox from "./ComboboxListbox.js";

/*
 * "TypeScript Lies" to Be Aware of:
 * (Probably should move this comment to a markdown file)
 *
 * 1) `#matchingOptions` could technically be `null` but is `ComboboxOption[]` (never a practical problem)
 */

/** Internally used to retrieve the value that the `combobox` had when it was focused. */
const valueOnFocusKey = Symbol("value-on-focus-key");
/** Internally used to determine if the `combobox`'s value is actively being modified through user's filter changes. */
const editingKey = Symbol("editing-key");

/** The attributes _commonly_ used by the `ComboboxField` component. (These are declared to help avoid typos.) */
const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
});

/** 
 * @typedef {Pick<ElementInternals,
     "labels" | "form" | "validity" | "validationMessage" | "willValidate" | "checkValidity" | "reportValidity"
   >} ExposedInternals
 */

/**
 * @typedef {Pick<HTMLInputElement, "name" | "required" | "disabled" | "setCustomValidity">} FieldPropertiesAndMethods
 */

/*
 * TODO: Some of our functionality requires (or recommends) CSS to be properly implemented (e.g., hiding `listbox`,
 * properly showing white spaces, etc.). We should probably explain all such things to developers.
 */
/** @implements {ExposedInternals} @implements {FieldPropertiesAndMethods} */
class ComboboxField extends HTMLElement {
  /* ------------------------------ Custom Element Settings ------------------------------ */
  /** @returns {true} */
  static get formAssociated() {
    return true;
  }

  static get observedAttributes() {
    return /** @type {const} */ (["required", "filter", "valueis", "nomatchesmessage", "valuemissingerror"]);
  }

  /* ------------------------------ Internals ------------------------------ */
  #mounted = false;
  /** Internally used to indicate when the `combobox` is actively transitioning out of {@link filter} mode. */
  static #filterDisabedKey = Symbol("filter-disabled");
  /** @readonly */ #internals = this.attachInternals();

  /** @type {string} The temporary search string used for {@link filter _unfiltered_} `combobox`es */
  #searchString = "";

  /** @type {number | undefined} The `id` of the latest timeout function that will clear the `#searchString` */
  #searchTimeout;

  /**
   * @type {ComboboxOption[]} The list of `option`s that match the user's current filter. Only guaranteed
   * to exist when the `combobox` is in {@link filter} mode. Otherwise, is irrelevant and may yield `null`.
   */
  #matchingOptions = /** @type {ComboboxOption[]} */ (/** @type {unknown} */ (null));

  /**
   * @type {number} The index of the `option` in `#matchingOptions` that is currently active.
   * Only relevant for {@link filter filterable} `combobox`es.
   */
  #activeIndex = 0;

  /** @readonly */ #textNodeObserver = new MutationObserver(ComboboxField.#preserveTextNode);
  /** @readonly */ #activeDescendantObserver = new MutationObserver(ComboboxField.#watchActiveDescendant);
  /** @readonly */ #expansionObserver = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      const combobox = /** @type {ComboboxField} */ (mutation.target);
      const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);
      const { listbox } = combobox;

      // Open Combobox
      if (expanded) {
        /*
         * NOTE: If the user opens the `combobox` with search/typeahead, then `aria-activedescendant` will already
         * exist and this expansion logic will be irrelevant. Remember that `MutationObserver` callbacks are run
         * asynchronously, so this check would happen AFTER the search/typeahead handler completed. It's also
         * possible for this condition to be met if we redundantly set `aria-expanded`. Although we should be
         * be able to avoid that, we can't prevent Developers from accidentally doing that themselves.
         */
        if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

        /** @type {ComboboxOption | null} */
        const activeOption =
          listbox.querySelector(":scope [role='option'][aria-selected='true']:not([data-filtered-out])") ??
          listbox.querySelector(":scope [role='option']:not([data-filtered-out])");

        if (combobox.filter) {
          this.#autoselectableOption = null;
          this.#activeIndex = activeOption ? this.#matchingOptions.indexOf(activeOption) : -1;
        }

        if (activeOption) combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
      }
      // Close Combobox
      else {
        combobox.setAttribute(attrs["aria-activedescendant"], "");

        // See if logic _exclusive_ to `filter`ed `combobox`es needs to be run
        if (!combobox.filter || combobox.value == null) return;
        this.#resetOptions();

        // Reset `combobox` display if needed
        // NOTE: `option` CAN be `null` or unselected if `combobox` is `clearable`, empty, and `collapsed` with a non-empty filter
        const textNode = combobox.text;
        if (!combobox.acceptsValue(textNode.data)) {
          const option = combobox.getOptionByValue(combobox.value);
          if (combobox.valueIs === "clearable" && !combobox.value && !option?.selected) textNode.data = "";
          else if (textNode.data !== option?.textContent) textNode.data = /** @type {string} */ (option?.textContent);
        }

        // Reset cursor if `combobox` is still `:focus`ed
        if (/** @type {Document | ShadowRoot} */ (combobox.getRootNode()).activeElement !== combobox) return;

        const selection = /** @type {Selection} */ (combobox.ownerDocument.getSelection());
        selection.setBaseAndExtent(textNode, textNode.length, textNode, textNode.length);
      }
    }
  });

  /** @readonly */ #optionNodesObserver = new MutationObserver((mutations) => {
    const textNode = this.text;
    const nullable = this.valueIs !== "anyvalue";

    if (!this.listbox.children.length) {
      if (!nullable) this.value = textNode.data;
      else {
        this.#value = null;
        this.#internals.setFormValue(null);
        textNode.data = "";
        this.#validateRequiredConstraint();
      }

      if (this.filter) this.#filterOptions(); // Clean up internal data and show "No Matches" Message
      return;
    }

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];

      // Handle added nodes first. This keeps us from running redundant Deselect Logic if a newly-added node is `selected`.
      mutation.addedNodes.forEach((node, j) => {
        if (!(node instanceof ComboboxOption)) return node.parentNode?.removeChild(node);

        if (node.defaultSelected) this.value = node.value;
        else if (nullable && this.#value === null && j === 0) {
          if (this.valueIs !== "clearable") this.value = node.value;
          else {
            this.#value = "";
            this.forceEmptyValue();
          }
        }
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof ComboboxOption)) return;
        if (this.#autoselectableOption === node) this.#autoselectableOption = null;
        if (node.selected) {
          if (nullable) this.formResetCallback();
          else this.value = textNode.data;
        }
      });
    }

    if (!this.filter) return;

    // NOTE: This can produce a confusing UX if the `combobox` is expanded but a filter was NOT applied yet.
    // However, such a scenario is unlikely and impractical. So we're keeping this logic to help with async loading.
    if (this.getAttribute(attrs["aria-expanded"]) === String(true)) this.#filterOptions();
    else this.#resetOptions();
  });

  /**
   * @type {string | null} The Custom Element's internal value. If you are updating the `combobox`'s value to anything
   * other than `null`, then you should use the {@link value setter} instead.
   *
   * **Note**: A `null` value indicates that the `combobox` value has not yet been initialized (for instance, if
   * the `combobox` was rendered without any `option`s).
   */
  #value = null;
  /** @private @type {string | null} */ [valueOnFocusKey] = null;
  /** @private @type {boolean} */ [editingKey] = false;

  /* ------------------------------ Lifecycle Callbacks ------------------------------ */
  /**
   * @param {typeof ComboboxField.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "required") return this.#validateRequiredConstraint();
    if (name === "nomatchesmessage" && newValue !== oldValue) {
      return this.listbox.setAttribute(name, newValue ?? ComboboxField.defaultNoMatchesMessage);
    }
    if (name === "valuemissingerror" && newValue !== oldValue) {
      const { valueMissing, customError } = this.validity;
      if (valueMissing && !customError) this.#internals.setValidity({ valueMissing }, this.valueMissingError);
      return;
    }

    if (name === "valueis" && newValue !== oldValue) {
      if (!this.#mounted) return;
      const filterModeIsBeingDisabled = newValue === /** @type {any} */ (ComboboxField.#filterDisabedKey);
      if (!this.filter && !filterModeIsBeingDisabled) return;

      const trueNewValue = this.valueIs;
      /** @type {this["valueIs"]} */ const trueOldValue =
        oldValue === "anyvalue" || oldValue === "unclearable" ? oldValue : "clearable";
      if (trueNewValue === trueOldValue && !filterModeIsBeingDisabled) return;

      // `anyvalue` activated
      if (trueNewValue === "anyvalue" && !filterModeIsBeingDisabled) {
        if (this.text.data === "") return this.forceEmptyValue();
        if (this.getAttribute(attrs["aria-expanded"]) !== String(true)) return; // A valid value should already exist

        if (this.#autoselectableOption) this.value = this.#autoselectableOption.value;
        else this.value = this.text.data;
      }
      // `clearable` activated (default when `filter` mode is ON)
      else if (trueNewValue === "clearable" && !filterModeIsBeingDisabled) {
        if (this.text.data === "") return this.forceEmptyValue();
        if (trueOldValue !== "anyvalue") return; // A valid value should already exist

        if (this.#autoselectableOption) this.value = this.#autoselectableOption.value;
        else this.formResetCallback();
      }
      // `unclearable` activated (default when `filter` mode is OFF)
      else {
        /** @type {ComboboxOption | null | undefined} */ let option;

        if (trueOldValue !== "unclearable" && this.text.data === "") option = this.getOptionByValue("");
        else if (trueOldValue === "anyvalue") option = this.#autoselectableOption;
        else {
          // A valid value should already exist in `filter` mode. In that case, don't disrupt User's current filter.
          if (!filterModeIsBeingDisabled) return;
          option = this.#value == null ? null : this.getOptionByValue(this.#value);
        }

        if (!option) return this.formResetCallback();
        option.selected = true;
        if (this.text.data !== option.label) this.text.data = option.label;
      }

      return;
    }

    if (name === "filter" && (newValue == null) !== (oldValue == null)) {
      if (newValue == null) {
        this.removeAttribute("aria-autocomplete");
        this.removeAttribute("contenteditable");

        // NOTE: The old `valueIs` value/property has to be calculated here because the `filter` attribute was removed.
        // This means that `this.filterIs` would return `unclearable` in some cases where it should return `clearable`.
        const rawValueIs = this.getAttribute("valueis");
        /** @type {this["valueIs"]} */
        const oldValueIs = rawValueIs === "anyvalue" || rawValueIs === "unclearable" ? rawValueIs : "clearable";
        this.attributeChangedCallback("valueis", oldValueIs, /** @type {any} */ (ComboboxField.#filterDisabedKey));

        if (this.getAttribute(attrs["aria-expanded"]) === String(true)) this.#resetOptions();

        if (this.isConnected) {
          this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
          this.removeEventListener("focus", ComboboxField.#handleFocus);
          this.removeEventListener("beforeinput", this.#handleSearch);
          this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
        }
      } else {
        this.setAttribute("aria-autocomplete", "list");
        this.setAttribute("contenteditable", String(!this.disabled));
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- This is due to our own TS Types. :\
        this.#matchingOptions ??= Array.from(this.listbox.children);

        if (this.isConnected) {
          if (/** @type {Document | ShadowRoot} */ (this.getRootNode()).activeElement === this) {
            this.ownerDocument.getSelection()?.setBaseAndExtent(this.text, 0, this.text, this.text.length);
          }

          this.removeEventListener("keydown", this.#handleTypeahead);
          this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
          this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
          this.addEventListener("beforeinput", this.#handleSearch);
        }
      }

      return; // eslint-disable-line no-useless-return -- I want code in this callback to be easily moved around
    }
  }

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      // Setup Attributes
      this.setAttribute("role", "combobox");
      this.setAttribute("tabindex", String(0));
      this.setAttribute("aria-haspopup", "listbox");
      this.setAttribute(attrs["aria-expanded"], String(false));
      this.setAttribute(attrs["aria-activedescendant"], "");
      if (!this.noMatchesMessage) this.noMatchesMessage = ComboboxField.defaultNoMatchesMessage;

      // NOTE: This initialization of `#matchingOptions` is incompatible with `group`ed `option`s
      if (this.filter) this.#matchingOptions = Array.from(this.listbox.children);
      this.appendChild(this.text);
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    if (!(this.listbox instanceof ComboboxListbox) || this.listbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must point to a valid \`[role="listbox"]\` with \`aria-controls\``);
    }

    // Setup Mutation Observers
    this.#optionNodesObserver.observe(this.listbox, { childList: true });
    this.#textNodeObserver.observe(this, { childList: true });
    // TODO: Change these 2 MutationObservers to `attributeChangedCallback` implementations instead
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeDescendantObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("click", ComboboxField.#handleClick, { passive: true });
    this.addEventListener("blur", ComboboxField.#handleBlur, { passive: true });
    this.addEventListener("keydown", this.#handleKeydown);

    if (this.filter) {
      this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
      this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
      this.addEventListener("beforeinput", this.#handleSearch);
    } else {
      this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
    }

    this.listbox.addEventListener("mouseover", ComboboxField.#handleDelegatedOptionHover, { passive: true });
    this.listbox.addEventListener("click", ComboboxField.#handleDelegatedOptionClick, { passive: true });
    this.listbox.addEventListener("mousedown", ComboboxField.#handleDelegatedMousedown);
  }

  /** "On Unmount" for Custom Elements @returns {void} */
  disconnectedCallback() {
    // TODO: We should consider handling `disconnection` more safely/robustly with `takeRecords` since
    //       this element could be relocated (rather than being completely removed from the DOM).
    this.#optionNodesObserver.disconnect();
    this.#textNodeObserver.disconnect();
    this.#expansionObserver.disconnect();
    this.#activeDescendantObserver.disconnect();

    this.removeEventListener("click", ComboboxField.#handleClick);
    this.removeEventListener("blur", ComboboxField.#handleBlur);
    this.removeEventListener("keydown", this.#handleKeydown);

    this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
    this.removeEventListener("focus", ComboboxField.#handleFocus);
    this.removeEventListener("beforeinput", this.#handleSearch);
    this.removeEventListener("keydown", this.#handleTypeahead);

    this.listbox.removeEventListener("mouseover", ComboboxField.#handleDelegatedOptionHover);
    this.listbox.removeEventListener("click", ComboboxField.#handleDelegatedOptionClick);
    this.listbox.removeEventListener("mousedown", ComboboxField.#handleDelegatedMousedown);
  }

  /**
   * Handles the searching logic for `combobox`es without a {@link filter}
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleTypeahead = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { listbox } = combobox;
    // TODO: This will probably be faster with getElementById?
    const activeOption = listbox.querySelector(":scope [role='option'][data-active='true']");

    if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === " " && !this.#searchString) return;
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so
      const lastOptionToEvaluate = activeOption ?? listbox.lastElementChild;
      let nextActiveOption = lastOptionToEvaluate;

      while (nextActiveOption !== null) {
        nextActiveOption = nextActiveOption.nextElementSibling ?? listbox.firstElementChild;
        if (nextActiveOption?.textContent.toLowerCase().startsWith(this.#searchString.toLowerCase())) break;
        if (nextActiveOption === lastOptionToEvaluate) nextActiveOption = null;
      }

      /* -------------------- Update `search` and Active `option` -------------------- */
      clearTimeout(this.#searchTimeout);
      if (!nextActiveOption) {
        this.#searchString = "";
        return;
      }

      setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      this.#searchTimeout = window.setTimeout(() => (this.#searchString = ""), 500);
    }
  };

  /**
   * Handles the searching logic for `combobox`es with a {@link filter}
   * @param {InputEvent} event
   * @returns {void}
   */
  #handleSearch = (event) => {
    /*
     * Prevent developers from receiving irrelevant `input` events from a `ComboboxField`.
     *
     * NOTE: This will sadly disable `historyUndo`/`historyRedo`, but that's probably not a big problem.
     * If it does become a point of contention/need in the future, then we can make a history `Stack` that is opt-in.
     */
    event.preventDefault();
    if (!event.isTrusted) return;
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { text } = combobox;

    // Update `combobox`'s Text Content based on user input
    const { inputType } = event;
    if (!inputType.startsWith("delete") && !inputType.startsWith("insert")) return;

    /** The `data` input by the user, modified to be valid for the `combobox` */
    let data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
    data = data.replace(/[\r\n]/g, ""); // NOTE: This deletion seems to be safe for our range looping logic.

    const staticRanges = event.getTargetRanges();
    for (let i = 0, rangeShift = 0; i < staticRanges.length; i++) {
      const staticRange = staticRanges[i];
      const deletedCharacters = staticRange.endOffset - staticRange.startOffset;

      const correctedStartOffset = staticRange.startOffset + rangeShift;
      text.deleteData(correctedStartOffset, deletedCharacters);
      text.insertData(correctedStartOffset, data);
      rangeShift = rangeShift - deletedCharacters + data.length;

      if (i !== staticRanges.length - 1) continue;
      const cursorLocation = correctedStartOffset + data.length;
      const selection = /** @type {Selection} */ (text.ownerDocument.getSelection());
      selection.setBaseAndExtent(text, cursorLocation, text, cursorLocation);

      if (deletedCharacters === 0 && data.length === 0) return; // User attempted to "delete" nothing
    }

    // Filter `option`s
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    if (this.dispatchEvent(new Event("filterchange", { bubbles: true, cancelable: true }))) {
      this.#filterOptions();
    }

    // Update `combobox` value if needed.
    // NOTE: We MUST set the internal value DIRECTLY here to produce desirable behavior. See Development Notes for details.
    if (!combobox.acceptsValue(text.data)) return;
    const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);

    this.#value = text.data;
    this.#internals.setFormValue(this.#value);
    if (prevOption?.selected) prevOption.selected = false;
    this.#validateRequiredConstraint();

    // TODO: We might want to document that this `InputEvent` is not cancelable (and why)
    combobox[editingKey] = true;
    combobox.dispatchEvent(
      new InputEvent("input", {
        bubbles: event.bubbles,
        composed: event.composed,
        cancelable: false,
        view: event.view,
        detail: event.detail,
        inputType: event.inputType,
        isComposing: event.isComposing,
        data: event.data || event.dataTransfer ? data : null,
        dataTransfer: null,
      }),
    );
  };

  /** @returns {void} */
  #filterOptions() {
    ({ matchingOptions: this.#matchingOptions, autoselectableOption: this.#autoselectableOption = null } =
      this.getFilteredOptions());

    this.#activeIndex = 0;
    this.toggleAttribute("data-bad-filter", !this.#matchingOptions.length); // TODO: Remove Legacy Implementation
    this.#internals.states[this.#matchingOptions.length ? "delete" : "add"]("--bad-filter");
    setAttributeFor(this, attrs["aria-activedescendant"], this.#matchingOptions[0]?.id ?? "");
  }

  /**
   * Updates the `[data-filtered-out]` attribute for all of the `option`s,
   * then returns the `option`s that match the user's current filter.
   *
   * @returns {GetFilteredOptionsReturnType}
   */
  getFilteredOptions() {
    let matches = 0;
    const search = this.text.data;
    /** @type {GetFilteredOptionsReturnType["autoselectableOption"]} */ let autoselectableOption;

    // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so.
    // NOTE: The responsibility of setting `autoselectableOption` to a non-null `option` belongs to this method ONLY.
    //       However, what is _done_ with said `option` is ultimately up to the developer, not this component.
    for (let option = this.listbox.firstElementChild; option; option = /** @type {any} */ (option.nextElementSibling)) {
      if (!this.optionMatchesFilter(option)) option.toggleAttribute("data-filtered-out", true);
      else {
        if (option.textContent === search) autoselectableOption = option;

        option.removeAttribute("data-filtered-out");
        this.#matchingOptions[matches++] = option;
      }
    }

    // Remove any remaining `option`s that belonged to the previous filter
    this.#matchingOptions.splice(matches);

    return { matchingOptions: this.#matchingOptions, autoselectableOption };
  }

  /**
   * @typedef GetFilteredOptionsReturnType
   * @property {ComboboxOption[]} matchingOptions The `option`s which match the user's current filter
   * @property {ComboboxOption} [autoselectableOption] (Optional): The `option` which is a candidate for
   * automatic selection. See: {@link ComboboxField.autoselectableOption}.
   */

  /**
   * The logic used by {@link filter filterable} `combobox`es to determine if an `option` matches the user's filter.
   *
   * **Note**: If {@link getFilteredOptions} is overridden, this method will do nothing unless it is
   * used directly within the new implementation.
   *
   * @param {ComboboxOption} option
   * @returns {boolean}
   */
  optionMatchesFilter(option) {
    // NOTE: An "Empty String Option" won't be `autoselectable` with the approach here, and that's intentional
    const search = this.text.data;
    if (!search) return true;
    if (!option.value) return false;

    return option.textContent.toLowerCase()[this.filterMethod](search.toLowerCase());
  }

  /**
   * Resets all of the `option`s in the {@link listbox} so that none of them are marked as filtered out.
   * Also re-initializes the stored `#matchingOptions`.
   * @returns {void}
   */
  #resetOptions() {
    let i = 0;
    for (let option = this.listbox.firstElementChild; option; option = /** @type {any} */ (option.nextElementSibling)) {
      option.removeAttribute("data-filtered-out");
      this.#matchingOptions[i++] = option;
    }

    // Remove any remaining `option`s that no longer belong to the `listbox`
    this.#matchingOptions.splice(i);
    if (this.#matchingOptions.length) {
      this.removeAttribute("data-bad-filter"); // TODO: Remove Legacy Implementation
      this.#internals.states.delete("--bad-filter");
    }
  }

  /* ------------------------------ Exposed Form Properties ------------------------------ */
  /** Sets or retrieves the `value` of the `combobox` @returns {string | null} */
  get value() {
    return this.#value;
  }

  /** @param {string} v */
  set value(v) {
    const newOption = this.getOptionByValue(v);
    if (v === this.#value && newOption?.selected === true) return;

    /* ---------- Update Values ---------- */
    if (!newOption && !this.acceptsValue(v)) return; // Ignore invalid values
    const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);

    this.#value = v;
    this.#internals.setFormValue(this.#value);
    const label = newOption ? newOption.label : this.#value;
    if (this.text.data !== label) {
      this.text.data = label;
      this.#autoselectableOption = null;
    }

    // Update `option`s AFTER updating `value`
    if (newOption?.selected === false) newOption.selected = true;
    if (prevOption?.selected && prevOption !== newOption) prevOption.selected = false;
    this.#validateRequiredConstraint();
  }

  /**
   * Coerces the value and filter of the `combobox` to an empty string, and deselects the currently-selected `option`
   * if one exists (including any `option` whose value is an empty string).
   *
   * @returns {void}
   * @throws {TypeError} if the `combobox` is not {@link filter filterable}, or if its value
   * {@link valueIs cannot be cleared}.
   */
  forceEmptyValue() {
    if (this.valueIs !== "anyvalue" && this.valueIs !== "clearable") {
      throw new TypeError('Method requires `filter` mode to be on and `valueis` to be "anyvalue" or "clearable"');
    }
    if (this.valueIs === "clearable" && this.#value === null) {
      throw new TypeError('Cannot coerce value to `""` for a `clearable` `combobox` that owns no `option`s');
    }

    const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);

    this.text.data = "";
    this.#value = "";
    this.#internals.setFormValue(this.#value);
    this.#autoselectableOption = null;
    if (prevOption?.selected) prevOption.selected = false;
    this.#validateRequiredConstraint();
  }

  /**
   * Retrieves the `option` with the provided `value` (if it exists)
   * @param {string} value
   * @returns {ComboboxOption | null}
   */
  getOptionByValue(value) {
    const root = /** @type {Document | DocumentFragment | ShadowRoot} */ (this.getRootNode());
    const option = /** @type {ComboboxOption | null} */ (root.getElementById(`${this.id}-option-${value}`));
    return option;
  }

  /** @returns {HTMLInputElement["name"]} */
  get name() {
    return this.getAttribute("name") ?? "";
  }

  set name(value) {
    this.setAttribute("name", value);
  }

  /** @returns {HTMLInputElement["disabled"]} */
  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value));
  }

  /** @returns {HTMLInputElement["required"]} */
  get required() {
    return this.hasAttribute("required");
  }

  set required(value) {
    this.toggleAttribute("required", Boolean(value));
  }

  /**
   * The `listbox` that this `combobox` controls.
   * @returns {ListboxWithChildren<ComboboxOption>}
   */
  get listbox() {
    return /** @type {typeof this.listbox} */ (this.nextElementSibling);
  }

  /* ------------------------------ Custom Attributes and Properties ------------------------------ */
  /** @type {this["text"]} */
  #text = new Text();

  /**
   * @readonly The _singular_ {@link Text} Node associated with the `combobox`.
   *
   * To alter the `combobox`'s text content, update this node **_instead of_** using {@link textContent}.
   * @returns {Text}
   */
  get text() {
    return this.#text;
  }

  /** Activates a textbox that can be used to filter the list of `combobox` `option`s. @returns {boolean} */
  get filter() {
    return this.hasAttribute("filter");
  }

  set filter(value) {
    this.toggleAttribute("filter", Boolean(value));
  }

  /**
   * Determines the method used to filter the `option`s as the user types.
   * - `startsWith`: {@link String.startsWith} will be used to filter the `option`s.
   * - `includes`: {@link String.includes} will be used to filter the `option`s.
   *
   * **Note**: This property does nothing if {@link optionMatchesFilter} or {@link getFilteredOptions} is overridden.
   *
   * @returns {Extract<keyof String, "startsWith" | "includes">}
   */
  get filterMethod() {
    const value = this.getAttribute("filtermethod");
    return value === "includes" ? value : "startsWith";
  }

  set filterMethod(value) {
    this.setAttribute("filtermethod", value);
  }

  /**
   * Indicates how a `combobox`'s value will behave.
   * - `unclearable`: The field's {@link value `value`} must be a string matching one of the `option`s,
   * and it cannot be cleared. (Default when {@link filter `filter`} mode is off.)
   * - `clearable`: The field's `value` must be a string matching one of the `option`s,
   * but it can be cleared. (Default in `filter` mode. Requires enabling `filter` mode.)
   * - `anyvalue`: The field's `value` can be any string, and it will automatically be set to
   * whatever value the user types. (Requires enabling `filter` mode.)
   *
   * <!--
   * TODO: Link to Documentation for More Details (like TS does for MDN). The deeper details of the behavior
   * are too sophisticated to place them all in a JSDoc, which should be [sufficiently] clear and succinct
   * -->
   *
   * @returns {"unclearable" | "clearable" | "anyvalue"}
   */
  get valueIs() {
    if (!this.filter) return "unclearable";

    const value = this.getAttribute("valueis");
    return value === "anyvalue" || value === "unclearable" ? value : "clearable";
  }

  set valueIs(value) {
    this.setAttribute("valueis", value);
  }

  /**
   * @param {string} value
   * @returns {boolean} `true` if the `combobox` will accept the provided `value` when no corresponding `option` exists.
   * Otherwise, returns `false`.
   */
  acceptsValue(value) {
    if (!this.filter) return false;
    if (this.valueIs !== "anyvalue" && this.#value === null) return false;
    return this.valueIs === "anyvalue" || (this.valueIs === "clearable" && value === "");
  }

  /** @type {this["autoselectableOption"]} */
  #autoselectableOption = null;

  /**
   * Returns the `option` whose `label` matches the user's most recent filter input (if one exists).
   *
   * Value will be `null` if:
   * - The user's filter didn't match any `option`s
   * - The `combobox`'s text content was altered by a `value` change
   * - The `combobox` was just recently expanded
   * @returns {ComboboxOption | null}
   */
  get autoselectableOption() {
    return this.#autoselectableOption;
  }

  static defaultNoMatchesMessage = "No options found";

  /**
   * The message displayed to users when none of the `combobox`'s `option`s match their filter.
   * @returns {string}
   */
  get noMatchesMessage() {
    return /** @type {string} Note: Logic forces attribute to always exist */ (this.getAttribute("nomatchesmessage"));
  }

  set noMatchesMessage(value) {
    this.setAttribute("nomatchesmessage", value);
  }

  /** The error message displayed to users when the `combobox`'s `required` constraint is broken. @returns {string} */
  get valueMissingError() {
    return this.getAttribute("valuemissingerror") ?? "Please select an item in the list.";
  }

  set valueMissingError(value) {
    this.setAttribute("valuemissingerror", value);
  }

  /* ------------------------------ Exposed `ElementInternals` ------------------------------ */
  /** @returns {ElementInternals["labels"]} */
  get labels() {
    return this.#internals.labels;
  }

  /** @returns {ElementInternals["form"]} */
  get form() {
    return this.#internals.form;
  }

  /** @returns {ElementInternals["validity"]} */
  get validity() {
    return this.#internals.validity;
  }

  /** @returns {ElementInternals["validationMessage"]} */
  get validationMessage() {
    return this.#internals.validationMessage;
  }

  /** @returns {ElementInternals["willValidate"]} */
  get willValidate() {
    return this.#internals.willValidate;
  }

  /** @type {ElementInternals["checkValidity"]} */
  checkValidity() {
    return this.#internals.checkValidity();
  }

  /** @type {ElementInternals["reportValidity"]} */
  reportValidity() {
    return this.#internals.reportValidity();
  }

  /** @type {HTMLInputElement["setCustomValidity"]} */
  setCustomValidity(error) {
    const { valueMissing } = this.validity;
    const errorMessage = valueMissing && !error ? this.valueMissingError : error;
    this.#internals.setValidity({ valueMissing, customError: Boolean(error) }, errorMessage);
  }

  /** @returns {void} */
  #validateRequiredConstraint() {
    const { customError } = this.validity;

    // NOTE: We don't check for `this.value == null` here because that would only be a Developer Error, not a User Error
    if (this.required && this.value === "") {
      return this.#internals.setValidity(
        { valueMissing: true, customError },
        this.validationMessage || this.valueMissingError,
      );
    }

    this.#internals.setValidity({ valueMissing: false, customError }, this.validationMessage);
  }

  /* ------------------------------ Form Control Callbacks ------------------------------ */
  /** @returns {void} */
  formResetCallback() {
    const { listbox } = this;

    // NOTE: This logic might not work with `group`s (which we don't currently intend to support)
    /** @type {ComboboxOption | null} */
    const defaultOption = listbox.querySelector(":scope [role='option']:nth-last-child(1 of [selected])");

    if (defaultOption) this.value = defaultOption.value;
    else if (this.valueIs === "anyvalue" || this.valueIs === "clearable") this.value = "";
    else if (listbox.firstElementChild) this.value = listbox.firstElementChild.value;
  }

  /**
   * @param {string} state
   * @param {"restore" | "autocomplete"} _mode
   * @returns {void}
   */
  formStateRestoreCallback(state, _mode) {
    this.value = state;
  }

  /**
   * @param {boolean} disabled
   * @returns {void}
   */
  formDisabledCallback(disabled) {
    if (disabled) setAttributeFor(this, attrs["aria-expanded"], String(false));
    if (this.filter) this.setAttribute("contenteditable", String(!disabled));
  }

  /* ------------------------------ Combobox Event Handlers ------------------------------ */
  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleClick(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

    if (combobox.filter && expanded) return;
    combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
  }

  /**
   * Used to determine if a {@link filter filterable} `combobox` was `:focus`ed by a `click` event.
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleMousedown(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    if (/** @type {Document | ShadowRoot} */ (combobox.getRootNode()).activeElement === combobox) return;

    combobox.setAttribute("data-mousedown", "");
    combobox.addEventListener("mouseup", () => combobox.removeAttribute("data-mousedown"), { once: true });
  }

  /**
   * (For {@link filter filtered} `combobox`es only)
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleFocus(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    combobox[valueOnFocusKey] = combobox.value;
    if (combobox.hasAttribute("data-mousedown")) return;

    const textNode = combobox.text;
    document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, textNode.length);
  }

  /**
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleBlur(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    setAttributeFor(combobox, attrs["aria-expanded"], String(false));

    // Determine if a `change` event should be dispatched (for `clearable` and `anyvalue` mode only)
    const { [valueOnFocusKey]: valueOnFocus, [editingKey]: editing } = combobox;
    if (valueOnFocus !== combobox.value && editing && combobox.value !== null) {
      combobox.dispatchEvent(new Event("change", { bubbles: true, composed: false, cancelable: false }));
    }
    combobox[valueOnFocusKey] = null;
    combobox[editingKey] = false;
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleKeydown = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { listbox } = combobox;
    const activeOption = /** @type {ComboboxOption | null} */ (
      listbox.querySelector(":scope [role='option'][data-active='true']")
    );

    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault(); // Don't scroll
      return setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    }

    if (event.key === "ArrowDown") {
      event.preventDefault(); // Don't scroll
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
        return combobox.setAttribute(attrs["aria-expanded"], String(true));
      }

      const nextActiveOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = Math.min(this.#activeIndex + 1, this.#matchingOptions.length - 1))]
        : activeOption?.nextElementSibling;

      if (nextActiveOption) setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault(); // Don't scroll

      const lastOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = this.#matchingOptions.length - 1)]
        : listbox.lastElementChild;

      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      setAttributeFor(combobox, attrs["aria-activedescendant"], lastOption?.id ?? "");
      return;
    }

    if (event.key === "Escape") {
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) return;

      event.preventDefault(); // Avoid unexpected side-effects like closing `dialog`s
      return combobox.setAttribute(attrs["aria-expanded"], String(false));
    }

    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault(); // Don't scroll
      return setAttributeFor(combobox, attrs["aria-expanded"], String(false));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault(); // Don't scroll
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
        return combobox.setAttribute(attrs["aria-expanded"], String(true));
      }

      const nextActiveOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = Math.max(this.#activeIndex - 1, 0))]
        : activeOption?.previousElementSibling;

      if (nextActiveOption) setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault(); // Don't scroll

      const firstOption = combobox.filter ? this.#matchingOptions[(this.#activeIndex = 0)] : listbox.firstElementChild;
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      setAttributeFor(combobox, attrs["aria-activedescendant"], firstOption?.id ?? "");
      return;
    }

    if (event.key === " ") {
      if (combobox.filter) return; // Defer to `#handleSearch` instead
      event.preventDefault(); // Don't scroll

      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
        return combobox.setAttribute(attrs["aria-expanded"], String(true));
      }

      // Defer to `#handleTypeahead` instead of selecting the active `option` if there's an active Search String
      return this.#searchString ? undefined : activeOption?.click();
    }

    if (event.key === "Enter") {
      // Prevent `#handleSearch` from triggering
      if (combobox.filter) event.preventDefault();

      // Select a Value (if the element is expanded)
      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();

      // Submit the Form (if the element is collapsed)
      const { form } = combobox;
      if (!form) return;

      // See: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission
      /** @type {HTMLButtonElement | HTMLInputElement | null} */
      const submitter = Array.prototype.find.call(form.elements, (control) => {
        if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLButtonElement)) return false;
        return control.type === "submit";
      });

      if (submitter) return submitter.disabled ? undefined : submitter.click();
      return form.requestSubmit();
    }
  };

  /* -------------------- Listbox Handlers -------------------- */
  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleDelegatedOptionHover(event) {
    const listbox = /** @type {HTMLElement} */ (event.currentTarget);
    const option = /** @type {HTMLElement} */ (event.target).closest("combobox-option");
    if (!option) return; // We hovered the `listbox`, not an `option`

    const combobox = /** @type {ComboboxField} */ (listbox.previousElementSibling);
    setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleDelegatedOptionClick(event) {
    const listbox = /** @type {HTMLElement} */ (event.currentTarget);
    const option = /** @type {HTMLElement} */ (event.target).closest("combobox-option");
    if (!option) return; // We clicked the `listbox`, not an `option`
    if (option.disabled) return;

    const combobox = /** @type {ComboboxField} */ (listbox.previousElementSibling);
    combobox.setAttribute(attrs["aria-expanded"], String(false));

    if (option.selected) return;
    combobox.value = option.value;
    combobox.dispatchEvent(new Event("input", { bubbles: true, composed: true, cancelable: false }));
    combobox.dispatchEvent(new Event("change", { bubbles: true, composed: false, cancelable: false }));
    combobox[editingKey] = false;
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleDelegatedMousedown(event) {
    const listbox = /** @type {HTMLElement} */ (event.currentTarget);
    if (listbox.contains(/** @type {HTMLElement} */ (event.target))) return event.preventDefault();
  }

  /* ------------------------------ Combobox Mutation Observer Details ------------------------------ */
  /**
   * @param {MutationRecord[]} mutations
   * @returns {void}
   */
  static #preserveTextNode(mutations) {
    const combobox = /** @type {ComboboxField} */ (mutations[0].target);
    const { text } = combobox;
    if (text !== combobox.firstChild || text !== combobox.lastChild) combobox.replaceChildren(text);
  }

  /**
   * @param {MutationRecord[]} mutations
   * @returns {void}
   */
  static #watchActiveDescendant(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      const combobox = /** @type {ComboboxField} */ (mutation.target);
      const root = /** @type {Document | DocumentFragment | ShadowRoot} */ (combobox.getRootNode());

      // Deactivate Previous Option
      const lastOptionId = mutation.oldValue;
      const lastOption = lastOptionId ? root.getElementById(lastOptionId) : null;
      lastOption?.removeAttribute("data-active");

      // Activate New Option
      const activeOptionId = /** @type {string} */ (combobox.getAttribute(attrs["aria-activedescendant"]));
      const activeOption = root.getElementById(activeOptionId);
      activeOption?.setAttribute("data-active", String(true));

      // If Needed, Scroll to New Active Option
      if (!activeOption) return;
      const { listbox } = combobox;
      const bounds = listbox.getBoundingClientRect();
      const { top, bottom, height } = activeOption.getBoundingClientRect();

      /**
       * The offset used to prevent unwanted, rapid scrolling caused by hovering an element at the infinitesimal limit where
       * the very edge of the `listbox` border intersects the very edge of the `element` outside the scroll container.
       */
      const safetyOffset = 0.5;

      // Align preceding `option` with top of listbox
      if (top < bounds.top) {
        if (activeOption === listbox.firstElementChild) listbox.scrollTop = 0;
        else listbox.scrollTop = activeOption.offsetTop + safetyOffset;
      }
      // Align succeeding `option` with bottom of listbox
      else if (bottom > bounds.bottom) {
        if (activeOption === listbox.lastElementChild) listbox.scrollTop = listbox.scrollHeight;
        else {
          const borderWidth = parseFloat(getComputedStyle(listbox).getPropertyValue("border-width"));
          listbox.scrollTop = activeOption.offsetTop - (bounds.height - borderWidth * 2) + height - safetyOffset;
        }
      }
    }
  }
}

export default ComboboxField;
