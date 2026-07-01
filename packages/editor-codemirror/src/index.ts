/*
 * index.ts
 *
 * Copyright (C) 2022 by Emergence Engineering (ISC License)
 * https://gitlab.com/emergence-engineering/prosemirror-codemirror-block
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";

import { ExtensionFn, CodeViewOptions, BaseKey, codeViewArrowHandler, CodeEditorNodeViews } from "editor";

import { codeMirrorNodeView } from "./nodeview";

export const codeMirrorPluginKey = new PluginKey("codemirror");

import "./styles.css"

export function codeMirrorExtension(
  codeViews: { [key: string]: CodeViewOptions })
: ExtensionFn {
  return (context) => {

    // shared
    const codeMirrorNodeViews = new CodeEditorNodeViews();

    // build nodeViews
    const nodeTypes = Object.keys(codeViews);
    const nodeViews: {
      [name: string]: (
        node: ProsemirrorNode,
        view: EditorView,
        getPos: boolean | (() => number)
      ) => NodeView;
    } = {};
    nodeTypes.forEach((name) => {
      nodeViews[name] = codeMirrorNodeView(context, codeViews[name], codeMirrorNodeViews);
    });

    // return plugin
    return {
      plugins: () => [
        new Plugin({
          key: codeMirrorPluginKey,
          props: {
            nodeViews,
            handleDOMEvents: {
              click: codeMirrorNodeViews.handleClick.bind(codeMirrorNodeViews),
            },
          },
        }),
      ],
      baseKeys: () => {
        return [
          { key: BaseKey.ArrowLeft, command: codeViewArrowHandler('left', nodeTypes) },
          { key: BaseKey.ArrowRight, command: codeViewArrowHandler('right', nodeTypes) },
          { key: BaseKey.ArrowUp, command: codeViewArrowHandler('up', nodeTypes) },
          { key: BaseKey.ArrowDown, command: codeViewArrowHandler('down', nodeTypes) }
        ];
      },
    };
  };
}
