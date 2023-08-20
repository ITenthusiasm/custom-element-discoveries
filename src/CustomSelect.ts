const oldAttrs = {
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  "data-value": "data-value",
} as const;

class CustomSelect extends HTMLElement {
  static formAssociated = true;

  // Custom Element Internals
  #internals: ElementInternals;
  #shadowRoot: ShadowRoot;

  // Important Elements
  #container: HTMLDivElement;
  #combobox: HTMLDivElement;
  #listbox: HTMLUListElement;

  // Mutation Observer Callbacks
  readonly #expansionObserver: MutationObserver;
  readonly #activeOptionObserver: MutationObserver;

  // Local State
  /** The Custom Element's internal value. **DO NOT** use directly. Use the getter and setter instead. */
  #value = "";

  constructor() {
    super();
    if (!this.id) throw new TypeError("An `id` attribute is required for `custom-select` for accessibility purposes.");

    // Setup Internals
    this.#internals = this.attachInternals();
    this.#shadowRoot = this.attachShadow({ mode: "closed", delegatesFocus: true });

    // Setup Elements
    this.setAttribute("role", "none");
    this.#container = document.createElement("div");
    this.#container.setAttribute("data-custom-select-container", "");

    this.#combobox = document.createElement("div");
    this.#combobox.setAttribute("id", `${this.id}-combobox`);
    this.#combobox.setAttribute("role", "combobox");
    this.#combobox.setAttribute("tabindex", String(0));
    this.#combobox.setAttribute("aria-haspopup", "listbox");
    this.#combobox.setAttribute("aria-controls", `${this.id}-listbox`);
    this.#combobox.setAttribute(oldAttrs["aria-expanded"], String(false));
    this.#combobox.setAttribute(oldAttrs["aria-activedescendant"], "");
    this.#combobox.appendChild(document.createTextNode(""));

    this.#listbox = document.createElement("ul");
    this.#listbox.setAttribute("id", `${this.id}-listbox`);
    this.#listbox.setAttribute("role", "listbox");
    this.#listbox.setAttribute("hidden", "");

    // Render Elements
    this.#shadowRoot.appendChild(this.#container);
    this.#container.appendChild(this.#combobox);
    this.#container.appendChild(this.#listbox);
    const slot = this.#listbox.appendChild(document.createElement("slot")); // TODO: Map slotted element attributes

    // Add Styles
    const link = document.createElement("link");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("href", "./src/CustomSelect.css");
    this.#shadowRoot.appendChild(link);

    // Initialize Data
    slot.assignedNodes().forEach((option) => {
      if (!(option instanceof HTMLElement)) return option.parentNode?.removeChild(option); // Only allow valid elements

      const optionValue = option.getAttribute(oldAttrs["data-value"]) ?? (option.textContent as string);
      option.setAttribute("id", `${this.id}-option-${optionValue}`);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(false));
    });

    this.value = this.getAttribute("value") ?? "";

