import { attrs, setAttributeFor } from "./ComboboxContainer.js";

/** @typedef {keyof Pick<
      ElementInternals,
      "labels" | "form" | "validity" | "validationMessage" | "willValidate" | "checkValidity" | "reportValidity"
    >} ExposedInternals
  */

/** @implements {Pick<ElementInternals, ExposedInternals>} */
class ComboboxField extends HTMLElement {
  /** @returns {true} */
  static get formAssociated() {
    return true;
  }

  // Internals
  #mounted = false;
  #modified = false;

  /** @readonly @type {ElementInternals} */
  #internals;

  #searchString = "";

  /** @type {number | undefined} */
  #searchTimeout;

  // Internals --> Mutation Observer Callbacks
  /** @readonly @type {MutationObserver} */
  #expansionObserver;

  /** @readonly @type {MutationObserver} */
  #activeOptionObserver;

  // Local State
  /** The Custom Element's internal value. **DO NOT** use directly. Use the getter and setter instead. */
  #value = "";

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#expansionObserver = new MutationObserver(watchExpansion);
    this.#activeOptionObserver = new MutationObserver(watchActiveDescendant);
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

      this.#validateRequiredConstraint();
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    const expectedListbox = this.nextElementSibling;
    if (!(expectedListbox instanceof HTMLElement) || expectedListbox.getAttribute("role") !== "listbox") {
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
   * Handles the `option` searching logic of the `combobox`
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleTypeahead = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.target);
    const listbox = /** @type {HTMLUListElement} */ (combobox.nextElementSibling);
    const activeOption = /** @type {HTMLElement | null} */ (listbox.querySelector("[data-active='true']"));

    // TODO: Should we allow matching multi-word `option`s by removing empty spaces during a search comparison?
    if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      /** @type {Element | undefined} */
      let nextActiveOption;
      // TODO: What about `array.findIndex`?
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
  /** Retrieves the Custom Element's internal value (`this.#value`). @returns {string} */
  get value() {
    return this.#value;
  }

  /** Updates the Custom Element's internal value (`this.#value`) along with any relevant element attributes. */
  set value(v) {
    if (v === this.#value && v !== "") return;
    this.#modified = true;

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

    this.#validateRequiredConstraint();
  }

  /** @returns {void} */
  #validateRequiredConstraint() {
    if (this.required && this.#value === "") {
      return this.#internals.setValidity({ valueMissing: true }, "Please fill out this field.");
    }

    this.#internals.setValidity({});
  }

  /** Indicates that the `combobox`'s value was modified (even if it isn't dirty). @returns {boolean} */
  get modified() {
    return this.#modified;
  }

  /**
   * The `listbox` that this `combobox` controls.
   * @returns {HTMLElement & { children: HTMLCollectionOf<import("./ComboboxOption.js").default>}}
   */
  get listbox() {
    return /** @type {typeof this.listbox} */ (this.nextElementSibling);
  }

  /* -------------------- Exposed Internals (These getters SHOULD NOT be used within the class) -------------------- */
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

/* ------------------------------ Combobox Handlers ------------------------------ */
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

// TODO: What about `disabled` _options_?
/**
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleComboboxKeydown(event) {
  const combobox = /** @type {ComboboxField} */ (event.target);
  const listbox = /** @type {HTMLUListElement} */ (combobox.nextElementSibling);
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

  if ((event.altKey && event.key === "ArrowUp") || event.key === "Escape") {
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
    // See: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission
    if (!combobox.form) return;

    const submitter = getDefaultSubmitter(combobox.form);
    if (submitter) return submitter.disabled ? undefined : submitter.click();
    return combobox.form.requestSubmit();
  }
}

/**
 * Returns a `form`'s default submit button if it exists.
 * @see https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission
 *
 * @param {HTMLFormElement} form
 * @returns {HTMLButtonElement | HTMLInputElement | null}
 */
function getDefaultSubmitter(form) {
  // Find a `submitter` if it exists
  for (let i = 0; i < form.elements.length; i++) {
    const control = form.elements[i];
    if (control instanceof HTMLButtonElement && control.type === "submit") return control;
    if (control instanceof HTMLInputElement && control.type === "submit") return control;
  }

  // We found nothing
  return null;
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

  // TODO: Should we expose a `listbox` getter?
  const listbox = /** @type {HTMLUListElement} */ (combobox.nextElementSibling);
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

// TODO: We need to add `listbox` scrolling logic for when the `activedescendant` changes
// TODO: Would adjusting scroll during `aria-activedescendant` updates be easier if we used `box-sizing: content-box`?
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
}

export default ComboboxField;

/* Future Reference Note: For searchable comboboxes, a `contenteditable` div is probably the way to go. See MDN. */
