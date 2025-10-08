import type { HTMLAttributes, PublicProps, EmitFn } from "vue";
import type { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../index.js";

declare module "vue" {
  // Helper Types
  type Booleanish = boolean | "true" | "false";
  type VueEmitMap<T extends GlobalEventHandlersEventMap> = EmitFn<{ [K in keyof T]: (event: T[K]) => void }>;
  interface VueGlobalHTMLAttributes extends HTMLAttributes, Omit<PublicProps, "class" | "style"> {}

  /* -------------------- Select Enhancer -------------------- */
  interface SelectEnhancerHTMLAttributes extends VueGlobalHTMLAttributes {
    comboboxtag?: SelectEnhancer["comboboxTag"];
    listboxtag?: SelectEnhancer["listboxTag"];
    optiontag?: SelectEnhancer["optionTag"];
  }

  interface SelectEnhancerVueSFCType extends SelectEnhancer {
    /** @deprecated Only for use by Vue's templating language */
    $props: SelectEnhancerHTMLAttributes;

    /** @deprecated Only for use by Vue's templating language */
    $emit: VueEmitMap<HTMLElementEventMap>;
  }

  /* -------------------- Combobox Field -------------------- */
  interface ComboboxFieldHTMLAttributes extends VueGlobalHTMLAttributes {
    disabled?: Booleanish;
    filter?: ComboboxField["filter"];
    filtermethod?: ComboboxField["filterMethod"];
    form?: string;
    name?: ComboboxField["name"];
    nomatchesmessage?: ComboboxField["noMatchesMessage"];
    required?: Booleanish;
    valueis?: ComboboxField["valueIs"];
    valuemissingerror?: ComboboxField["valueMissingError"];
    onFilterchange?: (payload: Event) => void;
  }

  interface ComboboxFieldVueSFCType extends ComboboxField {
    /** @deprecated Only for use by Vue's templating language */
    $props: ComboboxFieldHTMLAttributes;

    /** @deprecated Only for use by Vue's templating language */
    $emit: VueEmitMap<ComboboxFieldEvents>;
  }

  interface ComboboxFieldEvents extends HTMLElementEventMap {
    filterchange: Event;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField attrs
  interface SelectHTMLAttributes extends Omit<ComboboxFieldHTMLAttributes, "onFilterchange"> {}

  /* -------------------- Combobox Listbox -------------------- */
  interface ComboboxListboxVueSFCType extends ComboboxListbox {
    /** @deprecated Only for use by Vue's templating language */
    $props: VueGlobalHTMLAttributes;

    /** @deprecated Only for use by Vue's templating language */
    $emit: VueEmitMap<HTMLElementEventMap>;
  }

  /* -------------------- Combobox Option -------------------- */
  interface ComboboxOptionHTMLAttributes extends VueGlobalHTMLAttributes {
    defaultSelected?: ComboboxOption["defaultSelected"];
    disabled?: ComboboxOption["disabled"];
    selected?: ComboboxOption["selected"];
    value?: ComboboxOption["value"];
  }

  interface ComboboxOptionVueSFCType extends ComboboxOption {
    /** @deprecated Only for use by Vue's templating language */
    $props: ComboboxOptionHTMLAttributes;

    /** @deprecated Only for use by Vue's templating language */
    $emit: VueEmitMap<HTMLElementEventMap>;
  }

  /* -------------------- Register Elements -------------------- */
  interface GlobalComponents {
    "select-enhancer": new () => SelectEnhancerVueSFCType;
    "combobox-field": new () => ComboboxFieldVueSFCType;
    "combobox-listbox": new () => ComboboxListboxVueSFCType;
    "combobox-option": new () => ComboboxOptionVueSFCType;
  }

  interface IntrinsicElementAttributes {
    "select-enhancer": SelectEnhancerHTMLAttributes;
    "combobox-field": ComboboxFieldHTMLAttributes;
    "combobox-listbox": VueGlobalHTMLAttributes;
    "combobox-option": ComboboxOptionHTMLAttributes;
  }
}
