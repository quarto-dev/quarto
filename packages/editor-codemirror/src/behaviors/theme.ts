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

import {tags as t} from "@lezer/highlight"

import { StyleSpec } from 'style-mod';

import { CodeViewOptions, EditorTheme, ThemeChangedEvent } from "editor";

import { Behavior, BehaviorContext } from ".";


export function themeBehavior(context: BehaviorContext) : Behavior {

  const themeConf = new Compartment();

  const setTheme = (cmView: EditorView) => {
    
    const editorTheme = context.pmContext.theme();
    const extensions = [
      codemirrorTheme(editorTheme, context.options), 
      syntaxHighlighting(codemirrorHighlightStyle(editorTheme))
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

function codemirrorTheme(editorTheme: EditorTheme, options: CodeViewOptions) {

  const styleSpec : { [selector: string]: StyleSpec} = {
    "&": {
      color: editorTheme.textColor,
      backgroundColor: options.classes?.includes('pm-chunk-background-color')  
        ? editorTheme.chunkBackgroundColor
        : editorTheme.backgroundColor,
      border: "none",
      fontSize: `${editorTheme.fixedWidthFontSizePt}pt`
    },

    "&.cm-editor.cm-focused": {
      outline: `1px solid ${editorTheme.focusOutlineColor}`
    },

    ".cm-content": {
      fontFamily: `${editorTheme.fixedWidthFont}`,
      caretColor: editorTheme.cursorColor
    },
  
    ".cm-cursor, .cm-dropCursor": {borderLeftColor: editorTheme.cursorColor},
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {backgroundColor: editorTheme.selectionColor},
  
    ".cm-panels": {backgroundColor: editorTheme.gutterBackgroundColor, color: editorTheme.gutterTextColor},
    ".cm-panels.cm-panels-top": {borderBottom: `2px solid ${editorTheme.paneBorderColor}`},
    ".cm-panels.cm-panels-bottom": {borderTop:`2px solid ${editorTheme.paneBorderColor}`},
  
    ".cm-searchMatch": {
      backgroundColor: editorTheme.findTextBackgroundColor,
      outline: `1px solid${editorTheme.findTextBorderColor}`
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: editorTheme.findTextBackgroundColor
    },
  
    ".cm-activeLine": {backgroundColor: editorTheme.backgroundColor},
    ".cm-selectionMatch": {backgroundColor: editorTheme.findTextBackgroundColor},
  
    "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
      backgroundColor: editorTheme.findTextBackgroundColor
    },
  
    ".cm-gutters": {
      backgroundColor: editorTheme.gutterBackgroundColor,
      color: editorTheme.gutterTextColor,
      border: "none",
      paddingRight: "6px",
      fontFamily: editorTheme.fixedWidthFont,
      fontSize: `${editorTheme.fixedWidthFontSizePt}pt`
    },
  
    ".cm-activeLineGutter": {
      backgroundColor: editorTheme.backgroundColor
    },
  
    ".cm-foldPlaceholder": {
      backgroundColor: "transparent",
      border: "none",
      color: editorTheme.lightTextColor
    },
  
    ".cm-tooltip": {
      border: "none",
      backgroundColor: editorTheme.backgroundColor
    },
    ".cm-tooltip .cm-tooltip-arrow:before": {
      borderTopColor: "transparent",
      borderBottomColor: "transparent"
    },
    ".cm-tooltip .cm-tooltip-arrow:after": {
      borderTopColor: editorTheme.paneBorderColor,
      borderBottomColor: editorTheme.paneBorderColor
    },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": {
        backgroundColor: editorTheme.spanBackgroundColor,
        color: editorTheme.textColor
      }
    }
  };

  if (options.firstLineMeta) {
    styleSpec[".cm-content .cm-line:first-of-type, .cm-content .cm-line:first-of-type span"] = {
      color: editorTheme.lightTextColor
    };
  }
  
  return EditorView.theme(styleSpec, {dark: editorTheme.darkMode});

}


