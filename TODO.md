# TODO

- [ ] Make a note about using different kinds of Combobox "Adapters"/"Wrappers".
- [ ] Make a note that the `value` of `<combobox-option>` (and therefore a `<select>`'s `<option>`) MUST be unique (for accessibility reasons related to `aria-activedescendant` and HTML's disallowing of duplicate `id`s). This shouldn't realistically cause problems for anyone. I don't know if duplicate values have a valid use case anyway. Duplicate values will produce unpredictable behavior.
- [ ] Add documentation in general about how this component works, what expectations are, and what feature parity is with native `<select>`
- [ ] Add CSS for `select-enhancer > select` (for when JS is disabled/unavailable).
- [ ] Do we want to add a Caret Icon for the Combobox component?
- [ ] When do we want to consider a `searchable` Combobox -- if ever? Should it be its own component? Or should the `ComboboxField` simply be configurable?
- [ ] We should definitely add a test **_proving_** that our component works in Shadow DOMs at some future point.
- [ ] Consider adding a GitHub CI Action to lint our code.
- [ ] See if there's a way to get Browser AutoFill working. (See: https://web.dev/articles/more-capable-form-controls#lifecycle_callbacks)

## Potential Considerations

- [ ] Don't the native `<option>` elements allow safe attribute/property changes even if they aren't connected to the DOM? Should we allow something similar? (Mainly thinking of supporting changing the `ComboboxOption.selected` property in isolation.) For example, maybe we could support this by returning early based on `!this.combobox`? Need to investigate... and evaluate if this is even worthwhile...
- [ ] Far-off thought: Should we give developers an easy way to set this component up themselves? We'd also want to make sure that frameworks can create our Web Component just fine, without running into any problems. (There would only be a concern if people wanted to provide `<combobox-option>` and `<combobox-field>` directly instead of using `<select-enhancer>` in conjunction with `<select>` -- at least, that's our assumption). **Note**: This ties into our idea about "Adapters", and it might be sufficient to delegate this problem to UserLand with the "Adapters" concept.

## IMMEDIATE CURRENT WORKING PROGRESS

- We're starting to find it increasingly inconvenient that we don't know when the `ComboboxField` has been initialized (indicated by a non-`null` value property). This is evidenced by our new work in the `ComboboxOption.#syncWithCombobox` method that supports setting `ComboboxOption.selected` during mounting if the default-selected option has a value of `""`. It's just too much work. Allow the value of `CombobxField.value` to be `string | null`. This will make things easier, and it will likely make more sense to ourselves and to any developers who use our component. There isn't really a downside to this, practically speaking, especially since a `ComboboxField` without a value shouldn't be submitting anything but `null` to the server anyway. (Hopefully `null` values don't get submitted since `null` would be implicit. We'll see what happens when we start playing with `ElementInternals.setFormValue`. Again, servers should be validating incoming form data regardless.)
