/** @import ComboboxField from "./ComboboxField.js" */
/** @import ComboboxListbox from "./ComboboxListbox.js" */

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
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "selected" && (newValue === null) !== (oldValue === null)) {
      this.selected = newValue !== null;
      return;
    }

    if (name === "value" && this.#combobox && newValue !== oldValue) {
      this.id = `${this.#combobox.id}-option-${newValue ?? this.textContent}`;
      return this.#syncWithCombobox();
    }
  }

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    // Require a Corresponding `listbox` + `combobox`
    if (!this.#listbox) {
      throw new TypeError(`A ${this.constructor.name} must be placed inside a valid \`[role="listbox"]\` element.`);
    }
    if (!this.#combobox) {
      throw new TypeError(`A ${this.constructor.name}'s \`listbox\` must be controlled by a valid \`combobox\``);
    }

    if (!this.#mounted) {
      if (!this.id) this.setAttribute("id", `${this.#combobox.id}-option-${this.value}`);
      this.setAttribute("role", "option");
      this.setAttribute("aria-selected", String(this.selected));
      this.#mounted = true;
    }
  }

  /** The `option`'s label */
  get label() {
    return this.textContent;
  }

  /** The value of the `option`. Defaults to the `option`'s {@link label}. */
  get value() {
    return this.getAttribute("value") ?? this.label;
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
    this.toggleAttribute("selected", value);
  }

  get disabled() {
    return this.getAttribute("aria-disabled") === String(true);
  }

  set disabled(value) {
    if (value) this.setAttribute("aria-disabled", String(true));
    else this.removeAttribute("aria-disabled");
  }

  // NOTE: This approach might not work anymore if we want to support `group`ed `option`s in the future (unlikely)
  /** The position of the option within the list of options that it belongs to. */
  get index() {
    // NOTE: Defaulting to `0` in lieu of an owning `listbox` mimics what the native `<select>` does.
    return this.#listbox ? Array.prototype.indexOf.call(this.#listbox.children, this) : 0;
  }

  /** The `HTMLFormElement` that owns the `combobox` associated with this element */
  get form() {
    return this.#combobox?.form ?? null;
  }

  /** Retrieves the `listbox` that owns this `option` @returns {ComboboxListbox | null} */
  get #listbox() {
    return /** @type {ComboboxListbox | null} */ (this.closest("[role='listbox']"));
  }

  /** Retrives the `combobox` that this `option` belongs to @returns {ComboboxField | null | undefined} */
  get #combobox() {
    return /** @type {ComboboxField | null | undefined} */ (this.#listbox?.previousElementSibling);
  }

  /** @returns {void} */
  #syncWithCombobox() {
    if (!this.#combobox) return;
    const combobox = this.#combobox;

    if (this.selected && combobox.value !== this.value) combobox.value = this.value;
    else if (!this.selected && combobox.value === this.value) {
      if (combobox.text.data && combobox.acceptsValue(combobox.text.data)) return;
      if (combobox.acceptsValue("")) return combobox.forceEmptyValue();
      combobox.formResetCallback();
    }
  }
}

export default ComboboxOption;
