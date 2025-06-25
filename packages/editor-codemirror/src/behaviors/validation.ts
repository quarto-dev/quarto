/*
 * yamloption.ts
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
import { EditorView } from "@codemirror/view";
import { Node } from "prosemirror-model";
import { Behavior, BehaviorContext } from ".";

import { Decoration, DecorationSet } from "@codemirror/view"
import { StateField, StateEffect } from "@codemirror/state"
import { hoverTooltip } from "@codemirror/view"

import * as m from "@quarto/_mapped-string"
import * as v from "@quarto/_json-validator"
import * as j from "@quarto/_annotated-json"

export function validationBehavior(context: BehaviorContext): Behavior {
  return {
    extensions: [validationErrorHoverTooltip],

    init(pmNode, cmView) {
      applyValidation(pmNode, cmView)
    },
    pmUpdate(pmNode, updatePmNode, cmView) {
      // TODO: remove old validation decorations!
      //applyValidation(updatePmNode, cmView)
    }
  }
}

//Check if there is an underline at position and display a tooltip there
//We want to show the error message as well
const validationErrorHoverTooltip = hoverTooltip((view, pos) => {
  const f = view.state.field(underlineField, false)
  if (!f) return null

  const rangeAndSpec = rangeAndSpecOfDecorationAtPos(pos, f)
  if (!rangeAndSpec) return null
  const { range: { from, to }, spec } = rangeAndSpec

  return {
    pos: from,
    end: to,
    above: true,
    create() {
      let dom = document.createElement("div")
      Object.assign(dom.style, {
        "box-shadow": 'rgba(0, 0, 0, 0.16) 0px 0px 8px 2px',
        border: '1px solid lightgrey'
      })
      dom.innerHTML = spec.message
      return { dom }
    }
  }
})

const schema3 = {
  "$id": "title-is-string",
  "type": "object",
  "properties": {
    "title": {
      "type": "string"
    }
  }
} as v.Schema

// We use a heuristic to check if the
// codeblock is yaml frontmatter, if it is then we validate the yaml and add
// error underline decoration with an attached error message that is displayed
// on hover via `validationErrorHoverTooltip`.
const applyValidation = (pmNode: Node, cmView: EditorView) => {
  const t = pmNode.textContent.trim()
  if (t.startsWith('---')) {
    const [_, extractedYamlString] = t.split('---')
    const ttYamlString = m.asMappedString(extractedYamlString)
    const ttAnnotation = j.parse(ttYamlString)

    v.withValidator(schema3, async (validator) => {
      const result = await validator.validateParse(ttYamlString, ttAnnotation);
      console.log('validator result on extractedYamlString:', result);
      for (const error of result.errors)
        underline(cmView,
          error.violatingObject.start + 3,
          error.violatingObject.end + 3,
          '<div style="padding: 4px 11px; font-family: monospace;"><span style="color: red; font-size: 24px; vertical-align: text-bottom;">⚠︎</span> ' +
          error.niceError.heading +
          '</div><div style="border-bottom: 1px solid lightgrey; width: 100%;"></div><div style="color:darkgrey; padding: 4px 11px">' +
          error.niceError.error.join('\n') +
          '</div>'
        )
    });
  }
}


const addUnderline = StateEffect.define<{ from: number, to: number, message: string }>({
  map: ({ from, to, message }, change) => ({ from: change.mapPos(from), to: change.mapPos(to), message })
})
const underlineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes)
    for (let e of tr.effects) if (e.is(addUnderline)) {
      underlines = underlines.update({
        add: [Decoration.mark({ class: "cm-underline", message: e.value.message }).range(e.value.from, e.value.to)]
      })
    }
    return underlines
  },
  provide: f => EditorView.decorations.from(f)
})

const underlineTheme = EditorView.baseTheme({
  ".cm-underline": {
    textDecoration: "underline dotted 2px red",
  }
})
const underline = (cmView: EditorView, from: number, to: number, message: string) => {
  const effects: StateEffect<unknown>[] = [addUnderline.of({ from, to, message })]
  if (!cmView.state.field(underlineField, false))
    effects.push(StateEffect.appendConfig.of([underlineField, underlineTheme]))
  cmView.dispatch({ effects })
}

// helper function for positionally picking data from a DecorationSet
const rangeAndSpecOfDecorationAtPos = (pos: number, d: DecorationSet) => {
  let spec: any | undefined
  let from: number | undefined
  let to: number | undefined
  d.between(pos, pos, (decoFrom, decoTo, deco) => {
    if (decoFrom <= pos && pos < decoTo) {
      spec = deco.spec
      from = decoFrom
      to = decoTo
      return false
    }
    return undefined
  })
  return spec !== undefined ? { range: { from: from!, to: to! }, spec } : undefined
}
