/*
 * completion.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016 James Yu
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

import { Position } from "vscode-languageserver-textdocument";

import {
  CancellationToken,
  CompletionContext,
  CompletionItem,
  CompletionTriggerKind
} from "vscode-languageserver";
import { Quarto } from "../../quarto";
import { attrCompletions } from "./completion-attrs";
import { latexCompletions } from "./completion-latex";
import { yamlCompletions } from "./completion-yaml";
import { refsCompletions } from "./refs/completion-refs";
import { LsConfiguration } from "../../config";
import { IWorkspace } from "../../workspace";
import { IMdParser } from "../../parser";
import { MdLinkProvider } from "../document-links";
import { MdTableOfContentsProvider } from "../../toc";
import { ITextDocument } from "../../document";
import { MdPathCompletionProvider } from "./completion-path";
import { docEditorContext } from "../../quarto";

/**
 * Control the type of path completions returned.
 */
export interface PathCompletionOptions {
	/**
	 * Should header completions for other files in the workspace be returned when
	 * you trigger completions.
	 * 
	 * Defaults to {@link IncludeWorkspaceHeaderCompletions.never never} (not returned).
	 */
	readonly includeWorkspaceHeaderCompletions?: IncludeWorkspaceHeaderCompletions;
}


/**
 * Controls if header completions for other files in the workspace be returned.
 */
export enum IncludeWorkspaceHeaderCompletions {
	/**
	 * Never return workspace header completions.
	 */
	never = 'never',

	/**
	 * Return workspace header completions after `##` is typed.
	 * 
	 * This lets the user signal 
	 */
	onDoubleHash = 'onDoubleHash',

	/**
	 * Return workspace header completions after either a single `#` is typed or after `##`
	 * 
	 * For a single hash, this means the workspace header completions will be returned along side the current file header completions.
	 */
	onSingleOrDoubleHash = 'onSingleOrDoubleHash',
}

export class MdCompletionProvider {

  readonly pathCompletionProvider_: MdPathCompletionProvider;

  readonly quarto_: Quarto;

	constructor(
		configuration: LsConfiguration,
    quarto: Quarto,
		workspace: IWorkspace,
		parser: IMdParser,
		linkProvider: MdLinkProvider,
		tocProvider: MdTableOfContentsProvider,
	) {
    this.quarto_ = quarto;
    this.pathCompletionProvider_ = new MdPathCompletionProvider(
      configuration, 
      workspace, 
      parser, 
      linkProvider, 
      tocProvider
    );
	}

	public async provideCompletionItems(
    doc: ITextDocument, 
    pos: Position, 
    context: CompletionContext, 
    config: LsConfiguration,
    token: CancellationToken,
  ): Promise<CompletionItem[]> {
    const explicit = context.triggerKind === CompletionTriggerKind.TriggerCharacter;
    const trigger = context.triggerCharacter;
    const editorContext = docEditorContext(doc, pos, explicit, trigger);
    return (
      (await refsCompletions(this.quarto_, doc, pos, editorContext)) ||
      (await attrCompletions(this.quarto_, editorContext)) ||
      (await latexCompletions(doc, pos, context, config)) ||
      (await yamlCompletions(this.quarto_, editorContext, true)) ||
      (await this.pathCompletionProvider_.provideCompletionItems(doc, pos, context, token)) ||
      []
    );
	}
}
