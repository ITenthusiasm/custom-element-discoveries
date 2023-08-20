/** The attributes _commonly_ used by the `CustomSelect` component. (These are declared to help avoid typos.) */
const localAttrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  value: "value",
});

class ComboboxContainer extends HTMLElement {
  // Internals
  #mounted = false;
  /** The ID used as a base for the IDs of all important elements belonging to the `ComboboxContainer` */
  #baseId?: string; // TODO: Do we want to use this? Also improve JSDoc. Or we can create a custom `root-id` attribute.

  // Important Elements
  #combobox: ComboboxSingle;
  #listbox: HTMLUListElement;

  constructor() {
    super();
    // Note: If we generated unique IDs, we wouldn't need this check. We can address this later.
    if (!this.id) throw new TypeError("An `id` attribute is required for `custom-select` for accessibility purposes.");

    this.#combobox = document.createElement("combobox-single") as ComboboxSingle;
    this.#listbox = document.createElement("ul");
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      /* -------------------- Setup Elements -------------------- */
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
        const optionValue = node.getAttribute(localAttrs.value) ?? (node.textContent as string);
        node.setAttribute("id", `${this.#listbox.id}-option-${optionValue}`);
        node.setAttribute("role", "option");
        node.setAttribute("aria-selected", String(false));
      }

      // Setup Primary Elements
      this.appendChild(this.#listbox);
      this.#listbox.insertAdjacentElement("beforebegin", this.#combobox);

      // Initialize Data
      this.#combobox.value = this.getAttribute("value") ?? "";
      this.removeAttribute("value");
      this.#mounted = true;
    }

    /* -------------------- Setup Event Listeners -------------------- */
    this.#listbox.addEventListener("mouseover", handleDelegatedOptionHover);
    this.#listbox.addEventListener("click", handleDelegatedOptionClick);
    this.addEventListener("mousedown", handleDelegatedMousedown);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#listbox.removeEventListener("mouseover", handleDelegatedOptionHover);
    this.#listbox.removeEventListener("click", handleDelegatedOptionClick);
    this.removeEventListener("mousedown", handleDelegatedMousedown);
  }
}

// export default ComboboxContainer; // For anyone using ES Modules
customElements.define("combobox-container", ComboboxContainer); // For anyone NOT using ES Modules

/* -------------------- Listbox Handlers -------------------- */
function handleDelegatedOptionHover(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We hovered the `listbox`, not an `option`

  const combobox = listbox.previousElementSibling as ComboboxSingle;
  setAttributeFor(combobox, localAttrs["aria-activedescendant"], option.id);
}

function handleDelegatedOptionClick(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We clicked the `listbox`, not an `option`
  if (option.hasAttribute("aria-disabled")) return;

  const combobox = listbox.previousElementSibling as ComboboxSingle;
  combobox.value = option.getAttribute(localAttrs.value) ?? (option.textContent as string);
  combobox.setAttribute(localAttrs["aria-expanded"], String(false));
}

/* -------------------- Container Handlers -------------------- */
function handleDelegatedMousedown(event: MouseEvent): void {
  if ((event.target as HTMLElement).matches("[role='option']")) return event.preventDefault();
}

/*
 * TODO: Maybe add a `MutationObserver` that clicks (selects) an option whenever `aria-selected` becomes true?
 * If we do this, we'd have to avoid causing an infinite loop though.
 *
 * EDIT: Frankly, this is probably too much work.
 */

/* -------------------- DELETE THESE LINES -------------------- */
document.querySelector("form")?.addEventListener("submit", handleSubmit);

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  console.log(Object.fromEntries(new FormData(form))); // eslint-disable-line no-console
  console.log(event); // eslint-disable-line no-console
}
