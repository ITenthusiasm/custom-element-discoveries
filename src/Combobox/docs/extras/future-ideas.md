# Future Ideas

This is a document which is distinct from this project's [TODO list](../../../../TODO.md). Specifically, it's a document which lists the ideas that I'm much more likely to implement in the future, provided that A&rpar; I have sufficient time for them and/or B&rpar; They're of sufficient interest to community.

These are ideas that I've already given a significant amount of thought to, meaning they are already-solved problems or partially-solved problems. Ideas that are more vague, have been given no thought, and/or are completely unknown or unsolved should typically remain in the TODOs document. Ideas that we're hesitant to implement belong in [Uncertain Ideas](./uncertain-ideas.md).

Note: Some of these ideas might be worth opening GitHub Issues for.

## Removing Support for `optionMatchesFilter()`, and Abandoning `optionIsAutoselectable()` (RFC)

NOTE: This is **_not_** something that we should legitimately consider without receiving feedback from the community.

The original purpose of the overridable `optionMatchesFilter()` and `optionIsAutoselectable()` methods was to give developers a way to customize the logic for filtering `option`s and/or determining the current `autoselectableOption`. The former method already has support today. The latter one does not yet exist, but we're still playing with the idea of implementing it (though we're not sure how useful the overridable method would be). The thinking was that the needs of web applications are probably too diverse for us to predict, meaning that our component can't solve _all_ of them. But recently we've started to think... is that really true?

When it comes to User Experience, it's always better to filter `option`s _case-insensitively_ instead of case-sensitively. Not only is this more helpful for users who don't know what the exact casing of the `option`s is, but it's also more practical. (Seriously, when is an application ever going to identify `Apple` and `apple` as two _distinct_ choices? Even if the choices were distinct, would a User be able to understand that distinction?) So it will always be best to compare the _lowercased_ (or uppercased) label of an `option` against the user's _lowercased_ (or uppercased) filter. (Stated differently: For the user's sake, developers _shouldn't_ have the ability to compare `option`s case-sensitively.)

