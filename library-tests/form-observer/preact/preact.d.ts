import type { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../../../src/Combobox/index.js";

declare module "preact" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Necessary for type declaration merging
  namespace JSX {
    interface IntrinsicElements {
      "select-enhancer": SelectEnhancerHTMLAttributes<SelectEnhancer>;
      "combobox-field": ComboboxFieldHTMLAttributes<ComboboxField>;
      "combobox-listbox": HTMLAttributes<ComboboxListbox>;
      "combobox-option": ComboboxOptionHTMLAttributes<ComboboxOption>;
    }

    interface SelectEnhancerHTMLAttributes<T extends EventTarget = SelectEnhancer> extends HTMLAttributes<T> {
      comboboxtag?: Signalish<SelectEnhancer["comboboxTag"] | undefined>;
      listboxtag?: Signalish<SelectEnhancer["listboxTag"] | undefined>;
      optiontag?: Signalish<SelectEnhancer["optionTag"] | undefined>;
    }

    interface ComboboxFieldHTMLAttributes<T extends EventTarget = ComboboxField> extends HTMLAttributes<T> {
      disabled?: Signalish<ComboboxField["disabled"] | undefined>;
      filter?: Signalish<ComboboxField["filter"] | undefined>;
      filtermethod?: Signalish<ComboboxField["filterMethod"] | undefined>;
      form?: Signalish<string | undefined>;
      name?: Signalish<ComboboxField["name"] | undefined>;
      nomatchesmessage?: Signalish<ComboboxField["noMatchesMessage"] | undefined>;
      required?: Signalish<ComboboxField["required"] | undefined>;
      valueis?: Signalish<ComboboxField["valueIs"] | undefined>;
      valuemissingerror?: Signalish<ComboboxField["valueMissingError"] | undefined>;
      onfilterchange?: GenericEventHandler<T> | undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField props
    interface SelectHTMLAttributes<T extends EventTarget = HTMLSelectElement>
      extends Omit<ComboboxFieldHTMLAttributes<T>, "onfilterchange"> {}

    interface ComboboxOptionHTMLAttributes<T extends EventTarget = ComboboxOption> extends HTMLAttributes<T> {
      defaultSelected?: Signalish<ComboboxOption["defaultSelected"] | undefined>;
      disabled?: Signalish<ComboboxOption["disabled"] | undefined>;
      selected?: Signalish<ComboboxOption["selected"] | undefined>;
      value?: Signalish<ComboboxOption["value"] | undefined>;
    }
  }
}
