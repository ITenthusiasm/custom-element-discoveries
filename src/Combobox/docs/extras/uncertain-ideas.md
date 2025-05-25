# Uncertain Ideas

Unlike `Future Ideas`, which represent planned future work and [potentially] have their implementations known, this file documents a set of "Uncertain Ideas": Ideas that _might_ be good to implement, but might also yield a less-than-ideal UX/DX. An idea can also be "Uncertain" if the resulting UX/DX is good, but the maintenance cost for implementing the idea seems too high. We're documenting these ideas here in case they become true `Future Ideas`. If an idea is rejected, then it will be moved to a `Development Note` or `Design Decision`, where the reason for the rejection will be clearly expressed.

## Supporting `(add|remove)Option` Methods on `ComboboxField`

The native `<select>` element has [`add()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/add) and [`remove()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/remove) methods for adding new `<option>`s to the form control. We thought it might make sense to support similar methods on the `ComboboxField` element, as it would improve `<select>` compatibility. Additionally, we thought that it might be helpful for JS Frameworks like `React`; but after thinking things through a little more, we no longer think that's true.

### Why We Considered the Idea

The core idea behind our `<select-enhancer>` Web Component is that it provides developers with a seamless way to progressively enhance their `<select>` elements. If someone wants to create a `combobox` that works without JS, but that also functions _better_ with JS, then all they have to do is wrap their `<select>` element, like so:

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
  <div role="listbox">
    <combobox-option value="svelte">Svelte</combobox-option>
    <combobox-option value="vue">Vue</combobox-option>
    <combobox-option value="lit">Lit</combobox-option>
    <combobox-option value="react">React</combobox-option>
  </div>
</select-enhancer>
```

This works just fine for SPAs _or_ SSR Apps that have a **static** list of `option`s. _But things get a little complicated if the `option`s are dynamic._ Many frameworks like React, Preact, and Lit assume that they are the _only_ entity rendering/updating DOM content. (At least, they're the only entity responsible for managing DOM content for the tree of elements that has "mounted the Framework" itself.) Consequently, when our `<select-enhancer>` manipulates the DOM by replacing the original elements, many JS Frameworks get confused and no longer know how to interact with that portion of the DOM. In other words, our component breaks JS Frameworks with this approach.

Originally, we thought that `ComboboxField.add()` (or `ComboboxField.addOption()`) and a corresponding `remove()` method would resolve this problem. If developers _declaratively_ render their `<option>`s to the DOM (e.g., in JSX) from a stateful array, then they should theoretically be able to `add()` or `remove()` option elements to/from the DOM _imperatively_ in some kind of `effect` (e.g., `useEffect` in React). However, after thinking about this idea more, it sounded awful. Not only does it leave the JS Framework in a janky state, but it pushes the responsibility of resolving that problem to the developer. Only devs who really know what they're doing with a framework would be able to resolve the problem, but the devs that meet said criteria are in the minority. (And practically, they shouldn't be thinking about how to resolve such problems anyway; that's the whole point of using the framework to begin with.)

The next idea that we came up with was still one that pushed the responsibility to the developer, but in a way that was simple and declarative (meanining no combatting with JS framework): Create a wrapper component which switches between "Pure HTML Mode" and "Enhanced Mode" based on whether or not the framework has mounted the component to the DOM. The solution would look something like this:

```tsx
import { createContext, useContext, useState, useEffect, Fragment } from "react";

const SelectContext = createContext(false);
export default function Select(props: React.ComponentProps<"select-enhancer">) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const FormControl = mounted ? "select-enhancer" : "select";
  const Listbox = mounted ? "div" : Fragment;

  return (
    <SelectContext.Provider value={mounted}>
      <FormControl {...props}>
        <Listbox role="listbox">{children.filter((c) => c?.type === Option)}</Listbox>
      </FormControl>
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
import Select, { Options } from "~/my-components/select";

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

Moreover, this approach enables us to provide _reusable code that doesn't break any frameworks_ to developers who don't want to write/maintain the above code themselves. We could simply provide the code in some kind of complimentary "adapter package" if needed.

Unfortunately, this approach will require us to add a bit of extra logic to the `<select-enhancer>`. Particularly, in addition to handling the use case where _it_ is responsible for modifying the DOM, it will also have to handle the use case where it has already been given the correct markup. (We can still set up the attributes as needed, however.) This is something we intentionally avoided in the past; but as long as developers hold the responsibility for providing a `[role="listbox"]` that wraps the `<combobox-option>`s, this shouldn't require any significant effort.

To our (immediate) understanding, this approach also shouldn't have any significant performance consequences -- even in frameworks like React. If the developer were to simply use `<select-enhancer>` + `<select>` directly without any logic for handling mounting, then React would generate a list of `option`s onRender, and the `<select-enhancer>` would create a new list of enhanced `option`s onMount. However, if a developer uses the approach provided above, then React would generate the list of `option`s onRender and generate a new list of enhanced `option`s onMount, leaving `<select-enhancer>` solely with the job of being a wrapper that "connects all the pieces". (There are likely technicalities that we're missing. But overall, it doesn't seem like there are significant performance costs to this approach, _especially_ when compared to other solutions like `React Select`.)

### We May Not Need These Methods Anymore

The main motivation for adding the `add()` and `remove()` methods was simplifying the developer experience in JS frameworks. But we found that this would be a _horrible_ solution to our JS framework concern, and so we pivoted to a different solution instead. That being the case, there's very little motivation now to add these methods. However, if they would prove useful for developers who love pure JS, then maybe this would be worthwhile.
