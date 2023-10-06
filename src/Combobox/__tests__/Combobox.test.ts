import { test as it, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type ComboboxContainer from "../ComboboxContainer.js";
import type ComboboxField from "../ComboboxField.js";

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

    // Verify that the `option` has the correct attributes WITHOUT disrupting other tests
    const option = page.getByText(optionLabel).and(page.locator("[role='option']"));
    await expect(option).toHaveAttribute(attrs["aria-selected"], String(selected));
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
        renderComponent(page);
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
          await expectOptionToBeActive(page, { label: testOptions.at(-1) as string }, false);

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
          const initialScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);

          /* ---------- Assertions ---------- */
          // Focus `combobox`
          await page.keyboard.press("Tab");
          await expect(page.getByRole("combobox")).toBeFocused();

          // No scrolling should occur when `ArrowDown` or `Alt`+`ArrowDown` is pressed
          await page.keyboard.press("ArrowDown");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          await page.keyboard.press("Alt+ArrowDown");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          const newScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);
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
          const initialScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);

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

          const newScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);
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
          await expectOptionToBeActive(page, { label: testOptions[0] }, false);

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
          await expectOptionToBeActive(page, { label: testOptions[0] }, false);

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
          const initialScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);

          /* ---------- Assertions ---------- */
          // No scrolling should occur when `ArrowUp` or `Alt`+`ArrowUp` is pressed
          await page.keyboard.press("ArrowUp");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          await page.keyboard.press("Alt+ArrowUp");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          const newScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);
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
          const initialScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);

          /* ---------- Assertions ---------- */
          // No scrolling should occur when `Home` is pressed
          await page.keyboard.press("Home");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          // For sanity's sake, press `Home` again while the `combobox` is already expanded
          await page.keyboard.press("Home");
          await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for **possible** scrolling to finish

          const newScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);
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
          await expectOptionToBeActive(page, { label: testOptions.at(-1) as string }, false);

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
          const initialScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);

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

          const newScrollDistance = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }) as const);
          expect(newScrollDistance).toStrictEqual(initialScrollDistance);
        });
      });

      it.describe("Tab", () => {
        it("Performs the default action (i.e., it moves focus to the next element)", async ({ page }) => {
          /* ---------- Setup ---------- */
          await renderComponent(page);
          await expectComboboxToBeClosed(page);

          // Surround `combobox` with focusable elements
          await page.evaluate(() => {
            const component = document.querySelector("combobox-container") as ComboboxContainer;
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
          await page.evaluate(() => {
            const component = document.querySelector("combobox-container") as ComboboxContainer;
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
         * Associates the `combobox` on a page with the form element on the same page for testing. The association can be
         * `implicit` (moving the `combobox` _inside_ the form element and removing the `form` attribute) or
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
         * Note: If you only want to track how many times a form was submitted, use the {@link defaultSubmissionHandler}.
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
          const formDataValue = await page.evaluate(() => {
            const name = "combobox-name";
            const combobox = document.querySelector("combobox-container [role='combobox']") as ComboboxField;
            combobox.setAttribute("name", name);

            return new FormData(combobox.form as HTMLFormElement).get(name);
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
          expect(await page.evaluate(() => document.querySelector("form"))).toBe(null);
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
            await page.evaluate(() => document.querySelector(":disabled")?.remove());
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
            await page.evaluate(() => document.querySelector(":disabled")?.remove());
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
        const fraction = 0.25;

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
          const options = ["lowercase", "UPPERCASE"] as const;
          await renderComponent(page, { options });

          /* ---------- Assertions ---------- */
          // Use "Uppercase Search" for "Lowercase Option"
          const uppercaseSearch = "L";
          expect(options[0]).not.toBe(uppercaseSearch);

          await page.keyboard.press("Tab");
          await page.keyboard.press(uppercaseSearch, { delay: timeout * (1 + fraction) });
          await expectOptionToBeActive(page, { label: options[0] });

          // Use "Lowercase Search" for "Uppercase Option"
          const lowercaseSearch = "u";
          expect(options[1]).not.toBe(lowercaseSearch);

          await page.keyboard.press(lowercaseSearch);
          await expectOptionToBeActive(page, { label: options[1] });
          await expectOptionToBeActive(page, { label: options[0] }, false);
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
        await container.evaluate((e, blocks) => e.style.setProperty("--blocks", blocks), String(displayCount));

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
      });
    });
  });
});
