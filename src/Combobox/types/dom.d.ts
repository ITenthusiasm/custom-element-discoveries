import type { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../index.js";

declare global {
  interface HTMLElementTagNameMap {
    "select-enhancer": SelectEnhancer;
    "combobox-field": ComboboxField;
    "combobox-listbox": ComboboxListbox;
    "combobox-option": ComboboxOption;
  }
}
