/** @import ComboboxField from "./ComboboxField.js" */

// NOTE: The functionality here is similar to the regular `<select>` + `<option>` spec, with some minor deviations.
/** @implements {Omit<HTMLOptionElement, "text">} */
class ComboboxOption extends HTMLElement {
  #mounted = false;
  #selected = false;
  static get observedAttributes() {
    return /** @type {const} */ (["value", "selected"]);
  }

  /**
   * @param {typeof ComboboxOption.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.#mounted) return;
    if (name === "selected" && (newValue === null) !== (oldValue === null)) return (this.selected = newValue !== null);
    if (name === "value" && newValue !== oldValue) {
      this.id = `${this.#combobox.id}-option-${newValue ?? this.textContent}`;
      return this.#syncWithCombobox();
    }
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      if (!this.id) this.setAttribute("id", `${this.#combobox.id}-option-${this.value}`);
      this.setAttribute("role", "option");
      this.setAttribute("aria-selected", String(this.selected));
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Verification needed on mount
    if (!this.#listbox) {
      throw new Error(`A ${this.constructor.name} must be placed inside a valid \`[role="listbox"]\` element.`);
    }
  }

  get label() {
    return /** @type {string} */ (this.textContent);
  }

  get value() {
    return this.getAttribute("value") ?? /** @type {string} */ (this.textContent);
  }

  set value(v) {
    this.setAttribute("value", v);
  }

  get selected() {
    return this.#selected;
  }

  set selected(value) {
    const booleanValue = Boolean(value);
    if (this.#selected === booleanValue) return;

    this.#selected = booleanValue;
    this.setAttribute("aria-selected", String(this.#selected));
    this.#syncWithCombobox();
  }

  get defaultSelected() {
    return this.hasAttribute("selected");
  }

  set defaultSelected(value) {
    if (value) this.setAttribute("selected", "");
    else this.removeAttribute("selected");
  }

  get disabled() {
    return this.getAttribute("aria-disabled") === String(true);
  }

  set disabled(value) {
    if (value) this.setAttribute("aria-disabled", String(true));
    else this.removeAttribute("aria-disabled");
  }

  // NOTE: This approach might not work anymore if we want to support grouped `option`s in the future (unlikely)
  /** The position of the option within the list of options that it belongs to. */
  get index() {
    return Array.prototype.indexOf.call(this.#listbox.children, this);
  }

  get form() {
    return this.#combobox.form;
  }

  /** Retrieves the `listbox` that owns this `option` @returns {HTMLElement} */
  get #listbox() {
    return /** @type {HTMLElement} */ (this.closest("[role='listbox']"));
  }

  /** Retrives the `combobox` that this `option` belongs to @returns {ComboboxField} */
  get #combobox() {
    return /** @type {ComboboxField} */ (this.#listbox.previousElementSibling);
  }

  #syncWithCombobox() {
    const combobox = this.#combobox;

    if (this.selected && combobox.value !== this.value) combobox.value = this.value;
    else if (!this.selected && combobox.value === this.value) {
      combobox.value = /** @type {this} */ (this.#listbox.firstElementChild).value;
    }
  }
}

export default ComboboxOption;