    // TODO: Figure out how to handle our observers
    this.#expansionObserver = new MutationObserver(watchExpansionOld);
    this.#activeOptionObserver = new MutationObserver(watchActiveDescendantOld);
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    // TODO: This does NOT work yet.
    // Associate labels with combobox. (Labels are not accessible until the element is connected.)
    const labels = Array.from(this.#internals.labels) as HTMLLabelElement[];
    labels.forEach((l, i) => l.setAttribute("id", `${this.id}-label-${i + 1}`));
    this.#combobox.setAttribute("aria-labelledby", labels.map(({ id }) => id).join(""));

    // Setup Mutation Observers
    this.#expansionObserver.observe(this.#combobox, { attributes: true, attributeFilter: [oldAttrs["aria-expanded"]] });
    this.#activeOptionObserver.observe(this.#combobox, {
      attributes: true,
      attributeFilter: [oldAttrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.#combobox.addEventListener("click", handleOldComboboxClick);
    this.#combobox.addEventListener("blur", handleOldComboboxBlur);
    this.#combobox.addEventListener("keydown", handleOldComboboxKeydown);

    this.#listbox.addEventListener("mouseover", handleOldDelegatedOptionHover);
    this.#listbox.addEventListener("click", handleOldDelegatedOptionClick);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#expansionObserver.disconnect();
    this.#activeOptionObserver.disconnect();

    this.#combobox.removeEventListener("click", handleOldComboboxClick);
    this.#combobox.removeEventListener("blur", handleOldComboboxBlur);
    this.#combobox.removeEventListener("keydown", handleOldComboboxKeydown);

    this.#listbox.removeEventListener("mouseover", handleOldDelegatedOptionHover);
    this.#listbox.removeEventListener("click", handleOldDelegatedOptionClick);
  }

  /** Retrieves the Custom Element's internal value (`this.#value`). */
  get value(): string {
    return this.#value;
  }

  /** Updates the Custom Element's internal value (`this.#value`) along with any relevant element attributes. */
  set value(v: string) {
    if (v === this.#value && v !== "") return; // Don't run setter logic redundantly

    // Unselect previous option
    const { host } = this.#combobox.getRootNode() as ShadowRoot;
    host.querySelector(`[${oldAttrs["aria-selected"]}="${true}"]`)?.removeAttribute(oldAttrs["aria-selected"]);

    // Operate on new option
    const selectedOption = document.getElementById(`${this.id}-option-${v}`);

    // An invalid option was supplied
    if (!selectedOption) {
      this.#value = "";
      this.#internals.setFormValue(this.#value);
      this.#combobox.childNodes[0].textContent = "";
      return;
    }

    this.#value = v;
    this.#internals.setFormValue(this.#value);
    selectedOption.setAttribute(oldAttrs["aria-selected"], String(true));
    this.#combobox.childNodes[0].textContent =
      selectedOption.getAttribute(oldAttrs["aria-label"]) ?? selectedOption.textContent;
  }

  // Note: This getter SHOULD NOT be used within the class
  get labels(): ElementInternals["labels"] {
    return this.#internals.labels;
  }

  // Note: This getter SHOULD NOT be used within the class
  get form(): ElementInternals["form"] {
    return this.#internals.form;
  }

  // Note: This getter SHOULD NOT be used within the class
  get validity(): ElementInternals["validity"] {
    return this.#internals.validity;
  }

  // Note: This getter SHOULD NOT be used within the class
  get validationMessage(): ElementInternals["validationMessage"] {
    return this.#internals.validationMessage;
  }
}

// export default CustomSelect; // For anyone using ES Modules
customElements.define("custom-select", CustomSelect); // For anyone NOT using ES Modules

/* -------------------- Combobox Handlers -------------------- */
function handleOldComboboxClick(event: MouseEvent): void {
  const combobox = event.target as HTMLButtonElement;
  const expanded = combobox.getAttribute("aria-expanded") === String(true);
  combobox.setAttribute(oldAttrs["aria-expanded"], String(!expanded));
}

function handleOldComboboxBlur(event: FocusEvent): void {
  const combobox = event.target as HTMLButtonElement;
  combobox.setAttribute(oldAttrs["aria-expanded"], String(false));
}

// TODO: How to handle the `CustomSelect` component being disabled?
function handleOldComboboxKeydown(event: KeyboardEvent): void {
  const combobox = event.target as HTMLButtonElement;
  const host = (combobox.getRootNode() as ShadowRoot).host as CustomSelect;
  const activeOption = host.querySelector<HTMLElement>("[data-active='true']");

  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    return setAttributeFor(combobox, oldAttrs["aria-expanded"], String(true));
  }

  if (event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(oldAttrs["aria-expanded"]) !== String(true)) {
      return combobox.setAttribute(oldAttrs["aria-expanded"], String(true));
    }

    const nextActiveOption = activeOption?.nextElementSibling;
    if (nextActiveOption) combobox.setAttribute(oldAttrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "End") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, oldAttrs["aria-expanded"], String(true));
    setAttributeFor(combobox, oldAttrs["aria-activedescendant"], host.lastElementChild?.id as string);
    return;
  }

  if ((event.altKey && event.key === "ArrowUp") || event.key === "Escape") {
    event.preventDefault(); // Don't scroll
    return setAttributeFor(combobox, oldAttrs["aria-expanded"], String(false));
  }

  if (event.key === "ArrowUp") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(oldAttrs["aria-expanded"]) !== String(true)) {
      return combobox.setAttribute(oldAttrs["aria-expanded"], String(true));
    }

    const nextActiveOption = activeOption?.previousElementSibling;
    if (nextActiveOption) combobox.setAttribute(oldAttrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, oldAttrs["aria-expanded"], String(true));
    setAttributeFor(combobox, oldAttrs["aria-activedescendant"], host.firstElementChild?.id as string);
    return;
  }

  if (event.key === "Tab") {
    if (combobox.getAttribute(oldAttrs["aria-expanded"]) === String(true)) return activeOption?.click();
    return;
  }

  if (event.key === " ") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(oldAttrs["aria-expanded"]) === String(true)) return activeOption?.click();
    return combobox.setAttribute(oldAttrs["aria-expanded"], String(true));
  }

  /*
   * WARNING: Calling `requestSubmit` without a specified `submitter` will cause the `form` to become the `submitter`.
   * UX doesn't care about this. So from the user perspective... Being able to submit a form easily by pressing
   * "Enter" while focusing the combobox is a great win. However, the DX will take a slight hit here because
   * because the developer will now need to be mindful of this (if they want to include a _different_ `submitter`
   * in their `FormData`, which is rare).
   */
  if (event.key === "Enter") {
    if (combobox.getAttribute(oldAttrs["aria-expanded"]) === String(true)) return activeOption?.click();
    return host.form?.requestSubmit();
  }

  // Option Searching Logic (should only operate on printable characters)
  if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    // TODO: Implement logic
  }
}

