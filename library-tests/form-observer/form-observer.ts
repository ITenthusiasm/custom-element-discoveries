import { FormValidityObserver } from "@form-observer/core";
import type { ValidatableField } from "@form-observer/core";
import { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../../src/Combobox/index.js";

customElements.define("combobox-listbox", ComboboxListbox);
customElements.define("combobox-field", ComboboxField);
customElements.define("combobox-option", ComboboxOption);
customElements.define("select-enhancer", SelectEnhancer);

/* ---------- Setup ---------- */
const form = document.querySelector("form") as HTMLFormElement;
const observer = new FormValidityObserver("focusout", {
  revalidateOn: "input",
  defaultErrors: {
    required(field: ValidatableField) {
      if (field instanceof HTMLInputElement && field.type === "radio") {
        const radiogroup = field.closest("fieldset[role='radiogroup']");
        return `${radiogroup?.firstElementChild?.textContent ?? "This radiogroup"} is required.`;
      }

      return `${field.labels?.[0].textContent ?? "This field"} is required.`;
    },
  },
});

observer.observe(form);
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const success = await observer.validateFields({ focus: true });
  if (success) alert(JSON.stringify(Object.fromEntries(new FormData(form)), null, 2));
});

/* ---------- Error Configurations ---------- */
observer.configure("email", { required: "You MUST allow us to stalk you." });

observer.configure("password", {
  pattern: {
    render: true,
    message({ value }: HTMLInputElement) {
      return `
        <div style="color: var(--color)">
          <div>Password Requirements</div>
          <ul>
            <li data-password-requirement-valid="${/[a-z]/.test(value)}">One lowercase letter.</li>
            <li data-password-requirement-valid="${/[A-Z]/.test(value)}">One uppercase letter.</li>
            <li data-password-requirement-valid="${/\d/.test(value)}">One number.</li>
            <li data-password-requirement-valid="${/[@$!%*?&]/.test(value)}">One special character.</li>
            <li data-password-requirement-valid="${value.length >= 8}">8 characters minimum.</li>
          </ul>
        </div>
      `;
    },
  },
});

observer.configure("confirm-password", {
  // NOTE: This function DOES NOT need to be async. It's only async for the sake of example.
  async validate(input: HTMLInputElement) {
    const password = input.form?.elements.namedItem("password") as HTMLInputElement;
    if (input.value !== password.value) return Promise.resolve("Passwords do not match.");
  },
});

observer.configure("job", {
  validate(combobox: ComboboxField) {
    if (/(punching|tournaments)/i.test(combobox.value as string)) return "Don't choose this job.";
  },
});
