/** @import ComboboxField from "./ComboboxField.js" */

class ComboboxListbox extends HTMLElement {
  static get observedAttributes() {
    return /** @type {const} */ (["nomatchesmessage"]);
  }

  /**
   * @param {typeof ComboboxListbox.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Check for string is intentional/desired
    if (name === "nomatchesmessage" && newValue !== oldValue) {
      if (newValue) this.#combobox.setAttribute(name, newValue);
      else this.#combobox.removeAttribute(name);
    }
  }

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    this.setAttribute("role", "listbox");
    this.setAttribute("tabindex", String(-1));
  }

  /** Retrives the `combobox` that this `listbox` belongs to @returns {ComboboxField} */
  get #combobox() {
    return /** @type {ComboboxField} */ (this.previousElementSibling);
  }
}

export default ComboboxListbox;
