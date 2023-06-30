class CustomSelect extends HTMLElement {
  static formAssociated = true;

  // Custom Element Internals
  #internals: ElementInternals;
  #shadowRoot: ShadowRoot;

  // Important Elements
  #container: HTMLDivElement;
  #combobox: HTMLButtonElement;
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

    // TODO: Should we use a `div` with a `tabdindex` instead?
    this.#combobox = document.createElement("button");
    this.#combobox.setAttribute("id", `${this.id}-combobox`);
    this.#combobox.setAttribute("type", "button");
    this.#combobox.setAttribute("role", "combobox");
    this.#combobox.setAttribute("aria-haspopup", "listbox");
    this.#combobox.setAttribute("aria-controls", `${this.id}-listbox`);
    this.#combobox.setAttribute(attrs["aria-expanded"], String(false));
    this.#combobox.setAttribute(attrs["aria-activedescendant"], "");
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

      const optionValue = option.getAttribute(attrs["data-value"]) ?? (option.textContent as string);
      option.setAttribute("id", `${this.id}-option-${optionValue}`);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(false));
    });

    this.value = this.getAttribute("value") ?? "";

    this.#expansionObserver = new MutationObserver(this.watchExpansion);
    this.#activeOptionObserver = new MutationObserver(this.watchActiveDescendant);
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
    this.#expansionObserver.observe(this.#combobox, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeOptionObserver.observe(this.#combobox, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.#combobox.addEventListener("click", handleComboboxClick);
    this.#combobox.addEventListener("blur", handleComboboxBlur);
    this.#combobox.addEventListener("keydown", handleComboboxKeydown);

    this.#listbox.addEventListener("mouseover", handleDelegatedOptionHover);
    this.#listbox.addEventListener("click", handleDelegatedOptionClick);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#expansionObserver.disconnect();
    this.#activeOptionObserver.disconnect();

    this.#combobox.removeEventListener("click", handleComboboxClick);
    this.#combobox.removeEventListener("blur", handleComboboxBlur);
    this.#combobox.removeEventListener("keydown", handleComboboxKeydown);

    this.#listbox.removeEventListener("mouseover", handleDelegatedOptionHover);
    this.#listbox.removeEventListener("click", handleDelegatedOptionClick);
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
    host.querySelector(`[${attrs["aria-selected"]}="${true}"]`)?.removeAttribute(attrs["aria-selected"]);

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
    selectedOption.setAttribute(attrs["aria-selected"], String(true));
    this.#combobox.childNodes[0].textContent =
      selectedOption.getAttribute(attrs["aria-label"]) ?? selectedOption.textContent;
  }

  // Note: This getter SHOULD NOT be used within the class
  get labels(): NodeList {
    return this.#internals.labels;
  }

  // Note: This getter SHOULD NOT be used within the class
  get form(): HTMLFormElement | null {
    return this.#internals.form;
  }

  // TODO: Figure out how to handle our observers
  // TODO + WARNING: Can't get options through `listbox.querySelector`. Need to use `host.querySelector`.
  /* -------------------- Observers -------------------- */
  watchExpansion: MutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      const combobox = mutation.target as HTMLButtonElement;
      const listbox = combobox.nextElementSibling as HTMLUListElement;
      const { host } = combobox.getRootNode() as ShadowRoot;
      const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

      // Open Combobox
      if (expanded) {
        listbox.removeAttribute("hidden");
        const activeOption = host.querySelector("[aria-selected='true']") ?? (host.firstElementChild as HTMLElement);
        combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
      }
      // Close Combobox
      else {
        listbox.setAttribute("hidden", "");
        combobox.setAttribute(attrs["aria-activedescendant"], "");
      }
    });
  };

  watchActiveDescendant: MutationCallback = (mutations) => {
    mutations.forEach((mutation) => {
      const combobox = mutation.target as HTMLButtonElement;

      const lastOptionId = mutation.oldValue;
      const lastOption = lastOptionId ? document.getElementById(lastOptionId) : null;
      lastOption?.removeAttribute("data-active");

      const activeOptionId = combobox.getAttribute(attrs["aria-activedescendant"]) as string;
      const activeOption = document.getElementById(activeOptionId);
      activeOption?.setAttribute("data-active", String(true));
    });
  };
}

// export default CustomSelect; // TODO: Export Element

const attrs = {
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  "data-value": "data-value",
} as const;

