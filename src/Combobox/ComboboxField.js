/** @import {HTMLElementWithChildren} from "./Combobox.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import attrs from "./attrs.js";

/** 
 * @typedef {keyof Pick<ElementInternals,
     "labels" | "form" | "validity" | "validationMessage" | "willValidate" | "checkValidity" | "reportValidity"
   >} ExposedInternals
 */

/** @implements {Pick<ElementInternals, ExposedInternals>} */
class ComboboxField extends HTMLElement {
  /* ------------------------------ Custom Element Settings ------------------------------ */
  /** @returns {true} */
  static get formAssociated() {
    return true;
  }

  static get observedAttributes() {
    return /** @type {const} */ (["required", "empty-message", "filter"]);
  }

  /* ------------------------------ Internals ------------------------------ */
  #mounted = false;
  /** @readonly */ #internals = this.attachInternals();

  /** @type {string} The temporary search string used for {@link filter _unfiltered_} `combobox`es */
  #searchString = "";

  /** @type {number | undefined} The `id` of the latest timeout function that will clear the search string */
  #searchTimeout;

  /** @readonly */ #expansionObserver = new MutationObserver(ComboboxField.#watchExpansion);
  /** @readonly */ #activeDescendantObserver = new MutationObserver(ComboboxField.#watchActiveDescendant);

  /*
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

        // TODO: Do we still need to track `this.#mounted`??? Should we track `isConnected` instead?
        // Seems less buggy, especially if the component is disconnected, modified, and re-connected?
        if (this.#mounted) {
          this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
          this.addEventListener("click", ComboboxField.#handleComboboxClick, { passive: true });
          this.removeEventListener("focus", ComboboxField.#handleComboboxFocus);
        }
      } else {
        this.setAttribute("aria-autocomplete", "list");
        this.setAttribute("contenteditable", "plaintext-only");

        if (this.#mounted) {
          this.removeEventListener("keydown", this.#handleTypeahead);
          this.removeEventListener("click", ComboboxField.#handleComboboxClick);
          this.addEventListener("focus", ComboboxField.#handleComboboxFocus, { passive: true });
        }
      }

      // eslint-disable-next-line no-useless-return -- I want code here to be easily moved around
      return;
    }
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      // Setup Attributes
      this.setAttribute("role", "combobox");
      this.setAttribute("tabindex", String(0));
      this.setAttribute("aria-haspopup", "listbox");
      this.setAttribute(attrs["aria-expanded"], String(false));
      this.setAttribute(attrs["aria-activedescendant"], "");

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
    this.addEventListener("blur", ComboboxField.#handleComboboxBlur, { passive: true });
    this.addEventListener("input", this.#handleSearch, { passive: true });
    this.addEventListener("keydown", ComboboxField.#handleComboboxKeydown);

    if (this.filter) this.addEventListener("focus", ComboboxField.#handleComboboxFocus, { passive: true });
    else {
      this.addEventListener("click", ComboboxField.#handleComboboxClick, { passive: true });
      this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
    }
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#optionNodesObserver.disconnect();
    this.#expansionObserver.disconnect();
    this.#activeDescendantObserver.disconnect();

    this.removeEventListener("blur", ComboboxField.#handleComboboxBlur);
    this.removeEventListener("input", this.#handleSearch);
    this.removeEventListener("keydown", ComboboxField.#handleComboboxKeydown);

    this.removeEventListener("focus", ComboboxField.#handleComboboxFocus);
    this.removeEventListener("click", ComboboxField.#handleComboboxClick);
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
    const activeOption = /** @type {ComboboxOption | null} */ (
      listbox.querySelector(":scope [role='option'][data-active='true']")
    );

    // TODO: Should we allow matching multi-word `option`s by removing empty spaces during a search comparison?
    //       (NOTE: The native `<select>` element does not support such functionality.)
    if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      /** @type {ComboboxOption | undefined} */
      let nextActiveOption;
      const start = (activeOption?.index ?? -1) + 1;

      // TODO: `nextElementSibling` might be faster than an `index`-based loop. Need to do more tests...
      for (let i = start; i < listbox.children.length + start; i++) {
        const index = i % listbox.children.length;

        if (listbox.children[index].textContent?.toLowerCase().startsWith(this.#searchString.toLowerCase())) {
          nextActiveOption = listbox.children[index];
          break;
        }
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

  // TODO: Regarding the `event.stopImmediatePropagation()` hack, watch https://github.com/whatwg/dom/issues/1368
  /**
   * Handles the searching logic for `combobox`es with a {@link filter}
   * @param {Event} event
   * @returns {void}
   */
  #handleSearch = (event) => {
    // Dismiss events generated by a `combobox` value update
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    if (!event.isTrusted || !combobox.filter) return;

    // Let `ComboboxField` manage bubbled `input` events. (We sadly can't control `captured` ones yet.)
    event.stopImmediatePropagation();
    const { listbox, textContent: search } = combobox;
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));

