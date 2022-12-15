/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import * as nls from "vscode-nls";

import {
  getUriForLinkWithKnownExternalScheme,
  isImageLink,
  isOfScheme,
} from "../core/links";
import { dirname, extname } from "../core/path";
import { isQuartoDoc } from "../core/doc";
import { Command } from "../core/command";

import { MarkdownEngine } from "../markdown/engine";
import { MarkdownTableOfContents } from "../markdown/toc";
import { Schemes } from "../core/schemes";

const localize = nls.loadMessageBundle();

export default class QuartoLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private readonly engine: MarkdownEngine) {}

  public async provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.DocumentLink[]> {
    const text = document.getText();
    return [
      ...(await this.providerInlineLinks(text, document)),
      ...this.provideReferenceLinks(text, document),
    ];
  }

  private async providerInlineLinks(
    text: string,
    document: vscode.TextDocument
  ): Promise<vscode.DocumentLink[]> {
    const results: vscode.DocumentLink[] = [];
    const codeInDocument = await findCode(document, this.engine);
    for (const match of text.matchAll(linkPattern)) {
      const matchImage =
        match[4] &&
        extractDocumentLink(
          document,
          match[3].length + 1,
          match[4],
          match.index
        );
      if (matchImage && !isLinkInsideCode(codeInDocument, matchImage)) {
        results.push(matchImage);
      }
      const matchLink = extractDocumentLink(
        document,
        match[1].length,
        match[5],
        match.index
      );
      if (matchLink && !isLinkInsideCode(codeInDocument, matchLink)) {
        results.push(matchLink);
      }
    }
    return results;
  }

  private provideReferenceLinks(
    text: string,
    document: vscode.TextDocument
  ): vscode.DocumentLink[] {
    const results: vscode.DocumentLink[] = [];

    const definitions = QuartoLinkProvider.getDefinitions(text, document);
    for (const match of text.matchAll(referenceLinkPattern)) {
      let linkStart: vscode.Position;
      let linkEnd: vscode.Position;
      let reference = match[3];
      if (reference) {
        // [text][ref]
        const pre = match[1];
        const offset = (match.index || 0) + pre.length;
        linkStart = document.positionAt(offset);
        linkEnd = document.positionAt(offset + reference.length);
      } else if (match[2]) {
        // [ref][]
        reference = match[2];
        const offset = (match.index || 0) + 1;
        linkStart = document.positionAt(offset);
        linkEnd = document.positionAt(offset + match[2].length);
      } else {
        continue;
      }

      try {
        const link = definitions.get(reference);
        if (link) {
          results.push(
            new vscode.DocumentLink(
              new vscode.Range(linkStart, linkEnd),
              vscode.Uri.parse(
                `command:_markdown.moveCursorToPosition?${encodeURIComponent(
                  JSON.stringify([
                    link.linkRange.start.line,
                    link.linkRange.start.character,
                  ])
                )}`
              )
            )
          );
        }
      } catch (e) {
        // noop
      }
    }

    for (const definition of definitions.values()) {
      try {
        const linkData = parseLink(document, definition.link);
        if (linkData) {
          results.push(
            new vscode.DocumentLink(definition.linkRange, linkData.uri)
          );
        }
      } catch (e) {
        // noop
      }
    }

    return results;
  }

  public static getDefinitions(text: string, document: vscode.TextDocument) {
    const out = new Map<string, { link: string; linkRange: vscode.Range }>();
    for (const match of text.matchAll(definitionPattern)) {
      const pre = match[1];
      const reference = match[2];
      const link = match[3].trim();
      const offset = (match.index || 0) + pre.length;

      if (angleBracketLinkRe.test(link)) {
        const linkStart = document.positionAt(offset + 1);
        const linkEnd = document.positionAt(offset + link.length - 1);
        out.set(reference, {
          link: link.substring(1, link.length - 1),
          linkRange: new vscode.Range(linkStart, linkEnd),
        });
      } else {
        const linkStart = document.positionAt(offset);
        const linkEnd = document.positionAt(offset + link.length);
        out.set(reference, {
          link: link,
          linkRange: new vscode.Range(linkStart, linkEnd),
        });
      }
    }
    return out;
  }
}

