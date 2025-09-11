// Primary Imports
import ComboboxField from "./Combobox/ComboboxField.js";
import ComboboxListbox from "./Combobox/ComboboxListbox.js";
import ComboboxOption from "./Combobox/ComboboxOption.js";
import SelectEnhancer from "./Combobox/SelectEnhancer.js";

// Styles
import "./Combobox/Combobox.css";
import "./app.css";

/* -------------------- "App Logic" -------------------- */
customElements.define("combobox-field", ComboboxField);
customElements.define("combobox-listbox", ComboboxListbox);
customElements.define("combobox-option", ComboboxOption);
customElements.define("select-enhancer", SelectEnhancer);

/* -------------------- Handlers for Debugging -------------------- */
document.querySelector("form")?.addEventListener("submit", handleSubmit);

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  console.log(Object.fromEntries(new FormData(form))); // eslint-disable-line no-console
  console.log(event); // eslint-disable-line no-console
}
