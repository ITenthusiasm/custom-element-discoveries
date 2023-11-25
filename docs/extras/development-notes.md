# Development Notes

A collection of questions/concerns that I thought through while designing some of the Web Components in this repository.

## Why Does `ComboboxContainer` Sketchily Transfer Its Attributes to `ComboboxField`?

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

See how much worse the Developer Experience is if we _don't_ create the wrapper for consumers? And the DX is not only bad; it's error prone. Everything turns out much better if we simply create an intelligent wrapper for the consumer. This is why we have the `<combobox-container>` Web Component.

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

The next best thing is to use the `<combobox-container>` to hold everything instead (_if_ the goal is creating an experience similar to a `<select>` element):

```html
<combobox-container>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</combobox-container>
```

#### Where Do We Put the `combobox` and the `listbox`?

We don't put them anywhere. We can let the `<combobox-container>` create and position these elements itself. So instead of writing

```html
<combobox-container>
  <combobox-field></combobox-field>

  <!-- Or you can create an extra `<combobox-listbox>` Web Component -->
  <div role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</combobox-container>
```

consumers can simply write

```html
<combobox-container>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</combobox-container>
```

Now, I know... This may look like undesirable magic. But there are some benefits to taking this approach that are worth noting:

**First: With this approach, we can prevent illegal elements from entering the `<combobox-container>`.** The `<combobox-container>` can be configured to erase anything that isn't a `<combobox-option>`. This means that illegal elements won't be accepted by the container as children, and duplicates of `<combobox-field>` won't be accepted by the container either. (Note: Alternatively, we could write extra logic to resolve duplicate `<combobox-field>`s, but this ultimately introduces more complexity to both the Combobox Component and the consumers of the Combobox Component.) Additionally, this allows the container to have full control over how its children are arranged. For example, we can _guarantee_ that the `combobox`'s `nextElementSibling` will be the `listbox` -- allowing us to simplify our JavaScript logic and our default styles.

**Second: We save the consumer from creating a redundant `listbox`**. Recall that ideally, the consumer shouldn't have to think about ARIA attributes. We _could_ allow consumers to write:

```html
<combobox-container>
  <div role="listbox">
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </div>
</combobox-container>
```

But remember that if we give the consumer control over the element that wraps the options, our default styles for the `listbox` aren't guaranteed to be consistent. To guarantee absolute safety, we would need to give the consumer a `combobox-listbox` element and enforce that no other kind of element is used to wrap the options:

```html
<combobox-container>
  <combobox-listbox>
    <combobox-option>First</combobox-option>
    <!-- ... -->
    <combobox-option>Last</combobox-option>
  </combobox-listbox>
</combobox-container>
```

This is an acceptable solution. However, it adds more things that the consumer needs to think about, and to me it feels a bit redundant. This approach also steps further away from the look and feel of a regular `<select>` element. So having the `<combobox-container>` create the `listbox` _for_ the consumer seems more ideal.

**Third: We save the consumer from any complications arising from the `combobox`.** As I mentioned before, the ideal Combobox Component behaves similarly to the the native `<select>` element. This also means that ideally, any useful APIs belonging to `<select>` or `<option>` should be mimicked. For instance, the useful `HTMLSelectElement.value` property should be supported by the `ComboboxField` element, and the useful `HTMLOptionElement.selected` property should be supported by the `ComboboxOption` element. However, such support means that the `ComboboxField` and the `ComboboxOption` both influence each other's data.

Because the default value of a Combobox Component should be determined during "initial render" (when the parts of the Combobox Component are initially attached to the DOM), the constraint of emulating the native `<select>` APIs requires the `ComboboxField` and the list of `ComboboxOption`s to be loaded in a carefully-considered order. Otherwise, an infinite loop or a runtime error could accidentally get introduced.

There might be some ways to allow the consumer to supply the `<combobox-field>` to the `<combobox-container>` on their own without breaking anything. But the simplest solution is to hide these complications/concerns from the consumer altogether by allowing the container to determine _when_ the `<combobox-field>` is created and attached. This guarantees that the consumer won't encounter any unexpected bugs.