export class OpenLinkCommand implements Command {
  private static readonly id = "_quarto.openLink";
  public readonly id = OpenLinkCommand.id;

  public static createCommandUri(
    fromResource: vscode.Uri,
    path: vscode.Uri,
    fragment: string
  ): vscode.Uri {
    const toJson = (uri: vscode.Uri): UriComponents => {
      return {
        scheme: uri.scheme,
        authority: uri.authority,
        path: uri.path,
        fragment: uri.fragment,
        query: uri.query,
      };
    };
    return vscode.Uri.parse(
      `command:${OpenLinkCommand.id}?${encodeURIComponent(
        JSON.stringify(<OpenLinkArgs>{
          parts: toJson(path),
          fragment,
          fromResource: toJson(fromResource),
        })
      )}`
    );
  }

  public constructor(private readonly engine: MarkdownEngine) {}

  public async execute(args: OpenLinkArgs) {
    const fromResource = vscode.Uri.parse("").with(args.fromResource);
    const targetResource = reviveUri(args.parts).with({
      fragment: args.fragment,
    });
    return openDocumentLink(this.engine, targetResource, fromResource);
  }
}

function parseLink(
  document: vscode.TextDocument,
  link: string
): { uri: vscode.Uri; tooltip?: string } | undefined {
  const cleanLink = stripAngleBrackets(link);
  const externalSchemeUri = getUriForLinkWithKnownExternalScheme(cleanLink);
  if (externalSchemeUri) {
    // Normalize VS Code links to target currently running version
    if (
      isOfScheme(Schemes.vscode, link) ||
      isOfScheme(Schemes["vscode-insiders"], link)
    ) {
      return {
        uri: vscode.Uri.parse(link).with({ scheme: vscode.env.uriScheme }),
      };
    }
    return { uri: externalSchemeUri };
  }

  // Assume it must be an relative or absolute file path
  // Use a fake scheme to avoid parse warnings
  const tempUri = vscode.Uri.parse(`vscode-resource:${link}`);

  let resourceUri: vscode.Uri | undefined;
  if (!tempUri.path) {
    resourceUri = document.uri;
  } else if (tempUri.path[0] === "/") {
    const root = getWorkspaceFolder(document);
    if (root) {
      resourceUri = vscode.Uri.joinPath(root, tempUri.path);
    }
  } else {
    if (document.uri.scheme === Schemes.untitled) {
      const root = getWorkspaceFolder(document);
      if (root) {
        resourceUri = vscode.Uri.joinPath(root, tempUri.path);
      }
    } else {
      const base = document.uri.with({ path: dirname(document.uri.fsPath) });
      resourceUri = vscode.Uri.joinPath(base, tempUri.path);
    }
  }

  if (!resourceUri) {
    return undefined;
  }

  // don't show for images (interferes w/ hover)
  if (isImageLink(resourceUri.fsPath)) {
    return undefined;
  }

  resourceUri = resourceUri.with({ fragment: tempUri.fragment });

  return {
    uri: OpenLinkCommand.createCommandUri(
      document.uri,
      resourceUri,
      tempUri.fragment
    ),
    tooltip: localize("documentLink.tooltip", "Follow link"),
  };
}

function getWorkspaceFolder(document: vscode.TextDocument) {
  return (
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri ||
    vscode.workspace.workspaceFolders?.[0]?.uri
  );
}

