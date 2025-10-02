<script lang="ts">
  import { createFormValidityObserver } from "@form-observer/svelte";
  import type { ValidatableField } from "@form-observer/svelte";
  import type { ComboboxField } from "../../../src/Combobox";

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
    }
  });

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const form =  (event.currentTarget) as HTMLFormElement;
    const success = await validateFields({ focus: true });
    if (success) alert(JSON.stringify(Object.fromEntries(new FormData(form)), null, 2));
  }
</script>

<form use:autoObserve on:submit={handleSubmit}>
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
          const password =  input.form?.elements.namedItem("password") as HTMLInputElement;
          if (input.value !== password.value) return Promise.resolve("Passwords do not match.");
        },
      })}
    />
    <div id="confirm-password-error" role="alert"></div>
  </div>

  <div class="form-field">
    <label for="types">Preferred Type System</label>
    <select-enhancer>
      <combobox-field id="types" name="types" required aria-describedby="types-error"></combobox-field>
      <combobox-listbox>
        <combobox-option value="" defaultSelected>Choose One</combobox-option>
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
        <option value="" selected>Nothing</option>
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
      <combobox-field id="fruit" name="fruit" filter required aria-describedby="fruit-error"></combobox-field>
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
