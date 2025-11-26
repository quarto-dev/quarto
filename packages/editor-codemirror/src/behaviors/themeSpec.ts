import { EditorView } from "@codemirror/view";
import { StyleSpec } from 'style-mod';
import { CodeViewOptions, EditorTheme } from "editor";

export function codemirrorThemeSpec(editorTheme: EditorTheme, options: CodeViewOptions) {

  const completion = { Margin: 30, Width: 250 };

  const styleSpec: { [selector: string]: StyleSpec } = {
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

    ".cm-cursor, .cm-dropCursor": { borderLeftColor: editorTheme.cursorColor },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": { backgroundColor: editorTheme.selectionColor },

    ".cm-panels": { backgroundColor: editorTheme.gutterBackgroundColor, color: editorTheme.gutterTextColor },
    ".cm-panels.cm-panels-top": { borderBottom: `2px solid ${editorTheme.paneBorderColor}` },
    ".cm-panels.cm-panels-bottom": { borderTop: `2px solid ${editorTheme.paneBorderColor}` },

    ".cm-searchMatch": {
      backgroundColor: editorTheme.findTextBackgroundColor,
      outline: `1px solid${editorTheme.findTextBorderColor}`
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: editorTheme.findTextBackgroundColor
    },

    ".cm-activeLine": { backgroundColor: editorTheme.backgroundColor },
    ".cm-selectionMatch": { backgroundColor: editorTheme.findTextBackgroundColor },

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
    // autocomplete (https://github.com/codemirror/autocomplete/blob/main/src/theme.ts)

    ".cm-tooltip.cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: editorTheme.fixedWidthFont,
        fontSize: `${editorTheme.fixedWidthFontSizePt}pt`,
        whiteSpace: "nowrap",
        overflow: "hidden auto",
        maxWidth_fallback: "700px",
        maxWidth: "min(700px, 95vw)",
        minWidth: "250px",
        maxHeight: "212px",
        height: "100%",
        listStyle: "none",
        margin: 0,
        padding: 3,
        color: editorTheme.suggestWidgetForegroundColor,
        backgroundColor: editorTheme.suggestWidgetBackgroundColor,
        border: `1px solid ${editorTheme.suggestWidgetBorderColor}`,

        "& > li": {
          overflowX: "hidden",
          textOverflow: "ellipsis",
          cursor: "pointer",
          padding: "2px 2px",
          lineHeight: 1.15,
          display: "flex",
          alignItems: "center"
        },
      }
    },

    "& .cm-tooltip-autocomplete ul li[aria-selected]": {
      background: editorTheme.suggestWidgetSelectedBackgroundColor,
      color: editorTheme.suggestWidgetSelectedForegroundColor,
    },

    "& .cm-tooltip-autocomplete-disabled ul li[aria-selected]": {
      background: editorTheme.suggestWidgetSelectedBackgroundColor,
    },

    ".cm-completionListIncompleteTop:before, .cm-completionListIncompleteBottom:after": {
      content: '"···"',
      opacity: 0.5,
      display: "block",
      textAlign: "center"
    },

    ".cm-tooltip.cm-completionInfo": {
      position: "absolute",
      padding: "3px 9px",
      width: "max-content",
      maxWidth: `${completion.Width}px`,
      boxSizing: "border-box",
      color: editorTheme.suggestWidgetForegroundColor,
      backgroundColor: editorTheme.suggestWidgetBackgroundColor,
      border: `1px solid ${editorTheme.suggestWidgetBorderColor}`
    },
    ".cm-tooltip.cm-completionInfo .cm-completionInfoHeader": {
      fontFamily: editorTheme.fixedWidthFont
    },
    // links don't work so change hteir appearance
    ".cm-tooltip.cm-completionInfo a": {
      color: editorTheme.suggestWidgetForegroundColor,
    },
    ".cm-tooltip.cm-completionInfo a:hover": {
      textDecoration: "none",
    },
    ".cm-tooltip.cm-completionInfo p": {
      margin: 0,
      padding: 0
    },
    ".cm-tooltip.cm-completionInfo p.cm-completionInfoHeader": {
      marginBottom: "1em"
    },

    ".cm-completionInfo.cm-completionInfo-left": { right: "100%" },
    ".cm-completionInfo.cm-completionInfo-right": { left: "100%" },
    ".cm-completionInfo.cm-completionInfo-left-narrow": { right: `${completion.Margin}px` },
    ".cm-completionInfo.cm-completionInfo-right-narrow": { left: `${completion.Margin}px` },

    "& .cm-snippetField": { backgroundColor: editorTheme.invisibleTextColor },
    ".cm-snippetFieldPosition": {
      verticalAlign: "text-top",
      width: 0,
      height: "1.15em",
      display: "inline-block",
      margin: "0 -0.7px -.7em",
      borderLeft: `1.4px dotted ${editorTheme.gutterBackgroundColor}`
    },

    ".cm-completionMatchedText": {
      textDecoration: "none",
      color: editorTheme.suggestWidgetFocusHighlightForegroundColor
    },

    ".cm-completionDetail": {
      marginLeft: "0.5em",
      color: editorTheme.lightTextColor,
      float: "right",
      fontStyle: "normal"
    },

    "& .cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail": {
      color: editorTheme.suggestWidgetSelectedForegroundColor,
    },

    ".cm-completionIcon": {
      fontFamily: "codicon",
      fontSize: `${editorTheme.fixedWidthFontSizePt + 2}pt`,
      display: "inline-block",
      width: "1em",
      textAlign: "center",
      paddingLeft: ".1em",
      paddingRight: ".3em",
      opacity: "0.8",
      boxSizing: "content-box"
    },

    ".cm-completionIcon-function, .cm-completionIcon-method": {
      "&:after": { content: "'\\eb5f'" },
      color: editorTheme.symbolIconFunctionForegroundColor
    },
    ".cm-completionIcon-class": {
      "&:after": { content: "'\\eb5b'" },
      "color": editorTheme.symbolIconClassForegroundColor,
    },
    ".cm-completionIcon-interface": {
      "&:after": { content: "'\\eb61'" },
      color: editorTheme.symbolIconInterfaceForegroundColor
    },
    ".cm-completionIcon-variable": {
      "&:after": { content: "'\\ea88'" },
      color: editorTheme.symbolIconVariableForegroundColor
    },
    ".cm-completionIcon-constant": {
      "&:after": { content: "'\\eb5d'" },
      color: editorTheme.symbolIconConstantForegroundColor
    },
    ".cm-completionIcon-type": {
      "&:after": { content: "'\\ea92'" },
      color: editorTheme.symbolIconTypeParameterForegroundColor
    },
    ".cm-completionIcon-enum": {
      "&:after": { content: "'\\ea95'" },
      color: editorTheme.symbolIconEnumForegroundColor
    },
    ".cm-completionIcon-property": {
      "&:after": { content: "'\\eb65'" },
      color: editorTheme.symbolIconPropertyForegroundColor
    },
    ".cm-completionIcon-keyword": {
      "&:after": { content: "'\\eb62'" },
      color: editorTheme.symbolIconKeywordForegroundColor
    },
    ".cm-completionIcon-namespace": {
      "&:after": { content: "'\\ea8b'" },
      color: editorTheme.symbolIconNamespaceForegroundColor
    },
    ".cm-completionIcon-text": {
      "&:after": { content: "'\\ea93'" },
      color: editorTheme.symbolIconTextForegroundColor
    },


    "& .cm-tooltip-autocomplete ul li[aria-selected] .cm-completionIcon": {
      color: editorTheme.suggestWidgetSelectedIconForegroundColor,
    },

  };

  if (options.firstLineMeta) {
    styleSpec[".cm-content .cm-line:first-of-type, .cm-content .cm-line:first-of-type span"] = {
      color: editorTheme.lightTextColor
    };
  }

  return EditorView.theme(styleSpec, { dark: editorTheme.darkMode });
}
