/*
 * index.ts
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


import * as automerge from "@automerge/automerge"

import { ExtensionFn} from "editor";


export function collabExtension()
: ExtensionFn {

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (_context) => {


    let doc1 = automerge.from({
      tasks: [
        { description: "feed fish", done: false },
        { description: "water plants", done: false },
      ],
    })

    // Create a new thread of execution
    let doc2 = automerge.clone(doc1)

    // Now we concurrently make changes to doc1 and doc2

    // Complete a task in doc2
    doc2 = automerge.change(doc2, d => {
      d.tasks[0].done = true
    })

    // Add a task in doc1
    doc1 = automerge.change(doc1, d => {
      d.tasks.push({
        description: "water fish",
        done: false,
      })
    })

    // Merge changes from both docs
    doc1 = automerge.merge(doc1, doc2)
    doc2 = automerge.merge(doc2, doc1)


    // return extension
    return {
      plugins: () => [
        
      ],
      baseKeys: () => {
        return [
          
        ];
      },
    };
  };
}