function extractDocumentLink(
  document: vscode.TextDocument,
  pre: number,
  link: string,
  matchIndex: number | undefined
): vscode.DocumentLink | undefined {
  const offset = (matchIndex || 0) + pre;
  const linkStart = document.positionAt(offset);
  const linkEnd = document.positionAt(offset + link.length);
  try {
    const linkData = parseLink(document, link);
    if (!linkData) {
      return undefined;
    }
    const documentLink = new vscode.DocumentLink(
      new vscode.Range(linkStart, linkEnd),
      linkData.uri
    );
    documentLink.tooltip = linkData.tooltip;
    return documentLink;
  } catch (e) {
    return undefined;
  }
}

const angleBracketLinkRe = /^<(.*)>$/;

/**
 * Used to strip brackets from the markdown link
 *
 * <http://example.com> will be transformed to http://example.com
 */
export function stripAngleBrackets(link: string) {
  return link.replace(angleBracketLinkRe, "$1");
}

const linkPattern =
  /(\[((!\[[^\]]*?\]\(\s*)([^\s\(\)]+?)\s*\)\]|(?:\\\]|[^\]])*\])\(\s*)(([^\s\(\)]|\([^\s\(\)]*?\))+)\s*(".*?")?\)/g;
const referenceLinkPattern = /(\[((?:\\\]|[^\]])+)\]\[\s*?)([^\s\]]*?)\]/g;
const definitionPattern =
  /^([\t ]*\[(?!\^)((?:\\\]|[^\]])+)\]:\s*)([^<]\S*|<[^>]+>)/gm;
