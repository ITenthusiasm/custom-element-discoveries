import { attrs, setAttributeFor } from "./ComboboxContainer";

/** @typedef {keyof Pick<ElementInternals, "labels" | "form" | "validity" | "validationMessage">} ExposedInternals */

/** @implements {Pick<ElementInternals, ExposedInternals>} */
class ComboboxSingle extends HTMLElement {
  static formAssociated = true;

  // Internals
  #mounted = false;

  /** @type {ElementInternals} */
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

      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    const expectedListbox = this.nextElementSibling;
    if (!(expectedListbox instanceof HTMLUListElement) || expectedListbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must be placed before a valid \`ul[role="listbox"]\` element.`);
    }

    // Setup Mutation Observers
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeOptionObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("click", handleComboboxClick);
    this.addEventListener("blur", handleComboboxBlur);
    this.addEventListener("keydown", handleComboboxKeydown);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#expansionObserver.disconnect();
    this.#activeOptionObserver.disconnect();

    this.removeEventListener("click", handleComboboxClick);
    this.removeEventListener("blur", handleComboboxBlur);
    this.removeEventListener("keydown", handleComboboxKeydown);
  }

  /** Retrieves the Custom Element's internal value (`this.#value`). @returns {string} */
  get value() {
    return this.#value;
  }

  /**
   * Updates the Custom Element's internal value (`this.#value`) along with any relevant element attributes.
   * @param {string} v
   */
  set value(v) {
    if (v === this.#value && v !== "") return; // Don't run setter logic redundantly

    /* -------------------- Unselect previous option -------------------- */
    const listbox = /** @type {HTMLUListElement} */ (this.nextElementSibling);
    listbox.querySelector(`[${attrs["aria-selected"]}="${true}"]`)?.setAttribute(attrs["aria-selected"], String(false));

    /* -------------------- Operate on new option -------------------- */
    const selectedOption = document.getElementById(`${listbox.id}-option-${v}`);

    // An invalid option was supplied
    if (!selectedOption) {
      this.#value = "";
      this.#internals.setFormValue(this.#value);
      // TODO: Should we set internal `validity` to `badInput`?
      this.childNodes[0].textContent = "";
      return;
    }

    // A valid option was supplied
    this.#value = v;
    this.#internals.setFormValue(this.#value);
    selectedOption.setAttribute(attrs["aria-selected"], String(true));
    // TODO: What if we made a custom `ComboboxOption` element that had a `label` attribute like regular options?
    this.childNodes[0].textContent = selectedOption.getAttribute(attrs["aria-label"]) ?? selectedOption.textContent;
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
}

/* -------------------- Combobox Handlers -------------------- */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleComboboxClick(event) {
  const combobox = /** @type {ComboboxSingle} */ (event.target);
  const expanded = combobox.getAttribute("aria-expanded") === String(true);
  combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
}

/**
 * @param {FocusEvent} event
 * @returns {void}
 */
function handleComboboxBlur(event) {
  const combobox = /** @type {ComboboxSingle} */ (event.target);
  setAttributeFor(combobox, attrs["aria-expanded"], String(false));
}

// TODO: How to handle the `CustomSelect` component being disabled?
/**
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handleComboboxKeydown(event) {
  const combobox = /** @type {ComboboxSingle} */ (event.target);
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
    if (!combobox.form) return; // TODO: Uncomment this line

    const submitter = getDefaultSubmitter(combobox.form);
    if (submitter) return submitter.disabled ? undefined : submitter.click();
    return combobox.form.requestSubmit();
  }

  // Option Searching Logic (should only operate on printable characters)
  if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    // TODO: Implement logic. (Should we use the `class` for this, or the element's `data-*` attributes?)
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

/* -------------------- Combobox Mutation Observer Details -------------------- */
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
  const combobox = /** @type {ComboboxSingle} */ (mutation.target);

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
  const combobox = /** @type {ComboboxSingle} */ (mutation.target);

  // Deactivate Previous Option
  const lastOptionId = mutation.oldValue;
  const lastOption = lastOptionId ? document.getElementById(lastOptionId) : null;
  lastOption?.removeAttribute("data-active");

  // Activate New Option
  const activeOptionId = /** @type {string} */ (combobox.getAttribute(attrs["aria-activedescendant"]));
  const activeOption = document.getElementById(activeOptionId);
  activeOption?.setAttribute("data-active", String(true));
}

export default ComboboxSingle;

/* Future Reference Note: For searchable comboboxes, a `contenteditable` div is probably the way to go. See MDN. */
