/** The attributes _commonly_ used by the `Combobox` component. (These are declared to help avoid typos.) */
const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  value: "value",
});

type ExposedInternals = keyof Pick<ElementInternals, "labels" | "form" | "validity" | "validationMessage">;
class ComboboxSingle extends HTMLElement implements Pick<ElementInternals, ExposedInternals> {
  static formAssociated = true;

  // Internals
  #mounted = false;
  #internals: ElementInternals;
  #searchString = "";
  #searchTimeout: number | undefined;

  // Mutation Observer Callbacks
  readonly #expansionObserver: MutationObserver;
  readonly #activeOptionObserver: MutationObserver;

  // Local State
  /** The Custom Element's internal value. **DO NOT** use directly. Use the getter and setter instead. */
  #value = "";

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.#expansionObserver = new MutationObserver(watchExpansion);
    this.#activeOptionObserver = new MutationObserver(watchActiveDescendant);
  }

  // "On Mount" for Custom Elements
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      // Setup Attributes
      this.setAttribute("role", "combobox");
      this.setAttribute("tabindex", String(0));
      this.setAttribute("aria-haspopup", "listbox");
      this.setAttribute(attrs["aria-expanded"], String(false));
      this.setAttribute(attrs["aria-activedescendant"], "");
      this.insertAdjacentText("afterbegin", "");

      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    const expectedListbox = this.nextElementSibling;
    if (!(expectedListbox instanceof HTMLUListElement) || expectedListbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must be placed before a valid \`ul[role="listbox"]\` element.`);
    }

    // Setup Mutation Observers
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeOptionObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("click", handleComboboxClick);
    this.addEventListener("blur", handleComboboxBlur);
    this.addEventListener("keydown", handleComboboxKeydown);
  }

  // "On Unmount" for Custom Elements
  disconnectedCallback() {
    this.#expansionObserver.disconnect();
    this.#activeOptionObserver.disconnect();

    this.removeEventListener("click", handleComboboxClick);
    this.removeEventListener("blur", handleComboboxBlur);
    this.removeEventListener("keydown", handleComboboxKeydown);
  }

  /** Retrieves the Custom Element's internal value (`this.#value`). */
  get value(): string {
    return this.#value;
  }

  /** Updates the Custom Element's internal value (`this.#value`) along with any relevant element attributes. */
  set value(v: string) {
    if (v === this.#value && v !== "") return; // Don't run setter logic redundantly

    /* -------------------- Unselect previous option -------------------- */
    const listbox = this.nextElementSibling as HTMLUListElement;
    listbox.querySelector(`[${attrs["aria-selected"]}="${true}"]`)?.removeAttribute(attrs["aria-selected"]);

    /* -------------------- Operate on new option -------------------- */
    const selectedOption = document.getElementById(`${listbox.id}-option-${v}`);

    // An invalid option was supplied
    if (!selectedOption) {
      this.#value = "";
      this.#internals.setFormValue(this.#value);
      // TODO: Should we set internal `validity` to `badInput`?
      this.childNodes[0].textContent = "";
      return;
    }

    // A valid option was supplied
    this.#value = v;
    this.#internals.setFormValue(this.#value);
    selectedOption.setAttribute(attrs["aria-selected"], String(true));
    // TODO: What if we made a custom `ComboboxOption` element that had a `label` attribute like regular options?
    this.childNodes[0].textContent = selectedOption.getAttribute(attrs["aria-label"]) ?? selectedOption.textContent;
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

// export default CustomSingle; // For anyone using ES Modules
customElements.define("combobox-single", ComboboxSingle); // For anyone NOT using ES Modules

/* -------------------- Combobox Handlers -------------------- */
function handleComboboxClick(event: MouseEvent): void {
  const combobox = event.target as ComboboxSingle;
  const expanded = combobox.getAttribute("aria-expanded") === String(true);
  combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
}

function handleComboboxBlur(event: FocusEvent): void {
  const combobox = event.target as ComboboxSingle;
  setAttributeFor(combobox, attrs["aria-expanded"], String(false));
}

// TODO: How to handle the `CustomSelect` component being disabled?
function handleComboboxKeydown(event: KeyboardEvent): void {
  const combobox = event.target as ComboboxSingle;
  const listbox = combobox.nextElementSibling as HTMLUListElement;
  const activeOption = listbox.querySelector<HTMLElement>("[data-active='true']");

  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault(); // Don't scroll
    return setAttributeFor(combobox, attrs["aria-expanded"], String(true));
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
    setAttributeFor(combobox, attrs["aria-activedescendant"], listbox.lastElementChild?.id as string);
    return;
  }

  if ((event.altKey && event.key === "ArrowUp") || event.key === "Escape") {
    event.preventDefault(); // Don't scroll
    return setAttributeFor(combobox, attrs["aria-expanded"], String(false));
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
    setAttributeFor(combobox, attrs["aria-activedescendant"], listbox.firstElementChild?.id as string);
    return;
  }

  if (event.key === "Tab") {
    if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
    return;
  }

  if (event.key === " ") {
    event.preventDefault(); // Don't scroll
    if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
    return combobox.setAttribute(attrs["aria-expanded"], String(true));
  }

  if (event.key === "Enter") {
    // Select a Value (if the element is expanded)
    if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();

    // Submit the Form (if the element is collapsed)
    const { form } = combobox;
    if (!form) return;

    const submitterSelector = ":is(input, button)[type='submit'], button:not([type='button'], [type='reset'])";
    const submitter = Array.from(form.elements).find((e) => e.matches(`:is(${submitterSelector}):not(:disabled)`));
    return submitter ? (submitter as HTMLElement).click() : undefined;
  }

  // Option Searching Logic (should only operate on printable characters)
  if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    // TODO: Implement logic. (Should we use the `class` for this, or the element's `data-*` attributes?)
  }
}

