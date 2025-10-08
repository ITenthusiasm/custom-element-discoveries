import { createApp } from "vue";
import FormValidityObserverVueTest from "./FormValidityObserverVueTest.vue";
// import JSXTest from "./JSXTest.vue"; // Only for testing JSX + TS in Vue, not forms
import { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

if (!customElements.get("combobox-listbox")) customElements.define("combobox-listbox", ComboboxListbox);
if (!customElements.get("combobox-field")) customElements.define("combobox-field", ComboboxField);
if (!customElements.get("combobox-option")) customElements.define("combobox-option", ComboboxOption);
if (!customElements.get("select-enhancer")) customElements.define("select-enhancer", SelectEnhancer);

createApp(FormValidityObserverVueTest).mount("#app");
