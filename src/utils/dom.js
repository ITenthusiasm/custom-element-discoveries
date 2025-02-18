/**
 * Sets the `attribute` of an `element` to the specified `value` _if_ the element's attribute
 * did not already have that value. Used to avoid redundantly triggering `MutationObserver`s.
 *
 * @param {HTMLElement} element
 * @param {string} attribute
 * @param {string} value
 * @returns {void}
 */
export function setAttributeFor(element, attribute, value) {
  if (element.getAttribute(attribute) === value) return;
  element.setAttribute(attribute, value);
}