/* -------------------- Combobox Mutation Observer Details -------------------- */
function watchExpansion(mutations: MutationRecord[]): void {
  mutations.forEach(handleExpansionChange);
}

function handleExpansionChange(mutation: MutationRecord): void {
  const combobox = mutation.target as ComboboxSingle;
  const listbox = combobox.nextElementSibling as HTMLUListElement; // TODO: Should we expose a `listbox` getter?
  const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

  // Open Combobox
  if (expanded) {
    listbox.removeAttribute("hidden");
    if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

    const activeOption = listbox.querySelector("[aria-selected='true']") ?? (listbox.firstElementChild as HTMLElement);
    combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
  }
  // Close Combobox
  else {
    listbox.setAttribute("hidden", "");
    combobox.setAttribute(attrs["aria-activedescendant"], "");
  }
}

function watchActiveDescendant(mutations: MutationRecord[]): void {
  mutations.forEach(handleActiveDescendantChange);
}

// TODO: We need to add `listbox` scrolling logic for when the `activedescendant` changes
// TODO: Would adjusting scroll during `aria-activedescendant` updates be easier if we used `box-sizing: content-box`?
function handleActiveDescendantChange(mutation: MutationRecord): void {
  const combobox = mutation.target as ComboboxSingle;

  // Deactivate Previous Option
  const lastOptionId = mutation.oldValue;
  const lastOption = lastOptionId ? document.getElementById(lastOptionId) : null;
  lastOption?.removeAttribute("data-active");

  // Activate New Option
  const activeOptionId = combobox.getAttribute(attrs["aria-activedescendant"]) as string;
  const activeOption = document.getElementById(activeOptionId);
  activeOption?.setAttribute("data-active", String(true));
}

/* -------------------- Local Helpers -------------------- */
/**
 * Sets the `attribute` of an `element` to the specified `value` _if_ the element's attribute
 * did not already have that value. Used to avoid redundantly triggering `MutationObserver`s.
 */
function setAttributeFor(element: HTMLElement, attribute: string, value: string): void {
  if (element.getAttribute(attribute) === value) return;
  element.setAttribute(attribute, value);
}
