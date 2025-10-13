# Combobox

A robust, accessible and stylable [`Combobox`](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) [Web Component](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) whose functionality can be extended or customized with ease.

## Features and Benefits

- **Framework Agnostic**: Because the `combobox` component is just a custom `HTMLElement`, it works seamlessly in all JS Frameworks (and in pure-JS applications if that's what you fancy).
- **Integrates with Native Web Forms**: This `combobox` integrates with the web's native `<form>` element, meaning that its value will be seen in the [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) and will be automatically [sent to the server](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Sending_and_retrieving_form_data) when the form is submitted -- all without writing a single line of JS.
- **Works with Various Form Libraries**: The `combobox` component emits standard DOM events like [`input`](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event) and [`change`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/change_event), enabling it to work naturally with reputable form libraries (e.g., the [`Form Observer`](https://github.com/enthusiastic-js/form-observer), [`Conform`](https://conform.guide/), and [`React Hook Form`](https://react-hook-form.com/)).
- **Progressive Enhacement**: When used in `Select Enhacing Mode`, the component will fallback to a regular `<select>` element if JS is disabled or unavailable for your users. This means your forms will _always_ be fully usable and accessible.
- **Highly Customizable**: The `combobox` component is flexible enough to work with whatever CSS you provide, and its functionality can be enhanced or overriden by [extending](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends) it.
- **Performant**: Unlike many other alternatives, the `combobox` component has been cleverly designed to work without complex state management tools or aggressive DOM Tree manipulation. This makes it a fast and memory-efficient solution.
- **No Dependencies**: The `combobox` component is built on the native web platform instead of extending other frameworks or libraries, guaranteeing your bundle size remains as small as possible.

<!-- TODO: Link to article explaining how progressively-enhanced Form Controls _greatly_ simplify frontend code. -->

<!-- TODO: Link to example of styling our `combobox` to look like GitHub's or ShadcnUI's. Probably put it alongside an example of another styling approach. -->
