/** @jsxImportSource react */
import { StrictMode, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { useForm } from "react-hook-form";
import { ComboboxField, ComboboxListbox, ComboboxOption, SelectEnhancer } from "../../src/Combobox/index.js";

function ReactHookFormTest() {
  const { register, formState, ...form } = useForm({ mode: "onBlur", progressive: true, reValidateMode: "onChange" });
  const createRequiredMessage = useCallback((fieldName: string) => `${fieldName} is required.`, []);
  const handleSubmit = form.handleSubmit((data) => alert(JSON.stringify(data, null, 2)));
  const { errors } = formState;

  /**
   * Dispatches a `change` event whenever an `input` event occurs.
   *
   * This is necessary because React Hook Form currently lacks `onChange` support for Custom Elements
   * that dispatch their own `input` events. A different form library might be better suited for such
   * cases (e.g., the `React Form Validity Observer`).
   */
  function handleInput(event: React.FormEvent<ComboboxField>): void {
    event.target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <form noValidate onSubmit={handleSubmit}>
      <h1>Example Form</h1>

      {/* NOTE: React Hook Form cannot validate the `email` attribute */}
      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          {...register("email", { required: "You MUST allow us to stalk you." })}
          type="email"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
        />

        <div id="email-error" role="alert">
          {errors.email?.message as string}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          {...register("password", {
            required: createRequiredMessage("Password"),
            pattern: {
              value: /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}/,
              // NOTE: React Hook Form does not support more-detailed error messaging in TypeScript
              message: "Please provide a more secure password",
            },
            maxLength: 99,
          })}
          type="password"
          aria-invalid={!!errors.password}
          aria-describedby="password-error"
        />

        <div id="password-error" role="alert">
          {errors.password?.message as string}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          {...register("confirm-password", {
            required: createRequiredMessage("Confirm Password"),
            validate: (value, formValues) => (value === formValues.password ? true : "Passwords do not match."),
          })}
          type="password"
          aria-invalid={!!errors["confirm-password"]}
          aria-describedby="confirm-password-error"
        />

        <div id="confirm-password-error" role="alert">
          {errors["confirm-password"]?.message as string}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="types">Preferred Type System</label>
        <select-enhancer>
          <combobox-field
            id="types"
            {...register("types", { required: createRequiredMessage("Preferred Type System") })}
            aria-invalid={`${!!errors.types?.message}`}
            aria-describedby="types-error"
            onInput={handleInput}
          />

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
          {errors.types?.message as string}
        </div>
      </div>

      {/* NOTE: React Hook Form does not support the `Select Enhancing Mode` used in SSR due to design its limitations */}
      <div className="form-field">
        <label htmlFor="sport">Best Sport</label>
        <select-enhancer>
          <combobox-field
            id="sport"
            {...register("sport", { required: createRequiredMessage("Best Sport") })}
            filter
            valueis="unclearable"
            aria-invalid={`${!!errors.sport}`}
            aria-describedby="sport-error"
            onInput={handleInput}
          />

          <combobox-listbox>
            <combobox-option value="" defaultSelected>
              Nothing
            </combobox-option>
            <combobox-option value="football">Football</combobox-option>
            <combobox-option value="basketball">Basketball</combobox-option>
            <combobox-option value="softball">Softball</combobox-option>
            <combobox-option value="hockey">Hockey</combobox-option>
            <combobox-option value="baseball">Baseball</combobox-option>
            <combobox-option value="skating">Figure Skating</combobox-option>
            <combobox-option value="swimming">Swimming</combobox-option>
            <combobox-option value="horses">Horse Racing</combobox-option>
            <combobox-option value="socker">Socker</combobox-option>
          </combobox-listbox>
        </select-enhancer>

        <div id="sport-error" role="alert">
          {errors.sport?.message as string}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="fruit">Most Eaten Fruit</label>
        <select-enhancer>
          <combobox-field
            id="fruit"
            {...register("fruit", { required: createRequiredMessage("Most Eaten Fruit") })}
            filter
            aria-invalid={`${!!errors.fruit}`}
            aria-describedby="fruit-error"
            onInput={handleInput}
          />

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
          {errors.fruit?.message as string}
        </div>
      </div>

      <div className="form-field">
        <label htmlFor="job">Dream Job</label>
        <select-enhancer>
          <combobox-field
            id="job"
            {...register("job", {
              required: createRequiredMessage("Dream Job"),
              validate: (value) => (/(punching|tournaments)/i.test(value) ? "Don't choose this job." : true),
            })}
            filter
            valueis="anyvalue"
            aria-invalid={`${!!errors.job}`}
            aria-describedby="job-error"
            onInput={handleInput}
          />

          <combobox-listbox>
            <combobox-option value="">Sleeping</combobox-option>
            <combobox-option value="oss">Open Source Maintainer</combobox-option>
            <combobox-option value="coding">Software Engineer</combobox-option>
            <combobox-option value="ceo">CEO</combobox-option>
            <combobox-option value="meche">Mechanical Engineer</combobox-option>
            <combobox-option value="food">Chef</combobox-option>
            <combobox-option value="tournaments">Gaming</combobox-option>
          </combobox-listbox>
        </select-enhancer>

        <div id="job-error" role="alert">
          {errors.job?.message as string}
        </div>
      </div>

      <fieldset
        className="form-field"
        role="radiogroup"
        aria-invalid={!!errors.framework}
        aria-describedby="framework-error"
      >
        <legend>Favorite Framework</legend>

        <div>
          <input
            id="svelte"
            {...register("framework", { required: createRequiredMessage("Favorite Framework") })}
            type="radio"
            value="svelte"
          />
          <label htmlFor="svelte">Svelte</label>

          <input
            id="vue"
            {...register("framework", { required: createRequiredMessage("Favorite Framework") })}
            type="radio"
            value="vue"
          />
          <label htmlFor="vue">Vue</label>

          <input
            id="solid"
            {...register("framework", { required: createRequiredMessage("Favorite Framework") })}
            type="radio"
            value="solid"
          />
          <label htmlFor="solid">Solid</label>

          <input
            id="react"
            {...register("framework", { required: createRequiredMessage("Favorite Framework") })}
            type="radio"
            value="react"
          />
          <label htmlFor="react">React</label>
        </div>

        <div id="framework-error" role="alert">
          {errors.framework?.message as string}
        </div>
      </fieldset>

      <div className="form-field">
        <label htmlFor="bio">Autobiography</label>
        <textarea
          id="bio"
          {...(register("bio"), { minLength: 80, maxLength: 150 })}
          aria-invalid={!!errors.bio}
          aria-describedby="bio-error"
        />

        <div id="bio-error" role="alert">
          {errors.bio?.message as string}
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
    <ReactHookFormTest />
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
