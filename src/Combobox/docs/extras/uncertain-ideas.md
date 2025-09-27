# Uncertain Ideas

Unlike `Future Ideas`, which represent planned future work and which [potentially] have their implementations known, this file documents a set of "Uncertain Ideas": Ideas that _might_ be good to implement, but might also yield a less-than-ideal UX/DX. An idea can also be "Uncertain" if the resulting UX/DX is good, but the maintenance cost for implementing the idea seems too high. We're documenting these ideas here in case they become true `Future Ideas`. If an idea is rejected, then it will be moved to a `Development Note` or `Design Decision`, where the reason for the rejection will be clearly expressed.

## Supporting `(add|remove)Option` Methods on `ComboboxField` (2025-05-22)

The native `<select>` element has [`add()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/add) and [`remove()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/remove) methods for adding new `<option>`s to the form control. We thought it might make sense to support similar methods on the `ComboboxField` element, as it would improve `<select>` compatibility. Additionally, we thought that it might be helpful for JS Frameworks like `React`; but after thinking things through a little more, we no longer think that's true.

### Why We Considered the Idea

The core idea behind our `<select-enhancer>` Web Component is that it provides developers a seamless way to progressively enhance their `<select>` elements. If someone wants to create a `combobox` that works without JS, but that also functions _better_ with JS, then all they have to do is wrap their `<select>` element, like so:

```html
<label for="framework">Framework</label>
<select-enhancer>
  <select id="framework" name="framework">
    <option value="svelte">Svelte</option>
    <option value="vue">Vue</option>
    <option value="lit">Lit</option>
    <option value="react">React</option>
  </select>
</select-enhancer>
```

Once the component is mounted, it will replace the native `<select>` element with the more-robust `<combobox-field>` component (and friends).

```html
<!-- Some auto-generated attributes have been omitted for simplicity -->
<label for="framework">Framework</label>
<select-enhancer>
  <combobox-field id="framework" name="framework"></combobox-field>
  <combobox-listbox>
    <combobox-option value="svelte">Svelte</combobox-option>
    <combobox-option value="vue">Vue</combobox-option>
    <combobox-option value="lit">Lit</combobox-option>
    <combobox-option value="react">React</combobox-option>
  </combobox-listbox>
</select-enhancer>
```

