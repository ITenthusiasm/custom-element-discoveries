/** The attributes _commonly_ used by the `Combobox` component. (These are declared to help avoid typos.) */
export const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  value: "value",
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
  /** @type {import("./ComboboxSingle").default} */
  #combobox;

  /** @type {HTMLUListElement} */
  #listbox;

  constructor() {
    super();

    this.#combobox = /** @type {import("./ComboboxSingle").default} */ (document.createElement("combobox-single"));
    this.#listbox = document.createElement("ul");
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /* -------------------- Setup Elements -------------------- */
      // Note: If we generated unique IDs, we wouldn't need this check. We can address this later.
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
      while (this.childNodes.length > 0) {
        const node = this.childNodes[0];

        // Only Allow Valid Elements | TODO: Require "valid `ComboboxOption` elements"
        if (!(node instanceof HTMLElement)) {
          node.remove();
          continue;
        }

        this.#listbox.appendChild(node);

        /*
         * TODO: We should take "Option Requirements" from
         * https://developer.mozilla.org/en-US/docs/Web/API/HTMLOptionElement
         */
        // TODO: If we use a custom element, can we just do node.value?
        const optionValue = node.getAttribute(attrs.value) ?? /** @type {string} */ (node.textContent);
        node.setAttribute("id", `${this.#listbox.id}-option-${optionValue}`);
        node.setAttribute("role", "option");
        node.setAttribute("aria-selected", String(false));
      }

      // Setup Primary Elements
      this.appendChild(this.#listbox);
      this.#listbox.insertAdjacentElement("beforebegin", this.#combobox);

      // Initialize Data
      // TODO: Need a cleaner way to get default value. (Explicit, then first child VALUE (not text), then "".)
      this.#combobox.value = (this.getAttribute("value") || this.#listbox.firstElementChild.textContent) ?? "";
      this.removeAttribute("value");
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
  const listbox = /** @type {HTMLUListElement} */ (event.currentTarget);
  const option = /** @type {HTMLElement} */ (event.target);
  if (option === listbox) return; // We hovered the `listbox`, not an `option`

  const combobox = /** @type {import("./ComboboxSingle").default} */ (listbox.previousElementSibling);
  setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
}

/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDelegatedOptionClick(event) {
  const listbox = /** @type {HTMLUListElement} */ (event.currentTarget);
  const option = /** @type {HTMLElement} */ (event.target);
  if (option === listbox) return; // We clicked the `listbox`, not an `option`
  if (option.hasAttribute("aria-disabled")) return;

  const combobox = /** @type {import("./ComboboxSingle").default} */ (listbox.previousElementSibling);
  combobox.value = option.getAttribute(attrs.value) ?? /** @type {string} */ (option.textContent);
  combobox.setAttribute(attrs["aria-expanded"], String(false));
}

/* -------------------- Container Handlers -------------------- */
/**
 * @param {MouseEvent} event
 * @returns {void}
 */
function handleDelegatedMousedown(event) {
  if (/** @type {HTMLElement} */ (event.target).matches("[role='option']")) return event.preventDefault();
}

/*
 * TODO: Maybe add a `MutationObserver` that clicks (selects) an option whenever `aria-selected` becomes true?
 * If we do this, we'd have to avoid causing an infinite loop though.
 *
 * EDIT: Frankly, this is probably too much work.
 */

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