function codemirrorHighlightStyle(editorTheme: EditorTheme) {

  if (editorTheme.solarizedMode) {
    return solarizedLightHighlightStyle();
  } else {
    const colors = editorTheme.darkMode ? vscodeDarkHighlightColors : vscodeLightHighlightColors;
    return  HighlightStyle.define([
      {tag: [t.operator, t.operatorKeyword, t.brace], color: colors.operator },
      {tag: [t.heading], color: colors.heading},
      {tag: [t.meta,t.comment], color: colors.comment},
      {tag: [t.keyword, t.moduleKeyword], color: colors.keyword},
      {tag: [t.number], color: colors.number},
      {tag: [t.regexp], color: colors.regexp},
      {tag: [t.definition(t.name)], colors: colors.definition},
      {tag: [t.invalid], color: colors.invalid},
      {tag: [t.string], color: colors.string},
      {tag: [t.bracket, t.angleBracket, t.squareBracket], color: colors.bracket},
      {tag: [t.function(t.variableName)], color: colors.function},
      {tag: [t.className], color: colors.className},
      {tag: [t.controlKeyword], color: colors.controlKeyword},
      {tag: [t.variableName], color: colors.variableName}
    ]);
  }
  
}


interface CodeMirrorHighlightColors {
  operator: string;
  heading: string;
  comment: string;
  keyword: string;
  number: string; // also constant
  regexp: string;
  definition: string;
  invalid: string;
  string: string;
  bracket: string;
  function: string;
  className: string;
  controlKeyword: string;
  variableName: string;
}


// vscode light
const vscodeLightHighlightColors: CodeMirrorHighlightColors = {
  operator: "#000000",
  heading: "#000080",
  comment: "#008000",
  keyword: "#0000ff",
  number: "#098658",
  regexp: "#811f3f",
  definition: "#001080",
  invalid: "#cd3131",
  string: "#a31515",
  bracket: "#000000",
  function: "#795e26",
  className: "#267f99",
  controlKeyword: "#af00db",
  variableName: "#0070c1"
}



// vscode dark
const vscodeDarkHighlightColors: CodeMirrorHighlightColors = {
  operator: "#d4d4d4",
  heading: "#000080",
  comment: "#6a9955",
  keyword: "#569cd6",
  number: "#b5cea8",
  regexp: "#646695",
  definition: "#9cdcfe",
  invalid: "#f44747",
  string: "#ce9178",
  bracket: "#808080",
  function: "#dcdcaa",
  className: "#4ec9b0",
  controlKeyword: "#c586c0",
  variableName: "#4fc1ff"
}


// solarized
function solarizedLightHighlightStyle() {
  const config = {
    name: 'solarizedLight',
    dark: false,
    background: '#fdf6e3',
    foreground: '#586e75',
    selection: '#eee8d5',
    cursor: '#657b83',
    dropdownBackground: '#fdf6e3',
    dropdownBorder: '#d3af86',
    activeLine: '#eee8d5',
    matchingBracket: '#eee8d5',
    keyword: '#859900',
    storage: '#073642',
    variable: '#657b83',
    parameter: '#657b83',
    function: '#268BD2',
    string: '#2AA198',
    constant: '#CB4B16',
    type: '#b58900',
    class: '#268BD2',
    number: '#D33682',
    comment: '#93A1A1',
    heading: '#268BD2',
    invalid: '#586e75',
    regexp: '#D30102',
  }
  return HighlightStyle.define([
    {tag: t.keyword, color: config.keyword},
    {tag: [t.name, t.deleted, t.character, t.macroName], color: config.variable},
    {tag: [t.propertyName], color: config.function},
    {tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: config.string},
    {tag: [t.function(t.variableName), t.labelName], color: config.function},
    {tag: [t.color, t.constant(t.name), t.standard(t.name)], color: config.constant},
    {tag: [t.definition(t.name), t.separator], color: config.variable},
    {tag: [t.className], color: config.class},
    {tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: config.number},
    {tag: [t.typeName], color: config.type, fontStyle: config.type},
    {tag: [t.operator, t.operatorKeyword], color: config.keyword},
    {tag: [t.url, t.escape, t.regexp, t.link], color: config.regexp},
    {tag: [t.meta, t.comment], color: config.comment},
    {tag: t.strong, fontWeight: 'bold'},
    {tag: t.emphasis, fontStyle: 'italic'},
    {tag: t.link, textDecoration: 'underline'},
    {tag: t.heading, fontWeight: 'bold', color: config.heading},
    {tag: [t.atom, t.bool, t.special(t.variableName)], color: config.variable},
    {tag: t.invalid, color: config.invalid},
    {tag: t.strikethrough, textDecoration: 'line-through'},
  ]);
}