    // TODO: Again, `nextElementSibling` might be faster than an `index`-based loop. Need to do more tests...
    // TODO: There MIGHT also be a possibility to optimize things by `querySelect`ing only those children
    //       that would actually need their `data-filtered-out` attribute updated. Is that true though? Need tests...
    //       CAVEAT: If someone `Ctrl + A + Paste/Type`s into the search field, we probably won't be able to determine
    //       the correct course of action as easily. We'd have to look at `InputEvent.inputType` and that would probably
    //       get quite convoluted... so maybe just loop over everything as things are today for simplicity. We can
    //       explore something else if there's a real bottleneck we're running into.
    let noActiveDescendant = true;
    for (let i = 0; i < listbox.children.length; i++) {
      const option = listbox.children[i];

      if (search && !option.textContent?.toLowerCase().includes(search.toLowerCase()))
        option.setAttribute("data-filtered-out", String(true));
      else {
        option.removeAttribute("data-filtered-out");

        if (noActiveDescendant) {
          setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
          noActiveDescendant = false;
        }
      }
    }

    // TODO: Show "Sorry no options..." (Is that allowed from an a11y standpoint for `listbox`es?)
    // TODO: We need to make sure the `combobox` doesn't try to `activate` the `No-Options` message during keystrokes
    // TODO: Do we care if someone _DOESN'T_ want to display a "No Options" message?
    if (noActiveDescendant) {
      if (!this.#emptyOption) {
        this.#emptyOption = document.createElement("span");
        this.#emptyOption.textContent = this.emptyMessage;
        this.#emptyOption.setAttribute("role", "option");
        this.#emptyOption.setAttribute("aria-selected", String(false));
        this.#emptyOption.inert = true; // TODO: Will Screen Reader properly announce that the `listbox` is empty?
      }

      listbox.appendChild(this.#emptyOption);
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
   */
  formStateRestoreCallback(state, _mode) {
    this.value = state;
  }

  /** @param {boolean} disabled */
  formDisabledCallback(disabled) {
    if (disabled) setAttributeFor(this, attrs["aria-expanded"], String(false));
  }

  /* ------------------------------ Combobox Event Handlers ------------------------------ */
  /**
   * (For {@link filter unfiltered} `combobox`es only)
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleComboboxClick(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);
    combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
  }

  /**
   * (For {@link filter filtered} `combobox`es only)
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleComboboxFocus(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    combobox.setAttribute(attrs["aria-expanded"], String(true));
  }

  /**
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleComboboxBlur(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    setAttributeFor(combobox, attrs["aria-expanded"], String(false));

    if (!combobox.filter || combobox.value == null) return;
    const root = /** @type {Document | ShadowRoot} */ (combobox.getRootNode());
    const option = /** @type {ComboboxOption} */ (root.getElementById(`${combobox.id}-option-${combobox.value}`));
    combobox.textContent = option.textContent;
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  static #handleComboboxKeydown(event) {
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

      /** @type {Element | null | undefined} */
      let nextActiveOption = activeOption;
      do nextActiveOption = nextActiveOption?.nextElementSibling;
      while (combobox.filter ? nextActiveOption?.hasAttribute("data-filtered-out") : false);

      if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault(); // Don't scroll

      // NOTE: This query selector will likely not be safe if we use `group`ed `option`s. In that case, use a loop.
      const lastOption = combobox.filter
        ? listbox.querySelector(":scope [role='option']:nth-last-child(1 of :not([data-filtered-out]))")
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

      /** @type {Element | null | undefined} */
      let nextActiveOption = activeOption;
      do nextActiveOption = nextActiveOption?.previousElementSibling;
      while (combobox.filter ? nextActiveOption?.hasAttribute("data-filtered-out") : false);

      if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault(); // Don't scroll

      const firstOption = combobox.filter
        ? listbox.querySelector(":scope [role='option']:not([data-filtered-out])")
        : listbox.firstElementChild;

      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      setAttributeFor(combobox, attrs["aria-activedescendant"], firstOption?.id ?? "");
      return;
    }

    if (event.key === " ") {
      event.preventDefault(); // Don't scroll
      if (combobox.filter) return;

      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    if (event.key === "Tab") {
      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
      return;
    }

    if (event.key === "Enter") {
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
  }

  /* ------------------------------ Combobox Mutation Observer Details ------------------------------ */
  /**
   * @param {MutationRecord[]} mutations
   * @returns {void}
   */
  static #watchExpansion(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];

      const combobox = /** @type {ComboboxField} */ (mutation.target);
      const { listbox } = combobox;
      const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

      // Open Combobox
      if (expanded) {
        if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

        /** @type {ComboboxOption} */
        const activeOption =
          listbox.querySelector(":scope [role='option'][aria-selected='true']:not([data-filtered-out])") ??
          /** @type {ComboboxOption} */ (listbox.querySelector(":scope [role='option']:not([data-filtered-out])"));

        if (!activeOption.inert) combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
      }
      // Close Combobox
      else combobox.setAttribute(attrs["aria-activedescendant"], "");
    }
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
