/*
 * automerge-pm.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
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

import { unstable as Automerge, Patch } from "@automerge/automerge";

import {
  Attrs,
  Fragment,
  Mark,
  Node as ProsemirrorNode,
  Schema,
  Slice,
} from "prosemirror-model";

import { clamp } from "lodash";
import { Transaction } from "prosemirror-state";
import { DocType, kDocContentKey } from "./automerge-doc";
import { Change } from "./automerge";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceStep,
} from "prosemirror-transform";

export const initProsemirrorDocFromAutomergeDoc = (
  doc: Automerge.Doc<DocType>,
  tr: Transaction
) => {
  const schema = tr.doc.type.schema;
  const content = doc[kDocContentKey];
  if (content) {
    tr.replaceSelectionWith(schema.text(content));
    const marks = Automerge.marks(doc, kDocContentKey);
    for (const mark of marks) {
      const { name, attr } = prosemirrorMarkFromAutomergeMark(mark);
      tr.addMark(
        prosemirrorPosFromContentPos(mark.start),
        prosemirrorPosFromContentPos(mark.end),
        schema.marks[name].create(attr)
      )
    }
  }  
  return tr;
}

/** Extends a Prosemirror Transaction with new steps incorporating
 *  the effects of a Micromerge Patch.
 *
 *  @param tr - the original transaction to extend
 *  @param patch - the Micromerge Patch to incorporate
 *  @returns
 *      tr: a Transaction that includes additional steps representing the patch
 *      startPos: the Prosemirror position where the patch's effects start
 *      endPos: the Prosemirror position where the patch's effects end
 *    */
export const extendProsemirrorTransactionWithAutomergePatch = (
  doc: Automerge.Doc<DocType>,
  tr: Transaction,
  patch: Automerge.Patch
): { tr: Transaction; startPos: number; endPos: number } => {
  const schema = tr.doc.type.schema;
  let startPos = Number.POSITIVE_INFINITY;
  let endPos = Number.NEGATIVE_INFINITY;

  switch (patch.action) {
    
    case "splice": {
      const startIndex = patch.path[1] as number;
      const marks = getProsemirrorMarksForMarkMap(doc, startIndex, schema);
      const index = prosemirrorPosFromContentPos(startIndex);
      const startPos = index;
      const endPos = index + patch.value.length;
      if (patch.value) {
        tr = tr.replace(
          index, 
          index,
          new Slice(Fragment.from(schema.text(patch.value, marks)), 0, 0)
        );
      } else {
        // we've actually seen an error state where patch.value was an empty string
        // for this case just return the original tr
      }
      return { tr, startPos, endPos };
    }
    case "del": {
      const startIndex = patch.path[1] as number;
      const index = prosemirrorPosFromContentPos(startIndex);
      const length = patch.length || 1;
      return {
        tr: tr.replace(index, index + length, Slice.empty),
        startPos: index,
        endPos: index,
      };
    }

    case "mark": {
      for (const mark of patch.marks) {
        const { name, attr } = prosemirrorMarkFromAutomergeMark(mark);
        if (mark.value === null || mark.value === false) {
          tr = tr.removeMark(
            prosemirrorPosFromContentPos(mark.start),
            prosemirrorPosFromContentPos(mark.end),
            schema.marks[name]
          );
        } else {
          tr = tr.addMark(
            prosemirrorPosFromContentPos(mark.start),
            prosemirrorPosFromContentPos(mark.end),
            schema.marks[name].create(attr)
          );
        }
        startPos = Math.min(startPos, mark.start);
        endPos = Math.max(endPos, mark.end);
      }
      return {
        tr: tr,
        startPos: prosemirrorPosFromContentPos(startPos),
        endPos: prosemirrorPosFromContentPos(endPos),
      };
    }
  }

  if (patch.action === "unmark") {
    const { start, end, name } = patch;
    return {
      tr: tr.removeMark(
        prosemirrorPosFromContentPos(start),
        prosemirrorPosFromContentPos(end),
        schema.marks[name]
      ),
      startPos: prosemirrorPosFromContentPos(start),
      endPos: prosemirrorPosFromContentPos(end),
    };
  }
  throw new Error(`BUG: Unsupported patch type '${patch.action}'`);
};

