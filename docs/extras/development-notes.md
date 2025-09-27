# Development Notes

A collection of questions/concerns that I thought through while designing some of the Web Components in this repository.

## Enabling Edits to `ComboboxOption.selected` Pre-mount, but Not `ComboboxField.value` (2025-09-18)

We recently decided to update our components so that they do exactly what the title says. The justification for this change is a mix between 1&rpar; what JS Frameworks like React expect during DOM element creation, and 2&rpar; how the native `<select>` element behaves.

### The `<select>` Element's Behavior

If you create a `<select>` element in native HTML/JS, its value will default to an empty string. Since the element has no `option`s at creation, its value cannot be changed. Attempting to change the value to a non-empty string will result in the element's value getting coerced back to an empty string. This makes sense, as this is the exact same behavior one experiences when trying to set a `<select>`'s value to something that is not represented in its list of `option`s &mdash; except in this case, there are no `option`s at all.

Given the `<select>` element's behavior, we think that it also makes sense to prevent the `ComboboxField`'s value from being changed before it is mounted with `option`s. Technically speaking, this is already the behavior of the `ComboboxField` since its value cannot be set to a string for which there is no corresponding `option` &mdash; much like the `<select>` element. The exception to this rule is that the value can unconditionally be set to any string in `anyvalue` mode, because the field behaves as a mix between `<select>` and `<input>` in that case. (Although the value can also be "unconditionally" set to an empty string in `clearable` mode, this is only allowed if the `combobox` has at least one `option`. Thus, `clearable` mode would still prevent value updates before `option`s are mounted.)

Unfortunately, this approach will make it impossible to set the `ComboboxField`'s value in React via `<combobox-field value={value}></combobox-field>` **_if the `option`s haven't been mounted yet_**. However, we never desired to support such a use case (since it is non-semantic markup, as far as `<select>` is concerned), and the value can still be set **_after_** mounting anyway. The only reason React is able to get away with its unorthodox behavior/markup is that it always creates child elements _before_ the parent elements. In the case of `<select>`, all `<option>`s are children of the element; so setting `HTMLSelectElement.value` is "legal". However, in the case of `<combobox-field>`, the `option`s _are not_ children of the `combobox` (nor should they be, according to accessibility requirements).

Since we want to encourage developers to set default values with `ComboboxOption.defaultSelected` (or `<combobox-option selected>`) rather than `ComboboxField.value`, we're fine with this restriction. Note that developers using Select Enhancing Mode in React are free to use `<select value={value}>` if they feel so strongly about it. This is because React will determine the right value of the `<select>` element _first_; then, when the `SelectEnhancer` is connected to the DOM and its `connectedCallback()` fires, it will correctly transfer the `<select>`'s value to the newly-created `ComboboxField`. So our restrictions on setting the component's value pre-mount only applies to Manual Setup Mode (and reasonably so, in light of `<select>`'s behavior).

### The `<option>` Element's Behavior

Interestingly enough, native HTML/JS allow marking `<option>`s as `selected`/`defaultSelected` _before_ they are attached to a `<select>` element. However, once a collection of `option`s are attached to the `<select>` element, the _last_ `option` marked as `selected` becomes the value of the `<select>` element. This makes sense and is reasonable behavior since the `selected` state of an `HTMLOptionElement` has no real meaning until it is attached to a `<select>` element.

This behavior is similar to how `<select>` treats `defaultSelected`. In fact, this behavior might be the reason _why_ the `<select>` element always chooses the last `defaultSelected` `option` when a page is initially loaded. After all, when an _isolated_ `option` has the `selected` attribute applied to it (or sets `option.defaultSelected = true`), its `selected` **_property_** also becomes `true`. (A similar thing happens when the `selected` attribute is removed from the `<option>`.)

Thus, `<select>`'s value-setting logic with `defaultSelected` options on page load/mount is likely just be a subset of its overall behavior where it accepts the value of the last `option` that is marked `selected` when new `option`s are added to the form field. (You read that correctly. If an `<option>` with `HTMLElementOption.selected = true` is added to the `<select>` element, it automatically _overwrites_ the previously-selected `option`'s `selected` state **_regardless_** of whether the `option` is _prepended_ or _appended_.)

Perhaps the best way to see `HTMLOptionElement.defaultSelected` is to see it in a similar way as `HTMLInputElement.defaultValue` (which corresponds to the `<input>`'s `value` attribute). The `value` attribute can be set on an `<input>` to give it a default value, which is relevant for initial page load and form resets. Changing the `value` attribute will update the `<input>`'s value, but this stops happening once the user starts interacting with the form control.

The behavior is more or less the same with the `<select>` element (though at times we've seen some somewhat confusing/misleading behavior which we don't currently know how to reproduce). Updating `HTMLOptionElement.defaultSelected` will update the owning `<select>`'s value until the user interacts with the form control. Unfortunately, our component doesn't support leaving the `combobox`'s value unchanged if `defaultSelected` is altered _after_ user interaction has started; but this doesn't seem like an important use case for people. And there _should_ be workarounds to this issue.

> Sidenote: _Maybe_ we could support the `HTMLSelectElement`'s logic for `defaultSelected` edits _post_ user interaction if the `ComboboxField` controlled which `option`s were selected &mdash; instead of each `ComboboxOption` kind of deciding this on their own. If we updated `selected` attributes and properties within the `ComboboxField` via a `MutationObserver`, maybe this could work? But again, unless users really _need_ this behavior, this probably isn't worth exploring.

Why am I belaboring the point that `<select>`'s mounting behavior with `HTMLOptionElement.defaultSelected` is actually just its behavior with `HTMLOptionElement.selected` behind the scenes? Because this has implications for what's appropriate for us to do with our own `ComboboxOption`s. Previously, updating a `ComboboxOption`'s `selected` state before mounting (or before "pseudo-mounting" with a `DocumentFragment`) was not allowed, because there was no `ComboboxField` to sync values with. "We MUST ensure that there are no two `option`s which are `selected` at the same time on mount!!!", we thought. But if `<select>` allows marking `<option>`s as `selected` in isolation, then shouldn't we?

We can follow the same exact behavior as the `<select>` element: "Sure, mark whichever `option`s you want as `selected` and/or `defaultSelected`. But when you finally mount the `option`s in their proper location, we'll clean up your mess and make sure the correct `option` is selected." In the case of `Select Enhancing Mode`, the `<select>` element will already have done the work of making sure that the correct `option` (or _`option`s_ in `multiple` mode) is selected. So while we're iterating over the `<option>`s and creating `ComboboxOption`s from them, the `ComboboxOption`s will already have the correct `selected` state as long as `ComboboxOption.selected` is set _after_ `ComboboxOption.defaultSelected` (which already happens today).

As for `Manual Setup Mode`, we have a little more work to do. We already iterate over the `<combobox-listbox>`'s children to guarantee that the correct `id`s are set on the `ComboboxOption`s (which ensures that the `ComboboxField` can find and select the correct `option` during mounting), and to remove any nodes that aren't real `ComboboxOption`s. What we need to do _now_ is iterate over these children _backwards_ (from `lastElementChild` to `firstElementChild`) so that we can identify the `option` that should _truly_ be marked `selected`. If multiple `ComboboxOption`s are marked `selected`, then _every_ `ComboboxOption` _except_ the last `selected` one should have their `selected` property set to `false`. This will guarantee that the `ComboboxField` will be mounted with the correct initial value, and that only 1 `option` &mdash; the _correct_ `option` &mdash; will be marked `selected` before the user interacts with the component.

### Conclusion / TL;DR

We _will_ support setting the `ComboboxOption`'s `selected` and `defaultSelected` states in isolation. It is up to the `SelectEnhancer` (or a power user's implementation/replacement of the `SelectEnhancer`) to make sure that the proper `option`(s) are marked `selected` on mount, _before_ the user interacts with the form field.

