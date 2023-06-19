

import { unstable as Automerge } from "@automerge/automerge";

import assert from "assert";

const TEXT_KEY = "text";

interface DocType {
  [TEXT_KEY]: string;
}

let doc = Automerge.init<DocType>();
doc = Automerge.change(doc, doc => {
  doc[TEXT_KEY] =  "aaabbbccc";
  Automerge.mark(doc, [TEXT_KEY], { start: 3, end: 6, expand: 'both' }, "bold", true);
  const marks = Automerge.marks(doc, TEXT_KEY);
  assert.deepStrictEqual(marks, [{ name: 'bold', value: true, start: 3, end: 6 }]);
});

doc = Automerge.change(
  doc, 
  {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    patchCallback: (patches, _info) => {
      console.log(patches);
      // 0: {action: 'splice', path: ['text', 6], value: 'A'}
      // 1: {action: 'splice', path: ['text', 3], value: 'A', marks: {bold: true}}
    }
  },
  doc => {
    Automerge.splice(doc, [TEXT_KEY], 6, 0, "A");
    Automerge.splice(doc, [TEXT_KEY], 3, 0, "A");
    const marks = Automerge.marks(doc, TEXT_KEY);
    assert.deepStrictEqual(marks, [{ name: 'bold', value: true, start: 3, end: 8 }]);
  });

console.log(Automerge.marks(doc, TEXT_KEY));
// 0 :  {name: 'bold', value: true, start: 3, end: 8}
