/*
 * code.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';

import { GapCursor } from 'prosemirror-gapcursor';
import { EditorView } from 'prosemirror-view';

import zenscroll from 'zenscroll';

import { CommandFn } from "./command";
import { ExtensionFn } from "./extension-types";
import { editingRootNode } from './node';
import { editorScrollContainer } from './scroll';
import { EditorState } from 'prosemirror-state';
import { rmdChunk } from './rmd';
import { lines } from 'core';

export type CodeViewExtensionFn = (codeViews: { [key: string]: CodeViewOptions }) => ExtensionFn;

export interface CodeViewOptions {
  lang: (attrs: ProsemirrorNode, content: string) => string | null;
  attrEditFn?: CommandFn;
  createFromPastePattern?: RegExp;
  classes?: string[];
  borderColorClass?: string;
  firstLineMeta?: boolean;
  lineNumbers?: boolean;
  bookdownTheorems?: boolean;
  lineNumberFormatter?: (lineNumber: number, lineCount?: number, line?: string) => string;
}

/**
 * Track all code view node view instances to implement additional behavior
 * (e.g. gap cursor for clicks between editor instances)
 */

export interface CodeEditorNodeView {
  isFocused() : boolean;
  getPos(): number;
  dom: HTMLElement;
  setGapCursorPending(pending: boolean): void;
}

export class CodeEditorNodeViews {
  private nodeViews: CodeEditorNodeView[];

  constructor() {
    this.nodeViews = [];
  }
  public add(nodeView: CodeEditorNodeView) {
    this.nodeViews.push(nodeView);
  }

  public remove(nodeView: CodeEditorNodeView) {
    const index = this.nodeViews.indexOf(nodeView);
    if (index >= 0) {
      this.nodeViews.splice(index, 1);
    }
  }

  public activeNodeView() : CodeEditorNodeView | undefined {
    return this.nodeViews.find(view => view.isFocused());
  }

  public handleClick(view: EditorView, event: Event): boolean {
    // alias to mouseEvent
    const mouseEvent = event as MouseEvent;

    // see if the click is between 2 contiguously located node views
    for (const nodeView of this.nodeViews) {
      // gap cursor we might detect
      let gapCursor: GapCursor | null = null;

      // get the position
      const pos = nodeView.getPos();
      const $pos = view.state.doc.resolve(pos);

      // if the previous node is code, see if the click is between the 2 nodes
      if ($pos.nodeBefore && $pos.nodeBefore.type.spec.code) {
        // get our bounding rect
        const dom = nodeView.dom;
        const nodeViewRect = dom.getBoundingClientRect();

        // get the previous node's bounding rect
        const prevNodePos = pos - $pos.nodeBefore!.nodeSize;
        const prevNodeView = this.nodeViews.find(nv => nv.getPos() === prevNodePos);
        if (prevNodeView) {
          const prevNodeRect = prevNodeView.dom.getBoundingClientRect();

          // check for a click between the two nodes
          const mouseY = mouseEvent.clientY;
          if (mouseY > prevNodeRect.top + prevNodeRect.height && mouseY < nodeViewRect.top) {
            gapCursor = new GapCursor($pos);
          }
        }

        // if there is no previous node and the click is above us then gap cursor above
        // (only do this if the cursor is within 150 pixels of the left edge)
      } else if (
        !$pos.nodeBefore &&
        $pos.depth === 1 &&
        mouseEvent.clientY < nodeView.dom.getBoundingClientRect().top &&
        Math.abs(mouseEvent.clientX - nodeView.dom.getBoundingClientRect().left) < 150
      ) {
        gapCursor = new GapCursor($pos);
      }

      // return gapCursor if we found one
      if (gapCursor) {
        const tr = view.state.tr;

        // notify the node views that we are setting a gap cursor
        this.nodeViews.forEach(ndView => ndView.setGapCursorPending(true));

        // ensure the view is focused
        view.focus();

        // set the selection
        tr.setSelection(gapCursor);
        view.dispatch(tr);

        // notify the node views that we are done setting the gap cursor
        this.nodeViews.forEach(ndView => ndView.setGapCursorPending(false));

        // prevent default event handling
        event.preventDefault();
        event.stopImmediatePropagation();
        return true;
      }
    }

    return false;
  }
}


