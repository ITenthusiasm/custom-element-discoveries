import { test as it, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type ComboboxContainer from "../ComboboxContainer";

/** The attributes _commonly_ used for **testing** the `Combobox` Web Component. (Declared to help avoid typos.) */
const attrs = Object.freeze({
  "aria-activedescendant": "aria-activedescendant",
  "aria-expanded": "aria-expanded",
  "aria-selected": "aria-selected",
  "aria-label": "aria-label",
  "data-active": "data-active",
  value: "value",
});

it.describe("Combobox Web Component", () => {
  interface OptionInfo {
    /** The _accessible_ label of an `option`. */
    label: string;

    /** The _value_ of an accessible `option` (if it is distinct from its {@link label}) */
    value?: string;
  }

  const url = "http://localhost:5173";
  const testOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eigth", "Ninth", "Tenth"];

  /* -------------------- Helper Functions -------------------- */
  async function renderComponent(page: Page, initialValue?: string): Promise<void> {
    await page.goto(url);
    return page.evaluate(
      ([options, initialValue]) => {
        const app = document.getElementById("app") as HTMLDivElement;

        app.innerHTML = `
        <combobox-container id="component" name="my-name"${initialValue ? ` value="${initialValue}"` : ""}>
          ${options.map((o) => `<li>${o}</li>`).join("")}
        </combobox-container>
        <div style="font-size: 3rem; font-weight: bold; text-align: right; background-color: red; height: 500vh;">
          Container for testing scroll prevention
        </div>
      `;
      },
      [testOptions, initialValue] as const,
    );
  }

  function getRandomOption<T extends string[]>(options: T = testOptions as T): T[number] {
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
      it("Shows the `option`s when `ArrowDown` is pressed (selected `option` is `active`)", async ({ page }) => {
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

      it("Marks the next `option` as `active` when `ArrowDown` is pressed", async ({ page }) => {
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

      it("DOES NOT update the `active` `option` when `ArrowDown` is pressed on the last `option`", async ({ page }) => {
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

      it("Shows the `option`s when `Alt`+`ArrowDown` is pressed (selected `option` is `active`)", async ({ page }) => {
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

      it("DOES NOT update the `active` `option` when `Alt`+`ArrowDown` is pressed", async ({ page }) => {
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

      it("Prevents unwanted page scrolling when `ArrowDown` or `Alt`+`ArrowDown` is pressed", async ({ page }) => {
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
      it("Shows the `option`s AND marks the last `option` as `active` when `End` is pressed", async ({ page }) => {
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

      it("Prevents unwanted page scrolling when `End` is pressed", async ({ page }) => {
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
      it("Shows the `option`s when `ArrowUp` is pressed (selected `option` is `active`)", async ({ page }) => {
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

      it("Marks the previous `option` as `active` when `ArrowUp` is pressed", async ({ page }) => {
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

      it("DOES NOT update the `active` `option` when `ArrowUp` is pressed on the first `option`", async ({ page }) => {
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

      it("Hides the `option`s when `Alt`+`ArrowUp` is pressed", async ({ page }) => {
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

      it("Prevents unwanted page scrolling when `ArrowUp` or `Alt`+`ArrowUp` is pressed", async ({ page }) => {
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
      it("Shows the `option`s AND marks the first `option` as `active` when `Home` is pressed", async ({ page }) => {
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

      it("Prevents unwanted page scrolling when `Home` is pressed", async ({ page }) => {
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
      it("Hides the `option`s when `Escape` is pressed", async ({ page }) => {
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
      it("Shows the `option`s when `SpaceBar` (' ') is pressed (selected `option` is `active`)", async ({ page }) => {
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

      it("Selects the `active` `option` and hides the `option`s when `SpaceBar` (' ') is pressed", async ({ page }) => {
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

      it("Prevents unwanted page scrolling when `SpaceBar` (' ') is pressed", async ({ page }) => {
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

    /*
     * TODO: For the sake of space, maybe we should consider removing the "when <KEY> is pressed" phrases from
     * our tests. This also reduces redundancy. For the keys with modifiers (e.g., `Alt+ArrowDown`), we can either
     * 1) Separate the `Alt+<KEY>` tests into separate `describe` blocks or 2) break the convention that we just
     * described of reducing redundancy, but **_ONLY_** when the `describe`d block requires tests for modifiers
     * (such as the `alt` key).
     */
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
  });
});
