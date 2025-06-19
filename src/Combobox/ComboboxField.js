/** @import {HTMLElementWithChildren} from "./Combobox.js" */
import { setAttributeFor } from "../utils/dom.js";
import ComboboxOption from "./ComboboxOption.js";
import attrs from "./attrs.js";

/*
 * "TypeScript Lies" to Be Aware of:
 * (Probably should move this comment to a markdown file)
 *
 * 1) `#matchingOptions` could technically be `null` but is `ComboboxOption[]` (never a practical problem)
 * 2) `listbox` could technically have `#emptyOption` if mis-handled, but is typed as only having `ComboboxOption`s
 *    (and should never be a practical problem).
 */

/** 
 * @typedef {keyof Pick<ElementInternals,
     "labels" | "form" | "validity" | "validationMessage" | "willValidate" | "checkValidity" | "reportValidity"
   >} ExposedInternals
 */

/** @implements {Pick<ElementInternals, ExposedInternals>} */
class ComboboxField extends HTMLElement {
  /* ------------------------------ Custom Element Settings ------------------------------ */
  /** @returns {true} */
  static get formAssociated() {
    return true;
  }

  static get observedAttributes() {
    return /** @type {const} */ (["required", "filter", "filteris", "emptymessage"]);
  }

  /* ------------------------------ Internals ------------------------------ */
  #mounted = false;
  /** @readonly */ #internals = this.attachInternals();

  /** @type {string} The temporary search string used for {@link filter _unfiltered_} `combobox`es */
  #searchString = "";

  /** @type {number | undefined} The `id` of the latest timeout function that will clear the `#searchString` */
  #searchTimeout;

  /**
   * @type {ComboboxOption[]} The list of `option`s that match the user's current filter. Only guaranteed
   * to exist when the `combobox` is in {@link filter} mode. Otherwise, is irrelevant and may yield `null`.
   */
  #matchingOptions = /** @type {ComboboxOption[]} */ (/** @type {unknown} */ (null));

  /**
   * @type {number} The index of the `option` in `#matchingOptions` that is currently active.
   * Only relevant for {@link filter filterable} `combobox`es.
   */
  #activeIndex = 0;

