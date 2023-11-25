import { test as it, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type ComboboxContainer from "../ComboboxContainer.js";
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
          <combobox-container id="component" name="my-name">
            ${options.map((o) => `<combobox-option${value === o ? " selected" : ""}>${o}</combobox-option>`).join("")}
          </combobox-container>
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
  /** Asserts that the `combobox` is closed, and that none of the `option`s in the `listbox` are visible. */
  async function expectComboboxToBeClosed(page: Page): Promise<void> {
    await expect(page.getByRole("combobox")).toHaveAttribute(attrs["aria-expanded"], String(false));
    await expect(page.getByRole("listbox")).not.toBeVisible();
    expect(await page.getByRole("option").count()).toBe(0);
    await Promise.all(testOptions.map((o) => expect(page.getByRole("option", { name: o })).not.toBeVisible()));
  }

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

    // Verify that the `option` has the correct attributes/properties WITHOUT disrupting other tests
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
                <combobox-container>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
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
          await page.locator("combobox-container").evaluate((component: ComboboxContainer) => {
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
          await expect(page.locator("combobox-container + *")).toBeFocused();

          // Backwards Tabbing Works
          await page.keyboard.press("Shift+Tab");
          await expect(combobox).toBeFocused();

          await page.keyboard.press("Shift+Tab");
          await expect(combobox).not.toBeFocused();
          await expect(page.locator(":has(+ combobox-container)")).toBeFocused();
        });

        it("Selects the `active` `option`, hides the `option`s, and performs the default action", async ({ page }) => {
          /* ---------- Setup ---------- */
          const initialValue = testOptions[0];
          await renderComponent(page);
          await expectComboboxToBeClosed(page);
          await expectOptionToBeSelected(page, { label: initialValue });

          // Surround `combobox` with focusable elements
          await page.locator("combobox-container").evaluate((component: ComboboxContainer) => {
            component.insertAdjacentElement("beforebegin", document.createElement("button"));
            component.insertAdjacentElement("afterend", document.createElement("button"));
          });

          // Focus `combobox`
          const combobox = page.getByRole("combobox");
          for (let i = 0; i < 2; i++) await page.keyboard.press("Tab");
          await expect(combobox).toBeFocused();

          /* ---------- Assertions ---------- */
          // Forward Tabbing Works
          const newValue = testOptions[1];
          for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");

          await page.keyboard.press("Tab");
          await expect(combobox).not.toBeFocused();
          await expect(page.locator("combobox-container + *")).toBeFocused();

          expectComboboxToBeClosed(page);
          await expectOptionToBeSelected(page, { label: newValue });
          await expectOptionToBeSelected(page, { label: initialValue }, false);

          // Backwards Tabbing Works
          const secondNewValue = testOptions[2];
          await page.keyboard.press("Shift+Tab");
          await expect(combobox).toBeFocused();
          for (let i = 0; i < 2; i++) await page.keyboard.press("ArrowDown");

          await page.keyboard.press("Shift+Tab");
          await expect(combobox).not.toBeFocused();
          await expect(page.locator(":has(+ combobox-container)")).toBeFocused();

          expectComboboxToBeClosed(page);
          await expectOptionToBeSelected(page, { label: secondNewValue });
          await expectOptionToBeSelected(page, { label: newValue }, false);
          await expectOptionToBeSelected(page, { label: initialValue }, false);
        });
      });

      it.describe("Enter", () => {
        /** The `id` of the `form` element used in each test. Used for associating fields with the `form`. */
        const formId = "test-form";

        /** The `data` attribute on the test `form` element that tracks the number of times the form was submitted. */
        const submissionCountAttr = "data-submission-count";

        /**
         * Associates the `combobox` on a page with the form element on the same page for testing. The association can
         * be * `implicit` (moving the `combobox` _inside_ the form element and removing the `form` attribute) or
         * `explicit` (moving the `combobox` _outside_ the form element and giving it a valid `form` attribute).
         *
         * If no form element exists on the page when this function is called, then one will be created.
         */
        function associateComboboxWithForm(page: Page, association: "implicit" | "explicit"): Promise<void> {
          return page.evaluate(
            ([assoc, attr, id]) => {
              // Find/Create Elements
              const component = document.querySelector("combobox-container") as ComboboxContainer;
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
         * Registers the provided `onsubmit` event `handler` with the form element on the page.
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
          page.once("pageerror", (e) => (error = e));

          // Nothing should break when `Enter` is pressed without an owning form element
          await expect(page.locator("form")).not.toBeAttached();
          await page.getByRole("combobox").focus();
          await page.keyboard.press("Enter");
          expect(error).toBe(undefined);
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
            await associateComboboxWithForm(page, "implicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertInput);

            function submitHandlerAssertInput(event: SubmitEvent): void {
              event.preventDefault();
              if (event.submitter instanceof HTMLInputElement && event.submitter.type === "submit") return;
              throw new Error("Expected `submitter` to be an `input` of type `submit`");
            }

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
            page.once("pageerror", (e) => (error = e));

            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));
            expect(error).toBe(undefined);
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
            await associateComboboxWithForm(page, "implicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertButton);

            function submitHandlerAssertButton(event: SubmitEvent): void {
              event.preventDefault();
              if (event.submitter instanceof HTMLButtonElement && event.submitter.type === "submit") return;
              throw new Error("Expected `submitter` to be a `button` of type `submit`");
            }

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
            page.once("pageerror", (e) => (error = e));

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
          });

          it("Submits forms lacking a `submitter`", async ({ page }) => {
            /* ---------- Setup ---------- */
            // Mount Component
            const initialValue = testOptions[0];
            await renderComponent(page);
            await expectComboboxToBeClosed(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Setup Form + Submission Handler
            await associateComboboxWithForm(page, "explicit");
            await registerSubmissionHandler(page, defaultSubmissionHandler);
            await registerSubmissionHandler(page, submitHandlerAssertNoSubmitter);

            function submitHandlerAssertNoSubmitter(event: SubmitEvent): void {
              event.preventDefault();
              if (event.submitter) throw new Error("Expected `form` NOT to have a `submitter`");
            }

            /* ---------- Assertions ---------- */
            let error: Error | undefined;
            page.once("pageerror", (e) => (error = e));

            await page.getByRole("combobox").focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));
            expect(error).toBe(undefined);
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
            await page.evaluate((id) => {
              const submitter = document.createElement("button");
              submitter.textContent = "Enabled Submitter";
              submitter.setAttribute("form", id);

              document.querySelector("form")?.appendChild(submitter);
            }, formId);

            /* -------------------- Assertions -------------------- */
            const combobox = page.getByRole("combobox");

            /* ---------- Disabled `button` Submitter ---------- */
            await page.evaluate((id) => {
              const disabledSubmitterButton = document.createElement("button");
              disabledSubmitterButton.setAttribute("disabled", "");
              disabledSubmitterButton.setAttribute("form", id);

              document.body.insertAdjacentElement("afterbegin", disabledSubmitterButton);
            }, formId);

            // Implicit Submission fails when disabled
            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(0));

            // Implicit Submission works when enabled
            await page.locator(":disabled").evaluate((node) => node.remove());
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

            // Implicit Submission fails when disabled
            await combobox.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("form")).toHaveAttribute(submissionCountAttr, String(1));

            // Implicit Submission works when enabled
            await page.locator(":disabled").evaluate((node) => node.remove());
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
         * The additional number of times to press `ArrowUp`/`ArrowDown` so that the remant of the previous
         * option is no longer visible. (This is needed because of the `safetyOffset` in `ComboboxField`).
         */
        const offset = 1;
        const displayCount = 4;
        const container = page.locator("combobox-container");
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
                <combobox-container disabled>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // `property` matches initial `attribute`
            const combobox = page.getByRole("combobox");
            await expect(combobox).toHaveJSProperty("disabled", true);

            // `attribute` responds to `property` updates
            await combobox.evaluate((node: ComboboxField) => (node.disabled = false));
            await expect(combobox).not.toHaveAttribute("disabled", /.*/);

            await combobox.evaluate((node: ComboboxField) => (node.disabled = true));
            await expect(combobox).toHaveAttribute("disabled", "");

            // `property` also responds to `attribute` updates
            await combobox.evaluate((node: ComboboxField) => node.removeAttribute("disabled"));
            await expect(combobox).toHaveJSProperty("disabled", false);
          });
        });

        it.describe("required (Property)", () => {
          it("Exposes the underlying `required` attribute", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container required>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // `property` matches initial `attribute`
            const combobox = page.getByRole("combobox");
            await expect(combobox).toHaveJSProperty("required", true);

            // `attribute` responds to `property` updates
            await combobox.evaluate((node: ComboboxField) => (node.required = false));
            await expect(combobox).not.toHaveAttribute("required", /.*/);

            await combobox.evaluate((node: ComboboxField) => (node.required = true));
            await expect(combobox).toHaveAttribute("required", "");

            // `property` also responds to `attribute` updates
            await combobox.evaluate((node) => node.removeAttribute("required"));
            await expect(combobox).toHaveJSProperty("required", false);
          });

          it("Marks the `combobox` as `invalid` when the `required` constraint is broken", async ({ page }) => {
            /* ---------- Setup ---------- */
            const error = "Please fill out this field.";
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
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
                <combobox-container required>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valid)).toBe(false);
            expect(await combobox.evaluate((node: ComboboxField) => node.validity.valueMissing)).toBe(true);
            expect(await combobox.evaluate((node: ComboboxField) => node.validationMessage)).toBe(error);

            // With _non-empty_ Initial Value
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container required>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o, i) => `<combobox-option${!i ? " selected" : ""}>${o}</combobox-option>`).join("")}
                </combobox-container>
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
              ([options, initialName]) => {
                const app = document.getElementById("app") as HTMLDivElement;

                app.innerHTML = `
                  <combobox-container name="${initialName}">
                    ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                  </combobox-container>
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
                <combobox-container>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
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
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  <combobox-option value="">Select a Value</combobox-option>
                  ${options.map((o, i) => `<combobox-option value="${i}">${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            // Assertions
            const combobox = page.getByRole("combobox");
            expectOptionToBeSelected(page, { value: "", label: "Select a Value" });
            expect(await combobox.evaluate((n: ComboboxField) => n.value)).toBe("");

            const userValue = testOptions[0];
            await combobox.click();
            await page.getByRole("option", { name: userValue }).click();
            expectOptionToBeSelected(page, { value: "0", label: "First" });
            expect(await combobox.evaluate((n: ComboboxField) => n.value)).toBe("0");

            const secondUserValue = testOptions[7];
            await combobox.click();
            await page.getByRole("option", { name: secondUserValue }).click();
            expectOptionToBeSelected(page, { value: "7", label: "Eigth" });
            expect(await combobox.evaluate((n: ComboboxField) => n.value)).toBe("7");
          });

          it("Updates the `value` of the `combobx`, including its `option`s and validity state", async ({ page }) => {
            // Setup
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container required>
                  <combobox-option value="">Select a Value</combobox-option>
                  ${options.map((o, i) => `<combobox-option value="${i}">${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            // Assertions
            const combobox = page.getByRole("combobox");

            const empty = { value: "", label: "Select a Value" };
            expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
            expect(await combobox.evaluate((n: ComboboxField) => n.validity.valid)).toBe(false);

            // Manually Make Value Valid
            const userValue = "7";
            await combobox.evaluate((n: ComboboxField, value) => (n.value = value), userValue);
            expectOptionToBeSelected(page, { value: userValue, label: testOptions[userValue] });
            expect(await combobox.evaluate((n: ComboboxField) => n.checkValidity())).toBe(true);

            // Manually Make Value Invalid
            expect(await combobox.evaluate((n: ComboboxField, value) => (n.value = value), empty.value));
            expectOptionToBeSelected(page, { value: empty.value, label: empty.label });
            expect(await combobox.evaluate((n: ComboboxField) => n.reportValidity())).toBe(false);
          });

          it("Rejects values that are not found in the available `option`s", async ({ page }) => {
            /* ---------- Setup ---------- */
            const initialValue = testOptions[0];
            await renderComponent(page);
            await expectOptionToBeSelected(page, { label: initialValue });

            /* ---------- Assertions ---------- */
            const combobox = page.getByRole("combobox");

            // Invalid values are rejected
            const invalidValue = Math.random().toString(36).slice(2);
            await combobox.evaluate((n: ComboboxField, value) => (n.value = value), invalidValue);

            expect(await combobox.evaluate((n: ComboboxField) => n.value)).not.toBe(invalidValue);
            await expectOptionToBeSelected(page, { label: initialValue });

            // Valid values are accepted
            const goodValue = getRandomOption(testOptions.slice(1));
            await combobox.evaluate((n: ComboboxField, value) => (n.value = value), goodValue);

            expect(await combobox.evaluate((n: ComboboxField) => n.value)).toBe(goodValue);
            await expectOptionToBeSelected(page, { label: initialValue }, false);
            await expectOptionToBeSelected(page, { label: goodValue });
          });
        });

        it.describe("listbox (Property)", () => {
          it("Exposes the `listbox` that the `combobox` controls (for convenience)", async ({ page }) => {
            await renderComponent(page);
            const combobox = page.getByRole("combobox");
            const listboxId = await combobox.evaluate((n: ComboboxField) => n.listbox.id);
            const ariaControls = await combobox.evaluate((n: ComboboxContainer) => n.getAttribute("aria-controls"));

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
                  <combobox-container id="${id}">
                    ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                  </combobox-container>
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
                  <combobox-container>
                    ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                  </combobox-container>
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
                <combobox-container>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
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
                <combobox-container>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // No error message exists if no constraints are broken
            const combobox = page.getByRole("combobox");
            await expect(combobox).toHaveJSProperty("validationMessage", "");

            // Error message exists if a constraint is broken
            await combobox.evaluate((node: ComboboxField) => node.setAttribute("required", ""));
            await expect(combobox).toHaveJSProperty("validationMessage", "Please fill out this field.");
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
         * NOTE: Currently, according to our knowledge, there's no way to run assertions on the native
         * error bubbles that browsers create.
         */
        for (const method of ["checkValidity", "reportValidity"] as const) {
          it(`Performs field validation when \`${method}\` is called`, async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container required>
                  <combobox-option value="">Select an Option</combobox-option>
                  ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Validation on an invalid `combobox`
            const combobox = page.getByRole("combobox");
            const invalidEventEmitted = combobox.evaluate((node: ComboboxField) => {
              return new Promise<boolean>((resolve, reject) => {
                const timeout = setTimeout(reject, 3000, "The `invalid` event was never emitted by a combobox-field");

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
                    reject("The `invalid` event should not have been emitted by the combobox-field");
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
                const timeout = setTimeout(reject, 3000, `The \`${e}\` event was never emitted by a combobox-field.`);

                document.addEventListener(
                  e,
                  (event) => {
                    if (event.constructor !== Event) return;
                    if (event.target?.constructor !== customElements.get("combobox-field")) return;
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
                    reject(`The \`${e}\` event should not have been emitted by the combobox-field`);
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
    });

    it.describe("Combobox Option (Web Component Part)", () => {
      it.describe("Exposed Properties and Attributes", () => {
        it.describe("label (Property)", () => {
          it("Returns the text content of the `option`", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  ${options.map((o, i) => `<combobox-option value="${i + 1}">${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();
            const options = page.getByRole("option");

            const optionsCount = await options.count();
            expect(optionsCount).toBeGreaterThan(1);

            // Check `option` labels
            await Promise.all(
              [...Array(optionsCount)].map((_, i) => expect(options.nth(i)).toHaveJSProperty("label", testOptions[i])),
            );
          });
        });

        it.describe("value (Attribute)", () => {
          it("Updates the value of the `combobox` when changed on the selected `option`", async ({ page }) => {
            // Setup
            const value = "1st";
            await renderComponent(page);
            await page.getByRole("combobox").click();

            // Adding the attribute
            const firstOption = page.getByRole("option").first();
            await firstOption.evaluate((node, v) => node.setAttribute("value", v), value);
            await expectOptionToBeSelected(page, { label: testOptions[0], value });

            // Removing the attribute
            await firstOption.evaluate((node) => node.removeAttribute("value"));
            await expectOptionToBeSelected(page, { label: testOptions[0] });

            // Updating an unselected `option`'s value does nothing to the `combobox` value
            const lastOption = page.getByRole("option").last();
            await lastOption.evaluate((node) => node.setAttribute("value", "ignored"));
            await expectOptionToBeSelected(page, { label: testOptions.at(-1) as string, value: "ignored" }, false);
            await expectOptionToBeSelected(page, { label: testOptions[0] });
          });
        });

        it.describe("value (Property)", () => {
          it("Exposes the underlying `value` attribute (defaults to `option`'s text content)", async ({ page }) => {
            /* ---------- Setup ---------- */
            const option = Object.freeze({ label: "My Value", value: "my-value" });
            await page.goto(url);
            await page.evaluate((o) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  <combobox-option value="${o.value}">${o.label}</combobox-option>
                </combobox-container>
              `;
            }, option);

            /* ---------- Assertions ---------- */
            // Display Options
            await page.getByRole("combobox").click();

            // `property` matches initial `attribute`
            const optionElement = page.getByRole("option");
            await expect(optionElement).toHaveJSProperty("value", option.value);

            // `attribute` responds to `property` updates
            const newValueProperty = "my-property";
            await optionElement.evaluate((node: ComboboxOption, v) => (node.value = v), newValueProperty);
            await expect(optionElement).toHaveAttribute("value", newValueProperty);

            // `property` responds to `attribute` updates
            const newValueAttribute = "my-attribute";
            await optionElement.evaluate((node: ComboboxField, v) => node.setAttribute("value", v), newValueAttribute);
            await expect(optionElement).toHaveJSProperty("value", newValueAttribute);

            // `property` defaults to text content in lieu of an `attribute`
            await optionElement.evaluate((node: ComboboxField) => node.removeAttribute("value"));
            await expect(optionElement).toHaveJSProperty("value", option.label);
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

            // Display Options
            await page.getByRole("combobox").click();

            // Initially, the first `option` is selected
            await expectOptionToBeSelected(page, { label: firstOption });
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", true);

            // The `selected` PROPERTY changes the `combobox` value
            const lastOptionElement = page.getByRole("option", { name: lastOption });
            await lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = true));

            await expectOptionToBeSelected(page, { label: lastOption });
            await expect(lastOptionElement).toHaveJSProperty("selected", true);

            await expectOptionToBeSelected(page, { label: firstOption }, false);
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", false);
          });

          it("Reverts the `combobox` value to the 1st option when changed from `true` to `false`", async ({ page }) => {
            // Setup
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;
            await renderComponent(page, getRandomOption(testOptions.slice(1, -1)));

            // Display Options
            await page.getByRole("combobox").click();
            await expectOptionToBeSelected(page, { label: firstOption }, false);

            // Select last `option`, then deselect it
            const lastOptionElement = page.getByRole("option", { name: lastOption });
            lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = true));
            lastOptionElement.evaluate((node: ComboboxOption) => (node.selected = false));

            // First `option` should now be selected
            await expectOptionToBeSelected(page, { label: firstOption });
            await expect(page.getByRole("option").first()).toHaveJSProperty("selected", true);

            await expectOptionToBeSelected(page, { label: lastOption }, false);
            await expect(lastOptionElement).toHaveJSProperty("selected", false);
          });
        });

        // NOTE: This attribute represents the `option` that should be selected by default
        it.describe("selected (Attribute)", () => {
          it("Initializes the `combobox` value to the last `selected` `option` that was rendered", async ({ page }) => {
            /* ---------- Setup ---------- */
            const localOptions = testOptions.slice(0, 3);
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  <combobox-option>${options[0]}</combobox-option>
                  <combobox-option selected>${options[1]}</combobox-option>
                  <combobox-option selected>${options[2]}</combobox-option>
                </combobox-container>
              `;
            }, localOptions);

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();

            // Only the last `selected` option is marked as chosen
            await expect(page.getByRole("option").nth(-2)).toHaveAttribute("selected");
            await expectOptionToBeSelected(page, { label: localOptions.at(-2) as string }, false);

            await expect(page.getByRole("option").last()).toHaveAttribute("selected");
            await expectOptionToBeSelected(page, { label: localOptions.at(-1) as string });
          });

          // NOTE: The native `<select>` element disables this functionality once it is modified. However,
          // We don't currently have a way to support that behavior without leaking implementation details.
          it("Updates the `option`'s `selected` PROPERTY when its value changes", async ({ page }) => {
            /* ---------- Setup ---------- */
            const firstOption = testOptions[0];
            const lastOption = testOptions.at(-1) as string;

            await renderComponent(page);
            await expectOptionToBeSelected(page, { label: firstOption });
            await expectOptionToBeSelected(page, { label: lastOption }, false);

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();

            // Making a new `option` selected by default
            const lastOptionElement = page.getByRole("option").last();
            await lastOptionElement.evaluate((node: ComboboxOption) => node.setAttribute("selected", ""));
            await expectOptionToBeSelected(page, { label: firstOption }, false);
            await expectOptionToBeSelected(page, { label: lastOption });

            // Making a _selected_ + _defaultSelected_ `option` unselected by default
            await lastOptionElement.evaluate((node: ComboboxOption) => node.removeAttribute("selected"));
            await expectOptionToBeSelected(page, { label: lastOption }, false);
            await expectOptionToBeSelected(page, { label: firstOption });
          });
        });

        it.describe("defaultSelected (Property)", () => {
          it("Exposes the underlying `selected` attribute", async ({ page }) => {
            /* ---------- Setup ---------- */
            await page.goto(url);
            await page.evaluate((options) => {
              const app = document.getElementById("app") as HTMLDivElement;

              app.innerHTML = `
                <combobox-container>
                  ${options.map((o) => `<combobox-option selected>${o}</combobox-option>`).join("")}
                </combobox-container>
              `;
            }, testOptions);

            /* ---------- Assertions ---------- */
            // Display `option`s
            await page.getByRole("combobox").click();

            // `property` matches initial `attribute`
            const option = page.getByRole("option", { name: testOptions.at(-1) as string });
            await expect(option).toHaveJSProperty("defaultSelected", true);

            // `attribute` responds to `property` updates
            await option.evaluate((node: ComboboxOption) => (node.defaultSelected = false));
            await expect(option).not.toHaveAttribute("selected");

            await option.evaluate((node: ComboboxOption) => (node.defaultSelected = true));
            await expect(option).toHaveAttribute("selected");

            // `property` also responds to `attribute` updates
            await option.evaluate((node) => node.removeAttribute("selected"));
            await expect(option).toHaveJSProperty("defaultSelected", false);
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
                <combobox-container>
                  <combobox-option aria-disabled="true">${o}</combobox-option>
                </combobox-container>
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
            await expect(optionElement).toHaveAttribute("aria-disabled", String(false));

            await optionElement.evaluate((node: ComboboxOption) => (node.disabled = true));
            await expect(optionElement).toHaveAttribute("aria-disabled", String(true));

            // `property` also responds to `attribute` updates
            await optionElement.evaluate((node) => node.setAttribute("aria-disabled", String(false)));
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
                  <combobox-container>
                    ${options.map((o) => `<combobox-option>${o}</combobox-option>`).join("")}
                  </combobox-container>
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

    it.describe("Combobox Container (Web Component Part)", () => {
      it("Transfers its (user-provided) attributes to the `combobox` during initialization", async ({ page }) => {
        /* ---------- Setup ---------- */
        await page.goto(url);
        await page.evaluate(() => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <combobox-container id="combobox" name="my-name" required disabled>
              <combobox-option>Choose Me!!!</combobox-option>
            </combobox-container>
          `;
        });

        /* ---------- Assertions ---------- */
        const combobox = page.getByRole("combobox");
        const container = page.locator("combobox-container");

        // The `combobox` has inherited the attributes
        await expect(combobox).toHaveAttribute("id", "combobox");
        await expect(combobox).toHaveAttribute("name", "my-name");
        await expect(combobox).toHaveAttribute("required", "");
        await expect(combobox).toHaveAttribute("disabled", "");

        // The container has lost (or updated) its attributes
        await expect(container).toHaveAttribute("id", "combobox-container");
        await expect(container).not.toHaveAttribute("name");
        await expect(container).not.toHaveAttribute("required");
        await expect(container).not.toHaveAttribute("disabled");
      });

      it("Rejects unsupported nodes/elements during initialization", async ({ page }) => {
        // Setup
        const className = "invalid";
        await page.goto(url);
        await page.evaluate((c) => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <combobox-container>
              <div class="${c}">I am rejected</div>
              <combobox-option>Choose Me!!!</combobox-option>
              <span class="${c}" role="option">I am rejected even though I have a proper role</span>
              <div class="${c}" role="listbox">I am rejected even though a \`listbox\` will be put here</div>
            </combobox-container>
          `;
        }, className);

        // Unrelated elements (i.e., the `div`s and `span`s) should have been removed
        const container = page.locator("combobox-container");
        expect(await container.locator(".invalid").count()).toBe(0);
        expect(await container.locator("combobox-option").count()).toBe(1);
      });

      it("Has no accessible `role`", async ({ page }) => {
        // Setup
        await page.goto(url);
        await page.evaluate(() => {
          const app = document.getElementById("app") as HTMLDivElement;

          app.innerHTML = `
            <combobox-container>
              <combobox-option>Choose Me!!!</combobox-option>
            </combobox-container>
          `;
        });

        // Container should not have an accessible `role`
        await expect(page.locator("combobox-container")).toHaveAttribute("role", "none");
      });
    });
  });
});
