/*
 * index.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Plugin, PluginKey } from "prosemirror-state";
import { Node as ProsemirrorNode } from "prosemirror-model";
import { EditorView, NodeView } from "prosemirror-view";

import { ExtensionFn, CodeViewOptions, BaseKey, codeViewArrowHandler, CodeEditorNodeViews } from "editor";

import { monacoNodeView } from "./nodeview";

import "./styles.css";

export const monacoPluginKey = new PluginKey("monaco");

export function monacoExtension(
  codeViews: { [key: string]: CodeViewOptions })
: ExtensionFn {
  return (context) => {

    // shared
    const codeNodeViews = new CodeEditorNodeViews();

    // build nodeViews
    const nodeTypes = Object.keys(codeViews);
    const nodeViews: {
      [name: string]: (
        node: ProsemirrorNode,
        view: EditorView,
        getPos: () => number | undefined
      ) => NodeView;
    } = {};
    nodeTypes.forEach((name) => {
      nodeViews[name] = monacoNodeView(context, codeViews[name], codeNodeViews);
    });

    // return plugin
    return {
      plugins: () => [
        new Plugin({
          key: monacoPluginKey,
          props: {
            nodeViews,
            handleDOMEvents: {
              click: codeNodeViews.handleClick.bind(codeNodeViews),
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
