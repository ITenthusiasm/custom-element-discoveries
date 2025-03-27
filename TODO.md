# TODO

- [ ] When do we want to consider a `searchable` Combobox -- if ever? Should it be its own component? Or should the `ComboboxField` simply be configurable?
- [ ] Do we want to add/support a Caret Icon for the Combobox component?
- [ ] Add CSS for `select-enhancer > select` (for when JS is disabled/unavailable).
- [ ] Make a note about using different kinds of Combobox "Adapters"/"Wrappers".
- [ ] Make a note that the `value` of `<combobox-option>` (and therefore a `<select>`'s `<option>`) MUST be unique (for accessibility reasons related to `aria-activedescendant` and HTML's disallowing of duplicate `id`s). This shouldn't realistically cause problems for anyone. I don't know if duplicate values have a valid use case anyway. Duplicate values will produce unpredictable behavior.
- [ ] Add documentation in general about how this component works, what expectations are, and what feature parity is with native `<select>`
- [ ] Should our tests assume that our Combobox Component is in a `<form>` by default since the custom element itself is a Form Control?
- [ ] We should definitely add a test **_proving_** that our component works in Shadow DOMs at some future point.
- [ ] Consider adding a GitHub CI Action to lint our code.
- [ ] Unless we're mistaken, Playwright currently has a bug. For some reason, the tests related to `tab`bing are failing for Playwright's `WebKit` browser. However, tabbing works fine manually in Safari. Since it works manually, we can investigate this more later or open a Playwright bug. (It's probably a Playwright bug since we didn't actually change any of our code surrounding focusing/tabbing -- unless this is an Operating System issue.) **_NOTE_**: For right now, the tests still seem to be passing on CI. So this really seems to be a Playwright issue and/or an OS issue (or some other similar, inconspicuous issue).

## Potential Considerations

- [ ] Don't the native `<option>` elements allow safe attribute/property changes even if they aren't connected to the DOM? Should we allow something similar? (Mainly thinking of supporting changing the `ComboboxOption.selected` property in isolation.) For example, maybe we could support this by returning early based on `!this.combobox`? Need to investigate... and evaluate if this is even worthwhile...
- [ ] Far-off thought: Should we give developers an easy way to set this component up themselves? We'd also want to make sure that frameworks can create our Web Component just fine, without running into any problems. (There would only be a concern if people wanted to provide `<combobox-option>` and `<combobox-field>` directly instead of using `<select-enhancer>` in conjunction with `<select>` -- at least, that's our assumption). **Note**: This ties into our idea about "Adapters", and it might be sufficient to delegate this problem to UserLand with the "Adapters" concept.

## IMMEDIATE CURRENT WORK/PRIORITY

Double check our existing code to make sure it is [sufficiently] coherent and not absolute garbage **_before_** you go adding new features (like the `formResetCallback` support).
