/** @import ComboboxField from "./ComboboxField.js" */
import { setAttributeFor } from "../utils/dom.js";
import attrs from "./attrs.js";

class SelectEnhancer extends HTMLElement {
  // Internals
  #mounted = false;

  // Important Elements
  /** @readonly */ #combobox = document.createElement("combobox-field");
  /** @readonly */ #listbox = document.createElement("div");

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /** @type {HTMLSelectElement | null} */
      const select = this.querySelector(":scope > select:only-of-type");
      if (!select) throw new TypeError(`<${this.constructor.name}> must contain one (and only one) <select> element`);

      /* -------------------- Setup Elements -------------------- */
      const fragment = document.createDocumentFragment();
      fragment.append(this.#combobox, this.#listbox);

      // Root Element
      this.setAttribute("role", "none");

      // Combobox
      const attributeNames = select.getAttributeNames();
      for (let i = 0; i < attributeNames.length; i++) {
        const attrName = attributeNames[i];
        this.#combobox.setAttribute(attrName, /** @type {string} */ (select.getAttribute(attrName)));
      }

      // Listbox
      // TODO: Maybe use `crypto.getRandomValues()` instead?
      if (!this.#combobox.id) this.#combobox.id = Math.random().toString(36).slice(2);
      const comboboxId = this.#combobox.id;

      this.#listbox.setAttribute("id", `${comboboxId}-listbox`);
      this.#listbox.setAttribute("role", "listbox");
      this.#listbox.setAttribute("tabindex", String(-1));
      this.#combobox.setAttribute("aria-controls", `${comboboxId}-listbox`);

      // Listbox Options
      let defaultOptionExists = false;
      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        const comboboxOption = this.#listbox.appendChild(document.createElement("combobox-option"));

        comboboxOption.textContent = option.label;
        comboboxOption.defaultSelected = option.defaultSelected;
        if (comboboxOption.defaultSelected) defaultOptionExists = true;
        if (option.hasAttribute("disabled")) comboboxOption.disabled = true;
        if (option.hasAttribute("value")) comboboxOption.setAttribute("value", option.value);

        // NOTE: `value` MUST be set BEFORE `id`, which is set BEFORE `selected`. (Due to A11y and Value Selection Logic.)
        comboboxOption.setAttribute("id", `${this.#combobox.id}-option-${comboboxOption.value}`);
        comboboxOption.selected = option.selected;
      }

      // Enable `clearable`/`anyvalue` `combobox`es without a default value to start out as an empty field
      if (!defaultOptionExists && this.#combobox.acceptsFilter("")) this.#combobox.forceEmptyValue();

      /* -------------------- Render Elements -------------------- */
      select.replaceWith(this.#listbox);
      this.#listbox.insertAdjacentElement("beforebegin", this.#combobox);
      this.#mounted = true;
    }

    /* -------------------- Setup Event Listeners -------------------- */
    this.#listbox.addEventListener("mouseover", SelectEnhancer.#handleDelegatedOptionHover, { passive: true });
    this.#listbox.addEventListener("click", SelectEnhancer.#handleDelegatedOptionClick, { passive: true });
    this.addEventListener("mousedown", SelectEnhancer.#handleDelegatedMousedown);
  }

  /** "On Unmount" for Custom Elements @returns {void} */
  disconnectedCallback() {
    this.#listbox.removeEventListener("mouseover", SelectEnhancer.#handleDelegatedOptionHover);
    this.#listbox.removeEventListener("click", SelectEnhancer.#handleDelegatedOptionClick);
    this.removeEventListener("mousedown", SelectEnhancer.#handleDelegatedMousedown);
  }

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
  }

  /* -------------------- Container Handlers -------------------- */
  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleDelegatedMousedown(event) {
    if (/** @type {HTMLElement} */ (event.target).closest("combobox-option")) return event.preventDefault();
  }
}

export default SelectEnhancer;
