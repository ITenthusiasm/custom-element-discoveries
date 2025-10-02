import type { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

/* https://svelte.dev/docs/svelte/typescript#Enhancing-built-in-DOM-types */
declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    "select-enhancer": HTMLSelectEnhancerAttributes;
    "combobox-field": HTMLComboboxFieldAttributes<ComboboxField>;
    "combobox-listbox": HTMLAttributes<ComboboxListbox>;
    "combobox-option": HTMLComboboxOptionAttributes;
  }

  // NOTE: We need this line so that the TypeScript compiler can recognize the `HTMLAttributes` type.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  export interface HTMLAttributes<T> {}

  export interface HTMLSelectEnhancerAttributes extends HTMLAttributes<SelectEnhancer> {
    comboboxtag?: SelectEnhancer["comboboxTag"] | null;
    listboxtag?: SelectEnhancer["listboxTag"] | null;
    optiontag?: SelectEnhancer["optionTag"] | null;
  }

  export interface HTMLComboboxFieldAttributes<T extends EventTarget> extends HTMLAttributes<T> {
    disabled?: ComboboxField["disabled"] | null;
    filter?: ComboboxField["filter"] | null;
    filtermethod?: ComboboxField["filterMethod"] | null;
    form?: string | null;
    name?: ComboboxField["name"] | null;
    nomatchesmessage?: ComboboxField["noMatchesMessage"] | null;
    required?: ComboboxField["required"] | null;
    valueis?: ComboboxField["valueIs"] | null;
    valuemissingerror?: ComboboxField["valueMissingError"] | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField attrs
  export interface HTMLSelectAttributes extends HTMLComboboxFieldAttributes<HTMLSelectElement> {}

  export interface HTMLComboboxOptionAttributes extends HTMLAttributes<ComboboxOption> {
    defaultSelected?: ComboboxOption["defaultSelected"];
    disabled?: ComboboxOption["disabled"] | null;
    selected?: ComboboxOption["selected"] | null;
    value?: ComboboxOption["value"] | null;
  }
}

export {}; // Ensure this is not an Ambient Module. Otherwise, original Svelte types will be overridden instead of augmented.