/* -------------------- Combobox Handlers -------------------- */
function handleComboboxClick(event: MouseEvent): void {
  const combobox = event.target as HTMLButtonElement;
  const expanded = combobox.getAttribute("aria-expanded") === String(true);
  combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
}

function handleComboboxBlur(event: FocusEvent): void {
  const combobox = event.target as HTMLButtonElement;
  combobox.setAttribute(attrs["aria-expanded"], String(false));
}

function handleComboboxKeydown(event: KeyboardEvent): void {
  const combobox = event.target as HTMLButtonElement;
  const { host } = combobox.getRootNode() as ShadowRoot;
  const activeOption = host.querySelector<HTMLElement>("[data-active='true']");

  // TODO: Should we create a `setAttributeFor` helper that automatically checks an attributes values before setting?
  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return;
    return combobox.setAttribute(attrs["aria-expanded"], String(true));
  }

  if (event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    const nextActiveOption = activeOption?.nextElementSibling;
    if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "End") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    setAttributeFor(combobox, attrs["aria-activedescendant"], host.lastElementChild?.id as string);
    return;
  }

  if ((event.altKey && event.key === "ArrowUp") || event.key === "Escape") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) === String(false)) return;
    return combobox.setAttribute(attrs["aria-expanded"], String(false));
  }

  if (event.key === "ArrowUp") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    const nextActiveOption = activeOption?.previousElementSibling;
    if (nextActiveOption) combobox.setAttribute(attrs["aria-activedescendant"], nextActiveOption.id);
    return;
  }

  if (event.key === "Home") {
    event.preventDefault(); // Don't scroll
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    setAttributeFor(combobox, attrs["aria-activedescendant"], host.firstElementChild?.id as string);
    return;
  }

  // TODO: What about Form Submissions? Also don't forget the `SpaceBar` (" ") key.
  if (event.key === "Enter" || event.key === "Tab") {
    if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) return;
    if (activeOption?.hasAttribute("aria-disabled")) return;

    activeOption?.click();
    return combobox.setAttribute(attrs["aria-expanded"], String(false));
  }
}

const watchExpansion: MutationCallback = (mutations) => {
  mutations.forEach((mutation) => {
    const combobox = mutation.target as HTMLButtonElement;
    const listbox = document.getElementById(combobox.getAttribute("aria-controls") as string) as HTMLUListElement;
    const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

    // Open Combobox
    if (expanded) {
      listbox.removeAttribute("hidden");
      combobox.setAttribute(attrs["aria-activedescendant"], ""); // TODO: Set to currently selected value
    }
    // Close Combobox
    else listbox.setAttribute("hidden", "");
  });
};

/* -------------------- Listbox Handlers -------------------- */
function handleDelegatedOptionHover(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We hovered the `listbox`, not an `option`

  const combobox = listbox.previousElementSibling as HTMLButtonElement;
  setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
}

function handleDelegatedOptionClick(event: MouseEvent): void {
  const listbox = event.currentTarget as HTMLUListElement;
  const option = event.target as HTMLElement;
  if (option === listbox) return; // We clicked the `listbox`, not an `option`

  const combobox = listbox.previousElementSibling as HTMLButtonElement;
  const { host } = combobox.getRootNode() as ShadowRoot;
  (host as CustomSelect).value = option.getAttribute(attrs["data-value"]) ?? (option.textContent as string);
}

/*
 * TODO: Maybe add a `MutationObserver` that clicks (selects) an option whenever `aria-selected` becomes true?
 * If we do this, we'd have to avoid causing an infinite loop though.
 */
// TODO: Would adjusting scroll during `aria-activedescendant` updates be easier if we used `box-sizing: content-box`?

/* -------------------- Local Helpers -------------------- */
/**
 * Sets the `attribute` of an `element` to the specified `value` _if_ the element's attribute
 * did not already have that value
 */
function setAttributeFor(element: HTMLElement, attribute: string, value: string): void {
  if (element.getAttribute(attribute) === value) return;
  element.setAttribute(attribute, value);
}

/* -------------------- DELETE THESE LINES -------------------- */
customElements.define("custom-select", CustomSelect);

document.querySelector("custom-select")?.addEventListener("click", console.log);
document.querySelector("form")?.addEventListener("submit", handleSubmit);

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  console.log(Object.fromEntries(new FormData(form))); // eslint-disable-line no-console
  console.log(event); // eslint-disable-line no-console
}
