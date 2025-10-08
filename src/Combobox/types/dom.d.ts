import type SelectEnhancer from "../SelectEnhancer.js";
import type ComboboxField from "../ComboboxField.js";
import type ComboboxListbox from "../ComboboxListbox.js";
import type ComboboxOption from "../ComboboxOption.js";

declare global {
  interface HTMLElementTagNameMap {
    "select-enhancer": SelectEnhancer;
    "combobox-field": ComboboxField;
    "combobox-listbox": ComboboxListbox;
    "combobox-option": ComboboxOption;
  }
}
