# Won't Fix

This file documents the collection of _known_ issues that &mdash; at least as of today &mdash; we don't intend to fix. Although we're open to fixing these bugs in the future, it would need to be proven that there are sufficiently-significant use cases that would motivate resolving these niche, unusual problems. Alongside each known bug, we'll document the reason for neglecting it.

## `ComboboxField`

### Data Loss When Transitioning `valueis` from `anyvalue` to `(un)clearable` in a Weird Way

Consider the following scenario:

1. A user is interacting with a `combobox` that is in `anyvalue` mode.
2. The user supplies a filter that has a corresponding `autoselectableOption`.
3. The user closes the `combobox`, leaving the `autoselectableOption` which matched their filter unselected.
4. The user re-expands the `combobox`.
5. The _developer_ changes the `valueis` attribute from `anyvalue` to `(un)clearable`.

In this scenario, the `autoselectableOption` is lost when the user expands the `combobox`. Thus, when the developer changes the `valueis` attribute thereafter from `anyvalue` to `(un)clearable`, the component isn't able to find a corresponding `option` to select. Thus, the `combobox` will reset its own value, potentially confusing the user as they see the component's text content change on its own.

A simple solution to this problem is to loop through all of the `option`s during this transition, searching for one whose `label` matches the `combobox`'s current text content. If no matching `option` is found, then the `combobox` will still have to be reset, but the reset will at least be more reasonable in this case.

The problem with this solution is that it's not performant to search through all of the `option`s, and adding this logic _ever so slightly_ increases our maintenance overhead and JS bundle size. Sure, hopefully developers won't rapdily change the `valueis` attribute, so perhaps this performance hit isn't really a big deal. However, it's also incredibly unlikely that anyone sane will need to satisfy this use case, and I'd rather not impose the performance costs on the greater majority of people who aren't concerned about this scenario.

A better _userland_ solution is for people to run this looping logic themselves when they transition the `valueis` attribute as mentioned above. This should be safe, reliable, and easy; and it leaves the "tax"/cost only on those who want it, rather than those who don't.

### `null` Value Mismatch When Transitioning from `(un)clearable` to `anyvalue` without Any `option`s

The `combobox` can have a `null` value when it owns no `option`s. We consider this to be an "uninitialized" state: It represents scenarios where the user has no way to change the value of the `combobox`. Any `combobox` that is `(un)clearable` can be in this state, whereas `combobox`es that accept `anyvalue` are never in this state because users can change the field's value simply by inputting text. Thus, `(un)clearable` `combobox`es that own no `option`s will always have a `null` value, and `anyvalue` `combobox`es that have no `option`s will default to an empty string value (`""`), accepting the user's input as a value as they type (just like regular `<input>` elements).

Well, if the developer does some very odd things with both the `combobox`'s `option`s _and_ the `valueis` attribute, they can end up in an invalid state. For example, consider the following scenario:

1. The `combobox` is in `unclearable` mode.
2. The `combobox` has all of its `option`s removed, causing it to be "uninitialized" and given a value of `null`.
3. The `valueis` attribute of the `combobox` is transitioned from `unclearable` to `anyvalue`.

Currently, because situations like these are so rare and impractical, the `ComboboxField` component does not take them into account. Thus, the `combobox` in `anyvalue` mode would have a value of `null`, which is incorrect. That said, there are some things to note:

- The value would be restored to a proper state once the user update the field's text.
- As far as server validation goes, `null` and `""` can virtually be considered the same.

Now, there is a scenario that is significantly more egregious:

1. The `combobox` is in `anyvalue` mode.
2. Through user input, the `combobox`'s value is changed to a non-empty string.
3. The `combobox` has all of its `option`s removed, but its value doesn't change since it's in `anyvalue` mode.
4. The `valueis` attribute of the `combobox` is transitioned from `anyvalue` to `unclearable`.

In this case, the `combobox` would maintain (and submit) a non-null value that is no longer valid. Although this isn't ideal, this scenario is, again, extremely unlike to appear in the wild. Even in situations where this problem _does_ appear, it is more likely that the user's later interactions will quickly bring the `combobox` back to a valid state.

As of today (2025-08-26), we don't have a lot of time to dwell on minor edge cases of the `<combobox-field>` like this one. So for now, we're dismissing this problem until it's raised as a _genuine_ concern &mdash; whether by us or by others. The solution shouldn't be too difficult to resolve and test once the rest of the component's details are fleshed out and tested.
