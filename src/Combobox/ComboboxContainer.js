import ComboboxOption from "./ComboboxOption.js";

/** The attributes _commonly_ used by the `Combobox` component. (These are declared to help avoid typos.) */
export const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
});

class ComboboxContainer extends HTMLElement {
  // Internals
  #mounted = false;

  // TODO: Do we want to use this? Also improve JSDoc. Or we can create a custom `root-id` attribute.
  /**
   * @type {string | undefined}
   * The ID used as a base for the IDs of all important elements belonging to the `ComboboxContainer`
   */
  #baseId;

  // Important Elements
  /** @readonly @type {import("./ComboboxField.js").default} */
  #combobox;

  /** @readonly @type {HTMLElement} */
  #listbox;

  constructor() {
    super();
    this.#combobox = /** @type {import("./ComboboxField.js").default} */ (document.createElement("combobox-field"));
    this.#listbox = document.createElement("div");
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /* -------------------- Setup Elements -------------------- */
      // TODO: If we generated unique IDs, we wouldn't need this check. We can address this later.
      if (!this.id) throw new TypeError("An `id` attribute is required for accessibility purposes.");

      // Root Element
      this.setAttribute("role", "none");

      // Combobox
      // TODO: We need to figure out how to properly transfer the valid `name` to the `combobox`
      this.#combobox.setAttribute("id", `${this.id}-combobox`);
      this.#combobox.setAttribute("aria-controls", `${this.id}-listbox`);

      // Listbox
      this.#listbox.setAttribute("id", `${this.id}-listbox`);
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
        node.setAttribute("id", `${this.#listbox.id}-option-${node.value}`);
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

/* -------------------- Listbox Handlers -------------------- */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDelegatedOptionHover(event) {
  const listbox = /** @type {HTMLElement} */ (event.currentTarget);
  const option = /** @type {ComboboxOption} */ (event.target);
  if (option === listbox) return; // We hovered the `listbox`, not an `option`

  const combobox = /** @type {import("./ComboboxField.js").default} */ (listbox.previousElementSibling);
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

  const combobox = /** @type {import("./ComboboxField.js").default} */ (listbox.previousElementSibling);
  combobox.setAttribute(attrs["aria-expanded"], String(false));
  combobox.value = option.value;
}

/* -------------------- Container Handlers -------------------- */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDelegatedMousedown(event) {
  if (event.target instanceof ComboboxOption) return event.preventDefault();
}

/* -------------------- Local Helpers -------------------- */
/**
 * Sets the `attribute` of an `element` to the specified `value` _if_ the element's attribute
 * did not already have that value. Used to avoid redundantly triggering `MutationObserver`s.
 *
 * @param {HTMLElement} element
 * @param {string} attribute
 * @param {string} value
 * @returns {void}
 */
export function setAttributeFor(element, attribute, value) {
  if (element.getAttribute(attribute) === value) return;
  element.setAttribute(attribute, value);
}

export default ComboboxContainer;
