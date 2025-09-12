import ComboboxField from "./ComboboxField.js";
import ComboboxListbox from "./ComboboxListbox.js";
import ComboboxOption from "./ComboboxOption.js";

class SelectEnhancer extends HTMLElement {
  // Internals
  // TODO: Enable devs to change the `combobox`/`listbox` components when replacing a `select` element.
  /** @readonly */ #combobox = document.createElement("combobox-field");
  /** @readonly */ #listbox = document.createElement("combobox-listbox");
  #mounted = false;

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /* -------------------- Enforce Valid Markup -------------------- */
      /** @type {HTMLSelectElement[]} */ const selects = [];
      /** @type {ComboboxField[]} */ const comboboxes = [];
      /** @type {ComboboxListbox[]} */ const listboxes = [];

      for (let child = this.lastElementChild; child; child = child.previousElementSibling) {
        customElements.upgrade(child);
        if (child instanceof HTMLSelectElement) selects.push(child);
        else if (child instanceof ComboboxField) comboboxes.push(child);
        else if (child instanceof ComboboxListbox) listboxes.push(child);
      }

      if (
        selects.length > 1 ||
        comboboxes.length > 1 ||
        listboxes.length > 1 ||
        comboboxes.length !== listboxes.length ||
        selects.length === comboboxes.length
      ) {
        const line1 = `${this.constructor.name} must contain one (and only one) <select> element.`;
        const line2 = `Alternatively, you may supply one ${ComboboxField.name} and one ${ComboboxListbox.name}.`;
        throw new TypeError(`${line1}\n${line2}`);
      }

      const select = selects.at(0);
      if (!select) {
        /** @type {any} */ (this).#combobox = comboboxes.at(0);
        /** @type {any} */ (this).#listbox = listboxes.at(0);
      }

      /* -------------------- Setup Elements -------------------- */
      // Give the `combobox` and the `listbox` a common parent for DOM Manipulation if needed.
      if (!this.#combobox.isConnected) document.createDocumentFragment().append(this.#combobox, this.#listbox);

      // Root Element
      this.setAttribute("role", "none");

      // Combobox
      if (select) {
        const attributeNames = select.getAttributeNames();
        for (let i = 0; i < attributeNames.length; i++) {
          const attrName = attributeNames[i];
          this.#combobox.setAttribute(attrName, /** @type {string} */ (select.getAttribute(attrName)));
        }
      }

      // Listbox
      // TODO: Maybe use `crypto.getRandomValues()` instead?
      this.#combobox.id ||= Math.random().toString(36).slice(2);
      const listboxId = `${this.#combobox.id}-listbox`;
      this.#listbox.setAttribute("id", listboxId);
      this.#listbox.setAttribute("role", "listbox");
      this.#combobox.setAttribute("aria-controls", listboxId);

      // Listbox Options
      // `SelectEnhancer` was initialized with pre-supplied `combobox` and `listbox` Web Components
      if (!select) {
        let defaultOptionExists = false;
        for (let child = this.#listbox.firstElementChild; child; child = child.nextElementSibling) {
          if (!(child instanceof ComboboxOption)) child.remove();
          else {
            if (child.defaultSelected) defaultOptionExists = true;
            child.id = `${this.#combobox.id}-option-${child.value}`;
          }
        }

        // Force `combobox` out of `null` state if possible. Then check if it should be cleared.
        this.#combobox.formResetCallback();
        if (!defaultOptionExists && this.#combobox.acceptsValue("")) this.#combobox.forceEmptyValue();
      }
      // `SelectEnhancer` is meant to enhance/replace a single `<select>` instead
      else {
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

        // Render Elements
        select.replaceWith(this.#combobox, this.#listbox);
      }

      this.#mounted = true;
    }
  }
}

export default SelectEnhancer;
