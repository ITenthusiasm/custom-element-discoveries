import type { EventHandler } from "svelte/elements";
import type { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

declare module "svelte/elements" {
  interface SvelteHTMLElements {
    "select-enhancer": HTMLSelectEnhancerAttributes;
    "combobox-field": HTMLComboboxFieldAttributes<ComboboxField>;
    "combobox-listbox": HTMLAttributes<ComboboxListbox>;
    "combobox-option": HTMLComboboxOptionAttributes;
  }

  interface HTMLSelectEnhancerAttributes extends HTMLAttributes<SelectEnhancer> {
    comboboxtag?: SelectEnhancer["comboboxTag"] | null;
    listboxtag?: SelectEnhancer["listboxTag"] | null;
    optiontag?: SelectEnhancer["optionTag"] | null;
  }

  interface HTMLComboboxFieldAttributes<T extends EventTarget> extends HTMLAttributes<T> {
    disabled?: ComboboxField["disabled"] | null;
    filter?: ComboboxField["filter"] | null;
    filtermethod?: ComboboxField["filterMethod"] | null;
    form?: string | null;
    name?: ComboboxField["name"] | null;
    nomatchesmessage?: ComboboxField["noMatchesMessage"] | null;
    required?: ComboboxField["required"] | null;
    valueis?: ComboboxField["valueIs"] | null;
    valuemissingerror?: ComboboxField["valueMissingError"] | null;

    "on:filterchange"?: EventHandler<Event, T> | null;
    onfilterchange?: EventHandler<Event, T> | null;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField attrs
  interface HTMLSelectAttributes
    extends Omit<HTMLComboboxFieldAttributes<HTMLSelectElement>, "onfilterchange" | "on:filterchange"> {}

  interface HTMLComboboxOptionAttributes extends HTMLAttributes<ComboboxOption> {
    defaultSelected?: ComboboxOption["defaultSelected"] | null;
    disabled?: ComboboxOption["disabled"] | null;
    selected?: ComboboxOption["selected"] | null;
    value?: ComboboxOption["value"] | null;
  }
}
