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
    if (name === "value" && newValue !== oldValue) return this.#syncWithCombobox();
    if (name === "selected" && (newValue === null) !== (oldValue === null)) return (this.selected = newValue !== null);
  }

  // TODO: Do we want to use `ElementInternals` for ARIA? Would Playwright/Testing Library be able to detect that?
  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      this.setAttribute("role", "option");
      this.setAttribute("aria-selected", String(false));
      this.#mounted = true;
    }

    /*
     * TODO: Do we need the `closest` check anymore?
     *
     * UPDATE: This is probably due to the fact that in the HTML, `<combobox-option>`s start off as direct descendants
     * of the `<combobox-container` itself. However, this will change when we change the `<combobox-container>` to
     * accept _ONLY_ a regular `<select>` element, which is replaced with our Combobox Component when JS is available
     * in the browser. So... we should do some remaining minor cleanups in `ComboboxField`. Then we should immediately
     * update our code to expect `<select>` as the sole child to `<combobox-container>` so that we can know how to
     * reason about the rest of our code.
     *
     * ... On that note, maybe we should rename `<combobox-container>` to something like `<combobox-enhancer>` or
     * `<enhanced-combobox>`? I dunno... Think about it.
     */
    // Require a Corresponding `listbox`
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Verification needed on mount
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

  /** Retrives `combobox` that this `option` belongs to @returns {ComboboxField} */
  get #combobox() {
    return /** @type {ComboboxField} */ (this.#listbox.previousElementSibling);
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
