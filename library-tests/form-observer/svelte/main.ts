import { mount } from "svelte";
import FormValidityObserverSvelteTest from "./FormValidityObserverSvelteTest.svelte";
import { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

if (!customElements.get("combobox-listbox")) customElements.define("combobox-listbox", ComboboxListbox);
if (!customElements.get("combobox-field")) customElements.define("combobox-field", ComboboxField);
if (!customElements.get("combobox-option")) customElements.define("combobox-option", ComboboxOption);
if (!customElements.get("select-enhancer")) customElements.define("select-enhancer", SelectEnhancer);

const app = mount(FormValidityObserverSvelteTest, { target: document.getElementById("app") as HTMLElement });
export default app;
