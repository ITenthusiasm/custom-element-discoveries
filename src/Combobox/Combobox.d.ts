import type ComboboxListbox from "./ComboboxListbox.js";

export interface ListboxWithChildren<T extends HTMLElement> extends ComboboxListbox {
  children: HTMLCollectionOf<T>;
  firstElementChild: T | null;
  lastElementChild: T | null;
}