Okay, so how do we compare strings case-insensitively? MDN says that [`toLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLowerCase) is one way to get the job done. If internationalization (i18n) is a concern, then there's also [`toLocaleLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase). According to MDN [`toLocaleLowerCase()` behaves like `toLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase#description) in most cases, and the method [only uses the first `locale` passed to it](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase#parameters). So if we wanted to support `i18n`, we could simply do so through an attribute.

```js
class ComboboxField extends HTMLElement {
  // ...
  get locale() {
    return this.getAttribute("locale") ?? undefined;
  }

  set locale(value) {
    this.setAttribute("locale", value);
  }

  optionMatchesFilter(option, search) {
    if (!search) return true;
    if (!option.value) return false;
    return option.label.toLocaleLowerCase(this.locale).startsWith(search.toLocaleLowerCase(this.locale));
  }
}
```

That solves i18n. What else might developers need?

Well, it's fair if some developers prefer to use `String.includes()` over `String.startsWith()`. The latter will help users narrow in on specific `option`s more quickly, whereas the former will give users a _broader_ idea of the various `option`s that are available (without overwhelming them). But toggling between these two attributes could also be done with an attribute.

```js
class ComboboxField extends HTMLElement {
  get filterMethod() {
    const value = this.getAttribute("filtermethod");
    return value === "includes" ? value : "startsWith";
  }

  set filterMethod(value) {
    this.setAttribute("filtermethod", value);
  }

  optionMatchesFilter(option, search) {
    if (!search) return true;
    if (!option.value) return false;
    return option.label.toLocaleLowerCase(this.locale)[this.filterMethod](search.toLocaleLowerCase(this.locale));
  }
}
```

Note that the `filtermethod` attribute/property is already supported today as well (for `startsWith()` and `includes()`).

Having the option to toggle between `startsWith()` and `includes()` should be sufficient for most (if not all) developers. Most other filtering implementation would just be confusing to users. For example, leveraging `String.endsWith()` would create _a lot_ of confusion for people using the filter, so such a configuration isn't worth supporting. After doing some research, it seems that [Open UI](https://open-ui.org/components/combobox.explainer/#introducing-search-attribute) would agree with us (at least as of 2025-09-02). For they only support `startWith` and `includes` as well, though they also seem to support RegExp patterns.

At the moment, I'm personally not aware of why regular expressions would be needed. But it should be possible to support a pattern attribute like Open UI instead of exposing an overridable method. That being the case, there are only 2 use cases that come to mind as to why someone may reach for custom filtering:

1. The developer disagrees with the some of the conditions for including/excluding `option`s. For example, some developers might only want to start showing `option`s _after_ the user has started typing (i.e., the `search` is non-empty). Others might want to include `<combobox-option value="">` in the search results.
   - Regarding the first concern, this would probably result in a poor UX for mouse users. Mouse Users should be able to see the list of `option`s without typing anything if they want.
   - Regarding the second concern, it doesn't make sense to present what is effectively a "non-option" to users as they try to filter through the `option`s.
2. The developer might want to include _visible_ content in an `option` that they _don't_ want to be used for the string comparison. For example, they may want to include an emoji at the beginning of their `option`s, but they may not want users to have to enter said emoji into the filter to find that `option`.
   - This might actually be a valid concern. (Whether regex _should_ be used to solve the problem is a different story, obviously.) Another solution would be to update the `<combobox-option>`'s `label` to be derived from its `aria-label` (while defaulting to its own `textContent`). Then techniques like `string.startsWith()` and `string.includes()` would be viable again as long as comparisons were run against the `label` property. Although it's still experimental, MDN's example for [customizable `<select>` elements](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Customizable_select) seems to be "Accessibility-Aware" as well. All that said, is it actually helpful to present emojis to users in a `combobox`'s `option`s?

So the short of it all is that, despite being relatively simple and harmless, overridable `optionMatchesFilter()` and `optionIsAutoselectable()` methods just may not be necessary or worth supporting. For now, they can be supported. But if it can be _proved_ that the problems solved with them can _always_ be solved by other [simple, ergonomic] means (e.g., those detailed above), then we may want to drop these methods. Need to do research and/or hear back from the community on this one before making a decision.

## Internationalization

In [Removing Support for `optionMatchesFilter()`, and Abandoning `optionIsAutoselectable()` (RFC)](#removing-support-for-optionmatchesfilter-and-abandoning-optionisautoselectable-rfc), we discussed the idea of having the `ComboboxField` Web Component support internationalization (i18n). This is definitely a _must-have_ so that our component will be easy to use in various cultural contexts. The only question is: How we should go about this?

As was discussed in the aforementioned idea/article, one option is to support a `label` attribute/property that is passed to [`toLocaleLowerCase()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase) when performing `option` comparisons.

```js
class ComboboxField extends HTMLElement {
  // ...
  get locale() {
    return this.getAttribute("locale") ?? undefined;
  }

  set locale(value) {
    this.setAttribute("locale", value);
  }

  optionMatchesFilter(option, search) {
    if (!search) return true;
    if (!option.value) return false;
    return option.label.toLocaleLowerCase(this.locale).startsWith(search.toLocaleLowerCase(this.locale));
  }
}
```

Perhaps we could take things a step further by also defaulting the `locale` to a static field:

```js
class ComboboxField extends HTMLElement {
  // ...

  static defaultLocale = "en-us";

  get locale() {
    return this.getAttribute("locale") ?? ComboboxField.defaultLocale;
  }

  // ...
}
```

Most applications use only one locale at a time, so having a configurable `static` value like this could improve DX by reducing verbosity.

