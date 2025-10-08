/** @jsxImportSource preact */
import { render } from "preact";
import FormValidityObserverPreactTest from "./FormValidityObserverPreactTest.jsx";
import { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

if (!customElements.get("combobox-listbox")) customElements.define("combobox-listbox", ComboboxListbox);
if (!customElements.get("combobox-field")) customElements.define("combobox-field", ComboboxField);
if (!customElements.get("combobox-option")) customElements.define("combobox-option", ComboboxOption);
if (!customElements.get("select-enhancer")) customElements.define("select-enhancer", SelectEnhancer);

render(<FormValidityObserverPreactTest />, document.getElementById("app")!);
