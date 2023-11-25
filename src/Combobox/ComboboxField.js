import { attrs, setAttributeFor } from "./ComboboxContainer.js";

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
    return /** @type {const} */ (["required"]);
  }

  /* ------------------------------ Internals ------------------------------ */
  #mounted = false;
  /** @readonly */ #internals = this.attachInternals();

  #searchString = "";
  /** @type {number | undefined} */ #searchTimeout;
  /** @readonly */ #expansionObserver = new MutationObserver(watchExpansion);
  /** @readonly */ #activeOptionObserver = new MutationObserver(watchActiveDescendant);

  /**
   * @type {string | null} The Custom Element's internal value. **DO NOT** use directly.
   * Use the getter and setter instead.
   *
   * **Note**: A `null` value indicates that the `combobox` value has not yet been initialized (for instance, if
   * the `combobox` was not rendered with any `option`s).
   */
  #value = null;

  /* ------------------------------ Lifecycle Callbacks ------------------------------ */
  /**
   * @param {typeof ComboboxField.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "required") return this.#validateRequiredConstraint();
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

      this.insertAdjacentText("afterbegin", "");
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    if (!(this.listbox instanceof HTMLElement) || this.listbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must be placed before a valid \`[role="listbox"]\` element.`);
    }

    // Setup Mutation Observers
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeOptionObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("click", handleComboboxClick, { passive: true });
    this.addEventListener("blur", handleComboboxBlur, { passive: true });
    this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
    this.addEventListener("keydown", handleComboboxKeydown);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#expansionObserver.disconnect();
    this.#activeOptionObserver.disconnect();

    this.removeEventListener("click", handleComboboxClick);
    this.removeEventListener("blur", handleComboboxBlur);
    this.removeEventListener("keydown", this.#handleTypeahead);
    this.removeEventListener("keydown", handleComboboxKeydown);
  }

  /**
   * Handles the searching logic of the `combobox`
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleTypeahead = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.target);
    const { listbox } = combobox;
    const activeOption = listbox.querySelector("[data-active='true']");

    // TODO: Should we allow matching multi-word `option`s by removing empty spaces during a search comparison?
    // NOTE: The native `<select>` element does not support such functionality.
    if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      /** @type {Element | undefined} */
      let nextActiveOption;
      const start = Array.prototype.indexOf.call(listbox.children, activeOption) + 1;

      for (let i = start; i < listbox.children.length + start; i++) {
        const index = i % listbox.children.length;

        if (listbox.children[index].textContent?.toLowerCase().startsWith(this.#searchString.toLowerCase())) {
          nextActiveOption = listbox.children[index];
          break;
        }
      }

      /* -------------------- Update `search` and Active `option` -------------------- */
      clearTimeout(this.#searchTimeout);
      if (!nextActiveOption) return void (this.#searchString = "");

      setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      this.#searchTimeout = setTimeout(() => (this.#searchString = ""), 500);
    }
  };

  /* ------------------------------ Exposed Form Properties ------------------------------ */
  /** Sets or retrieves the `value` of the `combobox` @returns {string} */
  get value() {
    return this.#value ?? "";
  }

  set value(v) {
    if (v === this.#value) return;

    const options = this.listbox.children;
    const newOption = /** @type {typeof previousOption} */ (Array.prototype.find.call(options, (o) => o.value === v));
    const previousOption = /** @type {typeof options[number] | undefined} */ (
      Array.prototype.find.call(options, (o) => o.selected && o !== newOption)
    );

    /* ---------- Update Values ---------- */
    if (!newOption) return; // Ignore invalid values

    this.#value = v;
    this.#internals.setFormValue(this.#value);
    this.childNodes[0].textContent = newOption.label;

    // Update `option`s AFTER updating `value`
    newOption.selected = true;
    if (previousOption) previousOption.selected = false;
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
    if (value) this.setAttribute("disabled", "");
    else this.removeAttribute("disabled");
  }

  /** @returns {HTMLInputElement["required"]} */
  get required() {
    return this.hasAttribute("required");
  }

  set required(value) {
    if (value) this.setAttribute("required", "");
    else this.removeAttribute("required");
  }

  /** @returns {void} */
  #validateRequiredConstraint() {
    if (this.required && this.value === "") {
      return this.#internals.setValidity({ valueMissing: true }, "Please fill out this field.");
    }

    this.#internals.setValidity({});
  }

  /**
   * The `listbox` that this `combobox` controls.
   * @returns {HTMLElement & { children: HTMLCollectionOf<import("./ComboboxOption.js").default>}}
   */
  get listbox() {
    return /** @type {typeof this.listbox} */ (this.nextElementSibling);
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
}

/* Future Reference Note: For searchable comboboxes, a `contenteditable` div is probably the way to go. See MDN. */
export default ComboboxField;

/* ------------------------------ Combobox Event Handlers ------------------------------ */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleComboboxClick(event) {
  const combobox = /** @type {ComboboxField} */ (event.target);
  const expanded = combobox.getAttribute("aria-expanded") === String(true);
  combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
}

/**
 * @param {FocusEvent} event
 * @returns {void}
 */
function handleComboboxBlur(event) {
  const combobox = /** @type {ComboboxField} */ (event.target);
  setAttributeFor(combobox, attrs["aria-expanded"], String(false));
}

/**
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleComboboxKeydown(event) {
  const combobox = /** @type {ComboboxField} */ (event.target);
  const { listbox } = combobox;
  const activeOption = /** @type {HTMLElement | null} */ (listbox.querySelector("[data-active='true']"));

  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    return setAttributeFor(combobox, attrs["aria-expanded"], String(true));
  }

  if (event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    const nextActiveOption = activeOption?.nextElementSibling;
    if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "End") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    setAttributeFor(combobox, attrs["aria-activedescendant"], /** @type {string} */ (listbox.lastElementChild?.id));
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

    const nextActiveOption = activeOption?.previousElementSibling;
    if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    setAttributeFor(combobox, attrs["aria-activedescendant"], /** @type {string} */ (listbox.firstElementChild?.id));
    return;
  }

  if (event.key === " ") {
    event.preventDefault(); // Don't scroll
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
function watchExpansion(mutations) {
  mutations.forEach(handleExpansionChange);
}

/**
 * @param {MutationRecord} mutation
 * @returns {void}
 */
function handleExpansionChange(mutation) {
  const combobox = /** @type {ComboboxField} */ (mutation.target);
  const { listbox } = combobox;
  const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

  // Open Combobox
  if (expanded) {
    listbox.removeAttribute("hidden");
    if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

    const activeOption =
      listbox.querySelector("[aria-selected='true']") ?? /** @type {HTMLElement} */ (listbox.firstElementChild);
    combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
  }
  // Close Combobox
  else {
    listbox.setAttribute("hidden", "");
    combobox.setAttribute(attrs["aria-activedescendant"], "");
  }
}

/**
 * @param {MutationRecord[]} mutations
 * @returns {void}
 */
function watchActiveDescendant(mutations) {
  mutations.forEach(handleActiveDescendantChange);
}

/**
 * @param {MutationRecord} mutation
 * @returns {void}
 */
function handleActiveDescendantChange(mutation) {
  const combobox = /** @type {ComboboxField} */ (mutation.target);

  // Deactivate Previous Option
  const lastOptionId = mutation.oldValue;
  const lastOption = lastOptionId ? document.getElementById(lastOptionId) : null;
  lastOption?.removeAttribute("data-active");

  // Activate New Option
  const activeOptionId = /** @type {string} */ (combobox.getAttribute(attrs["aria-activedescendant"]));
  const activeOption = document.getElementById(activeOptionId);
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
