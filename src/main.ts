// Primary Imports
import ComboboxField from "./Combobox/ComboboxField.js";
import ComboboxOption from "./Combobox/ComboboxOption.js";
import ComboboxContainer from "./Combobox/ComboboxContainer.js";

// Styles
import "./Combobox/Combobox.css";
import "./app.css";

/* -------------------- "App Logic" -------------------- */
customElements.define("combobox-field", ComboboxField);
customElements.define("combobox-option", ComboboxOption);
customElements.define("combobox-container", ComboboxContainer);

/* -------------------- Handlers for Debugging -------------------- */
document.querySelector("form")?.addEventListener("submit", handleSubmit);

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  console.log(Object.fromEntries(new FormData(form))); // eslint-disable-line no-console
  console.log(event); // eslint-disable-line no-console
}
