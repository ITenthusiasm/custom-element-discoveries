// Primary Imports
import ComboboxSingle from "./Combobox/ComboboxSingle";
import ComboboxContainer from "./Combobox/ComboboxContainer";
import CustomSelect from "./deprecated/CustomSelect/CustomSelect";

// Styles
import "./Combobox/Combobox.css";
import "./deprecated/CustomSelect/CustomSelect.css";
import "./app.css";

/* -------------------- "App Logic" -------------------- */
customElements.define("custom-select", CustomSelect);
customElements.define("combobox-single", ComboboxSingle);
customElements.define("combobox-container", ComboboxContainer);

/* -------------------- Handlers for Debugging -------------------- */
document.querySelector("form")?.addEventListener("submit", handleSubmit);

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  console.log(Object.fromEntries(new FormData(form))); // eslint-disable-line no-console
  console.log(event); // eslint-disable-line no-console
}
