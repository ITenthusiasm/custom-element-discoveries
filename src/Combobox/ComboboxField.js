/** @import {HTMLElementWithChildren} from "./Combobox.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import attrs from "./attrs.js";

/** 
 * @typedef {keyof Pick<ElementInternals,
     "labels" | "form" | "validity" | "validationMessage" | "willValidate" | "checkValidity" | "reportValidity"
   >} ExposedInternals
 */

// TODO: It might be helpful to have `(add|remove)Option` methods, especially for frameworks like `React`...
// TODO: Do we want to force a default option to exist when the `combobox` is in `filter` mode? Maybe not?
// TODO: Test that when a user TABs to a `filter`able `combobox`, the full text content is highlighted
//       (similar to `<input>`s). But when a user focuses the `combobox` by `click`ing it, the cursor
//       naturally goes where the `MouseEvent` would place it.
/** @implements {Pick<ElementInternals, ExposedInternals>} */
class ComboboxField extends HTMLElement {
  /* ------------------------------ Custom Element Settings ------------------------------ */
  /** @returns {true} */
  static get formAssociated() {
    return true;
  }

  static get observedAttributes() {
    return /** @type {const} */ (["required", "filter", "empty-message"]);
  }

  /* ------------------------------ Internals ------------------------------ */
  #mounted = false;
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
         * asynchronously, so this check would happen AFTER the search/typeahead handler completed.
         */
        if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

        /** @type {ComboboxOption} */
        const activeOption =
          listbox.querySelector(":scope [role='option'][aria-selected='true']:not([data-filtered-out])") ??
          /** @type {ComboboxOption} */ (listbox.querySelector(":scope [role='option']:not([data-filtered-out])"));