This works just fine for SPAs _or_ SSR Apps that have a **static** list of `option`s. _But things get a little complicated if the `option`s are dynamic._ Many frameworks like React, Preact, and Lit assume that they are the _only_ entity rendering/updating DOM content. (At least, they're the only entity responsible for managing DOM content for the tree of elements that has "mounted the Framework" itself.) Consequently, when our `<select-enhancer>` manipulates the DOM by replacing the original elements, many JS Frameworks get confused and no longer know how to interact with that portion of the DOM. In other words, our component breaks JS Frameworks with this approach. (This breakage only happens if the Framework tries to manipulate the part of the DOM which we already manipulated, which should only happen if the `option`s were changed dynamically.)

Originally, we thought that `ComboboxField.add()` (or `ComboboxField.addOption()`) and a corresponding `remove()` method would resolve this problem. If developers _declaratively_ render their `<option>`s to the DOM (e.g., in JSX) from a stateful array, then they should theoretically be able to `add()` or `remove()` option elements to/from the DOM _imperatively_ in some kind of `effect` (e.g., `useEffect` in React). However, after thinking about this idea more, it sounded awful. Not only does it leave the JS Framework in a janky state, but it pushes the responsibility of resolving that problem to the developer. Only devs who really know what they're doing with a framework would be able to resolve the problem, but the devs that meet said criteria are in the minority. (And practically, they shouldn't be thinking about how to resolve such problems anyway; that's the whole point of using the framework to begin with.)

The next idea that we came up with was still one that pushed the responsibility to the developer, but in a way that was simple and declarative (meanining no combatting with JS framework): Create a wrapper component which switches between "Pure HTML Mode" and "Enhanced Mode" based on whether or not the framework has mounted the component to the DOM. The solution would look something like this:

```tsx
import { createContext, useContext, useState, useEffect, Fragment } from "react";

const SelectContext = createContext(false);
export default function Select({ children, ...rest }: React.ComponentProps<"select-enhancer">) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const Wrapper = mounted ? "select-enhancer" : "select";

  return (
    <SelectContext.Provider value={mounted}>
      <Wrapper>
        {mounted ? (
          <>
            <combobox-field {...rest}></combobox-field>
            <combobox-listbox>{children.filter((c) => c?.type === Option)}</combobox-listbox>
          </>
        ) : (
          children.filter((c) => c?.type === Option)
        )}
      </Wrapper>
    </SelectContext.Provider>
  );
}

export function Option(props: React.ComponentProps<"combobox-option">) {
  const mounted = useContext(SelectContext);
  const Element = mounted ? "combobox-option" : "option";
  return <Element {...props} />;
}
```

What's most important about this approach is that it's _simple_ and _declarative_. Thus, developers can stay in the land of simple code as they write their UIs:

```jsx
import Select, { Option } from "~/my-components/select";

export default function MyForm() {
  return (
    <form>
      <Select>
        {options.map((o) => (
          <Option key={o.value} value={o.value}>
            {o.label}
          </Option>
        ))}
      </Select>
    </form>
  );
}
```

Moreover, this approach enables us to provide _reusable code that doesn't break any frameworks_ to developers who don't want to write/maintain the above code themselves. We could simply provide the code in some kind of complimentary "adapter package" if needed (like with the [`Form Observer`](https://github.com/enthusiastic-js/form-observer)).

Unfortunately, this approach will require us to add a bit of extra logic to the `<select-enhancer>`. Particularly, in addition to handling the use case where _it_ is responsible for modifying the DOM, it will also have to handle the use case where it has already been given the correct markup. (We can still set up the a11y attributes as needed, however.) This is something we intentionally avoided in the past.

To our (immediate) understanding, this approach also shouldn't have any significant performance consequences &mdash; even in frameworks like React. If the developer were to simply use `<select-enhancer>` and `<select>` directly without any logic for handling mounting, then React would generate a list of `option`s onRender, and the `<select-enhancer>` would create a new list of enhanced `option`s onMount. However, if a developer uses the approach provided above, then React would generate the list of `option`s onRender and generate a new list of enhanced `option`s onMount, leaving the `<select-enhancer>` solely with the job of being a wrapper that "connects all the pieces". (There are likely technicalities that we're missing. But overall, it doesn't seem like there are significant performance costs to this approach, _especially_ when compared to other solutions like `React Select`.)

### We May Not Need These Methods Anymore

The main motivation for adding the `add()` and `remove()` methods was simplifying the developer experience in JS frameworks. But we found that this would be a _horrible_ solution for our JS framework concern, and so we pivoted to a different solution instead. That being the case, there's very little motivation now to add these methods. However, if they would prove useful for developers who love pure JS, then maybe this would be worthwhile to support.

## Resetting the `option`s on `expand` Instead of on `collapse`

**This is a _VERY_ uncertain idea.** It's of incredibly low interest/priority and **_does not_** need to be acted upon. We're only calling this out here so that we don't forget that we considered the idea. Who knows? Maybe it'll be worth at least exploring in the future... **_maybe_** (unlikely...)

Some concerns if we start pursuing this:

- When a user types into a collapsed `combobox`, it is automatically expanded and then filtered. This would cause the `combobox`'s `#matchingOptions` to be (unnecessarily) reset (because of the expansion), then properly filtered (because of the user's typing) &mdash; which is wasteful from a performance standpoint. Is there a way to avoid this problem? Is a solution even worth pursuing, or is it better to keep resetting the `option`s on `collapse` instead like we're doing today?
- What are the actual benefits, code simplifications, and/or performance improvements that would come from this approach? (Some benefits likely exist, even if there's a larger number of cons. But we haven't thought deeply about the benefits yet.)

## Enabling Automatic "`Selected` Option Reconciliation" Pre Mount

Although `<option>` elements can have their `selected` state altered in isolation, the `<select>` element to which they are attached will always "reconcile" the `<option>`s so that only _one_ is selected (if the form control is in single-select mode). This reconciliation happens immediately after the `<option>`s are attached to the `<select>` element, even if the `<select>` element is not yet connected to the `Document`.

Unfortunately, our component only mimics this behavior _partially_. It _does_ perform automatic "`selected` option reconciliation" when `<combobox-option>`s are added to it, but only _after_ the entire component (including the `<select-enhancer>`) is connected to the Document. Practically speaking, this should be acceptable. Why? Because the component's value has no true meaning or purpose to the User _or_ to any existing `<form>`s on the page until _after_ the component is connected to the DOM. For this reason, we don't currently have any motivation to take things a step further by performing the reconciliation _immediately_ after "all the correct pieces" are inserted into the `<select-enhancer>`. Attempting to support this use case would increase the complexity of our code without adding any meaningful benefit to users. However, perhaps we're missing something? If it can be proved that there is a _real_ benefit that we're missing out on here, then we can consider supporting this use case in the future.
