/** @jsxImportSource react */
import { StrictMode, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { createFormValidityObserver } from "@form-observer/react";
import type { ValidatableField } from "@form-observer/react";
import { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../../../src/Combobox/index.js";

function FormValidityObserverReactTest() {
  type ErrorMessage = React.ReactElement | string | null;
  const [errors, setErrors] = useState<Record<string, ErrorMessage>>({});

  const { autoObserve, configure, validateFields } = useMemo(() => {
    return createFormValidityObserver("focusout", {
      revalidateOn: "input",
      renderByDefault: true,
      renderer(errorContainer, errorMessage: (typeof errors)[string]) {
        setErrors((e) => ({ ...e, [errorContainer.id.replace(/-error$/, "")]: errorMessage }));
      },
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
  }, []);

  // Submission Handler
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const success = await validateFields({ focus: true });
    if (success) alert(JSON.stringify(Object.fromEntries(new FormData(form)), null, 2));
  }

  return (
    // Note: If your component does not re-render, you don't need to memoize `autoObserve`'s return value. (See Docs)
    <form ref={useMemo(autoObserve, [autoObserve])} onSubmit={handleSubmit}>
      <h1>Example Form</h1>

      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          aria-describedby="email-error"
          {...configure("email", { required: "You MUST allow us to stalk you." })}
        />

        <div id="email-error" role="alert">
          {errors.email}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          maxLength={99}
          required
          aria-describedby="password-error"
          {...configure("password", {
            pattern: {
              value: "(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}",
              message({ value }: HTMLInputElement) {
                return (
                  <div style={{ color: "var(--color)" }}>
                    <div>Password Requirements</div>
                    <ul>
                      <li data-password-requirement-valid={/[a-z]/.test(value)}>One lowercase letter.</li>
                      <li data-password-requirement-valid={/[A-Z]/.test(value)}>One uppercase letter.</li>
                      <li data-password-requirement-valid={/\d/.test(value)}>One number.</li>
                      <li data-password-requirement-valid={/[@$!%*?&]/.test(value)}>One special character.</li>
                      <li data-password-requirement-valid={value.length >= 8}>8 characters minimum.</li>
                    </ul>
                  </div>
                );
              },
            },
          })}
        />

        <div id="password-error" role="alert">
          {errors.password}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="confirm-password">Confirm Password</label>
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

        <div id="confirm-password-error" role="alert">
          {errors["confirm-password"]}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="types">Preferred Type System</label>
        <select-enhancer>
          <combobox-field id="types" name="types" required aria-describedby="types-error" />
          <combobox-listbox>
            <combobox-option value="" defaultSelected>
              Choose One
            </combobox-option>
            <combobox-option value="jsdocs">JSDocs</combobox-option>
            <combobox-option value="ts">TypeScript</combobox-option>
            <combobox-option value="anarchy">I Hate Types</combobox-option>
            <combobox-option value="kotowaru">I Hate JavaScript</combobox-option>
          </combobox-listbox>
        </select-enhancer>

        <div id="types-error" role="alert">
          {errors.types}
        </div>
      </div>

      {/* The Form Validity Observer supports Select Enhancing Mode, but this mode is only useful for SSR */}
      <div className="form-field">
        <label htmlFor="sport">Best Sport</label>
        <select-enhancer>
          <select
            id="sport"
            name="sport"
            filter=""
            valueis="unclearable"
            defaultValue=""
            required
            aria-describedby="sport-error"
          >
            <option value="">Nothing</option>
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

        <div id="sport-error" role="alert">
          {errors.sport}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="fruit">Most Eaten Fruit</label>
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

        <div id="fruit-error" role="alert">
          {errors.fruit}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="job">Dream Job</label>
        <select-enhancer>
          <select
            id="job"
            filter=""
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

        <div id="job-error" role="alert">
          {errors.job}
        </div>
      </div>

      <fieldset className="form-field" role="radiogroup" aria-describedby="framework-error">
        <legend>Favorite Framework</legend>

        <div>
          <input id="svelte" name="framework" type="radio" value="svelte" required />
          <label htmlFor="svelte">Svelte</label>

          <input id="vue" name="framework" type="radio" value="vue" />
          <label htmlFor="vue">Vue</label>

          <input id="solid" name="framework" type="radio" value="solid" />
          <label htmlFor="solid">Solid</label>

          <input id="react" name="framework" type="radio" value="react" />
          <label htmlFor="react">React</label>
        </div>

        <div id="framework-error" role="alert">
          {errors.framework}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="bio">Autobiography</label>
        <textarea id="bio" name="bio" minLength={80} maxLength={150} aria-describedby="bio-error"></textarea>
        <div id="bio-error" role="alert">
          {errors.bio}
        </div>
      </div>

      <button type="submit">Sign Up</button>
    </form>
  );
}

if (!customElements.get("combobox-listbox")) customElements.define("combobox-listbox", ComboboxListbox);
if (!customElements.get("combobox-field")) customElements.define("combobox-field", ComboboxField);
if (!customElements.get("combobox-option")) customElements.define("combobox-option", ComboboxOption);
if (!customElements.get("select-enhancer")) customElements.define("select-enhancer", SelectEnhancer);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FormValidityObserverReactTest />
  </StrictMode>,
);

declare module "react" {
  interface SelectEnhancerHTMLAttributes<T> extends HTMLAttributes<T> {
    comboboxtag?: SelectEnhancer["comboboxTag"];
    listboxtag?: SelectEnhancer["listboxTag"];
    optiontag?: SelectEnhancer["optionTag"];
  }

  interface ComboboxFieldHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: ComboboxField["disabled"];
    filter?: ComboboxField["filter"] | "";
    filtermethod?: ComboboxField["filterMethod"];
    form?: string; // NOTE: React does not support the `form` attribute currently for Custom Elements
    name?: ComboboxField["name"];
    nomatchesmessage?: ComboboxField["noMatchesMessage"];
    required?: ComboboxField["required"];
    valueis?: ComboboxField["valueIs"];
    valuemissingerror?: ComboboxField["valueMissingError"];
  }

  interface SelectHTMLAttributes<T> extends ComboboxFieldHTMLAttributes<T> {
    filter?: "";
  }

  interface ComboboxOptionHTMLAttributes<T> extends HTMLAttributes<T> {
    defaultSelected?: ComboboxOption["defaultSelected"];
    disabled?: ComboboxOption["disabled"];
    selected?: ComboboxOption["selected"];
    value?: ComboboxOption["value"];
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace -- Necessary for type declaration merging
  namespace JSX {
    interface IntrinsicElements {
      "select-enhancer": React.DetailedHTMLProps<React.SelectEnhancerHTMLAttributes<SelectEnhancer>, SelectEnhancer>;
      "combobox-field": React.DetailedHTMLProps<React.ComboboxFieldHTMLAttributes<ComboboxField>, ComboboxField>;
      "combobox-listbox": React.DetailedHTMLProps<React.HTMLAttributes<ComboboxListbox>, ComboboxListbox>;
      "combobox-option": React.DetailedHTMLProps<React.ComboboxOptionHTMLAttributes<ComboboxOption>, ComboboxOption>;
    }
  }
}

/*
 * NOTE: React handles native attributes inconsistently between Custom Elements and native `HTMLElement`s.
 * For example, applying `form` to a native form control will alter the corresponding attribute. However,
 * applying `form` to a Custom Form Control that exposes a `form` getter will cause React to throw a runtime
 * error. The React team will need to figure out the best way to address this problem. See:
 * https://github.com/facebook/react/issues/34663.
 */
