import type SelectEnhancer from "./SelectEnhancer.js";
import type ComboboxField from "./ComboboxField.js";
import type ComboboxOption from "./ComboboxOption.js";

declare global {
  interface HTMLElementTagNameMap {
    "select-enhancer": SelectEnhancer;
    "combobox-field": ComboboxField;
    "combobox-option": ComboboxOption;
  }
}