  /** @readonly */ #activeDescendantObserver = new MutationObserver(ComboboxField.#watchActiveDescendant);
  /** @readonly */ #expansionObserver = new MutationObserver((mutations) => {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      const combobox = /** @type {ComboboxField} */ (mutation.target);
      const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);
      const { listbox } = combobox;

      // Open Combobox
      if (expanded) {
        /*
         * NOTE: If the user opens the `combobox` with search/typeahead, then `aria-activedescendant` will already
         * exist and this expansion logic will be irrelevant. Remember that `MutationObserver` callbacks are run
         * asynchronously, so this check would happen AFTER the search/typeahead handler completed. It's also
         * possible for this condition to be met if we redundantly set `aria-expanded`. Although we should be
         * be able to avoid this, we can't prevent Developers from accidentally doing this themselves.
         */
        if (combobox.getAttribute(attrs["aria-activedescendant"]) !== "") return;

        /** @type {ComboboxOption | null} */
        const activeOption =
          listbox.querySelector(":scope [role='option'][aria-selected='true']:not([data-filtered-out])") ??
          listbox.querySelector(":scope [role='option']:not([data-filtered-out])");
        const activeOptionExists = activeOption && activeOption !== this.#emptyOption;

        if (combobox.filter) {
          this.#autoselectableOption = null;
          this.#activeIndex = activeOptionExists ? this.#matchingOptions.indexOf(activeOption) : -1;
        }

        if (activeOptionExists) combobox.setAttribute(attrs["aria-activedescendant"], activeOption.id);
      }
      // Close Combobox
      else {
        combobox.setAttribute(attrs["aria-activedescendant"], "");

        // See if logic _exclusive_ to `filter`ed `combobox`es needs to be run
        if (!combobox.filter || combobox.value == null) return;

        // Reset filtered `option`s. (NOTE: Approach is incompatible with `group`ed `option`s)
        this.#emptyOption?.remove();
        if (this.#matchingOptions.length !== listbox.children.length) {
          this.#matchingOptions = Array.from(listbox.children, (option) => {
            option.removeAttribute("data-filtered-out");
            return option;
          });
        }

        // TODO: Some of our handling of text here might be superfluous. Double check. Better safe than sorry, though.
        // Reset `combobox` display if needed
        // NOTE: `option` can be `null` or unselected if `combobox` is `clearable`, empty, and `collapsed` with a non-empty filter
        const textNode = /** @type {Text} */ (combobox.firstChild);
        if (!combobox.acceptsFilter(textNode.data)) {
          const option = combobox.getOptionByValue(combobox.value);
          if (combobox.filterIs === "clearable" && !combobox.value && !option?.selected) textNode.data = "";
          else if (textNode.data !== option?.textContent) textNode.data = option?.textContent ?? "";
        }

        // Reset cursor if `combobox` is still `:focus`ed
        const root = /** @type {Document | ShadowRoot} */ (combobox.getRootNode());
        if (root.activeElement !== combobox) return;

        const selection = /** @type {Selection} */ (combobox.ownerDocument.getSelection());
        selection.setBaseAndExtent(textNode, textNode.length, textNode, textNode.length);
      }
    }
  });

  /*
   * TODO: There are some worthwhile thoughts here... Compile this in some useful way so that the text size is bearable.
   *
   * NOTE: This observer assumes that the available `option`s don't change while the user types into the searchbox
   * (if the `combobox` is `filter`able). If we want to suppor that use case (e.g., for asynchronously loading `option`s),
   * then we'll need to update this observer accordingly. But even then... is a `combobox` really intended to be
   * an async search box?
   *
   * Or ... are we worried about running into unexpected use cases and desiring to support this use case just in case
   * in the immediate future?
   *
   * Actually, this component really shouldn't be used as an async search box. Once the previously-searched (and selected)
   * value is removed, it wouldn't be submitted to the server anymore. A different approach would seem better here, unless
   * we were to allow users to leave the `combobox` value as-is after a `blur` event. But that introduces its own sets of
   * complexities, which don't seem worth addressing at the moment.
   *
   * In any case, even if we don't support extra use cases, we might still want to update our filter as DOM nodes are
   * added/removed. This will help us avoid unexpected problems as the code is changed over time. (Note: We wouldn't
   * have to iterate over every single option to update the filter if we internally tracked the search string resulting
   * from an `input` event. Of course, we also don't have to update the filter when nodes are added/removed. In that
   * case, we don't have to loop over anything and simply have to indicate if a newly-added option should be filtered out.)
   */
  // TODO: Consider what to do in this block (if anything) with `anyvalue` if we support this block in `filter` mode
  /** @readonly */ #optionNodesObserver = new MutationObserver((mutations) => {
    if (!this.listbox.children.length) {
      this.#value = null;
      this.#internals.setFormValue(null);
      /** @type {Text} */ (this.firstChild).data = "";
      return;
    }

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];

      // Handle added nodes first. This keeps us from running redundant Deselect Logic if a newly-added node is `selected`.
      mutation.addedNodes.forEach((node, j) => {
        if (!(node instanceof ComboboxOption)) return;
        if (node.defaultSelected) return (this.value = node.value);
        if (j === 0 && this.#value === null) this.value = node.value;
      });

      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof ComboboxOption)) return;
        if (node.selected) this.value = this.listbox.children[0].value;
      });
    }
  });

  /**
   * @type {string | null} The Custom Element's internal value. If you are updating the `combobox`'s value to anything
   * other than `null`, then you should use the {@link value setter} instead.
   *
   * **Note**: A `null` value indicates that the `combobox` value has not yet been initialized (for instance, if
   * the `combobox` was not rendered with any `option`s).
   */
  #value = null;

  /**
   * @type {HTMLSpanElement | undefined}
   * The default "`option`" displayed to the user when no `option`s match the user's search input.
   * ({@link filter filterable} `combobox`es only)
   */
  #emptyOption;

  /* ------------------------------ Lifecycle Callbacks ------------------------------ */
  /**
   * @param {typeof ComboboxField.observedAttributes[number]} name
   * @param {string | null} oldValue
   * @param {string | null} newValue
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "required") return this.#validateRequiredConstraint();
    if (name === "emptymessage" && this.#emptyOption && newValue !== oldValue) {
      this.#emptyOption.textContent = this.emptyMessage;
      return;
    }

    // TODO: Is `allows` a better word than `filteris`? Maybe not?
    // TODO: Should `filter` and `filteris` be combined into one attribute? Or is that more complicated?
    if (name === "filteris" && newValue !== oldValue) {
      if (newValue != null && !this.filter) this.filter = true;
      if (!this.#mounted) return;

      /** @satisfies {NonNullable<this["filterIs"]>} */ const trueNewValue =
        newValue !== "anyvalue" && newValue !== "clearable" && newValue !== "unclearable" ? "clearable" : newValue;
      /** @satisfies {NonNullable<this["filterIs"]>} */ const trueOldValue =
        oldValue !== "anyvalue" && oldValue !== "clearable" && oldValue !== "unclearable" ? "clearable" : oldValue;
      if (trueNewValue === trueOldValue) return;

      // `anyvalue` activated
      if (trueNewValue === "anyvalue") {
        if (this.textContent === "") return this.forceEmptyValue();
        if (this.getAttribute(attrs["aria-expanded"]) !== String(true)) return;

        if (this.#autoselectableOption) this.value = this.#autoselectableOption.value;
        else this.value = /** @type {string} */ (this.textContent);
      }
      // `unclearable` activated
      else if (trueNewValue === "unclearable") {
        /** @type {ComboboxOption | null | undefined} */ let option;

        if (this.textContent === "") option = this.getOptionByValue("");
        else if (trueOldValue !== "anyvalue") return;
        else option = this.#autoselectableOption ?? this.#matchingOptions.find((o) => o.label === this.textContent);

        if (!option) return this.formResetCallback();
        option.selected = true;
        if (this.textContent !== option.label) this.textContent = option.label;
      }
      // `clearable` (default) activated
      else if (this.filter) {
        if (this.textContent === "") return this.forceEmptyValue();
        if (trueOldValue !== "anyvalue") return;
        const option = this.#autoselectableOption ?? this.#matchingOptions.find((o) => o.label === this.textContent);

        if (!option) return this.formResetCallback();
        option.selected = true;
        if (this.textContent !== option.label) this.textContent = option.label;
      }
      // `filter` mode is off AND `filteris` was just recently removed for cleanup
      else {
        /** @type {ComboboxOption | null | undefined} */ let option;

        if (this.textContent === "" && trueOldValue !== "unclearable") option = this.getOptionByValue("");
        else if (trueOldValue !== "anyvalue") option = this.#value == null ? null : this.getOptionByValue(this.#value);
        else option = this.#autoselectableOption ?? this.#matchingOptions.find((o) => o.label === this.textContent);

        if (!option) return this.formResetCallback();
        option.selected = true;
        if (this.textContent !== option.label) this.textContent = option.label;
      }

      return;
    }

    if (name === "filter" && (newValue == null) !== (oldValue == null)) {
      if (newValue == null) {
        this.removeAttribute("aria-autocomplete");
        this.removeAttribute("contenteditable");
        this.removeAttribute("filteris");

        if (this.isConnected) {
          this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
          this.removeEventListener("focus", ComboboxField.#handleFocus);
          this.removeEventListener("beforeinput", this.#handleSearch);
          this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
        }
      } else {
        this.setAttribute("aria-autocomplete", "list");
        this.setAttribute("contenteditable", "true");

        if (this.isConnected) {
          this.removeEventListener("keydown", this.#handleTypeahead);
          this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
          this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
          this.addEventListener("beforeinput", this.#handleSearch);
        }
      }

      return; // eslint-disable-line no-useless-return -- I want code in this callback to be easily moved around
    }
  }

  /** "On Mount" for Custom Elements @returns {void} */
  connectedCallback() {
    if (!this.isConnected) return;

    if (!this.#mounted) {
      // Setup Attributes
      this.setAttribute("role", "combobox");
      this.setAttribute("tabindex", String(0));
      this.setAttribute("aria-haspopup", "listbox");
      this.setAttribute(attrs["aria-expanded"], String(false));
      this.setAttribute(attrs["aria-activedescendant"], "");

      // NOTE: This initialization of `#matchingOptions` is incompatible with `group`ed `option`s
      if (this.filter) this.#matchingOptions = Array.from(this.listbox.children);
      this.#mounted = true;
    }

    // Require a Corresponding `listbox`
    if (!(this.listbox instanceof HTMLElement) || this.listbox.getAttribute("role") !== "listbox") {
      throw new Error(`The ${this.constructor.name} must be placed before a valid \`[role="listbox"]\` element.`);
    }

    // Setup Mutation Observers
    this.#optionNodesObserver.observe(this.listbox, { childList: true });
    this.#expansionObserver.observe(this, { attributes: true, attributeFilter: [attrs["aria-expanded"]] });
    this.#activeDescendantObserver.observe(this, {
      attributes: true,
      attributeFilter: [attrs["aria-activedescendant"]],
      attributeOldValue: true,
    });

    // Setup Event Listeners
    this.addEventListener("click", ComboboxField.#handleClick, { passive: true });
    this.addEventListener("blur", ComboboxField.#handleBlur, { passive: true });
    this.addEventListener("keydown", this.#handleKeydown);

    if (this.filter) {
      this.addEventListener("mousedown", ComboboxField.#handleMousedown, { passive: true });
      this.addEventListener("focus", ComboboxField.#handleFocus, { passive: true });
      this.addEventListener("beforeinput", this.#handleSearch);
    } else {
      this.addEventListener("keydown", this.#handleTypeahead, { passive: true });
    }
  }

  /** "On Unmount" for Custom Elements @returns {void} */
  disconnectedCallback() {
    this.#optionNodesObserver.disconnect();
    this.#expansionObserver.disconnect();
    this.#activeDescendantObserver.disconnect();

    this.removeEventListener("click", ComboboxField.#handleClick);
    this.removeEventListener("blur", ComboboxField.#handleBlur);
    this.removeEventListener("keydown", this.#handleKeydown);

    this.removeEventListener("mousedown", ComboboxField.#handleMousedown);
    this.removeEventListener("focus", ComboboxField.#handleFocus);
    this.removeEventListener("beforeinput", this.#handleSearch);
    this.removeEventListener("keydown", this.#handleTypeahead);
  }

  /**
   * Handles the searching logic for `combobox`es without a {@link filter}
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleTypeahead = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { listbox } = combobox;
    const activeOption = listbox.querySelector(":scope [role='option'][data-active='true']");

    // TODO: Should we allow matching multi-word `option`s by removing empty spaces during a search comparison?
    //       (NOTE: The native `<select>` element does not support such functionality.)
    if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      this.#searchString += event.key;

      /* -------------------- Determine Next Active `option` -------------------- */
      // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so
      const lastOption = activeOption ?? listbox.lastElementChild;
      let nextActiveOption = lastOption;

      while (nextActiveOption !== null) {
        nextActiveOption = nextActiveOption.nextElementSibling ?? listbox.firstElementChild;
        if (nextActiveOption?.textContent?.toLowerCase().startsWith(this.#searchString.toLowerCase())) break;
        if (nextActiveOption === lastOption) nextActiveOption = null;
      }

      /* -------------------- Update `search` and Active `option` -------------------- */
      clearTimeout(this.#searchTimeout);
      if (!nextActiveOption) {
        this.#searchString = "";
        return;
      }

      setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      this.#searchTimeout = window.setTimeout(() => (this.#searchString = ""), 500);
    }
  };

  /**
   * Handles the searching logic for `combobox`es with a {@link filter}
   * @param {InputEvent} event
   * @returns {void}
   */
  #handleSearch = (event) => {
    /*
     * Prevent developers from receiving irrelevant `input` events from `ComboboxField`.
     *
     * NOTE: This will sadly disable `historyUndo`/`historyRedo`, but that's probably not a big problem.
     * If it does become a point of contention/need in the future, then we can make a history `Stack` that is opt-in.
     */
    event.preventDefault();
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const text = /** @type {Text} */ (combobox.firstChild);

    /*
     * TODO: Express these notes in a way that's helpful, more coherent, and less distracting.
     *
     * Some things to NOTE and to TEST to gain the understanding that we need for this component and verify
     * that everything works.
     *
     * 1) [Note]: Firefox is the only Browser that supports multi-selection. We could skip supporting it, but we'll
     * choose to support it to avoid breaking user expectations. Note that when Firefox encounters a mult-select for
     * an `<input>` element, it will place the selection at the very end of the _last_ selection range after text
     * is inserted into the form control. (You should TEST that you're satisfying this behavior.)
     *
     * 2) [Note]: We expect that `ComboboxField` will always have only one child: a Text Node. (Important assumption.)
     *
     * 3) [Note]: CHROME BUG. Apparently `[contenteditable="plaintext-only"]` will break `getTargetRanges` in Chrome.
     * We should probably file a bug for this.
     *
     * 4) [Note]: SAFARI / BROWSERS + SELECTION. In Safari, you cannot use `Selection.addRange` to set the `Document`'s
     * current selection to something WITHIN a `Shadow DOM`. However, you CAN use `Selection.setBaseAndExtent` for this.
     * Note that Chrome/Firefox support `Selection.addRange` if the `Range` has "legal" access to content in a
     * `Shadow DOM`. However, since we're trying to create something with cross-browser support, this is irrelevant.
     * See:
     * - https://developer.mozilla.org/en-US/docs/Web/API/Selection/setBaseAndExtent
     * - https://github.com/mfreed7/shadow-dom-selection?tab=readme-ov-file#changes-to-existing-selection-apis
     *   (May not be the official spec, but seems to be the direction in which things are moving so far.)
     *
     * 5) [Note]: `set Element.textContent()` will replace all of the children of the related `Node`. This is bad because
     * it means you'll lose the reference to the Text Node that your `Range`(s) were originally pointing to. So instead,
     * get access to the underlying Text Node and modify the node's value (through `nodeValue`, `insertData`, etc.).
     *
     * 6) [Note]: You probably won't need to distinguish between `insert*` and `delete*` in most cases when updating
     * the `ComboboxField`'s content. For the delete scenario, you can just "insert" an empty, 0-character string.
     *
     * 7) [Note]: Apparently, all (non-static) `Range`s previously associated with a Text Node get emptied once the
     * referenced node's `nodeValue` is re-set. (The `Range`s probably don't know what to point to anymore since the
     * `nodeValue` has technically "changed".) This makes it imperative that you know when to leverage the a `StaticRange`
     * and when to work directly with a regular, dynamic `Range` (or a value that it cached before being modified).
     *
     * 8) [Test]: We want to verify that our "range shifting" for our `dynamicRange` variable is correct. So far,
     * the logic seems to be accomplishing what we want.
     *
     * 9) [Test]: Pressing `Enter` should select a Combobox Option, and it shouldn't leave the Combobox expanded.
     * (This should be fixed.) It also shouldn't expand the Combobox if it was previously collapsed.
     *
     * 10) [Test]: All regular spaces should appear within the `Combobox` edit/search field and should not be collapsed.
     * Requires CSS. See the `white-space`/`white-space-collapse` CSS Properties. (This should be fixed.)
     *
     * 11) [Test]: `deleteContentBackward` should not cause an error if done at the very beginning of the text.
     * (This should be fixed.)
     *
     * 12) [Test]: `deleteContentForward` should not move the cursor backwards if done at the very end of the text.
     * (This should be fixed.)
     *
     * 13) [Test]: The other variants of `delete` (e.g., `deleteWord*`) should work as normal. (I don't think we've
     * encountered any issues with this yet.)
     *
     * 14) [Test]: Entering text when the search is completely empty doesn't break anything. (It seems that when
     * you're inserting text into an empty element, the `StaticRange` generated during `beforeinput` points to
     * the element itself instead of the empty text node. So we should just reference the text node within
     * `ComboboxField`.)
     */

    // Update `combobox`'s Text Content based on user input
    const { inputType } = event;
    if (!inputType.startsWith("delete") && !inputType.startsWith("insert")) return;

    /** The `data` input by the user, modified to be valid for the `combobox` */
    let data = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
    data = data.replace(/[\r\n]/g, "");

    let rangeShift = 0;
    const staticRanges = event.getTargetRanges();
    for (let i = 0; i < staticRanges.length; i++) {
      const staticRange = staticRanges[i];

      const range = new Range();
      range.setStart(text, staticRange.startOffset + rangeShift);
      range.setEnd(text, staticRange.endOffset + rangeShift);

      const deletedCharacters = range.toString().length;
      range.deleteContents();

      /** The `startOffset` of the dynamic `Range` _after_ content deletion */
      const startOffset = range.startOffset; // eslint-disable-line prefer-destructuring -- Needed to apply JSDocs
      text.insertData(startOffset, data);
      rangeShift = rangeShift - deletedCharacters + data.length;

      if (i !== staticRanges.length - 1) continue;
      const cursorLocation = startOffset + data.length;
      const selection = /** @type {Selection} */ (combobox.ownerDocument.getSelection());
      selection.setBaseAndExtent(text, cursorLocation, text, cursorLocation);

      if (deletedCharacters === 0 && data.length === 0) return; // User attempted to "delete" nothing
    }

    // Filter `option`s
    const { listbox } = combobox;
    const search = /** @type {string} */ (text.nodeValue);
    setAttributeFor(combobox, attrs["aria-expanded"], String(true));

    let matches = 0;
    this.#activeIndex = 0;
    this.#autoselectableOption = null;

    // NOTE: This approach won't work with `group`ed `option`s, but it can be fairly easily modified to do so
    for (let option = listbox.firstElementChild; option; option = /** @type {any} */ (option.nextElementSibling)) {
      if (option === this.#emptyOption) continue;

      // NOTE: The "Empty String Option" cannot be `autoselectable` with this approach, and that's intentional
      if (search && !option.value) option.setAttribute("data-filtered-out", String(true));
      else if (search && !option.textContent?.toLowerCase().includes(search.toLowerCase()))
        option.setAttribute("data-filtered-out", String(true));
      else {
        // TODO: We can support case-insensitivity in the future here if we want.
        if (option.textContent === search) this.#autoselectableOption = option;

        option.removeAttribute("data-filtered-out");
        this.#matchingOptions[matches++] = option;
        if (matches === 1) setAttributeFor(combobox, attrs["aria-activedescendant"], option.id);
      }
    }

    // Remove any `option`s that still exist from the previous filter
    this.#matchingOptions.splice(matches);

    // NOTE: The responsibility of setting `autoselectableOption` to a non-null `option` belongs to this handler ONLY.
    // However, what is _done_ with said `option` is ultimately up to the developer, not this component.

    /*
     * TODO: This is probably a design decision note.
     * NOTE: We _sadly_ MUST set the internal values here. The main reason for this is that the setter can risk
     * messing things up if devs provide weird options. For example, `<option value="">Choose</option>` is problematic.
     * There are other weird possibilities, like an `option` whose `value` matches the `label` of a different `option`.
     * These are highly unlikely scenarios, but we don't have to think about them at all if we make them impossible
     * by setting the internal value directly and unconditionally deselecting that previously-selected `option`.
     */
    if (combobox.acceptsFilter(search)) {
      const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);
      this.#value = search;
      this.#internals.setFormValue(search);
      if (prevOption?.selected) prevOption.selected = false;

      combobox.dispatchEvent(
        new InputEvent("input", {
          ...event,
          cancelable: false,
          data: event.data || event.dataTransfer ? data : null,
          dataTransfer: null,
        }),
      );

      // NOTE/TODO: Depending on where we move the wrapping `if` block, we might need to move this line elsewhere.
      return this.#emptyOption?.remove();
    }

    if (matches === 0) {
      if (!this.#emptyOption) {
        this.#emptyOption = document.createElement("span");
        this.#emptyOption.textContent = this.emptyMessage;
        this.#emptyOption.setAttribute("role", "option");
        this.#emptyOption.setAttribute("aria-selected", String(false));
        this.#emptyOption.inert = true;
      }

      listbox.appendChild(this.#emptyOption);
      setAttributeFor(combobox, attrs["aria-activedescendant"], "");
    } else this.#emptyOption?.remove();
  };

  /* ------------------------------ Exposed Form Properties ------------------------------ */
  /** Sets or retrieves the `value` of the `combobox` @returns {string | null} */
  get value() {
    return this.#value;
  }

  /** @param {string} v */
  set value(v) {
    const newOption = this.getOptionByValue(v);
    if (v === this.#value && newOption?.selected === true) return;

    /* ---------- Update Values ---------- */
    if (!newOption && !this.acceptsFilter(v)) return; // Ignore invalid values
    const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);

    this.#value = v;
    this.#internals.setFormValue(this.#value);
    const label = newOption ? newOption.label : this.#value;
    // NOTE: `nodeValue` is TECHNICALLY faster, but it assumes `combobox` initialization... Might be confusing
    // for devs? Maybe not a big deal? Something to think about... `textNode.nodeValue` probably won't be our
    // bottleneck. 🙂 TODO: We should probably document this note in a better place maybe? Or condense this note?
    // TODO: Actually, we need to change our code to only use `Text` nodes somehow. This will be tricky when it
    // comes to setting data pre-mount... Or maybe shouldn't allow setting data pre-mount anymore? Hm...
    if (this.textContent !== label) {
      this.textContent = label;
      this.#autoselectableOption = null;
    }

    // Update `option`s AFTER updating `value`
    if (newOption?.selected === false) newOption.selected = true;
    if (prevOption?.selected && prevOption !== newOption) prevOption.selected = false;
    this.#validateRequiredConstraint();
  }

  /**
   * Coerces the value and filter of the `combobox` to an empty string, and deselects the currently-selected `option`
   * if one exists (including any `option` whose value is an empty string).
   *
   * @returns {void}
   * @throws {TypeError} if the `combobox` is not {@link filter filterable}, or if {@link filterIs} not `anyvalue` or
   * `clearable`.
   */
  forceEmptyValue() {
    if (this.filterIs !== "anyvalue" && this.filterIs !== "clearable") {
      throw new TypeError(`Method requires \`filter\` mode to be on and \`filteris\` to be "anyvalue" or "clearable"`);
    }

    const prevOption = this.#value == null ? null : this.getOptionByValue(this.#value);

    /** @type {Text} */ (this.firstChild).nodeValue = "";
    this.#value = "";
    this.#internals.setFormValue("");
    this.#autoselectableOption = null;
    if (prevOption?.selected) prevOption.selected = false;
  }

  /**
   * Retrieves the `option` with the provided `value` (if it exists)
   * @param {string} value
   * @returns {ComboboxOption | null}
   */
  getOptionByValue(value) {
    const root = /** @type {Document | DocumentFragment | ShadowRoot} */ (this.getRootNode());
    const option = /** @type {ComboboxOption | null} */ (root.getElementById(`${this.id}-option-${value}`));
    return option;
  }

  /** Sets or retrieves the name of the object. @returns {HTMLInputElement["name"]} */
  get name() {
    return this.getAttribute("name") ?? "";
  }

  set name(value) {
    this.setAttribute("name", value);
  }

  /** @returns {HTMLInputElement["disabled"]} */
  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value));
  }

  /** @returns {HTMLInputElement["required"]} */
  get required() {
    return this.hasAttribute("required");
  }

  set required(value) {
    this.toggleAttribute("required", Boolean(value));
  }

  /** @returns {void} */
  #validateRequiredConstraint() {
    // NOTE: We don't check for `this.value == null` here because that would only be Developer Error, not User Error
    if (this.required && this.value === "") {
      return this.#internals.setValidity({ valueMissing: true }, "Please select an item in the list.");
    }

    this.#internals.setValidity({});
  }

  /**
   * The `listbox` that this `combobox` controls.
   * @returns {HTMLElementWithChildren<ComboboxOption>}
   */
  get listbox() {
    return /** @type {typeof this.listbox} */ (this.nextElementSibling);
  }

  /* ------------------------------ Custom Attributes and Properties ------------------------------ */
  /** Activates a textbox that can be used to filter the list of `combobox` `option`s. @returns {boolean} */
  get filter() {
    return this.hasAttribute("filter");
  }

  set filter(value) {
    this.toggleAttribute("filter", Boolean(value));
  }

  /**
   * Indicates how a {@link filter filterable} `combobox` will behave.
   * - `unclearable`: The field's {@link value `value`} must be a string matching one of the `option`s,
   * and it cannot be cleared.
   * - `clearable` (Default): The field's `value` must be a string matching one of the `option`s,
   * but it can be cleared.
   * - `anyvalue`: The field's `value` can be any string, and it will automatically be set to
   * whatever value the user types.
   *
   * <!--
   * TODO: Link to Documentation for More Details (like TS does for MDN). The deeper details of the behavior
   * are too sophisticated to place them all in a JSDoc, which should be [sufficiently] clear and succinct
   * -->
   *
   * @returns {"anyvalue" | "clearable" | "unclearable" | null} One of the above values if the `combobox` is
   * {@link filter filterable}. Otherwise, returns `null`.
   */
  get filterIs() {
    if (!this.filter) return null;

    const value = this.getAttribute("filteris");
    if (value === "anyvalue") return value;
    if (value === "unclearable") return value;
    return "clearable";
  }

  /** @param {Exclude<this["filterIs"], null>} value */
  set filterIs(value) {
    this.setAttribute("filteris", value);
  }

  /**
   * @param {string} string
   * @returns {boolean} `true` if the `combobox` will preserve the provided `string` as a valid value/filter when
   * collapsed or `blur`red. Otherwise, returns `false`.
   */
  acceptsFilter(string) {
    if (!this.filter) return false;
    return this.filterIs === "anyvalue" || (this.filterIs === "clearable" && string === "");
  }

  /** @type {this["autoselectableOption"]} */
  #autoselectableOption = null;

  /**
   * Returns the `option` whose `label` matches the user's most recent filter input, if one exists.
   *
   * Value will be `null` if:
   * - The user's filter didn't match any `option`s
   * - The user explicitly selects a value (or the `combobox`'s value is set manually)
   * - The `combobox` was just recently expanded
   * @returns {ComboboxOption | null}
   */
  get autoselectableOption() {
    return this.#autoselectableOption;
  }

  /** The message displayed to users when none of the `combobox`'s `option`s match their filter. @returns {string} */
  get emptyMessage() {
    return this.getAttribute("emptymessage") ?? "No options found";
  }

  set emptyMessage(value) {
    this.setAttribute("emptymessage", value);
  }

  /* ------------------------------ Exposed `ElementInternals` ------------------------------ */
  /** @returns {ElementInternals["labels"]} */
  get labels() {
    return this.#internals.labels;
  }

  /** @returns {ElementInternals["form"]} */
  get form() {
    return this.#internals.form;
  }

  /** @returns {ElementInternals["validity"]} */
  get validity() {
    return this.#internals.validity;
  }

  /** @returns {ElementInternals["validationMessage"]} */
  get validationMessage() {
    return this.#internals.validationMessage;
  }

  /** @returns {ElementInternals["willValidate"]} */
  get willValidate() {
    return this.#internals.willValidate;
  }

  /** @type {ElementInternals["checkValidity"]} */
  checkValidity() {
    return this.#internals.checkValidity();
  }

  /** @type {ElementInternals["reportValidity"]} */
  reportValidity() {
    return this.#internals.reportValidity();
  }

  /* ------------------------------ Form Control Callbacks ------------------------------ */
  /** @returns {void} */
  formResetCallback() {
    const { listbox } = this;

    // NOTE: This logic might not work with `group`s (which we don't currently intend to support)
    /** @type {ComboboxOption | null} */
    const defaultOption = listbox.querySelector(":scope [role='option']:nth-last-child(1 of [selected])");

    if (defaultOption) this.value = defaultOption.value;
    else if (this.filterIs === "anyvalue" || this.filterIs === "clearable") this.value = "";
    else if (listbox.firstElementChild) this.value = listbox.firstElementChild.value;
  }

  /**
   * @param {string} state
   * @param {"restore" | "autocomplete"} _mode
   * @returns {void}
   */
  formStateRestoreCallback(state, _mode) {
    this.value = state;
  }

  /**
   * @param {boolean} disabled
   * @returns {void}
   */
  formDisabledCallback(disabled) {
    if (disabled) setAttributeFor(this, attrs["aria-expanded"], String(false));
  }

  /* ------------------------------ Combobox Event Handlers ------------------------------ */
  /**
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleClick(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const expanded = combobox.getAttribute(attrs["aria-expanded"]) === String(true);

    if (combobox.filter && expanded) return;
    combobox.setAttribute(attrs["aria-expanded"], String(!expanded));
  }

  /**
   * Used to determine if a {@link filter filterable} `combobox` was `:focus`ed by a `click` event.
   * @param {MouseEvent} event
   * @returns {void}
   */
  static #handleMousedown(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const root = /** @type {Document | ShadowRoot} */ (combobox.getRootNode());
    if (root.activeElement === combobox) return;

    combobox.setAttribute("data-mousedown", "");
    combobox.addEventListener("mouseup", () => combobox.removeAttribute("data-mousedown"), { once: true });
  }

  /**
   * (For {@link filter filtered} `combobox`es only)
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleFocus(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    if (combobox.hasAttribute("data-mousedown")) return;

    const textNode = /** @type {Text} */ (combobox.firstChild);
    document.getSelection()?.setBaseAndExtent(textNode, 0, textNode, textNode.length);
  }

  /**
   * @param {FocusEvent} event
   * @returns {void}
   */
  static #handleBlur(event) {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    setAttributeFor(combobox, attrs["aria-expanded"], String(false));
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  #handleKeydown = (event) => {
    const combobox = /** @type {ComboboxField} */ (event.currentTarget);
    const { listbox } = combobox;
    const activeOption = /** @type {ComboboxOption | null} */ (
      listbox.querySelector(":scope [role='option'][data-active='true']")
    );

    if (event.altKey && event.key === "ArrowDown") {
      event.preventDefault(); // Don't scroll
      return setAttributeFor(combobox, attrs["aria-expanded"], String(true));
    }

    if (event.key === "ArrowDown") {
      event.preventDefault(); // Don't scroll
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
        return combobox.setAttribute(attrs["aria-expanded"], String(true));
      }

      const nextActiveOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = Math.min(this.#activeIndex + 1, this.#matchingOptions.length - 1))]
        : activeOption?.nextElementSibling;

      if (nextActiveOption) setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "End") {
      event.preventDefault(); // Don't scroll

      const lastOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = this.#matchingOptions.length - 1)]
        : listbox.lastElementChild;

      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      setAttributeFor(combobox, attrs["aria-activedescendant"], lastOption?.id ?? "");
      return;
    }

    if (event.key === "Escape") {
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) return;

      event.preventDefault(); // Avoid unexpected side-effects like closing `dialog`s
      return combobox.setAttribute(attrs["aria-expanded"], String(false));
    }

    if (event.altKey && event.key === "ArrowUp") {
      event.preventDefault(); // Don't scroll
      return setAttributeFor(combobox, attrs["aria-expanded"], String(false));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault(); // Don't scroll
      if (combobox.getAttribute(attrs["aria-expanded"]) !== String(true)) {
        return combobox.setAttribute(attrs["aria-expanded"], String(true));
      }

      const nextActiveOption = combobox.filter
        ? this.#matchingOptions[(this.#activeIndex = Math.max(this.#activeIndex - 1, 0))]
        : activeOption?.previousElementSibling;

      if (nextActiveOption) setAttributeFor(combobox, attrs["aria-activedescendant"], nextActiveOption.id);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault(); // Don't scroll

      const firstOption = combobox.filter ? this.#matchingOptions[(this.#activeIndex = 0)] : listbox.firstElementChild;
      setAttributeFor(combobox, attrs["aria-expanded"], String(true));
      setAttributeFor(combobox, attrs["aria-activedescendant"], firstOption?.id ?? "");
      return;
    }

    if (event.key === " ") {
      if (combobox.filter) return; // Defer to `#handleSearch` instead
      event.preventDefault(); // Don't scroll

      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();
      return combobox.setAttribute(attrs["aria-expanded"], String(true));
    }

    if (event.key === "Enter") {
      // Prevent `#handleSearch` from triggering
      if (combobox.filter) event.preventDefault();

      // Select a Value (if the element is expanded)
      if (combobox.getAttribute(attrs["aria-expanded"]) === String(true)) return activeOption?.click();

      // Submit the Form (if the element is collapsed)
      const { form } = combobox;
      if (!form) return;

      // See: https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#implicit-submission
      /** @type {HTMLButtonElement | HTMLInputElement | null} */
      const submitter = Array.prototype.find.call(form.elements, (control) => {
        if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLButtonElement)) return false;
        return control.type === "submit";
      });

      if (submitter) return submitter.disabled ? undefined : submitter.click();
      return form.requestSubmit();
    }
  };

  /* ------------------------------ Combobox Mutation Observer Details ------------------------------ */
  /**
   * @param {MutationRecord[]} mutations
   * @returns {void}
   */
  static #watchActiveDescendant(mutations) {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      const combobox = /** @type {ComboboxField} */ (mutation.target);
      const root = /** @type {Document | DocumentFragment | ShadowRoot} */ (combobox.getRootNode());

      // Deactivate Previous Option
      const lastOptionId = mutation.oldValue;
      const lastOption = lastOptionId ? root.getElementById(lastOptionId) : null;
      lastOption?.removeAttribute("data-active");

      // Activate New Option
      const activeOptionId = /** @type {string} */ (combobox.getAttribute(attrs["aria-activedescendant"]));
      const activeOption = root.getElementById(activeOptionId);
      activeOption?.setAttribute("data-active", String(true));

      // If Needed, Scroll to New Active Option
      if (!activeOption) return;
      const { listbox } = combobox;
      const bounds = listbox.getBoundingClientRect();
      const { top, bottom, height } = activeOption.getBoundingClientRect();

      /**
       * The offset used to prevent unwanted, rapid scrolling caused by hovering an element at the infinitesimal limit where
       * the very edge of the `listbox` border intersects the very edge of the `element` outside the scroll container.
       */
      const safetyOffset = 0.5;

      // Align preceding `option` with top of listbox
      if (top < bounds.top) {
        if (activeOption === listbox.firstElementChild) listbox.scrollTop = 0;
        else listbox.scrollTop = activeOption.offsetTop + safetyOffset;
      }
      // Align succeeding `option` with bottom of listbox
      else if (bottom > bounds.bottom) {
        if (activeOption === listbox.lastElementChild) listbox.scrollTop = listbox.scrollHeight;
        else {
          const borderWidth = parseFloat(getComputedStyle(listbox).getPropertyValue("border-width"));
          listbox.scrollTop = activeOption.offsetTop - (bounds.height - borderWidth * 2) + height - safetyOffset;
        }
      }
    }
  }
}

export default ComboboxField;
