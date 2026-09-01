/*
 * ace-placeholder.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

/**
 * Represents a placeholder (preview) rendering of an Ace editor. Since Ace
 * editors are somewhat expensive to draw, this placeholder is used in place
 * of a real editor instance to make code visible and allow for correct height
 * computations.
 */
export class AcePlaceholder {
  private readonly element: HTMLElement;

  constructor(content: string) {
    const ele = document.createElement('pre');
    ele.innerText = content;
    ele.className = 'ace_editor';
    this.element = ele;
  }

  public getElement() {
    return this.element;
  }
}