        // TODO: DEFINITELY test that `#activeIndex` is correct if there was a previously-selected `option`.
        //       And really, test for the active `option` in all circumstances here...
        // NOTE: If our code is written correctly, then `#matchingOptions` should be all `listbox.children` on `expand`
        // since we won't get here if the user is in the middle of a `#handleSearch`
        if (combobox.filter) this.#activeIndex = this.#matchingOptions.indexOf(activeOption);
        combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
      }
      // Close Combobox
      else {
        combobox.setAttribute(attrs["aria-activedescendant"], "");

        // See if logic _exclusive_ to `filter`ed `combobox`es needs to be run
        if (!combobox.filter || combobox.value == null) return;

        // Reset filtered `option`s. (NOTE: Approach is incompatible with `group`ed `option`s)
        // TODO: Test that `#emptyOption` is excluded from the Filter Reset if no results were found before `collapse`
        if (this.#matchingOptions.length !== listbox.children.length) {
          this.#emptyOption?.remove();
          this.#matchingOptions = Array.from(listbox.children, (option) => {
            option.removeAttribute("data-filtered-out");
            return option;
          });
        }

        // Reset `combobox` display if needed
        const root = /** @type {Document | ShadowRoot} */ (combobox.getRootNode());
        const option = /** @type {ComboboxOption} */ (root.getElementById(`${combobox.id}-option-${combobox.value}`));
        if (combobox.textContent !== option.textContent) combobox.textContent = option.textContent;

        // Reset cursor if `combobox` is still `:focus`ed
        if (root.activeElement !== combobox) return;
        const selection = /** @type {Selection} */ (combobox.ownerDocument.getSelection());
        const textNode = /** @type {Text} */ (combobox.firstChild);
        selection.setBaseAndExtent(textNode, textNode.length, textNode, textNode.length);
      }
    }
  });

  /*
   * TODO: There are some worthwhile thoughts here... Compile this in some useful way so that the text size is bearable.
   *
   * NOTE: This observer assumes that the available `option`s don't change while the user types into the searchbox
   * (if the `combobox` is `filter`able). If we want to suppor that use case (e.g., for asynchronously loading `option`s),
   * then we'll need to update this observer accordingly. But even then... is a `combobox` really intended to be
   * an async search box?
   *
   * Or ... are we worried about running into unexpected use cases and desiring to support this use case just in case
   * in the immediate future?
   *
   * Actually, this component really shouldn't be used as an async search box. Once the previously-searched (and selected)
   * value is removed, it wouldn't be submitted to the server anymore. A different approach would seem better here, unless
   * we were to allow users to leave the `combobox` value as-is after a `blur` event. But that introduces its own sets of
   * complexities, which don't seem worth addressing at the moment.
   *
   * In any case, even if we don't support extra use cases, we might still want to update our filter as DOM nodes are
   * added/removed. This will help us avoid unexpected problems as the code is changed over time. (Note: We wouldn't
   * have to iterate over every single option to update the filter if we internally tracked the search string resulting
   * from an `input` event. Of course, we also don't have to update the filter when nodes are added/removed. In that
   * case, we don't have to loop over anything and simply have to indicate if a newly-added option should be filtered out.)
   */
  /** @readonly */ #optionNodesObserver = new MutationObserver((mutations) => {
    if (!this.listbox.children.length) {
      this.#value = null;
      this.#internals.setFormValue(null);
      this.textContent = "";
      return;
    }

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];

      // Handle added nodes first. This keeps us from running redundant Deselect Logic if a newly-added node is `selected`.
      mutation.addedNodes.forEach((node, j) => {
        if (!(node instanceof ComboboxOption)) return;
        if (node.defaultSelected) return (this.value = node.value);
        if (j === 0 && this.#value === null) this.value = node.value;
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof ComboboxOption)) return;
        if (node.selected) this.value = this.listbox.children[0].value;
      });
    }
  });

  /**
   * @type {string | null} The Custom Element's internal value. If you are updating the `combobox`'s value to anything
   * other than `null`, then you should use the {@link value setter} instead.
   *
   * **Note**: A `null` value indicates that the `combobox` value has not yet been initialized (for instance, if
   * the `combobox` was not rendered with any `option`s).
   */
  #value = null;

  /**
   * @type {HTMLSpanElement | undefined}
   * The default "`option`" displayed to the user when no `option`s match the user's search input.
   * ({@link filter filterable} `combobox`es only)
   */
  #emptyOption;

  /* ------------------------------ Lifecycle Callbacks ------------------------------ */
  /**
   * @param {typeof ComboboxField.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "required") return this.#validateRequiredConstraint();
    if (name === "empty-message" && this.#emptyOption && newValue !== oldValue) {
      this.#emptyOption.textContent = this.emptyMessage;
      return;
    }

    if (name === "filter" && (newValue == null) !== (oldValue == null)) {
      if (newValue == null) {
        this.removeAttribute("aria-autocomplete");
        this.removeAttribute("contenteditable");

        if (this.isConnected) {
          this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
          this.removeEventListener("focus", ComboboxField.#handleFocus);
          this.removeEventListener("beforeinput", this.#handleSearch);
          this.addEventListener("click", ComboboxField.#handleClick, { passive: true });
          this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
        }
      } else {
        this.setAttribute("aria-autocomplete", "list");
        this.setAttribute("contenteditable", "true");

        if (this.isConnected) {
          this.removeEventListener("click", ComboboxField.#handleClick);
          this.removeEventListener("keydown", this.#handleTypeahead);
          this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
          this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
          this.addEventListener("beforeinput", this.#handleSearch);
        }
      }

      // eslint-disable-next-line no-useless-return -- I want code here to be easily moved around
      return;
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

      // NOTE: This initialization of `#matchingOptions` is incompatible with `group`ed `option`s
      if (this.filter) this.#matchingOptions = Array.from(this.listbox.children);
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    if (!(this.listbox instanceof HTMLElement) || this.listbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must be placed before a valid \`[role="listbox"]\` element.`);
    }

    // Setup Mutation Observers
    this.#optionNodesObserver.observe(this.listbox, { childList: true });
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeDescendantObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("blur", ComboboxField.#handleBlur, { passive: true });
    this.addEventListener("keydown", this.#handleKeydown);

    if (this.filter) {
      this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
      this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
      this.addEventListener("beforeinput", this.#handleSearch);
    } else {
      this.addEventListener("click", ComboboxField.#handleClick, { passive: true });
      this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
    }
  }

  /** "On Unmount" for Custom Elements @returns {void} */
  disconnectedCallback() {
    this.#optionNodesObserver.disconnect();
    this.#expansionObserver.disconnect();
    this.#activeDescendantObserver.disconnect();

    this.removeEventListener("blur", ComboboxField.#handleBlur);
    this.removeEventListener("keydown", this.#handleKeydown);

    this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
    this.removeEventListener("focus", ComboboxField.#handleFocus);
    this.removeEventListener("beforeinput", this.#handleSearch);
    this.removeEventListener("click", ComboboxField.#handleClick);
    this.removeEventListener("keydown", this.#handleTypeahead);
  }

  /**
   * Handles the searching logic for `combobox`es without a {@link filter}
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleTypeahead = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { listbox } = combobox;
    const activeOption = listbox.querySelector(":scope [role='option'][data-active='true']");

    // TODO: Should we allow matching multi-word `option`s by removing empty spaces during a search comparison?
    //       (NOTE: The native `<select>` element does not support such functionality.)
    if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so
      const lastOption = activeOption ?? listbox.lastElementChild;
      let nextActiveOption = lastOption;

      while (nextActiveOption !== null) {
        nextActiveOption = nextActiveOption.nextElementSibling ?? listbox.firstElementChild;
        if (nextActiveOption?.textContent?.toLowerCase().startsWith(this.#searchString.toLowerCase())) break;
        if (nextActiveOption === lastOption) nextActiveOption = null;
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
     * Prevent developers from receiving irrelevant `input` events from `ComboboxField`.
     *
     * NOTE: This will sadly disable `historyUndo`/`historyRedo`, but that's probably not a big problem.
     * If it does become a point of contention/need in the future, then we can make a history `Stack` that is opt-in.
     */
    event.preventDefault();
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);

    /*
     * Some things to NOTE and to TEST to gain the understanding that we need for this component and verify
     * that everything works.
     *
     * 1) [Note]: Firefox is the only Browser that supports multi-selection. We could skip supporting it, but we'll
     * choose to support it to avoid breaking user expectations. Note that when Firefox encounters a mult-select for
     * an `<input>` element, it will place the selection at the very end of the _last_ selection range after text
     * is inserted into the form control. (You should TEST that you're satisfying this behavior.)
     *
     * 2) [Note]: We expect that `ComboboxField` will always have only one child: a Text Node. (Important assumption.)
     *
     * 3) [Note]: CHROME BUG. Apparently `[contenteditable="plaintext-only"]` will break `getTargetRanges` in Chrome.
     * We should probably file a bug for this.
     *
     * 4) [Note]: SAFARI / BROWSERS + SELECTION. In Safari, you cannot use `Selection.addRange` to set the `Document`'s
     * current selection to something WITHIN a `Shadow DOM`. However, you CAN use `Selection.setBaseAndExtent` for this.
     * Note that Chrome/Firefox support `Selection.addRange` if the `Range` has "legal" access to content in a
     * `Shadow DOM`. However, since we're trying to create something with cross-browser support, this is irrelevant.
     * See:
     * - https://developer.mozilla.org/en-US/docs/Web/API/Selection/setBaseAndExtent
     * - https://github.com/mfreed7/shadow-dom-selection?tab=readme-ov-file#changes-to-existing-selection-apis
     *   (May not be the official spec, but seems to be the direction in which things are moving so far.)
     *
     * 5) [Note]: `set Element.textContent()` will replace all of the children of the related `Node`. This is bad because
     * it means you'll lose the reference to the Text Node that your `Range`(s) were originally pointing to. So instead,
     * get access to the underlying Text Node and modify the node's value.
     *
     * 6) [Note]: You probably won't need to distinguish between `insert*` and `delete*` in most cases when updating
     * the `ComboboxField`'s content. For the delete scenario, you can just "insert" an empty, 0-character string.
     *
     * 7) [Note]: Apparently, all (non-static) `Range`s previously associated with a Text Node get emptied once the
     * referenced node's content is changed. (The `Range`s probably don't know what to point to anymore since the
     * text has technically "changed".) This makes it imperative that you know when to leverage the a `StaticRange`
     * and when to work directly with a regular, dynamic `Range` (or a value that it cached before being modified).
     *
     * 8) [Test]: We want to verify that our "range shifting" for our `dynamicRange` variable is correct. So far,
     * the logic seems to be accomplishing what we want.
     *
     * 9) [Test]: Pressing `Enter` should select a Combobox Option, and it shouldn't leave the Combobox expanded.
     * (This should be fixed.)
     *
     * 10) [Test]: All regular spaces should appear within the `Combobox` edit/search field and should not be collapsed.
     * Requires CSS. See `white-space`/`white-space-collapse` CSS Properties. (This should be fixed.)
     *
     * 11) [Test]: `deleteContentBackward` should not cause an error if done at the very beginning of the text.
     * (This should be fixed.)
     *
     * 12) [Test]: `deleteContentForward` should not move the cursor backwards if done at the very end of the text.
     * (This should be fixed.)
     *
     * 13) [Test]: The other variants of `delete` (e.g., `deleteWord*`) should work as normal. (I don't think we've
     * encountered any issues with this yet.)
     *
     * 14) [Test]: Entering text when the search is completely empty doesn't break anything. (It seems that when
     * you're inserting text into an empty element, the `StaticRange` generated during `beforeinput` points to
     * the element itself instead of the empty text node. So we should just reference the text node within
     * `ComboboxField`.)
     */

    let rangeShift = 0;
    const { inputType } = event;
    const staticRanges = event.getTargetRanges();
    for (let i = 0; i < staticRanges.length; i++) {
      if (!inputType.startsWith("delete") && !inputType.startsWith("insert")) return;
      const staticRange = staticRanges[i];

      const range = new Range();
      const textNode = /** @type {Text} */ (combobox.firstChild);
      range.setStart(textNode, staticRange.startOffset + rangeShift);
      range.setEnd(textNode, staticRange.endOffset + rangeShift);
      const deletedCharacters = range.toString().length;

      range.deleteContents();
      let data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
      if (data.includes("\n")) data = data.replaceAll("\n", "");

      /** The `startOffset` of the dynamic `Range` _after_ content deletion */
      const startOffset = range.startOffset; // eslint-disable-line prefer-destructuring -- Needed to apply JSDocs
      const originalText = /** @type {string} */ (textNode.nodeValue);
      textNode.nodeValue = originalText.slice(0, startOffset) + data + originalText.slice(startOffset);

      rangeShift = rangeShift - deletedCharacters + data.length;
      if (i !== staticRanges.length - 1) continue;

      const cursorLocation = startOffset + data.length;
      const selection = /** @type {Selection} */ (combobox.ownerDocument.getSelection());
      selection.setBaseAndExtent(textNode, cursorLocation, textNode, cursorLocation);

      if (deletedCharacters === 0 && data.length === 0) return; // User attempted to "delete" nothing
    }

    // TODO: Test that the filtered `option`s don't update if the user attempts to "delete" nothing.
    // (This can be tested by pressing `Delete` at the very end of the searchbox right after `expand`ing it.)
    const { listbox, textContent: search } = combobox;
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));

    // Filter `option`s
    let matches = 0;
    this.#activeIndex = 0;

    // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so
    // TODO: Test that `#emptyOption` is excluded from the Results if the `search` matches the No Options Message
    for (let option = listbox.firstElementChild; option; option = /** @type {any} */ (option.nextElementSibling)) {
      if (option === this.#emptyOption) continue;
      if (search && !option.textContent?.toLowerCase().includes(search.toLowerCase()))
        option.setAttribute("data-filtered-out", String(true));
      else {
        option.removeAttribute("data-filtered-out");
        this.#matchingOptions[matches++] = option;
        if (matches === 1) setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
      }
    }

    // Remove any `option`s that still exist from the previous filter
    this.#matchingOptions.splice(matches);

    // TODO: We need to make sure the `combobox` doesn't try to `activate` the `No-Options` message during keystrokes.
    //       NOTE: I think this is resolved, but we should definitely test this.
    if (matches === 0) {
      if (!this.#emptyOption) {
        this.#emptyOption = document.createElement("div");
        this.#emptyOption.textContent = this.emptyMessage;
        this.#emptyOption.setAttribute("role", "option");
        this.#emptyOption.setAttribute("aria-selected", String(false));
        this.#emptyOption.inert = true;
      }

      // TODO: Should we test that `#emptyOption` remains visible even after it is encountered for the `N > 1`-th time?
      listbox.appendChild(this.#emptyOption);
      this.#emptyOption.removeAttribute("data-filtered-out");
      setAttributeFor(combobox, attrs["aria-activedescendant"], "");
    } else this.#emptyOption?.remove();
  };

  /* ------------------------------ Exposed Form Properties ------------------------------ */
  /** Sets or retrieves the `value` of the `combobox` @returns {string | null} */
  get value() {
    return this.#value;
  }

  /** @param {string} v */
  set value(v) {
    const root = /** @type {Document | DocumentFragment | ShadowRoot} */ (this.getRootNode());
    const newOption = /** @type {ComboboxOption | null} */ (root.getElementById(`${this.id}-option-${v}`));
    if (v === this.#value && newOption?.selected === true) return;

    /* ---------- Update Values ---------- */
    if (!newOption) return; // Ignore invalid values
    const prevOption = /** @type {ComboboxOption | null} */ (root.getElementById(`${this.id}-option-${this.#value}`));

    this.#value = v;
    this.#internals.setFormValue(this.#value);
    this.textContent = newOption.label;

    // Update `option`s AFTER updating `value`
    newOption.selected = true;
    if (prevOption?.selected && prevOption !== newOption) prevOption.selected = false;
    this.#validateRequiredConstraint();
  }

  /** Sets or retrieves the name of the object. @returns {HTMLInputElement["name"]} */
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

  /** @returns {void} */
  #validateRequiredConstraint() {
    // NOTE: We don't check for `this.value == null` here because that would only be Developer Error, not User Error
    if (this.required && this.value === "") {
      return this.#internals.setValidity({ valueMissing: true }, "Please select an item in the list.");
    }

    this.#internals.setValidity({});
  }

  /**
   * The `listbox` that this `combobox` controls.
   * @returns {HTMLElementWithChildren<ComboboxOption>}
   */
  get listbox() {
    return /** @type {typeof this.listbox} */ (this.nextElementSibling);
  }

  /* ------------------------------ Custom Attributes ------------------------------ */
  /** Activates a textbox that can be used to filter the list of `combobox` `option`s. @returns {boolean} */
  get filter() {
    return this.hasAttribute("filter");
  }

  set filter(value) {
    this.toggleAttribute("filter", Boolean(value));
  }

  /** The message displayed to users when none of the `combobox`'s `option`s match their filter. @returns {string} */
  get emptyMessage() {
    return this.getAttribute("empty-message") ?? "No options found";
  }

  set emptyMessage(value) {
    this.setAttribute("empty-message", value);
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

  /* ------------------------------ Form Control Callbacks ------------------------------ */
  /** @returns {void} */
  formResetCallback() {
    const { listbox } = this;

    // NOTE: This logic might not work with `group`s (which we don't currently intend to support)
    /** @type {ComboboxOption | null} */
    const defaultOption =
      listbox.querySelector(":scope [role='option']:nth-last-child(1 of [selected])") ?? listbox.firstElementChild;

    if (!defaultOption) return;
    this.value = defaultOption.value;
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
  }

  /* ------------------------------ Combobox Event Handlers ------------------------------ */
  /**
   * (For {@link filter unfiltered} `combobox`es only)
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleClick(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);
    combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
  }

  /**
   * Used to determine if a {@link filter filterable} `combobox` was `:focus`ed by a `click` event.
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleMousedown(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const root = /** @type {Document | ShadowRoot} */ (combobox.getRootNode());
    if (root.activeElement === combobox) return;

    combobox.setAttribute("data-mousedown", "");
    combobox.addEventListener("mouseup", () => combobox.removeAttribute("data-mousedown"), { once: true });
  }

  /**
   * (For {@link filter filtered} `combobox`es only)
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleFocus(event) {
    // TODO: Is it worth considering not expanding the `combobox` on `focus`? (We can maintain highlighting.)
    // This is what Material UI does, and it probably makes it more clear that the user is on a `combobox`
    // (and what the original/previous values was). Just a consideration. Note sure yet.
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    combobox.setAttribute(attrs["aria-expanded"], String(true));

    if (combobox.hasAttribute("data-mousedown")) return;
    const textNode = /** @type {Text} */ (combobox.firstChild);
    document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, textNode.length);
  }

  /**
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleBlur(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    setAttributeFor(combobox, attrs["aria-expanded"], String(false));
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

      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    if (event.key === "Tab") {
      return combobox.getAttribute(attrs["aria-expanded"]) === String(true) ? activeOption?.click() : undefined;
    }

    // TODO: Test that the `combobox` doesn't expand when `Enter` is pressed in filter mode (when expanded OR collapsed)
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

  /* ------------------------------ Combobox Mutation Observer Details ------------------------------ */
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
