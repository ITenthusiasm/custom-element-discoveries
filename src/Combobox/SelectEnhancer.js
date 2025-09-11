class SelectEnhancer extends HTMLElement {
  // Internals
  #mounted = false;

  // Important Elements
  /** @readonly */ #combobox = document.createElement("combobox-field");
  /** @readonly */ #listbox = document.createElement("combobox-listbox");

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /** @type {HTMLSelectElement | null} */
      const select = this.querySelector(":scope > select:only-of-type");
      if (!select) throw new TypeError(`${this.constructor.name} must contain one (and only one) <select> element`);

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
      this.#combobox.id ||= Math.random().toString(36).slice(2);
      this.#listbox.setAttribute("id", `${this.#combobox.id}-listbox`);
      this.#listbox.setAttribute("role", "listbox");
      this.#combobox.setAttribute("aria-controls", `${this.#combobox.id}-listbox`);

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
      if (!defaultOptionExists && this.#combobox.acceptsValue("")) this.#combobox.forceEmptyValue();

      /* -------------------- Render Elements -------------------- */
      select.replaceWith(this.#combobox, this.#listbox);
      this.#mounted = true;
    }
  }
}

export default SelectEnhancer;
