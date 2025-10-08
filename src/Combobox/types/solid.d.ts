import type { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../index.js";

declare module "solid-js" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Necessary for type declaration merging
  namespace JSX {
    interface HTMLElementTags {
      "select-enhancer": SelectEnhancerHTMLAttributes<SelectEnhancer>;
      "combobox-field": ComboboxFieldHTMLAttributes<ComboboxField>;
      "combobox-listbox": HTMLAttributes<ComboboxListbox>;
      "combobox-option": ComboboxOptionHTMLAttributes<ComboboxOption>;
    }

    interface SelectEnhancerHTMLAttributes<T> extends HTMLAttributes<T> {
      comboboxtag?: SelectEnhancer["comboboxTag"];
      listboxtag?: SelectEnhancer["listboxTag"];
      optiontag?: SelectEnhancer["optionTag"];
    }

    interface ComboboxFieldHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: ComboboxField["disabled"];
      filter?: ComboboxField["filter"];
      filtermethod?: ComboboxField["filterMethod"];
      form?: string;
      name?: ComboboxField["name"];
      nomatchesmessage?: ComboboxField["noMatchesMessage"];
      required?: ComboboxField["required"];
      valueis?: ComboboxField["valueIs"];
      valuemissingerror?: ComboboxField["valueMissingError"];

      onFilterchange?: EventHandlerUnion<T, Event>;
      onfilterchange?: EventHandlerUnion<T, Event>;
      "on:filterchange"?: EventHandlerWithOptionsUnion<T, Event>;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField props
    interface SelectHTMLAttributes<T>
      extends Omit<ComboboxFieldHTMLAttributes<T>, "onFilterchange" | "onfilterchange" | "on:filterchange"> {}

    interface ComboboxOptionHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: ComboboxOption["disabled"];
      selected?: ComboboxOption["selected"];
      value?: ComboboxOption["value"];
    }
  }
}