However, another question that we've had while thinking through all this is, "Is there any way to tie into what HTML already has?" All `HTMLElement`s already support the [`lang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang) attribute (which has a reflecting [property](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/lang)). Should we leverage this native, standardized attribute instead of making one up? That would make sense. However, one difficulty here is that a child element's `lang` _property_ doesn't default to the parent element's value, even though the child element inherits its parent's language based on [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang#inheritance) and the [spec](https://html.spec.whatwg.org/multipage/dom.html#attr-lang). This is problematic because we need to know what to pass to `toLocaleLowerCase()` if the `ComboboxField` doesn't have a `lang` attribute applied to it. Here are some ideas about how to address this dilemma:

1. Use the `lang` attribute applied to the [`HTMLHtmlElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLHtmlElement) (i.e., the [`document.documentElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/documentElement)) to determine the locale to pass to `toLocaleLowerCase()`. This will be reliable in most cases since _typically_ only one language is used for an entire page. However, it doesn't enable devs to override the page's language in a narrower section of the document if needed.
2. Use the `lang` attribute of the nearest ancestor that defines it (including the `ComboboxField` itself). This provides more flexibility for developers and keeps in step with the spec, but it also has implications on performance. Do we really want to be performing a `Element.closest()` check on every single keystroke?
3. Same as the first idea, but also support the `lang` attribute on the `ComboboxField` itself. This removes the potential (and perhaps mildly-negligible) performance costs of `Element.closest()`. Instead, we only have to check `document.documentElement` and `ComboboxField` for a `lang` value. (Note that `toLocaleLowerCase()` allows `undefined` as an argument for cases where neither element defines the attribute.) In most scenarios, people will only use the `HTMLHtmlElement`'s `lang` value, and there will be no concerns. In cases requiring more granularity, developers _might_ need to be redundant by placing `lang` on a parent element (for their own needs) and then specifying the same value again on the `ComboboxField` (to enable the desired, internationalized filtering). This isn't too bad &mdash; all things considered. We could also consider supporting `lang` on a per-`option` basis.

None of these approaches protect us against developers providing invalid locales (which causes `toLocaleLowerCase()` to `throw` an error). However, the original `locale` idea cannot solve this problem either. If it's really that much of a concern, we can `catch` the error thrown by `toLocaleLowerCase()` and provide a more helpful error letting users know that their `lang`/`locale` is invalid; but they should already know this. I can't imagine a world where a "custom but invalid locale" is "required", but if such a scenario existed, people could just override `optionMatchesFilter()` as well.

