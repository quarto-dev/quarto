/*
 * index.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { Node as ProsemirrorNode } from 'prosemirror-model';
import { EditorView as PMEditorView } from "prosemirror-view";

import { CodeViewOptions, ExtensionContext } from "editor";

import { monaco } from "../monaco";

import { langModeBehavior } from './langmode';
import { keyboardBehavior } from './keyboard';
import { findBehavior } from './find';
import { trackSelectionBehavior } from './trackselection';
import { themeBehavior } from './theme';
import { prefsBehavior } from './prefs';
import { yamlOptionBehavior } from './yamloption';
import { toolbarBehavior } from './toolbar';
import { diagramBehavior } from './diagram';
import { completionBehavior } from './completion';
import { diagnosticsBehavior } from './diagnostics';
import { firstLineMetaBehavior } from './firstlinemeta';

export type CodeEditor = monaco.editor.IStandaloneCodeEditor;
export type ContentChangedEvent = monaco.editor.IModelContentChangedEvent;

export interface Behavior {
  // options merged into the editor construction options
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  // called once the editor has been created
  init?: (pmNode: ProsemirrorNode, editor: CodeEditor) => void;
  // called when the monaco model changes (both user and prosemirror initiated)
  contentChanged?: (ev: ContentChangedEvent, editor: CodeEditor, pmNode: ProsemirrorNode) => void;
  // called when the prosemirror node is updated
  pmUpdate?: (prevNode: ProsemirrorNode, updateNode: ProsemirrorNode, editor: CodeEditor) => void;
  cleanup?: VoidFunction;
}

export interface BehaviorContext {
  dom: HTMLElement;
  view: PMEditorView;
  getPos: () => number | undefined;
  options: CodeViewOptions;
  pmContext: ExtensionContext;
  withState: WithState;
}

export enum State { Updating, Escaping }
export type WithState = (state: State, fn: () => void) => void;

export function createBehaviors(context: BehaviorContext): Behavior[] {
  return [
    langModeBehavior(context),
    completionBehavior(context),
    findBehavior(context),
    themeBehavior(context),
    prefsBehavior(context),
    trackSelectionBehavior(context),
    yamlOptionBehavior(context),
    toolbarBehavior(context),
    diagramBehavior(context),
    diagnosticsBehavior(context),
    firstLineMetaBehavior(context),
    keyboardBehavior(context)
  ];
}

export function behaviorOptions(behaviors: Behavior[]): monaco.editor.IStandaloneEditorConstructionOptions {
  return behaviors.reduce<monaco.editor.IStandaloneEditorConstructionOptions>(
    (options, behavior) => ({ ...options, ...(behavior.options || {}) }), {}
  );
}

export function behaviorInit(behaviors: Behavior[], pmNode: ProsemirrorNode, editor: CodeEditor) {
  behaviors.forEach(behavior => behavior.init?.(pmNode, editor));
}

export function behaviorContentChanged(
  behaviors: Behavior[], ev: ContentChangedEvent, editor: CodeEditor, pmNode: ProsemirrorNode
) {
  behaviors.forEach(behavior => behavior.contentChanged?.(ev, editor, pmNode));
}

export function behaviorPmUpdate(
  behaviors: Behavior[], prevNode: ProsemirrorNode, updateNode: ProsemirrorNode, editor: CodeEditor
) {
  behaviors.forEach(behavior => behavior.pmUpdate?.(prevNode, updateNode, editor));
}

export function behaviorCleanup(behaviors: Behavior[]) {
  behaviors.forEach(behavior => behavior.cleanup?.());
}
