/** @jsxImportSource solid-js */
import { render } from "solid-js/web";
import { createFormValidityObserver } from "@form-observer/solid";
import type { ValidatableField } from "@form-observer/solid";
import { SelectEnhancer, ComboboxField, ComboboxListbox, ComboboxOption } from "../../../src/Combobox/index.js";

function FormValidityObserverSolidTest() {
  const { autoObserve, configure, validateFields } = createFormValidityObserver("focusout", {
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

  // Submission Handler
  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const success = await validateFields({ focus: true });
    if (success) alert(JSON.stringify(Object.fromEntries(new FormData(form)), null, 2));
  }

  return (
    <form use:autoObserve onSubmit={handleSubmit}>
      <h1>Example Form</h1>

      <div class="form-field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          aria-describedby="email-error"
          {...configure("email", { required: "You MUST allow us to stalk you." })}
        />
        <div id="email-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          maxlength="99"
          required
          aria-describedby="password-error"
          {...configure("password", {
            pattern: {
              render: true,
              value: "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}",
              message({ value }: HTMLInputElement) {
                return `
                  <div style="color: var(--color)">
                    <div>Password Requirements</div>
                    <ul>
                      <li data-password-requirement-valid="${/[a-z]/.test(value)}">One lowercase letter</li>
                      <li data-password-requirement-valid="${/[A-Z]/.test(value)}">One uppercase letter</li>
                      <li data-password-requirement-valid="${/\d/.test(value)}">One number</li>
                      <li data-password-requirement-valid="${/[@$!%*?&]/.test(value)}">One special character</li>
                      <li data-password-requirement-valid="${value.length >= 8}">8 characters minimum</li>
                    </ul>
                  </div>
                `;
              },
            },
          })}
        />
        <div id="password-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          type="password"
          required
          aria-describedby="confirm-password-error"
          {...configure("confirm-password", {
            // NOTE: This function DOES NOT need to be async. It's only async for the sake of example.
            async validate(input: HTMLInputElement) {
              const password = input.form?.elements.namedItem("password") as HTMLInputElement;
              if (input.value !== password.value) return Promise.resolve("Passwords do not match.");
            },
          })}
        />
        <div id="confirm-password-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="types">Preferred Type System</label>
        <select-enhancer>
          <combobox-field id="types" name="types" required aria-describedby="types-error" />
          <combobox-listbox>
            <combobox-option value="" selected>
              Choose One
            </combobox-option>
            <combobox-option value="jsdocs">JSDocs</combobox-option>
            <combobox-option value="ts">TypeScript</combobox-option>
            <combobox-option value="anarchy">I Hate Types</combobox-option>
            <combobox-option value="kotowaru">I Hate JavaScript</combobox-option>
          </combobox-listbox>
        </select-enhancer>

        <div id="types-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="sport">Best Sport</label>
        <select-enhancer>
          <select id="sport" name="sport" filter valueis="unclearable" required aria-describedby="sport-error">
            <option value="" selected>
              Nothing
            </option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="softball">Softball</option>
            <option value="hockey">Hockey</option>
            <option value="baseball">Baseball</option>
            <option value="skating">Figure Skating</option>
            <option value="swimming">Swimming</option>
            <option value="horses">Horse Racing</option>
            <option value="socker">Socker</option>
          </select>
        </select-enhancer>

        <div id="sport-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="fruit">Most Eaten Fruit</label>
        <select-enhancer>
          <combobox-field id="fruit" name="fruit" filter required aria-describedby="fruit-error" />
          <combobox-listbox>
            <combobox-option value="">Select a Fruit</combobox-option>
            <combobox-option value="mulberry">Mulberry</combobox-option>
            <combobox-option value="banana">Banana</combobox-option>
            <combobox-option value="peach">Peach</combobox-option>
            <combobox-option value="blackberry">Blackberry</combobox-option>
            <combobox-option value="pineapple">Pineapple</combobox-option>
            <combobox-option value="mango">Mango</combobox-option>
            <combobox-option value="blueberry">Blueberry</combobox-option>
            <combobox-option value="melon">Melon</combobox-option>
            <combobox-option value="pear">Pair</combobox-option>
          </combobox-listbox>
        </select-enhancer>

        <div id="fruit-error" role="alert"></div>
      </div>

      <div class="form-field">
        <label for="job">Dream Job</label>
        <select-enhancer>
          <select
            id="job"
            filter
            valueis="anyvalue"
            required
            aria-describedby="job-error"
            {...configure("job", {
              validate(combobox: ComboboxField) {
                if (/(punching|tournaments)/i.test(combobox.value as string)) return "Don't choose this job.";
              },
            })}
          >
            <option value="">Sleeping</option>
            <option value="oss">Open Source Maintainer</option>
            <option value="coding">Software Engineer</option>
            <option value="ceo">CEO</option>
            <option value="meche">Mechanical Engineer</option>
            <option value="food">Chef</option>
            <option value="tournaments">Gaming</option>
          </select>
        </select-enhancer>

        <div id="job-error" role="alert"></div>
      </div>

      <fieldset class="form-field" role="radiogroup" aria-describedby="framework-error">
        <legend>Favorite Framework</legend>

        <div>
          <input id="svelte" name="framework" type="radio" value="svelte" required />
          <label for="svelte">Svelte</label>

          <input id="vue" name="framework" type="radio" value="vue" />
          <label for="vue">Vue</label>

          <input id="solid" name="framework" type="radio" value="solid" />
          <label for="solid">Solid</label>

          <input id="react" name="framework" type="radio" value="react" />
          <label for="react">React</label>
        </div>

        <div id="framework-error" role="alert"></div>
      </fieldset>

      <div class="form-field">
        <label for="bio">Autobiography</label>
        <textarea id="bio" name="bio" minlength="80" maxlength="150" aria-describedby="bio-error"></textarea>
        <div id="bio-error" role="alert"></div>
      </div>

      <button type="submit">Sign Up</button>
    </form>
  );
}

if (!customElements.get("combobox-listbox")) customElements.define("combobox-listbox", ComboboxListbox);
if (!customElements.get("combobox-field")) customElements.define("combobox-field", ComboboxField);
if (!customElements.get("combobox-option")) customElements.define("combobox-option", ComboboxOption);
if (!customElements.get("select-enhancer")) customElements.define("select-enhancer", SelectEnhancer);
render(() => <FormValidityObserverSolidTest />, document.getElementById("root") as HTMLElement);

declare module "solid-js" {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Necessary for type declaration merging
  namespace JSX {
    interface SelectEnhancerHTMLAttributes<T> extends HTMLAttributes<T> {
      comboboxtag?: SelectEnhancer["comboboxTag"];
      listboxtag?: SelectEnhancer["listboxTag"];
      optiontag?: SelectEnhancer["optionTag"];
    }

    interface ComboboxFieldHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: ComboboxField["disabled"];
      filter?: ComboboxField["filter"];
      filtermethod?: ComboboxField["filterMethod"];
      form?: string;
      name?: ComboboxField["name"];
      nomatchesmessage?: ComboboxField["noMatchesMessage"];
      required?: ComboboxField["required"];
      valueis?: ComboboxField["valueIs"];
      valuemissingerror?: ComboboxField["valueMissingError"];
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- This is required to support ComboboxField props
    interface SelectHTMLAttributes<T> extends ComboboxFieldHTMLAttributes<T> {}

    interface ComboboxOptionHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: ComboboxOption["disabled"];
      selected?: ComboboxOption["selected"];
      value?: ComboboxOption["value"];
    }

    interface HTMLElementTags {
      "select-enhancer": SelectEnhancerHTMLAttributes<SelectEnhancer>;
      "combobox-field": ComboboxFieldHTMLAttributes<ComboboxField>;
      "combobox-listbox": HTMLAttributes<ComboboxListbox>;
      "combobox-option": ComboboxOptionHTMLAttributes<ComboboxOption>;
    }
  }
}
