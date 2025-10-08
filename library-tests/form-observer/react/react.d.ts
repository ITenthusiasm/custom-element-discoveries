import type { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../../../src/Combobox/index.js";

declare module "react" {
  interface SelectEnhancerHTMLAttributes<T> extends HTMLAttributes<T> {
    comboboxtag?: SelectEnhancer["comboboxTag"];
    listboxtag?: SelectEnhancer["listboxTag"];
    optiontag?: SelectEnhancer["optionTag"];
  }

  interface ComboboxFieldHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: ComboboxField["disabled"];
    filter?: ComboboxField["filter"];
    filtermethod?: ComboboxField["filterMethod"];
    form?: string; // WARNING: React does not yet support the `form` attribute for Custom Elements
    name?: ComboboxField["name"];
    nomatchesmessage?: ComboboxField["noMatchesMessage"];
    required?: ComboboxField["required"];
    valueis?: ComboboxField["valueIs"];
    valuemissingerror?: ComboboxField["valueMissingError"];

    onfilterchange?: ReactEventHandler<T>;
    onfilterchangeCapture?: ReactEventHandler<T>;
  }

  interface SelectHTMLAttributes<T>
    extends Omit<ComboboxFieldHTMLAttributes<T>, "filter" | "onfilterchange" | "onfilterchangeCapture"> {
    filter?: "";
  }

  interface ComboboxOptionHTMLAttributes<T> extends HTMLAttributes<T> {
    defaultSelected?: ComboboxOption["defaultSelected"];
    disabled?: ComboboxOption["disabled"];
    selected?: ComboboxOption["selected"];
    value?: ComboboxOption["value"];
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace -- Necessary for type declaration merging
  namespace JSX {
    interface IntrinsicElements {
      "select-enhancer": React.DetailedHTMLProps<React.SelectEnhancerHTMLAttributes<SelectEnhancer>, SelectEnhancer>;
      "combobox-field": React.DetailedHTMLProps<React.ComboboxFieldHTMLAttributes<ComboboxField>, ComboboxField>;
      "combobox-listbox": React.DetailedHTMLProps<React.HTMLAttributes<ComboboxListbox>, ComboboxListbox>;
      "combobox-option": React.DetailedHTMLProps<React.ComboboxOptionHTMLAttributes<ComboboxOption>, ComboboxOption>;
    }
  }
}

/*
 * NOTE: React handles native attributes inconsistently between Custom Elements and native `HTMLElement`s.
 * For example, applying `form` to a native form control will alter the corresponding attribute. However,
 * applying `form` to a Custom Form Control that exposes a `form` getter will cause React to throw a runtime
 * error. The React team will need to figure out the best way to address this problem. See:
 * https://github.com/facebook/react/issues/34663.
 */