### 4&rpar; Supplying the Proper Attributes to the `ComboboxField`

Enabling the `<combobox-container>` to control everything is quite valuable. The fact it guarantees the proper arrangement of its children and forbids any invalid children is great! But taking this approach doesn't come without caveats. Let's consider what I've called the "ideal" markup again:

```html
<combobox-container>
  <combobox-option>First</combobox-option>
  <!-- ... -->
  <combobox-option>Last</combobox-option>
</combobox-container>
```

Remember that the `<combobox-field>` represents the element with the `combobox` role, and this element is the central part of the Combobox Component. But with this setup, how is the `<combobox-field>` supposed to receive any attributes? Sure, the consumer won't have to worry about any _accessibility_ attributes. But what about providing a CSS class to the `<combobox-field>`? [Data attributes](https://developer.mozilla.org/en-US/docs/Learn/HTML/Howto/Use_data_attributes)? An `id` that can be targeted by a `<label>` element? Currently, with our approach, the consumer has no way to accomplish this without writing JavaScript. Alternatively, we could try to find a way to let the consumer provide the `<combobox-field>` themselves, but we've already discussed some of the risks associated with that.

If we want to avoid worrying the consumer with extra concerns, one solution is to have the `<combobox-container>` transfer all of its attributes to the `<combobox-field>`. This is a trade-off... And it's a trade-off that some may consider undesirable. However, it's a trade-off that I have accepted for the sake of creating a simpler experience that more closely matches the look and feel of a `<select>` element.

Although it may seem odd to transfer to transfer attributes from the `<combobox-container>` to the `<combobox-field>`, this practice is actually _very_ common when it comes to writing components with a JavaScript framework. Imagine if we had created a `Select` component in [`svelte`](https://svelte.dev/) (or some other framework) instead. Wherever this component would be used, we'd have something like the following:

```svelte
<Select>
  <Option>First</Option>
  <!-- ... -->
  <Option>Last</Option>
</Select>
```

But what would be happening under the hood here? Any attributes passed to `Select` wouldn't actually get placed on any "custom select element", _nor_ would the attributes get placed on the wrapping `div` (or other element) used to contain, organize, and style the `combobox`/`listbox` within the component. Instead, the attributes would get passed directly to the element representing the `combobox`, because that's the only element that really makes the attributes useful. It's _highly_ unlikely that someone would need to supply attributes to the wrapping `div` or to any other element in the component. (Any necessary _styles_ could be handled with plain CSS). If this was deemed absolutely necessary, additional props could be exposed to satisfy this use case.

So it is with the `<combobox-container>`. Its sole purpose is to setup the `combobox` and the `listbox` -- just like a `Select` component in a JS framework would do. It doesn't need to do much else; so it can safely transfer its attributes to the `<combobox-field>`.

If it becomes apparent in the future that attributes are _needed_ on the `<combobox-container>`, then logic can be put in place to support that need.

### Conclusion

You don't have to agree with the design decision that I made, but hopefully this explanation helps you understand _why_ such an odd decision was made. Ultimately, what I learned from creating a Combobox Component is that it is _incredibly_ difficult to create a Web Component that mimics the `<select>`/`<option>` element's HTML and that emulates even just a _subset_ of the element's JavaScript API. And we haven't even discussed [complications with the Shadow DOM](https://github.com/enthusiastic-js/form-observer/blob/main/docs/form-observer/guides.md#be-mindful-of-the-shadow-boundary).

As you start to support the features for the native `<select>` element, you are eventualy forced into situations where you have to consider trade-offs. For me, the trade-off was, transferring attributes from the `<combobox-container>` to the `<combobox-field>` in order to preserve the expected Developer Experience. A different approach could avoid this oddity, but it would encounter other problems in the process. In the end, what we really need is for the [`<selectlist>`](https://open-ui.org/components/selectlist/) element to be standardized as quickly as possible.