We _will not_ support setting the `ComboboxField`'s value in isolation, as the `HTMLSelectElement` does not support this behavior either. To default the `ComboboxField`'s value, `ComboboxOption.defaultSelected` (or its corresponding attribute) should be set instead; this is how the regular `HTMLSelectElement` is _meant_ to behave &mdash; _without_ React's hacks. That said, developers using `Select Enhancing Mode` in React will be able to use `HTMLSelectElement.defaultValue` to set the _initial_ value of the `ComboboxField`. (The keyword here is _initial_ value. React's idiomatic behavior with the `HTMLSelectElement` does not support form resets because no true `defaultSelected` option exists. The same will be true if a developer uses `Select Enhancing Mode` in conjunction with React's unorthodox hack for defaulting a `<select>` element's value.) Developers will likely be using only `Select Enhancing Mode` or only `Manual Setup Mode` in their codebases, so everyone should be more or less content with this minor restriction.

Note that developers who use React and who use _semantic HTML_ to set the default value of Radio Buttons will already be familiar with how to apply `default*` to the right child element during rendering.

## Some Thoughts and Non-Concerns about Loading `option`s Asynchronously (_PRE_ 2025-09-18)

There are some _minor, negligible_ performance drawbacks when it comes to loading `option`s asynchronously with the `ComboboxField`. _It has not yet been proven that these performance drawbacks pose any real problems._ Rather, we simply know that there are _opportunities_ for optimization that we have ignored for the time being because they don't seem necessary. This section documents how developers would typically go about loading `option`s, and why they shouldn't experience any real bottlenecks while doing so.

Before diving into anything, I want to express a very important point which strongly impacts this discussion: Whenever a developer chooses to load `option`s asynchronously while the user types, the `ComboboxField` will **_always_** be required to update its `#matchingOption`s. It might be reasonable to skip the _filtering_ of the `option`s, but it will never be reasonable to skip the updates to `#matchingOption`s. Here's the reason why: If a user loads 10 `option`s, but then copy/pastes a new filter that loads 20 `option`s, they won't be able to navigate to the last 10 `option`s with the arrow keys if the `#matchingOption`s aren't updated. Similarly, if they start with 20 `option`s but then drop down to 10 with a new filter, the arrow keys could take them out of bounds.

Keep that point in mind as we carry on. You might be thinking, "Why even use `#matchingOption`s? Can't you just sidestep some problems here by dynamically manipulating the DOM to render only the `option`s matching the user's filter?" If that's your question, see [Why Loop through Every Option during Filtering?](../../DEVELOPMENT_NOTES.md#why-loop-through-every-option-during-filtering-2025-05-06) TL;DR, The `#matchingOption`s approach is _definitely_ the way to think about managing/navigating the filtered `option`s &mdash; both from a performance standpoint and from a framework agnosticism standpoint.

### How Developers Can Load `option`s Asynchronously

To understand where bottlenecks could occur and why they're negligible, it's first important to understand how async `option` loading works: Developers can listen for the `filterchange` event to know when a user updates the filter. Once a developer sees that a user has updated the filter, they can apply whatever logic they want to load new `option`s. For example, they can do the following _synchronously_: 1&rpar; Update the styles of the Combobox Component to display a "Loading..." message (whether via `combobox[data-loading] + listbox::after` or via `combobox[data-loading] ~ [data-my-element-with-loading-message]` or something else), 2&rpar; Display a Loading indicator/circle in place of the Caret icon (if the dev chooses to use such icons), and 3&rpar; cancel the `filterchange` event to prevent the filtering logic from running unnecessarily. (If the old `option`s are going to get replaced anyway, why filter them?) Afterwards, they can _asynchronously_ load the new `option`s.

Once the new `option` data is loaded, the developer can take one of two primary approaches, depending on whether they are using pure JS or a JS Framework.

1. In Pure JS land, developers can create new `<combobox-option>` elements from the data that was loaded asynchronously. This list of `combobox-option`s (perhaps created in a `Document Fragment`) could then be used to replace the old `option`s by performing something like `ComboboxListbox.replaceChildren(fragmentWithNewOptions)`.
2. In JS Framework land (e.g., React), developers can set a local state variable to an array containing the `option` data that was loaded asynchronously. Then, in the framework's markup, they could map the state variable to a list of `<combobox-option>`s. For predictability in the JS Framework, this would require using Manual Setup Mode. This is because Select Enhancing Mode directly manipulates the DOM, and JS Frameworks don't tend to expect this. (That said, a developer who was feeling more bold could take the first approach in their JS Framework. There are ways to do it reliably, and it would open the door for using Select Enhancing Mode if desired.)

> Note that if desired, developers could also cache the data that was loaded asynchronously in either approach. For example, they could store the data in a `Map<UserFilter, OptionData>`.