This is something we'd like to address soon, but we'd like to come to a final decision on which approach is best first. (We're leaning towards using the native `lang` attribute instead of the custom `locale` attribute). While we wait, it seems like `toLowerCase()` behaves like `toLocaleLowerCase()` in most cases &mdash; [at least according to MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toLocaleLowerCase#description). So we're not in a rush to implement this feature, but we shouldn't neglect it forever either.

## Expose an `option`s Iterator on the `ComboboxListbox`

Currently, it is perfectly fine to iterate the `ComboboxOption`s in a regular loop:

```js
for (let i = 0; i < listbox.children.length; i++) {
  const option = listbox.children[i];
  // ...
}

for (let child = listbox.firstElementChild; child; child = child.nextElementSibling) {
  // This loop is more performant...
}
```

However, if we ever decide to support `group`ing `option`s in the future, this approach is not guaranteed to work because `listbox.children[i]` or `child.nextElementSibling` might point to a `group` instead of an `option`. In such a case, we'd have to go one lever deeper (to the `group`'s children), loop over the `option`s in the `group`, and then return to the "first level" (the `listbox`'s children). We'd continue to do this until we've looped over all of the `option`s and `group`s. Bear in mind that there may be `option`s in the `listbox` that have no `group`s at all. Here are some ways to approach this problem:

```js
for (let i = 0; i < listbox.children.length; i++) {
  const element = listbox.children[i];

  if (element instanceof ComboboxOptGroup) {
    for (let j = 0; j < element.children.length; j++) {
      // Operate on `option`s ...
    }
  } else {
    // Operate on `option`s ...
  }
}

// This loop is more performant AND more concise/simple/non-repetitive
for (let child = listbox.firstElementChild; child; child = child.nextElementSibling) {
  if (child instanceof ComboboxOptGroup) {
    child = child.firstElementChild;
    continue;
  }

  // Operate on `option`s ...

  const { parentElement } = child;
  if (child === parentElement.lastElementChild && parentElement instanceof ComboboxOptGroup) child = parentElement;
}
```

These loops in themselves are fairly simple to write and understand. However, if these loops have to be written multiple times, then it would be better to have a way to loop over the `option`s _consistently_. In other words, it would be better to have some kind of helper function or `Iterator` which enables us to loop over the `option`s in a single, consistent manner. This protects us (and developers who extend our components) from accidentally writing `option`-looping logic that does different things in different places (because we updated one part of the code but forgot to update the other.)

Since the `<select>` element exposes an [`options`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/options) property, it would make sense to expose something similar on the `ComboboxListbox` since it's the element which contains the `option`s. This could be done in a few ways, but here are the two that specifically come to mind:

1. Expose `ComboboxListbox.options` as an `Array`. The benefit of this approach is that it's more "familiar" when compared to `HTMLSelectElement.options`. However, in order to guarantee that developers always have access to the correct data, this approach requires re-creating and caching the `option`s whenever the children in the `listbox` are changed.
2. Expose `ComboboxListbox.options` as an `Iterator`. The benefit of this approach is that no `Array` data structure ever has to be cached or kept up-to-date as the `listbox`'s children are changed. And now that `Iterator`s have [helper methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator#instance_methods), they can do pretty much any (important) thing that `Array`s can do &mdash; but without the memory cost of (re)creating `Array`s of size `N` (or creating a `MutationObserver` to keep said `Array` up-to-date). The downside here is that an `Iterator` can't be indexed like an array, meaning developers can't do `Iterator[2]`. However, I've never seen a use case for indexing an `option`. Instead, developers tend to loop over the entire list of `option`s. If this is _all_ that developers will [practically] do with `ComboboxListbox.options`, then it makes sense to use an `Iterator`. Then, the component will only have to iterate over all the `option`s once (when the `Iterator` is iterated) instead of twice (once when the `option`s are cached in an `Array`, and again when the developer calls `Array.forEach()`). Developers can always call `Array.from(Iterator)` to get an indexable array if desired. Since the `option`s would have to be iterated once for the caching process anyway, this shouldn't be more costly as long as developers don't overdo it. (Devs could also create an extension of the `ComboboxListbox` that caches the `Array` for them by leveraging our `Iterator`. Then they'd only pay the cost of `Array.from(Iterator)` once, or as many times as the `option`s are changed, which was already the natural cost of the `Array` approach anyway.)

Thinking on this, it seems like `Iterator` is the clear winner here. It results in better performance for the `ComboboxField` and for other developers who want to iterate the `option`s. Moreover, it leaves the door open for flexibility _without_ sacrificing performance.

If we ever decide to support `ComboboxListbox.selectedOptions` in the future (analagous to [`HTMLSelectElement.selectedOptions`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedOptions)), then we may want to look into a cached array for _that_. Usually, the number of selected `option`s is _significantly_ smaller than the total number of `option`s belonging to a `combobox`. So iterating over all the `listbox`'s children just to pull out a couple `option`s would be awful for performance; caching the `selectedOptions` would be better. **_However_**, we might not need a cached array. If the `ComboboxField`, for example, maintains a `Set` of selected values, then `ComboboxListbox.selectedOptions` could just be another `Iterator`: `ComboboxListbox.#combobox.value.values().map((v) => document.getElementById(v))`. If `selectedOptions` _must_ be in order, we may want to consider another approach (if it's practical). Or, if we want to keep this approach, we could leverage something like [`Node.compareDocumentPosition()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition) to sort the values/`option`s received from the `Set` correctly (as long as this doesn't harm performance). Note that supporting `selectedOptions` will only be important if we choose to support `multiple` mode in the future. This is because a single-select `combobox` will only ever have one selected `option`.

The only thing really holding us back here is uncertainty surrounding community interest. If people find a true need for these `ComboboxListbox` enhancements, we should be able to apply them.

## Supporting `group`s with `ComboboxOptGroup`s

Since we've already thought through the [`ComboboxListbox.options` idea](#expose-an-options-iterator-on-the-comboboxlistbox), it should be pretty easy to support `group`s in the near future if needed. The only [significant] concern that we had left was how to make sure everything appears correctly in the DOM _and_ in the Accessibility Tree when supporting `<optgroup>`s. For example, how would someone display the _text_ for a `group` in the DOM? One approach is to add your own text or element:

```html
<combobox-listbox>
  <combobox-optgroup aria-label="My Label">
    My Label
    <!-- or <div>My Label</div> -->
    <combobox-option>First</combobox-option>
    <combobox-option>Second</combobox-option>
  </combobox-optgroup>
</combobox-listbox>
```

This approach technically works from a markup perspective (though it may require CSS that's a little more clever), but it messes up the Accessibility Tree because a `group` is only allowed to have `option`s as direct children. Not only so, but this also means that you have to be careful to avoid irrelevant (but necessary) nodes while iterating over the `option`s.

We discovered a better approach when settling on our (admittedly somewhat-hacky, but perhaps-unavoidable) solution for the "No Matches" Message: The [`::before`](https://developer.mozilla.org/en-US/docs/Web/CSS/::before) [pseudo-element](https://developer.mozilla.org/en-US/docs/Web/CSS/Pseudo-elements) and the [`attr()`](https://developer.mozilla.org/en-US/docs/Web/CSS/attr) [CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Values_and_Units/CSS_Value_Functions). According to [`Can I Use`](https://caniuse.com/css-gencontent) and MDN, all browsers support using `attr()` to generate [`content`](https://developer.mozilla.org/en-US/docs/Web/CSS/content) for a pseudo-element (e.g., `::before`). This means that we can use `content: attr(aria-label) / ""` in `combobox-optgroup::before` to create _robustly-styled_ labeling text that doesn't disrupt the A11y Tree for each `<combobox-optgroup>`. (This is nice since it means developers won't have to effectively write the same text twice; they can just use the `aria-label` attribute.) Additionally, since `::before` doesn't produce _real_ DOM elements, this means that interating over the `option`s won't become more complicated (though our Playwright tests might :sweat_smile:). This is also huge! Having a solution that doesn't require direct/manual DOM manipulation means the component has greater compatibility with JS Frameworks.

There are only two limitations that we can think of here:

1. This is yet _another_ solution that requires devs to implement something themselves in CSS Land. Even so, devs will want styling control over the `group` label anyway, so this may not be too big of a deal. Additionally, it goes a long way to have a solution that doesn't A&rpar; require developers to duplicate text or B&rpar; perform manual DOM manipulation that messes with JS frameworks. Hopefully others will see it that way too.
2. Having to style things through `::before` means that the label of the `<combobox-optgroup>` can only be text. Devs won't be able to do something ridiculously fancy like use a `ul > li` to label that `group`. However, users don't _need_ a ton of flexibility with the `group` label, just like they don't need a ton of flexibility with `<legend>`. The fact that `<optgroup>` only supports the `label` and `disabled` attributes is fine; a group doesn't really have much it needs to do. I'm sure no one has been upset that they can only provide regular text to `HTMLOptGroupElement.label`. The only issue with `<optgroup>` is that its label can't be styled, and our idea for the `ComboboxOptGroup` component would easily solve that problem with the aforementioned solution.

Since these two limitations don't seem to produce any real problems, this seems like a great path forward to supporting `group`s in the `combobox`. Thankfully, the solution is not complicated.
