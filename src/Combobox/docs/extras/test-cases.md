# Combobox Test Cases

This file contains test cases for the `Combobox` component that have not yet been written in Playwright. Once the tests below are written/verified in Playwright, they should be removed from this file. **These tests are not necessarily exhaustive!** They just capture things that could slip past our attention and that we definitely _did not_ want to miss.

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

### Manual Verifications

- [ ] Verify that we don't need to conditionally remove `data-filtered-out` remove `#emptyOption` anymore.
  - Now that `#emptyOption` should never be included in Matching Options or the Filter Reset, we should never need to apply `data-filtered-out` to `#emptyOption` to begin with (meaning it should never need to be removed either).