/* -------------------- Combobox Mutation Observer Details -------------------- */
function watchExpansionOld(mutations: MutationRecord[]): void {
  mutations.forEach(handleOldExpansionChange);
}

function handleOldExpansionChange(mutation: MutationRecord): void {
  const combobox = mutation.target as HTMLButtonElement;
  const listbox = combobox.nextElementSibling as HTMLUListElement;
  const { host } = combobox.getRootNode() as ShadowRoot;
  const expanded = combobox.getAttribute(oldAttrs["aria-expanded"]) === String(true);

  // Open Combobox
  if (expanded) {
    listbox.removeAttribute("hidden");
    const activeOption = host.querySelector("[aria-selected='true']") ?? (host.firstElementChild as HTMLElement);
    combobox.setAttribute(oldAttrs["aria-activedescendant"], activeOption.id);
  }
  // Close Combobox
  else {
    listbox.setAttribute("hidden", "");
    combobox.setAttribute(oldAttrs["aria-activedescendant"], "");
  }
}

function watchActiveDescendantOld(mutations: MutationRecord[]): void {
  mutations.forEach(handleOldActiveDescendantChange);
}

function handleOldActiveDescendantChange(mutation: MutationRecord): void {
  const combobox = mutation.target as HTMLButtonElement;

  const lastOptionId = mutation.oldValue;
  const lastOption = lastOptionId ? document.getElementById(lastOptionId) : null;
  lastOption?.removeAttribute("data-active");

  const activeOptionId = combobox.getAttribute(oldAttrs["aria-activedescendant"]) as string;
  const activeOption = document.getElementById(activeOptionId);
  activeOption?.setAttribute("data-active", String(true));
}

/* -------------------- Listbox Handlers -------------------- */
function handleOldDelegatedOptionHover(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We hovered the `listbox`, not an `option`

  const combobox = listbox.previousElementSibling as HTMLButtonElement;
  setAttributeFor(combobox, oldAttrs["aria-activedescendant"], option.id);
}

function handleOldDelegatedOptionClick(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We clicked the `listbox`, not an `option`
  if (option.hasAttribute("aria-disabled")) return;

  const { host } = listbox.getRootNode() as ShadowRoot;
  (host as CustomSelect).value = option.getAttribute(oldAttrs["data-value"]) ?? (option.textContent as string);

  const combobox = listbox.previousElementSibling as HTMLButtonElement;
  combobox.setAttribute(oldAttrs["aria-expanded"], String(false));
}

/*
 * TODO: Maybe add a `MutationObserver` that clicks (selects) an option whenever `aria-selected` becomes true?
 * If we do this, we'd have to avoid causing an infinite loop though.
 */
// TODO: Would adjusting scroll during `aria-activedescendant` updates be easier if we used `box-sizing: content-box`?
