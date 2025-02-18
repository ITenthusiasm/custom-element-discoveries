/** @import ComboboxField from "./ComboboxField.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import attrs from "./attrs.js";

class ComboboxContainer extends HTMLElement {
  // Internals
  #mounted = false;

  // Important Elements
  /** @readonly @type {ComboboxField} */ #combobox;
  /** @readonly @type {HTMLElement} */ #listbox;

  constructor() {
    super();
    this.#combobox = /** @type {ComboboxField} */ (document.createElement("combobox-field"));
    this.#listbox = document.createElement("div");
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /* -------------------- Setup Elements -------------------- */
      // Root Element
      const comboboxId = this.id || Math.random().toString(36).slice(2);
      this.id = `${comboboxId}-container`;
      this.setAttribute("role", "none");

      // Combobox
      this.#combobox.setAttribute("id", comboboxId);
      this.#combobox.setAttribute("aria-controls", `${comboboxId}-listbox`);

      // Transfer relevant attributes from `container` to `combobox`
      for (let i = 0; this.attributes.length > 2; ) {
        const attr = this.attributes[i];
        if (attr.name === "id" || attr.name === "role") {
          i += 1;
          continue;
        }

        this.removeAttributeNode(attr);
        this.#combobox.setAttributeNode(attr);
      }

      // Listbox
      this.#listbox.setAttribute("id", `${comboboxId}-listbox`);
      this.#listbox.setAttribute("role", "listbox");
      this.#listbox.setAttribute("hidden", "");

      /* -------------------- Render Elements -------------------- */
      // Setup Children (Aggressively)
      /** @type {ComboboxOption | undefined} */
      let initialOption;

      while (this.childNodes.length > 0) {
        const node = this.childNodes[0];
        customElements.upgrade(node);

        if (!(node instanceof ComboboxOption)) {
          node.remove();
          continue;
        }

        this.#listbox.appendChild(node);
        node.setAttribute("id", `${comboboxId}-option-${node.value}`);
        if (node.defaultSelected || !initialOption) initialOption = node;
      }

      // Setup Primary Elements
      this.appendChild(this.#listbox);
      this.#listbox.insertAdjacentElement("beforebegin", this.#combobox);
      if (initialOption) this.#combobox.value = initialOption.value;

      this.#mounted = true;
    }

    /* -------------------- Setup Event Listeners -------------------- */
    this.#listbox.addEventListener("mouseover", handleDelegatedOptionHover, { passive: true });
    this.#listbox.addEventListener("click", handleDelegatedOptionClick, { passive: true });
    this.addEventListener("mousedown", handleDelegatedMousedown);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#listbox.removeEventListener("mouseover", handleDelegatedOptionHover);
    this.#listbox.removeEventListener("click", handleDelegatedOptionClick);
    this.removeEventListener("mousedown", handleDelegatedMousedown);
  }
}

export default ComboboxContainer;

/* -------------------- Listbox Handlers -------------------- */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDelegatedOptionHover(event) {
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
function handleDelegatedOptionClick(event) {
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
function handleDelegatedMousedown(event) {
  if (event.target instanceof ComboboxOption) return event.preventDefault();
}
