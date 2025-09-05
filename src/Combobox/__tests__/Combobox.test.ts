/* eslint-disable no-inner-declarations */
/* eslint-disable no-void */
/* eslint-disable prefer-template */
/* eslint-disable func-names */
import { test as it, expect as baseExpect } from "@playwright/test";
import type { Page, Locator, MatcherReturnType } from "@playwright/test";
import type SelectEnhancer from "../SelectEnhancer.js";
import type ComboboxField from "../ComboboxField.js";
import type ComboboxOption from "../ComboboxOption.js";

/*
 * NOTE: It seems that the accessibility requirements for the `Combobox` Web Component are now taken care of.
 * Now we need to focus on testing the API (of _all_ the Combobox Parts).
 */

/** The attributes _commonly_ used for **testing** the `Combobox` Web Component. (Declared to help avoid typos.) */
const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  "data-active": "data-active",
});

const testConfigs = Object.freeze([{ mode: "Regular" }, { mode: "Filterable" }] as const);

for (const { mode } of testConfigs) {
  it.describe(`Combobox Web Component (${mode})`, () => {
    /** Retrieves the type of the last item in an array */
    type GetLast<T> = T extends readonly [...unknown[], infer U] ? U : never;

    interface OptionInfo {
      /** The _accessible_ label of an `option`. */
      label: string;

      /** The _value_ of an accessible `option` (if it is distinct from its {@link label}) */
      value?: string;
    }

    const url = "http://localhost:5173";
    const testOptions = Object.freeze([
      "First",
      "Second",
      "Third",
      "Fourth",
      "Fifth",
      "Sixth",
      "Seventh",
      "Eigth",
      "Ninth",
      "Tenth",
    ] as const);

    /* -------------------- Helper Functions -------------------- */
    type ValueIs = ComboboxField["valueIs"];
    interface RenderComponentOptions {
      options?: ReadonlyArray<string>;
      initialValue?: string;
      valueis?: ValueIs;
    }

    async function renderComponent(page: Page, options?: RenderComponentOptions): Promise<void>;
    async function renderComponent(page: Page, initialValue?: string): Promise<void>;
    async function renderComponent(page: Page, config?: string | RenderComponentOptions): Promise<void> {
      const initialValue = typeof config === "object" ? config.initialValue : config;
      const options = typeof config === "object" ? (config.options ?? testOptions) : testOptions;
      const valueis = (typeof config === "object" ? config.valueis : undefined) ?? "unclearable";

      await page.goto(url);
      return renderHTMLToPage(page)`
        <select-enhancer>
          <select id="component" name="my-name" ${getFilterAttrs(valueis)}>
            ${options.map((o) => `<option${initialValue === o ? " selected" : ""}>${o}</option>`).join("")}
          </select>
        </select-enhancer>
        <div style="font-size: 3rem; font-weight: bold; text-align: right; background-color: red; height: 500vh;">
          Container for testing scroll prevention
        </div>
      `;
    }

    /**
     * Renders the provided HTML template string to the provided `page`, replacing all of the contents
     * of the `body` on that page.
     *
     * @example
     * renderHTMLToPage(page)`
     *   <div>Hello</div>
     *   <div>World</div>
     * `;
     */
    function renderHTMLToPage(page: Page) {
      return function html(strings: TemplateStringsArray, ...values: string[]): Promise<void> {
        const markup = String.raw({ raw: strings }, ...values);
        return page.evaluate((template) => void (document.body.innerHTML = template), markup);
      };
    }

    /**
     * Returns the filter-related attributes that should be placed on a `<combobox-field>` during a test.
     *
     * If the tests are run in `Regular` {@link mode} (or if `undefined` is passed), returns an empty string instead.
     */
    function getFilterAttrs<T extends ValueIs>(valueis: T | undefined) {
      if (valueis === undefined) return "";
      return mode === "Regular" ? "" : (`filter valueis="${valueis}"` as const);
    }

    function getRandomOption<T extends ReadonlyArray<string>>(options: T = testOptions as unknown as T): T[number] {
      const optionIndex = Math.floor(Math.random() * options.length);
      return options[optionIndex];
    }

    /** Returns a getter that indicates how many times a `<combobox-field>`'s `formResetCallback()` was called */
    function observeResetCount(combobox: Locator): () => Promise<number> {
      const resetCountAttribute = "data-reset-count";
      const setupPromise = combobox.evaluate((node: ComboboxField, attr) => {
        const { formResetCallback } = node;
        node.formResetCallback = function () {
          formResetCallback.call(this);
          const count = Number(this.getAttribute(attr) ?? 0);
          this.setAttribute(attr, String(count + 1));
        };
      }, resetCountAttribute);

      return async function getResetCount(): Promise<number> {
        const rawValue = await setupPromise.then(() => combobox.getAttribute(resetCountAttribute));
        return Number(rawValue ?? 0);
      };
    }

    /** The `option`s used for {@link associateComboboxWithForm} */
    interface FormAssociationOptions {
      /** The `name` for the `combobox` element */
      name?: string;
      /**
       * The `id` for the `form` element. If the `form` does not have an `id` and no `formId` is provided,
       * then a random `id` will be generated for the `form`.
       */
      formId?: string;
      /**
       * Determines how the `combobox` is associated with the `form`
       * - `explicit` (default): `combobox` is moved _outside_ the form element and given a matching `form` attribute.
       * - `implicit`: `combobox` is moved _inside_ the form element, and its `form` attribute is removed.
       */
      association?: "explicit" | "implicit";
    }

    /**
     * Associates the provided `combobox` with the (first) form element on its page for testing.
     * If no form element exists on the page when this function is called, then one will be created.
     */
    async function associateComboboxWithForm(combobox: Locator, options?: FormAssociationOptions): Promise<void> {
      return combobox.evaluate((field: ComboboxField, opts) => {
        // Options
        const association = opts?.association ?? "explicit";

        // Configure `form`
        const form = document.querySelector("form") ?? document.createElement("form");
        form.id = opts?.formId || form.id || Math.random().toString(36).slice(2);
        if (!form.hasAttribute("aria-label")) form.setAttribute("aria-label", "Test Form");

        // Configure `combobox`
        if (opts?.name) field.setAttribute("name", opts.name);
        if (association === "explicit") field.setAttribute("form", form.id);
        else field.removeAttribute("form");

        // Arrange Elements
        if (!document.body.contains(form)) document.body.insertAdjacentElement("afterbegin", form);

        const container = field.closest("select-enhancer") as SelectEnhancer;
        form.insertAdjacentElement(association === "explicit" ? "beforebegin" : "afterbegin", container);
      }, options);
    }

    /**
     * Gets the location of a {@link Range} `offset` within an `element`'s {@link Text} Node.
     *
     * @throws {TypeError} if
     * - `element` has more (or less) than 1 child Node
     * - `element`'s only child is not a `Text` Node
     * - `textOffset` is larger than the `element`'s text content
     *
     * @example
     * const combobox = page.getByRole("combobox");
     * const before1stLetter = getLocationOf(combobox, 0);
     * const after3rdLetter = getLocationOf(combobox, 3);
     */
    function getLocationOf(element: Locator, textOffset: number): Promise<DOMRect> {
      return element.evaluate((node, offset) => {
        // Assert Proper Conditions
        if (node.childNodes.length !== 1 || node.firstChild?.nodeType !== Node.TEXT_NODE) {
          throw new TypeError(`Expected element with a single Text Node (type ${Node.TEXT_NODE})`);
        }

        const text = node.firstChild as Text;
        if (text.length < offset) {
          throw new TypeError(`Element's text content is shorter than the provided offset (${offset})`);
        }

        // Get location of text offset
        const range = new Range();
        range.setStart(text, offset);
        range.setEnd(range.startContainer, range.startOffset);
        return range.getBoundingClientRect();
      }, textOffset);
    }

    function createFilterTypeDescribeBlocks<
      T extends Readonly<[ValueIs, ...ValueIs[]]>,
      B extends "filter-only" | "both",
    >(types: T, behavior: B, callback: (filtertype: T[number] | (B extends "both" ? undefined : never)) => void): void {
      if (mode === "Regular" && behavior === "both") {
        return callback(undefined as B extends "both" ? undefined : never);
      }

      if (mode === "Filterable") {
        for (const filtertype of types) it.describe(`in \`${filtertype}\` mode`, () => callback(filtertype));
      }
    }

    /* -------------------- Local Assertion Utilities -------------------- */
    const expect = baseExpect.extend({
      async toHaveTextSelection(
        locator: Locator,
        expected: "start" | "end" | "full" | { anchor: number; focus: number },
        options?: { timeout?: number },
      ) {
        const name = "toHaveTextSelection";
        const timeout = options?.timeout ?? this.timeout;

        try {
          await baseExpect(locator).toBeVisible({ timeout });
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };

          return {
            name,
            pass: this.isNot,
            log: matcherResult.log,
            timeout,
            expected,
            actual: matcherResult.actual,
            message: () =>
              this.utils.printReceived(`Timed out ${matcherResult.timeout}ms waiting for `).replaceAll('"', "") +
              this.utils.matcherHint(name, "locator", "expected", { isNot: this.isNot, promise: this.promise }) +
              "\n\n" +
              `Locator: ${locator}\n` +
              `Expected: Selection ${this.utils.printExpected(expected)}\n` +
              `Received: ${matcherResult.actual}\n` +
              `Call log:\n${matcherResult.log?.join("\n")}`,
          };
        }

        const nodes = await locator.evaluate((node) => node.childNodes.length, { timeout });
        const nodeType = await locator.evaluate((node) => node.firstChild?.nodeType, { timeout });
        const textNodeType = 3 satisfies typeof Node.TEXT_NODE;
        if (nodes !== 1 || nodeType !== textNodeType) {
          return {
            name,
            pass: this.isNot,
            expected: `1 Child Node with Type ${textNodeType}`,
            actual: nodes !== 1 ? `${nodes} Child Nodes` : `1 Child Node with Type ${nodeType}`,
            message: () =>
              this.utils.matcherHint(name, "locator", "expected", { isNot: this.isNot, promise: this.promise }) +
              "\n\n" +
              `Locator: ${locator}\n` +
              `Expected: Element with a single Text Node (type ${textNodeType})\n` +
              `Received: Element with ${nodes !== 1 ? `${nodes} Nodes` : `Node of type ${nodeType}`}`,
          };
        }

        const selectionInfo = await locator.evaluate(
          (node, e) => {
            const text = node.firstChild as Text;
            const selection = document.getSelection() as Selection;
            const hasSelection = selection.anchorNode === text && selection.focusNode === text;

            let pass: boolean;
            if (!hasSelection) pass = false;
            else if (e === "start") pass = selection.anchorOffset === 0 && selection.isCollapsed;
            else if (e === "end") pass = selection.anchorOffset === text.length && selection.isCollapsed;
            else if (e === "full") pass = selection.anchorOffset === 0 && selection.focusOffset === text.length;
            else pass = selection.anchorOffset === e.anchor && selection.focusOffset === e.focus;

            return { pass, hasSelection, anchor: selection.anchorOffset, focus: selection.focusOffset };
          },
          expected,
          { timeout },
        );

        const { pass, hasSelection, anchor, focus } = selectionInfo;
        const not = this.isNot ? " not" : "";

        let expectedString: string;
        if (!hasSelection) expectedString = `Expected: Element${not} containing Document's \`Selection\`\n`;
        else if (expected === "start") expectedString = `Expected: Selection${not} collapsed to start of element\n`;
        else if (expected === "end") expectedString = `Expected: Selection${not} collapsed to end of element\n`;
        else if (expected === "full") expectedString = `Expected: Selection${not} of element's entire text content\n`;
        else expectedString = `Expected: Selection${not} ${this.utils.printExpected({ ...expected })}\n`;

        const message = () =>
          this.utils.matcherHint(name, "locator", "expected", { isNot: this.isNot, promise: this.promise }) +
          "\n\n" +
          `Locator: ${locator}\n` +
          expectedString +
          (hasSelection ? `Received: Selection ${this.utils.printReceived({ anchor, focus })}` : "");

        return { name, pass, message, expected, actual: { anchor, focus } };
      },
      /** Asserts that the provided `combobox` is accessibly expanded */
      async toBeExpanded(
        combobox: Locator,
        options?: {
          timeout?: number;
          /**
           * The specific `option`s that should be visible when the `combobox` is expanded.
           * Use `all` if every `option` in the `combobox`'s `listbox` should be visible (Default).
           */
          options?: "all" | readonly (string | Pick<OptionInfo, "label">)[];
        },
      ) {
        const name = "toBeExpanded";
        const timeout = options?.timeout ?? this.timeout;

        try {
          // `combobox` state
          await baseExpect(combobox).toHaveRole("combobox", { timeout });
          await baseExpect(combobox).toHaveAttribute(attrs["aria-expanded"], String(!this.isNot), { timeout });

          // `listbox` display
          const listboxId = (await combobox.getAttribute("aria-controls", { timeout })) ?? "";
          const listbox = combobox
            .page()
            .getByRole("listbox")
            .and(combobox.page().locator(`[id="${listboxId}"]`));

          await baseExpect(listbox).toBeVisible({ visible: !this.isNot, timeout });

          // `option`s display
          const visibleOptions = listbox.getByRole("option");

          if (this.isNot) await baseExpect(visibleOptions).toHaveCount(0, { timeout });
          else if (!options?.options || options.options === "all") {
            const visibleOptionsCount = await visibleOptions.count();
            await baseExpect(listbox.getByRole("option", { includeHidden: true })).toHaveCount(visibleOptionsCount, {
              timeout,
            });
          } else {
            await Promise.all(
              options.options.map((o) => {
                const label = typeof o === "string" ? o : o.label;
                return baseExpect(listbox.getByRole("option", { name: label, exact: true })).toBeVisible({ timeout });
              }),
            );
          }

          // Error Messaging is handled by `catch` block, so an empty string is fine here.
          return { name, pass: !this.isNot, message: () => "" };
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }
      },
      /**
       * Asserts that the `combobox`'s currently-active `option` is the one having the `expected` label
       * @param combobox
       * @param expected The `label` of the target `option`
       * @param options
       */
      async toHaveActiveOption(combobox: Locator, expected: string, options?: { timeout?: number }) {
        const name = "toHaveActiveOption";
        const timeout = options?.timeout ?? this.timeout;

        try {
          await baseExpect(combobox).toHaveRole("combobox", { timeout });
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }

        const listboxId = (await combobox.getAttribute("aria-controls", { timeout })) ?? "";
        const listbox = combobox
          .page()
          .getByRole("listbox")
          .and(combobox.page().locator(`[id="${listboxId}"]`));
        const option = listbox.getByRole("option", { name: expected, exact: true });

        try {
          // Active `option` is clear to VISUAL USERS (HTML + CSS)
          if (this.isNot) await baseExpect(option).not.toHaveAttribute(attrs["data-active"]);
          else await baseExpect(option).toHaveAttribute(attrs["data-active"], String(true));

          // Active `option` is ACCESSIBLE
          const optionId = (await option.getAttribute("id")) as string;
          const comboboxExpectation = this.isNot ? baseExpect(combobox).not : baseExpect(combobox);
          await comboboxExpectation.toHaveAttribute(attrs["aria-activedescendant"], optionId);

          // Error Messaging is handled by `catch` block, so an empty string is fine here.
          return { name, pass: !this.isNot, message: () => "" };
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }
      },
      /** Asserts that the `combobox`'s currently-selected `option` is the one having the specified `label` (and `value`) */
      async toHaveSelectedOption(combobox: Locator, expected: OptionInfo, options?: { timeout?: number }) {
        const name = "toHaveSelectedOption";
        const timeout = options?.timeout ?? this.timeout;

        try {
          await baseExpect(combobox).toHaveRole("combobox", { timeout });
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }

        // Verify that the `option` has the correct attributes/properties WITHOUT disrupting other tests.
        // This approach allows us to verify the accessible state of `option`s without requiring an expanded `combobox`.
        const listboxId = (await combobox.getAttribute("aria-controls", { timeout })) ?? "";
        const listbox = combobox
          .page()
          .getByRole("listbox", { includeHidden: true })
          .and(combobox.page().locator(`[id="${listboxId}"]`));

        const option = listbox.getByRole("option", { name: expected.label, exact: true, includeHidden: true });

        try {
          await baseExpect(option).toHaveJSProperty("value", expected.value ?? expected.label, { timeout });
          await baseExpect(option).toHaveAttribute(attrs["aria-selected"], String(!this.isNot), { timeout });
          await baseExpect(option).toHaveJSProperty("selected", !this.isNot, { timeout });

          // Error Messaging is handled by `catch` block, so an empty string is fine here.
          return { name, pass: !this.isNot, message: () => "" };
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }
      },
      async toHaveComboboxValue(
        combobox: Locator,
        expected: ComboboxField["value"],
        options?: {
          timeout?: number;
          /**
           * When `true`, additionally asserts that the `combobox` has an owning `<form>` element whose
           * `FormData` includes the `combobox`'s value. Requires the `combobox` to have a valid `name`.
           */
          form?: boolean;
        },
      ) {
        const name = "toHaveComboboxValue";
        const timeout = options?.timeout ?? this.timeout;

        try {
          await baseExpect(combobox).toHaveRole("combobox", { timeout });
          const valueExpectation = this.isNot ? baseExpect(combobox).not : baseExpect(combobox);
          await valueExpectation.toHaveJSProperty("value", expected, { timeout });
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }

        const formInfo = !options?.form
          ? null
          : await combobox.evaluate(
              (node: ComboboxField) => {
                if (!node.form) return { hasForm: false, formValue: null };
                return { hasForm: true, formValue: new FormData(node.form).get(node.name) };
              },
              undefined,
              { timeout },
            );

        if (options?.form) {
          if (!formInfo?.hasForm) {
            return {
              name,
              pass: this.isNot,
              message: () =>
                this.utils.matcherHint(name, "locator", "expected", { isNot: this.isNot, promise: this.promise }) +
                "\n\n" +
                `Locator: ${combobox}\n` +
                `Expected: ${combobox} to have an owning <form> element\n`,
            };
          }

          try {
            const formValueExpectation = this.isNot
              ? baseExpect(formInfo.formValue).not
              : baseExpect(formInfo.formValue);
            formValueExpectation.toBe(expected);
          } catch (error) {
            const { matcherResult } = error as { matcherResult: MatcherReturnType };
            const not = this.isNot ? " not" : "";

            return {
              ...matcherResult,
              name,
              pass: this.isNot,
              message: () =>
                this.utils.matcherHint(name, "locator", "expected", { isNot: this.isNot, promise: this.promise }) +
                "\n\n" +
                `Locator: ${combobox}\n` +
                `Expected: ${combobox}${not} to have associated form value ${this.utils.printExpected(expected)}\n` +
                `Received: ${this.utils.printReceived(matcherResult.actual)}`,
            };
          }
        }

        // Error Messaging is handled by all of the earlier logic, so an empty string is fine here.
        return { name, pass: !this.isNot, message: () => "" };
      },
      /** Performs both the `toHaveComboboxValue()` and the `toHaveSelectedOption()` assertions. */
      async toHaveSyncedComboboxValue(
        combobox: Locator,
        expected: OptionInfo,
        options?: {
          timeout?: number;
          /** The `form` option passed to `toHaveComboboxValue()` */
          form?: boolean;
          /** When `true`, additionally asserts that the `combobox`'s text content matches the selected `option`'s `label` */
          matchingLabel?: boolean;
        },
      ) {
        const name = "toHaveSynchronizedComboboxValue";
        const timeout = options?.timeout ?? this.timeout;

        try {
          const expectation = this.isNot ? expect(combobox).not : expect(combobox);
          if (options?.matchingLabel) await expectation.toHaveText(expected.label, { timeout });
          await expectation.toHaveComboboxValue(expected.value ?? expected.label, options);
          await expectation.toHaveSelectedOption(expected, options);

          // Error Messaging is handled by `catch` block, so an empty string is fine here.
          return { name, pass: !this.isNot, message: () => "" };
        } catch (error) {
          const { matcherResult } = error as { matcherResult: MatcherReturnType };
          return { ...matcherResult, name, pass: this.isNot };
        }
      },
    });

    // TODO: Should we provide the ability to pass in options besides `testOptions`?
    /** Asserts that the `combobox` is closed, and that none of the `option`s in the `listbox` are visible. */
    async function expectComboboxToBeClosed(page: Page): Promise<void> {
      await expect(page.getByRole("combobox")).toHaveAttribute(attrs["aria-expanded"], String(false));
      await expect(page.getByRole("listbox")).not.toBeVisible();
      await expect(page.getByRole("option")).toHaveCount(0);
      await Promise.all(testOptions.map((o) => expect(page.getByRole("option", { name: o })).not.toBeVisible()));
    }

    // TODO: Should we provide the ability to pass in options besides `testOptions`?
    /** Asserts that the `combobox` is open, and that all of the `option`s inside the `listbox` are accessible. */
    async function expectOptionsToBeVisible(page: Page): Promise<void> {
      await expect(page.getByRole("combobox")).toHaveAttribute(attrs["aria-expanded"], String(true));
      await expect(page.getByRole("listbox")).toBeVisible();
      await Promise.all(testOptions.map((o) => expect(page.getByRole("option", { name: o })).toBeVisible()));
    }

    /** Asserts that the current active `option` is (or is not) the one having the specified `label` */
    async function expectOptionToBeActive(page: Page, { label }: OptionInfo, active = true) {
      const option = page.getByRole("option", { name: label, exact: true });
      const combobox = page.getByRole("combobox");

      // Active `option` is clear to VISUAL USERS (HTML + CSS)
      if (active) await expect(option).toHaveAttribute(attrs["data-active"], String(true));
      else await expect(option).not.toHaveAttribute(attrs["data-active"]);

      // Active `option` is ACCESSIBLE
      const optionId = (await option.getAttribute("id")) as string;
      if (active) await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], optionId);
      else await expect(combobox).not.toHaveAttribute(attrs["aria-activedescendant"], optionId);
    }

    /** Asserts that the current selected `option` is (or is not) the one having the specified `label` (and `value`) */
    async function expectOptionToBeSelected(page: Page, { label, value }: OptionInfo, selected = true): Promise<void> {
      const combobox = page.getByRole("combobox");
      const optionValue = value ?? label;

      // Verify that the `combobox` has the correct `value`
      if (selected) {
        await expect(combobox).toHaveJSProperty("value", optionValue);
        await expect(combobox).toHaveText(label);
      }
      // Verify that the `combobox` DOES NOT have the indicated `value`
      else if (await combobox.evaluate((node: ComboboxField, v) => !node.acceptsValue(v), optionValue)) {
        await expect(combobox).not.toHaveJSProperty("value", optionValue);
        await expect(combobox).not.toHaveText(label);
      }

      // Verify that the `option` has the correct attributes/properties WITHOUT disrupting other tests.
      // This approach allows us to verify the accessible state of `option`s without requiring an expanded `combobox`.
      const option = page.getByRole("option", { name: label, exact: true, includeHidden: true });
      await expect(option).toHaveAttribute(attrs["aria-selected"], String(selected));
      await expect(option).toHaveJSProperty("selected", selected);
      await expect(option).toHaveJSProperty("value", optionValue);
    }

    /* -------------------- Tests -------------------- */
    if (mode === "Regular") {
      it("Selects the first option by default", async ({ page }) => {
        await renderComponent(page);
        await expectOptionToBeSelected(page, { label: testOptions[0] });
      });
    } else {
      it("Selects the first option by default in `unclearable` mode", async ({ page }) => {
        await renderComponent(page, { valueis: "unclearable" });
        await expect(page.getByRole("combobox")).toHaveAttribute("valueis", "unclearable");
        await expectOptionToBeSelected(page, { label: testOptions[0] });
      });

      for (const filtertype of ["clearable", "anyvalue"] as const satisfies ValueIs[]) {
        it(`Defaults the \`combobox\` value to an empty string in \`${filtertype}\` mode`, async ({ page }) => {
          await renderComponent(page, { valueis: filtertype });
          const combobox = page.getByRole("combobox");
          await expect(combobox).toHaveJSProperty("value", "");
          await expect(page.getByRole("option", { includeHidden: true, selected: true })).toHaveCount(0);
        });
      }
    }

    it.describe("User Interactions", () => {
      it.describe("Mouse Interactions", () => {
        it("Becomes focused when clicked", async ({ page }) => {
          await renderComponent(page);
          const combobox = page.getByRole("combobox");

          await combobox.click();
          await expect(combobox).toBeFocused();
        });

        if (mode === "Regular") {
          it("Toggles the display of `option`s when clicked", async ({ page }) => {
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            const combobox = page.getByRole("combobox");

            await combobox.click();
            await expectOptionsToBeVisible(page);

            await combobox.click();
            await expectComboboxToBeClosed(page);
          });
        } else {
          it("Displays the `option`s when clicked", async ({ page }) => {
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            const combobox = page.getByRole("combobox");

            await combobox.click();
            await expectOptionsToBeVisible(page);

            await combobox.click();
            await expectOptionsToBeVisible(page);
          });
        }

        it("Hides the list of `option`s when anything outside the owning `listbox` is clicked", async ({ page }) => {
          await renderComponent(page);
          const combobox = page.getByRole("combobox");

          // Clicking `listbox`
          await combobox.click();
          await expect(combobox).toBeExpanded({ options: "all" });

          const listbox = page.getByRole("listbox");
          const { x, y, height } = await listbox.evaluate((node) => node.getBoundingClientRect());

          await page.mouse.click(x, y + height / 2);
          await expect(combobox).toBeExpanded({ options: "all" });

          // Clicking `document.body`
          await page.locator("body").click();
          await expect(combobox).not.toBeExpanded();
        });

        it("Marks the most recently hovered option as `active`", async ({ page }) => {
          await renderComponent(page);
          const combobox = page.getByRole("combobox");

          // Initial `option` is `active` by default
          await combobox.click();
          await expectOptionsToBeVisible(page);
          await expectOptionToBeActive(page, { label: testOptions[0] });

          // Hover Different `option`
          const randomOptionValue1 = getRandomOption(testOptions.slice(1));
          await page.getByRole("option", { name: randomOptionValue1 }).hover();
          await expectOptionToBeActive(page, { label: testOptions[0] }, false);
          await expectOptionToBeActive(page, { label: randomOptionValue1 });

          // Hover Another Different `option`
          const randomOptionValue2 = getRandomOption(testOptions.filter((v, i) => i !== 0 && v !== randomOptionValue1));
          await page.getByRole("option", { name: randomOptionValue2 }).hover();
          await expectOptionToBeActive(page, { label: testOptions[0] }, false);
          await expectOptionToBeActive(page, { label: randomOptionValue1 }, false);
          await expectOptionToBeActive(page, { label: randomOptionValue2 });
        });

        it("Selects the `option` the user clicks and hides the `listbox`", async ({ page }) => {
          await renderComponent(page);

          await page.getByRole("combobox").click();
          const optionValue = getRandomOption(testOptions.slice(1));
          await page.getByRole("option", { name: optionValue }).click();

          await expectOptionToBeSelected(page, { label: optionValue });
          await expectComboboxToBeClosed(page);
        });

        if (mode === "Filterable") {
          it("Places the cursor in the right location when clicked", async ({ page }) => {
            await renderComponent(page);
            const combobox = page.getByRole("combobox");
            const cursorOffset = 2;

            // Find some coordinates that exist within the `combobox`'s text content
            const locationToPutCursor = await combobox.evaluate((node: ComboboxField, offset) => {
              const text = node.firstChild as Text;
              if (text.length <= offset) throw new Error(`Expected \`combobox\` text content longer than ${offset}`);
              if (document.getSelection()?.rangeCount) throw new Error("Expected nothing in Document to be selected");

              const range = new Range();
              range.setStart(text, offset);
              range.setEnd(range.startContainer, range.startOffset);
              return range.getBoundingClientRect();
            }, cursorOffset);

            // Click inside the `combobox` text
            await page.locator(":root").click({ position: { ...locationToPutCursor } });
            await expect(combobox).toBeFocused();
            await expectOptionsToBeVisible(page);
            await expect(combobox).toHaveTextSelection({ anchor: cursorOffset, focus: cursorOffset });
          });
        }
      });

      it.describe("Keyboard Interactions", () => {
        /** A reusable {@link Page.evaluate} callback used to obtain the `window`'s scrolling dimensions */
        const getWindowScrollDistance = () => ({ x: window.scrollX, y: window.scrollY }) as const;

        it("Is in the page `Tab` sequence", async ({ page }) => {
          await renderComponent(page);
          await page.keyboard.press("Tab");
          await expect(page.getByRole("combobox")).toBeFocused();
        });

        it("Keeps the `listbox` OUT of the `Tab` sequence", async ({ page }) => {
          /* ---------- Setup ---------- */
          await renderComponent(page);
          await expectComboboxToBeClosed(page);

          // It's not clear what triggers this behavior in Firefox/Chrome, so we have to check the attribute manually
          const combobox = page.getByRole("combobox");
          const listboxId = (await combobox.getAttribute("aria-controls")) as string;
          const listbox = page.getByRole("listbox", { includeHidden: true }).and(page.locator(`[id="${listboxId}"]`));
          await expect(listbox).toHaveAttribute("tabindex", String(-1));
        });

        if (mode === "Filterable") {
          it("Selects all of its text content when focused by keyboard navigation", async ({ page }) => {
            await renderComponent(page);
            const combobox = page.getByRole("combobox");

            await page.keyboard.press("Tab");
            await expect(combobox).toBeFocused();
            await expect(combobox).toHaveTextSelection("full");
          });
        }

        it.describe("ArrowDown", () => {
          it("Shows the `option`s (selected `option` is `active`)", async ({ page }) => {
            // Setup
            const initialValue = testOptions[Math.floor(testOptions.length / 2)];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Assertions
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowDown");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: initialValue });
          });

          it("Marks the next `option` as `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const startIndex = Math.floor(testOptions.length / 2);
            const initialValue = testOptions[startIndex];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            const activeOption = page.getByRole("option", { name: initialValue });
            const nextActiveOption = activeOption.locator(":scope + [role='option']");

            // Next `option` activates
            await page.keyboard.press("ArrowDown");
            await expect(nextActiveOption).toHaveText(testOptions[startIndex + 1]);
            await expectOptionToBeActive(page, { label: testOptions[startIndex + 1] });
            await expectOptionToBeActive(page, { label: initialValue }, false);
          });

          it("DOES NOT update the `active` `option` if the last `option` is `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            // Activate Last `option`
            for (let i = 0; i < testOptions.length - 1; i++) await page.keyboard.press("ArrowDown");
            await expect(page.getByRole("option").last()).toHaveText(testOptions.at(-1) as string);
            await expectOptionToBeActive(page, { label: testOptions.at(-1) as string });
            await expectOptionToBeActive(page, { label: initialValue }, false);

            // Nothing changes when `ArrowDown` is pressed again
            await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: testOptions.at(-1) as string });
          });

          it("Shows the `option`s when pressed with the `Alt` key (selected `option` is `active`)", async ({
            page,
          }) => {
            // Setup
            const initialValue = testOptions[Math.floor(testOptions.length / 2)];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Assertions
            await page.keyboard.press("Tab");
            await page.keyboard.press("Alt+ArrowDown");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: initialValue });
          });

          it("DOES NOT update the `active` `option` when pressed with the `Alt` key", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[Math.floor(testOptions.length / 2)];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("Alt+ArrowDown");
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            // Initial `option` is still active after keypress
            await page.keyboard.press("Alt+ArrowDown");
            await expectOptionToBeActive(page, { label: initialValue });
          });

          it("Prevents unwanted page scrolling when pressed with OR without the `Alt` key", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            const initialScrollDistance = await page.evaluate(getWindowScrollDistance);

            /* ---------- Assertions ---------- */
            // Focus `combobox`
            await page.keyboard.press("Tab");
            await expect(page.getByRole("combobox")).toBeFocused();

            // No scrolling should occur when `ArrowDown` or `Alt`+`ArrowDown` is pressed
            await page.keyboard.press("ArrowDown");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            await page.keyboard.press("Alt+ArrowDown");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            const newScrollDistance = await page.evaluate(getWindowScrollDistance);
            expect(newScrollDistance).toStrictEqual(initialScrollDistance);
          });
        });

        it.describe("End", () => {
          it("Shows the `option`s AND marks the last `option` as `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            const lastOption = testOptions.at(-1) as string;

            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: lastOption }, false);

            /* ---------- Assertions ---------- */
            // Press `End` when the `combobox` is collapsed
            await page.keyboard.press("Tab");
            await page.keyboard.press("End");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: lastOption });
            await expectOptionToBeActive(page, { label: initialValue }, false);

            // Press `End` while the `combobox` is already expanded
            for (let i = 0; i < Math.ceil(testOptions.length * 0.5); i++) await page.keyboard.press("ArrowUp");
            await expectOptionToBeActive(page, { label: lastOption }, false);

            await page.keyboard.press("End");
            await expectOptionToBeActive(page, { label: lastOption });
          });

          it("Prevents unwanted page scrolling", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            const initialScrollDistance = await page.evaluate(getWindowScrollDistance);

            /* ---------- Assertions ---------- */
            // Focus `combobox`
            await page.keyboard.press("Tab");
            await expect(page.getByRole("combobox")).toBeFocused();

            // No scrolling should occur when `End` is pressed
            await page.keyboard.press("End");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            // For sanity's sake, press `End` again while the `combobox` is already expanded
            await page.keyboard.press("End");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            const newScrollDistance = await page.evaluate(getWindowScrollDistance);
            expect(newScrollDistance).toStrictEqual(initialScrollDistance);
          });
        });

        it.describe("ArrowUp", () => {
          it("Shows the `option`s (selected `option` is `active`)", async ({ page }) => {
            // Setup
            const initialValue = testOptions[Math.floor(testOptions.length / 2)];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Assertions
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowUp");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: initialValue });
          });

          it("Marks the previous `option` as `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const startIndex = Math.floor(testOptions.length / 2);
            const initialValue = testOptions[startIndex];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowUp");
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            const activeOption = page.getByRole("option", { name: initialValue });
            const previousActiveOption = page.locator(
              `[role='option']:has(+ #${await activeOption.getAttribute("id")})`,
            );

            // Previous `option` activates
            await page.keyboard.press("ArrowUp");
            await expect(previousActiveOption).toHaveText(testOptions[startIndex - 1]);
            await expectOptionToBeActive(page, { label: testOptions[startIndex - 1] });
            await expectOptionToBeActive(page, { label: initialValue }, false);
          });

          it("DOES NOT update the `active` `option` if the first `option` is `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions.at(-1) as string;
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowUp");
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            // Activate First `option`
            for (let i = 0; i < testOptions.length - 1; i++) await page.keyboard.press("ArrowUp");
            await expect(page.getByRole("option").first()).toHaveText(testOptions[0]);
            await expectOptionToBeActive(page, { label: testOptions[0] });
            await expectOptionToBeActive(page, { label: initialValue }, false);

            // Nothing changes when `ArrowUp` is pressed again
            await page.keyboard.press("ArrowUp");
            await expectOptionToBeActive(page, { label: testOptions[0] });
          });

          it("Hides the `option`s when pressed with the `Alt` key", async ({ page }) => {
            /* ---------- Setup ---------- */
            const startIndex = Math.floor(testOptions.length / 2);
            const initialValue = testOptions[startIndex];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowUp");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            const previousOptionValue = testOptions[startIndex - 1];

            // Activate new `option`
            await page.keyboard.press("ArrowUp");
            await expectOptionToBeActive(page, { label: initialValue }, false);
            await expectOptionToBeActive(page, { label: previousOptionValue });

            // Close `combobox`. INITIAL value should still be `selected`.
            await page.keyboard.press("Alt+ArrowUp");
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: previousOptionValue }, false);
          });

          it("Prevents unwanted page scrolling when pressed with OR without the `Alt` key", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);

            // Focus `combobox`
            await page.keyboard.press("Tab");
            await expect(page.getByRole("combobox")).toBeFocused();

            // Scroll to bottom of page AFTER tabbing
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
            const initialScrollDistance = await page.evaluate(getWindowScrollDistance);

            /* ---------- Assertions ---------- */
            // No scrolling should occur when `ArrowUp` or `Alt`+`ArrowUp` is pressed
            await page.keyboard.press("ArrowUp");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            await page.keyboard.press("Alt+ArrowUp");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            const newScrollDistance = await page.evaluate(getWindowScrollDistance);
            expect(newScrollDistance).toStrictEqual(initialScrollDistance);
          });
        });

        it.describe("Home", () => {
          it("Shows the `option`s AND marks the first `option` as `active`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions.at(-1) as string;
            const firstOption = testOptions[0];

            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: firstOption }, false);

            /* ---------- Assertions ---------- */
            // Press `Home` when the `combobox` is collapsed
            await page.keyboard.press("Tab");
            await page.keyboard.press("Home");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: firstOption });
            await expectOptionToBeActive(page, { label: initialValue }, false);

            // Press `Home` while the `combobox` is already expanded
            for (let i = 0; i < Math.ceil(testOptions.length * 0.5); i++) await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: firstOption }, false);

            await page.keyboard.press("Home");
            await expectOptionToBeActive(page, { label: firstOption });
          });

          it("Prevents unwanted page scrolling", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);

            // Focus `combobox`
            await page.keyboard.press("Tab");
            await expect(page.getByRole("combobox")).toBeFocused();

            // Scroll to bottom of page AFTER tabbing
            await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
            const initialScrollDistance = await page.evaluate(getWindowScrollDistance);

            /* ---------- Assertions ---------- */
            // No scrolling should occur when `Home` is pressed
            await page.keyboard.press("Home");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            // For sanity's sake, press `Home` again while the `combobox` is already expanded
            await page.keyboard.press("Home");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            const newScrollDistance = await page.evaluate(getWindowScrollDistance);
            expect(newScrollDistance).toStrictEqual(initialScrollDistance);
          });
        });

        it.describe("Escape", () => {
          it("Hides the `option`s", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Display Options
            await page.keyboard.press("Tab");
            await page.keyboard.press("ArrowDown");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            const nextOptionValue = testOptions[1];

            // Activate new `option`
            await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: nextOptionValue });
            await expectOptionToBeActive(page, { label: initialValue }, false);

            // Close `combobox`. INITIAL value should still be `selected`.
            await page.keyboard.press("Escape");
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: nextOptionValue }, false);
          });

          it("Avoids unintended side-effects (e.g., prematurely closing `dialog`s)", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await renderHTMLToPage(page)`
              <dialog>
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              </dialog>
            `;

            /* ---------- Assertions ---------- */
            const combobox = page.getByRole("combobox");
            const dialog = page.locator("dialog");

            // Open `dialog` and `combobox`
            await dialog.evaluate((node: HTMLDialogElement) => node.showModal());
            await combobox.press("ArrowDown");
            await expectOptionsToBeVisible(page);

            // Close `combobox` without closing `dialog` (i.e., without causing any side-effects)
            const defaultPrevented = page.evaluate(() => {
              return new Promise<boolean>((resolve) => {
                document.addEventListener("keydown", (event) => resolve(event.defaultPrevented), { once: true });
              });
            });

            await combobox.press("Escape");
            await expectComboboxToBeClosed(page);
            await expect(dialog).toHaveJSProperty("open", true);
            expect(await defaultPrevented).toBe(true);

            // Properly close `dialog` now that `combobox` is closed
            const defaultNotPrevented = page.evaluate(() => {
              return new Promise<boolean>((resolve) => {
                document.addEventListener("keydown", (event) => resolve(!event.defaultPrevented), { once: true });
              });
            });

            await combobox.press("Escape");
            await expect(dialog).toHaveJSProperty("open", false);
            await expect(combobox).not.toBeVisible();
            expect(await defaultNotPrevented).toBe(true);
          });
        });

        it.describe("SpaceBar (' ')", () => {
          if (mode === "Regular") {
            it("Shows the `option`s (selected `option` is `active`)", async ({ page }) => {
              // Setup
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Assertions
              await page.keyboard.press("Tab");
              await page.keyboard.press(" ");
              await expectOptionsToBeVisible(page);
              await expectOptionToBeActive(page, { label: initialValue });
            });

            it("Selects the `active` `option` and hides the `option`s", async ({ page }) => {
              /* ---------- Setup ---------- */
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Display Options
              await page.keyboard.press("Tab");
              await page.keyboard.press(" ");
              await expectOptionsToBeVisible(page);
              await expectOptionToBeActive(page, { label: initialValue });

              /* ---------- Assertions ---------- */
              // Activate new `option`
              const newValue = testOptions[1];
              await page.keyboard.press("ArrowDown");
              await expectOptionToBeActive(page, { label: newValue });
              await expectOptionToBeActive(page, { label: initialValue }, false);

              // Select new `option`
              await page.keyboard.press(" ");
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: newValue });
              await expectOptionToBeSelected(page, { label: initialValue }, false);
            });
          }

          it("Prevents unwanted page scrolling", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            const initialScrollDistance = await page.evaluate(getWindowScrollDistance);

            /* ---------- Assertions ---------- */
            // Focus `combobox`
            await page.keyboard.press("Tab");
            await expect(page.getByRole("combobox")).toBeFocused();

            // No scrolling should occur when `SpaceBar` (' ') is pressed
            await page.keyboard.press(" ");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            // For sanity's sake, press `SpaceBar` (' ') again while the `combobox` is already expanded
            await page.keyboard.press(" ");
            await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

            const newScrollDistance = await page.evaluate(getWindowScrollDistance);
            expect(newScrollDistance).toStrictEqual(initialScrollDistance);
          });
        });

        it.describe("Tab", () => {
          it("Performs the default action (i.e., it moves focus to the next element)", async ({ page }) => {
            /* ---------- Setup ---------- */
            await renderComponent(page);
            await expectComboboxToBeClosed(page);

            // Surround `combobox` with focusable elements
            await page.locator("select-enhancer").evaluate((component: SelectEnhancer) => {
              component.insertAdjacentElement("beforebegin", document.createElement("button"));
              component.insertAdjacentElement("afterend", document.createElement("button"));
            });

            // Focus `combobox`
            const combobox = page.getByRole("combobox");
            for (let i = 0; i < 2; i++) await page.keyboard.press("Tab");
            await expect(combobox).toBeFocused();

            /* ---------- Assertions ---------- */
            // Forward Tabbing Works
            await page.keyboard.press("Tab");
            await expect(combobox).not.toBeFocused();
            await expect(page.locator("select-enhancer + *")).toBeFocused();

            // Backwards Tabbing Works
            await page.keyboard.press("Shift+Tab");
            await expect(combobox).toBeFocused();

            await page.keyboard.press("Shift+Tab");
            await expect(combobox).not.toBeFocused();
            await expect(page.locator(":has(+ select-enhancer)")).toBeFocused();
          });

          it("Hides the `option`s, and performs the default action without selecting an `option`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Surround `combobox` with focusable elements
            await page.locator("select-enhancer").evaluate((component: SelectEnhancer) => {
              component.insertAdjacentElement("beforebegin", document.createElement("button"));
              component.insertAdjacentElement("afterend", document.createElement("button"));
            });

            // Focus `combobox`
            const combobox = page.getByRole("combobox");
            for (let i = 0; i < 2; i++) await page.keyboard.press("Tab");
            await expect(combobox).toBeFocused();

            /* ---------- Assertions ---------- */
            // Forward Tabbing Works
            const activeOption = testOptions[1];
            for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: activeOption });

            await page.keyboard.press("Tab");
            await expect(combobox).not.toBeFocused();
            await expect(page.locator("select-enhancer + *")).toBeFocused();

            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: activeOption }, false);

            // Backwards Tabbing Works
            const newActiveOption = testOptions[2];
            await page.keyboard.press("Shift+Tab");
            await expect(combobox).toBeFocused();
            for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
            await expectOptionToBeActive(page, { label: newActiveOption });

            await page.keyboard.press("Shift+Tab");
            await expect(combobox).not.toBeFocused();
            await expect(page.locator(":has(+ select-enhancer)")).toBeFocused();

            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });
            await expectOptionToBeSelected(page, { label: activeOption }, false);
            await expectOptionToBeSelected(page, { label: newActiveOption }, false);
          });
        });

        it.describe("Enter", () => {
          /** The `id` of the `form` element used in each test. Used for associating fields with the `form`. */
          const formId = "test-form";

          /** The `data` attribute on the test `form` element that tracks the number of times the form was submitted. */
          const submissionCountAttr = "data-submission-count";

          async function prepareFormForSubmissionCounting(form: Locator): Promise<void> {
            await expect(form).toHaveJSProperty("tagName", "FORM");
            await expect(form).not.toHaveAttribute(submissionCountAttr);
            return form.evaluate((f, attr) => f.setAttribute(attr, String(0)), submissionCountAttr);
          }

          /**
           * Registers the provided `onsubmit` event `handler` with the (first) form element on the provided page.
           *
           * Note: If you only want to track how many times a form was submitted, use the
           * {@link defaultSubmissionHandler}.
           */
          function registerSubmissionHandler(page: Page, handler: (event: SubmitEvent) => void): Promise<void> {
            return page.evaluate(
              ([handleSubmitString, helperFunctionName]) => {
                const form = document.querySelector("form");
                if (!form) {
                  const sentence1 = "Could not find a `form` element with which to register the `onsubmit` handler.";
                  throw new Error(`${sentence1} Call \`${helperFunctionName}\` first.`);
                }

                eval(`var handleSubmit = ${handleSubmitString}`);
                // @ts-expect-error -- This variable was defined with `eval`
                form.addEventListener("submit", handleSubmit);
              },
              [handler.toString(), associateComboboxWithForm.name] as const,
            );
          }

          /**
           * The default submission handler to use with {@link registerSubmissionHandler} in tests. Tracks the
           * number of times that the form element on the page was submitted.
           */
          function defaultSubmissionHandler(event: SubmitEvent) {
            event.preventDefault();
            const form = event.currentTarget as HTMLFormElement;

            const count = Number(form.getAttribute("data-submission-count" satisfies typeof submissionCountAttr));
            form.setAttribute("data-submission-count" satisfies typeof submissionCountAttr, String(count + 1));
          }

          it("Submits the owning form if the `combobox` is collapsed", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = getRandomOption(testOptions.slice(1));
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            // Attempt submission when `combobox` is a CHILD of the form
            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, { association: "implicit", formId });
            await registerSubmissionHandler(page, defaultSubmissionHandler);

            const form = page.getByRole("form");
            await prepareFormForSubmissionCounting(form);
            await expect(form).toHaveAttribute(submissionCountAttr, String(0));

            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(form).toHaveAttribute(submissionCountAttr, String(1));

            // Attempt submission when `combobox` is ASSOCIATED with the form via the `form` ATTRIBUTE
            await associateComboboxWithForm(combobox, { association: "explicit" });

            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(form).toHaveAttribute(submissionCountAttr, String(2));

            // Verify that the `combobox` value is included in the form's data
            const formDataValue = await combobox.evaluate((node: ComboboxField) => {
              const name = "combobox-name";
              node.setAttribute("name", name);
              return new FormData(node.form as HTMLFormElement).get(name);
            });

            expect(formDataValue).toBe(initialValue);
          });

          it("DOES NOT attempt form submission if the `combobox` does not belong to a form", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = getRandomOption(testOptions.slice(1));
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            let error: Error | undefined;
            const trackEmittedError = (e: Error) => (error = e);
            page.once("pageerror", trackEmittedError);

            // Nothing should break when `Enter` is pressed without an owning form element
            await expect(page.locator("form")).not.toBeAttached();
            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await new Promise((resolve) => setTimeout(resolve, 250));

            expect(error).toBe(undefined);
            page.off("pageerror", trackEmittedError);
          });

          it("Selects the `active` `option` and hides the `option`s without submitting the form", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, { association: "implicit" });
            await registerSubmissionHandler(page, defaultSubmissionHandler);

            const form = page.getByRole("form");
            await prepareFormForSubmissionCounting(form);

            /* ---------- Assertions ---------- */
            const lastValue = testOptions.at(-1) as string;

            // Activate last `option`
            await page.keyboard.press("Tab");
            await page.keyboard.press("End");
            await expectOptionsToBeVisible(page);
            await expectOptionToBeActive(page, { label: lastValue });

            // Select `option`
            await page.keyboard.press("Enter");
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: lastValue });
            await expectOptionToBeSelected(page, { label: initialValue }, false);

            // Form was NOT submitted
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(0));
          });

          if (mode === "Filterable") {
            it("DOES NOT expand the `combobox` OR alter the filter", async ({ page }) => {
              const initialValue = getRandomOption(testOptions.slice(1));
              await renderComponent(page, initialValue);
              await expectComboboxToBeClosed(page);
              const combobox = page.getByRole("combobox");

              await page.keyboard.press("Tab");
              await expect(combobox).toBeFocused();
              const originalText = await combobox.textContent();

              // No changes to `expansion` or `textContent` should happen when pressing `Enter
              await page.keyboard.press("Enter");
              await expectComboboxToBeClosed(page);
              await expect(combobox).toHaveText(new RegExp(`^${originalText}$`));

              // Not even the `Selection` should be changed
              await expect(combobox).toHaveTextSelection("full");
            });
          }

          // See: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission
          it.describe("Support for Implicit Form Submission with Default Buttons", () => {
            it("Acknowledges `input`s of type `submit`", async ({ page }) => {
              /* ---------- Setup ---------- */
              // Mount Component
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Setup Form + Submission Handler
              function submitHandlerAssertInput(event: SubmitEvent): void {
                event.preventDefault();
                if (event.submitter instanceof HTMLInputElement && event.submitter.type === "submit") return;
                throw new Error("Expected `submitter` to be an `input` of type `submit`");
              }

              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { association: "implicit" });
              await registerSubmissionHandler(page, defaultSubmissionHandler);
              await registerSubmissionHandler(page, submitHandlerAssertInput);

              const form = page.getByRole("form");
              await prepareFormForSubmissionCounting(form);

              /* ---------- Assertions ---------- */
              // Create and Attach `input` Submitter
              await form.evaluate((f) => {
                const input = f.appendChild(document.createElement("input"));
                input.setAttribute("type", "submit");
                input.setAttribute("value", "Submit Form");
              });

              // Submit Form
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              await combobox.focus();
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(1));

              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);
            });

            // See: https://developer.mozilla.org/en-US/docs/Web/API/HTMLButtonElement#htmlbuttonelement.type
            it("Acknowledges `button`s that are explicitly AND implicitly of type `submit`", async ({ page }) => {
              /* ---------- Setup ---------- */
              // Mount Component
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Setup Form + Submission Handler
              function submitHandlerAssertButton(event: SubmitEvent): void {
                event.preventDefault();
                if (event.submitter instanceof HTMLButtonElement && event.submitter.type === "submit") return;
                throw new Error("Expected `submitter` to be a `button` of type `submit`");
              }

              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { association: "implicit" });
              await registerSubmissionHandler(page, defaultSubmissionHandler);
              await registerSubmissionHandler(page, submitHandlerAssertButton);

              const form = page.getByRole("form");
              await prepareFormForSubmissionCounting(form);

              /* ---------- Assertions ---------- */
              // Create and Attach EXPLICIT `button` Submitter that is EXPLICITLY associated with the `form`
              await form.evaluate((f) => {
                const button = document.createElement("button");
                button.setAttribute("type", "submit");
                button.setAttribute("form", f.id);
                button.textContent = "Submit Form";
                f.insertAdjacentElement("afterend", button);
              });

              // Submit Form with EXPLICIT `button` Submitter
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              await combobox.focus();
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(1));
              expect(error).toBe(undefined);

              // Submit Form with IMPLICIT `button` Submitter (INVALID `type` attribute)
              await page.evaluate(() => document.querySelector("button")?.setAttribute("type", "INVALID"));
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(2));
              expect(error).toBe(undefined);

              // Submit Form with IMPLICIT `button` Submitter (OMITTED `type` attribute)
              await page.evaluate(() => document.querySelector("button")?.removeAttribute("type"));
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(3));
              expect(error).toBe(undefined);

              page.off("pageerror", trackEmittedError);
            });

            it("Submits forms lacking a `submitter`", async ({ page }) => {
              /* ---------- Setup ---------- */
              // Mount Component
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Setup Form + Submission Handler
              function submitHandlerAssertNoSubmitter(event: SubmitEvent): void {
                event.preventDefault();
                if (event.submitter) throw new Error("Expected `form` NOT to have a `submitter`");
              }

              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { association: "explicit", formId });
              await registerSubmissionHandler(page, defaultSubmissionHandler);
              await registerSubmissionHandler(page, submitHandlerAssertNoSubmitter);

              const form = page.getByRole("form");
              await prepareFormForSubmissionCounting(form);

              /* ---------- Assertions ---------- */
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              await combobox.focus();
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(1));

              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);
            });

            it("Respects `disabled` submit buttons", async ({ page }) => {
              /* -------------------- Setup -------------------- */
              // Mount Component
              const initialValue = testOptions[0];
              await renderComponent(page);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              // Setup Form + Submission Handler
              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { association: "explicit", formId });
              await registerSubmissionHandler(page, defaultSubmissionHandler);

              const form = page.getByRole("form");
              await prepareFormForSubmissionCounting(form);

              // Create an _enabled_ `submitter` that is IMPLICITLY associated with the `form`
              await form.evaluate((f) => {
                const submitter = f.appendChild(document.createElement("button"));
                submitter.textContent = "Enabled Submitter";
              });

              /* -------------------- Assertions -------------------- */
              /* ---------- Disabled `button` Submitter ---------- */
              await form.evaluate((f) => {
                const disabledSubmitterButton = document.createElement("button");
                disabledSubmitterButton.setAttribute("disabled", "");
                disabledSubmitterButton.setAttribute("form", f.id); // EXPLICIT `form` association

                document.body.insertAdjacentElement("afterbegin", disabledSubmitterButton);
              });

              // Implicit Submission fails when the default `submitter` is disabled
              await combobox.focus();
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(0));

              // Implicit Submission works when enabled (disabled default `submitter` removed)
              await page.getByRole("button", { disabled: true }).evaluate((node) => node.remove());
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(1));

              /* ---------- Disabled `input` Submitter ---------- */
              await form.evaluate((f) => {
                const disabledSubmitterInput = document.createElement("input");
                disabledSubmitterInput.setAttribute("type", "submit");
                disabledSubmitterInput.setAttribute("disabled", "");
                disabledSubmitterInput.setAttribute("form", f.id); // EXPLICIT `form` association

                document.body.insertAdjacentElement("afterbegin", disabledSubmitterInput);
              });

              // Implicit Submission fails when the default `submitter` is disabled
              await combobox.focus();
              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(1));

              // Implicit Submission works when the default `submitter` is enabled (disabled default `submitter` moved)
              await page.getByRole("button", { disabled: true }).evaluate((disabledSubmitter: HTMLButtonElement) => {
                const formElement = disabledSubmitter.form as HTMLFormElement;
                const enabledSubmitter: HTMLButtonElement = Array.prototype.find.call(formElement.elements, (e) => {
                  return e instanceof HTMLButtonElement && e.type === "submit" && !e.disabled;
                });

                enabledSubmitter.insertAdjacentElement("afterend", disabledSubmitter);
              });

              await page.keyboard.press("Enter");
              await expect(form).toHaveAttribute(submissionCountAttr, String(2));
            });
          });
        });

        if (mode === "Regular") {
          // NOTE: In these tests, a "matching" `option` is an `option` that STARTS with the search string/character
          it.describe("Typeahead Functionality (via Printable Characters)", () => {
            /** The amount of time, in `milliseconds`, after which the `combobox` search string is reset. (See Source) */
            const timeout = 500;

            /** The fraction by which the {@link timeout} should be increased (or decreased) to avoid test flakiness. */
            const fraction = 0.3;

            it("Shows the `option`s AND marks the NEXT matching `option` as `active`", async ({ page }) => {
              /* ---------- Setup ---------- */
              // Search Character
              const searchChar = "S";
              expect(testOptions.filter((o) => o.startsWith(searchChar)).length).toBeGreaterThan(1);

              // Initial Value
              const initialValue = testOptions[0];
              await renderComponent(page, initialValue);
              await expectComboboxToBeClosed(page);
              await expectOptionToBeSelected(page, { label: initialValue });

              /* ---------- Assertions ---------- */
              // Try searching while the `combobox` is collapsed
              const nextValue = testOptions.find((o) => o.startsWith(searchChar)) as string;

              await page.keyboard.press("Tab");
              await page.keyboard.press(searchChar, { delay: timeout * (1 + fraction) });
              await expectOptionsToBeVisible(page);
              await expectOptionToBeActive(page, { label: nextValue });
              await expectOptionToBeActive(page, { label: initialValue }, false);

              // Try searching while the `combobox` is already expanded
              const latterValue = testOptions.find((o) => o.startsWith(searchChar) && o !== nextValue) as string;

              await page.keyboard.press(searchChar);
              await expectOptionToBeActive(page, { label: latterValue });
              await expectOptionToBeActive(page, { label: nextValue }, false);
              await expectOptionToBeActive(page, { label: initialValue }, false);
            });

            it("Matches `option`s case-insensitively", async ({ page }) => {
              /* ---------- Setup ---------- */
              const options = ["0-initial-value-0", "lowercase", "UPPERCASE"] as const;
              await renderComponent(page, { options });

              /* ---------- Assertions ---------- */
              // Use "Uppercase Search" for "Lowercase Option"
              const uppercaseSearch = "L";
              expect(options[1][0]).not.toBe(uppercaseSearch);

              await page.keyboard.press("Tab");
              await page.keyboard.press(uppercaseSearch, { delay: timeout * (1 + fraction) });
              await expectOptionToBeActive(page, { label: options[1] });

              // Use "Lowercase Search" for "Uppercase Option"
              const lowercaseSearch = "u";
              expect(options[2][0]).not.toBe(lowercaseSearch);

              await page.keyboard.press(lowercaseSearch);
              await expectOptionToBeActive(page, { label: options[2] });
              await expectOptionToBeActive(page, { label: options[1] }, false);
            });

            it("Matches substrings and entire words", async ({ page }) => {
              /* ---------- Setup ---------- */
              const second = testOptions[1];
              expect(testOptions.filter((o) => o.slice(0, 2) === second.slice(0, 2)).length).toBeGreaterThan(1);
              await renderComponent(page);

              /* ---------- Assertions ---------- */
              // First, `Second` matches
              await page.keyboard.press("Tab");
              await page.keyboard.press(second[0]);
              await expectOptionToBeActive(page, { label: testOptions[1] });

              // Then `Seventh` matches
              await page.keyboard.press(second[1]);
              await expectOptionToBeActive(page, { label: testOptions[6] });
              await expectOptionToBeActive(page, { label: testOptions[1] }, false);

              // As we complete the word `Second`, only `Second` matches from now on
              for (let i = 2; i < second.length; i++) {
                await page.keyboard.press(second[i]);
                await expectOptionToBeActive(page, { label: testOptions[1] });
                await expectOptionToBeActive(page, { label: testOptions[6] }, false);
              }
            });

            it(`Resets the search string when ${timeout}ms of inactivity have passed`, async ({ page }) => {
              /* ---------- Setup ---------- */
              const seventh = testOptions[6];
              await renderComponent(page);

              /* ---------- Assertions ---------- */
              // `Second` is found first
              await page.keyboard.press("Tab");
              await page.keyboard.press(seventh[0], { delay: timeout * (1 - fraction) });
              await expectOptionToBeActive(page, { label: testOptions[1] });

              // Then `Seventh`
              for (let i = 1; i < 3; i++) {
                await page.keyboard.press(seventh[i], { delay: timeout * (1 - fraction) });
                await expectOptionToBeActive(page, { label: testOptions[6] });
                await expectOptionToBeActive(page, { label: testOptions[1] }, false);
              }

              // `Seventh` is still found because we've been typing fast enough
              await page.keyboard.press(seventh[3], { delay: timeout * (1 + fraction) });
              await expectOptionToBeActive(page, { label: testOptions[6] });

              // After an extended delay, the `n` in `Seventh` actually matches `Ninth` because the search string was reset
              await page.keyboard.press(seventh[4]);
              await expectOptionToBeActive(page, { label: testOptions[8] });
              await expectOptionToBeActive(page, { label: testOptions[6] }, false);
            });

            it("Resets the search string when no match is found", async ({ page }) => {
              /* ---------- Setup ---------- */
              const firstLetter = testOptions[0][0];
              await renderComponent(page);

              /* ---------- Assertions ---------- */
              // `First` is found initially
              await page.keyboard.press("Tab");
              await page.keyboard.press(firstLetter);
              await expectOptionToBeActive(page, { label: testOptions[0] });

              // Nothing is found for `ff`, so the `active` `option` DOES NOT change
              await page.keyboard.press(firstLetter);
              await expectOptionToBeActive(page, { label: testOptions[0] });

              // Because the search string was reset, it becomes `t` instead of `fft`, resulting in a match
              await page.keyboard.press("t");
              await expectOptionToBeActive(page, { label: testOptions[2] });
              await expectOptionToBeActive(page, { label: testOptions[0] }, false);
            });
          });
        } else {
          it.describe("Filtering Functionality (via Printable Characters)", () => {
            /**
             * Copies the specified `text` to the provided `page`'s clipboard.
             *
             * (This function is more reliable than `it.use({ permissions: ["clipboard-write"] })`
             * because it works in all Playwright browsers.)
             *
             * **WARNING**: Resets any `Selection` or `:focus` states on the page to the beginning!
             */
            async function copyText(page: Page, text: string): Promise<void> {
              const label = "Text-Copying Input";
              await page.evaluate(
                ([l, t]) => {
                  const textarea = document.createElement("textarea");
                  textarea.setAttribute("aria-label", l);
                  textarea.value = t;
                  document.body.prepend(textarea);
                },
                [label, text] as const,
              );

              const copyTextInput = page.getByRole("textbox", { name: "Text-Copying Input" });
              await copyTextInput.selectText();
              await page.keyboard.press("ControlOrMeta+C");
              return copyTextInput.evaluate((node) => node.remove());
            }

            it("Shows the `option`s AND marks the FIRST matching `option` as `active`", async ({ page }) => {
              /* ---------- Setup ---------- */
              const search = testOptions[0].charAt(0);
              const initialValue = testOptions.find((o) => !o.startsWith(search)) as string;
              expect(initialValue).toBeTruthy();

              await renderComponent(page, initialValue);
              const combobox = page.getByRole("combobox");

              await page.keyboard.press("Tab");
              await expect(combobox).toBeFocused();

              /* ---------- Assertions ---------- */
              await page.keyboard.press(search);
              await expect(combobox).toHaveText(search);
              const firstVisibleOption = page.getByRole("option").first();

              await expect(combobox).toHaveAttribute(attrs["aria-expanded"], String(true));
              await expect(page.getByRole("listbox")).toBeVisible();
              await expectOptionToBeActive(page, { label: await firstVisibleOption.innerText() });
            });

            it("Displays only the `option`s which match the user's filter", async ({ page }) => {
              /* ---------- Setup ---------- */
              const search = testOptions[0].charAt(0);
              await renderComponent(page);
              const combobox = page.getByRole("combobox");

              await page.keyboard.press("Tab");
              await expect(combobox).toBeFocused();

              /* ---------- Assertions ---------- */
              // Empty the Filter
              await page.keyboard.press("Backspace");
              await expect(combobox).toHaveText("");

              const visibleOptions = page.getByRole("option");
              await expect(visibleOptions).toHaveCount(testOptions.length);

              // Apply a Filter
              await page.keyboard.press(search);
              await expect(combobox).toHaveText(search);
              expect(await visibleOptions.count()).toBeGreaterThan(0);
              expect(await visibleOptions.count()).toBeLessThan(testOptions.length);

              for (const name of testOptions) {
                const option = page.getByRole("option", { name });
                await expect(option).toBeVisible({ visible: name.startsWith(search) });
              }
            });

            it("Uses `SpaceBar` (' ') for filtering, not `option` selection", async ({ page }) => {
              /* ---------- Setup ---------- */
              const options = ["AB", "A B", "Apple", "Beans"] as const;
              const initialValue = options[2];
              await renderComponent(page, { options, initialValue });

              /* ---------- Assertions ---------- */
              // Start filtering
              await page.keyboard.press("Tab");
              await page.keyboard.press("A");
              await expectOptionToBeActive(page, { label: options[0] });

              // Now Filter with `SpaceBar` (' ').
              await page.keyboard.press(" ");

              // No new `option` should have been selected
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("value", initialValue);
              await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveText(initialValue);
              await expectOptionToBeSelected(page, { label: options[1] }, false);

              // The `option` with `SpaceBar` (' ') should be `active`
              await expect(combobox).toHaveAttribute(attrs["aria-expanded"], String(true));
              await expect(page.getByRole("listbox")).toBeVisible();
              await expect(page.getByRole("option")).toHaveCount(1);
              await expectOptionToBeActive(page, { label: options[1] });
            });

            it("Does not display the `option`s or alter the filter when the User deletes nothing", async ({ page }) => {
              /* ---------- Setup ---------- */
              const initialValue = getRandomOption(testOptions.slice(1));
              await renderComponent(page, initialValue);

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveText(initialValue);

              /* ---------- Assertions ---------- */
              // Nothing should break when the User deletes nothing
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              // Deleting nothing at the BEGINNING of the filter
              await page.keyboard.press("Tab");
              await page.keyboard.press("ArrowLeft");
              await page.keyboard.press("Backspace");
              await expect(combobox).toHaveText(initialValue);
              await expectComboboxToBeClosed(page);

              // Deleting nothing at the END of the filter
              await page.keyboard.press("ControlOrMeta+ArrowRight");
              await page.keyboard.press("Delete");
              await expect(combobox).toHaveText(initialValue);
              await expectComboboxToBeClosed(page);

              // Deleting something _will_ change the filter and expand the `combobox`, however
              await page.keyboard.press("Backspace");
              await expect(combobox).toHaveText(initialValue.slice(0, -1));
              await expectOptionToBeActive(page, { label: initialValue });
              await expect(page.getByRole("option")).toHaveAccessibleName(initialValue);

              // No errors should have occurred
              await new Promise((resolve) => setTimeout(resolve, 250));
              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);
            });

            it("Matches `option`s case-insensitively", async ({ page }) => {
              /* ---------- Setup ---------- */
              const options = ["0-initial-value-0", "lowercase", "UPPERCASE"] as const;
              await renderComponent(page, { options });

              /* ---------- Assertions ---------- */
              // Use "Uppercase Search" for "Lowercase Option"
              const uppercaseSearch = "L";
              expect(options[1].charAt(0)).not.toBe(uppercaseSearch);

              await page.keyboard.press("Tab");
              await page.keyboard.press(uppercaseSearch);
              await expectOptionToBeActive(page, { label: options[1] });
              await expect(page.getByRole("option", { name: options[2] })).not.toBeVisible();

              // Use "Lowercase Search" for "Uppercase Option"
              const lowercaseSearch = "u";
              expect(options[2].charAt(0)).not.toBe(lowercaseSearch);

              await page.keyboard.press(`Backspace+${lowercaseSearch}`);
              await expectOptionToBeActive(page, { label: options[2] });
              await expect(page.getByRole("option", { name: options[1] })).not.toBeVisible();
            });

            it("Matches substrings and entire words", async ({ page }) => {
              /* ---------- Setup ---------- */
              const seventh = testOptions[6];
              expect(testOptions.filter((o) => o.slice(0, 2) === seventh.slice(0, 2)).length).toBeGreaterThan(1);
              await renderComponent(page);

              /* ---------- Assertions ---------- */
              // First, `Second` matches because it appears first and starts with the same characters as `Seventh`
              await page.keyboard.press("Tab");
              await page.keyboard.press(seventh[0]);
              await expectOptionToBeActive(page, { label: testOptions[1] });

              // As we continue, `Second` will still match for the same reason
              await page.keyboard.press(seventh[1]);
              await expectOptionToBeActive(page, { label: testOptions[1] });
              await expectOptionToBeActive(page, { label: testOptions[6] }, false);

              // As we complete the word `Seventh`, the corresponding `option` becomes the first match in the list
              for (let i = 2; i < seventh.length; i++) {
                await page.keyboard.press(seventh[i]);
                await expectOptionToBeActive(page, { label: testOptions[6] });
              }

              // No other `option`s should match now since none of them include the string "Seventh"
              await expect(page.getByRole("combobox")).toHaveText(seventh);
              await expect(page.getByRole("option")).toHaveText(seventh);
            });

            it("Removes newlines (\\n) and carriage returns (\\r) from the filter", async ({ page }) => {
              /* ---------- Setup ---------- */
              const options = ["Apple", "A B", "Banana", "T U LIP"] as const;
              const initialValue = options[2];
              await renderComponent(page, { options, initialValue });

              /* ---------- Assertions ---------- */
              const combobox = page.getByRole("combobox");

              // Windows Newlines
              await copyText(page, "A \r\n");
              await page.keyboard.press("Tab");
              await expect(combobox).toBeFocused();

              await page.keyboard.press("ControlOrMeta+V");
              await expect(combobox).toHaveText("A ", { useInnerText: true });
              await expect(page.getByRole("option")).toHaveCount(1);
              await expectOptionToBeActive(page, { label: options[1] });

              // Regular Newlines
              await copyText(page, `T${"\n".repeat(5)} U ${"\n".repeat(7)}LIP`);
              await combobox.clear();

              await page.keyboard.press("ControlOrMeta+V");
              await expect(combobox).toHaveText(options[3], { useInnerText: true });
              await expect(page.getByRole("option")).toHaveCount(1);
              await expectOptionToBeActive(page, { label: options[3] });
            });

            // NOTE: We only test a couple `inputType`s here for simplicity. But we can test more in the future if needed.
            it("Supports all `delete*` `inputType`s", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    <option>Words of Great Variety</option>
                    <option>Much Excitement</option>
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveText("Words of Great Variety");

              /* ---------- Assertions ---------- */
              // Nothing should break during any of these interactions
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              // Delete Word Backward
              const ControlOrAlt = process.platform === "darwin" ? "Alt" : "Control";
              await page.keyboard.press("Tab+ArrowRight");
              await page.keyboard.press(`${ControlOrAlt}+Backspace`);
              await expect(combobox).toHaveText("Words of Great ");
              await expectOptionToBeActive(page, { label: "Words of Great Variety" });

              // Delete Word Forward
              await page.keyboard.press("Escape");
              await page.keyboard.press("ControlOrMeta+A");
              await page.keyboard.press("ArrowLeft");
              await page.keyboard.press(`${ControlOrAlt}+Delete`);
              await expect(combobox).toHaveText(" of Great Variety");
              await expect(page.getByRole("option")).toHaveCount(0);

              // No errors should have occurred
              await new Promise((resolve) => setTimeout(resolve, 250));
              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);
            });

            // NOTE: This guarantees that users will only see relevant/useful `option`s while filtering
            it("Hides any `option` whose value is an Empty String whenever a filter is applied", async ({ page }) => {
              /* ---------- Setup ---------- */
              const emptyStringOptionLabel = "Choose an Option";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    <option value="">${emptyStringOptionLabel}</option>
                    <option>Choose Me!</option>
                    <option>I'm the Best Option</option>
                    <option>Please!</option>
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              const combobox = page.getByRole("combobox");
              const emptyStringOption = page.getByRole("option", { name: emptyStringOptionLabel });

              // When initially EMPTYING the filter, the Empty String Option is visible/selectable
              await page.keyboard.press("Tab");
              await page.keyboard.press("Backspace");
              await expect(emptyStringOption).toBeVisible();
              await expect(emptyStringOption).toHaveJSProperty("value", "");

              // Yet even when typing out the label of the Empty String Option, it still gets filtered out
              for (let i = 0; i < emptyStringOptionLabel.length; i++) {
                await page.keyboard.press(emptyStringOptionLabel[i]);
                await expect(emptyStringOption).not.toBeVisible();
              }

              // However, the Empty String Option will reappear if the filter is cleared
              await combobox.clear();
              await expect(emptyStringOption).toBeVisible();
            });

            it.describe("Behavior with No Matching Options", () => {
              for (const filtertype of ["unclearable", "clearable"] as const satisfies ValueIs[]) {
                it(`Tells Users when no matching \`option\`s are found in \`${filtertype}\` mode`, async ({ page }) => {
                  await renderComponent(page, { valueis: filtertype });
                  const combobox = page.getByRole("combobox");
                  await combobox.fill(String(Math.random()));

                  // No `option`s should be active
                  await expect(combobox).toHaveAttribute("aria-activedescendant", "");
                  await expect(page.locator(`[${attrs["data-active"]}]`)).not.toBeVisible();

                  // Screen Reader Users need to know `listbox` is empty
                  const listbox = page.getByRole("listbox");
                  await expect(listbox).toBeVisible();
                  await expect(listbox.getByRole("option")).not.toBeVisible();

                  // Visual Users need to see that no `option`s are available.
                  const noMatchMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                  expect(noMatchMessage).toBeTruthy();
                  await expect(page.getByText(noMatchMessage)).toBeVisible();
                });
              }

              // NOTE: Since anything goes in `anyvalue` mode, the "No Matches Message" is irrelevant
              it("DOES NOT tell Users when no matches are found in `anyvalue` mode", async ({ page }) => {
                await renderComponent(page, { valueis: "anyvalue" });
                await page.keyboard.press("Tab");

                const combobox = page.getByRole("combobox");
                await combobox.fill(String(Math.random()));

                // No `option`s should be active
                await expect(combobox).toHaveAttribute("aria-activedescendant", "");
                await expect(page.locator(`[${attrs["data-active"]}]`)).not.toBeVisible();

                // Screen Reader Users still need to know `listbox` is empty
                const listbox = page.getByRole("listbox");
                await expect(listbox).toBeVisible();
                await expect(listbox.getByRole("option")).not.toBeVisible();

                // Visual Users won't see the `listbox` or the "No Matches Message" AT ALL
                await expect(listbox).toHaveCSS("clip-path", "inset(50%)");

                const noMatchMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                expect(noMatchMessage).toBeTruthy();
                await expect(page.getByText(noMatchMessage)).not.toBeVisible();
              });

              it("Does not include the `No Matches` message in filter set (Regression)", async ({ page }) => {
                /* ---------- Setup ---------- */
                await renderComponent(page);

                const first = testOptions[0];
                const fourth = testOptions[3];
                const fifth = testOptions[4];
                const f = first.charAt(0) as "F";

                const matches = testOptions.filter((o) => o.charAt(0) === f).length;
                expect(matches).toBeGreaterThanOrEqual(3);
                expect(matches).toBeLessThan(testOptions.length);

                /* ---------- Assertions ---------- */
                // Filter `option`s
                const combobox = page.getByRole("combobox");
                await combobox.press(f);
                const visibleOptions = page.getByRole("option");
                await expect(visibleOptions).toHaveCount(matches);

                // Reveal `No Matches` Message
                const listbox = page.getByRole("listbox");
                const noMatchesMessage = `${f}ailed Matching`;
                const noMatchesElement = listbox.getByText(noMatchesMessage);
                await combobox.evaluate((node: ComboboxField, msg) => (node.noMatchesMessage = msg), noMatchesMessage);

                await page.keyboard.press("Z");
                await expect(visibleOptions).toHaveCount(0);
                await expect(noMatchesElement).toBeVisible();

                // Double check that the `No Matches` message is the LAST (but not only) element in the `listbox`
                await expect(listbox.locator("*").first()).not.toHaveText(noMatchesMessage);
                await expect(listbox.locator("*").last()).toHaveText(noMatchesMessage);

                // Revert to previous filter IN 1 KEYSTROKE
                await page.keyboard.press("Backspace");
                await expect(visibleOptions).toHaveCount(matches);
                await expect(visibleOptions).toHaveText([...Array(matches)].map(() => new RegExp(`^${f}`)));

                // Although it matches the filter, the `No Matches` Message should have been removed
                await expect(noMatchesElement).not.toBeAttached();

                // The `No Matches` Message shouldn't be in the matching `option`s set either (check with navigation)
                await expectOptionToBeActive(page, { label: first });

                for (let i = 0; i < matches + 1; i++) await page.keyboard.press("ArrowDown");
                await expectOptionToBeActive(page, { label: fifth });
                await expectOptionToBeActive(page, { label: first }, false);

                await page.keyboard.press("ArrowUp");
                await expectOptionToBeActive(page, { label: fourth });
                await expectOptionToBeActive(page, { label: fifth }, false);

                await page.keyboard.press("End");
                await expectOptionToBeActive(page, { label: fifth });

                // This should always work since the `No Matches` message is attached to end of `listbox`, not beginning
                await page.keyboard.press("Home");
                await expectOptionToBeActive(page, { label: first });
              });

              // NOTE: This test is technically irrelevant for `anyvalue` mode
              it("Renders the `No Matches` Message WHENEVER user applies bad filter (Regression)", async ({ page }) => {
                await renderComponent(page);

                // Provide an invalid filter
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially(String(Math.random()));

                const noMatchesMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                const noMatchesElement = page.getByRole("listbox").getByText(noMatchesMessage);
                await expect(noMatchesElement).toBeVisible();

                // Provide a valid filter
                await combobox.clear();
                await combobox.press(testOptions[0].charAt(0));
                await expect(noMatchesElement).not.toBeVisible();

                // Provide an invalid filter AGAIN! `No Matches` message should be visible, not hidden or filtered out
                await combobox.pressSequentially(String(Math.random()));
                await expect(noMatchesElement).toBeVisible();
              });
            });

            it.describe("Automatic Value Updates Feature", () => {
              it("Sets the `combobox` value to its filter in `anyvalue` mode", async ({ page }) => {
                /* -------------------- Setup -------------------- */
                const name = "my-combobox";
                const letters = "ABCDE";
                const emptyOptionLabel = "Choose a Value";

                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("anyvalue")}>
                      <option value="">${emptyOptionLabel}</option>
                      <option selected>${letters.slice(0, -4)}</option>
                      <option>${letters.slice(0, -3)}</option>
                      <option>${letters.slice(0, -2)}</option>
                      <option>${letters.slice(0, -1)}</option>
                      <option>${letters}</option>
                    </select>
                  </select-enhancer>
                `;

                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name });
                await expect(combobox).toHaveText("A");
                await expectOptionToBeSelected(page, { label: "A" });

                /* -------------------- Assertions -------------------- */
                await page.keyboard.press("Tab+ArrowRight");
                for (let i = 1; i < letters.length; i++) {
                  await page.keyboard.press(letters.charAt(i));

                  // `combobox` internal value should match filter
                  const filter = letters.slice(0, i + 1);
                  await expect(combobox).toHaveText(filter);
                  await expect(combobox).toHaveJSProperty("value", filter);
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(filter);

                  // But the corresponding `option` should not be selected
                  await expectOptionToBeActive(page, { label: filter });
                  await expect(page.getByRole("option", { name: filter, selected: true })).not.toBeAttached();
                  await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                }

                // `combobox` value can also be emptied
                await page.keyboard.press("ControlOrMeta+A");
                await page.keyboard.press("Backspace");
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", "");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                await expectOptionToBeActive(page, { label: emptyOptionLabel });
                await expectOptionToBeSelected(page, { label: emptyOptionLabel, value: "" }, false);
                await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
              });

              it("Clears the `combobox` value when its filter is emptied in `clearable` mode", async ({ page }) => {
                /* -------------------- Setup -------------------- */
                const name = "my-combobox";
                const emptyOptionLabel = "Choose a Value";
                const Cars = "Cars";

                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("clearable")}>
                      <option value="" selected>${emptyOptionLabel}</option>
                      <option>${Cars}</option>
                    </select>
                  </select-enhancer>
                `;

                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name });
                await expect(combobox).toHaveText(emptyOptionLabel);
                await expectOptionToBeSelected(page, { label: emptyOptionLabel, value: "" });

                /* -------------------- Assertions -------------------- */
                // Partially delete filter
                await page.keyboard.press("Tab+ArrowRight");
                await page.keyboard.press("Backspace+Backspace");

                // Empty `option` should still be selected
                const visibleOptions = page.getByRole("option");
                await expect(visibleOptions).toHaveCount(0);
                await expect(
                  page.getByRole("option", { name: emptyOptionLabel, selected: true, includeHidden: true }),
                ).toBeAttached();

                // Completely empty filter
                await page.keyboard.press("ControlOrMeta+A");
                await page.keyboard.press("Backspace");

                // No `option`s should be selected, now
                await expect(visibleOptions).toHaveCount(2);
                await expectOptionToBeActive(page, { label: emptyOptionLabel });
                await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);

                // And the `combobox` value should be an Empty String
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", "");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                // The same thing happens if we start with a selected value
                await page.keyboard.press("ArrowDown+Enter");
                await expectOptionToBeSelected(page, { label: Cars });

                await page.keyboard.press("Backspace");
                await expect(combobox).toHaveText(Cars.slice(0, -1));
                await expect(combobox).toHaveJSProperty("value", Cars);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(Cars);
                await expectOptionToBeActive(page, { label: Cars });
                await expect(page.getByRole("option", { name: Cars, selected: true })).toBeVisible();

                await page.keyboard.press("ControlOrMeta+A");
                await page.keyboard.press("Backspace");
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", "");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
              });

              it("Does not modify the `combobox` value as the user types in `unclearable` mode", async ({ page }) => {
                /* -------------------- Setup -------------------- */
                const name = "my-combobox";
                const letters = "ABCDE";
                const emptyOptionLabel = "Choose a Value";

                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      <option value="">${emptyOptionLabel}</option>
                      <option>${letters.slice(0, -4)}</option>
                      <option>${letters.slice(0, -3)}</option>
                      <option>${letters.slice(0, -2)}</option>
                      <option>${letters.slice(0, -1)}</option>
                      <option>${letters}</option>
                    </select>
                  </select-enhancer>
                `;

                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name });
                await expect(combobox).toHaveText(emptyOptionLabel);

                const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                await expectOptionToBeSelected(page, { label: emptyOptionLabel, value: "" });

                /* -------------------- Assertions -------------------- */
                await page.keyboard.press("Tab+Backspace");
                for (let i = 0; i < letters.length; i++) {
                  await page.keyboard.press(letters.charAt(i));

                  // `combobox` internal value NOT change
                  const filter = letters.slice(0, i + 1);
                  await expect(combobox).toHaveText(filter);
                  await expect(combobox).toHaveJSProperty("value", "");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                  // AND the corresponding `option` should NOT be selected
                  await expectOptionToBeActive(page, { label: filter });
                  await expect(selectedOption).toHaveText(emptyOptionLabel);
                  await expect(page.getByRole("option", { name: filter, selected: true })).not.toBeAttached();
                }

                // `combobox` FILTER can be emptied, but VALUE and OPTION state WON'T change
                await page.keyboard.press("ControlOrMeta+A");
                await page.keyboard.press("Backspace");
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", "");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                await expectOptionToBeActive(page, { label: emptyOptionLabel });
                await expect(selectedOption).toHaveText(emptyOptionLabel);
              });

              for (const filtertype of ["anyvalue", "clearable", "unclearable"] as const satisfies ValueIs[]) {
                it(`Exposes the option matching the user's current filter in ${filtertype} mode`, async ({ page }) => {
                  /* -------------------- Setup -------------------- */
                  const emptyOptionLabel = "Choose a Word";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <select-enhancer>
                      <select ${getFilterAttrs(filtertype)}>
                        <option value="">${emptyOptionLabel}</option>
                        <option value="1">App</option>
                        <option value="2">Apparent</option>
                        <option value="3">Apparently</option>
                      </select>
                    </select-enhancer>
                    <button type="button">Focus Me</button>
                  `;

                  const combobox = page.getByRole("combobox");
                  await expect(combobox).toHaveText(filtertype === "unclearable" ? emptyOptionLabel : "");

                  const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);

                  /* -------------------- Assertions -------------------- */
                  // Auto-selecting `App`
                  for (const letter of "Ap") {
                    await combobox.press(letter);
                    await expectOptionToBeActive(page, { label: "App" });
                    await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                    if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);
                    expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);
                  }

                  await combobox.press("p");
                  await expectOptionToBeActive(page, { label: "App" });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);

                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "1");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "App");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  // Auto-selecting `Apparent`
                  for (const letter of "aren") {
                    await combobox.press(letter);
                    await expectOptionToBeActive(page, { label: "Apparent" });
                    await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                    if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);
                    expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);
                  }

                  await combobox.press("t");
                  await expectOptionToBeActive(page, { label: "Apparent" });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);

                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "2");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Apparent");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  // Auto-selecting `Apparently`
                  await combobox.press("l");
                  await expectOptionToBeActive(page, { label: "Apparently" });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);
                  expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);

                  await combobox.press("y");
                  await expectOptionToBeActive(page, { label: "Apparently" });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText(emptyOptionLabel);
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "3");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Apparently");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  // Auto-selectables persist on `collapse`
                  await combobox.press("Tab");
                  await expectComboboxToBeClosed(page);
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "3");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Apparently");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  // But they are cleared on expansion
                  await combobox.press("ArrowDown");
                  await expectOptionToBeActive(page, { label: emptyOptionLabel });
                  expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);

                  // Even if the auto-selectable was previously-selected
                  await combobox.press("Apparently".split("").join("+"));
                  await combobox.press("Enter");
                  await expectComboboxToBeClosed(page);
                  await expectOptionToBeSelected(page, { label: "Apparently", value: "3" });
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "3");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Apparently");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  await combobox.press("ArrowDown");
                  await expectOptionToBeActive(page, { label: "Apparently" });
                  expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);

                  // The Empty String `option` is NEVER auto-selectable
                  await combobox.press("ControlOrMeta+A");
                  await combobox.press(emptyOptionLabel.split("").join("+"));
                  await expect(combobox).toHaveText(emptyOptionLabel);
                  expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);

                  // And clearing the `combobox` filter obviously clears the auto-selectable
                  await combobox.press("ControlOrMeta+A");
                  await combobox.press("App".split("").join("+"));
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "1");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.label", "App");
                  await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                  await combobox.press("ControlOrMeta+A");
                  await combobox.press("Backspace");
                  await expect(combobox).toHaveText("");
                  await expectOptionToBeActive(page, { label: emptyOptionLabel });
                  await expect(selectedOption).toBeAttached({ attached: filtertype === "unclearable" });
                  if (filtertype === "unclearable") await expect(selectedOption).toHaveText("Apparently");
                  expect(await combobox.evaluate((node: ComboboxField) => node.autoselectableOption)).toBe(null);
                });
              }
            });

            it.describe("Behavior on `collapse`", () => {
              it("Resets the filtered `option`s", async ({ page }) => {
                /* -------------------- Setup -------------------- */
                const first = testOptions[0];
                await renderComponent(page);

                /* -------------------- Assertions -------------------- */
                // All `option`s are visible when `combobox` is first expanded
                const combobox = page.getByRole("combobox");
                await combobox.press("ArrowDown");

                const visibleOptions = page.getByRole("option");
                await expect(visibleOptions).toHaveCount(testOptions.length);

                /* ---------- Collapsing by `option`s Selection ---------- */
                // Apply filter
                await page.keyboard.press(first[0]);
                await expect(visibleOptions).not.toHaveCount(0);
                await expect(visibleOptions).not.toHaveCount(testOptions.length);

                // Check `option`s after value selection + re-expansion
                await page.keyboard.press("Enter");
                await page.keyboard.press("ArrowDown");
                await expect(visibleOptions).toHaveCount(testOptions.length);

                /* ---------- Collapsing with `Escape` ---------- */
                // Apply filter again
                await page.keyboard.press("ControlOrMeta+A");
                await page.keyboard.press(first[0]);
                await expect(visibleOptions).not.toHaveCount(0);
                await expect(visibleOptions).not.toHaveCount(testOptions.length);

                // Check `option`s after `Escape`-ing + re-expansion
                await page.keyboard.press("Escape");
                await page.keyboard.press("ArrowUp");
                await expect(visibleOptions).toHaveCount(testOptions.length);

                /* ---------- Collapsing by Blurring ---------- */
                // Apply a bad filter
                await combobox.press("ControlOrMeta+A");
                await combobox.press(String(Math.random()).split("").join("+"));
                await expect(visibleOptions).toHaveCount(0);

                // Check `option`s after `Tab`bing away + re-expansion
                await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", "<button>Focus Me</button>"));
                await page.keyboard.press("Tab");
                await page.keyboard.press("Shift+Tab");
                await page.keyboard.press("End");
                await expect(visibleOptions).toHaveCount(testOptions.length);
              });

              it('Excludes the "No Matches" message from the filter reset (Regression)', async ({ page }) => {
                await renderComponent(page);

                // Apply a bad filter
                const combobox = page.getByRole("combobox");
                await combobox.fill(Math.random().toString());

                // Verify that the `No Matches` message is displayed
                const noMatchMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                expect(noMatchMessage).toBeTruthy();

                const listbox = page.getByRole("listbox", { includeHidden: true });
                const noMatchMessageElement = listbox.getByText(noMatchMessage);
                await expect(noMatchMessageElement).toBeVisible();

                // Close the `combobox` WHILE the `No Matches` message is displayed
                await page.keyboard.press("Escape");
                await expect(listbox).toBeAttached();
                await expect(page.getByText(noMatchMessage)).not.toBeAttached();
              });

              const describeBlockByMode = {
                unclearable: "in `unclearable` mode",
                clearable: "in `clearable` mode",
                anyvalue: "in `anyvalue` mode",
              } as const satisfies Record<ValueIs, `in \`${ValueIs}\` mode`>;

              for (const filtertype of ["unclearable", "clearable", "anyvalue"] as const satisfies ValueIs[]) {
                it.describe(describeBlockByMode[filtertype], () => {
                  if (filtertype === "anyvalue") {
                    it("Leaves the `combobox` label/filter as is", async ({ page }) => {
                      /* -------------------- Setup -------------------- */
                      const name = "my-combobox";
                      const first = testOptions[0];
                      await renderComponent(page, { initialValue: first, valueis: filtertype });

                      const form = page.getByRole("form");
                      const combobox = page.getByRole("combobox");
                      await associateComboboxWithForm(combobox, { name });
                      await expect(combobox).toHaveAttribute("valueis", "anyvalue");
                      await expectOptionToBeSelected(page, { label: first });

                      /* -------------------- Assertions -------------------- */
                      // Start filtering by `First`, then quit
                      const filter = first.slice(0, 3);
                      await combobox.press(filter.split("").join("+"));
                      await expectOptionToBeActive(page, { label: first });
                      await page.keyboard.press("Escape");

                      await expectComboboxToBeClosed(page);
                      await expect(combobox).toHaveText(filter);
                      await expect(combobox).toHaveJSProperty("value", filter);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(filter);
                      await expectOptionToBeSelected(page, { label: first }, false);
                    });
                  } else {
                    it("Resets the `combobox` label to the last valid value", async ({ page }) => {
                      /* -------------------- Setup -------------------- */
                      const name = "my-combobox";
                      const first = "First";
                      const second = "Second";

                      await page.goto(url);
                      await renderHTMLToPage(page)`
                        <form aria-label="Test Form">
                          <select-enhancer>
                            <select name="${name}" ${getFilterAttrs(filtertype)}>
                              <option value="">Choose a Number</option>
                              <option value="1">${first}</option>
                              <option value="2" selected>${second}</option>
                              <option value="3">Third</option>
                            </select>
                          </select-enhancer>
                        </form>
                      `;

                      const form = page.getByRole("form");
                      const combobox = page.getByRole("combobox");
                      await expect(combobox).toHaveAttribute("valueis", filtertype);
                      await expectOptionToBeSelected(page, { label: second, value: "2" });

                      /* -------------------- Assertions -------------------- */
                      // Start filtering by `First`, then quit
                      await combobox.fill(first.slice(0, Math.floor(first.length / 2)));
                      await expectOptionToBeActive(page, { label: first });
                      await page.keyboard.press("Escape");

                      await expectComboboxToBeClosed(page);
                      await expect(combobox).toHaveText(second);
                      if (filtertype === "unclearable") return;

                      /* ---------- `clearable` mode ONLY ---------- */
                      // Empty `combobox` value
                      await combobox.clear();
                      await expect(combobox).toHaveJSProperty("value", "");
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                      await expectOptionToBeSelected(page, { label: "Choose a Number", value: "" }, false);

                      // Start filtering by `Second`, then quit
                      await combobox.fill(second.slice(0, Math.floor(second.length / 2)));
                      await expectOptionToBeActive(page, { label: second });
                      await page.keyboard.press("Escape");

                      await expectComboboxToBeClosed(page);
                      await expect(combobox).toHaveText("");
                      await expect(combobox).toHaveJSProperty("value", "");
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                      await expectOptionToBeSelected(page, { label: "Choose a Number", value: "" }, false);
                    });
                  }

                  it("Moves the cursor to the end of the `combobox`", async ({ page }) => {
                    const first = testOptions[0];
                    const second = testOptions[1];
                    await renderComponent(page, { initialValue: second, valueis: filtertype });
                    await expectOptionToBeSelected(page, { label: second });

                    // Start filtering by `First`, move cursor backwards, then quit
                    const combobox = page.getByRole("combobox");
                    const filter = first.slice(0, 3);
                    await combobox.press(filter.split("").join("+"));

                    await expectOptionToBeActive(page, { label: first });
                    await page.keyboard.press("ArrowLeft+ArrowLeft");
                    await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 1 });

                    await expect(combobox).toHaveText(filter);
                    await page.keyboard.press("Escape");
                    await expect(combobox).not.toHaveText(filtertype === "anyvalue" ? second : filter);
                    await expect(combobox).toHaveText(filtertype === "anyvalue" ? filter : second);
                    await expect(combobox).toHaveTextSelection("end");

                    // Cursor is not moved back to `combobox` when it is collapsed via `blur`, though
                    await combobox.press("ControlOrMeta+A");
                    await combobox.press(filter.split("").join("+"));
                    await page.keyboard.press("ArrowLeft+ArrowLeft");
                    await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 1 });

                    await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", "<input>"));
                    await page.keyboard.press("Tab");
                    await expect(combobox).not.toBeFocused();
                    await expect(combobox).toHaveText(filtertype === "anyvalue" ? filter : second);
                  });

                  // NOTE: This is an intentional regression test. It technically "duplicates" the previous one.
                  it("Moves the cursor to the end of the `combobox` when an `option` is selected", async ({ page }) => {
                    const third = testOptions[2];
                    const second = testOptions[1];
                    expect(third.length).toBeLessThan(second.length);
                    await renderComponent(page, { initialValue: third, valueis: filtertype });

                    // Open `combobox` and activate an `option` with more text
                    const combobox = page.getByRole("combobox");
                    await page.keyboard.press("Tab");
                    await page.keyboard.press("ArrowUp+ArrowUp");
                    await expectOptionToBeActive(page, { label: second });

                    // Move cursor backwards
                    await page.keyboard.press("ArrowRight+ArrowLeft+ArrowLeft");
                    const cursorLocation = third.length - 2;
                    await expect(combobox).toHaveTextSelection({ anchor: cursorLocation, focus: cursorLocation });

                    // Select `option`
                    await page.keyboard.press("Enter");
                    await expectOptionToBeSelected(page, { label: second });
                    await expect(combobox).toHaveTextSelection("end");
                  });
                });
              }
            });

            it.describe("Support for Editing Selected Text", () => {
              // Local helpers for these `Selection`-based tests
              function getRangeCount(pageWithSelection: Page): Promise<number> {
                return pageWithSelection.evaluate(() => (document.getSelection() as Selection).rangeCount);
              }

              it("Supports single-selection edits (All Browsers)", async ({ page }) => {
                /* -------------------- Setup -------------------- */
                const seventh = testOptions[6];
                await renderComponent(page, { initialValue: seventh });
                const combobox = page.getByRole("combobox");

                const noMatchesMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                expect(noMatchesMessage).toBeTruthy();
                const noMatchesElement = page.getByRole("listbox").getByText(noMatchesMessage);

                /* -------------------- Assertions -------------------- */
                /* ----- Selecting 1 Character ----- */
                // Select `S`
                const beforeS = await getLocationOf(combobox, 0);
                await page.mouse.move(beforeS.x, beforeS.y);
                await page.mouse.down({ button: "left" });

                const afterS = await getLocationOf(combobox, 1);
                await page.mouse.move(afterS.x, afterS.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 0, focus: 1 });

                // Apply single-selection input
                await page.keyboard.press("a");
                await expect(combobox).toHaveText(seventh.replace("S", "a"));
                await expect(noMatchesElement).toBeVisible();

                // Verify new Cursor location is correct
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 1 });

                // Reset `combobox` filter/label
                await page.keyboard.press("Escape");
                await expect(combobox).toHaveText(seventh);

                /* ----- Selecting Multiple Characters ----- */
                // Select `nth`
                const afterH = await getLocationOf(combobox, seventh.length);
                await page.mouse.move(afterH.x, afterH.y);
                await page.mouse.down({ button: "left" });

                const beforeN = await getLocationOf(combobox, seventh.length - 3);
                await page.mouse.move(beforeN.x, beforeN.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 7, focus: 4 });

                // Apply single-selection input
                await page.keyboard.press("Z");
                await expect(combobox).toHaveText("SeveZ");
                await expect(noMatchesElement).toBeVisible();

                // Verify new Cursor location is correct
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection("end");
                await expect(combobox).toHaveTextSelection({ anchor: 5, focus: 5 });

                // Reset `combobox` filter/label
                await page.keyboard.press("Escape");
                await expect(combobox).toHaveText(seventh);

                /* ----- Selection + Insertion Resulting in a Good Filter ----- */
                // Select everything except the starting `S`
                await page.mouse.move(afterS.x, afterS.y);
                await page.mouse.down({ button: "left" });

                await page.mouse.move(afterH.x, afterH.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 7 });

                // Apply single-selection input
                await page.keyboard.press("ControlOrMeta+C");
                await page.keyboard.press("ControlOrMeta+V");
                await expect(combobox).toHaveText(seventh);
                await expect(noMatchesElement).not.toBeVisible();
                await expectOptionToBeActive(page, { label: seventh });

                // Verify new Cursor location is correct
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection("end");
                await expect(combobox).toHaveTextSelection({ anchor: 7, focus: 7 });
              });

              /*
               * NOTE: This behavior aims to copy what Firefox (FF) does for multi-selection edits of <input> elements.
               * However, we intentionally chose to insert the user-provided `InputEvent` data into EVERY place where a
               * Selection Range exists (unlike FF -- at least as of July 2025). We believe this is a significantly more
               * intuitive UX. We still only put one cursor at the end post-edit like Firefox does, though;
               * that part isn't _too_ unintuitive/inconvenient in our view.
               */
              it("Supports multi-selection edits (Firefox Only)", async ({ page, browserName }) => {
                if (browserName !== "firefox") return;

                /* -------------------- Setup -------------------- */
                const ControlOrMeta = "ControlOrMeta";
                const seventh = testOptions[6];
                await renderComponent(page, { initialValue: seventh });
                const combobox = page.getByRole("combobox");

                const noMatchesMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                expect(noMatchesMessage).toBeTruthy();
                const noMatchesElement = page.getByRole("listbox").getByText(noMatchesMessage);

                /*
                 * NOTE: ALL of the `Selection` size/order scenarios in this test are INTENTIONAL and IMPORTANT
                 * for verifying that our re-implementation of the `input` event's behavior in our
                 * `beforeinput` handler CORRECTLY manages multi-selection edits without exhibiting bugs/errors.
                 * The tests may seem redundant, but every scenario is NECESSARY.
                 *
                 * DO NOT DELETE ANY OF THE SCENARIOS IN THIS TEST!!!
                 */
                /* -------------------- Assertions -------------------- */
                // Nothing should break during any of these multi-selection interactions
                let error: Error | undefined;
                const trackEmittedError = (e: Error) => (error = e);
                page.once("pageerror", trackEmittedError);

                /* ----- Giving LAST `Selection` the larger `Range` ----- */
                // Select first `e`
                await page.keyboard.down(ControlOrMeta);
                const beforeFirstE = await getLocationOf(combobox, 1);
                await page.mouse.move(beforeFirstE.x, beforeFirstE.y);
                await page.mouse.down({ button: "left" });

                const afterFirstE = await getLocationOf(combobox, 2);
                await page.mouse.move(afterFirstE.x, afterFirstE.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 2 });

                // Also select `nt`
                const beforeN = await getLocationOf(combobox, 4);
                await page.mouse.move(beforeN.x, beforeN.y);
                await page.mouse.down({ button: "left" });

                const afterT = await getLocationOf(combobox, 6);
                await page.mouse.move(afterT.x, afterT.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(2);
                await expect(combobox).toHaveTextSelection({ anchor: 4, focus: 6 });

                // Apply multi-selection input
                await page.keyboard.up(ControlOrMeta);
                await page.keyboard.press("A");
                await expect(combobox).toHaveText("SAveAh");
                await expect(noMatchesElement).toBeVisible();

                // There should only be 1 Cursor. It should be where the (positionally) Last Range would have been.
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 5, focus: 5 });

                // Reset `combobox` filter/label
                await page.keyboard.press("Escape");
                await expect(combobox).toHaveText(seventh);

                /* ----- Giving FIRST `Selection` the larger `Range` ----- */
                // Select `eve`
                await page.keyboard.down(ControlOrMeta);
                await page.mouse.move(beforeFirstE.x, beforeFirstE.y);
                await page.mouse.down({ button: "left" });

                await page.mouse.move(beforeN.x, beforeN.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 1, focus: 4 });

                // Also select `t`
                const beforeT = await getLocationOf(combobox, 5);
                await page.mouse.move(beforeT.x, beforeT.y);
                await page.mouse.down({ button: "left" });

                await page.mouse.move(afterT.x, afterT.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(2);
                await expect(combobox).toHaveTextSelection({ anchor: 5, focus: 6 });

                // Apply multi-selection input
                await page.keyboard.up(ControlOrMeta);
                await page.keyboard.press("y");
                await expect(combobox).toHaveText("Synyh");
                await expect(noMatchesElement).toBeVisible();

                // There should only be 1 Cursor. It should be where the (positionally) Last Range would have been.
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 4, focus: 4 });

                // Reset `combobox` filter/label
                await page.keyboard.press("Escape");
                await expect(combobox).toHaveText(seventh);

                /* ----- Giving ALL `Selection`s the EQUAL `Range` size ----- */
                /*
                 * NOTE: For some reason, AT THIS POINT in the test, attempting `combobox.fill(str)` will
                 * result in `str`'s phyiscal value being wrongly DUPLICATED into the `combobox`'s text content.
                 * Yet `page.keyboard.press()` DOES NOT exhibit this erroneous behavior. This is probably a bug
                 * in Playwright since `page.keyboard.*` works normally, as does manual testing.
                 */
                // Give `combobox` bad Text Content (which we will fix)
                await page.keyboard.press(`${ControlOrMeta}+A`);
                await page.keyboard.press(seventh.replaceAll("e", "K").split("").join("+"));
                await expect(noMatchesElement).toBeVisible();

                // Select 2nd `e`
                await page.keyboard.down(ControlOrMeta);
                await page.mouse.move(beforeN.x, beforeN.y);
                await page.mouse.down({ button: "left" });

                const beforeSecondE = await getLocationOf(combobox, 3);
                await page.mouse.move(beforeSecondE.x, beforeSecondE.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 4, focus: 3 });

                // Also select 1st `e` (order is intentional)
                await page.mouse.move(afterFirstE.x, afterFirstE.y);
                await page.mouse.down({ button: "left" });

                await page.mouse.move(beforeFirstE.x, beforeFirstE.y);
                await page.mouse.up({ button: "left" });
                expect(await getRangeCount(page)).toBe(2);
                await expect(combobox).toHaveTextSelection({ anchor: 2, focus: 1 });

                // Apply multi-selection input
                await page.keyboard.up(ControlOrMeta);
                await page.keyboard.press("e");
                await expect(combobox).toHaveText(seventh);
                await expect(noMatchesElement).not.toBeVisible();
                await expectOptionToBeActive(page, { label: seventh });

                // There should only be 1 Cursor. It should be where the (positionally) Last Range would have been.
                expect(await getRangeCount(page)).toBe(1);
                await expect(combobox).toHaveTextSelection({ anchor: 4, focus: 4 });

                // No errors should have occurred
                await new Promise((resolve) => setTimeout(resolve, 250));
                expect(error).toBe(undefined);
                page.off("pageerror", trackEmittedError);
              });
            });

            it("Properly navigates filtered `option`s", async ({ page }) => {
              /* -------------------- Setup -------------------- */
              const options = ["Placeholder", ...testOptions] as const;
              const first = options[1];
              const fourth = options[4];
              const fifth = options[5];

              expect(options.filter((o) => o[0] === fourth[0]).length).toBeGreaterThan(2);
              await renderComponent(page, { options, initialValue: fourth });

              /* -------------------- Assertions -------------------- */
              /* ---------- With a Valid Filter ---------- */
              // Display FILTERED `option`s
              await page.keyboard.press("Tab");
              await page.keyboard.press(fourth[0]);
              await expectOptionToBeActive(page, { label: first });

              // Pressing `ArrowDown` should move to `Fourth`, not `Second` (i.e., not the adjacent `option`)
              await page.keyboard.press("ArrowDown");
              await expectOptionToBeActive(page, { label: fourth });

              // Pressing `ArrowUp` should move back to `First`, not `Third` (i.e., not the adjacent `option`)
              await page.keyboard.press("ArrowUp");
              await expectOptionToBeActive(page, { label: first });

              // Pressing `End` should move to `Fifth` (Last matching `option`, NOT last `option`)
              await page.keyboard.press("End");
              await expectOptionToBeActive(page, { label: fifth });
              expect(testOptions.findLast((o) => o.startsWith(fourth[0]))).toBe(fifth);

              // Pressing `Home` should move to `First` (First matching `option`, NOT first `option`)
              await page.keyboard.press("Home");
              await expectOptionToBeActive(page, { label: first });
              expect(testOptions.find((o) => o.startsWith(fourth[0]))).toBe(first);

              /* ---------- With 0 Matching Options ---------- */
              const combobox = page.getByRole("combobox");
              await combobox.clear();
              await combobox.fill(String(Math.random()));

              const activeOption = page.getByRole("option").and(page.locator(`[data-active="${true}"]`));
              const noMatchMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
              const noMatchElement = page.getByText(noMatchMessage);

              await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], "");
              await expect(activeOption).not.toBeVisible();
              await expect(noMatchElement).toBeVisible();

              // Pressing `ArrowDown` should do nothing since there are no matches
              await page.keyboard.press("ArrowDown");
              await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], "");
              await expect(activeOption).not.toBeVisible();

              // Pressing `ArrowUp` should do nothing since there are no matches
              await page.keyboard.press("ArrowUp");
              await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], "");
              await expect(activeOption).not.toBeVisible();

              // Pressing `End` should do nothing since there are no matches
              await page.keyboard.press("End");
              await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], "");
              await expect(activeOption).not.toBeVisible();

              // Pressing `Home` should do nothing since there are no matches
              await page.keyboard.press("Home");
              await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], "");
              await expect(activeOption).not.toBeVisible();

              /* ---------- Without a Filter ---------- */
              await combobox.clear();
              await expect(activeOption).toBeVisible(); // Note: Use only our native helper function after this check
              await expectOptionToBeActive(page, { label: "Placeholder" });

              // Pressing `ArrowDown` TWICE should move to `Second` (the natural order)
              for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");
              await expectOptionToBeActive(page, { label: options[2] });

              // Pressing `ArrowUp` should move back to `First` (the natural order)
              await page.keyboard.press("ArrowUp");
              await expectOptionToBeActive(page, { label: first });

              // Pressing `End` should move to `Tenth` (the Last `option` in our list)
              await page.keyboard.press("End");
              await expectOptionToBeActive(page, { label: options.at(-1) as string });

              // Pressing `Home` should move to `Placeholder` (the First `option` in our list)
              await page.keyboard.press("Home");
              await expectOptionToBeActive(page, { label: options[0] });
            });

            it("Does not break when text is inserted into an empty filter (Regression)", async ({ page }) => {
              const F = testOptions[0].charAt(0) as "F";
              await renderComponent(page);

              // Nothing should break during any of these interactions
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              const combobox = page.getByRole("combobox");
              await combobox.clear();
              expect(await combobox.evaluate((node) => node.textContent === "")).toBe(true); // Double-checking things

              await combobox.press(F);
              await expect(page.getByRole("option")).toHaveText([testOptions[0], testOptions[3], testOptions[4]]);

              // No errors should have occurred
              await new Promise((resolve) => setTimeout(resolve, 250));
              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);
            });
          });
        }
      });

      it.describe("Listbox Scrolling Functionality", () => {
        it("Scrolls the `active` `option` into view if needed", async ({ page }) => {
          /* ---------- Setup ---------- */
          await renderComponent(page, testOptions[0]);

          /* ---------- Assertion ---------- */
          /**
           * The additional number of times to press `ArrowUp`/`ArrowDown` so that the remnant of the previous
           * option is no longer visible. (This is needed because of the `safetyOffset` in `ComboboxField`).
           */
          const offset = 1;
          const displayCount = 4;
          const container = page.locator("select-enhancer");
          await container.evaluate((e, blocks) => e.style.setProperty("--blocks", blocks), `${displayCount}` as const);

          // Initially, Lower Option Is NOT in View
          await page.keyboard.press("Tab+ArrowDown");
          await expect(page.getByRole("option").nth(displayCount + offset)).not.toBeInViewport();

          // Scroll Lower Option into View
          for (let i = 0; i < displayCount + offset; i++) await page.keyboard.press("ArrowDown");
          await expect(page.getByRole("option").nth(displayCount + offset)).toBeInViewport();
          await expect(page.getByRole("option").first()).not.toBeInViewport();

          // Scroll Upper Option into View
          for (let i = 0; i < displayCount + offset; i++) await page.keyboard.press("ArrowUp");
          await expect(page.getByRole("option").first()).toBeInViewport();
          await expect(page.getByRole("option").nth(displayCount + offset)).not.toBeInViewport();

          // Scroll LAST Option into View
          await page.keyboard.press("End");
          await expect(page.getByRole("option").last()).toBeInViewport();
          await expect(page.getByRole("option").first()).not.toBeInViewport();

          // Scroll FIRST Option into View
          await page.keyboard.press("Home");
          await expect(page.getByRole("option").first()).toBeInViewport();
          await expect(page.getByRole("option").last()).not.toBeInViewport();
        });
      });
    });

    it.describe("API", () => {
      it.describe("Combobox Field (Web Component Part)", () => {
        it.describe("Exposed Properties and Attributes", () => {
          it.describe("disabled (Property)", () => {
            it("Exposes the underlying `disabled` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} disabled>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` matches initial `attribute`
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("disabled", true);

              // `attribute` responds to `property` updates
              await combobox.evaluate((node: ComboboxField) => (node.disabled = false));
              await expect(combobox).not.toHaveAttribute("disabled");

              await combobox.evaluate((node: ComboboxField) => (node.disabled = true));
              await expect(combobox).toHaveAttribute("disabled", "");

              // `property` also responds to `attribute` updates
              await combobox.evaluate((node: ComboboxField) => node.removeAttribute("disabled"));
              await expect(combobox).toHaveJSProperty("disabled", false);
            });

            it("Prevents the `combobox` from being interactive", async ({ page }) => {
              // Reused Variables
              const second = testOptions[1];
              const filtertype = "unclearable" satisfies ValueIs;

              // Reused Locators
              const combobox = page.getByRole("combobox");
              const buttons = page.getByRole("button");

              await page.goto(url);
              for (const mountDisabled of [true, false] as const) {
                const step = mountDisabled ? "Mounted with `disabled` attribute" : "Imperatively disabled after mount";
                await it.step(step, async () => {
                  /* -------------------- Setup -------------------- */
                  await renderHTMLToPage(page)`
                    <button type="button">First Focusable</button>
                    <select-enhancer>
                      <select ${getFilterAttrs(filtertype)} ${mountDisabled ? "disabled" : ""}>
                        ${testOptions.map((o, i) => `<option${i === 1 ? " selected" : ""}>${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                    <button type="button">Last Focusable</button>
                  `;

                  await expect(combobox).toHaveJSProperty("disabled", mountDisabled);
                  if (!mountDisabled) await combobox.evaluate((node: ComboboxField) => (node.disabled = true));
                  await expect(combobox).toHaveAttribute("disabled", "");

                  await expectOptionToBeSelected(page, { label: second });

                  /* -------------------- Assertions -------------------- */
                  // Tabbing
                  await buttons.first().press("Tab");
                  await expect(combobox).not.toBeFocused();
                  await expect(buttons.last()).toBeFocused();

                  // Clicking
                  const after2ndLetter = await getLocationOf(combobox, 2);
                  await page.mouse.click(after2ndLetter.x, after2ndLetter.y + after2ndLetter.height * 0.5);
                  await expectComboboxToBeClosed(page);
                  await expect(combobox).not.toBeFocused();

                  // Using JavaScript
                  await combobox.focus();
                  await expect(combobox).not.toBeFocused();
                });
              }

              await it.step("Interactivity after Enablement", async () => {
                await combobox.evaluate((node: ComboboxField) => (node.disabled = false));

                // Tabbing
                await combobox.blur();
                await buttons.first().press("Tab");
                await expect(combobox).toBeFocused();

                // Clicking
                await combobox.blur();
                const after3rdLetter = await getLocationOf(combobox, 3);
                await page.mouse.click(after3rdLetter.x, after3rdLetter.y + after3rdLetter.height * 0.5);
                await expectOptionsToBeVisible(page);
                await expect(combobox).toBeFocused();

                // Using JavaScript
                await combobox.blur();
                await combobox.focus();
                await expect(combobox).toBeFocused();
              });
            });

            // NOTE: This is the behavior of the regular `<select>` element, and it makes practical sense
            it("Closes the `combobox` when turned on", async ({ page }) => {
              /* ---------- Setup ---------- */
              await renderComponent(page);

              const combobox = page.getByRole("combobox");
              await combobox.click();
              await expectOptionsToBeVisible(page);

              /* ---------- Assertions ---------- */
              // Disabling the `combobox` closes it
              await combobox.evaluate((node: ComboboxField) => (node.disabled = true));
              await expectComboboxToBeClosed(page);

              // Re-enabling the `combobox` does not automatically display the `option`s
              await combobox.evaluate((node: ComboboxField) => (node.disabled = false));
              await expectComboboxToBeClosed(page);
            });
          });

          it.describe("required (Property)", () => {
            it("Exposes the underlying `required` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} required>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` matches initial `attribute`
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("required", true);

              // `attribute` responds to `property` updates
              await combobox.evaluate((node: ComboboxField) => (node.required = false));
              await expect(combobox).not.toHaveAttribute("required");

              await combobox.evaluate((node: ComboboxField) => (node.required = true));
              await expect(combobox).toHaveAttribute("required", "");

              // `property` also responds to `attribute` updates
              await combobox.evaluate((node) => node.removeAttribute("required"));
              await expect(combobox).toHaveJSProperty("required", false);
            });

            createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (filtertype) => {
              it("Marks the `combobox` as `invalid` when the `required` constraint is broken", async ({ page }) => {
                // Re-used Variables
                const filterAttrs = getFilterAttrs(filtertype);
                const error = "Please select an item in the list.";
                const combobox = page.getByRole("combobox");
                await page.goto(url);

                await it.step("Imperative `required` attribute updates", async () => {
                  await renderHTMLToPage(page)`
                    <select-enhancer>
                      <select ${filterAttrs}>
                        <option value="" selected>Select an Option</option>
                        ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  `;

                  // `combobox` starts off valid without constraints
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe("");

                  // `combobox` becomes invalid when `required` is applied because of _empty_ value
                  await combobox.evaluate((node: ComboboxField) => (node.required = true));
                  await expectOptionToBeSelected(page, { label: "Select an Option", value: "" });
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

                  // `combobox` becomes valid when a _non-empty_ value is selected
                  await combobox.press("End+Enter");
                  await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string });
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe("");

                  // `combobox` becomes invalid again when an _empty_ value is selected
                  await combobox.press("Home+Enter");
                  await expectOptionToBeSelected(page, { label: "Select an Option", value: "" });
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

                  // `combobox` can be made valid again by removing the `required` constraint entirely
                  await combobox.evaluate((node: ComboboxField) => (node.required = false));
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
                  expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe("");

                  if (filtertype === "clearable" || filtertype === "anyvalue") {
                    // The same rules apply for value changes caused by filter updates
                    await combobox.evaluate((node: ComboboxField) => (node.required = true));

                    await combobox.press("End+Enter");
                    await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string });

                    await combobox.press("ControlOrMeta+A");
                    await combobox.press("Backspace");
                    await expect(combobox).toHaveJSProperty("value", "");
                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

                    if (filtertype === "anyvalue") {
                      const first = testOptions[0];
                      await combobox.press(first.charAt(0));
                      await expect(combobox).toHaveJSProperty("value", first.charAt(0));
                    } else {
                      await combobox.press("End+Enter");
                      await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string });
                    }

                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe("");

                    // This rule also applies when the value is coerced to an empty string
                    await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue());
                    await expect(combobox).toHaveJSProperty("value", "");

                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);
                  }
                });

                for (const mountRequired of [true, false] as const) {
                  await it.step(`Mounting ${mountRequired ? "with" : "without"} \`required\` attribute`, async () => {
                    const requiredAttr = mountRequired ? "required" : "";

                    // With empty _Option_ Selected
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select ${filterAttrs} ${requiredAttr}>
                          <option value="" selected>Select an Option</option>
                          ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    await expect(combobox).toHaveJSProperty("validity.valid", !mountRequired);
                    await expect(combobox).toHaveJSProperty("validity.valueMissing", mountRequired);
                    await expect(combobox).toHaveJSProperty("validationMessage", mountRequired ? error : "");

                    if (filtertype === "clearable" || filtertype === "anyvalue") {
                      // With empty _Filter/Value_
                      await renderHTMLToPage(page)`
                        <select-enhancer>
                          <select ${filterAttrs} ${requiredAttr}>
                            ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                            <option value="">Select an Option</option>
                          </select>
                        </select-enhancer>
                      `;

                      const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                      await expect(selectedOption).not.toBeAttached();
                      await expect(combobox).toHaveText("");
                      await expect(combobox).toHaveJSProperty("value", "");

                      await expect(combobox).toHaveJSProperty("validity.valid", !mountRequired);
                      await expect(combobox).toHaveJSProperty("validity.valueMissing", mountRequired);
                      await expect(combobox).toHaveJSProperty("validationMessage", mountRequired ? error : "");
                    }

                    // With _NON-EMPTY_ Option Selected
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select ${filterAttrs} ${requiredAttr}>
                          <option value="">Select an Option</option>
                          ${testOptions.map((o, i) => `<option${!i ? " selected" : ""}>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
                    expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe("");
                  });
                }
              });
            });
          });

          it.describe("name (Property)", () => {
            it("Exposes the underlying `name` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              const initialName = "initial-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select name="${initialName}" ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` matches initial `attribute`
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("name", initialName);

              // `attribute` responds to `property` updates
              const newPropertyName = "property-combobox";
              await combobox.evaluate((node: ComboboxField, name) => (node.name = name), newPropertyName);
              await expect(combobox).toHaveAttribute("name", newPropertyName);

              // `property` responds to `attribute` updates
              const newAttributeName = "attribute-combobox";
              await combobox.evaluate((node: ComboboxField, name) => node.setAttribute("name", name), newAttributeName);
              await expect(combobox).toHaveJSProperty("name", newAttributeName);
            });

            it("Complies with Form Standards by yielding an empty string in lieu of an attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` defaults to empty string
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("name", "");

              // `property` still defaults to empty string when the `name` attribute is _cleared_
              await combobox.evaluate((node: ComboboxField) => {
                node.setAttribute("name", "some-valid-name");
                node.removeAttribute("name");
              });

              await expect(combobox).toHaveJSProperty("name", "");
            });
          });

          it.describe("value (Property)", () => {
            it("Exposes the `value` of the `combobox`", async ({ page }) => {
              // Setup
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs("unclearable")}>
                      <option value="" selected>Select a Value</option>
                      ${testOptions.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;

              // Assertions
              const form = page.getByRole("form");
              const combobox = page.getByRole("combobox");
              await expectOptionToBeSelected(page, { value: "", label: "Select a Value" });
              expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe("");
              expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

              const userValue = testOptions[0];
              await combobox.click();
              await page.getByRole("option", { name: userValue }).click();
              await expectOptionToBeSelected(page, { value: "0", label: "First" });
              expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe("0");
              expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

              await page.mouse.move(0, 0);
              await combobox.press(`End+${new Array(2).fill("ArrowUp").join("+")}+Enter`);
              await expectOptionToBeSelected(page, { value: "7", label: "Eigth" });
              expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe("7");
              expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("7");
            });

            createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (filtertype) => {
              it("Updates the `value` of the `combobox`, including `option`s and validity state", async ({ page }) => {
                // Setup
                const name = "my-combobox";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(filtertype)} required>
                        <option value="" selected>Select a Value</option>
                        ${testOptions.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  </form>
                `;

                // Assertions
                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");

                const empty = { value: "", label: "Select a Value" };
                await expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);

                // Manually Make Field Valid
                const userValue = "7";
                await combobox.evaluate((node: ComboboxField, value) => (node.value = value), userValue);
                await expectOptionToBeSelected(page, { value: userValue, label: testOptions[userValue] });
                await expectOptionToBeSelected(page, { value: empty.value, label: empty.label }, false);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(userValue);
                expect(await combobox.evaluate((node: ComboboxField) => node.checkValidity())).toBe(true);

                // Manually Make Field Invalid
                expect(await combobox.evaluate((node: ComboboxField, value) => (node.value = value), empty.value));
                await expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
                await expectOptionToBeSelected(page, { value: userValue, label: testOptions[userValue] }, false);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                expect(await combobox.evaluate((node: ComboboxField) => node.reportValidity())).toBe(false);
              });
            });

            createFilterTypeDescribeBlocks(["unclearable", "clearable"], "both", (filtertype) => {
              it("Rejects values that are not found in the available `option`s", async ({ page }) => {
                /* ---------- Setup ---------- */
                const initialValue = testOptions[0];
                await renderComponent(page, { valueis: filtertype, initialValue });
                await expectOptionToBeSelected(page, { label: initialValue });

                // Associate Combobox with a `form`
                const name = "my-combobox";
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name, association: "explicit" });

                const form = page.getByRole("form");
                await expect(form).toHaveJSProperty(`elements.${name}.name`, name);

                /* ---------- Assertions ---------- */
                // Invalid values are rejected
                const invalidValue = String(Math.random());
                await combobox.evaluate((node: ComboboxField, value) => (node.value = value), invalidValue);

                await expect(combobox).not.toHaveJSProperty("value", invalidValue);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
                  invalidValue,
                );

                await expectOptionToBeSelected(page, { label: initialValue });
                await expect(combobox).toHaveJSProperty("value", initialValue);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(initialValue);

                // Valid values are accepted
                const goodValue = getRandomOption(testOptions.slice(1));
                await combobox.evaluate((node: ComboboxField, value) => (node.value = value), goodValue);

                await expectOptionToBeSelected(page, { label: initialValue }, false);
                await expect(combobox).not.toHaveJSProperty("value", initialValue);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
                  initialValue,
                );

                await expectOptionToBeSelected(page, { label: goodValue });
                await expect(combobox).toHaveJSProperty("value", goodValue);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(goodValue);
              });
            });

            createFilterTypeDescribeBlocks(["anyvalue", "clearable"], "filter-only", (filtertype) => {
              it("Accepts an empty string even if no matching option exists", async ({ page }) => {
                /* ---------- Setup ---------- */
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs(filtertype)} required>
                      <option value="1" selected>One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                `;

                const initialValue = { label: "One", value: "1" } as const;
                await expectOptionToBeSelected(page, initialValue);

                // Associate Combobox with a `form`
                const name = "my-combobox";
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name, association: "explicit" });

                const form = page.getByRole("form");
                await expect(form).toHaveJSProperty(`elements.${name}.name`, name);

                /* ---------- Assertions ---------- */
                await combobox.evaluate((node: ComboboxField) => (node.value = ""));

                await expectOptionToBeSelected(page, initialValue, false);
                await expect(combobox).not.toHaveJSProperty("value", initialValue.value);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
                  initialValue.value,
                );

                await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                await expect(combobox).toHaveJSProperty("value", "");
                await expect(combobox).toHaveText("");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
              });
            });

            createFilterTypeDescribeBlocks(["anyvalue"], "filter-only", (filtertype) => {
              it("Accepts any value, even if no matching option exists", async ({ page }) => {
                /* ---------- Setup ---------- */
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs(filtertype)} required>
                      <option value="1" selected>One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                `;

                const initialValue = { label: "One", value: "1" } as const satisfies OptionInfo;
                await expectOptionToBeSelected(page, initialValue);

                // Associate Combobox with a `form`
                const name = "my-combobox";
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name, association: "explicit" });

                const form = page.getByRole("form");
                await expect(form).toHaveJSProperty(`elements.${name}.name`, name);

                /* ---------- Assertions ---------- */
                const newValue = String(Math.random());
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), newValue);

                await expectOptionToBeSelected(page, initialValue, false);
                await expect(combobox).not.toHaveJSProperty("value", initialValue.value);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
                  initialValue.value,
                );

                await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                await expect(combobox).toHaveJSProperty("value", newValue);
                await expect(combobox).toHaveText(newValue);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(newValue);
              });
            });

            createFilterTypeDescribeBlocks(["unclearable", "clearable"], "both", (filtertype) => {
              it("Is `null` when the `combobox` is uninitialized (e.g., if there are no `option`s)", async ({
                page,
              }) => {
                // Setup
                const name = "my-combobox";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(filtertype)} required></select>
                    </select-enhancer>
                  </form>
                `;

                // Assertions
                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");

                expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe(null);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

                // NOTE: `combobox` should be valid because it isn't the user's fault that the field isn't initialized
                await expect(combobox).toHaveAttribute("required");
                await expect(combobox).toHaveJSProperty("required", true);
                expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
              });
            });

            createFilterTypeDescribeBlocks(["clearable"], "filter-only", (filtertype) => {
              it("Rejects empty strings and remains `null` if the `combobox` is uninitialized", async ({ page }) => {
                /* ---------- Setup ---------- */
                const name = "my-combobox";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(filtertype)} required></select>
                    </select-enhancer>
                  </form>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", null);

                const form = page.getByRole("form");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

                /* ---------- Assertions ---------- */
                // Manually emptying the value
                await combobox.evaluate((node: ComboboxField) => (node.value = ""));

                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", null);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

                // Attempting to empty the value by typing
                await combobox.pressSequentially(String(Math.random()));
                await combobox.press("ControlOrMeta+A");
                await combobox.press("Delete");

                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", null);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

                // Attempting to empty the value by using `forceEmptyValue()`
                await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue()).catch(() => {});

                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", null);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

                // Attempting to empty the value with a field reset
                await combobox.evaluate((node: ComboboxField) => node.formResetCallback());

                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveJSProperty("value", null);
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);
              });
            });

            createFilterTypeDescribeBlocks(["anyvalue"], "filter-only", (filtertype) => {
              it("Is an empty string when the `combobox` is uninitialized (e.g., if there are no `option`s)", async ({
                page,
              }) => {
                // Setup
                const name = "my-combobox";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(filtertype)} required></select>
                    </select-enhancer>
                  </form>
                `;

                // Assertions
                const form = page.getByRole("form");
                const combobox = page.getByRole("combobox");

                expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe("");
                expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                // NOTE: `combobox` should be INVALID because the user can still alter the field's value
                await expect(combobox).toHaveAttribute("required");
                await expect(combobox).toHaveJSProperty("required", true);
                expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
              });
            });

            if (mode === "Filterable") {
              it("Does not displace the User's cursor unnecessarily", async ({ page }) => {
                /* ---------- Setup ---------- */
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      <option value="1" selected>One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                `;

                await expectOptionToBeSelected(page, { label: "One", value: "1" });

                /* ---------- Assertions ---------- */
                // Cursor location is preserved if value update doesn't cause a text change
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially("Three");
                await combobox.press("ControlOrMeta+A");
                await combobox.press("ArrowLeft");
                await combobox.press("ArrowRight+ArrowRight");
                await expect(combobox).toHaveTextSelection({ anchor: 2, focus: 2 });

                await combobox.evaluate((node: ComboboxField) => (node.value = "3"));
                await expectOptionToBeSelected(page, { label: "Three", value: "3" });
                await expect(combobox).toHaveTextSelection({ anchor: 2, focus: 2 });

                // Cursor location is lost if value update causes a text change
                await combobox.evaluate((node: ComboboxField) => (node.value = "2"));
                await expectOptionToBeSelected(page, { label: "Three", value: "3" }, false);
                await expectOptionToBeSelected(page, { label: "Two", value: "2" });
                await expect(combobox).not.toHaveTextSelection({ anchor: 2, focus: 2 });
              });

              it("Deletes the `autoselectableOption` when altering the `combobox`'s text content", async ({ page }) => {
                /* ---------- Setup ---------- */
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      <option value="1" selected>One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                `;

                await expectOptionToBeSelected(page, { label: "One", value: "1" });

                /* ---------- Assertions ---------- */
                // Changing the value to the `autoselectableOption` (i.e., the current text content)
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially("Three");
                await expect(combobox).toHaveJSProperty("autoselectableOption.value", "3");
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Three");
                await expect(combobox).not.toHaveJSProperty("value", "3");
                await expect(page.getByRole("option", { name: "Three", selected: false })).toBeVisible();

                await combobox.evaluate((node: ComboboxField) => (node.value = "3"));
                await expectOptionToBeSelected(page, { label: "Three", value: "3" });
                await expect(combobox).toHaveJSProperty("autoselectableOption.value", "3");
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", "Three");

                // Changing the value to something else that causes the text content to change
                await combobox.evaluate((node: ComboboxField) => (node.value = "2"));
                await expectOptionToBeSelected(page, { label: "Three", value: "3" }, false);
                await expectOptionToBeSelected(page, { label: "Two", value: "2" });
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);
              });
            }
          });

          it.describe("listbox (Property)", () => {
            it("Exposes the `listbox` that the `combobox` controls (for convenience)", async ({ page }) => {
              await renderComponent(page);
              const combobox = page.getByRole("combobox");
              const listboxId = await combobox.evaluate((n: ComboboxField) => n.listbox.id);
              const ariaControls = await combobox.evaluate((n: SelectEnhancer) => n.getAttribute("aria-controls"));

              expect(ariaControls).toBe(listboxId);
              expect(await combobox.evaluate((n: ComboboxField) => n.listbox instanceof HTMLElement)).toBe(true);
              expect(await combobox.evaluate((n: ComboboxField) => n.listbox.getAttribute("role"))).toBe("listbox");
            });
          });

          it.describe("text (Property)", () => {
            it("Exposes the `combobox`'s singular Text Node", async ({ page }) => {
              const initialValue = testOptions[0];
              await renderComponent(page, initialValue);

              /* Verify that `ComboboxField.text` reflects the field's current text content */
              // On Mount
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveText(initialValue);
              await expect(combobox).toHaveJSProperty("text.data", initialValue);

              // With value changes
              await combobox.press("End+Enter");
              await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string });
              await expect(combobox).toHaveText(testOptions.at(-1) as string);
              await expect(combobox).toHaveJSProperty("text.data", testOptions.at(-1));

              // With text node modifications
              const badText = String(Math.random());
              await combobox.evaluate((node: ComboboxField, string) => (node.text.data = string), badText);
              await expect(combobox).toHaveText(badText);
              await expect(combobox).toHaveJSProperty("text.data", badText);

              /* Verify that the `ComboboxField` only allows its singular Text Node as a child */
              // Adding Children doesn't work
              await combobox.evaluate((node) => node.prepend(document.createElement("div")));
              await expect(combobox).toHaveJSProperty("childNodes.length", 1);
              expect(await combobox.evaluate((node) => node.firstChild === node.lastChild)).toBe(true);
              expect(await combobox.evaluate((node: ComboboxField) => node.lastChild === node.text)).toBe(true);

              await combobox.evaluate((node) => node.append(document.createTextNode("oof")));
              await expect(combobox).toHaveJSProperty("childNodes.length", 1);
              expect(await combobox.evaluate((node) => node.firstChild === node.lastChild)).toBe(true);
              expect(await combobox.evaluate((node: ComboboxField) => node.lastChild === node.text)).toBe(true);

              // Replacing the Node doesn't work
              await combobox.evaluate((node) => node.replaceChildren(document.createElement("span")));
              await expect(combobox).toHaveJSProperty("childNodes.length", 1);
              expect(await combobox.evaluate((node) => node.firstChild === node.lastChild)).toBe(true);
              expect(await combobox.evaluate((node: ComboboxField) => node.lastChild === node.text)).toBe(true);

              // Removing the Text Node doesn't work
              await combobox.evaluate((node: ComboboxField) => node.text.remove());
              await expect(combobox).toHaveJSProperty("childNodes.length", 1);
              expect(await combobox.evaluate((node) => node.firstChild === node.lastChild)).toBe(true);
              expect(await combobox.evaluate((node: ComboboxField) => node.firstChild === node.text)).toBe(true);

              // Using `Element.textContent` doesn't work
              const otherText = String(Math.random());
              await expect(combobox).not.toHaveText(otherText);

              await combobox.evaluate((node: ComboboxField, t) => (node.textContent = t), otherText);
              await expect(combobox).not.toHaveText(otherText);
              await expect(combobox).toHaveText(badText);

              // The Text Node does not get removed when the filter is redundantly emptied
              await combobox.evaluate((node: ComboboxField) => (node.filter = true));
              await combobox.press("ControlOrMeta+A");
              await combobox.press("Backspace+Backspace");
              await expect(combobox).toHaveJSProperty("childNodes.length", 1);
              expect(await combobox.evaluate((node) => node.firstChild === node.lastChild)).toBe(true);
              expect(await combobox.evaluate((node: ComboboxField) => node.firstChild === node.text)).toBe(true);

              await expect(combobox).toHaveText("");
              await expect(combobox).toHaveJSProperty("text.data", "");

              const second = testOptions[1];
              await combobox.pressSequentially(second);
              await expect(combobox).toHaveText(second);
              await expect(combobox).toHaveJSProperty("text.data", second);
            });
          });

          it.describe("filter (Property)", () => {
            it("Exposes the underlying `filter` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select filter>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` matches initial `attribute`
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("filter", true);

              // `attribute` responds to `property` updates
              await combobox.evaluate((node: ComboboxField) => (node.filter = false));
              await expect(combobox).not.toHaveAttribute("filter");

              await combobox.evaluate((node: ComboboxField) => (node.filter = true));
              await expect(combobox).toHaveAttribute("filter", "");

              // `property` also responds to `attribute` updates
              await combobox.evaluate((node) => node.removeAttribute("filter"));
              await expect(combobox).toHaveJSProperty("filter", false);
            });

            it("Toggles the Text Editing / Option Filtering functionality of the `combobox`", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              await expectOptionToBeSelected(page, { label: testOptions[0] });

              /* ---------- Assertions ---------- */
              // By default, the editing/filtering functionality is disabled
              const second = testOptions[1];
              const combobox = page.getByRole("combobox");

              await combobox.press(second.charAt(0));
              await expect(combobox).not.toHaveText(second.charAt(0));
              await expect(combobox).toHaveText(testOptions[0]);

              await expect(page.getByRole("option")).toHaveCount(testOptions.length);
              await expectOptionToBeActive(page, { label: second });

              // When `filter` mode is turned on, editing/filtering is enabled
              await combobox.evaluate((node: ComboboxField) => (node.filter = true));

              await combobox.press(second.charAt(0));
              await expect(combobox).toHaveText(second.charAt(0));
              await expect(combobox).not.toHaveText(testOptions[0]);

              await expect(page.getByRole("option")).not.toHaveCount(testOptions.length);
              await expect(page.getByRole("option")).toHaveCount(3);
              await expectOptionToBeActive(page, { label: second });

              // When `filter` mode is turned off, these features are disabled again
              await combobox.evaluate((node: ComboboxField) => (node.filter = false));
              await expect(combobox).toHaveText(testOptions[0]);
              await expectOptionToBeSelected(page, { label: testOptions[0] });

              await combobox.press(second.charAt(0));
              await expect(combobox).not.toHaveText(second.charAt(0));
              await expect(combobox).toHaveText(testOptions[0]);

              await expect(page.getByRole("option")).toHaveCount(testOptions.length);
              await expectOptionToBeActive(page, { label: second });
            });
          });

          if (mode === "Filterable") {
            it.describe("filterMethod (Property)", () => {
              it("Exposes the underlying `filtermethod` attribute", async ({ page }) => {
                /* ---------- Setup ---------- */
                const initialMethod = "startsWith" as const satisfies ComboboxField["filterMethod"];
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")} filtermethod="${initialMethod}">
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                /* ---------- Assertions ---------- */
                // `property` matches initial `attribute`
                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("filterMethod", initialMethod);

                // `attribute` responds to `property` updates
                const newProp = "includes" as const satisfies ComboboxField["filterMethod"];
                await combobox.evaluate((node: ComboboxField, prop) => (node.filterMethod = prop), newProp);
                await expect(combobox).toHaveAttribute("filtermethod", newProp);

                // `property` responds to `attribute` updates
                const newAttr = "startsWith" satisfies ComboboxField["filterMethod"];
                await combobox.evaluate((n: ComboboxField, attr) => n.setAttribute("filtermethod", attr), newAttr);
                await expect(combobox).toHaveJSProperty("filterMethod", newAttr);
              });

              it("Defaults to `startsWith` when the underlying attribute is omitted or invalid", async ({ page }) => {
                await page.goto(url);
                for (const attr of [null, String(Math.random())] as const) {
                  await it.step(`Mounted with ${attr ? "invalid" : "omitted"} attribute`, async () => {
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select ${getFilterAttrs("unclearable")} ${attr ? `filtermethod="${attr}"` : ""}>
                          ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    const combobox = page.getByRole("combobox");
                    if (attr) await expect(combobox).toHaveAttribute("filtermethod", attr);
                    else await expect(combobox).not.toHaveAttribute("filtermethod");
                    await expect(combobox).toHaveJSProperty("filterMethod", "startsWith");

                    // Imperatively set to another invalid value afterwards
                    await combobox.evaluate(
                      (node: ComboboxField) => (node.filterMethod = null as unknown as ComboboxField["filterMethod"]),
                    );
                    await expect(combobox).toHaveAttribute("filtermethod", String(null));
                    await expect(combobox).toHaveJSProperty("filterMethod", "startsWith");
                  });
                }
              });

              it("Determines the method used for filtering `option`s", async ({ page }) => {
                /* ---------- Setup ---------- */
                // Useful constants
                const second = testOptions[1];
                const seventh = testOptions[6];
                const eigth = testOptions[7];
                const tenth = testOptions[9];
                const E = eigth.charAt(0) as "E";

                // Render component
                const initialMethod = "startsWith" satisfies ComboboxField["filterMethod"];
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")} filtermethod="${initialMethod}">
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                /* ---------- Assertions ---------- */
                // `String.prototype.startsWith` is used when the `filterMethod` is `startsWith`
                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("filterMethod", initialMethod);

                await combobox.press(E);
                const options = page.getByRole("option");
                await expect(options).toHaveCount(1);
                await expect(options).toHaveAccessibleName(eigth);

                // `String.prototype.includes` is used when the `filterMethod` is `includes`
                await combobox.evaluate((node: ComboboxField) => (node.filterMethod = "includes"));
                await combobox.press("ControlOrMeta+A");
                await combobox.press(E);

                await expect(options).toHaveCount(4);
                await expect(options.first()).toHaveAccessibleName(second);
                await expect(options.nth(1)).toHaveAccessibleName(seventh);
                await expect(options.nth(2)).toHaveAccessibleName(eigth);
                await expect(options.last()).toHaveAccessibleName(tenth);

                // `String.prototype.startsWith` is used by default when no valid configuration is supplied
                await combobox.evaluate((node) => node.removeAttribute("filtermethod"));
                await combobox.press("ControlOrMeta+A");
                await combobox.press(E);

                await expect(options).toHaveCount(1);
                await expect(options).toHaveAccessibleName(eigth);
              });
            });
          }

          it.describe("valueIs (Property)", () => {
            it("Controls the underlying `valueis` attribute", async ({ page }) => {
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${mode === "Filterable" ? "filter" : ""}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              const validValues = ["anyvalue", "clearable", "unclearable"] as const satisfies ValueIs[];

              for (const value of [null, ...validValues, "Random Garbage"] as const) {
                await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state as ValueIs), value);
                await expect(combobox).toHaveAttribute("valueis", String(value));
              }
            });

            if (mode === "Regular") {
              it(`Ignores the \`valueis\` attribute and always returns \`${"unclearable" satisfies ValueIs}\``, async ({
                page,
              }) => {
                // Reused Locators/variables
                const combobox = page.getByRole("combobox");
                const validValues = ["anyvalue", "clearable", "unclearable"] as const satisfies ValueIs[];

                await page.goto(url);
                for (const attr of [null, ...validValues, "Random Garbage"] as const) {
                  await it.step(`Mounted ${attr ? `with "${attr}"` : "without attribute"}`, async () => {
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select ${attr ? `valueis="${attr}"` : ""}>
                          ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    if (attr) await expect(combobox).toHaveAttribute("valueis", attr);
                    else await expect(combobox).not.toHaveAttribute("valueis");

                    await expect(combobox).not.toHaveAttribute("filter");
                    await expect(combobox).toHaveJSProperty("isContentEditable", false);
                    await expect(combobox).toHaveJSProperty("valueIs", "unclearable" satisfies ValueIs);
                  });

                  await it.step(`Imperatively set to "${attr}"`, async () => {
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select>
                          ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state as ValueIs), attr);
                    await expect(combobox).toHaveAttribute("valueis", String(attr));

                    await expect(combobox).not.toHaveAttribute("filter");
                    await expect(combobox).toHaveJSProperty("isContentEditable", false);
                    await expect(combobox).toHaveJSProperty("valueIs", "unclearable" satisfies ValueIs);
                  });
                }
              });

              return;
            }

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Helpful for tracking code sections
            if (mode === "Filterable") {
              /** A string literal used for writing `describe` blocks or branching logic within a test */
              const nonFilterMode = "non-filter mode";

              it("Exposes the underlying `valueis` attribute", async ({ page }) => {
                /* ---------- Setup ---------- */
                const initialState = "unclearable" as const satisfies ValueIs;
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select filter valueis="${initialState}">
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                /* ---------- Assertions ---------- */
                // `property` matches initial `attribute`
                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("valueIs", initialState);

                // `attribute` responds to `property` updates
                const newProp = "clearable" as const satisfies ValueIs;
                await combobox.evaluate((node: ComboboxField, prop) => (node.valueIs = prop), newProp);
                await expect(combobox).toHaveAttribute("valueis", newProp);

                // `property` responds to `attribute` updates
                const newAttr = "anyvalue" satisfies ValueIs;
                await combobox.evaluate((node: ComboboxField, attr) => node.setAttribute("valueis", attr), newAttr);
                await expect(combobox).toHaveJSProperty("valueIs", newAttr);
              });

              it("Defaults to `clearable` when the underlying attribute is omitted or invalid", async ({ page }) => {
                await page.goto(url);
                for (const attr of [null, String(Math.random())] as const) {
                  await it.step(`Mounted with ${attr ? "invalid" : "omitted"} attribute`, async () => {
                    await renderHTMLToPage(page)`
                      <select-enhancer>
                        <select filter ${attr ? `valueis="${attr}"` : ""}>
                          ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    `;

                    const combobox = page.getByRole("combobox");

                    if (attr) await expect(combobox).toHaveAttribute("valueis", attr);
                    else await expect(combobox).not.toHaveAttribute("valueis");

                    await expect(combobox).toHaveJSProperty("valueIs", "clearable");

                    // Imperatively set to another invalid value afterwards
                    await combobox.evaluate((node: ComboboxField) => (node.valueIs = null as unknown as ValueIs));
                    await expect(combobox).toHaveAttribute("valueis", String(null));
                    await expect(combobox).toHaveJSProperty("valueIs", "clearable");
                  });
                }
              });

              /**
               * Executes a test which verifies that, when transitioning the `valueis` attribute
               * from `options.from` to `options.to`, the value of the `combobox` will be _coerced_
               * to an empty string (`""`) _if the filter was empty_.
               */
              function testEmptyFilterToEmptyValueCoercion<
                From extends ValueIs,
                To extends Exclude<Extract<ValueIs, "anyvalue" | "clearable">, From>,
              >(options: { from: From; to: To }) {
                it("Coerces the value to an empty string if the filter is empty", async ({ page }) => {
                  /* ---------- Setup ---------- */
                  const name = "my-combobox";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <form aria-label="Test Form">
                      <select-enhancer>
                        <select name="${name}" ${getFilterAttrs(options.from)}>
                          <option value="">Select Something</option>
                          ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    </form>
                  `;

                  const form = page.getByRole("form");
                  const combobox = page.getByRole("combobox");

                  const initialOption = { label: testOptions[0], value: "0" };
                  await expectOptionToBeSelected(page, initialOption);
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                  /* ---------- Assertions ---------- */
                  // Clear the `combobox` filter
                  await combobox.press("ControlOrMeta+A");
                  await combobox.press("Backspace");

                  if (options.from === "unclearable") {
                    await expect(combobox).toHaveJSProperty("value", initialOption.value);
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                    await expect(
                      page.getByRole("option", { name: initialOption.label, selected: true, includeHidden: true }),
                    ).toBeAttached();
                  } else {
                    await expect(combobox).toHaveText("");
                    await expect(combobox).toHaveJSProperty("value", "");
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                    await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                  }

                  // Update the `valueis` state
                  await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);

                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveJSProperty("value", "");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                  await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                });
              }

              /**
               * Executes a test which verifies that, when transitioning the `valueis` attribute (or combobox state)
               * from `options.from` to `options.to`, the _`option`_ whose `value` is an empty string (`""`) &mdash;
               * if one exists &mdash; will be auto-selected if the `combobox`'s value was originally an empty string.
               */
              function testEmptyValueToOptionConversion(options: {
                from: Extract<ValueIs, "anyvalue" | "clearable">;
                to: Extract<ValueIs, "unclearable"> | typeof nonFilterMode;
              }) {
                it("Converts empty-string values to empty-value `option`s when possible", async ({ page }) => {
                  /* ---------- Setup ---------- */
                  const name = "my-combobox";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <form aria-label="Test Form">
                      <select-enhancer>
                        <select name="${name}" ${getFilterAttrs(options.from)}>
                          <option value="">Select Something</option>
                          ${testOptions.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    </form>
                  `;

                  const form = page.getByRole("form");
                  const combobox = page.getByRole("combobox");

                  /* ---------- Assertions ---------- */
                  // NOTE: This is redundant because the `combobox` value and filter should already be empty on mount.
                  // However, this code caught a bug that Safari has for `[contenteditable]` elements, so we're keeping it.
                  await combobox.press("ControlOrMeta+A");
                  await combobox.press("Backspace");

                  // Verify that the `combobox` value is empty.
                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveJSProperty("value", "");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                  await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);

                  // Change the component's `valueis`/`filter` state appropriately
                  if (options.to !== nonFilterMode) {
                    await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);
                  } else {
                    await combobox.evaluate((node: ComboboxField) => node.removeAttribute("filter"));
                  }

                  await expectOptionToBeSelected(page, { label: "Select Something", value: "" });
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
                });
              }

              /**
               * Executes a test which verifies that, when transitioning the `valueis` attribute (or combobox state)
               * from `options.from` to `options.to`, the value of the `combobox` will be _reset_
               * if an `option` corresponding to the current `combobox` value cannot be found.
               */
              function testComboboxValueResets(options: {
                from: Extract<ValueIs, "anyvalue" | "clearable">;
                to: Extract<ValueIs, "clearable" | "unclearable"> | typeof nonFilterMode;
              }) {
                it("Resets the value if no `option` matching the current value is found", async ({ page }) => {
                  /* ---------- Setup ---------- */
                  const name = "my-combobox";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <form aria-label="Test Form">
                      <select-enhancer>
                        <select name="${name}" ${getFilterAttrs(options.from)}>
                          ${testOptions.map((o, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    </form>
                  `;

                  const form = page.getByRole("form");
                  const combobox = page.getByRole("combobox");
                  const getResetCount = observeResetCount(combobox);

                  /* ---------- Assertions ---------- */
                  if (options.from === "anyvalue") {
                    // Enter a value into the `combobox` that has no corresponding `option`
                    const subtext = testOptions[1].slice(0, -2);
                    await combobox.pressSequentially(subtext);

                    await expect(combobox).toHaveJSProperty("value", subtext);
                    await expect(combobox).toHaveJSProperty("autoselectableOption", null);
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(subtext);
                    await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);

                    // Change the component's `valueis`/`filter` state appropriately
                    expect(await getResetCount()).toBe(0);
                    if (options.to !== nonFilterMode) {
                      await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);
                    } else {
                      await combobox.evaluate((node: ComboboxField) => node.removeAttribute("filter"));
                    }
                    expect(await getResetCount()).toBe(1);

                    await expectOptionToBeSelected(page, { label: testOptions[1], value: "1" });
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("1");
                  }

                  // Execute another test that transitions from an empty value
                  if (options.to === "clearable") return;
                  await combobox.evaluate((node: ComboboxField) => (node.filter = true));
                  await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.from);
                  await expect(combobox).not.toHaveJSProperty("value", "");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe("");

                  // Empty the current value
                  await combobox.press("ControlOrMeta+A");
                  await combobox.press("Backspace");

                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveJSProperty("value", "");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");

                  // Change the component's `valueis`/`filter` state appropriately
                  const previousResets = options.from === "anyvalue" ? 1 : 0;
                  expect(await getResetCount()).toBe(previousResets);
                  if (options.to !== nonFilterMode) {
                    await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);
                  } else {
                    await combobox.evaluate((node: ComboboxField) => node.removeAttribute("filter"));
                  }
                  expect(await getResetCount()).toBe(previousResets + 1);
                  await expectOptionToBeSelected(page, { label: testOptions[1], value: "1" });
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("1");
                });
              }

              it.describe(`Transitions from \`${"anyvalue" satisfies ValueIs}\``, () => {
                /**
                 * Executes a test which verifies that, when transitioning the `valueis` attribute (or combobox state)
                 * from `anyvalue` to `options.to`, the `combobox` will auto-select the `autoselectableOption`
                 * (if one exists).
                 */
                function testPreservationOfAutoselectableValues(options: {
                  to: Extract<ValueIs, "clearable" | "unclearable"> | "non-filter mode";
                }): void {
                  it("Preserves values that correspond to the current `autoselectableOption`", async ({ page }) => {
                    /* ---------- Setup ---------- */
                    const name = "my-combobox";
                    await page.goto(url);
                    await renderHTMLToPage(page)`
                      <form aria-label="Test Form">
                        <select-enhancer>
                          <select name="${name}" ${getFilterAttrs("anyvalue")}>
                            ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                          </select>
                        </select-enhancer>
                      </form>
                    `;

                    const form = page.getByRole("form");
                    const combobox = page.getByRole("combobox");

                    const initialOption = { label: testOptions[0], value: "0" };
                    await expectOptionToBeSelected(page, initialOption);
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                    /* ---------- Assertions ---------- */
                    // Change the `value` to something with a corresponding `autoselectableOption`
                    const newOptionLabel = testOptions[7];
                    await combobox.pressSequentially(newOptionLabel);
                    await expect(combobox).toHaveJSProperty("value", newOptionLabel);
                    await expect(combobox).toHaveJSProperty("autoselectableOption.value", "7");
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
                      newOptionLabel,
                    );

                    await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);

                    // Move the cursor backwards
                    await expect(combobox).toHaveTextSelection("end");
                    await combobox.press("ArrowLeft+ArrowLeft");
                    await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });

                    // Change the component's `valueis`/`filter` state appropriately
                    if (options.to !== "non-filter mode") {
                      await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);
                    } else {
                      await combobox.evaluate((node: ComboboxField) => node.removeAttribute("filter"));
                    }

                    // Value AND filter/cursor should be correct. (NOTE: Cursor is irrelevant in non-filter mode.)
                    expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("7");
                    await expectOptionToBeSelected(page, { label: newOptionLabel, value: "7" });
                    await expect(combobox).not.toHaveJSProperty("value", newOptionLabel);
                    await expectOptionToBeSelected(page, initialOption, false);

                    await expect(combobox).toHaveText(newOptionLabel);
                    await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });
                  });
                }

                it.describe(`to \`${"clearable" satisfies ValueIs}\``, () => {
                  testPreservationOfAutoselectableValues({ to: "clearable" });
                  testEmptyFilterToEmptyValueCoercion({ from: "anyvalue", to: "clearable" });
                  testComboboxValueResets({ from: "anyvalue", to: "clearable" });
                });

                for (const to of ["unclearable" satisfies ValueIs, nonFilterMode] as const) {
                  it.describe(`to ${to === "unclearable" ? `\`${to}\`` : to}`, () => {
                    testPreservationOfAutoselectableValues({ to });
                    testEmptyValueToOptionConversion({ from: "anyvalue", to });
                    testComboboxValueResets({ from: "anyvalue", to });
                  });
                }
              });

              for (const from of ["clearable", "unclearable"] as const satisfies ValueIs[]) {
                it.describe(`Transitions from \`${from}\``, () => {
                  it.describe(`to \`${"anyvalue" satisfies ValueIs}\``, () => {
                    testEmptyFilterToEmptyValueCoercion({ from, to: "anyvalue" });

                    it("Preserves the currently-selected `option` if the `combobox` is collapsed", async ({ page }) => {
                      /* ---------- Setup ---------- */
                      const name = "my-combobox";
                      const optionsMarkup = testOptions
                        .map((o, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${o}</option>`)
                        .join("");

                      await page.goto(url);
                      await renderHTMLToPage(page)`
                        <form aria-label="Test Form">
                          <select-enhancer>
                            <select name="${name}" ${getFilterAttrs(from)}>
                              ${optionsMarkup}
                            </select>
                          </select-enhancer>
                        </form>
                      `;

                      const form = page.getByRole("form");
                      const combobox = page.getByRole("combobox");

                      await expectComboboxToBeClosed(page);
                      const initialOption = { label: testOptions[1], value: "1" };
                      await expectOptionToBeSelected(page, initialOption);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("1");

                      /* ---------- Assertions ---------- */
                      await combobox.evaluate((node: ComboboxField) => (node.valueIs = "anyvalue"));
                      await expectComboboxToBeClosed(page);
                      await expectOptionToBeSelected(page, initialOption);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("1");
                    });

                    it("Selects the `autoselectableOption` if one exists", async ({ page }) => {
                      /* ---------- Setup ---------- */
                      const name = "my-combobox";
                      await page.goto(url);
                      await renderHTMLToPage(page)`
                        <form aria-label="Test Form">
                          <select-enhancer>
                            <select name="${name}" ${getFilterAttrs(from)}>
                              ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                            </select>
                          </select-enhancer>
                        </form>
                      `;

                      const form = page.getByRole("form");
                      const combobox = page.getByRole("combobox");

                      await expectComboboxToBeClosed(page);
                      const initialOption = { label: testOptions[0], value: "0" };
                      await expectOptionToBeSelected(page, initialOption);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                      /* ---------- Assertions ---------- */
                      // Change the filter to something with a corresponding `autoselectableOption`
                      const newOptionLabel = testOptions[7];
                      await combobox.pressSequentially(newOptionLabel);
                      await expect(combobox).toHaveJSProperty("autoselectableOption.value", "7");

                      await expect(combobox).not.toHaveJSProperty("value", newOptionLabel);
                      await expect(combobox).toHaveJSProperty("value", initialOption.value);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                      await expect(
                        page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                      ).toBeAttached();

                      // Move the cursor backwards
                      await expect(combobox).toHaveTextSelection("end");
                      await combobox.press("ArrowLeft+ArrowLeft");
                      await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });

                      // Change `valueis` to `anyvalue`
                      await combobox.evaluate((node: ComboboxField) => (node.valueIs = "anyvalue"));

                      // Value AND filter/cursor should be correct
                      await expectOptionToBeSelected(page, initialOption, false);
                      await expectOptionToBeSelected(page, { label: testOptions[7], value: "7" });
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("7");

                      await expect(combobox).toHaveText(newOptionLabel);
                      await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });
                    });

                    it("Converts the current filter to a value if no `autoselectableOption` exists", async ({
                      page,
                    }) => {
                      /* ---------- Setup ---------- */
                      const name = "my-combobox";
                      await page.goto(url);
                      await renderHTMLToPage(page)`
                        <form aria-label="Test Form">
                          <select-enhancer>
                            <select name="${name}" ${getFilterAttrs(from)}>
                              ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                            </select>
                          </select-enhancer>
                        </form>
                      `;

                      const form = page.getByRole("form");
                      const combobox = page.getByRole("combobox");

                      await expectComboboxToBeClosed(page);
                      const initialOption = { label: testOptions[0], value: "0" } as const;
                      await expectOptionToBeSelected(page, initialOption);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                      /* ---------- Assertions ---------- */
                      // Change the filter to something with no corresponding `option`
                      const subtext = testOptions[1].slice(0, -2);
                      await combobox.pressSequentially(subtext);
                      await expect(combobox).toHaveJSProperty("autoselectableOption", null);

                      await expect(combobox).not.toHaveJSProperty("value", subtext);
                      await expect(combobox).toHaveJSProperty("value", initialOption.value);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                      await expect(
                        page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                      ).toBeAttached();

                      // Move the cursor backwards
                      await expect(combobox).toHaveTextSelection("end");
                      await combobox.press("ArrowLeft+ArrowLeft");
                      await expect(combobox).toHaveTextSelection({ anchor: 2, focus: 2 });

                      // Change `valueis` to `anyvalue`
                      await combobox.evaluate((node: ComboboxField) => (node.valueIs = "anyvalue"));

                      // Value AND filter/cursor should be correct
                      await expect(combobox).toHaveJSProperty("value", subtext);
                      await expect(page.getByRole("option", { selected: true, includeHidden: true })).toHaveCount(0);
                      expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
                        subtext,
                      );

                      await expect(combobox).toHaveText(subtext);
                      await expect(combobox).toHaveTextSelection({ anchor: 2, focus: 2 });
                    });
                  });
                });
              }

              /**
               * Executes a test which verifies that, when transitioning the `valueis` attribute
               * from `clearable` to `unclearable` (or vice-versa), the `combobox` will preserve
               * the currently-selected `option` without disrupting the current filter or cursor.
               */
              function testOptionAndFilterPreservation<
                From extends Extract<ValueIs, "clearable" | "unclearable">,
                To extends Exclude<Extract<ValueIs, "clearable" | "unclearable">, From>,
              >(options: { from: From; to: To }) {
                it("Preserves the currently-selected `option` without disrupting the filter/cursor", async ({
                  page,
                }) => {
                  /* ---------- Setup ---------- */
                  const name = "my-combobox";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <form aria-label="Test Form">
                      <select-enhancer>
                        <select name="${name}" ${getFilterAttrs(options.from)}>
                          ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    </form>
                  `;

                  const form = page.getByRole("form");
                  const combobox = page.getByRole("combobox");

                  const initialOption = { label: testOptions[0], value: "0" };
                  await expectOptionToBeSelected(page, initialOption);
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                  /* ---------- Assertions ---------- */
                  // Enter a filter with an `autoselectableOption` different from the currently-selected `option`
                  const filter = testOptions[7];
                  await combobox.pressSequentially(filter);
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "7");

                  await expect(combobox).toHaveJSProperty("value", "0");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                  await expect(
                    page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                  ).toBeAttached();

                  // Move cursor backwards
                  await combobox.press("ArrowLeft+ArrowLeft");
                  await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });

                  // Change `valueis` attribute
                  await combobox.evaluate((node: ComboboxField, state) => (node.valueIs = state), options.to);

                  // Value AND Filter/Cursor should have been preserved
                  await expect(combobox).toHaveJSProperty("value", "0");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                  await expect(
                    page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                  ).toBeAttached();

                  await expect(combobox).toHaveText(filter);
                  await expect(combobox).toHaveTextSelection({ anchor: 3, focus: 3 });
                });
              }

              /**
               * Executes a test which verifies that, when transitioning the combobox state
               * from `options.from` to {@link nonFilterMode}, the `combobox` will preserve
               * the currently-selected `option` and update the `combobox`'s text to match that `option`'s label.
               */
              function testOptionOnlyPreservation(options: { from: Extract<ValueIs, "clearable" | "unclearable"> }) {
                it("Preserves the currently-selected `option` and updates the `combobox`'s text content", async ({
                  page,
                }) => {
                  /* ---------- Setup ---------- */
                  const name = "my-combobox";
                  await page.goto(url);
                  await renderHTMLToPage(page)`
                    <form aria-label="Test Form">
                      <select-enhancer>
                        <select name="${name}" ${getFilterAttrs(options.from)}>
                          ${testOptions.map((o, i) => `<option value="${i}" ${!i ? "selected" : ""}>${o}</option>`).join("")}
                        </select>
                      </select-enhancer>
                    </form>
                  `;

                  const form = page.getByRole("form");
                  const combobox = page.getByRole("combobox");

                  const initialOption = { label: testOptions[0], value: "0" };
                  await expectOptionToBeSelected(page, initialOption);
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");

                  /* ---------- Assertions ---------- */
                  // Enter a filter with an `autoselectableOption` different from the currently-selected `option`
                  const filter = testOptions[7];
                  await combobox.pressSequentially(filter);
                  await expect(combobox).toHaveJSProperty("autoselectableOption.value", "7");

                  await expect(combobox).toHaveJSProperty("value", "0");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                  await expect(
                    page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                  ).toBeAttached();

                  // Transition `combobox` out of `filter` mode
                  await combobox.evaluate((node: ComboboxField) => node.removeAttribute("filter"));

                  // Value should have been preserved AND text content should have been reset
                  await expect(combobox).toHaveJSProperty("value", "0");
                  expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("0");
                  await expect(
                    page.getByRole("option", { name: testOptions[0], selected: true, includeHidden: true }),
                  ).toBeAttached();

                  await expect(combobox).not.toHaveText(filter);
                  await expect(combobox).toHaveText(initialOption.label);
                });
              }

              it.describe(`Transitions from \`${"clearable" satisfies ValueIs}\``, () => {
                for (const to of ["unclearable" satisfies ValueIs, nonFilterMode] as const) {
                  it.describe(`to ${to === "unclearable" ? `\`${to}\`` : to}`, () => {
                    testEmptyValueToOptionConversion({ from: "clearable", to });
                    testComboboxValueResets({ from: "clearable", to });
                  });
                }

                it.describe(`to \`${"unclearable" satisfies ValueIs}\``, () => {
                  testOptionAndFilterPreservation({ from: "clearable", to: "unclearable" });
                });

                it.describe(`to non-filter mode`, () => {
                  testOptionOnlyPreservation({ from: "clearable" });
                });
              });

              it.describe(`Transitions from \`${"unclearable" satisfies ValueIs}\``, () => {
                it.describe(`to \`${"clearable" satisfies ValueIs}\``, () => {
                  testEmptyFilterToEmptyValueCoercion({ from: "unclearable", to: "clearable" });
                  testOptionAndFilterPreservation({ from: "unclearable", to: "clearable" });
                });

                it.describe(`to ${nonFilterMode}`, () => {
                  testOptionOnlyPreservation({ from: "unclearable" });
                });
              });

              it.describe(`Transitions from ${nonFilterMode}`, () => {
                for (const to of ["anyvalue", "clearable", "unclearable"] as const satisfies ValueIs[]) {
                  it.describe(`to \`${to}\``, () => {
                    it("Preserves the currently-selected `option` and highlights the `combobox` text (if focused)", async ({
                      page,
                    }) => {
                      for (const focused of [true, false]) {
                        await it.step(`Behavior when ${focused ? "" : "NOT "}focused`, async () => {
                          /* ---------- Setup ---------- */
                          const name = "my-combobox";
                          const optionsMarkup = testOptions
                            .map((o, i) => `<option value="${i}" ${i === 1 ? "selected" : ""}>${o}</option>`)
                            .join("");

                          await page.goto(url);
                          await renderHTMLToPage(page)`
                            <form aria-label="Test Form">
                              <select-enhancer>
                                <select name="${name}">
                                  ${optionsMarkup}
                                </select>
                              </select-enhancer>
                            </form>
                          `;

                          const form = page.getByRole("form");
                          const combobox = page.getByRole("combobox");
                          if (focused) await combobox.focus();

                          const initialOption = { label: testOptions[1], value: "1" };
                          await expectOptionToBeSelected(page, initialOption);
                          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
                            "1",
                          );

                          /* ---------- Assertions ---------- */
                          // NOTE: It is important to set the `valueis` attribute BEFORE the `filter` attribute
                          await combobox.evaluate((node: ComboboxField, t) => (node.valueIs = t), to);
                          await combobox.evaluate((node: ComboboxField) => (node.filter = true));

                          await expect(combobox).toHaveText(initialOption.label);
                          await expectOptionToBeSelected(page, initialOption);
                          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
                            "1",
                          );

                          if (focused) await expect(combobox).toHaveTextSelection("full");
                          else {
                            await expect(combobox).not.toBeFocused();
                            expect(await page.evaluate(() => document.getSelection()?.rangeCount)).toBe(0);
                          }
                        });
                      }
                    });
                  });
                }
              });
            }
          });

          if (mode === "Filterable") {
            it.describe("autoselectableOption (Property)", () => {
              it("Exposes the `option` that exactly corresponds to the User's current filter", async ({ page }) => {
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      ${testOptions.map((o, i) => `<option value=${i}>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveSyncedComboboxValue({ label: testOptions[0], value: "0" });

                // `combobox` starts without auto-selectable `option`
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);

                // Entering a filter that only matches part of an `option` doesn't make it auto-selectable
                const second = testOptions[1];
                await combobox.pressSequentially(second.slice(0, -1));
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);

                // A filter that exactly matches an `option` does make the `option` auto-selectable
                await combobox.press(second.at(-1) as string);
                await expect(combobox).toHaveJSProperty("autoselectableOption.value", "1");
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", second);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: second, value: "1" });

                // Updating the filter to something without a matching `option` deletes the auto-selectable, however
                const third = testOptions[2];
                await combobox.press(third[0]);
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);
              });

              it("Becomes `null` when the `combobox` is expanded", async ({ page }) => {
                const first = testOptions[0];
                await renderComponent(page, first);

                // Enter a filter with an `autoselectableOption`
                const third = testOptions[2];
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially(third);

                await expect(combobox).toHaveJSProperty("autoselectableOption.value", third);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", third);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: third });
                await expect(combobox).toHaveSyncedComboboxValue({ label: first });

                // Close the `combobox`
                await combobox.press("Escape");
                await expectComboboxToBeClosed(page);
                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });

                await expect(combobox).toHaveJSProperty("autoselectableOption.value", third);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", third);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: third });

                // Re-expand the `combobox`
                await combobox.press("Alt+ArrowDown");
                await expectOptionsToBeVisible(page);
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);
              });

              it("Becomes `null` when a value update changes the `combobox` text", async ({ page }) => {
                const first = testOptions[0];
                await renderComponent(page, first);

                // Enter a filter with an `autoselectableOption`
                const seventh = testOptions[6];
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially(seventh);

                await expect(combobox).toHaveJSProperty("autoselectableOption.value", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");
                await expect(combobox).toHaveSyncedComboboxValue({ label: first });
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: seventh });

                // Apply a value that doesn't alter the `combobox` filter
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), seventh);
                await expect(combobox).toHaveSyncedComboboxValue({ label: seventh }, { matchingLabel: true });
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: first });
                await expect(combobox).toHaveJSProperty("autoselectableOption.value", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                // Apply a value that is rejected by the `combobox`
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), String(Math.random()));
                await expect(combobox).toHaveSyncedComboboxValue({ label: seventh }, { matchingLabel: true });
                await expect(combobox).toHaveJSProperty("autoselectableOption.value", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                // Apply a value that disrupts the current filter
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), first);
                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: seventh });
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);
              });

              it("Becomes `null` if the `option` it points to is removed from the DOM", async ({ page }) => {
                const first = testOptions[0];
                await renderComponent(page, first);

                // Enter a filter with an `autoselectableOption`
                const seventh = testOptions[6];
                const combobox = page.getByRole("combobox");
                await combobox.pressSequentially(seventh);

                await expect(combobox).toHaveJSProperty("autoselectableOption.value", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.label", seventh);
                await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");
                await expect(combobox).toHaveSyncedComboboxValue({ label: first });
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: seventh });

                // Remove the `autoselectableOption`
                await combobox.evaluate((node: ComboboxField) => node.autoselectableOption?.remove());
                await expect(combobox).toHaveJSProperty("autoselectableOption", null);
              });
            });

            it.describe("noMatchesMessage (Property)", () => {
              const defaultMessage = "No options found";

              it("Exposes the underlying `nomatchesmessage` attribute", async ({ page }) => {
                /* ---------- Setup ---------- */
                const initialAttr = "This is bad";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")} nomatchesmessage="${initialAttr}">
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                /* ---------- Assertions ---------- */
                // `property` matches initial `attribute`
                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("noMatchesMessage", initialAttr);

                // `attribute` responds to `property` updates
                const newProp = "property bad";
                await combobox.evaluate((node: ComboboxField, prop) => (node.noMatchesMessage = prop), newProp);
                await expect(combobox).toHaveAttribute("nomatchesmessage", newProp);

                // `property` responds to `attribute` updates
                const newAttr = "attribute-badness";
                await combobox.evaluate((node: ComboboxField, a) => node.setAttribute("nomatchesmessage", a), newAttr);
                await expect(combobox).toHaveJSProperty("noMatchesMessage", newAttr);
              });

              it("Provides a default message when the attribute is omitted", async ({ page }) => {
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).not.toHaveAttribute("nomatchesmessage");
                await expect(combobox).toHaveJSProperty("noMatchesMessage", defaultMessage);
              });

              it('Controls the "No Matches" Message displayed to users', async ({ page }) => {
                const customMessage = "Don't have anything for you...";
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")} nomatchesmessage="${customMessage}">
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveAttribute("nomatchesmessage", customMessage);
                expect(customMessage).not.toBe(defaultMessage);

                // Enter a bad filter
                await combobox.pressSequentially(String(Math.random()));

                // Custom "No Matches" message should be displayed based on the mounted attribute
                const customMessageElement = page.getByText(customMessage);
                await expect(customMessageElement).toBeVisible();

                // The default message will be displayed instead if the attribute is removed
                await combobox.evaluate((node) => node.removeAttribute("nomatchesmessage"));
                await expect(customMessageElement).not.toBeVisible();

                const defaultMessageElement = page.getByText(defaultMessage);
                await expect(defaultMessageElement).toBeVisible();

                // But the custom message can be brought back by updating the attribute/property again
                await combobox.evaluate((node: ComboboxField, m) => (node.noMatchesMessage = m), customMessage);
                await expect(defaultMessageElement).not.toBeVisible();
                await expect(customMessageElement).toBeVisible();
              });
            });
          }

          it.describe("valueMissingError (Property)", () => {
            const defaultRequiredError = "Please select an item in the list.";

            it("Exposes the underlying `valuemissingerror` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              const initialAttr = "I think you forgot something?";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} valuemissingerror="${initialAttr}">
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `property` matches initial `attribute`
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueMissingError", initialAttr);

              // `attribute` responds to `property` updates
              const newProp = "property error";
              await combobox.evaluate((node: ComboboxField, prop) => (node.valueMissingError = prop), newProp);
              await expect(combobox).toHaveAttribute("valuemissingerror", newProp);

              // `property` responds to `attribute` updates
              const newAttr = "attribute-error";
              await combobox.evaluate((node: ComboboxField, a) => node.setAttribute("valuemissingerror", a), newAttr);
              await expect(combobox).toHaveJSProperty("valueMissingError", newAttr);
            });

            it("Provides a default message when the attribute is omitted", async ({ page }) => {
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).not.toHaveAttribute("valuemissingerror");
              await expect(combobox).toHaveJSProperty("valueMissingError", defaultRequiredError);
            });

            it("Controls the error displayed to users when the `required` constraint is broken", async ({ page }) => {
              const requiredError = "Why won't you interact with me?";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} valuemissingerror="${requiredError}" required>
                    <option value="" selected>Select Something</option>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveAttribute("valuemissingerror", requiredError);
              expect(requiredError).not.toBe(defaultRequiredError);

              // "Value Missing" Error Message should be displayed because the component was invalid when mounted
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validationMessage", requiredError);

              // The default error message will be displayed instead if the attribute is removed
              await combobox.evaluate((node) => node.removeAttribute("valuemissingerror"));
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validationMessage", defaultRequiredError);

              // But the custom message can be brought back by updating the attribute/property again
              await combobox.evaluate((node: ComboboxField, e) => (node.valueMissingError = e), requiredError);
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validationMessage", requiredError);
              await expect(combobox).not.toHaveJSProperty("validationMessage", defaultRequiredError);
            });

            it("Respects the priority of the existing errors when updated", async ({ page }) => {
              /* ---------- Setup ---------- */
              const requiredError = "You left me with nothing!";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} valuemissingerror="${requiredError}" required>
                    <option value="" selected>Select Something</option>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              // Custom Error is not Default Error
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveAttribute("valuemissingerror", requiredError);
              expect(requiredError).not.toBe(defaultRequiredError);

              // Component already has a "Value Missing" Error, but NOT a "Custom Error"
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", requiredError);

              /* ---------- Assertions ---------- */
              // Apply `customError`
              const customError = "This is a different kind of error...";
              await combobox.evaluate((node: ComboboxField, e) => node.setCustomValidity(e), customError);
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validity.customError", true);
              await expect(combobox).toHaveJSProperty("validationMessage", customError);

              // Updating `valuemissingerror` will not override the `customError`
              await combobox.evaluate((node) => node.removeAttribute("valuemissingerror"));
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validity.customError", true);
              await expect(combobox).toHaveJSProperty("validationMessage", customError);

              // However, the UPDATED `valueMissing` error will be visible once the `customError` is resolved
              await combobox.evaluate((node: ComboboxField) => node.setCustomValidity(""));
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", defaultRequiredError);
              await expect(combobox).not.toHaveJSProperty("validationMessage", requiredError);

              // And other updates to the `valueMissing` error will also be acknowledged at this point
              const newRequiredError = "VOID";
              expect(newRequiredError).not.toBe(requiredError);
              expect(newRequiredError).not.toBe(defaultRequiredError);
              await combobox.evaluate((node: ComboboxField, e) => (node.valueMissingError = e), newRequiredError);

              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", newRequiredError);
            });
          });

          it.describe("labels (Property)", () => {
            it("Exposes any `label`s associated with the `combobox`", async ({ page }) => {
              /* ---------- Setup ---------- */
              const comboboxId = "combobox";
              const firstLabel = "This is a Combobox";
              const secondLabel = "Value Selector";

              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select id="${comboboxId}" ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
                <label for="${comboboxId}">${firstLabel}</label>
              `;

              /* ---------- Assertions ---------- */
              // Combobox has semantic labels
              const combobox = page.getByRole("combobox");
              expect(await combobox.evaluate((n: ComboboxField) => n.labels.length)).toBe(1);
              expect(await combobox.evaluate((n: ComboboxField) => n.labels[0].textContent)).toBe(firstLabel);

              // The 1st label transfers focus
              await expect(combobox).not.toBeFocused();
              await page.getByText(firstLabel).click();
              await expect(combobox).toBeFocused();

              // Labels created after rendering also work
              await page.evaluate(
                ([id, label2]) =>
                  document.body.insertAdjacentHTML("beforebegin", `<label for="${id}">${label2}</label>`),
                [comboboxId, secondLabel] as const,
              );

              expect(await combobox.evaluate((n: ComboboxField) => n.labels.length)).toBe(2);
              expect(await combobox.evaluate((n: ComboboxField) => n.labels[0].textContent)).toBe(secondLabel);
              expect(await combobox.evaluate((n: ComboboxField) => n.labels[1].textContent)).toBe(firstLabel);
              expect(
                await combobox.evaluate((n: ComboboxField) => {
                  return Array.prototype.every.call(n.labels, (l) => l instanceof HTMLLabelElement);
                }),
              ).toBe(true);

              // The 2nd label also transfers focus
              await page.locator("body").click();
              await expect(combobox).not.toBeFocused();

              await page.getByText(secondLabel).click();
              await expect(combobox).toBeFocused();
            });
          });

          it.describe("form (Property)", () => {
            it("Exposes the `form` with which the `combobox` is associated", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form>
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;

              /* ---------- Assertions ---------- */
              // Combobox has a semantic form
              const combobox = page.getByRole("combobox");
              expect(await combobox.evaluate((n: ComboboxField) => n.form?.id)).toBe("");
              expect(await combobox.evaluate((n: ComboboxField) => n.form instanceof HTMLFormElement)).toBe(true);

              // Combobox `form` property updates in response to attribute changes
              const form2Id = "final-form";
              await combobox.evaluate(
                (n: ComboboxField, secondFormId) => n.setAttribute("form", secondFormId),
                form2Id,
              );
              expect(await combobox.evaluate((n: ComboboxField) => n.form)).toBe(null);

              // Combobox `form` attribute updates in response to DOM changes
              await page.evaluate((secondFormId) => {
                document.body.insertAdjacentHTML("beforeend", `<form id="${secondFormId}"></form>`);
              }, form2Id);
              expect(await combobox.evaluate((n: ComboboxField) => n.form?.id)).toBe(form2Id);
              expect(await combobox.evaluate((n: ComboboxField) => n.form instanceof HTMLFormElement)).toBe(true);
            });
          });

          it.describe("validity (Property)", () => {
            it("Exposes the `ValidityState` of the `combobox`", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    <option value="">Select an Option</option>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // `combobox` has a real `ValidityState`
              const combobox = page.getByRole("combobox");
              expect(await combobox.evaluate((n: ComboboxField) => n.validity instanceof ValidityState)).toBe(true);

              // By default, `combobox` is valid without constraints
              expect(await combobox.evaluate((n: ComboboxField) => n.validity.valid)).toBe(true);

              // `ValidityState` updates with constraints
              await combobox.evaluate((n: ComboboxField) => n.setAttribute("required", ""));
              expect(await combobox.evaluate((n: ComboboxField) => n.validity.valid)).toBe(false);
              expect(await combobox.evaluate((n: ComboboxField) => n.validity.valueMissing)).toBe(true);

              // `ValidityState` updates with user interaction
              await combobox.click();
              await page.getByRole("option", { name: testOptions[0] }).click();
              expect(await combobox.evaluate((n: ComboboxField) => n.validity.valid)).toBe(true);
              expect(await combobox.evaluate((n: ComboboxField) => n.validity.valueMissing)).toBe(false);
            });
          });

          it.describe("validationMessage (Property)", () => {
            it("Exposes the `combobox`'s error message", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    <option value="">Select an Option</option>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // No error message exists if no constraints are broken
              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("validationMessage", "");

              // Error message exists if a constraint is broken
              await combobox.evaluate((node: ComboboxField) => node.setAttribute("required", ""));
              await expect(combobox).toHaveJSProperty("validationMessage", "Please select an item in the list.");
            });
          });

          it.describe("willValidate (Property)", () => {
            // Note: See: https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/willValidate
            it("Correctly indicates when the `combobox` will partake in constraint validation", async ({ page }) => {
              await renderComponent(page);
              const combobox = page.getByRole("combobox");

              // With `disabled` conflict, `willValidate` is `false`
              await combobox.evaluate((node: ComboboxField) => node.setAttribute("disabled", ""));
              await expect(combobox).toHaveJSProperty("willValidate", false);

              // Without conflicts, `willValidate` is `true`
              await combobox.evaluate((node: ComboboxField) => node.removeAttribute("disabled"));
              await expect(combobox).toHaveJSProperty("willValidate", true);

              // With `readonly` conflict, `willValidate` is `false`
              await combobox.evaluate((node: ComboboxField) => node.setAttribute("readonly", ""));
              await expect(combobox).toHaveJSProperty("willValidate", false);
            });
          });
        });

        /*
         * NOTE: Methods that we DON'T care to support for library consumers WILL NOT be tested.
         *
         * For example: The `getOptionByValue()` method is really just an internal helper for the component.
         * However, making the method public allows for some event handlers to remain `static`, and there was no
         * risk in exposing the method to the public. Moreover, this method might be useful for some developers.
         * Thus, it remains public, but it shouldn't be tested.
         *
         * Then there are other methods like `connectedCallback()` and `formResetCallback()`. These are _reactionary_
         * callbacks that should be tested _through User Interaction only_. They should not be tested directly with
         * unit tests. We only guarantee User Interaction behavior, not unsupported calls to these methods.
         */
        it.describe("Supported Method", () => {
          it.describe("forceEmptyValue()", () => {
            if (mode === "Filterable") {
              it("Coerces the `combobox` value to an empty string and deselects the current `option`", async ({
                page,
              }) => {
                const name = "my-combobox";
                await page.goto(url);

                for (const valueis of ["anyvalue", "clearable"] as const satisfies ValueIs[]) {
                  await it.step(`In \`${valueis}\` mode`, async () => {
                    await renderHTMLToPage(page)`
                      <form aria-label="Test Form">
                        <select-enhancer>
                          <select name="${name}" ${getFilterAttrs(valueis)}>
                            ${testOptions.map((o, i) => `<option ${i === 1 ? "selected" : ""}>${o}</option>`).join("")}
                          </select>
                        </select-enhancer>
                      </form>
                    `;

                    const second = testOptions[1];
                    const combobox = page.getByRole("combobox");
                    await expect(combobox).toHaveSyncedComboboxValue(
                      { label: second },
                      { form: true, matchingLabel: true },
                    );

                    // Coerce value immediately after initial mounting
                    await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue());
                    await expect(combobox).toHaveComboboxValue("", { form: true });
                    await expect(combobox).toHaveText("");

                    const selectedOptions = page.getByRole("option", { selected: true, includeHidden: true });
                    await expect(selectedOptions).toHaveCount(0);

                    // Coerce value after a manual value update
                    const newValue = valueis === "anyvalue" ? String(Math.random()) : testOptions[2];
                    await combobox.evaluate((node: ComboboxField, v) => (node.value = v), newValue);

                    await expect(combobox).not.toHaveText("");
                    await expect(combobox).toHaveComboboxValue(newValue, { form: true });
                    if (valueis === "clearable") await expect(combobox).toHaveSelectedOption({ label: newValue });

                    await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue());
                    await expect(combobox).toHaveText("");
                    await expect(combobox).toHaveComboboxValue("", { form: true });
                    await expect(selectedOptions).toHaveCount(0);

                    // Method deletes the `autoselectableOption` since it manipulates the field's text content
                    const seventh = testOptions[6];
                    await combobox.pressSequentially(seventh);
                    if (valueis === "anyvalue") await expect(combobox).toHaveComboboxValue(seventh, { form: true });
                    await expect(combobox).toHaveJSProperty("autoselectableOption.value", seventh);
                    await expect(combobox).toHaveJSProperty("autoselectableOption.label", seventh);
                    await expect(combobox).toHaveJSProperty("autoselectableOption.tagName", "COMBOBOX-OPTION");

                    await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue());
                    await expect(combobox).toHaveJSProperty("autoselectableOption", null);
                    await expect(combobox).toHaveComboboxValue("", { form: true });
                    await expect(combobox).toHaveText("");

                    // Redundant calls don't cause any errors
                    await combobox.evaluate((node: ComboboxField) => node.forceEmptyValue());
                    await expect(combobox).toHaveText("");
                    await expect(combobox).toHaveComboboxValue("", { form: true });
                    await expect(selectedOptions).toHaveCount(0);
                  });
                }
              });
            }

            it("Fails if the `combobox` value does not currently accept empty strings", async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              const combobox = page.getByRole("combobox");

              const badValueIsError =
                'Method requires `filter` mode to be on and `valueis` to be "anyvalue" or "clearable"';
              const nullValueError = 'Cannot coerce value to `""` for a `clearable` `combobox` that owns no `option`s';

              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}">
                      ${testOptions.map((o, i) => `<option ${i === 1 ? "selected" : ""}>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;

              const second = testOptions[1];
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { form: true, matchingLabel: true });

              /**
               * Attempts to call {@link ComboboxField.forceEmptyValue} on the provided `element`,
               * expecting an error to be thrown in the process.
               *
               * @returns The details of the error that was thrown, or `null` if no error was thrown
               * (indicating a test failure).
               */
              function tryForceEmptyValue(element: Locator) {
                return element.evaluate((node: ComboboxField) => {
                  try {
                    node.forceEmptyValue();
                    return null;
                  } catch (error) {
                    const typedError = error as Error;
                    return { instance: typedError.constructor.name, message: typedError.message };
                  }
                });
              }

              /* ---------- Assertions ---------- */
              // In non-filter mode
              await expect(combobox).toHaveJSProperty("filter", false);
              const errorDetails1 = await tryForceEmptyValue(combobox);

              expect(errorDetails1?.instance).toBe(TypeError.name);
              expect(errorDetails1?.message).toBe(badValueIsError);
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { form: true, matchingLabel: true });

              // In `unclearable` mode
              await combobox.evaluate((node: ComboboxField) => (node.filter = true));
              await combobox.evaluate((node: ComboboxField) => (node.valueIs = "unclearable"));
              const errorDetails2 = await tryForceEmptyValue(combobox);

              expect(errorDetails2?.instance).toBe(TypeError.name);
              expect(errorDetails2?.message).toBe(badValueIsError);
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { form: true, matchingLabel: true });

              // In `clearable` mode, when uninitialized
              await combobox.evaluate((node: ComboboxField) => (node.valueIs = "clearable"));
              await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
              await expect(combobox).toHaveComboboxValue(null, { form: true });
              await expect(combobox).toHaveText("");

              const errorDetails3 = await tryForceEmptyValue(combobox);
              expect(errorDetails3?.instance).toBe(TypeError.name);
              expect(errorDetails3?.message).toBe(nullValueError);
              await expect(combobox).toHaveComboboxValue(null, { form: true });
              await expect(combobox).toHaveText("");
            });
          });

          it.describe("acceptsValue()", () => {
            it("Returns `true` if the `combobox` accepts the argument as a value without a corresponding `option`", async ({
              page,
            }) => {
              await page.goto(url);
              const states =
                mode === "Filterable"
                  ? (["anyvalue", "clearable", "unclearable"] as const satisfies ValueIs[])
                  : (["non-filter"] as const);

              for (const state of states) {
                await it.step(`In ${state === "non-filter" ? state : `\`${state}\``} mode`, async () => {
                  /* ---------- Setup ---------- */
                  await renderHTMLToPage(page)`
                    <select-enhancer>
                      <select ${state === "non-filter" ? "" : getFilterAttrs(state)}>
                        ${testOptions.map((o, i) => `<option ${i === 1 ? "selected" : ""}>${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  `;

                  const combobox = page.getByRole("combobox");
                  await expect(combobox).toHaveJSProperty("filter", state !== "non-filter");
                  if (state === "non-filter") await expect(combobox).not.toHaveAttribute("valueis");
                  else await expect(combobox).toHaveAttribute("valueis", state);

                  const initialValue = testOptions[1];
                  await expect(combobox).toHaveSyncedComboboxValue({ label: initialValue }, { matchingLabel: true });

                  /* ---------- Assertions ---------- */
                  // Empty Values
                  const clearable = state === "anyvalue" || state === "clearable";
                  expect(await combobox.evaluate((node: ComboboxField) => node.acceptsValue(""))).toBe(clearable);

                  const option = page.getByRole("option", { includeHidden: true });
                  const emptyStringOption = option.and(page.locator('[value=""]'));
                  await expect(emptyStringOption).not.toBeAttached();

                  await combobox.evaluate((node: ComboboxField) => (node.value = ""));
                  await expect(combobox).toHaveComboboxValue(clearable ? "" : initialValue);
                  await expect(combobox).toHaveText(clearable ? "" : initialValue);

                  // Any kind of Value
                  await combobox.evaluate((node: ComboboxField) => node.formResetCallback());
                  const valueWithoutOption = String(Math.random());
                  expect(
                    await combobox.evaluate((node: ComboboxField, v) => node.acceptsValue(v), valueWithoutOption),
                  ).toBe(state === "anyvalue");

                  const randomOption = option.and(page.locator(`[value="${valueWithoutOption}"]`));
                  await expect(randomOption).not.toBeAttached();

                  await combobox.evaluate((node: ComboboxField, v) => (node.value = v), valueWithoutOption);
                  await expect(combobox).toHaveComboboxValue(state === "anyvalue" ? valueWithoutOption : initialValue);
                  await expect(combobox).toHaveText(state === "anyvalue" ? valueWithoutOption : initialValue);
                });
              }
            });

            if (mode === "Filterable") {
              it(`Returns \`false\` in \`${"clearable" satisfies ValueIs}\` mode when uninitialized`, async ({
                page,
              }) => {
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("clearable")}></select>
                  </select-enhancer>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue(null);
                expect(await combobox.evaluate((node: ComboboxField) => node.acceptsValue(""))).toBe(false);

                await combobox.evaluate((node: ComboboxField) => (node.value = ""));
                await expect(combobox).toHaveComboboxValue(null);
                await expect(combobox).toHaveText("");
              });
            }
          });

          if (mode === "Filterable") {
            it.describe("optionMatchesFilter()", () => {
              it("Can be overridden to customize the filtering logic", async ({ page }) => {
                // Setup
                const third = testOptions[2];
                await renderComponent(page, { valueis: "unclearable" });

                /*
                 * Replace the original `combobox` with a customized one
                 *
                 * NOTE: In the real world, people would just register `CustomizedComboboxField` as `<combobox-field>`
                 * and never register `ComboboxField` to begin with. However, the page that we're working with already
                 * has `<combobox-field>` registered, so we have to do some unorthodox things to get the test working
                 * _without writing extra code/components_.
                 */
                const combobox = page.getByRole("combobox");
                await combobox.evaluate((node: ComboboxField) => {
                  // Define a customized `combobox`
                  const ComboboxFieldConstructor = customElements.get("combobox-field") as typeof ComboboxField;
                  class CustomizedComboboxField extends ComboboxFieldConstructor {
                    /** @override */
                    optionMatchesFilter(option: ComboboxOption): boolean {
                      if (!this.text.data) return false;
                      return option.label.startsWith("F");
                    }
                  }

                  // Create a customized `combobox` element
                  customElements.define("customized-combobox-field", CustomizedComboboxField);
                  const field = document.createElement("customized-combobox-field");

                  // Replace original `combobox` with the customized one, WITHOUT losing access to the `listbox`
                  const container = node.closest("select-enhancer") as SelectEnhancer;
                  const fragment = document.createDocumentFragment();

                  fragment.appendChild(node.listbox).insertAdjacentElement("beforebegin", node);
                  node.replaceWith(field);
                  container.prepend(fragment);

                  // Copy old `combobox`'s attributes to the new one
                  node.getAttributeNames().forEach((a) => field.setAttribute(a, node.getAttribute(a) as string));
                });

                // Set the value of the newly-created and mounted `combobox`
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), third);
                await expect(combobox).toHaveSyncedComboboxValue({ label: third }, { matchingLabel: true });

                // With the customized filtering logic, no `option`s are shown without a filter
                await combobox.press("Backspace");
                await expect(combobox).toHaveText("");

                const noMatchesMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
                const noMatchesElement = page.getByText(noMatchesMessage);
                await expect(noMatchesElement).toBeVisible();

                // With the customized filtering logic, only `option`s starting with "F" are shown (unrealistic)
                await combobox.press("A");
                await expect(noMatchesElement).not.toBeVisible();

                const optionsStartingWithF = testOptions.filter((o) => o.startsWith("F"));
                expect(optionsStartingWithF.length).toBeGreaterThan(1);
                await expect(page.getByRole("option")).toHaveCount(optionsStartingWithF.length);
                await Promise.all(
                  optionsStartingWithF.map((o) => expect(page.getByRole("option", { name: o })).toBeVisible()),
                );
              });
            });
          }
        });

        it.describe("Validation Methods", () => {
          /*
           * NOTE: Currently, according to our knowledge, there's no way to run assertions on the native error bubbles
           * created by browsers.
           */
          for (const method of ["checkValidity", "reportValidity"] as const) {
            it.describe(`${method}()`, () => {
              it("Performs field validation when called", async ({ page }) => {
                /* ---------- Setup ---------- */
                await page.goto(url);
                await renderHTMLToPage(page)`
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")} required>
                      <option value="">Select an Option</option>
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;

                /* ---------- Assertions ---------- */
                // Validation on an invalid `combobox`
                const combobox = page.getByRole("combobox");
                const invalidEventEmitted = combobox.evaluate((node: ComboboxField) => {
                  return new Promise<boolean>((resolve, reject) => {
                    const timeout = setTimeout(
                      reject,
                      3000,
                      "The `invalid` event was never emitted by a <combobox-field>",
                    );

                    node.addEventListener(
                      "invalid",
                      (event) => {
                        if (!event.isTrusted) return;
                        clearTimeout(timeout);
                        resolve(true);
                      },
                      { once: true },
                    );
                  });
                });

                expect(await combobox.evaluate((node: ComboboxField, m) => node[m](), method)).toBe(false);
                expect(await invalidEventEmitted).toBe(true);

                // Validation on a valid `combobox`
                const invalidEventNotEmitted = combobox.evaluate((node: ComboboxField) => {
                  return new Promise<boolean>((resolve, reject) => {
                    const timeout = setTimeout(resolve, 3000, true);

                    node.addEventListener(
                      "invalid",
                      () => {
                        clearTimeout(timeout);
                        reject(new Error("The `invalid` event should not have been emitted by the <combobox-field>"));
                      },
                      { once: true },
                    );
                  });
                });

                await combobox.evaluate((node: ComboboxField) => node.removeAttribute("required"));
                expect(await combobox.evaluate((node: ComboboxField, m) => node[m](), method)).toBe(true);
                expect(await invalidEventNotEmitted).toBe(true);
              });
            });
          }

          it.describe("setCustomValidity()", () => {
            it("Sets/Clears the custom error message for the `combobox`", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("validity.valid", true);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", "");

              /* ---------- Assertions ---------- */
              // Applying a custom error
              const customError = "This is an AWFUL value, bro...";
              await combobox.evaluate((node: ComboboxField, e) => node.setCustomValidity(e), customError);
              await expect(combobox).toHaveJSProperty("validity.valid", false);
              await expect(combobox).toHaveJSProperty("validity.customError", true);
              await expect(combobox).toHaveJSProperty("validationMessage", customError);

              // Clearing a custom error
              await combobox.evaluate((node: ComboboxField, e) => node.setCustomValidity(e), "");
              await expect(combobox).toHaveJSProperty("validity.valid", true);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", "");
            });

            it('Overrides the "Value Missing" Error Message', async ({ page }) => {
              /* ---------- Setup ---------- */
              const valueMissingError = "Please select an item in the list.";
              const customError = "WHAT HAVE YOU DONE?!?";
              const first = testOptions[1];

              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")} required>
                    <option value="">Select an Option</option>
                    ${testOptions.map((o, i) => `<option ${!i ? "selected" : ""}>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("required", true);
              await expect(combobox).toHaveJSProperty("validity.valid", true);
              await expect(combobox).toHaveJSProperty("validity.valueMissing", false);
              await expect(combobox).toHaveJSProperty("validity.customError", false);
              await expect(combobox).toHaveJSProperty("validationMessage", "");

              /* ---------- Assertions ---------- */
              await it.step("Applying `valueMissing`, then `customError`", async () => {
                // Apply `valueMissing`
                await combobox.evaluate((node: ComboboxField) => (node.value = ""));
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
                await expect(combobox).toHaveJSProperty("validity.customError", false);
                await expect(combobox).toHaveJSProperty("validationMessage", valueMissingError);

                // Apply `customError`
                await combobox.evaluate((node: ComboboxField, e) => node.setCustomValidity(e), customError);
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
                await expect(combobox).toHaveJSProperty("validity.customError", true);
                await expect(combobox).toHaveJSProperty("validationMessage", customError);

                // Remove `customError`
                await combobox.evaluate((node: ComboboxField) => node.setCustomValidity(""));
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
                await expect(combobox).toHaveJSProperty("validity.customError", false);
                await expect(combobox).toHaveJSProperty("validationMessage", valueMissingError);

                // Remove `valueMissing`
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), first);
                await expect(combobox).toHaveJSProperty("validity.valid", true);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", false);
                await expect(combobox).toHaveJSProperty("validity.customError", false);
                await expect(combobox).toHaveJSProperty("validationMessage", "");
              });

              await it.step("Applying `customError`, then `valueMissing`", async () => {
                // Apply `customError`
                await combobox.evaluate((node: ComboboxField, e) => node.setCustomValidity(e), customError);
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", false);
                await expect(combobox).toHaveJSProperty("validity.customError", true);
                await expect(combobox).toHaveJSProperty("validationMessage", customError);

                // Apply `valueMissing`
                await combobox.evaluate((node: ComboboxField) => (node.value = ""));
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", true);
                await expect(combobox).toHaveJSProperty("validity.customError", true);
                await expect(combobox).toHaveJSProperty("validationMessage", customError);

                // Remove `valueMissing`
                await combobox.evaluate((node: ComboboxField) => node.removeAttribute("required"));
                await expect(combobox).toHaveJSProperty("validity.valid", false);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", false);
                await expect(combobox).toHaveJSProperty("validity.customError", true);
                await expect(combobox).toHaveJSProperty("validationMessage", customError);

                // Remove `customError`
                await combobox.evaluate((node: ComboboxField) => node.setCustomValidity(""));
                await expect(combobox).toHaveJSProperty("validity.valid", true);
                await expect(combobox).toHaveJSProperty("validity.valueMissing", false);
                await expect(combobox).toHaveJSProperty("validity.customError", false);
                await expect(combobox).toHaveJSProperty("validationMessage", "");
              });
            });
          });
        });

        it.describe("Dispatched Events", () => {
          /**
           * Tracks the number of times an `event` of the specified `type` is dispatched on the provided `page`.
           *
           * Note: Events are only counted if they bubble all the way up to the owning `Document`.
           *
           * @param event
           * @param type
           * @returns An array containing the events that were dispatched. Each item in the array will include
           * the event's data and the event's `constructor.name`.
           */
          async function trackEvents<
            C extends "Event" | "InputEvent",
            E extends C extends "InputEvent" ? InputEvent : Event,
            T extends "input" | "change",
          >(page: Page, event: C, type: T): Promise<(E & { constructor: C })[]> {
            const events: (E & { constructor: C })[] = [];
            const funcName = `${type.charAt(0).toUpperCase()}${type.slice(1)}` as Capitalize<T>;
            type EnhancedWindow = Window & { [funcName](e: (typeof events)[number]): void };
            await page.exposeFunction(funcName, ((e) => events.push(e)) satisfies EnhancedWindow[typeof funcName]);

            await page.evaluate(
              ([constructor, t, fn]) => {
                document.addEventListener(t, (e) => {
                  if (!eval(`e.constructor === ${constructor}`)) return;
                  if (e.target?.constructor !== customElements.get("combobox-field")) return;

                  const props = {} as E;
                  // @ts-expect-error -- Not worth the effort of correcting the types that we already know are right
                  // eslint-disable-next-line guard-for-in
                  for (const key in e) props[key] = e[key as keyof typeof e];
                  (window as unknown as EnhancedWindow)[fn]({ constructor: constructor as C, ...props });
                });
              },
              [event, type, funcName] as const,
            );

            return events;
          }

          for (const event of ["input", "change"] as const) {
            it(`Dispatches a(n) \`${event}\` event when the user selects a new \`option\``, async ({ page }) => {
              /* ---------- Setup ---------- */
              const initialValue = getRandomOption(testOptions.slice(1));
              await renderComponent(page, initialValue);

              const combobox = page.getByRole("combobox");
              await expect(combobox).not.toBeExpanded();
              await expect(combobox).toHaveSyncedComboboxValue({ label: initialValue }, { matchingLabel: true });

              const events = await trackEvents(page, "Event", event);

              /* ---------- Assertions ---------- */
              // event is emitted AFTER the value is changed
              const newValue = getRandomOption(testOptions.filter((o) => o !== initialValue));
              await combobox.click();
              await page.getByRole("option", { name: newValue }).click();

              await expect(combobox).toHaveSyncedComboboxValue({ label: newValue }, { matchingLabel: true });
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: initialValue }, { matchingLabel: true });
              expect(events).toHaveLength(1);

              // event is NOT emitted if the value does not change
              await combobox.click();
              await page.getByRole("option", { name: newValue }).click();

              await expect(combobox).toHaveSyncedComboboxValue({ label: newValue }, { matchingLabel: true });
              expect(events).toHaveLength(1);
            });
          }

          createFilterTypeDescribeBlocks(["anyvalue", "clearable"], "filter-only", (valueis) => {
            it("Dispatches an `input` event when a filter change causes a value update", async ({ page }) => {
              /* ---------- Setup ---------- */
              const second = testOptions[1];
              await renderComponent(page, { initialValue: second, valueis });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis);
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { matchingLabel: true });

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).toBeAttached();

              const events = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Clearing the `combobox` value
              await combobox.press("ControlOrMeta+A");
              await combobox.press("Backspace");

              await expect(selectedOption).not.toBeAttached();
              await expect(combobox).toHaveComboboxValue("");
              await expect(combobox).toHaveText("");

              expect(events).toHaveLength(1);
              expect(events[0].data).toBe(null);
              expect(events[0].dataTransfer).toBe(null);
              expect(events[0].inputType).toBe("deleteContentBackward");

              // Updating the `combobox` filter/value through key strokes
              const seventh = testOptions[6];
              for (let i = 0; i < seventh.length; i++) {
                const letter = seventh.charAt(i);
                await combobox.press(letter);

                const partialFilter = seventh.slice(0, i + 1);
                await expect(selectedOption).not.toBeAttached();
                await expect(combobox).toHaveText(partialFilter);
                await expect(combobox).toHaveComboboxValue(valueis === "clearable" ? "" : partialFilter);

                if (valueis === "anyvalue") {
                  expect(events).toHaveLength(i + 2);
                  expect(events[i + 1].data).toBe(letter);
                  expect(events[i + 1].dataTransfer).toBe(null);
                  expect(events[i + 1].inputType).toBe("insertText");
                }
              }

              expect(events).toHaveLength(valueis === "clearable" ? 1 : seventh.length + 1);

              // Updating the `combobox` filter/value through pasting
              const first = testOptions[0];
              await page.evaluate((v) => (document.body.appendChild(document.createElement("input")).value = v), first);
              await page.getByRole("textbox").selectText();
              await page.getByRole("textbox").press("ControlOrMeta+C");

              await combobox.press("ControlOrMeta+A");
              await combobox.press("ControlOrMeta+V");

              await expect(selectedOption).not.toBeAttached();
              await expect(combobox).toHaveText(first);
              await expect(combobox).toHaveComboboxValue(valueis === "clearable" ? "" : first);

              expect(events).toHaveLength(valueis === "clearable" ? 1 : seventh.length + 2);
              if (valueis === "anyvalue") {
                expect(events.at(-1)?.data).toBe(first);
                expect(events.at(-1)?.dataTransfer).toBe(null);
                expect(events.at(-1)?.inputType).toBe("insertFromPaste");
              }
            });

            it("Dispatches a `change` event when a filter-initiated value update is committed", async ({ page }) => {
              /* ---------- Setup ---------- */
              const second = testOptions[1];
              await renderComponent(page, { initialValue: second, valueis });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis);
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { matchingLabel: true });

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).toBeAttached();

              const events = await trackEvents(page, "Event", "change");

              /* ---------- Assertions ---------- */
              // Clearing the `combobox` value
              await combobox.press("ControlOrMeta+A");
              await combobox.press("Backspace");

              await expect(selectedOption).not.toBeAttached();
              await expect(combobox).toHaveComboboxValue("");
              await expect(combobox).toHaveText("");

              expect(events).toHaveLength(0);
              await page.locator("body").click();
              expect(events).toHaveLength(1);

              // Updating the `combobox` filter/value through key strokes
              const seventh = testOptions[6];
              await combobox.pressSequentially(seventh);
              await expect(selectedOption).not.toBeAttached();
              await expect(combobox).toHaveText(seventh);
              await expect(combobox).toHaveComboboxValue(valueis === "anyvalue" ? seventh : "");

              expect(events).toHaveLength(1);
              await page.locator("body").click();
              expect(events).toHaveLength(valueis === "anyvalue" ? 2 : 1);
            });

            it("Does not dispatch a `change` event if no filter-based value change has occurred", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs(valueis)}>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis);
              await expect(combobox).toHaveComboboxValue("");
              await expect(combobox).toHaveText("");

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).not.toBeAttached();

              const changeEvents = await trackEvents(page, "Event", "change");
              const inputEvents = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Enter text and re-clear the `combobox`
              const first = testOptions[0];
              await combobox.pressSequentially(first);
              await combobox.press("ControlOrMeta+A");
              await combobox.press("Backspace");

              await expect(combobox).toHaveText("");
              await expect(combobox).toHaveComboboxValue("");
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(valueis === "anyvalue" ? first.length + 1 : 1);

              expect(changeEvents).toHaveLength(0);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(0);

              // Enter text and re-type a previously-existing value (`anyvalue` mode only)
              if (valueis !== "anyvalue") return;
              const ninth = testOptions[8];
              await combobox.evaluate((node: ComboboxField, v) => (node.value = v), ninth);

              await expect(combobox).not.toBeFocused();
              await combobox.press("ArrowRight");
              await combobox.press("Backspace");
              await combobox.press(ninth.at(-1) as string);

              await expect(combobox).toHaveText(ninth);
              await expect(combobox).toHaveComboboxValue(ninth);
              expect(inputEvents).toHaveLength(first.length + 3);

              expect(changeEvents).toHaveLength(0);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(0);
            });
          });

          createFilterTypeDescribeBlocks(["clearable"], "filter-only", (valueis) => {
            it("Does not dispatch `change` events if the `combobox` value is `null`", async ({ page }) => {
              /* ---------- Setup ---------- */
              const second = testOptions[1];
              await renderComponent(page, { initialValue: second, valueis });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis);
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { matchingLabel: true });

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).toBeAttached();

              const changeEvents = await trackEvents(page, "Event", "change");
              const inputEvents = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Clear the `combobox` value
              await combobox.press("ControlOrMeta+A");
              await combobox.press("Backspace");

              await expect(selectedOption).not.toBeAttached();
              await expect(combobox).toHaveComboboxValue("");
              await expect(combobox).toHaveText("");
              expect(inputEvents).toHaveLength(1);

              // Make the `combobox` value `null` by deleting all the `option`s
              await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
              await expect(combobox).toHaveComboboxValue(null);

              // `blur` the `combobox`
              expect(changeEvents).toHaveLength(0);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(0);
              expect(inputEvents).toHaveLength(1);
            });
          });

          if (mode === "Filterable") {
            // NOTE: This is consistent with the behavior of native `<input type="text">` elements
            it("Maintains its logic for dispatching filter-initiated `change` events when manual value changes occur", async ({
              page,
            }) => {
              /* ---------- Setup ---------- */
              const first = testOptions[0];
              await renderComponent(page, { initialValue: first, valueis: "anyvalue" });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).toBeAttached();

              const changeEvents = await trackEvents(page, "Event", "change");
              const inputEvents = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Change the `combobox` value by updating the filter
              const third = testOptions[2];
              await combobox.pressSequentially(third);
              await expect(combobox).toHaveComboboxValue(third);
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(third.length);

              // Change the `combobox` value manually, then `blur` the field
              const fourth = testOptions[3];
              await combobox.evaluate((node: ComboboxField, v) => (node.value = v), fourth);
              await expect(combobox).not.toHaveComboboxValue(third);
              await expect(combobox).toHaveSyncedComboboxValue({ label: fourth }, { matchingLabel: true });

              // The `change` event is still EMITTED, even with the manual value update
              expect(changeEvents).toHaveLength(0);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(1);
              expect(inputEvents).toHaveLength(third.length);

              // Manually change the `combobox` value to something random
              const randomValue = String(Math.random());
              await combobox.evaluate((node: ComboboxField, v) => (node.value = v), randomValue);
              await expect(combobox).toHaveComboboxValue(randomValue);
              await expect(combobox).toHaveText(randomValue);
              await expect(selectedOption).not.toBeAttached();

              // Update the filter again
              await expect(combobox).not.toBeFocused();

              await combobox.pressSequentially(first);
              await expect(combobox).toHaveComboboxValue(first);
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(third.length + first.length);

              // Manually revert to the random value, then `blur` the field
              await combobox.evaluate((node: ComboboxField, v) => (node.value = v), randomValue);
              await expect(combobox).toHaveComboboxValue(randomValue);
              await expect(combobox).toHaveText(randomValue);
              await expect(selectedOption).not.toBeAttached();

              // The `change` event is still SUPPRESSED, even with the manual value update
              expect(changeEvents).toHaveLength(1);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(1);
              expect(inputEvents).toHaveLength(third.length + first.length);
            });

            it("Does not dispatch a filter-initiated `change` event if an `option` was selected right before `blur`", async ({
              page,
            }) => {
              /* ---------- Setup ---------- */
              const first = testOptions[0];
              await renderComponent(page, { initialValue: first, valueis: "anyvalue" });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).toBeAttached();

              const changeEvents = await trackEvents(page, "Event", "change");
              const inputEvents = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Change the `combobox` value by updating the filter
              const second = testOptions[1];
              await combobox.pressSequentially(second);
              await expect(combobox).toHaveComboboxValue(second);
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(second.length);

              // Select the `option`, then `blur` the field
              await combobox.press("Enter");
              await expect(combobox).toHaveSyncedComboboxValue({ label: second }, { matchingLabel: true });

              // NOTE: The `inputEvents` count didn't change because we're only counting `InputEvent`s, not `Event`s.
              // The `change` event always uses a regular `Event`, so the count will be incremented as usual during selection.
              expect(inputEvents).toHaveLength(second.length);
              expect(changeEvents).toHaveLength(1);

              // A 2nd `change` event is not fired on `blur` since an `option` was just recently selected.
              await page.locator("body").click();
              expect(changeEvents).not.toHaveLength(2);
              expect(changeEvents).toHaveLength(1);

              // The `change` event will still be dispatched if additional edits occur _after_ `option` selection
              const third = testOptions[2];
              await expect(combobox).not.toBeFocused();

              await combobox.pressSequentially(third);
              await expect(combobox).toHaveComboboxValue(third);
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(second.length + third.length);

              await combobox.press("Enter");
              await expect(combobox).toHaveSyncedComboboxValue({ label: third }, { matchingLabel: true });
              expect(inputEvents).toHaveLength(second.length + third.length);
              expect(changeEvents).toHaveLength(2);

              await combobox.press("Z");
              await expect(combobox).toHaveComboboxValue(`${third}Z`);
              await expect(selectedOption).not.toBeAttached();
              expect(inputEvents).toHaveLength(second.length + third.length + 1);

              expect(changeEvents).toHaveLength(2);
              await page.locator("body").click();
              expect(changeEvents).toHaveLength(3);
            });

            it("Does nothing in response to `beforeinput` events that don't come from user interactions", async ({
              page,
            }) => {
              /* ---------- Setup ---------- */
              await renderComponent(page, { valueis: "anyvalue" });

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveComboboxValue("");
              await expect(combobox).toHaveText("");

              const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
              await expect(selectedOption).not.toBeAttached();

              const changeEvents = await trackEvents(page, "Event", "change");
              const inputEvents = await trackEvents(page, "InputEvent", "input");

              /* ---------- Assertions ---------- */
              // Manually dispatch a `beforeinput` event
              await combobox.evaluate((node: ComboboxField) => {
                const range = new StaticRange({
                  startContainer: node.text,
                  startOffset: 0,
                  endContainer: node.text,
                  endOffset: node.text.length,
                });

                node.dispatchEvent(
                  new InputEvent("beforeinput", {
                    bubbles: true,
                    composed: true,
                    cancelable: true,
                    data: "Nope",
                    dataTransfer: null,
                    inputType: "insertText",
                    targetRanges: [range],
                  }),
                );
              });

              // Nothing should have happened
              expect(inputEvents).toHaveLength(0);
              expect(changeEvents).toHaveLength(0);
              await expect(combobox).toHaveText("");
              await expect(combobox).toHaveComboboxValue("");
            });
          }
        });

        it.describe("Dynamic `option` Management (Complies with Native <select>)", () => {
          createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
            it("Updates its value when a new `defaultSelected` `option` is added", async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs(valueis)}>
                      <option value="1">One</option>
                      <option value="2" selected>Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                </form>
              `;

              // Display `option`s (Not necessary, but makes this test easier to write)
              const combobox = page.getByRole("combobox");
              await combobox.click();

              // Initial value should match the `defaultSelected` `option`
              const firstOption = page.getByRole("option").first();
              const selectedOption = page.getByRole("option", { selected: true });
              await expect(firstOption.and(selectedOption)).not.toBeAttached();

              await expect(selectedOption).toHaveAttribute("selected");
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Two", value: "2" },
                { form: true, matchingLabel: true },
              );

              /* ---------- Assertions ---------- */
              // After adding a _new_ `defaultSelected` `option`, the `combobox` value should update
              await combobox.evaluate((node: ComboboxField) => {
                node.listbox.insertAdjacentHTML(
                  "beforeend",
                  '<combobox-option value="4" selected>Four</combobox-option>',
                );
              });

              await expect(combobox).not.toHaveSyncedComboboxValue({ label: "Two", value: "2" });
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Four", value: "4" },
                { form: true, matchingLabel: true },
              );
            });
          });

          createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
            const Action = valueis === "anyvalue" ? "Adopts the value of its text content" : "Resets its value";

            it(`${Action} if the selected \`option\` is removed`, async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs(valueis)}>
                      <option value="1">One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                      <option value="4" selected>Four</option>
                    </select>
                  </select-enhancer>
                </form>
              `;

              // Enable Observability of `ComboboxField.formResetCallback()`
              const combobox = page.getByRole("combobox");
              const getResetCount = observeResetCount(combobox);

              // Display Options (Not necessary, but makes this test easier to write)
              await combobox.click();

              // Intial value should match the `defaultSelected` `option`
              const firstOption = page.getByRole("option").first();
              const selectedOption = page.getByRole("option", { selected: true });
              await expect(firstOption.and(selectedOption)).not.toBeAttached();

              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Four", value: "4" },
                { form: true, matchingLabel: true },
              );

              /* ---------- Assertions ---------- */
              // `combobox` resets its value when the selected `option` is removed
              await selectedOption.evaluate((node) => node.remove());
              expect(await getResetCount()).toBe(valueis === "anyvalue" ? 0 : 1);

              if (valueis === "anyvalue") {
                await expect(selectedOption).toHaveCount(0);
                await expect(combobox).toHaveText("Four");
                await expect(combobox).toHaveComboboxValue("Four", { form: true });
              } else if (valueis === "clearable") {
                await expect(selectedOption).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue("", { form: true });
              } else {
                await expect(firstOption.and(selectedOption)).toBeAttached();
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: "One", value: "1" },
                  { form: true, matchingLabel: true },
                );
              }

              if (valueis === "clearable" || valueis === "anyvalue") return;
              // This behavior still works even if the first `option` is removed after becoming selected
              await selectedOption.evaluate((node) => node.remove());
              expect(await getResetCount()).toBe(2);
              await expect(firstOption.and(selectedOption)).toBeVisible();

              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Two", value: "2" },
                { form: true, matchingLabel: true },
              );
            });
          });

          createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
            const Action =
              valueis === "anyvalue" ? "Adopts the value of its text content" : "Forcefully resets its value to `null`";

            it(`${Action} if all \`option\`s are removed`, async ({ page }) => {
              /* ---------- Setup ---------- */
              const first = testOptions[0];
              await renderComponent(page, { initialValue: first, valueis });

              // Associate `combobox` with a `form`
              const name = "my-combobox";
              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { name, association: "explicit" });

              const form = page.getByRole("form");
              await expect(form).toHaveJSProperty(`elements.${name}.name`, name);
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });

              // Display `option`s (for test-writing convenience)
              await combobox.click();

              /* ---------- Asertions ---------- */
              // Remove all nodes 1-BY-1
              await combobox.evaluate((node: ComboboxField) => {
                while (node.listbox.children.length) node.listbox.children[0].remove();
              });

              const listbox = page.getByRole("listbox");
              const options = listbox.getByRole("option", { includeHidden: true });

              if (valueis === "anyvalue") {
                await expect(listbox).toBeEmpty();
                await expect(combobox).toHaveText(first);
                await expect(combobox).toHaveComboboxValue(first, { form: true });
              } else {
                if (valueis !== undefined) await expect(listbox).not.toBeEmpty();
                await expect(options).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue(null, { form: true });
              }

              // Add all the `option`s back in (and verify that the value/`option`s update correctly)
              await combobox.evaluate((e: ComboboxField, to) => {
                to.forEach((o) => e.listbox.insertAdjacentHTML("beforeend", `<combobox-option>${o}</combobox-option>`));
              }, testOptions);

              if (valueis === "clearable") {
                const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                await expect(selectedOption).toHaveCount(0);

                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue("", { form: true });
              }
              // No changes should've happened in `anyvalue` mode
              else if (valueis === "anyvalue") {
                const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                await expect(selectedOption).toHaveCount(0);

                await expect(combobox).toHaveComboboxValue(first, { form: true });
                await expect(combobox).toHaveText(first);
              } else {
                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });
              }

              // Remove all `option`s SIMULTANEOUSLY this time.
              await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());

              // `combobox` value should be preserved again in `anyvalue` mode
              if (valueis === "anyvalue") {
                await expect(listbox).toBeEmpty();
                await expect(combobox).toHaveText(first);
                await expect(combobox).toHaveComboboxValue(first, { form: true });
              }
              // `combobox` value should be `null`ified again in other modes
              else {
                if (valueis !== undefined) await expect(listbox).not.toBeEmpty();
                await expect(options).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue(null, { form: true });
              }
            });
          });

          createFilterTypeDescribeBlocks(["clearable", "unclearable"], "both", (valueis) => {
            it("Updates its value if a new `option` is added when there are no pre-existing `option`s", async ({
              page,
            }) => {
              /* ---------- Setup ---------- */
              await renderComponent(page, { valueis });

              // Associate Combobox with a `form`
              const name = "my-combobox";
              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { name, association: "explicit" });

              // Display `option`s for test-writing convenience
              await combobox.click();

              /* ---------- Assertions ---------- */
              // Remove all `option`s, then add new ones 1-BY-1
              await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
              const newOptions = Object.freeze(["10", "20", "30", "40", "50"] as const);
              await combobox.evaluate((node: ComboboxField, options) => {
                options.forEach((o) =>
                  node.listbox.insertAdjacentHTML("afterbegin", `<combobox-option>${o}</combobox-option>`),
                );
              }, newOptions);

              const firstOption = page.getByRole("option", { includeHidden: Boolean(valueis) }).first();
              const selectedOption = page.getByRole("option", { selected: true, includeHidden: Boolean(valueis) });

              if (valueis === "clearable") {
                await expect(selectedOption).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue("", { form: true });
              } else {
                // The first _inserted_ `option` should be the selected one (not necessarily the first `option` itself)
                await expect(firstOption.and(selectedOption)).not.toBeAttached();
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: newOptions[0] },
                  { form: true, matchingLabel: true },
                );
              }

              // Remove all `option`s, THEN add new one's SIMULTANEOUSLY
              await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
              await combobox.evaluate((node: ComboboxField, values) => {
                const fragment = document.createDocumentFragment();

                values.forEach((v) => {
                  const option = document.createElement("combobox-option");
                  fragment.prepend(option);
                  option.textContent = v;
                });

                node.listbox.replaceChildren(fragment);
              }, newOptions);

              if (valueis === "clearable") {
                await expect(selectedOption).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue("", { form: true });
              } else {
                // The first _inserted_ `option` should again be selected. (Due to batching, first `option` is selected.)
                await expect(firstOption.and(selectedOption)).toBeAttached();
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: newOptions.at(-1) as string },
                  { form: true, matchingLabel: true },
                );
              }

              // REPLACE all `option`s SIMULTANEOUSLY
              const letterOptions = Object.freeze(["A", "B", "C", "D", "E"] as const);
              const middleLetterIndex = Math.floor(letterOptions.length / 2);
              expect(await page.getByRole("option").count()).toBeGreaterThan(0);
              await combobox.evaluate(
                (node: ComboboxField, [values, startIndex]) => {
                  const fragment = document.createDocumentFragment();

                  for (let i = startIndex; i < values.length + startIndex; i++) {
                    const v = values[i % values.length];
                    const option = fragment.appendChild(document.createElement("combobox-option"));
                    option.textContent = v;
                  }

                  node.listbox.replaceChildren(fragment);
                },
                [letterOptions, middleLetterIndex] as const,
              );

              if (valueis === "clearable") {
                await expect(selectedOption).toHaveCount(0);
                await expect(combobox).toHaveText("");
                await expect(combobox).toHaveComboboxValue("", { form: true });
              } else {
                // The first _inserted_ `option` should again be selected. (Due to batching, first `option` is selected.)
                await expect(firstOption.and(selectedOption)).toBeAttached();
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: letterOptions[middleLetterIndex] },
                  { form: true, matchingLabel: true },
                );
              }
            });
          });

          it("Rejects Nodes that are not valid `ComboboxOption`s", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page, initialValue);

            // Choose an `option` _besides_ the default value
            const combobox = page.getByRole("combobox");
            const recentValue = getRandomOption(testOptions.slice(1, -1));

            await combobox.evaluate((node: ComboboxField, v) => (node.value = v), recentValue);
            await expect(combobox).toHaveSyncedComboboxValue({ label: recentValue }, { matchingLabel: true });

            // Display `option`s for convenience
            await combobox.click();
            await expect(combobox).toBeExpanded({ options: testOptions });

            // Number of children in `listbox` should match the number of available `option`s
            const listbox = page.getByRole("listbox");
            const children = listbox.locator("*");
            const options = listbox.getByRole("option", { includeHidden: true });

            await expect(options).toHaveCount(testOptions.length);
            await expect(children).toHaveCount(testOptions.length);

            /* ---------- Assertions ---------- */
            // Add an invalid DOM Node with fake data
            await listbox.evaluate((node) => {
              const div = document.createElement("div");
              div.textContent = "Bad Option";
              div.setAttribute("selected", "");
              Object.assign(div, { label: "Bad Option", value: "bad", selected: true, defaultSelected: true });

              // NOTE: Node must be added AFTER all the bad data is applied
              node.appendChild(document.createElement("div"));
            });

            // Invalid DOM Node should have been rejected, and `combobox` value should not have been impacted.
            await expect(listbox.locator("div")).toHaveCount(0);
            await expect(options).toHaveCount(testOptions.length);
            await expect(children).toHaveCount(testOptions.length);
            await expect(combobox).toHaveSyncedComboboxValue({ label: recentValue }, { matchingLabel: true });
            await expect(combobox).not.toHaveSyncedComboboxValue({ label: initialValue }, { matchingLabel: true });
          });

          if (mode === "Filterable") {
            it("Filters the `option`s if they are changed while the `combobox` is expanded", async ({ page }) => {
              /* ---------- Setup ---------- */
              await renderComponent(page);

              /* ---------- Assertions ---------- */
              // Expand the `combobox`
              const combobox = page.getByRole("combobox");
              await combobox.click();
              await expect(combobox).toBeExpanded({ options: testOptions });

              // Verify that all `option`s are displayed
              const listbox = page.getByRole("listbox", { includeHidden: true });
              const filteredOutOptions = listbox.locator("[data-filtered-out]");
              const visibleOptions = listbox.getByRole("option");

              await expect(visibleOptions).toHaveCount(testOptions.length);
              await expect(filteredOutOptions).toHaveCount(0);

              const first = testOptions[0];
              const firstest = `${first}est` as const;

              await it.step("Adding a new `option`", async () => {
                await expect(combobox).toHaveText(first);

                // Add a new `option`
                await listbox.evaluate((node, label) => {
                  const option = document.createElement("combobox-option");
                  option.textContent = label;
                  node.appendChild(option);
                }, firstest);

                // Verify that the `option`s have been filtered
                const visibleOptionsCount = 2;
                await expect(visibleOptions).toHaveCount(visibleOptionsCount);
                await expect(filteredOutOptions).toHaveCount(9);

                // Verify that the filtered `option`s are properly navigable
                await expect(combobox).toHaveActiveOption(first);

                for (let i = 0; i < visibleOptionsCount; i++) await page.keyboard.press("ArrowDown");
                await expect(combobox).toHaveActiveOption(firstest);
                await expect(combobox).not.toHaveActiveOption(first);

                await page.keyboard.press("ArrowUp");
                await expect(combobox).toHaveActiveOption(first);
                await expect(combobox).not.toHaveActiveOption(firstest);

                await page.keyboard.press("End");
                await expect(combobox).toHaveActiveOption(firstest);

                await page.keyboard.press("Home");
                await expect(combobox).toHaveActiveOption(first);
              });

              await it.step("Removing an `option`", async () => {
                // Change filter
                await combobox.press("ControlOrMeta+A");
                await combobox.press(first.charAt(0));

                await expect(visibleOptions).toHaveCount(4);
                await expect(filteredOutOptions).toHaveCount(7);

                // Remove an `option`
                await page.getByRole("option", { name: firstest }).evaluate((node) => node.remove());
                const visibleOptionsCount = 3;
                await expect(visibleOptions).toHaveCount(visibleOptionsCount);
                await expect(filteredOutOptions).toHaveCount(7);

                // Verify that the filtered `option`s are properly navigable
                await expect(combobox).toHaveActiveOption(first);

                for (let i = 0; i < visibleOptionsCount; i++) await page.keyboard.press("ArrowDown");
                const fifth = testOptions[4];
                await expect(combobox).toHaveActiveOption(fifth);
                await expect(combobox).not.toHaveActiveOption(first);

                const fourth = testOptions[3];
                await page.keyboard.press("ArrowUp");
                await expect(combobox).toHaveActiveOption(fourth);
                await expect(combobox).not.toHaveActiveOption(fifth);

                await page.keyboard.press("ArrowUp");
                await expect(combobox).toHaveActiveOption(first);
                await expect(combobox).not.toHaveActiveOption(fourth);

                await page.keyboard.press("End");
                await expect(combobox).toHaveActiveOption(fifth);

                await page.keyboard.press("Home");
                await expect(combobox).toHaveActiveOption(first);
              });

              const noMatchesMessage = await combobox.evaluate((node: ComboboxField) => node.noMatchesMessage);
              const noMatchesElement = page.getByText(noMatchesMessage);

              await it.step("Removing all `option`s", async () => {
                // Remove all `option`s and check filtered results
                await listbox.evaluate((node) => node.replaceChildren());
                await expect(noMatchesElement).toBeVisible();

                await expect(visibleOptions).toHaveCount(0);
                await expect(filteredOutOptions).toHaveCount(0);

                // The navigation keys don't cause errors even though there are no available `option`s
                let error: Error | undefined;
                const trackEmittedError = (e: Error) => (error = e);
                page.once("pageerror", trackEmittedError);

                await combobox.press("ArrowDown");
                await combobox.press("ArrowUp");
                await combobox.press("End");
                await combobox.press("Home");

                expect(error).toBe(undefined);
                page.off("pageerror", trackEmittedError);
              });

              await it.step("Re-inserting all `option`s (simultaneously)", async () => {
                // Add all of the original `option`s back in
                await listbox.evaluate((node, opts) => {
                  const elements = opts.map((o) => {
                    const option = document.createElement("combobox-option");
                    option.textContent = o;
                    return option;
                  });

                  const fragment = document.createDocumentFragment();
                  fragment.append(...elements);
                  node.append(fragment);
                }, testOptions);

                // `First` was chosen by default in `unclearable` mode BEFORE filtering, so only it will be visible.
                await expect(visibleOptions).toHaveCount(1);
                await expect(filteredOutOptions).toHaveCount(9);
                await expect(noMatchesElement).not.toBeAttached();

                // Verify that the filtered `option`s are properly navigable
                await page.keyboard.press("ArrowDown");
                await expect(combobox).toHaveActiveOption(first);

                await page.keyboard.press("ArrowUp");
                await expect(combobox).toHaveActiveOption(first);

                await page.keyboard.press("End");
                await expect(combobox).toHaveActiveOption(first);

                await page.keyboard.press("Home");
                await expect(combobox).toHaveActiveOption(first);
              });

              await it.step("When the `combobox` is collapsed", async () => {
                // Collapse `combobox`
                await combobox.press("Escape");
                await expect(combobox).not.toBeExpanded();
                await expect(visibleOptions).toHaveCount(0);
                await expect(filteredOutOptions).toHaveCount(0);

                // Remove and re-insert an `option`
                await expect(combobox).toHaveText(first);
                await listbox.evaluate((node) => {
                  const lastOption = node.lastElementChild as ComboboxOption;
                  lastOption.remove();
                  node.append(lastOption);
                });

                // No `option` filtering should have occurred at all
                await expect(filteredOutOptions).toHaveCount(0);

                // We can check this by expanding the `combobox` too
                await combobox.press("Alt+ArrowDown");
                await expect(visibleOptions).toHaveCount(testOptions.length);
              });
            });
          }
        });

        it.describe("Miscellaneous form-associated behaviors", () => {
          createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
            it("Resets its value to the default `option` when its owning `form` is reset", async ({ page }) => {
              /* ---------- Setup ---------- */
              // Render Component
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <button type="reset">Reset</button>
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs(valueis)}>
                      <option value="1">One</option>
                      <option value="2" selected>Two</option>
                      <option value="3" selected>Three</option>
                      <option value="4" selected>Four</option>
                      <option value="5">Five</option>
                    </select>
                  </select-enhancer>
                </form>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis ?? "unclearable");

              // Display Options (for test-writing convenience)
              await combobox.click();

              // Verify that the first and last `option`s are not selected or `defaultSelected`
              const options = page.getByRole("option");
              await expect(options.first()).toHaveText("One");
              await expect(options.first()).toHaveAttribute("value", "1");
              await expect(options.first()).not.toHaveAttribute("selected");
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: "One", value: "1" });

              await expect(options.last()).toHaveText("Five");
              await expect(options.last()).toHaveAttribute("value", "5");
              await expect(options.last()).not.toHaveAttribute("selected");
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: "Five", value: "5" });

              const form = page.getByRole("form");
              const lastDefaultOption = page.locator("[role='option']:nth-last-child(1 of [selected])");

              /* ---------- Assertions ---------- */
              // Select last `option`
              await combobox.evaluate((node: ComboboxField) => (node.value = "5"));
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Five", value: "5" },
                { form: true, matchingLabel: true },
              );

              // Reset Form Value via USER INTERACTION (`<button type="reset">`)
              await page.getByRole("button", { name: "Reset" }).and(page.locator("button[type='reset']")).click();
              await expect(page.getByText("Four").and(lastDefaultOption)).toBeAttached();
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Four", value: "4" },
                { form: true, matchingLabel: true },
              );

              // Display `option`s again for convenience and re-select last `option`
              await combobox.click();
              await combobox.evaluate((node: ComboboxField) => (node.value = "5"));

              // Remove `defaultSelected` from `Four / 4`
              await lastDefaultOption.evaluate((node) => node.removeAttribute("selected"));
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Five", value: "5" },
                { form: true, matchingLabel: true },
              );

              // Reset Form Value MANUALLY (`HTMLFormElement.reset()`)
              await form.evaluate((f: HTMLFormElement) => f.reset());
              await expect(page.getByText("Three").and(lastDefaultOption)).toBeAttached();
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Three", value: "3" },
                { form: true, matchingLabel: true },
              );

              // Select last `option` yet again
              await combobox.evaluate((node: ComboboxField) => (node.value = "5"));

              // Remove `defaultSelected` from `Three / 3`
              await lastDefaultOption.evaluate((node) => node.removeAttribute("selected"));
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Five", value: "5" },
                { form: true, matchingLabel: true },
              );

              // Reset Form Value
              await form.evaluate((f: HTMLFormElement) => f.reset());
              await expect(page.getByText("Two").and(lastDefaultOption)).toBeAttached();
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Two", value: "2" },
                { form: true, matchingLabel: true },
              );
            });

            const ActionWithNoDefault =
              valueis === "anyvalue" || valueis === "clearable"
                ? "Resets its value to an empty string"
                : "Resets its value to the first `option`";

            it(`${ActionWithNoDefault} if the owning form is reset without a default \`option\``, async ({ page }) => {
              /* ---------- Setup ---------- */
              // Render Component
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <button type="reset">Reset</button>
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs(valueis)}>
                      <option value="1">One</option>
                      <option value="2">Two</option>
                      <option value="3">Three</option>
                    </select>
                  </select-enhancer>
                </form>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis ?? "unclearable");

              // Display Options (for test-writing convenience)
              await combobox.click();

              // Verify that the first `option` is not `defaultSelected`
              const options = page.getByRole("option");
              await expect(options.first()).toHaveText("One");
              await expect(options.first()).toHaveAttribute("value", "1");
              await expect(options.first()).not.toHaveAttribute("selected");

              // Verify that there are no `defaultSelected` `option`s at all
              await expect(options.and(page.locator("[selected]"))).not.toBeAttached();

              // Ensure the first `option` is not currently selected either
              await combobox.evaluate((node: ComboboxField) => (node.value = "3"));
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: "One", value: "1" });
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Three", value: "3" },
                { form: true, matchingLabel: true },
              );

              /* ---------- Assertions ---------- */
              // Reset Form Value
              const form = page.getByRole("form");
              await form.evaluate((f: HTMLFormElement) => f.reset());

              if (valueis === "anyvalue" || valueis === "clearable") {
                await it.step("When an Empty String Option is NOT available", async () => {
                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveComboboxValue("", { form: true });

                  const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });
                  await expect(selectedOption).not.toBeAttached();
                });
              } else {
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: "One", value: "1" },
                  { form: true, matchingLabel: true },
                );
              }

              if (valueis !== "anyvalue" && valueis !== "clearable") return;
              await it.step("When an Empty String Option IS available", async () => {
                // Add an Empty String Option to the `combobox`
                const emptyOptionData = { label: "Choose Something", value: "" } as const;
                const emptyOptionElement = options.and(page.locator('[value=""]'));
                await expect(emptyOptionElement).not.toBeAttached();

                await page.getByRole("listbox").evaluate((node, data) => {
                  const option = document.createElement("combobox-option");
                  option.value = data.value;
                  option.textContent = data.label;
                  node.prepend(option);
                }, emptyOptionData);

                await expect(emptyOptionElement).toBeAttached();

                // Set the `combobox`'s value to a non-empty string
                await combobox.evaluate((node: ComboboxField) => (node.value = "2"));
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: "Two", value: "2" },
                  { form: true, matchingLabel: true },
                );

                // Reset Form Value. Empty String `option` should be selected.
                await form.evaluate((f: HTMLFormElement) => f.reset());
                await expect(combobox).toHaveSyncedComboboxValue(emptyOptionData, { form: true, matchingLabel: true });
              });
            });
          });

          createFilterTypeDescribeBlocks(["clearable", "unclearable"], "both", (valueis) => {
            it("Does nothing when its owning `form` is reset if it has no `option`s", async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <button type="reset">Reset</button>
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs(valueis)}></select>
                  </select-enhancer>
                </form>
              `;

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveJSProperty("valueIs", valueis ?? "unclearable");
              await expect(combobox).toHaveComboboxValue(null, { form: true });
              await expect(combobox).toHaveText("");

              /* ---------- Assertions ---------- */
              // Nothing should break OR change when the `combobox` is reset by its owning `form` without any `option`s
              let error: Error | undefined;
              const trackEmittedError = (e: Error) => (error = e);
              page.once("pageerror", trackEmittedError);

              await page.getByRole("form").evaluate((f: HTMLFormElement) => f.reset());
              await new Promise((resolve) => setTimeout(resolve, 100));

              expect(error).toBe(undefined);
              page.off("pageerror", trackEmittedError);

              await expect(combobox).toHaveComboboxValue(null, { form: true });
              await expect(combobox).toHaveText("");
            });
          });

          it.skip("Enables browsers to restore its value when needed", async ({ page }) => {
            /* ---------- Setup ---------- */
            const name = "my-combobox";
            await page.goto(url);
            await renderHTMLToPage(page)`
              <form aria-label="Test Form">
                <a href="https://example.com">Example Domain</a>
                <input name="text" type="text" />
                <select-enhancer>
                  <select name="${name}">
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              </form>
            `;

            const combobox = page.getByRole("combobox");
            await expect(combobox).toHaveSyncedComboboxValue(
              { label: testOptions[0] },
              { form: true, matchingLabel: true },
            );

            /* ---------- Assertions ---------- */
            // Select an Option
            await combobox.click();
            const comboboxValue = getRandomOption(testOptions.slice(1));
            await page.getByRole("option", { name: comboboxValue }).click();
            await expect(combobox).toHaveSyncedComboboxValue(
              { label: comboboxValue },
              { form: true, matchingLabel: true },
            );

            // Fill in some other field values
            const textbox = page.getByRole("textbox");
            const textboxValue = "some-text";
            await textbox.fill(textboxValue);

            // Navigate to a new page, then go back to previous page
            await page.getByRole("link", { name: "Example Domain" }).click();
            await page.waitForURL("https://example.com"); // TODO: Remove when debugging finishes
            await page.goBack();

            // Form values should have been restored
            await page.waitForURL(url); // TODO: Remove when debugging finishes
            await expect(textbox).toHaveValue(textboxValue);
            await expect(combobox).toHaveSyncedComboboxValue(
              { label: comboboxValue },
              { form: true, matchingLabel: true },
            );
          });

          // TODO: Playwright does not yet support testing autofill: https://github.com/microsoft/playwright/issues/26831.
          it.skip("Supports browser autofilling", () => {
            throw new Error("Implement This Test!");
          });
        });
      });

      it.describe("Combobox Option (Web Component Part)", () => {
        it.describe("Exposed Properties and Attributes", () => {
          it.describe("label (Property)", () => {
            it("Returns the text content of the `option`", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    ${testOptions.map((o, i) => `<option value="${i + 1}">${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // Display `option`s
              await page.getByRole("combobox").click();
              const options = page.getByRole("option");

              const optionsCount = await options.count();
              expect(optionsCount).toBeGreaterThan(1);

              await Promise.all(
                [...Array(optionsCount)].map(async (_, i): Promise<void> => {
                  const option = options.nth(i);
                  await expect(option).toHaveJSProperty("label", testOptions[i]);
                  await expect(option).toHaveJSProperty("label", await option.textContent());

                  const newTextContent = await option.evaluate((o) => (o.textContent = `${Math.random()}`));
                  expect(newTextContent).not.toBe(testOptions[i]);
                  await expect(option).toHaveJSProperty("label", newTextContent);
                }),
              );
            });
          });

          it.describe("value (Attribute)", () => {
            it("Updates the value of the owning `combobox` when changed on a selected `option`", async ({ page }) => {
              /* ---------- Setup ---------- */
              const value = "1st";
              const first = testOptions[0];
              expect(value).not.toBe(first);
              await renderComponent(page, first);

              const name = "my-combobox";
              const combobox = page.getByRole("combobox");
              await associateComboboxWithForm(combobox, { name });
              await combobox.click();

              /* ---------- Assertions ---------- */
              // Without the attribute
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });

              // Adding the attribute
              const firstOption = page.getByRole("option").first();
              await firstOption.evaluate((node, v) => node.setAttribute("value", v), value);
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: first, value },
                { form: true, matchingLabel: true },
              );

              // Removing the attribute
              await firstOption.evaluate((node) => node.removeAttribute("value"));
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });

              // Updating an unselected `option`'s value does nothing to the `combobox` value
              const lastOption = page.getByRole("option").last();
              await lastOption.evaluate((node) => node.setAttribute("value", "ignored"));
              await expect(combobox).not.toHaveSyncedComboboxValue(
                { label: testOptions.at(-1) as string, value: "ignored" },
                { form: true },
              );

              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });
            });

            it("Synchronizes its own `id` when changed", async ({ page }) => {
              /* ---------- Setup ---------- */
              const value = "1st";
              const first = testOptions[0];
              expect(value).not.toBe(first);
              await renderComponent(page, first);

              /* ---------- Assertions ---------- */
              // Without a `value` attribute
              const comboboxId = await page.getByRole("combobox").getAttribute("id");
              const firstOption = page.getByRole("option", { name: first, includeHidden: true });

              await expect(firstOption).not.toHaveAttribute("value");
              await expect(firstOption).toHaveId(`${comboboxId}-option-${first}`);

              // Adding the attribute
              await firstOption.evaluate((node, v) => node.setAttribute("value", v), value);
              await expect(firstOption).toHaveId(`${comboboxId}-option-${value}`);

              // Removing the attribute
              await firstOption.evaluate((node) => node.removeAttribute("value"));
              await expect(firstOption).toHaveId(`${comboboxId}-option-${first}`);
            });
          });

          it.describe("value (Property)", () => {
            it("Exposes the underlying `value` attribute (defaults to `option`'s `label`)", async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              const option = Object.freeze({ label: "My Value", value: "my-value" });
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs("unclearable")}>
                      <option value="${option.value}" selected>${option.label}</option>
                    </select>
                  </select-enhancer>
                </form>
              `;

              /* ---------- Assertions ---------- */
              // Display Options
              const combobox = page.getByRole("combobox");
              await combobox.click();

              // `property` matches initial `attribute`
              const optionElement = page.getByRole("option");
              await expect(optionElement).toHaveJSProperty("value", option.value);
              await expect(combobox).toHaveSyncedComboboxValue(option, { form: true, matchingLabel: true });

              // `attribute` responds to `property` updates
              const newProp = "my-property";
              await optionElement.evaluate((node: ComboboxOption, v) => (node.value = v), newProp);
              await expect(optionElement).toHaveAttribute("value", newProp);

              await expect(combobox).toHaveSyncedComboboxValue(
                { ...option, value: newProp },
                { form: true, matchingLabel: true },
              );

              // `property` responds to `attribute` updates
              const newAttr = "my-attribute";
              await optionElement.evaluate((node, v) => node.setAttribute("value", v), newAttr);
              await expect(optionElement).toHaveJSProperty("value", newAttr);

              await expect(combobox).toHaveSyncedComboboxValue(
                { ...option, value: newAttr },
                { form: true, matchingLabel: true },
              );

              // `property` defaults to `label` in lieu of an `attribute`
              await optionElement.evaluate((node) => node.removeAttribute("value"));
              await expect(optionElement).toHaveJSProperty("label", option.label);
              await expect(optionElement).toHaveJSProperty("value", option.label);

              await expect(combobox).toHaveSyncedComboboxValue(
                { ...option, value: option.label },
                { form: true, matchingLabel: true },
              );
            });
          });

          it.describe("selected (Property)", () => {
            createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
              it("Indicates whether or not the `option` is currently selected", async ({ page }) => {
                // Setup
                const first = testOptions[0];
                const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
                await renderComponent(page, { initialValue: first, valueis });

                // Display Options
                const combobox = page.getByRole("combobox");
                await combobox.click();

                // Initially, the first `option` is selected
                const options = page.getByRole("option");
                await expect(options.first()).toHaveJSProperty("selected", true);
                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });

                // After changing the `combobox` value...
                await combobox.evaluate((node: ComboboxField, v) => (node.value = v), tenth);
                await expect(page.getByRole("option").first()).toHaveJSProperty("selected", false);
                await expect(page.getByRole("option").last()).toHaveJSProperty("selected", true);
              });

              it("Updates the value of the `combobox` when changed", async ({ page }) => {
                // Setup
                const first = testOptions[0];
                const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
                await renderComponent(page, { initialValue: first, valueis });

                const name = "my-combobox";
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name });

                // Display Options
                await combobox.click();

                // Initially, the first `option` is selected
                const options = page.getByRole("option");
                await expect(options.first()).toHaveJSProperty("selected", true);
                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });

                // The `selected` PROPERTY changes the `combobox` value
                await options.last().evaluate((node: ComboboxOption) => (node.selected = true));
                await expect(options.last()).toHaveJSProperty("selected", true);
                await expect(combobox).toHaveSyncedComboboxValue({ label: tenth }, { form: true, matchingLabel: true });

                await expect(options.first()).toHaveJSProperty("selected", false);
                await expect(combobox).not.toHaveSyncedComboboxValue(
                  { label: first },
                  { form: true, matchingLabel: true },
                );
              });

              let ActionOnDeselect = "Resets the value of the `combobox`";
              if (valueis === "anyvalue") ActionOnDeselect = "Sets the `combobox`'s value to its text content";
              else if (valueis === "clearable") ActionOnDeselect = "Empties the `combobox`'s value and text";

              it(`${ActionOnDeselect} when changed from \`true\` to \`false\``, async ({ page }) => {
                /* ---------- Setup ---------- */
                const name = "my-combobox";
                const first = testOptions[0];
                const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
                const defaultValue = getRandomOption(testOptions.slice(1, -1));

                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(valueis)}>
                        <option value="">Select Something</option>
                        ${testOptions.map((o) => `<option ${o === defaultValue ? "selected" : ""}>${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  </form>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("valueIs", valueis ?? ("unclearable" satisfies ValueIs));

                // Enable Observability of `ComboboxField.formResetCallback()`
                const getResetCount = observeResetCount(combobox);
                expect(await getResetCount()).toBe(0);

                // Verify correct default value
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: first }, { form: true });
                await expect(combobox).not.toHaveSyncedComboboxValue({ label: tenth }, { form: true });
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: defaultValue },
                  { form: true, matchingLabel: true },
                );

                // Display `option`s
                await combobox.click();

                /* ---------- Assertions ---------- */
                // Select last `option`, then deselect it
                const lastOption = page.getByRole("option", { name: tenth });
                await lastOption.evaluate((node: ComboboxOption) => (node.selected = true));
                await lastOption.evaluate((node: ComboboxOption) => (node.selected = false));
                const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });

                if (valueis === "anyvalue") {
                  await expect(combobox).toHaveText(tenth);
                  await expect(combobox).toHaveComboboxValue(tenth, { form: true });
                  await expect(selectedOption).not.toBeAttached();
                } else if (valueis === "clearable") {
                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveComboboxValue("", { form: true });
                  await expect(selectedOption).not.toBeAttached();
                } else {
                  // `combobox` value should have been reset
                  expect(await getResetCount()).toBe(1);

                  const defaultOption = page.getByRole("option", { name: defaultValue });
                  await expect(defaultOption).toHaveJSProperty("selected", true);
                  await expect(combobox).toHaveSyncedComboboxValue(
                    { label: defaultValue },
                    { form: true, matchingLabel: true },
                  );

                  await expect(lastOption).toHaveJSProperty("selected", false);
                  await expect(combobox).not.toHaveSyncedComboboxValue({ label: tenth }, { form: true });

                  // Resets still function properly if the `defaultOption` is de-selected
                  await defaultOption.evaluate((node: ComboboxOption) => (node.selected = false));

                  expect(await getResetCount()).toBe(2);
                  await expect(defaultOption).toHaveJSProperty("selected", true);
                  await expect(combobox).toHaveSyncedComboboxValue(
                    { label: defaultValue },
                    { form: true, matchingLabel: true },
                  );
                }
              });
            });
          });

          // NOTE: This attribute represents the `option` that should be selected by default, NOT the `selected` Property
          it.describe("selected (Attribute)", () => {
            createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
              // Note: This is the behavior of the native <select> element (for :not([multiple])).
              it("Initializes the `combobox` value to the last `selected` `option` that was rendered", async ({
                page,
              }) => {
                /* ---------- Setup ---------- */
                const name = "my-combobox";
                const localOptions = testOptions.slice(0, 3);

                await page.goto(url);
                await renderHTMLToPage(page)`
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${name}" ${getFilterAttrs(valueis)}>
                        <option>${localOptions[0]}</option>
                        <option selected>${localOptions[1]}</option>
                        <option selected>${localOptions[2]}</option>
                      </select>
                    </select-enhancer>
                  </form>
                `;

                const combobox = page.getByRole("combobox");
                await expect(combobox).toHaveJSProperty("valueIs", valueis ?? ("unclearable" satisfies ValueIs));

                /* ---------- Assertions ---------- */
                // Display `option`s
                await combobox.click();
                await expect(page.getByRole("option").and(page.locator("[selected]"))).toHaveCount(2);

                // Only the last `selected` option is marked as chosen
                await expect(page.getByRole("option").nth(-2)).toHaveAttribute("selected");
                await expect(page.getByRole("option").nth(-2)).toHaveJSProperty("selected", false);
                await expect(combobox).not.toHaveSyncedComboboxValue(
                  { label: localOptions.at(-2) as string },
                  { form: true, matchingLabel: true },
                );

                await expect(page.getByRole("option").last()).toHaveAttribute("selected");
                await expect(page.getByRole("option").last()).toHaveJSProperty("selected", true);
                await expect(combobox).toHaveSyncedComboboxValue(
                  { label: localOptions.at(-1) as string },
                  { form: true, matchingLabel: true },
                );
              });

              // NOTE: The native <select> element (somewhat) disables this functionality once it is modified.
              // We don't currently have a way to support that behavior without leaking implementation details.
              it("Updates the `option`'s `selected` PROPERTY when its value changes", async ({ page }) => {
                /* ---------- Setup ---------- */
                const first = testOptions[0];
                const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
                await renderComponent(page, { initialValue: first, valueis });

                const name = "my-combobox";
                const combobox = page.getByRole("combobox");
                await associateComboboxWithForm(combobox, { name });

                await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { form: true, matchingLabel: true });
                await expect(combobox).not.toHaveSyncedComboboxValue(
                  { label: tenth },
                  { form: true, matchingLabel: true },
                );

                /* ---------- Assertions ---------- */
                // Display `option`s
                await page.getByRole("combobox").click();

                // Making a new `option` selected by default
                const options = page.getByRole("option");
                await options.last().evaluate((node: ComboboxOption) => node.setAttribute("selected", ""));

                await expect(options.last()).toHaveJSProperty("selected", true);
                await expect(combobox).toHaveSyncedComboboxValue({ label: tenth }, { form: true, matchingLabel: true });
                await expect(combobox).not.toHaveSyncedComboboxValue(
                  { label: first },
                  { form: true, matchingLabel: true },
                );

                // Making a _selected_ + _defaultSelected_ `option` unselected by default
                await options.last().evaluate((node: ComboboxOption) => node.removeAttribute("selected"));
                await expect(options.last()).toHaveJSProperty("selected", false);
                await expect(combobox).not.toHaveSelectedOption({ label: tenth });

                const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });

                // Because the `selected` PROPERTY changed, the `combobox` value also should have been updated
                if (valueis === "anyvalue") {
                  await expect(selectedOption).not.toBeAttached();
                  await expect(combobox).toHaveText(tenth);
                  await expect(combobox).toHaveComboboxValue(tenth, { form: true });
                } else if (valueis === "clearable") {
                  await expect(selectedOption).not.toBeAttached();
                  await expect(combobox).toHaveText("");
                  await expect(combobox).toHaveComboboxValue("", { form: true });
                } else {
                  await expect(options.first()).toHaveJSProperty("selected", true);
                  await expect(combobox).toHaveSyncedComboboxValue(
                    { label: first },
                    { form: true, matchingLabel: true },
                  );
                }
              });
            });
          });

          it.describe("defaultSelected (Property)", () => {
            it("Exposes the underlying `selected` ATTRIBUTE", async ({ page }) => {
              /* ---------- Setup ---------- */
              const name = "my-combobox";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${name}" ${getFilterAttrs("unclearable")}>
                      ${testOptions.map((o) => `<option selected>${o}<option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;

              /* ---------- Assertions ---------- */
              // Display `option`s
              const combobox = page.getByRole("combobox");
              await combobox.click();

              // `property` matches initial `attribute`
              const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
              const lastOption = page.getByRole("option", { name: tenth });
              await expect(lastOption).toHaveJSProperty("defaultSelected", true);
              await expect(lastOption).toHaveJSProperty("selected", true);
              await expect(combobox).toHaveSyncedComboboxValue({ label: tenth }, { form: true, matchingLabel: true });

              // `attribute` responds to `property` updates
              await lastOption.evaluate((node: ComboboxOption) => (node.defaultSelected = false));
              await expect(lastOption).not.toHaveAttribute("selected");
              await expect(lastOption).toHaveJSProperty("selected", false);
              await expect(combobox).not.toHaveSyncedComboboxValue(
                { label: tenth },
                { form: true, matchingLabel: true },
              );

              await lastOption.evaluate((node: ComboboxOption) => (node.defaultSelected = true));
              await expect(lastOption).toHaveAttribute("selected");
              await expect(lastOption).toHaveJSProperty("selected", true);
              await expect(combobox).toHaveSyncedComboboxValue({ label: tenth }, { form: true, matchingLabel: true });

              // `property` also responds to `attribute` updates
              await lastOption.evaluate((node) => node.removeAttribute("selected"));
              await expect(lastOption).toHaveJSProperty("defaultSelected", false);
              await expect(combobox).not.toHaveSyncedComboboxValue(
                { label: tenth },
                { form: true, matchingLabel: true },
              );
            });
          });

          it.describe("disabled (Property)", () => {
            it("Exposes the underlying `aria-disabled` attribute", async ({ page }) => {
              /* ---------- Setup ---------- */
              const option = "Choose Me!!!";
              await page.goto(url);
              await renderHTMLToPage(page)`
                <select-enhancer>
                  <select ${getFilterAttrs("unclearable")}>
                    <option disabled>${option}</option>
                  </select>
                </select-enhancer>
              `;

              /* ---------- Assertions ---------- */
              // Display `option`s
              await page.getByRole("combobox").click();

              // `property` matches initial `attribute`
              const optionElement = page.getByRole("option", { name: option });
              await expect(optionElement).toHaveJSProperty("disabled", true);

              // `attribute` responds to `property` updates
              await optionElement.evaluate((node: ComboboxOption) => (node.disabled = false));
              await expect(optionElement).not.toHaveAttribute("aria-disabled");

              await optionElement.evaluate((node: ComboboxOption) => (node.disabled = true));
              await expect(optionElement).toHaveAttribute("aria-disabled", String(true));

              // `property` also responds to `attribute` updates
              await optionElement.evaluate((node) => node.removeAttribute("aria-disabled"));
              await expect(optionElement).toHaveJSProperty("disabled", false);
            });

            it("Prevents the `option` from being selected by the user", async ({ page }) => {
              /* ---------- Setup ---------- */
              const first = testOptions[0];
              const tenth = testOptions.at(-1) as GetLast<typeof testOptions>;
              await renderComponent(page);

              const combobox = page.getByRole("combobox");
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: tenth }, { matchingLabel: true });

              // Display `option`s
              await combobox.click();

              /* ---------- Assertions ---------- */
              // Disable last `option`
              const lastOption = page.getByRole("option").last();
              await lastOption.evaluate((node: ComboboxOption) => (node.disabled = true));

              // Try to choose last `option` with mouse (fails)
              await lastOption.click({ force: true }); // Force is necessary because `option` is `aria-disabled`
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: tenth }, { matchingLabel: true });

              // Try to choose last `option` with keyboard (fails)
              await combobox.press("End");
              await combobox.press("Enter");
              await expect(combobox).toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: tenth }, { matchingLabel: true });

              // Disabled values can still be selected _programmatically_
              await lastOption.evaluate((node: ComboboxOption) => (node.selected = true));
              await expect(combobox).toHaveSyncedComboboxValue({ label: tenth }, { matchingLabel: true });
              await expect(combobox).not.toHaveSyncedComboboxValue({ label: first }, { matchingLabel: true });
            });
          });

          it.describe("index (Property)", () => {
            it("Indicates the 0-indexed position of the `option`", async ({ page }) => {
              // Display `option`s
              await renderComponent(page);
              await page.getByRole("combobox").click();

              // Check `option` labels
              const options = page.getByRole("option");
              const count = await options.count();
              expect(count).toBeGreaterThan(1);

              await Promise.all([...Array(count)].map((_, i) => expect(options.nth(i)).toHaveJSProperty("index", i)));
            });
          });

          it.describe("form (Property)", () => {
            it("Exposes the `form` with which the `option`'s owning `combobox` is associated", async ({ page }) => {
              /* ---------- Setup ---------- */
              await page.goto(url);
              await renderHTMLToPage(page)`
                <form>
                  <select-enhancer>
                    <select ${getFilterAttrs("unclearable")}>
                      ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;

              /* ---------- Assertions ---------- */
              // Display options
              const combobox = page.getByRole("combobox");
              await combobox.click();

              // `option` has a semantic, IMPLICIT form
              const option = page.getByRole("option").first();
              expect(await option.evaluate((n: ComboboxOption) => n.form?.id)).toBe("");
              expect(await option.evaluate((n: ComboboxOption) => n.form instanceof HTMLFormElement)).toBe(true);

              // The `option`'s `form` property updates in response to attribute changes on the owning `combobox`
              const secondFormId = "final-form";
              await combobox.evaluate((n: ComboboxField, id) => n.setAttribute("form", id), secondFormId);
              expect(await option.evaluate((n: ComboboxOption) => n.form)).toBe(null);

              // The `option`'s `form` property updates in response to DOM changes
              await page.evaluate((id) => {
                document.body.insertAdjacentHTML("beforeend", `<form id="${id}"></form>`);
              }, secondFormId);
              expect(await option.evaluate((n: ComboboxOption) => n.form?.id)).toBe(secondFormId);
              expect(await option.evaluate((n: ComboboxOption) => n.form instanceof HTMLFormElement)).toBe(true);
            });
          });
        });
      });

      // NOTE: This is the necessary wrapper for the entire component
      it.describe("Select Enhancer (Web Component Part)", () => {
        it("Transfers the provided <select>'s attributes to the `combobox` during initialization", async ({ page }) => {
          /* ---------- Setup ---------- */
          await page.goto(url);
          await renderHTMLToPage(page)`
            <select-enhancer>
              <select id="combobox" name="my-name" required disabled ${getFilterAttrs("unclearable")}>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;

          /* ---------- Assertions ---------- */
          // The <select> and its corresponding attributes have been replaced altogether
          const select = page.locator("select");
          await expect(select).toHaveCount(0);

          // The `combobox` has inherited the <select>'s attributes
          const combobox = page.getByRole("combobox");
          await expect(combobox).toHaveAttribute("id", "combobox");
          await expect(combobox).toHaveAttribute("name", "my-name");
          await expect(combobox).toHaveAttribute("required", "");
          await expect(combobox).toHaveAttribute("disabled", "");
          if (mode === "Filterable") {
            await expect(combobox).toHaveAttribute("filter", "");
            await expect(combobox).toHaveAttribute("valueis", "unclearable");
          }
        });

        it('Creates a "unique" (random) ID for the `combobox` if one did not exist on the <select>', async ({
          page,
        }) => {
          /* ---------- Setup ---------- */
          await page.goto(url);
          await renderHTMLToPage(page)`
            <select-enhancer>
              <select ${getFilterAttrs("unclearable")}>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;

          /* ---------- Assertions ---------- */
          const id = await page.getByRole("combobox").getAttribute("id");
          expect(id).toEqual(expect.any(String));
          expect(id?.length).toBeGreaterThan(1);
        });

        it("Properly creates `option`s from the provided <option>s, preserving all relevant data", async ({ page }) => {
          /* ---------- Setup ---------- */
          await page.goto(url);
          await page.evaluate((m) => {
            const app = document.getElementById("app") as HTMLDivElement;

            // NOTE: <option>s are created dynamically to account for preservation of the `Option.selected` _property_
            const optionsContainer = document.createElement("template");
            optionsContainer.innerHTML = `
              <option label="1st" value="1" disabled selected>First</option>
              <option>Second</option>
              <option value="3" disabled>Third</option>
            `;

            (optionsContainer.content.lastElementChild as HTMLOptionElement).selected = true;

            const form = document.createElement("form");
            form.setAttribute("aria-label", "Test Form");

            const selectEnhancer = form.appendChild(document.createElement("select-enhancer"));
            const select = selectEnhancer.appendChild(document.createElement("select"));
            select.replaceChildren(...optionsContainer.content.children);
            select.setAttribute("name", "my-combobox");
            if (m === "Filterable") {
              select.setAttribute("filter", "");
              select.setAttribute("valueis", "unclearable");
            }

            app.replaceChildren(form);
          }, mode);

          /* ---------- Assertions ---------- */
          // Display options (for test-writing convenience)
          const combobox = page.getByRole("combobox");
          await combobox.click();

          // Option with All Attributes
          const optionAllAttributes = page.getByRole("option", { name: "1st" });
          await expect(optionAllAttributes).toHaveText("1st");
          await expect(optionAllAttributes).toHaveJSProperty("label", "1st");

          await expect(optionAllAttributes).toHaveAttribute("value", "1");
          await expect(optionAllAttributes).toHaveJSProperty("value", "1");

          await expect(optionAllAttributes).toHaveAttribute("aria-disabled", String(true));
          await expect(optionAllAttributes).not.toHaveAttribute("disabled");
          await expect(optionAllAttributes).toHaveJSProperty("disabled", true);

          await expect(optionAllAttributes).toHaveAttribute("selected", "");
          await expect(optionAllAttributes).toHaveJSProperty("defaultSelected", true);

          await expect(optionAllAttributes).toHaveJSProperty("selected", false);
          await expect(combobox).not.toHaveSyncedComboboxValue(
            { label: "1st", value: "1" },
            { form: true, matchingLabel: true },
          );

          // Option with No Attributes
          const optionWithoutAttributes = page.getByRole("option", { name: "Second" });
          await expect(optionWithoutAttributes).toHaveText("Second");
          await expect(optionWithoutAttributes).toHaveJSProperty("label", "Second");

          await expect(optionWithoutAttributes).not.toHaveAttribute("value");
          await expect(optionWithoutAttributes).toHaveJSProperty("value", "Second");

          await expect(optionWithoutAttributes).not.toHaveAttribute("aria-disabled");
          await expect(optionWithoutAttributes).not.toHaveAttribute("disabled");
          await expect(optionWithoutAttributes).toHaveJSProperty("disabled", false);

          await expect(optionWithoutAttributes).not.toHaveAttribute("selected", "");
          await expect(optionWithoutAttributes).toHaveJSProperty("defaultSelected", false);

          await expect(optionWithoutAttributes).toHaveJSProperty("selected", false);
          await expect(combobox).not.toHaveSyncedComboboxValue(
            { label: "Second" },
            { form: true, matchingLabel: true },
          );

          // Pre-Selected Option (via DOM manipulation _pre-mount_)
          const selectedOption = page.getByRole("option", { name: "Third", selected: true });
          await expect(selectedOption).toHaveText("Third");
          await expect(selectedOption).toHaveJSProperty("label", "Third");

          await expect(selectedOption).toHaveAttribute("value", "3");
          await expect(selectedOption).toHaveJSProperty("value", "3");

          await expect(selectedOption).toHaveAttribute("aria-disabled", String(true));
          await expect(selectedOption).not.toHaveAttribute("disabled");
          await expect(selectedOption).toHaveJSProperty("disabled", true);

          await expect(selectedOption).not.toHaveAttribute("selected");
          await expect(selectedOption).toHaveJSProperty("defaultSelected", false);

          await expect(selectedOption).toHaveJSProperty("selected", true);
          await expect(combobox).toHaveSyncedComboboxValue(
            { label: "Third", value: "3" },
            { form: true, matchingLabel: true },
          );
        });

        // NOTE: This is important for developers to be able to add "Cancel Buttons" or "Caret Icons" seamlessly
        it("Replaces only the provided <select> element and ignores everything else", async ({ page }) => {
          // Setup
          const dataIgnoredAttr = "data-ignored";
          const dataRejectedAttr = "data-rejected";

          await page.goto(url);
          await renderHTMLToPage(page)`
            <select-enhancer>
              <span role="option" ${dataIgnoredAttr}>I am ignored even though I have a "recognized" role</span>

              <select ${getFilterAttrs("unclearable")}>
                <option>Choose Me!!!</option>
                <div ${dataRejectedAttr}>Rejected due to not being a valid option</div>
              </select>

              <div role="listbox" ${dataIgnoredAttr}>I am ignored even though a \`listbox\` will be generated</div>
              <button ${dataIgnoredAttr}>I am ignored</button>
            </select-enhancer>
          `;

          // The <select> field is replaced. And invalid <select> options were removed.
          const container = page.locator("select-enhancer");
          await expect(container.locator("select, option")).toHaveCount(0);
          await expect(container.locator("combobox-field")).toHaveCount(1);
          await expect(container.getByRole("listbox", { includeHidden: true }).locator("*")).toHaveCount(1);
          await expect(container.getByRole("listbox", { includeHidden: true }).locator("combobox-option")).toHaveCount(
            1,
          );

          await expect(page.locator(`[${dataRejectedAttr}]`)).toHaveCount(0);

          // But the other elements are left alone
          await expect(container.locator(`[${dataIgnoredAttr}]`)).toHaveCount(3);
          await expect(container.getByRole("listbox", { includeHidden: true })).toHaveCount(2);
        });

        it("Has no accessible `role`", async ({ page }) => {
          // Setup
          await page.goto(url);
          await renderHTMLToPage(page)`
            <select-enhancer>
              <select ${getFilterAttrs("unclearable")}>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;

          // Container should not have an accessible `role`
          await expect(page.locator("select-enhancer")).toHaveRole("none");
        });

        createFilterTypeDescribeBlocks(["anyvalue", "clearable", "unclearable"], "both", (valueis) => {
          const Default = valueis === "anyvalue" || valueis === "clearable" ? "an empty string" : "the first `option`";
          it(`Defaults the \`combobox\` value to ${Default} if there is no default \`option\``, async ({ page }) => {
            // Setup
            const name = "my-combobox";
            await page.goto(url);
            await renderHTMLToPage(page)`
              <form aria-label="Test Form">
                <select-enhancer>
                  <select name="${name}" ${getFilterAttrs(valueis)}>
                    <option value="">Choose Something</option>
                    ${testOptions.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              </form>
            `;

            const combobox = page.getByRole("combobox");
            await expect(combobox).toHaveJSProperty("valueIs", valueis ?? ("unclearable" satisfies ValueIs));

            const options = page.getByRole("option", { includeHidden: true });
            await expect(options.and(page.locator("[selected]"))).toHaveCount(0);

            // Assertions
            const selectedOption = page.getByRole("option", { selected: true, includeHidden: true });

            if (valueis === "anyvalue" || valueis === "clearable") {
              await expect(combobox).toHaveText("");
              await expect(combobox).toHaveComboboxValue("", { form: true });
              await expect(selectedOption).not.toBeAttached();
            } else {
              await expect(options.first().and(selectedOption)).toBeAttached();
              await expect(combobox).toHaveSyncedComboboxValue(
                { label: "Choose Something", value: "" },
                { form: true, matchingLabel: true },
              );
            }
          });
        });
      });
    });

    it.describe("Miscellaneous Accessibility (A11y) Requirements", () => {
      it("Sets up the appropriate a11y relationships for a `combobox`", async ({ page }) => {
        await renderComponent(page);

        // Get Elements
        const combobox = page.getByRole("combobox");
        const listbox = page.getByRole("listbox");

        // Expand `combobox`
        await combobox.click();
        await expectOptionsToBeVisible(page);

        // Assert that the `combobox` has a meaningful ID (even if one isn't provided)
        await expect(combobox).toHaveAttribute("id", expect.stringMatching(/\w+/));

        // Assert that the `combobox` has the correct static ARIA attributes
        await expect(combobox).toHaveAttribute("aria-haspopup", "listbox");

        // Assert proper relationship between `combobox` and `listbox`
        await expect(combobox).toHaveAttribute("aria-controls", await listbox.evaluate((l) => l.id));
        await expect(listbox).toHaveAttribute("id", `${await combobox.getAttribute("id")}-listbox`);

        // Assert proper relationship between `combobox`, `listbox`, and `option`s
        for (const option of testOptions) {
          if (mode === "Regular") {
            await page.keyboard.type(option);
            await page.waitForTimeout(550); // Wait for Typeahead Search to reset before continuing
          } else {
            await page.keyboard.press("ControlOrMeta+A");
            await page.keyboard.press(option.split("").join("+"));
          }

          const optionEl = listbox.getByRole("option", { name: option });
          await expect(combobox).toHaveAttribute("aria-activedescendant", await optionEl.evaluate((o) => o.id));
          await expect(optionEl).toHaveAttribute("id", `${await combobox.getAttribute("id")}-option-${option}`);
        }

        // Assert proper relationship between `combobox` and any `option`s added _after_ mounting
        const newOptionValue = "Eleventh";
        await combobox.evaluate((node: ComboboxField, value) => {
          node.listbox.insertAdjacentHTML("beforeend", `<combobox-option>${value}</combobox-option>`);
        }, newOptionValue);

        if (mode === "Regular") await page.keyboard.type(newOptionValue);
        else {
          await page.keyboard.press("ControlOrMeta+A");
          await page.keyboard.press(newOptionValue.split("").join("+"));
        }
        const optionEl = listbox.getByRole("option", { name: newOptionValue });
        await expect(combobox).toHaveAttribute("aria-activedescendant", await optionEl.evaluate((o) => o.id));
        await expect(optionEl).toHaveAttribute("id", `${await combobox.getAttribute("id")}-option-${newOptionValue}`);
      });
    });
  });
}
