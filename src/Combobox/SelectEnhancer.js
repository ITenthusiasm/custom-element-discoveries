/** @import ComboboxField from "./ComboboxField.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import attrs from "./attrs.js";

class SelectEnhancer extends HTMLElement {
  // Internals
  #mounted = false;

  // Important Elements
  /** @readonly @type {ComboboxField} */ #combobox;
  /** @readonly @type {HTMLElement} */ #listbox;

  constructor() {
    super();
    this.#combobox = document.createElement("combobox-field");
    this.#listbox = document.createElement("div");
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /** @type {HTMLSelectElement | null} */
      const select = this.querySelector(":scope > select");
      if (!select) throw new TypeError(`<${this.constructor.name}> must contain one (and only one) <select> element`);

      /* -------------------- Setup Elements -------------------- */
      // Root Element
      this.setAttribute("role", "none");

      // Combobox
      const attributeNames = select.getAttributeNames();
      for (let i = 0; i < attributeNames.length; i++) {
        const attrName = attributeNames[i];
        this.#combobox.setAttribute(attrName, /** @type {string} */ (select.getAttribute(attrName)));
      }

      // Listbox
      if (!this.#combobox.id) this.#combobox.id = Math.random().toString(36).slice(2);
      const comboboxId = this.#combobox.id;

      this.#combobox.setAttribute("aria-controls", `${comboboxId}-listbox`);
      this.#listbox.setAttribute("id", `${comboboxId}-listbox`);
      this.#listbox.setAttribute("role", "listbox");

      // Listbox Options
      /** @type {ComboboxOption | undefined} */ let initialOption;

      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        const comboboxOption = this.#listbox.appendChild(document.createElement("combobox-option"));

        comboboxOption.textContent = option.label;
        comboboxOption.value = option.value;
        comboboxOption.disabled = option.disabled;
        comboboxOption.defaultSelected = option.defaultSelected;
        /*
         * TODO: Moving this logic to `ComboboxOption.connectedCallback` will better help with options added
         * after mounting. Then add a test to verify this use case. Also, should we add support for updating the
         * `combobox` if a selected option is removed?
         */
        comboboxOption.setAttribute("id", `${comboboxId}-option-${comboboxOption.value}`);

        if (comboboxOption.defaultSelected || !initialOption) initialOption = comboboxOption;
      }

      /* -------------------- Render Elements -------------------- */
      /*
       * TODO:
       * 1) It seems like the ordering of when we `connect` the `ComboboxOption`s to the DOM matters, because
       * `aria-selected` is set to `"false"` when the options are connected to the DOM. Is there a way that we
       * could make this setup logic less finicky?
       *
       * 2) Separately, don't the native `<option>` elements allow safe attribute changes even if they aren't connected
       * to the DOM? Should we allow something similar? (For example, early return on `!this.combobox`?) This might
       * make life easier for us... Need to investigate.
       *
       * 3) Far-off thought: Should we give developers an easy way to set this component up themselves? We'd also want
       * to make sure that frameworks can create our Web Component just fine, without running into any problems.
       * (There would only be a concern if people wanted to provide `<combobox-option>` and `<combobox-field>` directly
       * instead of using `<select-enhancer>` in conjunction with `<select>` -- at least, that's our assumption).
       */
      const fragment = document.createDocumentFragment();
      fragment.append(this.#combobox, this.#listbox);

      this.replaceChildren(fragment);
      if (initialOption) this.#combobox.value = initialOption.value;
      this.#mounted = true;
    }

    /* -------------------- Setup Event Listeners -------------------- */
    this.#listbox.addEventListener("mouseover", SelectEnhancer.#handleDelegatedOptionHover, { passive: true });
    this.#listbox.addEventListener("click", SelectEnhancer.#handleDelegatedOptionClick, { passive: true });
    this.addEventListener("mousedown", SelectEnhancer.#handleDelegatedMousedown);
  }

  // "On Unmount" for Custom Elements
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
    const option = /** @type {ComboboxOption} */ (event.target);
    if (option === listbox) return; // We hovered the `listbox`, not an `option`

    const combobox = /** @type {ComboboxField} */ (listbox.previousElementSibling);
    setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
  }

  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleDelegatedOptionClick(event) {
    const listbox = /** @type {HTMLElement} */ (event.currentTarget);
    const option = /** @type {ComboboxOption} */ (event.target);
    if (option === listbox) return; // We clicked the `listbox`, not an `option`
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
    if (event.target instanceof ComboboxOption) return event.preventDefault();
  }
}

export default SelectEnhancer;
