import { test as it, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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

it.describe("Combobox Web Component", () => {
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
  type RenderComponentOptions = { options: ReadonlyArray<string>; initialValue?: string };
  async function renderComponent(page: Page, options: RenderComponentOptions): Promise<void>;
  async function renderComponent(page: Page, initialValue?: string): Promise<void>;
  async function renderComponent(page: Page, config?: string | RenderComponentOptions): Promise<void> {
    await page.goto(url);
    const initialValue = typeof config === "object" ? config.initialValue : config;
    const opts = typeof config === "object" ? config.options : testOptions;

    return page.evaluate(
      ([options, value]) => {
        const app = document.getElementById("app") as HTMLDivElement;

        app.innerHTML = `
          <select-enhancer>
            <select id="component" name="my-name">
              ${options.map((o) => `<option${value === o ? " selected" : ""}>${o}</option>`).join("")}
            </select>
          </select-enhancer>
          <div style="font-size: 3rem; font-weight: bold; text-align: right; background-color: red; height: 500vh;">
            Container for testing scroll prevention
          </div>
        `;
      },
      [opts, initialValue] as const,
    );
  }

  function getRandomOption<T extends ReadonlyArray<string>>(options: T = testOptions as unknown as T): T[number] {
    const optionIndex = Math.floor(Math.random() * options.length);
    return options[optionIndex];
  }

  /* -------------------- Local Assertion Utilities -------------------- */
  // TODO: Should we provide the ability to pass in options besides `testOptions`?
  /** Asserts that the `combobox` is closed, and that none of the `option`s in the `listbox` are visible. */
  async function expectComboboxToBeClosed(page: Page): Promise<void> {
    await expect(page.getByRole("combobox")).toHaveAttribute(attrs["aria-expanded"], String(false));
    await expect(page.getByRole("listbox")).not.toBeVisible();
    expect(await page.getByRole("option").count()).toBe(0);
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
    const option = page.getByRole("option", { name: label });
    const combobox = page.getByRole("combobox");

    // Active `option` is clear to VISUAL USERS (HTML + CSS)
    if (active) await expect(option).toHaveAttribute(attrs["data-active"], String(true));
    else await expect(option).not.toHaveAttribute(attrs["data-active"], String(true));

    // Active `option` is ACCESSIBLE
    const optionId = (await option.getAttribute("id")) as string;
    if (active) await expect(combobox).toHaveAttribute(attrs["aria-activedescendant"], optionId);
    else await expect(combobox).not.toHaveAttribute(attrs["aria-activedescendant"], optionId);
  }

  /** Asserts that the current selected `option` is (or is not) the one having the specified `label` (and `value`) */
  async function expectOptionToBeSelected(page: Page, { label, value }: OptionInfo, selected = true): Promise<void> {
    const combobox = page.getByRole("combobox");
    const optionValue = value ?? label;
    const optionLabel = label;

    // Verify that the `combobox` has the correct `value`
    if (selected) {
      await expect(combobox).toHaveJSProperty("value", optionValue);
      await expect(combobox).toHaveText(label);
    }
    // Verify that the `combobox` DOES NOT have the indicated `value`
    else {
      await expect(combobox).not.toHaveJSProperty("value", optionValue);
      await expect(combobox).not.toHaveText(label);
    }

    // Verify that the `option` has the correct attributes/properties WITHOUT disrupting other tests.
    // This approach allows us to verify the accessible state of `option`s without requiring an expanded `combobox`.
    const option = page.getByText(optionLabel).and(page.locator("[role='option']"));
    await expect(option).toHaveAttribute(attrs["aria-selected"], String(selected));
    await expect(option).toHaveJSProperty("selected", selected);
  }

  /* -------------------- Tests -------------------- */
  it("Selects the first option by default", async ({ page }) => {
    await renderComponent(page);
    await expectOptionToBeSelected(page, { label: testOptions[0] });
  });

  it.describe("User Interactions", () => {
    it.describe("Mouse Interactions", () => {
      it("Becomes focused when clicked", async ({ page }) => {
        await renderComponent(page);
        const combobox = page.getByRole("combobox");

        await combobox.click();
        await expect(combobox).toBeFocused();
      });

      it("Toggles the display of `option`s when clicked", async ({ page }) => {
        await renderComponent(page);
        await expectComboboxToBeClosed(page);
        const combobox = page.getByRole("combobox");

        await combobox.click();
        await expectOptionsToBeVisible(page);

        await combobox.click();
        await expectComboboxToBeClosed(page);
      });

      it("Hides the list of `option`s when anything besides an `option` is clicked", async ({ page }) => {
        await renderComponent(page);
        const combobox = page.getByRole("combobox");

        // Clicking `listbox`
        await combobox.click();
        await expectOptionsToBeVisible(page);

        await page.getByRole("listbox").click({ position: { x: 0, y: 0 } });
        await expectComboboxToBeClosed(page);

        // Clicking `document.body`
        await combobox.click();
        await expectOptionsToBeVisible(page);

        await page.locator("body").click();
        await expectComboboxToBeClosed(page);
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
    });

    it.describe("Keyboard Interactions", () => {
      /** A reusable {@link Page.evaluate} callback used to obtain the `window`'s scrolling dimensions */
      const getWindowScrollDistance = () => ({ x: window.scrollX, y: window.scrollY }) as const;

      it("Is in the page `Tab` sequence", async ({ page }) => {
        await renderComponent(page);
        await page.keyboard.press("Tab");
        await expect(page.getByRole("combobox")).toBeFocused();
      });

      it.describe("ArrowDown", () => {
        it("Shows the `option`s (selected `option` is `active`)", async ({ page }) => {
          // Setup
          const initialValue = testOptions[0];
          await renderComponent(page);
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
          const initialValue = testOptions[0];
          await renderComponent(page);
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
          await expect(nextActiveOption).toHaveText(testOptions[1]);
          await expectOptionToBeActive(page, { label: testOptions[1] });
          await expectOptionToBeActive(page, { label: initialValue }, false);
        });

        it("DOES NOT update the `active` `option` if the last `option` is `active`", async ({ page }) => {
          /* ---------- Setup ---------- */
          const initialValue = testOptions[0];
          await renderComponent(page);
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

        it("Shows the `option`s when pressed with the `Alt` key (selected `option` is `active`)", async ({ page }) => {
          // Setup
          const initialValue = testOptions[0];
          await renderComponent(page);
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
          const initialValue = testOptions[0];
          await renderComponent(page);
          await expectComboboxToBeClosed(page);

          // Display Options
          await page.keyboard.press("Tab");
          await page.keyboard.press("Alt+ArrowDown");
          await expectOptionToBeActive(page, { label: initialValue });
          await expectOptionToBeActive(page, { label: testOptions.at(-1) as string }, false);

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
          const initialValue = testOptions.at(-1) as string;
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
          const initialValue = testOptions.at(-1) as string;
          await renderComponent(page, initialValue);
          await expectComboboxToBeClosed(page);
          await expectOptionToBeSelected(page, { label: initialValue });

          // Display Options
          await page.keyboard.press("Tab");
          await page.keyboard.press("ArrowUp");
          await expectOptionToBeActive(page, { label: initialValue });

          /* ---------- Assertions ---------- */
          const activeOption = page.getByRole("option", { name: initialValue });
          const previousActiveOption = page.locator(`[role='option']:has(+ #${await activeOption.getAttribute("id")})`);

          // Previous `option` activates
          await page.keyboard.press("ArrowUp");
          await expect(previousActiveOption).toHaveText(testOptions.at(-2) as string);
          await expectOptionToBeActive(page, { label: testOptions.at(-2) as string });
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
          const initialValue = testOptions.at(-1) as string;
          await renderComponent(page, initialValue);
          await expectComboboxToBeClosed(page);
          await expectOptionToBeSelected(page, { label: initialValue });

          // Display Options
          await page.keyboard.press("Tab");
          await page.keyboard.press("ArrowUp");
          await expectOptionsToBeVisible(page);
          await expectOptionToBeActive(page, { label: initialValue });

          /* ---------- Assertions ---------- */
          const previousOptionValue = testOptions.at(-2) as string;

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
          await page.keyboard.press(" ");
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
          await page.evaluate((options) => {
            const app = document.getElementById("app") as HTMLDivElement;

            app.innerHTML = `
              <dialog>
                <select-enhancer>
                  <select>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              </dialog>
            `;
          }, testOptions);

          /* ---------- Assertions ---------- */
          const combobox = page.getByRole("combobox");
          const dialog = page.locator("dialog");

          // Open `dialog` and `combobox`
          await dialog.evaluate((node: HTMLDialogElement) => node.showModal());
          await combobox.click();
          await expectOptionsToBeVisible(page);

          // Close `combobox` without closing `dialog` (i.e., without causing any side-effects)
          const defaultPrevented = page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              document.addEventListener("keydown", (event) => resolve(event.defaultPrevented), { once: true });
            });
          });

          await page.keyboard.press("Escape");
          await expectComboboxToBeClosed(page);
          await expect(dialog).toHaveJSProperty("open", true);
          expect(await defaultPrevented).toBe(true);

          // Properly close `dialog` now that `combobox` is closed
          const defaultNotPrevented = page.evaluate(() => {
            return new Promise<boolean>((resolve) => {
              document.addEventListener("keydown", (event) => resolve(!event.defaultPrevented), { once: true });
            });
          });

          await page.keyboard.press("Escape");
          await expect(dialog).toHaveJSProperty("open", false);
          await expect(combobox).not.toBeVisible();
          expect(await defaultNotPrevented).toBe(true);
        });
      });

      it.describe("SpaceBar (' ')", () => {
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

        /**
         * Associates the `combobox` on the provided page with the form element on the same page for testing. The
         * association can be `implicit` (moving the `combobox` _inside_ the form element and removing the `form`
         * attribute) or `explicit` (moving the `combobox` _outside_ the form element and giving it a valid `form`
         * attribute).
         *
         * If no form element exists on the page when this function is called, then one will be created.
         */
        function associateComboboxWithForm(page: Page, association: "implicit" | "explicit"): Promise<void> {
          return page.evaluate(
            ([assoc, attr, id]) => {
              // Find/Create Elements
              const component = document.querySelector("select-enhancer") as SelectEnhancer;
              const combobox = component.querySelector("[role='combobox']") as ComboboxField;
              if (assoc === "explicit") combobox.setAttribute("form", id);
              else combobox.removeAttribute("form");

              const form = document.querySelector("form") ?? document.createElement("form");
              form.id = id;
              form.setAttribute("aria-label", "Test Form");
              if (!form.hasAttribute(attr)) form.setAttribute(attr, String(0));

              // Arrange Elements
              if (!document.body.contains(form)) document.body.insertAdjacentElement("afterbegin", form);
              form.insertAdjacentElement(assoc === "explicit" ? "beforebegin" : "afterbegin", component);
            },
            [association, submissionCountAttr, formId] as const,
          );
        }

        /**
         * Registers the provided `onsubmit` event `handler` with the form element on the provided page.
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
          await associateComboboxWithForm(page, "implicit");
          await registerSubmissionHandler(page, defaultSubmissionHandler);
          await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(0));

          const combobox = page.getByRole("combobox");
          await combobox.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

          // Attempt submission when `combobox` is ASSOCIATED with the form via the `form` ATTRIBUTE
          await associateComboboxWithForm(page, "explicit");

          await combobox.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(2));

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

          await associateComboboxWithForm(page, "implicit");
          await registerSubmissionHandler(page, defaultSubmissionHandler);

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

            await associateComboboxWithForm(page, "implicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertInput);

            /* ---------- Assertions ---------- */
            // Create and Attach `input` Submitter
            await page.evaluate(() => {
              const input = document.createElement("input");
              input.setAttribute("type", "submit");
              input.setAttribute("value", "Submit Form");

              document.querySelector("form")?.appendChild(input);
            });

            // Submit Form
            let error: Error | undefined;
            const trackEmittedError = (e: Error) => (error = e);
            page.once("pageerror", trackEmittedError);

            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

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

            await associateComboboxWithForm(page, "implicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertButton);

            /* ---------- Assertions ---------- */
            // Create and Attach EXPLICIT `button` Submitter
            await page.evaluate((id) => {
              const button = document.createElement("button");
              button.setAttribute("type", "submit");
              button.setAttribute("form", id);
              button.textContent = "Submit Form";

              document.querySelector("form")?.insertAdjacentElement("afterend", button);
            }, formId);

            // Submit Form with EXPLICIT `button` Submitter
            let error: Error | undefined;
            const trackEmittedError = (e: Error) => (error = e);
            page.once("pageerror", trackEmittedError);

            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));
            expect(error).toBe(undefined);

            // Submit Form with IMPLICIT `button` Submitter (INVALID `type` attribute)
            await page.evaluate(() => document.querySelector("button")?.setAttribute("type", "INVALID"));
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(2));
            expect(error).toBe(undefined);

            // Submit Form with IMPLICIT `button` Submitter (OMITTED `type` attribute)
            await page.evaluate(() => document.querySelector("button")?.removeAttribute("type"));
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(3));
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

            await associateComboboxWithForm(page, "explicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertNoSubmitter);

            /* ---------- Assertions ---------- */
            let error: Error | undefined;
            const trackEmittedError = (e: Error) => (error = e);
            page.once("pageerror", trackEmittedError);

            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

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
            await associateComboboxWithForm(page, "explicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);

            // Create an _enabled_ `submitter`
            await page.evaluate(() => {
              const submitter = document.createElement("button");
              submitter.textContent = "Enabled Submitter";
              document.querySelector("form")?.appendChild(submitter);
            });

            /* -------------------- Assertions -------------------- */
            /* ---------- Disabled `button` Submitter ---------- */
            await page.evaluate((id) => {
              const disabledSubmitterButton = document.createElement("button");
              disabledSubmitterButton.setAttribute("disabled", "");
              disabledSubmitterButton.setAttribute("form", id);

              document.body.insertAdjacentElement("afterbegin", disabledSubmitterButton);
            }, formId);

            // Implicit Submission fails when the default `submitter` is disabled
            const combobox = page.getByRole("combobox");
            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(0));

            // Implicit Submission works when enabled (disabled default `submitter` removed)
            await page.getByRole("button", { disabled: true }).evaluate((node) => node.remove());
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

            /* ---------- Disabled `input` Submitter ---------- */
            await page.evaluate((id) => {
              const disabledSubmitterInput = document.createElement("input");
              disabledSubmitterInput.setAttribute("type", "submit");
              disabledSubmitterInput.setAttribute("disabled", "");
              disabledSubmitterInput.setAttribute("form", id);

              document.body.insertAdjacentElement("afterbegin", disabledSubmitterInput);
            }, formId);

            // Implicit Submission fails when the default `submitter` is disabled
            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

            // Implicit Submission works when the default `submitter` is enabled (disabled default `submitter` moved)
            await page.getByRole("button", { disabled: true }).evaluate((disabledSubmitter: HTMLButtonElement) => {
              const form = disabledSubmitter.form as HTMLFormElement;
              const enabledSubmitter: HTMLButtonElement = Array.prototype.find.call(form.elements, (e) => {
                return e instanceof HTMLButtonElement && e.type === "submit" && !e.disabled;
              });

              enabledSubmitter.insertAdjacentElement("afterend", disabledSubmitter);
            });

            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(2));
          });
        });
      });

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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select disabled>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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
            // Setup
            await renderComponent(page);

            const combobox = page.getByRole("combobox");
            await combobox.evaluate((node: ComboboxField) => (node.disabled = true));
            await expect(combobox).toHaveAttribute("disabled", "");

            // Assertions
            await combobox.click({ force: true });
            await expectComboboxToBeClosed(page);
            await expect(combobox).not.toBeFocused();

            await combobox.focus();
            await expect(combobox).not.toBeFocused();
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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select required>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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

          it("Marks the `combobox` as `invalid` when the `required` constraint is broken", async ({ page }) => {
            /* ---------- Setup ---------- */
            const error = "Please select an item in the list.";
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    <option value="">Select an Option</option>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

            /* ---------- Assertions (Dynamic Interactions) ---------- */
            // `combobox` starts off valid without constraints
            const combobox = page.getByRole("combobox");
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);

            // `combobox` becomes invalid when `required` is applied because of _empty_ value
            await combobox.evaluate((node: ComboboxField) => (node.required = true));
            await expectOptionToBeSelected(page, { label: "Select an Option", value: "" });
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

            // `combobox` becomes valid when a _non-empty_ value is selected
            await page.keyboard.press("Tab+End+Enter");
            await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string });
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);

            // `combobox` becomes invalid again when an _empty_ value is selected
            await page.keyboard.press("Home+Enter");
            await expectOptionToBeSelected(page, { label: "Select an Option", value: "" });
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

            /* ---------- Assertions (`onMount` Only) ---------- */
            // With _empty_ Initial Value
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select required>
                    <option value="">Select an Option</option>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

            // With _non-empty_ Initial Value
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select required>
                    <option value="">Select an Option</option>
                    ${options.map((o, i) => `<option${!i ? " selected" : ""}>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(false);
          });
        });

        it.describe("name (Property)", () => {
          it("Exposes the underlying `name` attribute", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialName = "initial-combobox";
            await page.goto(url);
            await page.evaluate(
              ([options, name]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <select-enhancer>
                    <select name="${name}">
                      ${options.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;
              },
              [testOptions, initialName] as const,
            );

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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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
            await page.evaluate(
              ([options, fieldName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${fieldName}">
                        <option value="">Select a Value</option>
                        ${options.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  </form>
                `;
              },
              [testOptions, name] as const,
            );

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

            const secondUserValue = testOptions[7];
            await combobox.click();
            await page.getByRole("option", { name: secondUserValue }).click();
            await expectOptionToBeSelected(page, { value: "7", label: "Eigth" });
            expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe("7");
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("7");
          });

          it("Updates the `value` of the `combobx`, including its `option`s and validity state", async ({ page }) => {
            // Setup
            const name = "my-combobox";
            await page.goto(url);
            await page.evaluate(
              ([options, fieldName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${fieldName}" required>
                        <option value="">Select a Value</option>
                        ${options.map((o, i) => `<option value="${i}">${o}</option>`).join("")}
                      </select>
                    </select-enhancer>
                  </form>
                `;
              },
              [testOptions, name] as const,
            );

            // Assertions
            const form = page.getByRole("form");
            const combobox = page.getByRole("combobox");

            const empty = { value: "", label: "Select a Value" };
            await expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);

            // Manually Make Value Valid
            const userValue = "7";
            await combobox.evaluate((node: ComboboxField, value) => (node.value = value), userValue);
            await expectOptionToBeSelected(page, { value: userValue, label: testOptions[userValue] });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(userValue);
            expect(await combobox.evaluate((node: ComboboxField) => node.checkValidity())).toBe(true);

            // Manually Make Value Invalid
            expect(await combobox.evaluate((node: ComboboxField, value) => (node.value = value), empty.value));
            await expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("");
            expect(await combobox.evaluate((node: ComboboxField) => node.reportValidity())).toBe(false);
          });

          it("Rejects values that are not found in the available `option`s", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Associate Combobox with a `form`
            const name = "my-combobox";
            const combobox = page.getByRole("combobox");
            await combobox.evaluate((node: ComboboxField, fieldName) => {
              const formId = "test-form";
              node.setAttribute("name", fieldName);
              node.setAttribute("form", formId);
              document.body.insertAdjacentHTML("beforeend", `<form id="${formId}" aria-label="Test Form"></form>`);
            }, name);

            const form = page.getByRole("form");
            await expect(form).toHaveJSProperty(`elements.${name}.name`, name);

            /* ---------- Assertions ---------- */
            // Invalid values are rejected
            const invalidValue = Math.random().toString(36).slice(2);
            await combobox.evaluate((node: ComboboxField, value) => (node.value = value), invalidValue);

            expect(await combobox.evaluate((node: ComboboxField) => node.value)).not.toBe(invalidValue);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(invalidValue);

            await expectOptionToBeSelected(page, { label: initialValue });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(initialValue);

            // Valid values are accepted
            const goodValue = getRandomOption(testOptions.slice(1));
            await combobox.evaluate((node: ComboboxField, value) => (node.value = value), goodValue);

            expect(await combobox.evaluate((node: ComboboxField) => node.value)).toBe(goodValue);
            await expectOptionToBeSelected(page, { label: initialValue }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(initialValue);

            await expectOptionToBeSelected(page, { label: goodValue });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(goodValue);
          });

          it("Is `null` when the `combobox` is uninitialized (e.g., when there are no `option`s)", async ({ page }) => {
            // Setup
            const name = "my-combobox";
            await page.goto(url);
            await page.evaluate((fieldName) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <form aria-label="Test Form">
                  <select-enhancer>
                    <select name="${fieldName}" required></select>
                  </select-enhancer>
                </form>
              `;
            }, name);

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

        it.describe("labels (Property)", () => {
          it("Exposes any `label`s associated with the `combobox`", async ({ page }) => {
            /* ---------- Setup ---------- */
            const comboboxId = "combobox";
            const firstLabel = "This is a Combobox";
            const secondLabel = "Value Selector";

            await page.goto(url);
            await page.evaluate(
              ([options, [id, label1]]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <label for="${id}">${label1}</label>
                  <select-enhancer>
                    <select id="${id}">
                      ${options.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                `;
              },
              [testOptions, [comboboxId, firstLabel]] as const,
            );

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
              ([id, label2]) => document.body.insertAdjacentHTML("beforeend", `<label for="${id}">${label2}</label>`),
              [comboboxId, secondLabel] as const,
            );

            expect(await combobox.evaluate((n: ComboboxField) => n.labels.length)).toBe(2);
            expect(await combobox.evaluate((n: ComboboxField) => n.labels[0].textContent)).toBe(firstLabel);
            expect(await combobox.evaluate((n: ComboboxField) => n.labels[1].textContent)).toBe(secondLabel);
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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <form>
                  <select-enhancer>
                    <select>
                      ${options.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Combobox has a semantic form
            const combobox = page.getByRole("combobox");
            expect(await combobox.evaluate((n: ComboboxField) => n.form?.id)).toBe("");
            expect(await combobox.evaluate((n: ComboboxField) => n.form instanceof HTMLFormElement)).toBe(true);

            // Combobox `form` property updates in response to attribute changes
            const form2Id = "final-form";
            await combobox.evaluate((n: ComboboxField, secondFormId) => n.setAttribute("form", secondFormId), form2Id);
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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    <option value="">Select an Option</option>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    <option value="">Select an Option</option>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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

      it.describe("Validation Methods", () => {
        /*
         * NOTE: Currently, according to our knowledge, there's no way to run assertions on the native error bubbles
         * created by browsers.
         */
        for (const method of ["checkValidity", "reportValidity"] as const) {
          it(`Performs field validation when \`${method}\` is called`, async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select required>
                    <option value="">Select an Option</option>
                    ${options.map((o) => `<option>${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Validation on an invalid `combobox`
            const combobox = page.getByRole("combobox");
            const invalidEventEmitted = combobox.evaluate((node: ComboboxField) => {
              return new Promise<boolean>((resolve, reject) => {
                const timeout = setTimeout(reject, 3000, "The `invalid` event was never emitted by a <combobox-field>");

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
        }
      });

      it.describe("Dispatched Events", () => {
        for (const event of ["input", "change"] as const) {
          it(`Dispatches an \`${event}\` event when the user selects a new \`option\``, async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = getRandomOption(testOptions.slice(1));
            await renderComponent(page, initialValue);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            // event is emitted AFTER the value is changed
            const newValue = getRandomOption(testOptions.filter((o) => o !== initialValue));
            const combobox = page.getByRole("combobox");

            const eventEmitted = page.evaluate((e) => {
              return new Promise<boolean>((resolve, reject) => {
                const timeout = setTimeout(reject, 3000, `The \`${e}\` event was never emitted by a <combobox-field>.`);

                document.addEventListener(
                  e,
                  (evt) => {
                    if (evt.constructor !== Event) return;
                    if (evt.target?.constructor !== customElements.get("combobox-field")) return;
                    clearTimeout(timeout);
                    resolve(true);
                  },
                  { once: true },
                );
              });
            }, event);

            await combobox.click();
            await page.getByRole("option", { name: newValue }).click();

            await expectOptionToBeSelected(page, { label: newValue });
            await expectOptionToBeSelected(page, { label: initialValue }, false);
            expect(await eventEmitted).toBe(true);

            // event is NOT emitted if the value does not change
            const eventNotEmitted = page.evaluate((e) => {
              return new Promise<boolean>((resolve, reject) => {
                const timeout = setTimeout(resolve, 3000, true);

                document.addEventListener(
                  e,
                  () => {
                    clearTimeout(timeout);
                    reject(new Error(`The \`${e}\` event should not have been emitted by the <combobox-field>`));
                  },
                  { once: true },
                );
              });
            }, event);

            await combobox.click();
            await page.getByRole("option", { name: newValue }).click();

            await expectOptionToBeSelected(page, { label: newValue });
            expect(await eventNotEmitted).toBe(true);
          });
        }
      });

      it.describe("Dynamic `option` Management (Complies with Native <select>)", () => {
        it("Updates its value when a new `defaultSelected` `option` is added", async ({ page }) => {
          /* ---------- Setup ---------- */
          const name = "my-combobox";
          await page.goto(url);
          await page.evaluate((fieldName) => {
            const app = document.getElementById("app") as HTMLDivElement;
            app.innerHTML = `
              <form aria-label="Test Form">
                <select-enhancer>
                  <select name="${fieldName}">
                    <option value="1">One</option>
                    <option value="2" selected>Two</option>
                    <option value="3">Three</option>
                  </select>
                </select-enhancer>
              </form>
            `;
          }, name);

          /* ---------- Assertions ---------- */
          // Display `option`s (Not necessary, but makes this test easier to write)
          const combobox = page.getByRole("combobox");
          await combobox.click();

          // Intial value should match the `defaultSelected` `option`
          const firstOption = page.getByRole("option").first();
          await expect(firstOption.and(page.getByRole("option", { selected: true }))).not.toBeAttached();

          const form = page.getByRole("form");
          await expectOptionToBeSelected(page, { label: "Two", value: "2" });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("2");
          await expect(page.getByRole("option", { selected: true })).toHaveAttribute("selected");

          // After adding a _new_ `defaultSelected` `option`, the `combobox` value should update
          await combobox.evaluate((node: ComboboxField) => {
            node.listbox.insertAdjacentHTML("beforeend", '<combobox-option value="4" selected>Four</combobox-option>');
          });

          await expectOptionToBeSelected(page, { label: "Four", value: "4" });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("4");
        });

        it("Resets its value to the first `option` if the selected one is removed", async ({ page }) => {
          /* ---------- Setup ---------- */
          const name = "my-combobox";
          await page.goto(url);
          await page.evaluate((fieldName) => {
            const app = document.getElementById("app") as HTMLDivElement;
            app.innerHTML = `
              <form aria-label="Test Form">
                <select-enhancer>
                  <select name="${fieldName}">
                    <option value="1">One</option>
                    <option value="2">Two</option>
                    <option value="3">Three</option>
                    <option value="4" selected>Four</option>
                  </select>
                </select-enhancer>
              </form>
            `;
          }, name);

          /* ---------- Assertions ---------- */
          // Display Options (Not necessary, but makes this test easier to write)
          const combobox = page.getByRole("combobox");
          await combobox.click();

          // Intial value should match the `defaultSelected` `option`
          const firstOption = page.getByRole("option").first();
          const selectedOption = page.getByRole("option", { selected: true });

          const form = page.getByRole("form");
          await expectOptionToBeSelected(page, { label: "Four", value: "4" });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("4");
          await expect(firstOption.and(selectedOption)).not.toBeAttached();

          // `combobox` value changes to first `option` when the selected `option` is removed
          await selectedOption.evaluate((node) => node.remove());
          await expect(firstOption.and(selectedOption)).toBeAttached();

          await expect(firstOption).toHaveAttribute("value", "1");
          await expect(combobox).toHaveJSProperty("value", (await firstOption.getAttribute("value")) as string);
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
            await firstOption.getAttribute("value"),
          );

          // This behavior still works even if the first `option` is removed after being selected
          await selectedOption.evaluate((node) => node.remove());
          await expect(firstOption.and(selectedOption)).toBeVisible();

          await expect(firstOption).toHaveAttribute("value", "2");
          await expect(combobox).toHaveJSProperty("value", (await firstOption.getAttribute("value")) as string);
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
            await firstOption.getAttribute("value"),
          );
        });

        it("Resets its value to `null` if all `option`s are removed", async ({ page }) => {
          /* ---------- Setup ---------- */
          await renderComponent(page);
          await expectOptionToBeSelected(page, { label: testOptions[0] });

          /* ---------- Asertions ---------- */
          // Display `option`s (for test-writing convenience)
          const combobox = page.getByRole("combobox");
          await combobox.click();

          // Associate `combobox` with a `form`
          const name = "my-combobox";
          await combobox.evaluate((node: ComboboxField, fieldName) => {
            const formId = "test-form";
            node.setAttribute("name", fieldName);
            node.setAttribute("form", formId);
            document.body.insertAdjacentHTML("beforeend", `<form id="${formId}" aria-label="Test Form"></form>`);
          }, name);

          const form = page.getByRole("form");
          await expect(form).toHaveJSProperty(`elements.${name}.name`, name);

          // Remove all nodes 1-BY-1
          await combobox.evaluate((node: ComboboxField) => {
            while (node.listbox.children.length) node.listbox.children[0].remove();
          });

          await expect(page.getByRole("listbox")).toBeEmpty();
          await expect(combobox).toHaveText("");
          await expect(combobox).toHaveJSProperty("value", null);
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

          // Add all the `option`s back in and verify that the value updates
          await combobox.evaluate((node: ComboboxField, options) => {
            const { listbox } = node;
            options.forEach((o) => listbox.insertAdjacentHTML("beforeend", `<combobox-option>${o}</combobox-option>`));
          }, testOptions);

          await expectOptionToBeSelected(page, { label: testOptions[0] });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(testOptions[0]);

          // Remove all the options again, but SIMULTANEOUSLY. Then verify that the `combobox` value resets again.
          await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
          await expect(page.getByRole("listbox")).toBeEmpty();
          await expect(combobox).toHaveText("");
          await expect(combobox).toHaveJSProperty("value", null);
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);
        });

        it("Updates its value if a new `option` is added and there are no pre-existing `option`s", async ({ page }) => {
          /* ---------- Setup ---------- */
          await renderComponent(page);

          // Associate Combobox with a `form`
          const name = "my-combobox";
          const combobox = page.getByRole("combobox");
          await combobox.evaluate((node: ComboboxField, fieldName) => {
            const formId = "test-form";
            node.setAttribute("name", fieldName);
            node.setAttribute("form", formId);
            document.body.insertAdjacentHTML("beforeend", `<form id="${formId}" aria-label="Test Form"></form>`);
          }, name);

          /* ---------- Assertions ---------- */
          // Display `option`s for test-writing convenience
          await combobox.click();

          // Remove all `option`s, then add new ones 1-BY-1
          await combobox.evaluate((node: ComboboxField) => node.listbox.replaceChildren());
          const newOptions = Object.freeze(["10", "20", "30", "40", "50"] as const);
          await combobox.evaluate((node: ComboboxField, options) => {
            const { listbox } = node;
            options.forEach((o) => listbox.insertAdjacentHTML("afterbegin", `<combobox-option>${o}</combobox-option>`));
          }, newOptions);

          // The first _inserted_ `option` should now be the selected one (not necessarily the first `option` itself)
          const form = page.getByRole("form");
          const firstOption = page.getByRole("option").first();
          await expect(firstOption.and(page.getByRole("option", { selected: true }))).not.toBeAttached();
          await expectOptionToBeSelected(page, { label: newOptions[0] });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(newOptions[0]);

          // Remove all `option`s, then add new one's SIMULTANEOUSLY
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

          // The first _inserted_ `option` should again be the selected one. (Due to batching, first `option` is selected now.)
          await expect(firstOption.and(page.getByRole("option", { selected: true }))).toBeAttached();
          await expectOptionToBeSelected(page, { label: newOptions.at(-1) as string });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(newOptions.at(-1));

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

          // The first _inserted_ `option` should again be the selected one. (Due to batching, first `option` is selected now.)
          await expect(firstOption.and(page.getByRole("option", { selected: true }))).toBeAttached();
          await expectOptionToBeSelected(page, { label: letterOptions[middleLetterIndex] });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
            letterOptions[middleLetterIndex],
          );
        });
      });

      it.describe("Miscellaneous form-associated behaviors", () => {
        it("Resets its value to the default `option` when its owning `form` is reset", async ({ page }) => {
          /* ---------- Setup ---------- */
          // Render Component
          const name = "my-combobox";
          await page.goto(url);
          await page.evaluate((fieldName) => {
            const app = document.getElementById("app") as HTMLDivElement;
            app.innerHTML = `
              <form aria-label="Test Form">
                <button type="reset">Reset</button>
                <select-enhancer>
                  <select name="${fieldName}">
                    <option value="1">One</option>
                    <option value="2" selected>Two</option>
                    <option value="3" selected>Three</option>
                    <option value="4" selected>Four</option>
                    <option value="5">Five</option>
                  </select>
                </select-enhancer>
              </form>
            `;
          }, name);

          // Display Options (for test-writing convenience)
          const combobox = page.getByRole("combobox");
          await combobox.click();

          // Verify that the first and last `option`s are not selected or `defaultSelected`
          const options = page.getByRole("option");
          await expect(options.first()).toHaveText("One");
          await expect(options.first()).toHaveAttribute("value", "1");
          await expect(options.first()).not.toHaveAttribute("selected");
          await expectOptionToBeSelected(page, { label: "One", value: "1" }, false);

          await expect(options.last()).toHaveText("Five");
          await expect(options.last()).toHaveAttribute("value", "5");
          await expect(options.last()).not.toHaveAttribute("selected");
          await expectOptionToBeSelected(page, { label: "Five", value: "5" }, false);

          const form = page.getByRole("form");
          const lastDefaultOption = page.locator("[role='option']:nth-last-child(1 of [selected])");

          /* ---------- Assertions ---------- */
          await it.step("Try with default `option`s", async () => {
            // Select last `option`
            await combobox.evaluate((node: ComboboxField) => (node.value = "5"));
            await expectOptionToBeSelected(page, { label: "Five", value: "5" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("5");

            // Reset Form Value via USER INTERACTION (`<button type="reset">`)
            await page.getByRole("button", { name: "Reset" }).and(page.locator("button[type='reset']")).click();
            await expectOptionToBeSelected(page, { label: "Four", value: "4" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("4");
            await expect(page.getByText("Four").and(lastDefaultOption)).toBeAttached();

            // Display `option`s again for convenience
            await combobox.click();

            // Select last `option` again
            await combobox.evaluate((node: ComboboxField) => (node.value = "5"));
            await expectOptionToBeSelected(page, { label: "Five", value: "5" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("5");

            // Remove `defaultSelected` from `Four / 4`
            await lastDefaultOption.evaluate((node) => node.removeAttribute("selected"));

            // Reset Form Value MANUALLY (`HTMLFormElement.reset()`)
            await form.evaluate((f: HTMLFormElement) => f.reset());
            await expectOptionToBeSelected(page, { label: "Three", value: "3" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("3");
            await expect(page.getByText("Three").and(lastDefaultOption)).toBeAttached();

            // Select last `option` yet again
            await combobox.evaluate((node: ComboboxField) => (node.value = "5"));
            await expectOptionToBeSelected(page, { label: "Five", value: "5" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("5");

            // Remove `defaultSelected` from `Three / 3`
            await lastDefaultOption.evaluate((node) => node.removeAttribute("selected"));

            // Reset Form Value
            await form.evaluate((f: HTMLFormElement) => f.reset());
            await expectOptionToBeSelected(page, { label: "Two", value: "2" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("2");
            await expect(page.getByText("Two").and(lastDefaultOption)).toBeAttached();
          });

          await it.step("Try WITHOUT default `option`s", async () => {
            // Remove the last `defaultOption`
            await lastDefaultOption.evaluate((node) => node.removeAttribute("selected"));
            await expect(lastDefaultOption).not.toBeAttached();

            // Choose last `option` for the final time
            await combobox.evaluate((node: ComboboxField) => (node.value = "5"));
            await expectOptionToBeSelected(page, { label: "Five", value: "5" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("5");

            // Reset Form Value
            await form.evaluate((f: HTMLFormElement) => f.reset());
            await expectOptionToBeSelected(page, { label: "One", value: "1" });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe("1");
          });
        });

        it("Does nothing when its owning `form` is reset if it has no `option`s", async ({ page }) => {
          /* ---------- Setup ---------- */
          const name = "my-combobox";
          await page.goto(url);
          await page.evaluate((fieldName) => {
            const app = document.getElementById("app") as HTMLDivElement;
            app.innerHTML = `
              <form aria-label="Test Form">
                <button type="reset">Reset</button>
                <select-enhancer>
                  <select name="${fieldName}"></select>
                </select-enhancer>
              </form>
            `;
          }, name);

          const form = page.getByRole("form");
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);

          /* ---------- Assertions ---------- */
          // Nothing should break OR change when the `combobox` is reset by its owning `form` without any `option`s
          let error: Error | undefined;
          const trackEmittedError = (e: Error) => (error = e);
          page.once("pageerror", trackEmittedError);

          await form.evaluate((f: HTMLFormElement) => f.reset());
          await new Promise((resolve) => setTimeout(resolve, 250));

          expect(error).toBe(undefined);
          page.off("pageerror", trackEmittedError);
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(null);
        });

        it.skip("Enables browsers to restore its value when needed", async ({ page }) => {
          /* ---------- Setup ---------- */
          const name = "my-combobox";
          await page.goto(url);
          await page.evaluate(
            ([options, fieldName]) => {
              const app = document.getElementById("app") as HTMLDivElement;
              app.innerHTML = `
                <form aria-label="Test Form">
                  <a href="https://example.com">Example Domain</a>
                  <input name="text" type="text" />
                  <select-enhancer>
                    <select name="${fieldName}">
                      ${options.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;
            },
            [testOptions, name] as const,
          );

          await expectOptionToBeSelected(page, { label: testOptions[0] });

          /* ---------- Assertions ---------- */
          // Select an Option
          await page.getByRole("combobox").click();
          const comboboxValue = getRandomOption(testOptions.slice(1));
          await page.getByRole("option", { name: comboboxValue }).click();

          const form = page.getByRole("form");
          await expectOptionToBeSelected(page, { label: comboboxValue });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(comboboxValue);

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
          await expectOptionToBeSelected(page, { label: comboboxValue });
          expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(comboboxValue);
        });

        // TODO: Playwright does not yet support testing autofill: https://github.com/microsoft/playwright/issues/26831.
        it.skip("Supports browser autofilling", () => {
          throw new Error("Implement This Test!");
        });
      });
    });

    it.describe("Combobox Option (Web Component Part)", () => {
      it.describe("Exposed Properties and Attributes", () => {
        /*
         * TODO: We have another function like this one somewhere else within our test file.
         * We should probably just make that function available to all of our tests.
         */
        /**
         * Associates the provided `combobox` with a newly-created `<form>` element and
         * gives the `combobox` the provided `name`.
         */
        async function associateComboboxWithForm(combobox: ReturnType<Page["locator"]>, name?: string): Promise<void> {
          await expect(combobox).toHaveRole("combobox");
          return combobox.evaluate((node: ComboboxField, fieldName) => {
            const formId = Math.random().toString(36).slice(2);
            node.setAttribute("form", formId);
            if (fieldName) node.setAttribute("name", fieldName);
            document.body.insertAdjacentHTML("beforeend", `<form id="${formId}" aria-label="Test Form"></form>`);
          }, name);
        }

        it.describe("label (Property)", () => {
          it("Returns the text content of the `option`", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    ${options.map((o, i) => `<option value="${i + 1}">${o}</option>`).join("")}
                  </select>
                </select-enhancer>
              `;
            }, testOptions);

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
            // Setup
            const value = "1st";
            expect(value).not.toBe(testOptions[0]);
            await renderComponent(page);

            const name = "my-combobox";
            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, name);

            const form = page.getByRole("form");
            await combobox.click();

            // Adding the attribute
            const firstOption = page.getByRole("option").first();
            await firstOption.evaluate((node, v) => node.setAttribute("value", v), value);
            await expectOptionToBeSelected(page, { label: testOptions[0], value });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(value);

            // Removing the attribute
            await firstOption.evaluate((node) => node.removeAttribute("value"));
            await expectOptionToBeSelected(page, { label: testOptions[0] });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(testOptions[0]);

            // Updating an unselected `option`'s value does nothing to the `combobox` value
            const lastOption = page.getByRole("option").last();
            await lastOption.evaluate((node) => node.setAttribute("value", "ignored"));
            await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string, value: "ignored" }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
              testOptions.at(-1),
            );

            await expectOptionToBeSelected(page, { label: testOptions[0] });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(testOptions[0]);
          });
        });

        it.describe("value (Property)", () => {
          it("Exposes the underlying `value` attribute (defaults to `option`'s text content)", async ({ page }) => {
            /* ---------- Setup ---------- */
            const name = "my-combobox";
            const option = Object.freeze({ label: "My Value", value: "my-value" });
            await page.goto(url);
            await page.evaluate(
              ([o, fieldName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${fieldName}">
                        <option value="${o.value}">${o.label}</option>
                      </select>
                    </select-enhancer>
                  </form>
                `;
              },
              [option, name] as const,
            );

            const form = page.getByRole("form");

            /* ---------- Assertions ---------- */
            // Display Options
            await page.getByRole("combobox").click();

            // `property` matches initial `attribute`
            const optionElement = page.getByRole("option");
            await expect(optionElement).toHaveJSProperty("value", option.value);
            await expectOptionToBeSelected(page, option);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(option.value);

            // `attribute` responds to `property` updates
            const newValueProperty = "my-property";
            await optionElement.evaluate((node: ComboboxOption, v) => (node.value = v), newValueProperty);
            await expect(optionElement).toHaveAttribute("value", newValueProperty);
            await expectOptionToBeSelected(page, { label: option.label, value: newValueProperty });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(newValueProperty);

            // `property` responds to `attribute` updates
            const newValueAttribute = "my-attribute";
            await optionElement.evaluate((node: ComboboxField, v) => node.setAttribute("value", v), newValueAttribute);
            await expect(optionElement).toHaveJSProperty("value", newValueAttribute);
            await expectOptionToBeSelected(page, { label: option.label, value: newValueAttribute });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
              newValueAttribute,
            );

            // `property` defaults to text content in lieu of an `attribute`
            await optionElement.evaluate((node: ComboboxField) => node.removeAttribute("value"));
            await expect(optionElement).toHaveJSProperty("value", option.label);
            await expectOptionToBeSelected(page, { label: option.label, value: option.label });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(option.label);
          });
        });

        it.describe("selected (Property)", () => {
          it("Indicates whether or not the `option` is currently selected", async ({ page }) => {
            // Setup
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;
            await renderComponent(page);

            // Display Options
            const combobox = page.getByRole("combobox");
            await combobox.click();

            // Initially, the first `option` is selected
            await expectOptionToBeSelected(page, { label: firstOption });
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", true);

            // After changing the `combobox` value...
            await combobox.evaluate((node: ComboboxField, o) => (node.value = o), lastOption);
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", false);
            await expect(page.getByRole("option").last()).toHaveJSProperty("selected", true);
          });

          it("Updates the value of the `combobox` when changed", async ({ page }) => {
            // Setup
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;
            await renderComponent(page);

            const name = "my-combobox";
            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, name);
            const form = page.getByRole("form");

            // Display Options
            await combobox.click();

            // Initially, the first `option` is selected
            await expectOptionToBeSelected(page, { label: firstOption });
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", true);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(firstOption);

            // The `selected` PROPERTY changes the `combobox` value
            const lastOptionElement = page.getByRole("option", { name: lastOption });
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = true));

            await expectOptionToBeSelected(page, { label: lastOption });
            await expect(lastOptionElement).toHaveJSProperty("selected", true);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(lastOption);

            await expectOptionToBeSelected(page, { label: firstOption }, false);
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(firstOption);
          });

          // Note: This is the behavior of the native <select> element, even when trying to unselect the 1st option.
          it("Reverts the `combobox` value to the 1st option when changed from `true` to `false`", async ({ page }) => {
            // Setup
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;
            await renderComponent(page, getRandomOption(testOptions.slice(1, -1)));

            const name = "my-combobox";
            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, name);
            const form = page.getByRole("form");

            // Display Options
            await combobox.click();
            await expectOptionToBeSelected(page, { label: firstOption }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(firstOption);

            await expectOptionToBeSelected(page, { label: lastOption }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(lastOption);

            // Select last `option`, then deselect it
            const lastOptionElement = page.getByRole("option", { name: lastOption });
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = true));
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = false));

            // First `option` should now be selected
            await expectOptionToBeSelected(page, { label: firstOption });
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", true);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(firstOption);

            await expectOptionToBeSelected(page, { label: lastOption }, false);
            await expect(lastOptionElement).toHaveJSProperty("selected", false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(lastOption);

            // First `option` will still be the default even if someone unselects it
            const firstOptionElement = page.getByRole("option", { name: firstOption });
            await firstOptionElement.evaluate((node: ComboboxOption) => (node.selected = false));

            await expectOptionToBeSelected(page, { label: firstOption }, true);
            await expect(firstOptionElement).toHaveJSProperty("selected", true);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(firstOption);
          });
        });

        // NOTE: This attribute represents the `option` that should be selected by default
        it.describe("selected (Attribute)", () => {
          // Note: This is the behavior of the native <select> element (for :not([multiple])).
          it("Initializes the `combobox` value to the last `selected` `option` that was rendered", async ({ page }) => {
            /* ---------- Setup ---------- */
            const localOptions = testOptions.slice(0, 3);
            const name = "my-combobox";
            await page.goto(url);
            await page.evaluate(
              ([options, fieldName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${fieldName}">
                        <option>${options[0]}</option>
                        <option selected>${options[1]}</option>
                        <option selected>${options[2]}</option>
                      </select>
                    </select-enhancer>
                  </form>
                `;
              },
              [localOptions, name] as const,
            );

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();
            const form = page.getByRole("form");

            // Only the last `selected` option is marked as chosen
            await expect(page.getByRole("option").nth(-2)).toHaveAttribute("selected");
            await expectOptionToBeSelected(page, { label: localOptions.at(-2) as string }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(
              localOptions.at(-2),
            );

            await expect(page.getByRole("option").last()).toHaveAttribute("selected");
            await expectOptionToBeSelected(page, { label: localOptions.at(-1) as string });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(
              localOptions.at(-1),
            );
          });

          // NOTE: The native <select> element (somewhat) disables this functionality once it is modified.
          // We don't currently have a way to support that behavior without leaking implementation details.
          it("Updates the `option`'s `selected` PROPERTY when its value changes", async ({ page }) => {
            /* ---------- Setup ---------- */
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;

            await renderComponent(page);
            await expectOptionToBeSelected(page, { label: firstOption });
            await expectOptionToBeSelected(page, { label: lastOption }, false);

            const name = "my-combobox";
            const combobox = page.getByRole("combobox");
            await associateComboboxWithForm(combobox, name);
            const form = page.getByRole("form");

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();

            // Making a new `option` selected by default
            const lastOptionElement = page.getByRole("option").last();
            await lastOptionElement.evaluate((node: ComboboxOption) => node.setAttribute("selected", ""));
            await expectOptionToBeSelected(page, { label: firstOption }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(firstOption);

            await expectOptionToBeSelected(page, { label: lastOption });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(lastOption);

            // Making a _selected_ + _defaultSelected_ `option` unselected by default
            await lastOptionElement.evaluate((node: ComboboxOption) => node.removeAttribute("selected"));
            await expectOptionToBeSelected(page, { label: lastOption }, false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(lastOption);

            await expectOptionToBeSelected(page, { label: firstOption });
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(firstOption);
          });
        });

        it.describe("defaultSelected (Property)", () => {
          it("Exposes the underlying `selected` attribute", async ({ page }) => {
            /* ---------- Setup ---------- */
            const name = "my-combobox";
            await page.goto(url);
            await page.evaluate(
              ([options, fieldName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <form aria-label="Test Form">
                    <select-enhancer>
                      <select name="${fieldName}">
                        ${options.map((o) => `<option selected>${o}<option>`).join("")}
                      </select>
                    </select-enhancer>
                  </form>
                `;
              },
              [testOptions, name] as const,
            );

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();
            const form = page.getByRole("form");

            // `property` matches initial `attribute`
            const lastOption = testOptions.at(-1) as string;
            const option = page.getByRole("option", { name: lastOption });
            await expect(option).toHaveJSProperty("defaultSelected", true);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(lastOption);

            // `attribute` responds to `property` updates
            await option.evaluate((node: ComboboxOption) => (node.defaultSelected = false));
            await expect(option).not.toHaveAttribute("selected");
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(lastOption);

            await option.evaluate((node: ComboboxOption) => (node.defaultSelected = true));
            await expect(option).toHaveAttribute("selected");
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).toBe(lastOption);

            // `property` also responds to `attribute` updates
            await option.evaluate((node) => node.removeAttribute("selected"));
            await expect(option).toHaveJSProperty("defaultSelected", false);
            expect(await form.evaluate((f: HTMLFormElement, n) => new FormData(f).get(n), name)).not.toBe(lastOption);
          });
        });

        it.describe("disabled (Property)", () => {
          it("Exposes the underlying `aria-disabled` attribute", async ({ page }) => {
            /* ---------- Setup ---------- */
            const option = "Choose Me!!!";
            await page.goto(url);
            await page.evaluate((o) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <select-enhancer>
                  <select>
                    <option disabled>${o}</option>
                  </select>
                </select-enhancer>
              `;
            }, option);

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
            const lastOption = testOptions.at(-1) as string;
            await renderComponent(page);

            /* ---------- Assertions ---------- */
            // Display `option`s
            const combobox = page.getByRole("combobox");
            await combobox.click();

            // Disable last `option`
            const lastOptionElement = page.getByRole("option").last();
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.disabled = true));

            // Try to choose last `option` with mouse (fails)
            await lastOptionElement.click({ force: true }); // Force is necessary because `option` is `aria-disabled`
            await expectOptionToBeSelected(page, { label: lastOption }, false);

            // Try to choose last `option` with keyboard (fails)
            await combobox.focus();
            await page.keyboard.press("End");
            await page.keyboard.press("Enter");
            await expectOptionToBeSelected(page, { label: lastOption }, false);

            // Disabled values can still be selected _programmatically_
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = true));
            await expectOptionToBeSelected(page, { label: lastOption });
          });
        });

        it.describe("index (Property)", () => {
          it("Indicates the position of the `option`", async ({ page }) => {
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
          it("Exposes the `form` with which the `option` is associated", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <form>
                  <select-enhancer>
                    <select>
                      ${options.map((o) => `<option>${o}</option>`).join("")}
                    </select>
                  </select-enhancer>
                </form>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Display options
            const combobox = page.getByRole("combobox");
            await combobox.click();

            // `option` has a semantic form
            const option = page.getByRole("option").first();
            expect(await option.evaluate((n: ComboboxOption) => n.form?.id)).toBe("");
            expect(await option.evaluate((n: ComboboxOption) => n.form instanceof HTMLFormElement)).toBe(true);

            // The `option`'s `form` property updates in response to attribute changes on the owning `combobox`
            const form2Id = "final-form";
            await combobox.evaluate((n: ComboboxField, secondFormId) => n.setAttribute("form", secondFormId), form2Id);
            expect(await option.evaluate((n: ComboboxOption) => n.form)).toBe(null);

            // The `option`'s `form` attribute updates in response to DOM changes
            await page.evaluate((secondFormId) => {
              document.body.insertAdjacentHTML("beforeend", `<form id="${secondFormId}"></form>`);
            }, form2Id);
            expect(await option.evaluate((n: ComboboxOption) => n.form?.id)).toBe(form2Id);
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
        await page.evaluate(() => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <select-enhancer>
              <select id="combobox" name="my-name" required disabled>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;
        });

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
      });

      it('Creates a "unique" (random) ID for the `combobox` if one did not exist on the <select>', async ({ page }) => {
        /* ---------- Setup ---------- */
        await page.goto(url);
        await page.evaluate(() => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <select-enhancer>
              <select>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;
        });

        /* ---------- Assertions ---------- */
        const id = await page.getByRole("combobox").getAttribute("id");
        expect(id).toEqual(expect.any(String));
        expect(id?.length).toBeGreaterThan(1);
      });

      it("Properly creates `option`s from the provided <option>s, preserving all relevant data", async ({ page }) => {
        /* ---------- Setup ---------- */
        await page.goto(url);
        await page.evaluate(() => {
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

          app.replaceChildren(form);
        });

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
        await expectOptionToBeSelected(page, { label: "1st", value: "1" }, false);

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
        await expectOptionToBeSelected(page, { label: "Second" }, false);

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
        await expectOptionToBeSelected(page, { label: "Third", value: "3" });

        // The pre-selected `option` is also recognized by the owning `<form>`
        const form = page.getByRole("form");
        expect(await form.evaluate((f: HTMLFormElement) => new FormData(f).get("my-combobox"))).toBe(
          await selectedOption.getAttribute("value"),
        );
      });

      it("Removes unsupported nodes/elements during initialization", async ({ page }) => {
        // Setup
        const className = "invalid";
        await page.goto(url);
        await page.evaluate((c) => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <select-enhancer>
              <div class="${c}">I am ignored</div>
              <select>
                <option>Choose Me!!!</option>
              </select>
              <span class="${c}" role="option">I am ignored even though I have a proper role</span>
              <div class="${c}" role="listbox">I am ignored even though a \`listbox\` will be put here</div>
            </select-enhancer>
          `;
        }, className);

        // Unsupported elements (e.g., the `div`s and `span`s) should have been removed
        const container = page.locator("select-enhancer");
        expect(await container.locator(".invalid").count()).toBe(0);
        expect(await container.locator("combobox-option").count()).toBe(1);
      });

      it("Has no accessible `role`", async ({ page }) => {
        // Setup
        await page.goto(url);
        await page.evaluate(() => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <select-enhancer>
              <select>
                <option>Choose Me!!!</option>
              </select>
            </select-enhancer>
          `;
        });

        // Container should not have an accessible `role`
        await expect(page.locator("select-enhancer")).toHaveRole("none");
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
        await page.keyboard.type(option);
        await page.waitForTimeout(550); // Wait for Typeahead Search to reset before continuing

        const optionEl = listbox.getByRole("option", { name: option });
        await expect(combobox).toHaveAttribute("aria-activedescendant", await optionEl.evaluate((o) => o.id));
        await expect(optionEl).toHaveAttribute("id", `${await combobox.getAttribute("id")}-option-${option}`);
      }

      // Assert proper relationship between `combobox` and any `option`s added _after_ mounting
      const newOptionValue = "Eleventh";
      await combobox.evaluate((node: ComboboxField, value) => {
        node.listbox.insertAdjacentHTML("beforeend", `<combobox-option>${value}</combobox-option>`);
      }, newOptionValue);

      await page.keyboard.type(newOptionValue);
      const optionEl = listbox.getByRole("option", { name: newOptionValue });
      await expect(combobox).toHaveAttribute("aria-activedescendant", await optionEl.evaluate((o) => o.id));
      await expect(optionEl).toHaveAttribute("id", `${await combobox.getAttribute("id")}-option-${newOptionValue}`);
    });
  });
});
