# TODO

- [ ] Verify that the `combobox` is not operable (in Major Browsers) when the `ComboboxField` has the `disabled` attribute.
- [ ] When do we want to consider a `searchable` Combobox -- if ever? Should it be its own component? Or should the `ComboboxField` simply be configurable?
- [ ] Do we want to add/support a Caret Icon for the Combobox component?
- [ ] Add CSS for `select-enhancer > select` (for when JS is disabled/unavailable).
- [ ] Add the TypeScript ESLint rule that checks for unused `Promise`s so that we don't have jank behavior in our tests.
- [ ] Make a note about using different kinds of Combobox "Adapters"/"Wrappers".
- [ ] Make a note that the `value` of `<combobox-option>` (and therefore a `<select>`'s `<option>`) MUST be unique (for accessibility reasons related to `aria-activedescendant` and HTML's disallowing of duplicate `id`s). This shouldn't realistically cause problems for anyone. I don't know if duplicate values have a valid use case anyway. Duplicate values will produce unpredictable behavior.
- [ ] Add documentation in general about how this component works, what expectations are, and what feature parity is with native `<select>`
- [ ] Should our tests assume that our Combobox Component is in a `<form>` by default since the custom element itself is a Form Control?
- [ ] We should definitely add a test **_proving_** that our component works in Shadow DOMs at some future point.
- [ ] Consider adding a GitHub CI Action to lint our code.

## Potential Considerations

- [ ] Don't the native `<option>` elements allow safe attribute/property changes even if they aren't connected to the DOM? Should we allow something similar? (Mainly thinking of supporting changing the `ComboboxOption.selected` property in isolation.) For example, maybe we could support this by returning early based on `!this.combobox`? Need to investigate... and evaluate if this is even worthwhile...
- [ ] Far-off thought: Should we give developers an easy way to set this component up themselves? We'd also want to make sure that frameworks can create our Web Component just fine, without running into any problems. (There would only be a concern if people wanted to provide `<combobox-option>` and `<combobox-field>` directly instead of using `<select-enhancer>` in conjunction with `<select>` -- at least, that's our assumption). **Note**: This ties into our idea about "Adapters", and it might be sufficient to delegate this problem to UserLand with the "Adapters" concept.

## IMMEDIATE CURRENT WORK/PRIORITY

Double check our existing code to make sure it is [sufficiently] coherent and not absolute garbage **_before_** you go adding new features (like the `formResetCallback` support).