// Given a CRDT Doc and a Prosemirror Transaction, update the micromerge doc.
export function applyProsemirrorTransactionToAutomergeDoc(args: {
  doc: Automerge.Doc<DocType>;
  tr: Transaction;
}): {
  change: Change | null;
  patches: Patch[];
  doc: Automerge.Doc<DocType>;
} {
  const initialDoc = args.doc;
  const { tr: txn } = args;

  if (txn.steps.length === 0) {
    return { doc: initialDoc, change: null, patches: [] };
  }
  const patches: Patch[] = [];
  const doc = Automerge.change(
    initialDoc,
    {
      patchCallback: (p) => {
        patches.push(...p);
      },
    },
    (doc) => {
      for (const step of txn.steps) {
        if (step instanceof ReplaceStep) {
          const from = contentPosFromProsemirrorPos(step.from, txn.before);
          const to = contentPosFromProsemirrorPos(step.to, txn.before);
          if (step.slice) {
            // handle insertion
            // This step coalesces the multiple paragraphs back into one paragraph. Because step.slice.content is a 
            // Fragment and step.slice.content.content is 2 Paragraph nodes
            const insertedContent = step.slice.content.textBetween(
              0,
              step.slice.content.size
            );
            Automerge.splice(
              doc,
              kDocContentKey,
              from,
              to - from,
              insertedContent
            );
          } else {
            // handle deletion
            Automerge.splice(doc, kDocContentKey, from, to - from);
          }
        } else if (step instanceof AddMarkStep) {
          
          const from = contentPosFromProsemirrorPos(step.from, txn.before);
          const to = contentPosFromProsemirrorPos(step.to, txn.before);
          const markName = step.mark.type.name;
          const markAttrs = JSON.stringify(step.mark.attrs);
          const markExpand = step.mark.type.spec.inclusive === false ? 'none' : 'after';
          const range : Automerge.MarkRange = { expand: markExpand, start: from, end: to };
          Automerge.mark(
            doc,
            kDocContentKey,
            range,
            `${markName}`,
            markAttrs
          );
          
        } else if (step instanceof RemoveMarkStep) {
          
          const from = contentPosFromProsemirrorPos(step.from, txn.before);
          const to = contentPosFromProsemirrorPos(step.to, txn.before);
          Automerge.unmark(
            doc,
            kDocContentKey,
            { start: from, end: to },
            step.mark.type.name
          );
          
        }
      }
    }
  );

  const changes = Automerge.getChanges(initialDoc, doc);
  return { doc, change: changes[0], patches };
}

function getProsemirrorMarksForMarkMap(
  doc: Automerge.Doc<DocType>,
  index: number,
  schema: Schema
): readonly Mark[] {
  const allMarks = Automerge.marks(doc, kDocContentKey).filter(
    (m) => m.start <= index && m.end >= index
  );
  const notUnmarked = new Map<string, Automerge.Mark>();
  for (const mark of allMarks) {
    if (mark.value === null) {
      notUnmarked.delete(mark.name);
    } else {
      notUnmarked.set(mark.name, mark);
    }
  }
  return Array.from(notUnmarked.values()).map((mark) => {
    const { name, attr } = prosemirrorMarkFromAutomergeMark(mark);
    return schema.marks[name].create(attr);
  });
}

function prosemirrorMarkFromAutomergeMark(mark: Automerge.Mark) {
  const name = mark.name;
  const attr = JSON.parse(mark.value as string) as Attrs;
  return { name, attr };
}


/**
 * Converts a position in the Prosemirror doc to an offset in the CRDT content string.
 * For now we only have a single node so this is relatively trivial.
 * In the future when things get more complicated with multiple block nodes,
 * we can probably take advantage
 * of the additional metadata that Prosemirror can provide by "resolving" the position.
 * @param position : an unresolved Prosemirror position in the doc;
 * @param doc : the Prosemirror document containing the position
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function contentPosFromProsemirrorPos(
  position: number,
  doc: ProsemirrorNode
): number {
  // The -2 accounts for the extra characters at the beginning of the PM doc
  // containing the beginning of the doc and paragraph.
  // In some rare cases we can end up with incoming positions outside of the single
  // paragraph node (e.g., when the user does cmd-A to select all),
  // so we need to be sure to clamp the resulting position to inside the paragraph node.
  return clamp(position - 2, 0, doc.textContent.length);
}

/** Given an index in the text CRDT, convert to an index in the Prosemirror editor.
 *  The Prosemirror editor has a paragraph node which we ignore because we only handle inline;
 *  the beginning of the body and paragraph each up one position in the Prosemirror indexing scheme.
 *  This means we have to add 2 to CRDT indexes to get correct Prosemirror indexes.
 */
function prosemirrorPosFromContentPos(position: number) {
  return position + 2;
}
