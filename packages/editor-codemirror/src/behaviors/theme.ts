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
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";

import { Behavior, BehaviorContext } from ".";
import { Compartment } from "@codemirror/state";
import { CodeViewOptions, EditorTheme, ThemeChangedEvent } from "editor";

export function themeBehavior(context: BehaviorContext) : Behavior {


  const themeConf = new Compartment();

  const setTheme = (cmView: EditorView) => {
    
    const editorTheme = context.pmContext.theme();
    const extensions = [
      codemirrorTheme(editorTheme, context.options), 
      syntaxHighlighting(editorTheme.darkMode ? oneDarkHighlightStyle : defaultHighlightStyle)
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


// https://github.com/codemirror/theme-one-dark/blob/main/src/one-dark.ts

function codemirrorTheme(editorTheme: EditorTheme, options: CodeViewOptions) {

  return EditorView.theme({
    "&": {
      color: editorTheme.textColor,
      backgroundColor: options.classes?.includes('pm-chunk-background-color')  
        ? editorTheme.chunkBackgroundColor
        : editorTheme.backgroundColor,
      borderColor: `${editorTheme.blockBorderColor}`,
      fontSize: `${editorTheme.fixedWidthFontSizePt}pt`
    },

    "&.cm-editor.cm-focused": {
      outline: "none"
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
      border: editorTheme.paneBorderColor,
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
  }, {dark: editorTheme.darkMode})


}