const inlineCodePattern =
  /(?:^|[^`])(`+)(?:.+?|.*?(?:(?:\r?\n).+?)*?)(?:\r?\n)?\1(?:$|[^`])/gm;

interface CodeInDocument {
  /**
   * code blocks and fences each represented by [line_start,line_end).
   */
  readonly multiline: ReadonlyArray<[number, number]>;

  /**
   * inline code spans each represented by {@link vscode.Range}.
   */
  readonly inline: readonly vscode.Range[];
}

async function findCode(
  document: vscode.TextDocument,
  engine: MarkdownEngine
): Promise<CodeInDocument> {
  const tokens = await engine.parse(document);
  const multiline = tokens
    .filter((t) => (t.type === "code_block" || t.type === "fence") && !!t.map)
    .map((t) => t.map) as [number, number][];

  const text = document.getText();
  const inline = [...text.matchAll(inlineCodePattern)].map((match) => {
    const start = match.index || 0;
    return new vscode.Range(
      document.positionAt(start),
      document.positionAt(start + match[0].length)
    );
  });

  return { multiline, inline };
}

function isLinkInsideCode(code: CodeInDocument, link: vscode.DocumentLink) {
  return (
    code.multiline.some(
      (interval) =>
        link.range.start.line >= interval[0] &&
        link.range.start.line < interval[1]
    ) || code.inline.some((position) => position.intersection(link.range))
  );
}

function reviveUri(parts: any) {
  if (parts.scheme === "file") {
    return vscode.Uri.file(parts.path);
  }
  return vscode.Uri.parse("").with(parts);
}

type UriComponents = {
  readonly scheme?: string;
  readonly path: string;
  readonly fragment?: string;
  readonly authority?: string;
  readonly query?: string;
};

interface OpenLinkArgs {
  readonly parts: UriComponents;
  readonly fragment: string;
  readonly fromResource: UriComponents;
}

enum OpenMarkdownLinks {
  beside = "beside",
  currentGroup = "currentGroup",
}

export async function openDocumentLink(
  engine: MarkdownEngine,
  targetResource: vscode.Uri,
  fromResource: vscode.Uri
): Promise<void> {
  const column = getViewColumn(fromResource);

  if (await tryNavigateToFragmentInActiveEditor(engine, targetResource)) {
    return;
  }

  let targetResourceStat: vscode.FileStat | undefined;
  try {
    targetResourceStat = await vscode.workspace.fs.stat(targetResource);
  } catch {
    // noop
  }

  if (typeof targetResourceStat === "undefined") {
    // We don't think the file exists. If it doesn't already have an extension, try tacking on a `.qmd` and using that instead
    if (extname(targetResource.path) === "") {
      const dotMdResource = targetResource.with({
        path: targetResource.path + ".md",
      });
      try {
        const stat = await vscode.workspace.fs.stat(dotMdResource);
        if (stat.type === vscode.FileType.File) {
          await tryOpenMdFile(engine, dotMdResource, column);
          return;
        }
      } catch {
        // noop
      }
    }
  } else if (targetResourceStat.type === vscode.FileType.Directory) {
    return vscode.commands.executeCommand("revealInExplorer", targetResource);
  }

  await tryOpenMdFile(engine, targetResource, column);
}

async function tryOpenMdFile(
  engine: MarkdownEngine,
  resource: vscode.Uri,
  column: vscode.ViewColumn
): Promise<boolean> {
  await vscode.commands.executeCommand(
    "vscode.open",
    resource.with({ fragment: "" }),
    column
  );
  return tryNavigateToFragmentInActiveEditor(engine, resource);
}

async function tryNavigateToFragmentInActiveEditor(
  engine: MarkdownEngine,
  resource: vscode.Uri
): Promise<boolean> {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document.uri.fsPath === resource.fsPath) {
    if (isQuartoDoc(activeEditor.document)) {
      if (
        await tryRevealLineUsingTocFragment(
          engine,
          activeEditor,
          resource.fragment
        )
      ) {
        return true;
      }
    }
    tryRevealLineUsingLineFragment(activeEditor, resource.fragment);
    return true;
  }
  return false;
}

function getViewColumn(resource: vscode.Uri): vscode.ViewColumn {
  const config = vscode.workspace.getConfiguration("markdown", resource);
  const openLinks = config.get<OpenMarkdownLinks>(
    "links.openLocation",
    OpenMarkdownLinks.currentGroup
  );
  switch (openLinks) {
    case OpenMarkdownLinks.beside:
      return vscode.ViewColumn.Beside;
    case OpenMarkdownLinks.currentGroup:
    default:
      return vscode.ViewColumn.Active;
  }
}

async function tryRevealLineUsingTocFragment(
  engine: MarkdownEngine,
  editor: vscode.TextEditor,
  fragment: string
): Promise<boolean> {
  const toc = await MarkdownTableOfContents.create(engine, editor.document);
  const entry = toc.lookup(fragment);
  if (entry) {
    const lineStart = new vscode.Range(entry.line, 0, entry.line, 0);
    editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
    editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
    return true;
  }
  return false;
}

function tryRevealLineUsingLineFragment(
  editor: vscode.TextEditor,
  fragment: string
): boolean {
  const lineNumberFragment = fragment.match(/^L(\d+)$/i);
  if (lineNumberFragment) {
    const line = +lineNumberFragment[1] - 1;
    if (!isNaN(line)) {
      const lineStart = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(lineStart.start, lineStart.end);
      editor.revealRange(lineStart, vscode.TextEditorRevealType.AtTop);
      return true;
    }
  }
  return false;
}

export async function resolveUriToQuartoFile(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  try {
    const doc = await tryResolveUriToQuartoFile(resource);
    if (doc) {
      return doc;
    }
  } catch {
    // Noop
  }

  // If no extension, try with `.qmd` extension
  if (extname(resource.path) === "") {
    return tryResolveUriToQuartoFile(
      resource.with({ path: resource.path + ".qmd" })
    );
  }

  return undefined;
}

async function tryResolveUriToQuartoFile(
  resource: vscode.Uri
): Promise<vscode.TextDocument | undefined> {
  let document: vscode.TextDocument;
  try {
    document = await vscode.workspace.openTextDocument(resource);
  } catch {
    return undefined;
  }
  if (isQuartoDoc(document)) {
    return document;
  }
  return undefined;
}
