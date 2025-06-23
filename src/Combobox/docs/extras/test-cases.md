# Combobox Test Cases

This file contains test cases for the `Combobox` component that have not yet been written in Playwright. Once the tests below are written/verified in Playwright, they should be removed from this file. **These tests are not necessarily exhaustive!** They just capture things that could slip past our attention and that we definitely _did not_ want to miss.

## Miscellaneous

These are test cases that we discovered after starting work on the filterable `combobox`.

- [ ] The `listbox` **should not** receive focus when the user tabs _forwards_ from an expanded `combobox`. (The whole point of `aria-activedescendant` is to be able to skip `listbox`/`option` focus management altogether. I'm not certain why the browser put focus on this `div` at all. Doesn't seem like typical normal behavior.)

## `filter`able `combobox`es

- [ ] Test that when a user `Tab`s to the `combobox`, the full text content of the field is highlighted (similar to `<input>`s). **_However_** when a user focuses the `combobox` by `click`ing it, the cursor should instead naturally go to where the `MouseEvent` would place it.
- [ ] If the `combobox` is expanded when a previously-selected `option` exists, then the `#activeIndex` should point to the correct `option` (as should the `aria-activedescendant`, of course). You should run this test for a scenario where an `option` **_besides_** the 1st Option is the current value of the `combobox`. (You're also free to run the test for when the 1st Option is the current value as well, but as an add-on -- not a replacement.)
  - **NOTE**: To verify that `#activeIndex` is correct, you should play with the `ArrowUp`/`ArrowDown` keys to see how `aria-activedescendant` and `[role="option"][data-active]` changes. (The "active descendant" should move in the direction that you expect.)
- [ ] **Bug Fix**: Test that `#emptyOption` is excluded from the Filter Reset if 0 matching results were present _immediately before_ the `combobox` was `collapse`d.
- [ ] **Bug Fix**: Test that `#emptyOption` is excluded from the Matching Options if the filter matches the "No Options Message".
  - **NOTE**: Since the `#emptyOption` is typically removed from the DOM when there are matching `option`s, you'll probably need to verify this by attempting keyboard navigation through the `option`s.
- [ ] Test that the filtered `option`s don't update if the user attempts to "delete" nothing
  - This can be tested by pressing `Delete` at the very end of the searchbox _immediately_ after `expand`ing it.
- [ ] Verify that the `combobox` doesn't try to mark the "No Options Message" as `active` during navigation keystrokes.
  - **EDIT**: Actually, I don't know if we need this test anymore. If we're always careful to ensure that the Matching Options never include the `#emptyOption` -- whether during `#handleSearch` or the Filter Reset or whatever else -- then this requirement should automatically be taken care of, right?
- [ ] **Bug Fix**: Verify that the "No Options Message" will be displayed every time the user provides a filter that doesn't match any of the `option`s. (Previously, there was a bug where the Message would show up the first time; but as the user continued to adjust the filter, it would not appear later times.)
- [ ] The "Empty String Option" (e.g., `<combobox-option>Choose</combobox-option>`) should automatically get filtered out whenever the user's search/filter is a non-empty string. (The reasoning is simple: No user would want to go through the effort of filtering only to find an `option` that they can't actually use.)
- [ ] Pressing `Enter` should select a `ComboboxOption`, and it shouldn't leave the `combobox` expanded.
  - [ ] Pressing `Enter` **should not** cause a newline character to appear in the form control. (We need to check for this since our component is `contenteditable` when in `filter` mode.)
    - [ ] Similarly, pressing `Enter` **should not** expand the `combobox`.

### `Range`s, `Selection`, and Reimplementing the `input` Event

- **Firefox is the only Browser that supports multi-selection.**
  - [ ] When Firefox encounters a multi-_selection_ for an `<input>` element, it will place a _single_ cursor at the very end of the _last_ selection range after text insertion. Test that our `beforeinput` handler satisfies this behavior.