Loading `option`s asynchronously means that developers must replace old `option`s with newly-loaded ones. This swapping of `option`s will always trigger the `ComboboxField`'s `option`-watching `MutationObserver`, which exists to ensure that the state of the component remains valid as `option`s are changed. If the `combobox` is expanded while the observer callback is running, it will filter the new `option`s to make sure that only those matching the user's filter are displayed. (This is the safest course of action because the `ComboboxField` has no way of knowing whether all the `option`s provided to it match the user's filter.) If the `combobox` is collapsed at execution time, the observer will reset the `option`s so that nothing is marked filtered out, updating `#matchingOptions` to reflect this reality in the process.

For clarity, both `option`-filtering and `option`-resetting cause the `#matchingOption`s to be brought up-to-date.

This explanation should be pretty straightforward. All developers who need to load `option`s asynchronously can accomplish what they want with an async `filterchange` event handler.

### Those Who Are Paranoid about Performance

Things get a little more involved for those who are hyper-concerned about performance, however. Thankfully, the involvement isn't _too_ significant. Basically, in many cases, the expectation is that `option`s which are loaded asynchrounously will already be filtered and sorted. This makes the component's filtering logic irrelevant. And although filtering can be skipped during user-typing with the `filterchange` event, it _can't_ be skipped during `option` swapping &mdash; at least not with event handlers.

However, there is a workaround: Developers can effectively prevent the `O(n)` filtering logic from running by overriding the `ComboboxField.getFilteredOptions()` method to return the `option`s which are already present in the DOM. This approach works because, regardless of whether Pure JS is used or a JS Framework is used, the Mutation Observer that filters the `option`s is _guaranteed_ to have the most up-to-date information when it runs. To prove this, consider the high level flow for both scenarios:

1. In the case of the Pure JS developer, the high level flow is `Load Data > Create New Options > Replace Old Options > Mutation Observer Triggered`.
2. In the case of the JS Framework user, the high level flow is `Load Data > Update Local State > Map Local State to new Options > Render new options to the DOM, replacing the old ones > Mutation Observer Triggered`. (In this case, the developer would have to be mindful of when to tell the Framework Component it's "done loading" so that users never see outdated `option`s. It would likely be best to turn off the loading state _after_ updating the `option`s state variable &mdash; which is probably an array of strings or objects. Practically speaking, this shouldn't really be a concern in most scenarios, _if any_; so people won't need to think about this.)

As you can see, no matter which path is taken, the `MutationObserver` is run _after_ the `option`s have already been replaced. After all, the observer is only intended to run _in response_ to `option` updates. Thus, pointing `getFilteredOptions()` to what's already present in the DOM is a reliable approach. The only question is _how_ to go about this. The answer again depends on whether a framework is being used or not.

1. Everything is straightforward for Pure JS devs. They load the new data asynchronously, they convert the data into `<combobox-option>`s that are stored in an _array_ (not a `DocumentFragment` this time), and then they replace the existing `option`s with the new ones (e.g., with `ComboboxListbox.replaceChildren(...arrayWithNewOptions)`), causing the `MutationObserver` to be triggered. By overriding `getFilteredOptions()` to return the array of newly-loaded `option`s every time, developers can prevent the `ComboboxField` from doing a redundant `O(n)` traversal of its `option`s in the `MutationObserver`. (Note that accomplishing this will require _slightly_ clever usage of local private fields in an `ExtendedComboboxField`.)
2. Developers using JS Frameworks like React don't really have the ability to perform optimizations here &mdash; at least not cleanly. This is because `ExtendedComboboxField.getFilteredOptions()` has no [natural] way to see and access the DOM elements which _React_ creates from the stateful `option` array managed in the function component. One hacky workaround might be to point the `matchingOptions` returned by `ExtendedComboboxField.getFilteredOptions()` to a public class field which can be manipulated from within a React component. Then, the component could make sure that this field points to the `option` _elements_ which React has most recently rendered. This is a hacky idea that is not recommended.

Truth be told, developers using JS Frameworks like React probably aren't the ones who are hyper concerned about performance, because React requires a level of carelessness with memory (such as repeatedly mapping an array of data to an array of `HTMLElement`s). Nonetheless, if performance _does_ turn out to be a need for JS Framework devs, what should we do?

For the JS Framework devs, we _could_ provide a way for people to optimize their code. For example, we could update `#matchingOptions` to accept an array of _values_ or _label+value objects_ that point to the `option` elements which are already present in the DOM. In this case, framework devs would simply return their state variable to `getFilteredOptions()`. (This is analagous to how Pure JS devs would just return their array of newly-created `<combobox-option>`s to `getFilteredOptions()`.) But this introduces an unnecessary amount of complexity. And at this point, the primary performance bottleneck is likely not the combobox component; it's the JS Framework. The simple solution here is to either A&rpar; not use a JS Framework or B&rpar; manually (but intentionally/carefully) manipulate the DOM within the JS framework. If a _valid_ performance need arises in the future for JS Framework Users loading async data, then we can explore this other performance enhancement. However, it's hard to believe this will become a practical need.

> NOTE: Even with this solution, an array of strings/objects would _still_ need to be mapped to an array of `option`s. If this mapping occurs in `ComboboxField.#filterOptions()`, then we're back to `O(n)` time. The other alternative is to _avoid_ iterating over the `option`s, and instead, in `ComboboxField.#handleKeydown`, look to see if the `#matchingOption` item being navigated to is a string/object or an `option`. If it's an `option`, simply mark the `option` as active. If it's a string/object, map the string/object to an `option` and then mark that `option` as active. In theory this should be more performant (~`O(1)`). But again, the solution introduces unnecessary complexity; so there needs to be REAL motivation here from REAL users of our library.

## The Idea behind `ComboboxField.getFilteredOptions()` (_PRE_ 2025-09-18)

Admittedly, `ComboboxField.getFilteredOptions()` is a somewhat odd method. For one thing, it has a side-effect which is _mandatory_ for anyone who overrides the method with a new implementation. (Specifically, the method must always bring the `option`s' "filtered out state" up-to-date when called.) Additionally, the developer is never allowed to call this method directly (especially since it has side-effects). Rather, the overridable method is just a means for devs to "hook into" the component's logic and override it. All things considered, that's not _too_ bad.

Besides those concerns, the method is pretty normal: It provides a way for developers to customize both the filtering logic and the logic for determining the `autoselectableOption` (if one exists). But why go through the trouble of creating a method like that when `ComboboxField.optionMatchesFilter()` already exists? The answer is simple: `ComboboxField.getFilteredOptions()` exists for fine performance tuning. There are two use cases with which we're primarily concerned here:

### Filtering `options` with a `Trie`

There's no doubt that filtering `option`s with a `Trie` is significantly more performant than looping through every single `option` as the user updates their filter. Although in most situations this fact is irrelevant, it's still important to know; and it's a fact that stops some developers from using Open Source Combobox Components altogether. Our hope with `getFilteredOptions()` is to make the component usable for such performance-savvy devs. This will save developers the time spent implementing the UI/DOM/A11y aspects of the `combobox`, and it will enable them to focus solely on the aspects which truly require their close attention, like performance. The `getFilteredOptions()` method is what satisfy these criteria.

The `optionMatchesFilter()` method simply isn't sufficient here. Sure, it may enables developers to fully (yes, fully) customize which `option`s are shown to the user and which ones are not, but it doesn't enable developers to alter how `option`s are _iterated_/_traversed_. The only thing that can do that is something which directly alters the `ComboboxField`'s `#matchingOption`s, and which properly updates the `ComboboxOption`s' filtered-out state as well.

### Loading `option`s Asynchronously

If the `option`s for the `combobox` are loaded asynchronously, then &mdash; practically speaking &mdash; the end user never filters through the `option`s in the `listbox`. Rather, the user's changes to the filter trigger network requests, which in turn present a new set of `option`s which were already filtered and sorted (on the backend) to the user. In this case, iterating over all of the `option`s is a complete waste of time. The more performance-savvy developers might feel strongly about this and want to change this behavior (though in most cases, they shouldn't need to). The overridable `getFilteredOptions()` method enables developers to address this concern.

### Why Keep the `option`s Side Effect?

Practically speaking, since `optionMatchesFilter()` is all that's needed to fully customize the `ComboboxField`'s filtering behavior, I'm expecting `getFilteredOptions()` to be used only by people with performance needs. Other devs _should not_ override the `getFilteredOptions()` method and probably won't want to. With that background, do you understand why the method's side effect of updating all of the `option`s' filtered-out states exists? Think carefully here.

Figured it out yet? Here's the answer: It's definitely possible for `getFilteredOptions()` to _only_ return the filtered `option`s and have no side-effects. In that case, the `ComboboxField` could iterate over the returned `option`s and update all filtered-out states as needed. This means that `getFilteredOptions()` would be a Pure™️ function with no side effects. Sounds great, right? Well, mostly... except for the fact that the `ComboboxField` would then have to iterate over _all_ of the `option`s in a loop again. Why? Because the `ComboboxField` has no guarantee on what the new filter is compared to the old one. Consequently, for safety's sake, it _must_ look at _every_ `option`, see if it's in the returned `matchingOption`s, and mark it as filtered out if it's not. That brings time complexity back to `O(n)`; but now it's `O(n)` PLUS the developer's implementation for traversing the `option`s in `getFilteredOptions()`.

What if we changed `[data-filtered-out]` to `[data-matches-filter]`? This _could_ result in something better in _some_ cases... In this scenario, we have to iterate the _previously-matching_ `option`s to remove the `data-matches-filter` attribute. Then, we must iterate over the `option`s returned by `getFilteredOptions()` to apply `data-matches-filter` to them. Unfortunately, the time complexity here is still something like `O(n)`. Worst case scenario, the time complexity is `O(3n)` (or just `O(n)` to be technical) &mdash; one `O(n)` for unsetting the previously-matching `option`s, one `O(n)` for the developer's traversal implementation in `getFilteredOptions()`, and one `O(n)` for the `ComboboxField` setting the new matching `option`s based on what's returned from `getFilteredOptions()`. However, if the developer is using a `Trie`, which has constant time complexity, then the worst case scenario is `3 * C`. This might be acceptable, but the developer can skip `1 * C` if they update the matching `option`s themselves to have the `data-matches-filter` attribute.

If the vast majority of the _performance hungry_ devs (whom are the target audience of `getFilteredOptions()`) prefer function purity over performance, then we can address that. However, my assumption is that such devs would prefer better performance, especially if the way to attain that performance is not confusing or difficult. It also isn't fair to make the default time complexity `O(3n)` for everyone (if `getFilteredOptions()` was made pure) when it could just remain `O(n)` for the vast majority of people.

### A Quick Note on `ComboboxField.#resetOptions()`

At the time of this writing, the `ComboboxField.#resetOptions()` method is not overridable (as evidenced by the fact that it is a private method). Its time complexity is also `O(n)`. However, it is only called in very specific scenarios (such as when the `combobox` is being collapsed); so it didn't seem to me like this method would be a real bottleneck of sorts. However, if this method does become a bottleneck, it should be simple enough to make it public and overridable. Similar to `getFilteredOptions()`, the overridable `resetOptions()` method would have a mandatory side effect that brings the `option`s' filtered-out states up-to-date.

## The Order of Execution for Custom Elements' `connectedCallback()`s (2025-09-12)

This topic was a huge/confusing headache for us when we made our very first iteration of this component, and it still continues to be such today. So I'm upgrading this discussion to a Development Note &mdash; specifically one that details why we use `customElements.upgrade()` in our `SelectEnhancer.connectedCallback()` (since that is discouraged by some people).

The order in which Custom Elements are _constructed_ and considered _`isConnected`_ (for the sake of their `connectedCallback()`s) is typically not a big deal if your components are independent of each other. However, if your components depend on each other to the extent that the order in which they are "mounted" (i.e., the order in which the `connectedCallback()`s execute) matters, then you'll want to be careful to ensure that the _browser_ mounts the components in the correct order.

### Using `document.createElement()`

If `document.createElement()` is used to create a Custom Element _after_ it has already been [defined](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define), then the element will always be [upraged](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/upgrade), meaning it will already have the behavior of the defined Custom Element. For example:

```js
customElements.define("combobox-field", ComboboxField);
const combobox = document.createElement("combobox-field");
console.log(combobox instanceof ComboboxField); // true
```

In this scenario, the `combobox` created by `document.createElement()` is already an instance of `ComboboxField` when it is created. However, if `document.createElement()` is called _before_ the Custom Element is defined, then the returned element will only be an instance of `HTMLElement`, _not_ `ComboboxField`. To make the element an instance of `ComboboxField`, it would have to be upgraded.

```js
const combobox = document.createElement("combobox-field");
customElements.define("combobox-field", ComboboxField);
console.log(combobox instanceof ComboboxField); // false

customElements.upgrade(combobox);
console.log(combobox instanceof ComboboxField); // true
```

Practically speaking, we can assume (or assert) that developers will always define our Custom Elements _before_ they (or JS Frameworks) start creating them with `document.createElement()`. So from now on, let's assume that all of our Custom Elements are already defined when they are instantiated with `document.createElement()`.

#### Select Enhancing Mode

Our `Select Enhancer` works in 2 modes: "Select Enhancing Mode" and "Manual Setup Mode". In the former case, the `<select-enhancer>` wraps a `<select>` element, which acts as a functional `combobox` in scenarios where users don't have access to JavaScript. If the user _does_ have access to JavaScript, then the `<select-enhancer>` replaces the `<select>` and `<option>` elements with `<combobox-field>`, `<combobox-listbox>`, and `<combobox-option>` elements, all of which can be used to provide a superior `combobox`/dropdown/searching UX.

Here's an example to help you visualize things:

```html
<!-- Before Mounting (Select Enhancing Mode) -->
<select-enhancer>
  <select>
    <!-- <option>s -->
  </select>
</select-enhancer>

<!-- After Mounting (Select Enhancing Mode) -->
<select-enhancer>
  <combobox-field></combobox-field>
  <combobox-listbox>
    <!-- <combobox-option>s -->
  </combobox-listbox>
</select-enhancer>
```

If you were to watch the order in which the elements are constructed and mounted, it looks like this:

```
SelectEnhancer constructed
SelectEnhancer connectedCallback

ComboboxField constructed
ComboboxListbox constructed
ComboboxOption(s) constructed

ComboboxField connectedCallback
ComboboxListbox connectedCallback
ComboboxOption(s) connectedCallback
```

This example is for _server-rendered_ markup. So, the HTML is parsed, and when the browser notices that `SelectEnhancer` is a Custom Element, it constructs the component _and_ calls its `connectedCallback()`, in that order. While the `SelectEnhancer.connectedCallback()` is running, it notices that it owns a singular `<select>` element, so it converts the form control into its Custom Element equivalent. This results in the `ComboboxField`, `ComboboxListbox` and `ComboboxOption`(s) getting constructed within a `DocumentFragment`. Since they haven't been connected to the DOM yet, only their `constructor`s are run.

Once they are connected to the DOM simultaneously by `select.replaceWith(combobox, listbox)`, the `connectedCallback()`s of the Custom Elements are executed in the natural order that one would expect (that is, in tree order). The `ComboboxField` appears _before_ the `ComboboxListbox`, so its `connectedCallback()` gets called first. Then, the `ComboboxListbox` is a _parent_ of the `ComboboxOption`(s), so its `connectedCallback()` gets called next. Finally, the `connectedCallback()`(s) of the `ComboboxOption`(s) are run in order.

> Note that if Select Enhancing Mode was used with _client-side_ rendering, the order of execution would look exactly the same. The `<select-enhancer>` would be constructed outside the DOM with a `<select>` as a child. Later, it gets added to the DOM, so its `connectedCallback()` is run. During the `connectedCallback()`, all Custom Elements are created, and they are later connected to the DOM simultaneously. So it really doesn't make a difference whether Select Enhancing Mode is initiated by SSR or by client-side logic.

There are two factors that are key here:

- **_All_** of the Custom Elements are already defined/upgraded by the time the `connectedCallback()`s are called.
- The `connectedCallbacks()`s are called in the "natural order" (earlier elements before later elements, and parent elements before child elements, recursively).

#### In Manual Setup Mode

When the `SelectEnhancer` is used in Manual Setup Mode, the Custom Elements are provided _directly_ to the `<select-enhancer>` (instead of the `<select-enhancer>` wrapping a `<select>` element and then automatically replacing it when connected to the DOM).

```html
<!-- Mounting (Manual Setup Mode) -->
<select-enhancer>
  <combobox-field></combobox-field>
  <combobox-listbox>
    <!-- <combobox-option>s -->
  </combobox-listbox>
</select-enhancer>
```

As you'll see soon, this can lead to some unexpected behavior. **_However_**, if all of the elements are created and (properly) attached _before_ anything is connected to the DOM, then the execution order of the `connectedCallback()`s will still be correct, and everything will function as expected. Consider a situation where a developer is using pure JS:

```js
const wrapper = document.createElement("select-enhancer");
const combobox = wrapper.appendChild(document.createElement("combobox-field"));
const listbox = wrapper.appendChild(document.createElement("combobox-listbox"));
const option = listbox.appendChild(document.createElement("combobox-option"));

document.body.append(wrapper);
```

The execution order is the following:

```
SelectEnhancer constructed
ComboboxField constructed
ComboboxListbox constructed
ComboboxOption(s) constructed

SelectEnhancer connectedCallback
ComboboxField connectedCallback
ComboboxListbox connectedCallback
ComboboxOption(s) connectedCallback
```

Now consider a situation where React (a JS Framework) is used instead:

```jsx
// Mounting (Manual Setup Mode)
<select-enhancer>
  <combobox-field></combobox-field>
  <combobox-listbox>{/* <combobox-option>s */}</combobox-listbox>
</select-enhancer>
```

Because React creates _children_ before it creates _parents_, the execution order will look like this instead:

```
ComboboxField constructed
ComboboxOption(s) constructed
ComboboxListbox constructed
SelectEnhancer constructed

SelectEnhancer connectedCallback
ComboboxField connectedCallback
ComboboxListbox connectedCallback
ComboboxOption(s) connectedCallback
```

As you can see, although the elements are constructed in a different order, they are still connected to the DOM simultaneously with the correct tree structure. The conditions that we specified earlier are still met:

- **_All_** of the Custom Elements are already defined/upgraded by the time the `connectedCallback()`s are called.
- The `connectedCallbacks()`s are called in the "natural order" (earlier elements before later elements, and parent elements before child elements, recursively).

### Using HTML Parsing

The other primary way to create DOM Elements (including Custom Elements) is by parsing HTML. In this case, I'm not talking about parsing a string and making `document.createElement()` calls manually, as that would still ultimately be the developer making elements by calling `document.createElement()`. Instead, I'm referring to _browsers_ parsing HTML and creating elements from the HTML on which they operate. Understanding the order in which Custom Elements are constructed _and_ have their `connectedCallback()`s called is very important when it comes to HTML parsing. This is because many applications may choose to server render Custom Elements, meaning _browsers_ (not developers or client-side implementations of JS Frameworks) will be responsible for instantiating them when they parse the HTML.

#### Parsing after _ALL_ Custom Elements Are Defined (Manual Setup Mode)

Unsurprisingly, browsers instantiate _and_ uprgrade Custom Elements one-by-one in a natural order: earlier elements before later elements, and parent elements before child elements, recursively. So, assuming all Custom Elements are already defined, if a browser parses markup like this:

```html
<select-enhancer>
  <combobox-field></combobox-field>
  <combobox-listbox>
    <!-- <combobox-option>s -->
  </combobox-listbox>
</select-enhancer>
```

Then the execution order will be the following:

```
SelectEnhancer constructed
SelectEnhancer connectedCallback

ComboboxField constructed
ComboboxField connectedCallback

ComboboxListbox constructed
ComboboxListbox connectedCallback

ComboboxOption(s) constructed
ComboboxOption(s) connectedCallback
```

As you can see, all Custom Elements are constructed _and_ upgraded in order: Parents first, then their children from first to last, recursively. This scenario is encountered whenever a `setter` or method is called that causes the browser to parse a string as HTML (e.g., [`Element.innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML) or [`Element.insertAdjacentHTML()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML)).

```js
document.body.innerHTML = `
  <select-enhancer>
    <combobox-field></combobox-field>
    <combobox-listbox>
      <!-- <combobox-option>s -->
    </combobox-listbox>
  </select-enhancer>
`;
```

This scenario can also happen when a browser first loads the HTML on a page, but only if the Custom Elements are defined _before_ the main HTML is parsed.

```html
<!doctype html>
<html>
  <head>
    <!-- This script blocks rendering, so it will be executed _before_ the HTML is parsed -->
    <script>
      class SelectEnhancer extends HTMLElement {
        /* ... */
      }
      // DECLARE other Custom Element Classes ...

      customElements.define("select-enhancer", SelectEnhancer);
      // DEFINE other Custom Elements
    </script>
  </head>

  <body>
    <select-enhancer>
      <combobox-field></combobox-field>
      <combobox-listbox>
        <!-- <combobox-option>s -->
      </combobox-listbox>
    </select-enhancer>
  </body>
</html>
```

Practically speaking, `<script>` tags are usually loaded _asynchronously_ in real web applications, meaning that the HTML is parsed _first_ and the script is executed _afterwards_. So let's address execution order for that scenario.

#### Parsing before _ANY_ Custom Elements Are Defined (Manual Setup Mode)

Typically, web applications use non-blocking scripts to define all of their components. This means that the HTML will always be parsed _before_ the Custom Elements are actually defined. What does this mean?

Well, _before_ the Custom Elements are defined, all elements with custom [`tagName`s](https://developer.mozilla.org/en-US/docs/Web/API/Element/tagName) (e.g., the `<select-enhancer>` and friends) are just regular `HTMLElement`s. Since the tags haven't yet been associated with any real Custom Elements via `customElements.define()`, the browser doesn't know what to do with them; so it does nothing.

What happens when the JS is finally loaded and it starts defining Custom Elements? Well, when a Custom Element is defined, the browser searches the current Document for all elements with the specified `tagName`. All such elements are immediately constructed _and_ upgraded in tree order &mdash; synchronously. If multiple Custom Elements are defined back-to-back, then browsers will finish setting up all elements of one type before moving to elements of another type, and Custom Elements which are defined first are given priority. Consider a scenario where we have the following two files:

```html
<!doctype html>
<html>
  <head>
    <script type="module" src="/path/to/element/definitions.js"></script>
  </head>

  <body>
    <select-enhancer>
      <combobox-field id="first"></combobox-field>
      <combobox-listbox>
        <!-- <combobox-option>s -->
      </combobox-listbox>
    </select-enhancer>

    <select-enhancer>
      <combobox-field id="second"></combobox-field>
      <combobox-listbox>
        <!-- <combobox-option>s -->
      </combobox-listbox>
    </select-enhancer>
  </body>
</html>
```

```js
/* /path/to/element/definitions.js */

import ComboboxField from "./path/to/ComboboxField.js";
import ComboboxListbox from "./path/to/ComboboxListbox.js";
import ComboboxOption from "./path/to/ComboboxOption.js";
import SelectEnhancer from "./path/to/SelectEnhancer.js";

customElements.define("combobox-listbox", ComboboxListbox);
customElements.define("combobox-field", ComboboxField);
customElements.define("combobox-option", ComboboxOption);
customElements.define("select-enhancer", SelectEnhancer);
```

In this scenario, the execution order would be what's seen below. Remember that our markup rendered _two_ instances of our Combobox Component:

```
ComboboxListbox constructed
ComboboxListbox connectedCallback
ComboboxListbox constructed
ComboboxListbox connectedCallback

ComboboxField constructed
ComboboxField connectedCallback
ComboboxField constructed
ComboboxField connectedCallback

ComboboxOption(s) constructed
ComboboxOption(s) connectedCallback
ComboboxOption(s) constructed
ComboboxOption(s) connectedCallback

SelectEnhancer constructed
SelectEnhancer connectedCallback
SelectEnhancer constructed
SelectEnhancer connectedCallback
```

As you can see, this makes the order in which you define your Custom Elements very important! Of course, if your web components are independent of each other, then the ordering doesn't really matter at all.

> This might be the reason why some libraries define a `register` function for you. Perhaps they guarantee that all Custom Elements are registered in the correct order without you having to think about it?

#### What about Select Enhacing Mode?

As we mentioned in the section on `document.createElement()`, the order in which Custom Elements are defined doesn't matter when using Select Enhancing Mode. Regardless of whether the `SelectEnhancer` is instantiated via HTML Parsing or via `document.createElement()`, it is the _only_ Custom Element (in our set of Combobox Component Parts) that is initially attached to the DOM. Thus, the `SelectEnhancer`'s constructor and `connectedCallback()` will always run first, and on their own. Then, _within its `connectedCallback()`_, the `SelectEnhancer` will use `document.createElement()` to create and connect all remaining Custom Elements in the proper order when it replaces the `<select>` element.

Therefore, as long as all Custom Elements are already defined by the time the `SelectEnhancer.connectedCallback()` executes, everything will work fine.

### Implications for Authoring Custom Elements

Everything discussed here has implications for the _order_ in which you define your Custom Elements, as well as whether or not you'll need to reach for [`customElements.upgrade()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/upgrade) to manually upgrade one of your Custom Elements.

1&rpar; If you only intend to create web components with `document.createElement()` (as would be the case in a JS Framework used without any SSR), then the order in which you define your Custom Elements _does not matter_. All that matters is that every Custom Element is defined before `document.createElement()` is called.

2&rpar; If you intend to server render your web components (with _or_ without a JS Framework), then the order in which you define your Custom Elements _does_ matter. If Custom Element `A` depends on Custom Element `B` to be mounted properly, then `B` should always be defined first.

3&rpar; If you or your consumers intend to create web components through means like `innerHTML` (or if for some insane reason either of you want to define the components _before_ the HTML is parsed on page load), and if Custom Element `A` depends on Custom Element `B`, then _the order in which your Custom Elements are defined **cannot** save you_ because the browser is always going to construct _and_ upgrade your elements in tree order. This means you will be forced to leverage `customElements.upgrade()` to ensure that all constructors and `connectedCallbacks()` are executed in the proper order.

If you _must_ use `customElements.upgrade(node)`, note that `node` _and_ all of its children will be upgraded, _in tree order_. This occurs synchronously, so the function in which `customElements.upgrade()` is called will only continue _after_ all necessary elements have been upgraded. Elements that don't need to be upgraded (or that cannot yet be upgraded) are not impacted by this. In other words, constructors and `connectedCallback()`s will not be called for Custom Elements that are already upgraded or that cannot yet be upgraded. (For clarity, an element cannot be upgraded if it is not yet defined.)

For this reason, if Custom Element `A` depends on `B`, and `B` depends on `C`, then `A` must call `upgrade` in its `connectedCallback()` to guarantee `B` is upgraded before any logic requiring an upgraded `B` is run, and `B` must call `upgrade` in its `connectedCallback()` to guarantee `C` is upgraded before any logic requiring an upgraded `C` is run. Obviously, whenever possible, you should avoid creating Custom Elements where parents depend on their children. (By contrast, having children depend on their parents doesn't introduce any complexity.) However, if you're writing something that mimics the `<select>` element, this may not always be possible.

Also note that if you wish to support _all three_ scenarios decribed above, then the order in which you define your Custom Elements still matters. For the scenario involving SSR/initial page load, remember that Custom Elements are defined synchronously. So if Custom Element `A` is defined before Custom Element `B`, then all instances of `A` on the page will be constructed and will execute their `connectedCallback()`s _first_. Afterwards, `customElements.define("element-b", B)` will finally run, causing all instances of `B` found on the page to be constructed and to execute their `connectedCallback()`s. For this reason, manual upgrades _will not save you_ in this scenario. This is because at the moment you call `customElements.upgrade(nodeB)`, _`B` will not yet be defined_ and will therefore not be upgradable.

Therefore, if you want to support _all three_ scenarios, then you **_must_** define all of your Custom Elements in the proper order (for SSR) **_and_** include manual upgrading logic as needed in parent components (for `innerHTML` and the like). This is exactly what the `SelectEnhancer` does. It's unfortunate that such a thing is necessary.

## Using an `::after` Pseudo-Element for Displaying the "No Matches" Message (2025-09-08)

In the past, in order to display the "No Matches" Message (i.e., the message presented to users when no `option`s match their current filter), we appended an `inert`, `aria-hidden` element to the `listbox`. Since the element was hidden from the A11y Tree, it wouldn't confuse Screen Reader Users, and it would still provide useful information to Visual Users. (Screen Reader Users are already told if the `listbox` with which they're interacting is empty.) Seemed like a great idea! And it was! ... until we started adding logic for dynamic `option` handling.

You see, our dynamic `option`-handling logic is implemented with a `MutationObserver` that watches the `listbox`'s children. Whenever the `listbox`'s children are changed, the observer callback runs and makes sure the `combobox`'s value and `#matchingOptions` are in the proper state. Unfortunately, this leads to some buggy behavior (and occasionally, infinitely-looping behavior) when appending/removing the "No Matches" Message Element (e.g., in response to the user's filter updates). When circumventing these bugs started to become too convoluted, we decided that the "No Matches" Message _should not_ be appended to the `listbox` as a literal element.

Initially, we considered appending the "No Matches" Message somewhere else as an element (e.g., within the `<select-enhancer>`). However, we soon remembered that JS Frameworks _do not_ like it when the DOM is manipulated manually outside of their control. Thus, for the component to behave more reliably, this message had to be rendered _declaratively_ by the developer. At the time of this writing, this is what [ShadcnUI's `Combobox`](https://ui.shadcn.com/docs/components/combobox) does. That is, it provides a `<CommandEmpty>` component which determines the text that will be displayed when no `option`s match the user's filter.

The primary reason that we disliked this approach is that it required more work from the developer. Having to specify the "No Matches" Message _every single time to the component is used_ seems very tedious (though not absolutely unbearable). It would be much better if the developer didn't have to provide such a message at all, or if they could configure a default message for all instances of the component at once. This made the declarative _element_ solution a no-go for us.

> Note: Technically speaking, in JS Frameworks, component authors could probably write a `Combobox` that provides a default "No Matches" Message _and_ that accepts a `<CommandEmpty>` "slot" (or whatever you want to name it). This works because the component builds on top of the JS Framework; so even if it produces DOM updates apart from the consuming developer, it only produces them _through_ the framework rather than outside of it. This is not an option for Custom Elements because they're not built on top of _any_ frameworks. This means that we can't introduce a new element into the DOM (apart from the consuming developer) _without_ bypassing the framework, which could cause unexpected problems.

Our next idea was to enable the message to be changed via a `nomatchesmessage` attribute. When the `combobox` recognizes that its filter is bad, it acquires a `data-bad-filter` attribute and a `:--bad-filter` [custom state](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet). Either one of these indicators can be hooked into with CSS to display a "No Matches" Message in an _accessibly-hidden_ `::after` pseudo-element in the `listbox`. All we have to do is set `content: attr(nomatchesmessage) / ""` for said pseudo-element. The only downside here is that the state belongs to the `combobox`, but the `listbox` is the element which uses `::after` and is therefore the element which needs the `nomatchesmessage`. So... we put some logic in place to keep the attribute in sync between the two elements. This is not ideal, and we might pursue a different approach in the future; but for now, this works well.

Another downside is that we have to maintain a `nomatchesmessage` attribute on the `combobox`/`listbox` in order to guarantee that a "No Matches" Message gets displayed to users at all (since the `::after` pseudo-element _points to_ this attribute to know what to display). This means that even if the developer doesn't apply an attribute to the element themselves, the component has to apply the attribute to itself onmount. Again, not the most ideal, but not realistically problematic for developers either; just a little icky. (Again, if we can find a cleaner solution in the future, we'll take it.)

On a more positive note, the `ComboboxField` has a static `defaultNoMatchesMessage` field that can be updated to determine the default value for the `nomatchesmessage` attribute. This means that if developers want to use a "No Matches" Message that is consistent across their entire app, they only have to provide this message in one place. (The default value is updated through a static field instead of through the CSS `attr()` function because i18n is typically accomplished with JS or server-rendered HTML, but never CSS.)

Although our solution is a little icky, it doesn't seem to provide any real friction for developers (though it sadly requires CSS for implementation), and it is compatible with declarative JS Frameworks. So we're happy with what we have, especially since it keeps developers from having to write markup multiple times for their error messages (though our approach enables developers to do this as well if they prefer). All they have to do is update a single static field (or the `ComboboxField`'s attribute if more granular messaging is desired).

> Note: When writing the CSS for this, developers will not need to target both the `[data-bad-filter]` attribute and the `:--bad-filter` state simultaneously. They can simply target one or the other. Two approaches were provided because in the longterm, we hope to strictly use custom states instead of `data-*` attributes for the "No Matches" Message.

## Leaving Spellcheck Alone (2025-09-05)

In the past, we considered the possibility of disabling spellcheck (via the [`spellcheck` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/spellcheck)) when the `combobox` was in filter mode. Disabling spellcheck made sense when the `combobox` only supported `unclearable` mode since the user could only supply recognized values anyway. However, now that `anyvalue` mode is supported, the user can potentially enter whatever string they want as a value. This makes spellcheck more relevant.

So, we've decided to leave the `spellcheck` attribute alone. Technically speaking, we could choose to enable `spellcheck` when the `combobox` is in `anyvalue` mode, then disable it in the other modes. However, this adds extra logic/complexity for something that people probably don't care about. Moreover, if a developer decides to use _both_ `anyvalue` and `(un)clearable` mode `combobox`es in their application, it would be a confusing UX for the component to sometimes raise spelling errors and other times raise none. The circumstances would be too nuanced for most users to recognize, and it would probably be annoying/bewildering.

The spellchecking is reasonable and harmless, and it's valid in `anyvalue` mode. So we're choosing to leave it on. (Or rather, we're leaving it up to browsers to decide what they want to do.)

<!-- TODO: We might have to update this comment/note now, since we'll be starting with regular `<select>` elements from now on. -->

## Why Does `SelectEnhancer` Sketchily Transfer Its Attributes to `ComboboxField`?

This was a pretty peculiar design decision, but it was a design decision that -- given my constraints -- I thought made sense. To understand how I got here, it's important to first understand what my constraints were.

> Note: As I address this question, you'll see me referring to `combobox`es in some places and "Combobox Component"s in other places. For the sake of this section, you can consider a `combobox` to be an element with `[role="combobox"]`, and you can consider a "Combobox Component" to be a Web Component containing the `combobox`, its `listbox` and any other necessary parts. In other words, a "Combobox Component" is the "whole unit" needed to emulate the native `<select>` element.

### 1&rpar; The `combobox` Element Must Be Its Own Web Component

Since our Combobox Component is intended to be an enhancement of the native `<select>` element, it's ideal for us to be able to write something like this:

```html
<combobox-field>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</combobox-field>
```

(Here, we're assuming that the necessary [`listbox`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/listbox_role) is somehow rendered automatically by the "root" Web Component. We're also assuming that all of the necessary A11y relationships are setup by the Web Components when they're created/attached.)

In the above example, the `<combobox-field>` implicitly has the [`combobox`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/combobox_role) role, and the `<combobox-option>` implicitly has the [`option`](https://www.w3.org/TR/2010/WD-wai-aria-20100916/roles#option) role.

Unfortunately, this structure is impossible due to the restrictions of the accessibility rules. Based on [the spec for `combobox`es](https://w3c.github.io/aria/#combobox), the _value_ of a `combobox` is derived from a form control's value (if the `combobox` is a **_native_** form control) or the element's text content (if the `combobox` is _not_ a native form control). This means that in the above example, the value of the `<combobox-field>` would be erroneously derived from all of the options belonging to that Web Component (or be ignored altogether). Moreover, the example markup above begs the question of where the `combobox`'s value should even be rendered without causing complications.

To accurately identify the `combobox`'s value, it must be _completely_ distinguished from all other elements, and it must have _no descendants_. This forces us to make the `combobox` a sibling of the `listbox` that it controls -- rather than the `listbox`'s parent. (The `combobox` does not _have_ to be a sibling of the `listbox`. However, since it cannot _contain_ the `listbox`, the next _easiest_ solution seems to be to make the `listbox` a sibling instead.)

But this leads us to another problem...

### 2&rpar; How Should the `combobox` and the `listbox` Be Arranged?

The fact that the `combobox` cannot be a parent of the `listbox` actually introduces much more complexity for a feature-complete Web Component than one would think. Consider this dilemma: If the `combobox` doesn't own the `listbox`, then how will it know which element it controls? (That is, how will it accurately set [`aria-controls`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-controls) on its own?) Similarly, if the `listbox` isn't owned by the `combobox`, how will it know what its `id` should be (for the sake of `aria-controls`)? Without a parent-child relationship, neither the `combobox` nor the `listbox` has an _innate_ ability to set the attributes needed to provide a good Screen Reader experience.

We have two options here:

1. Require the consumer to arrange the `combobox` and the `listbox` in addition to configuring any necessary ARIA attributes.
2. Create a new Web Component that contains _both_ the `combobox` _and_ the `listbox` so that it can properly arrange the elements and set their ARIA attributes _for_ the consumer.

#### A&rpar; Kicking Responsibility to the Consumer

Although this is an option, the number of problems that it creates for consumers is unacceptable.

**First: The consumer has to take responsibility for creating _and_ positioning the `listbox`.** (If they don't _create_ their own `listbox` element, then we'll still have to provide _another_ Web Component -- perhaps called `<combobox-listbox>` -- that does nothing more than function as a proxy for the `listbox` role. This might be confusing for developers, since it implies that this component provides "important functionality" when it doesn't.) One major problem with this is that we can't make optimizations based on safe assumptions. For instance, we can't do `ComboboxField.nextElementSibling` to locate and operate on the `listbox`. Instead, we'll need to use `document.getElementById(ComboboxField.getAttribute("aria-controls"))`.

```html
<combobox-field></combobox-field>

<!-- Or you can provide a redundant `<combobox-listbox>` element if you like -->
<div role="listbox">
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</div>
```

**Second: The consumer has to take responsibility for styling most of the Combobox Component.** (Giving control to the consumer is good. But lacking good, default styles is bad.) Since _the consumer_ controls where the `combobox` and the `listbox` are placed, we aren't able to guarantee any default styles will that work with the consumer's markup. (We can't make very useful CSS selectors if we don't know how the DOM is arranged.) Moreover, the consumer will have to take responsibility for creating the "common parent" that is used to properly position the `combobox` and its `listbox` on the page. This common parent is also necessary to make sure that the `listbox` popup doesn't take up too much space on the page when it appears.

```html
<div class="combobox-parent">
  <combobox-field></combobox-field>

  <div role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</div>
```

**Third: The consumer has to take responsibility for setting the proper attributes on the `combobox` and the `listbox`.** This is a tedious process that isn't necessary for the native the `<select>` element. Additionally, this process is error prone because 1&rpar; Typos are easy to miss (meaning that a11y bugs for Screen Readers may unintentionally get introduced), and 2&rpar; not every developer knows the correct ARIA attributes to set for the `combobox` (again, meaning that Screen Readers Users may encounter broken/clunky experiences).

```html
<div class="combobox-parent">
  <combobox-field aria-controls="listbox-with-unique-id"></combobox-field>

  <div id="listbox-with-unique-id" role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</div>
```

Now... Let's compare our final result with what consumers would need to do when using the basic `<select>` element.

```html
<select>
  <option>First</option>
  <!-- ... -->
  <option>Last</option>
</select>
```

See how much worse the Developer Experience is if we _don't_ create the wrapper for consumers? And the DX is not only bad; it's error prone. Everything turns out much better if we simply create an intelligent wrapper for the consumer. This is why we have the `<select-enhancer>` Web Component.

#### B&rpar; Accepting Responsibility for the Combobox Component Layout

If you noticed from the aforementioned concerns, a functional Combobox Component will always require a container element in order to guarantee proper arrangement and styling of the `combobox` and especially the `listbox` popup. If a container is already going to be required, and if a container will help us setup the `combobox`/`listbox` attributes _for_ our consumers, then why not create the container for them? If we do, we can provide default styles for the component, and the consumer does not have to keep track of all of the ARIA attributes that need to be used.

### 3&rpar; How Knowledgeable/Responsible Should the Combobox Component's Container Be?

Creating the container for our consumers sounds great. But we're left with the question of exactly _how much_ the container should be responsible for. Stated differently, we have to determine how "magical" the container should be.

Here are some considerations I worked through.

#### Make the Component Feel As Much Like a `<select>` Element As Possible

To me, the _ideal_ Web Component looks and feels like a `<select>` element -- for the most part. Consequently, if the markup for creating a `<select>` element looks as simple as

```html
<select>
  <option>First</option>
  <!-- ... -->
  <option>Last</option>
</select>
```

Then ideally, its enhanced Web Component version would look and feel similar. Unfortunately, [as we mentioned earlier](#1-the-combobox-element-must-be-its-own-web-component), the following is illegal:

```html
<combobox-field>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</combobox-field>
```

The next best thing is to use the `<select-enhancer>` to hold everything instead (_if_ the goal is creating an experience similar to a `<select>` element):

```html
<select-enhancer>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</select-enhancer>
```

#### Where Do We Put the `combobox` and the `listbox`?

We don't put them anywhere. We can let the `<select-enhancer>` create and position these elements itself. So instead of writing

```html
<select-enhancer>
  <combobox-field></combobox-field>

  <!-- Or you can create an extra `<combobox-listbox>` Web Component -->
  <div role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</select-enhancer>
```

consumers can simply write

```html
<select-enhancer>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</select-enhancer>
```

Now, I know... This may look like undesirable magic. But there are some benefits to taking this approach that are worth noting:

**First: With this approach, we can prevent illegal elements from entering the `<select-enhancer>`.** The `<select-enhancer>` can be configured to erase anything that isn't a `<combobox-option>`. This means that illegal elements won't be accepted by the container as children, and duplicates of `<combobox-field>` won't be accepted by the container either. (Note: Alternatively, we could write extra logic to resolve duplicate `<combobox-field>`s, but this ultimately introduces more complexity to both the Combobox Component and the consumers of the Combobox Component.) Additionally, this allows the container to have full control over how its children are arranged. For example, we can _guarantee_ that the `combobox`'s `nextElementSibling` will be the `listbox` -- allowing us to simplify our JavaScript logic and our default styles.

**Second: We save the consumer from creating a redundant `listbox`**. Recall that ideally, the consumer shouldn't have to think about ARIA attributes. We _could_ allow consumers to write:

```html
<select-enhancer>
  <div role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</select-enhancer>
```

But remember that if we give the consumer control over the element that wraps the options, our default styles for the `listbox` aren't guaranteed to be consistent. To guarantee absolute safety, we would need to give the consumer a `combobox-listbox` element and enforce that no other kind of element is used to wrap the options:

```html
<select-enhancer>
  <combobox-listbox>
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </combobox-listbox>
</select-enhancer>
```

This is an acceptable solution. However, it adds more things that the consumer needs to think about, and to me it feels a bit redundant. This approach also steps further away from the look and feel of a regular `<select>` element. So having the `<select-enhancer>` create the `listbox` _for_ the consumer seems more ideal.

**Third: We save the consumer from any complications arising from the `combobox`.** As I mentioned before, the ideal Combobox Component behaves similarly to the the native `<select>` element. This also means that ideally, any useful APIs belonging to `<select>` or `<option>` should be mimicked. For instance, the useful `HTMLSelectElement.value` property should be supported by the `ComboboxField` element, and the useful `HTMLOptionElement.selected` property should be supported by the `ComboboxOption` element. However, such support means that the `ComboboxField` and the `ComboboxOption` both influence each other's data.

Because the default value of a Combobox Component should be determined during "initial render" (when the parts of the Combobox Component are initially attached to the DOM), the constraint of emulating the native `<select>` APIs requires the `ComboboxField` and the list of `ComboboxOption`s to be loaded in a carefully-considered order. Otherwise, an infinite loop or a runtime error could accidentally get introduced.

There might be some ways to allow the consumer to supply the `<combobox-field>` to the `<select-enhancer>` on their own without breaking anything. But the simplest solution is to hide these complications/concerns from the consumer altogether by allowing the container to determine _when_ the `<combobox-field>` is created and attached. This guarantees that the consumer won't encounter any unexpected bugs.

### 4&rpar; Supplying the Proper Attributes to the `ComboboxField`

Enabling the `<select-enhancer>` to control everything is quite valuable. The fact it guarantees the proper arrangement of its children and forbids any invalid children is great! But taking this approach doesn't come without caveats. Let's consider what I've called the "ideal" markup again:

```html
<select-enhancer>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</select-enhancer>
```

Remember that the `<combobox-field>` represents the element with the `combobox` role, and this element is the central part of the Combobox Component. But with this setup, how is the `<combobox-field>` supposed to receive any attributes? Sure, the consumer won't have to worry about any _accessibility_ attributes. But what about providing a CSS class to the `<combobox-field>`? [Data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)? An `id` that can be targeted by a `<label>` element? Currently, with our approach, the consumer has no way to accomplish this without writing JavaScript. Alternatively, we could try to find a way to let the consumer provide the `<combobox-field>` themselves, but we've already discussed some of the risks associated with that.

If we want to avoid worrying the consumer with extra concerns, one solution is to have the `<select-enhancer>` transfer all of its attributes to the `<combobox-field>`. This is a trade-off... And it's a trade-off that some may consider undesirable. However, it's a trade-off that I have accepted for the sake of creating a simpler experience that more closely matches the look and feel of a `<select>` element.

Although it may seem odd to transfer to transfer attributes from the `<select-enhancer>` to the `<combobox-field>`, this practice is actually _very_ common when it comes to writing components with a JavaScript framework. Imagine if we had created a `Select` component in [`svelte`](https://svelte.dev/) (or some other framework) instead. Wherever this component would be used, we'd have something like the following:

```svelte
<Select>
  <Option>First</Option>
  <!-- ... -->
  <Option>Last</Option>
</Select>
```

But what would be happening under the hood here? Any attributes passed to `Select` wouldn't actually get placed on any "custom select element", _nor_ would the attributes get placed on the wrapping `div` (or other element) used to contain, organize, and style the `combobox`/`listbox` within the component. Instead, the attributes would get passed directly to the element representing the `combobox`, because that's the only element that really makes the attributes useful. It's _highly_ unlikely that someone would need to supply attributes to the wrapping `div` or to any other element in the component. (Any necessary _styles_ could be handled with plain CSS). If this was deemed absolutely necessary, additional props could be exposed to satisfy this use case.

So it is with the `<select-enhancer>`. Its sole purpose is to setup the `combobox` and the `listbox` -- just like a `Select` component in a JS framework would do. It doesn't need to do much else; so it can safely transfer its attributes to the `<combobox-field>`.

If it becomes apparent in the future that attributes are _needed_ on the `<select-enhancer>`, then logic can be put in place to support that need.

### Conclusion

You don't have to agree with the design decision that I made, but hopefully this explanation helps you understand _why_ such an odd decision was made. Ultimately, what I learned from creating a Combobox Component is that it is _incredibly_ difficult to create a Web Component that mimics the `<select>`/`<option>` element's HTML and that emulates even just a _subset_ of the element's JavaScript API. And we haven't even discussed [complications with the Shadow DOM](https://github.com/enthusiastic-js/form-observer/blob/main/docs/form-observer/guides.md#be-mindful-of-the-shadow-boundary).

As you start to support the features for the native `<select>` element, you are eventualy forced into situations where you have to consider trade-offs. For me, the trade-off was, transferring attributes from the `<select-enhancer>` to the `<combobox-field>` in order to preserve the expected Developer Experience. A different approach could avoid this oddity, but it would encounter other problems in the process. In the end, what we really need is for the [`<selectlist>`](https://open-ui.org/components/selectlist/) element to be standardized as quickly as possible.
