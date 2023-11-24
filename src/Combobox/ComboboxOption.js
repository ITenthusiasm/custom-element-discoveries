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
    if (name === "value" && newValue !== oldValue) return this.#syncWithCombobox();
    if (name === "selected" && (newValue === null) !== (oldValue === null)) return (this.selected = newValue !== null);
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      this.setAttribute("role", "option");
      this.setAttribute("aria-selected", String(false));
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    if (!this.#listbox && !this.closest("combobox-container")) {
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
    this.setAttribute("aria-disabled", String(Boolean(value)));
  }

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

  /** Retrives `combobox` that this `option` belongs to @returns {import("./ComboboxField.js").default} */
  get #combobox() {
    return /** @type {import("./ComboboxField.js").default} */ (this.#listbox.previousElementSibling);
  }

  #syncWithCombobox() {
    const combobox = this.#combobox;

    if (this.selected && combobox.value !== this.value) combobox.value = this.value;
    else if (!this.selected && combobox.value === this.value) {
      combobox.value = /** @type {this}  */ (this.#listbox.firstElementChild).value;
    }
  }
}

export default ComboboxOption;