export function scrollCodeViewElementIntoView(ele: HTMLElement, codeViewDom: HTMLElement, view: EditorView) {
  const editingRoot = editingRootNode(view.state.selection);
  if (editingRoot) {
    const container = view.nodeDOM(editingRoot.pos) as HTMLElement;
    const scroller = zenscroll.createScroller(editorScrollContainer(container));

    let top = 0;

    // The DOM node representing this editor chunk (this.dom) may not be a
    // direct child of the scrollable container. If it isn't, walk up the DOM
    // tree until we find the main content node (pm-content), which is the
    // offset parent against which we need to compute scroll position.
    let scrollParent = codeViewDom;
    while (scrollParent.offsetParent != null &&
           !scrollParent.offsetParent.classList.contains("pm-content"))
    {
      top += scrollParent.offsetTop;
      scrollParent = scrollParent.offsetParent as HTMLElement;
    }

    // Since the element we want to scroll into view is not a direct child of
    // the scrollable container, do a little math to figure out the
    // destination scroll position.
    top += ele.offsetTop + scrollParent.offsetTop;
    const bottom = top + ele.offsetHeight;
    const viewTop = container.scrollTop;
    const viewBottom = container.scrollTop + container.offsetHeight;

    // Scroll based on element's current position and size
    if (top > viewTop && bottom < viewBottom) {
      // Element is already fully contained in the viewport
      return;
    } else if (ele.offsetHeight > container.offsetHeight) {
      // Element is taller than the viewport, so show the first part of it
      scroller.toY(top);
    } else if (top < viewTop) {
      // Element is above viewport, so scroll it into view
      scroller.toY(top);
    } else if (bottom > viewBottom) {
      // Part of the element is beneath the viewport, so scroll just enough to
      // bring it into view
      scroller.toY(container.scrollTop - (viewBottom - bottom));
    }
  }
}



export function executableCodeForActiveLanguage(state: EditorState) {

  // function to examine a node and see if has executable code
  const schema = state.schema;
  const nodeAsLanguageCodeBlock = (node: ProsemirrorNode, pos: number) => {
    const languageCodeBlock = (language: string, code?: string) => {
      return {
        language,
        pos,
        code: code || node.textContent
      };
    }
    if (node.type === schema.nodes.yaml_metadata) {
      return languageCodeBlock('yaml');
    } else if (node.type === schema.nodes.rmd_chunk) {
      const parts = rmdChunk(node.textContent);
      if (parts) {
        return languageCodeBlock(parts.lang, parts.code);
      }
    } else if (node.type === schema.nodes.raw_block) {
      return languageCodeBlock(node.attrs.format);
    } else {
      return undefined;
    }
  };

  // check the currently active node to see if it has a langauge
  const { parent, parentOffset, pos }= state.selection.$head;

  const activeBlock = nodeAsLanguageCodeBlock(parent, pos - parentOffset);
  if (activeBlock) {
    // collect all the blocks with this language
    const blocks: Array<{ language: string, code: string; active: boolean }> = [];
    state.doc.descendants((node, pos) => {
      const languageBlock = nodeAsLanguageCodeBlock(node, pos+1);
      if (languageBlock?.language === activeBlock.language) {
        blocks.push({
          ...languageBlock,
          active: languageBlock.pos === activeBlock.pos
        });
      }
    });

    // concatenate together all of the code, and indicate the start and end lines 
    // of the active block
    const code: string[] = [];
    let activeCellBegin = -1, activeCellEnd = -1;
    blocks.forEach(block => {
      const blockLines = lines(block.code);
      if (block.active) {
        activeCellBegin = code.length;
        activeCellEnd = code.length + blockLines.length - 1;
      }
      if (blockLines[blockLines.length-1].trim().length !== 0) {
        blockLines.push("");
      }
      code.push(...blockLines);
    });
    return {
      code,
      activeCellBegin,
      activeCellEnd
    }

  } else {
    return undefined;
  }
}


