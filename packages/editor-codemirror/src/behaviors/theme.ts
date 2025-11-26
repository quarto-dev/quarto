/*
 * theme.ts
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
import { Compartment } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";

import { EditorTheme, EditorUI, ThemeChangedEvent } from "editor";

import { Behavior, BehaviorContext } from ".";

import * as Style from "./themeHighlightStyle"
import { tags } from "@lezer/highlight"
import { codemirrorThemeSpec } from "./themeSpec";

const debugTheme = EditorView.theme({
  ".cm-line span": {
    position: "relative",
  },
  ".cm-line span:hover::after": {
    position: "absolute",
    bottom: "100%",
    left: 0,
    background: "black",
    color: "white",
    border: "solid 2px",
    borderRadius: "5px",
    content: "var(--tags)",
    width: `max-content`,
    padding: "1px 4px",
    zIndex: 10,
    pointerEvents: "none",
  },
});
const debugHighlightStyle = HighlightStyle.define(
  Object.entries(tags).map(([key, value]) => {
    return { tag: value, "--tags": `"tag.${key}"` };
  })
);
const debug = [debugTheme, syntaxHighlighting(debugHighlightStyle)];

export function themeBehavior(context: BehaviorContext): Behavior {

  const themeConf = new Compartment();

  const setTheme = async (cmView: EditorView) => {

    const editorTheme = context.pmContext.theme();
    const extensions = [
      debug,
      //codemirrorThemeSpec(editorTheme, context.options),
      //syntaxHighlighting(await codemirrorHighlightStyle(editorTheme, context.pmContext.ui))
    ];

    cmView.dispatch({
      effects: themeConf.reconfigure(extensions)
    });
  };

  let unsubscribe: VoidFunction;
  return {
    extensions: [themeConf.of([])],

    init: (_pmNode, cmView: EditorView) => {
      setTheme(cmView);
      unsubscribe = context.pmContext.events.subscribe(ThemeChangedEvent, () => {
        setTheme(cmView);
      })
    },

    cleanup: () => unsubscribe?.()
  }
}


// map vscode theme names to highlight themes
const vscodeThemes: Record<string, HighlightStyle> = {
  "Light (Visual Studio)": Style.light(),
  "Light+ (default light)": Style.lightPlus(),
  "Light+ V2 (Experimental)": Style.lightPlusV2(),
  "Quiet Light": Style.quietLight(),
  "Solarized Light": Style.solarizedLight(),
  "Abyss": Style.darkPlus(), // abyss(),
  "Dark (Visual Studio)": Style.dark(),
  "Dark+ (default dark)": Style.darkPlus(),
  "Dark+ V2 (Experimental)": Style.darkPlusV2(),
  "Kimbie Dark": Style.darkPlus(), // kimbieDark(),
  "Monokai Dimmed": Style.monokaiDimmed(),
  "Monokai": Style.monokai(),
  "Red": Style.red(),
  "Solarized Dark": Style.solarizedDark(),
  "Tomorrow Night Blue": Style.tomorrowNightBlue(),
  "Dark High Contrast": Style.highContrastDark(),
  "Light High Contrast": Style.highContrastLight(),
};


const highlightStyleHelper = (editorTheme: EditorTheme) => {
  // first use active vscode theme (if available)
  const vscodeTheme = document.body.getAttribute('data-vscode-theme-name');

  if (vscodeTheme) {
    const HighlightStyle = vscodeThemes[vscodeTheme];
    if (HighlightStyle) {
      return HighlightStyle;
    }
  }

  // otherwise use default logic
  if (editorTheme.solarizedMode) {
    return Style.solarizedLight();
  } else {
    return editorTheme.darkMode ? Style.vscodeDark() : Style.vscodeLight();
  }
}

async function codemirrorHighlightStyle(editorTheme: EditorTheme, ui: EditorUI) {
  const vscodeTheme = document.body.getAttribute('data-vscode-theme-name');

  const a = {
    // name: 'light',
    // dark: false,
    background: '#FFFFFF',
    foreground: '#000000',
    selection: '#ADD6FF',
    cursor: '#333333',
    dropdownBackground: '#FFFFFF',
    dropdownBorder: '#C8C8C8',
    activeLine: '#ADD6FF',
    matchingBracket: '#0064001a',
    keyword: '#0000ff',
    storage: '#0000ff',
    variable: '#0000ff',
    parameter: '#333333',
    function: '#795e26',
    string: '#a31515',
    constant: '#333333',
    type: '#267f99',
    class: '#267f99',
    number: '#098658',
    comment: '#008000',
    heading: '#800000',
    invalid: '#cd3131',
    regexp: '#811f3f',
  };
  const b: any = {}
  for (const [k, v] of Object.entries(a)) {
    b[v.toLowerCase()] = k
  }

  const tokenColorsLookup = {
    type: ['support.type'],
    class: ['support.class', "entity.name.class", "entity.name.type.class"],
    comment: ['comment'],
    heading: ['markup.heading'],
    invalid: ['invalid', "invalid.illegal", "invalid.broken", "invalid.deprecated", "invalid.unimplemented"],
    number: ['constant.numeric'],
    regexp: ['constant.regexp', "string.regexp"],
    string: ['string'],
    storage: ['storage'],
    keyword: ['keyword'],
    variable: ['variable.language', 'variable'],
    constant: ['constant.language', 'constant'],
    function: ['support.function', 'entity.name.function'],
    parameter: ['variable.parameter', 'variable.parameter.function', 'constant.language'], // not great
  }
  const colorsLookup = {
    foreground: ['editor.foreground'],
    background: ['editor.background'],
    dropdownBackground: ['editor.background'],
    selection: ['editor.selectionHighlightBackground', "editor.selectionBackground"],
    cursor: ["terminalCursor.foreground"],
    type: ["symbolIcon.typeParameterForeground"]
  }

  const themeData = await ui.display.getThemeData(vscodeTheme!)
  // const td = themeData.tokenColors
  // console.log('BEEBEEBEE data-vscode-theme-name', vscodeTheme)
  // const yahoo = Object.entries(td).map(([scope, { foreground }]: any) => ({
  //   scope,
  //   foreground,
  //   match: b[foreground?.toLowerCase()]
  // }))
  // const yahoo2 = groupBy(yahoo, ({ match }) => match);
  // console.log('YAHOO2!', yahoo2)
  // const baboo = groupBy(Object.entries(themeData.colors).map(([name, color]: any) => ({
  //   name,
  //   color,
  //   match: b[color?.toLowerCase()]
  // })), ({ match }) => match)
  // console.log('BABOOaaaa!', themeData.colors)

  const tt = highlightStyleHelper(editorTheme)

  const myColors = {
    ...a,
    ...deleteUndefineds(objValueMap(colorsLookup, (v: any) => first(v, (vv: any) => themeData.colors[vv]))),
    ...deleteUndefineds(objValueMap(tokenColorsLookup, (v: any) => first(v, (vv: any) => themeData.tokenColors[vv]?.foreground))),
  } as Style.CodeHighlightConfig
  Style.highlightStyleFromConfig(myColors)

  console.log('THEME DATA!!!', themeData)
  // TODO: separate scopes by period and use precedence
  // our assumption about space separation is also incorrect

  return Style.highlightStyleFromConfig(myColors)

}

const deleteUndefineds = (ob: { [k: string]: any }) => {
  const res: { [k: string]: any } = {}

  for (const [k, v] of Object.entries(ob)) {
    if (v) res[k] = v
  }
  return res
}

const first = (ar: any[], f: Function) => {
  for (const a of ar) {
    const fa = f(a)
    if (fa) return fa
  }
}

const objValueMap = (obj: Object, f: Function) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, f(v)]))


function groupBy(list: any[], f: (a: any) => any) {
  const map: { [k: string]: any } = {};

  list.forEach((item: any) => {
    const fitem = f(item)
    map[fitem] = [...(map[fitem] ?? []), item]
  });

  return map;
}
