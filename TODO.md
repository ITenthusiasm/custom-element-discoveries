# TODO

- [ ] Make a note that the `value` of `<combobox-option>` (and therefore a `<select>`'s `<option>`) MUST be unique (for accessibility reasons related to `aria-activedescendant` and HTML's disallowing of duplicate `id`s). This shouldn't realistically cause problems for anyone. I don't know if duplicate values have a valid use case anyway. Duplicate values will produce unpredictable behavior.
- [ ] Add CSS for `<select-enhancer> > <select>` (for when JS is disabled/unavailable).
- [ ] Do we want to add a Caret Icon for the Combobox component?
- [ ] When do we want to consider a `searchable` Combobox -- if ever? Should it be its own component? Or should the `ComboboxField` simply be configurable?
- [ ] Consider adding a GitHub CI Action to lint our code.
- [ ] See if there's a way to get Browser AutoFill working. (See: https://web.dev/articles/more-capable-form-controls#lifecycle_callbacks)

## Potential Considerations

- [ ] Support resetting the `ComboboxField`'s value if the selected `ComboboxOption` is removed.