- [ ] **Bug Fix**: `deleteContentBackward` should not cause an error if done at the very beginning of the text. You should also test this for `deleteContentForward` at the very end of the text.
- [ ] All the variants of the `delete*` `inputType`s (e.g., `deleteWord*`) should "Just Work". (You probably don't need to test _every_ kind of text deletion. But you should at least test one or too.)
- [ ] **Bug Fix**: Entering text when the search is completely empty doesn't break anything.
  - We discovered the original bug in a very interesting way. It seems that when you're inserting text into an empty element, the `StaticRange` returned from `beforeinput` points to the element itself instead of the empty `Text` node that the element holds (assuming element contains a `Text` node). This made it necessary to directly reference the `Text` node within the `ComboboxField` instead of using the `StaticRange.startContainer`. (This was safe to do since we're assuming that the `ComboboxField` _always_ has a single child `Node` which is _always_ a `Text` node. Of course, there would still be ways to achieve the desired behavior if we couldn't run with that assumption; those solutions would just require a couple more lines of code.)

### Manual Verifications

- [ ] Verify that we don't need to conditionally remove `data-filtered-out` remove `#emptyOption` anymore.
  - Now that `#emptyOption` should never be included in Matching Options or the Filter Reset, we should never need to apply `data-filtered-out` to `#emptyOption` to begin with (meaning it should never need to be removed either).

## Behavior Differences of `anyvalue`, `unclearable`, and `clearable` (Default) `comboboxes`

Each of these attribute states need to consider when the `combobox`'s value or text content is updated or reset. (This includes keeping track of any `option`s that should be selected, deselected, or left alone.) And, of course, the `combobox` should be kept in a valid state as it transitions between these attribute states. Below are the rules that we believe result in the most optimal DX and UX. These use cases (identified by checkboxes) should be covered with automated tests.

1. [x] When the `combobox` collapses:
   - `anyvalue`
     - [x] The _text content_ of the `combobox` should not change, the _cursor_ is moved to the end of the search.
       - Reasoning: Although the component accepts any value in this mode, we can provide a more consistent experience for developers/users if we always move the cursor to the end of the `combobox` when it collapses. Additionally, we found that trying to leave the cursor untouched caused problems during value selection (because the cursor was no longer being auto-reset to the end of the `combobox` when it collapsed in this scenario).
   - `unclearable`
     - [x] The _text content_ is reset to the `label` of the currently-selected `option`, and the _cursor_ is moved to the end of the search string.
   - `clearable` (Default)
     - If the `combobox`'s text content is already empty
       - [x] Replicate the behavior of `anyvalue` (same reasoning as before)
     - Otherwise, (i.e., if the `combobox`'s text content is **not** empty)
       - [x] If the `combobox` **value** is an Empty String (`""`) **and** there is no corresponding `option` that is `selected`, the _text content_ should be reset to an Empty String.
         - This scenario can happen, for example, if A&rpar; The `combobox` was most recently emptied, **and** B&rpar; The user started searching immediately after emptying the `combobox`, **and** C&rpar; The user closed the `combobox` _without selecting a new value_.
       - [x] Otherwise, replicate the behavior of `unclearable`
2. [x] When the `combobox` is `expand`ed by Keyboard Navigation (i.e., **NOT** by `#handleSearch`)
   - [x] Delete the `autoselectableOption`, if it exists.
     - Reasoning: By expanding the `combobox`, the user has expressed that they're interested in starting a **new** "searching session", but they have not yet started searching for anything. Therefore, conceptually, there is no value that "matches their current search" at this time.
3. [x] When a **Developer** (or the component) sets the `combobox` value programmatically with **`combobox.value`**:
   - [x] If the value update causes the `combobox`'s _text content_ to be altered in **any** way, then the `autoselectableOption` should be deleted (if it exists).
     - Reasoning: If the `combobox`'s text content is programmatically changed by the developer/component (_case sensitive_), then obviously the user's previous filter has been overriden/removed. Therefore, there is no longer an autoselectable `option` based on the user's input. (In this case, an autoselectable `option` would no longer be useful anyway, since a decision was made to explicitly set the value in a different way.)
   - [x] If the value update would result in **no change** to the `combobox`'s _text content_, then `set textContent(value)` **should not** be called. More specifically, the user's **cursor** should not be displaced.
     - Reasoning: Whenever possible, we want to avoid disrupting the user's cursor. Of course, we can't control what developers do with our component, so it won't be possible to save all users from our end. Devs should handle cursor management themselves if they make riskier decisions.
   - `anyvalue`
     - If there is an `option` whose `value` matches what the developer supplied:
       - [x] The `combobox`'s _internal value / form value_ should be updated, **and** the text content of the field must match **the `label` of the `option`**. (Default Behavior)
       - [x] The matching `option` must **set `selected` to `true`**. (Default Behavior)
       - [x] If there was a previously-selected `option`, it should be deselected. (Default Behavior)
       - NOTE: All of this means that developers _will not_ be able to use `combobox.value` to set the filter to an Empty String **_if_** a `<combobox-option value="">Choose</combobox-option>` exists. This is by design. There are still ways to accomplish this programmatically if desired. (For example: `combobox.forceEmptyValue()`.)
     - Otherwise (i.e., if there **isn't** a matching `option`):
       - [x] The `combobox`'s _internal value / form value_ should be updated, **and** the text content of the field must match **the value supplied to the `setter`**.
       - [x] If there was a previously-selected `option`, it should be deselected. (Default Behavior)
   - `unclearable`
     - If there **isn't** a matching `option`:
       - [x] Ignore/Reject the provided value (Default Behavior). That is, do nothing.
     - Otherwise (i.e., if there is an `option` whose `value` matches what the developer supplied):
       - [x] Replicate the behavior of `anyvalue`. (For clarity, this will **only** replicate the **branch** of `anyvalue` behavior where there **is** a matching `option`.)
   - `clearable` (Default)
     - If the `combobox`'s _value_ **is being set** to an empty string:
       - [x] Replicate the behavior of `anyvalue`. (For clarity, this includes **both** branches of `anyvalue`'s behavior.)
     - Otherwise (i.e., if the `combobox`'s _value_ is **not** being set to an empty string):
       - [x] Replicate the behavior of `unclearable`. (For clarity, this includes **both** branches of `unclearable`'s behavior.)
4. [x] When a **Developer** (or the component) sets the `combobox` value programmatically with **`option.selected = true`**:
   - [x] The `combobox`'s _internal value / form value_ should be updated, **and** the text content of the field must match **the `label` of the selected `option`**. (Default Behavior)
   - [x] If there was a previously-selected `option`, it should be deselected. (Default Behavior)
5. [x] When a **Developer** (or the component) programmatically deselects an `option` with **`option.selected = false`**:
   - If the `combobox` accept's the user's current filter as a `value` (`anyvalue`, or `clearable` with an Empty String):
     - [x] **Do nothing**. The `combobox` has already been set to a valid value previously, so there is nothing to do.
   - Otherwise (i.e., if the `combobox` _does not_ accept the current filter as a `value`):
     - If the `combobox` accepts an Empty String as a valid value _and_ filter (`clearable` without an Empty String):
       - [x] The `combobox`'s _internal value / form value_ **and** its _text content_ should be set to an Empty String.
     - Otherwise (i.e., if the `combobox` doesn't accept any filters as values, which is true for `unclearable`):
       - [x] The `combobox`'s value should be **reset**.
   - Reasoning: Probably one of the best ways to think of the `option.selected = false` feature is to think of it as a means of "resetting" the `combobox` or "ignoring" the `option`. But really, the "resetting" is only done to preserve a valid value/state for the `combobox` after an `option` has been forcefully deselected (which is already unusual to do if no new `option` is selected in its place). In the case of a `combobox` that is `unclearable` (or un`filter`able), the `combobox` **_must_** always be kept in a valid, coherent state; so our only option (haha) is resetting the `combobox` entirely. But this is less of a concern with `anyvalue` and `clearable` because those filter modes accept values that _aren't_ part of the set of available `option`s. If an `option` is deselected, `anyvalue` dictates that the `combobox` is free to keep the current filter as a value; so no change is needed. (We could technically make sure that the `combobox` value is `option.label` instead of `option.value`, but that doesn't really matter as far as the user _or_ the developer is concerned -- especially if the _developer_ is doing the deselection.) In the same, `clearable` would dictate that a form reset back to the default value is unnecessary/inappropriate because an Empty String is accepted as a valid value and filter. The "reset" behavior is only a stopgap measure implemented by the native `<select>` element (and our component when needed) to keep the `combobox` in a valid state _when needed_. Thus, no action is necessary when the `combobox` is _already_ in a valid state. This is our own view; others may have different views. But this view is most simple and practical. If an `option` is deselected, simply bring the `combobox` back to the "closest" and least disruptive/unpredictable state.
     - Extra: I went back and forth on this, but this implementation seems like the best combination of simple and practical -- _especially_ for a feature that is **_highly unlikely_** to be used in the wild. (If it is used, it would be rare. After all, the developers who use frontend frameworks will be used to setting `value` directly instead of touching `option.value`. So we really shouldn't over-optimize any design decisions for this developer flow until getting clear feedback from developers anyway. Though, for practical reasons, this design decision probably won't change.)
6. [x] When a **User** changes the text content of the `combobox` by searching:
   - `anyvalue`
     - [x] The `combobox`'s _internal value / form value_ should be updated, **and** the text content of the field **should be left alone**.
       - Reasoning:
         1. If the User has applied a _non-empty_ search to the `combobox`, then the text content will already be correct.
         2. If the User has _emptied_ the `combobox` filter and a `<combobox-option value="">Choose</combobox-option>` exists as a valid `option`, the filter **should not** be auto-updated to `"Choose"`, as this would be an incredibly confusing UX. (It would basically become _impossible_ to set the `combobox` search to an empty string, despite the fact that the `combobox` accepts `anyvalue`. Not good!)
     - [x] The previously-selected `option` (if one exists) should **set `selected` to `false`**.
       - TODO: Would this be a confusing UX? This would mean that if a user selects an `option`, re-opens the `combobox`, then starts searching again, they would see their previously-selected `option` become unselected. It's not what we typically see out in the wild (I don't think), but it is frankly more honest. And hopefully it wouldn't take too much for users to get used to? We need to think on this. ... Worst case scenario, the other alternative is to only unselect the option _on `collapse`_ instead. But again, the downside there is that we'd temporarily be lying about the `combobox`'s current value (via the highlighted "selected" `option`) until a future point.
         - **EDIT**: Nonetheless, we think this approach makes sense and is "most honest", so we'll try it out and see how folks feel about it. Remember: This is only for `anyvalue`. Things are different for `unclearable` and `clearable`. We're keeping devs honest here. Clear communication is a good thing.
     - If the User's current search (exactly) matches the `label` of a valid `option`:
       - [x] The `ComboboxField.autoselectableOption` should be updated to the matching `option`. **But no `option`s should be auto-selected.**
         - Reasoning: It isn't immediately clear whether all developers would want autoselect behavior, nor is it clear _how_ they would want said behavior implemented. For example, some devs might want to autoselect an `option` whose `label` matches the current search, but _only_ after the `combobox` has been `blur`red. Others might want autoselection to occur immediately. By exposing an `autoselectableOption` instead of updating the matching `option` ourselves, we allow _developers_ to determine _how_ and _when_ autoselection occurs. That is, we simply say, "Here is the `option` that _would_ be autoselected, if that's what you wanted". They can choose to leverage this feature `oninput`, `onblur` under their own subjective circumstances, or even on `[aria-expanded="false"]` (using a `MutationObserver`).
     - [x] If the User's current search does not match _any_ of the available `option`s (case-insensitive search), then the "No Options Message" **should not be shown**.
       - Reasoning: The `combobox` accepts any value in this mode. So it's irrelevant whether there's a corresponding selectable `option` or not.
   - `unclearable`
     - [x] **No change** should be made to the `combobox`'s _internal value / form value_, **nor** to any of the `option`s. (Default Behavior)
     - If the User's current search matches the `label` of a valid `option`:
       - [x] Replicate the behavior of `anyvalue` (i.e., update `ComboboxField.autoselectableOption`).
   - `clearable` (Defualt)
     - If the `combobox`'s text content is already empty
       - [x] Replicate the behavior of `anyvalue`
     - If the `combobox`'s text content is **not** empty
       - [x] Replicate the behavior of `unclearable`
7. [x] When the `combobox`'s owning `form` is **reset**:
   - If the `combobox` has a `defaultSelected` option:
     - [x] The _last_ `defaultSelected` option should become the `combobox`'s value. (This includes updates to the `combobox`'s text content and the `option.selected` state.)
   - Otherwise (i.e., if the `combobox` **does not** have a `defaultSelected` option):
     - `anyvalue`
       - [x] The `combobox` value should be reset to an empty string.
       - [x] If an `option` exists whose value is an empty string, it should be programmatically marked as `selected`.
         - Reasoning: The reasoning for selecting the Empty String Option is kind of on a whim. If the developer is feeling that strongly that they want to add "Pick an Option" to the list of available `option`s, they must really want that default text in the `combobox` under certain circumstances (such as form resets).
     - `unclearable`
       - [x] The first `option` that the `combobox` has should be programmatically marked as `selected`.
     - `clearable` (Default)
       - [x] Replicate the behavior of `anyvalue`
8. [x] Modifying the `filteris` (or whatever we call it) attribute:
   - When the attribute is **added**/**updated**:
     - [x] If the attribute is added when `filter` mode is off, then `filter` mode is **automatically turned on**.
       - Reasoning: Originally, we played around with the idea of throwing an error at the user or logging a friendly error message. However, the simplest way to keep users from footgunning themselves is by satisfying the prerequisites for them. This is probably a much better DX. And it also allows our code to be less defensive/paranoid.
     - If the attribute is `anyvalue`:
       - If the `combobox`'s text content is an empty string
         - [x] Set the `combobox` value to its current text content (i.e., the empty search string).
         - [x] **Deselect** the currently-selected `option` (even if it's the Empty String Option).
         - These 2 decisions will avoid User Confusion and perhaps even Developer Confusion.
       - Otherwise, if the `combobox` is collapsed:
         - [x] Do nothing.
           - Reasoning: In this scenario, the component should be transitioning _to_ `anyvalue` _from_ `clearable`/`unclearable`, with a text content that is _not_ an empty string. In such a case, the component should already have a valid value since it isn't in the process of being interacted with (as indicated by its collapsed state), and the previous `filteris` states would have required a valid `option` to already be selected.
         - Otherwise (i.e., if the `combobox` is **expanded**):
           - [x] If an `autoselectableOption` exists, set the `combobox`'s value to it.
             - Reasoning: This will prevent developers from encountering scenarios where an `option` which matches the current filter unexpectedly becomes unselected after `anyvalue` is applied to the component. (Note that this logic _cannot_ be relied on while the `combobox` is collapsed. In such a case, the `combobox` filter was already coerced back to the correct value by `clearable`/`unclearable` when the user `blur`red the field, but the `autoselectableOption` might point to a different `option` which matched the user's filter before they gave up and collapsed the component. This is why the component does nothing if `anyvalue` is turned on while the `combobox` is collapsed; doing so produces more accurate/predictable behavior.)
           - [x] If no `autoselectableOption` exists, set the `combobox` value to its current text content.
             - Reasoning: (At this point, this is the closest we can get to a valid state.)
     - If the attribute is `unclearable`:
       - If the `combobox`'s text content is an empty string (`""`):
         - [x] If a valid `""` option exists, select it.
         - [x] Otherwise, **reset** the `combobox`.
       - Otherwise, If the `combobox` was previously `anyvalue`:
         - [x] If an `autoselectableOption` exists, select it.
         - [x] If no `autoselectableOption` is found, look through the currently-matching `option`s for something that matches the field's text content.
           - Reasoning: It probably isn't so performant to loop through all of the matching `option`s like this when the attribute is changed. However, there are 2 important things to consider here: 1&rpar; This behavior results in a more intuitive (albeit slower) UX/DX, and 2&rpar; Developers should **_rarely_** be changing between `filteris` states anyway -- if ever.
         - [x] If no matching `option` is found, **reset** the `combobox`.
       - If the `combobox` was previously `clearable`:
         - [x] **Do nothing**. By the time you get here, `clearable` and `unclearble` behave identically, so there's nothing to "correct" or "compensate for".
     - If the attribute is `clearable` (Default):
       - If the `combobox`'s text content is an empty string
         - [x] Set the `combobox` value to its current text content (i.e., the empty search string).
         - [x] **Deselect** the currently-selected `option` (even if it's the Empty String Option).
       - If the `combobox` previously accepted `anyvalue`:
         - [x] If an `autoselectableOption` exists, select it.
         - [x] If no `autoselectableOption` is found, look through the currently-matching `option`s for something that matches the field's text content. (Reasoning is same as above.)
         - [x] If no `autoselectableOption` is found, **reset** the `combobox`.
       - [x] If the `combobox` was previously `unsearchable`, **do nothing**. By the time you get here, `clearable` and `unclearable` behave identically.
   - When the attribute is **removed**:
     - If the `combobox` is in `filter` mode:
       - [x] Act as if the attribute was set to `clearable` (i.e., the default `filteris` value).
     - Otherwise (i.e., if the `combobox` is **not** in filter mode):
       - This indicates that the developer implicitly chose to remove the `filteris` attribute by removing the `filter` attribute. (See Section #9 below.)
       - [x] If the `combobox`'s text content is empty **AND** the `combobox` previously supported clearing (i.e., it was not `unclearable`), then **select the Empty String Option** (if it exists).
       - [x] Otherwise, if the `combobox` previously rejected invalid/unrecognized values (i.e., it was not `anyvalue`), then **synchronize the `combobox`'s text content with the currently-selected `option`**.
       - [x] Otherwise, if the `combobox` was previously `anyvalue`:
         - [x] If an `autoselectableOption` exists, select it.
         - [x] If no `autoselectableOption` is found, look through the currently-matching `option`s for something that matches the field's text content. (Reasoning is same as above.)
       - [x] If no `option` was found through any of these _scoped_ searching approaches, **reset** the `combobox`.
       - Reasoning: These changes are necessary to restore the `combobox` to a valid state since it will no longer be searchable.
   - Note: The approaches here favor the following three things: 1&rpar; Maintaining a valid value/state for the `combobox`, 2&rpar; preserving the _previously-existing_ behavior as much as possible during transitions between states, and 3&rpar; Avoiding confusing experiences for users/developers (as much as possible, with minor conflicts of interest between both target groups). Since component state is a higher priority than UX (and intentionally so, for developer predictability), devs should avoid changing this attribute while the user is interacting with the `combobox` whenever possible, though transitioning to `anyvalue` should generally always be safe.
9. [x] Modifying the `filter` attribute
   - [x] If the `filter` attribute is added and the `filteris` attribute is absent, **do nothing**. (The `combobox` is considered to be in a valid state already.)
   - [x] If the `filter` attribute is removed and the `filteris` attribute is **present**, then **remove `filteris` automatically**. (This is necessary to avoid unexpected/invalid states and behaviors.) **This action should _avoid_ any unexpected side effects.**
10. When the `combobox` is initialized by the `SelectEnhancer`:
    - [x] If the `combobox` that allows empty values (i.e., that is `clearable`/`anyvalue`) is initialized without a default `option`, then force the `combobox` value/filter to an Empty String.
      - Reasoning: We need a simple way to enable developers to default the `combobox` filter/value to an empty string on mount or page load. This seems like the best solution for now. Unfortunately, this approach means that if developers dynamically create a `<select>` element in a `DocumentFragment`, select an `option` in it without setting `defaultSelected`, and then mount that `<select>` element to the DOM within a `<select-enhancer>`, some information will be lost. But the simple solution to that problem is just to set `defaultSelected` during the weird, unorthodox, behind-the-scenes manipulation of a `<select>` element that hasn't yet been placed in the DOM.
