/*
 * prefs.ts
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

import { Disposable, TextDocument, workspace } from "vscode";

import throttle from "lodash.throttle";

import { defaultMarkdownPrefs, MarkdownPrefs, Prefs, PrefsServer } from "editor-types";

import { metadataFilesForDocument, projectDirForDocument, yamlFromMetadataFile } from "quarto-core";

import { prefsServer } from "editor-server";
import { MarkdownEngine } from "../../markdown/engine";
import { documentFrontMatter, documentFrontMatterYaml } from "../../markdown/document";

const kEditorAutoClosingBrackets = "editor.autoClosingBrackets";
const kEditorRenderWhitespace = "editor.renderWhitespace";
const kEditorInsertSpaces = "editor.insertSpaces";
const kEditorTabSize = "editor.tabSize";
const kEditorSelectionHighlight = "editor.selectionHighlight";
const kEditorCursorBlinking = "editor.cursorBlinking";
const kQuartoVisualEditorLineNumbers = "quarto.visualEditor.lineNumbers";
const kQuartoVisualEditorSpelling = "quarto.visualEditor.spelling";
const kQuartoVisualEditorSpellingDictionary = "quarto.visualEditor.spellingDictionary";
const kQuartoVisualEditoDefaultListSpacing = "quarto.visualEditor.defaultListSpacing";
const kQuartoEditorMarkdownWrap = "quarto.visualEditor.markdownWrap";
const kQuartoEditorMarkdownWrapColumn = "quarto.visualEditor.markdownWrapColumn";
const kQuartoEditorMarkdownReferences = "quarto.visualEditor.markdownReferences";

const kMonitoredConfigurations = [
  kEditorAutoClosingBrackets,
  kEditorRenderWhitespace,
  kEditorInsertSpaces,
  kEditorTabSize,
  kEditorSelectionHighlight,
  kEditorCursorBlinking,
  kQuartoVisualEditorLineNumbers,
  kQuartoVisualEditorSpelling,
  kQuartoVisualEditorSpellingDictionary,
  kQuartoVisualEditoDefaultListSpacing,
  kQuartoEditorMarkdownWrap,
  kQuartoEditorMarkdownWrapColumn,
  kQuartoEditorMarkdownReferences
];

export function vscodePrefsServer(
  engine: MarkdownEngine,
  document: TextDocument,
  onPrefsChanged: (prefs: Prefs) => void
) : [PrefsServer, Disposable]  {

  const server = prefsServer();

  const getPrefs = async () : Promise<Prefs> => {
    
    const configuration = workspace.getConfiguration(undefined, document.uri);
     
    const prefs = { 
      
      ...(await server.getPrefs()), 
      
      // spelling settings
      realtimeSpelling: configuration.get<boolean>(kQuartoVisualEditorSpelling, true),
      dictionaryLocale: configuration.get<string>(kQuartoVisualEditorSpellingDictionary, "en_US"),

      // quarto editor settings
      listSpacing: configuration.get<'spaced' | 'tight'>(kQuartoVisualEditoDefaultListSpacing, 'spaced'),

      // markdown writer settings
      ...(await readMarkdownPrefs(engine, document)),
     
      // vscode code editor settings
      spacesForTab: configuration.get<boolean>(kEditorInsertSpaces, true),
      tabWidth: configuration.get<number>(kEditorTabSize, 4),
      autoClosingBrackets: configuration.get(kEditorAutoClosingBrackets) !== "never",
      highlightSelectedWord: configuration.get<boolean>(kEditorSelectionHighlight, true),
      showWhitespace: configuration.get(kEditorRenderWhitespace) === "all",
      blinkingCursor: configuration.get(kEditorCursorBlinking, "solid") !== "solid",

      // quarto code editor settings
      lineNumbers: configuration.get<boolean>(kQuartoVisualEditorLineNumbers, true),
    };
    return prefs;
  };


  // throttled prefs change handler
  const kThrottleDelayMs = 1250;
  const firePrefsChanged = throttle(() => {
    getPrefs().then(onPrefsChanged);
  }, kThrottleDelayMs, { leading: false, trailing: true});


  // subscribe to changes that can affect prefs
  const disposables: Disposable[] = [];

  // vscode config changes
  disposables.push(workspace.onDidChangeConfiguration(async (e) => {
    if (kMonitoredConfigurations.some(config => e.affectsConfiguration(config))) {
      firePrefsChanged();
    }
  }));

  // front matter changes (only on save)
  let lastDocYamlFrontMatter = documentFrontMatterYaml(engine, document);
  disposables.push(workspace.onDidSaveTextDocument(async (savedDoc) => {
    if (savedDoc.uri.toString() === document.uri.toString()) {
      const yamlFrontMatter = documentFrontMatterYaml(engine, document);
      if (yamlFrontMatter !== lastDocYamlFrontMatter) {
        lastDocYamlFrontMatter = yamlFrontMatter;
        firePrefsChanged();
      }
    }
  }));

  // project config file changes
  const watcher = workspace.createFileSystemWatcher('**/{_quarto,metadata}.{yml,yaml}');
  watcher.onDidChange(firePrefsChanged);
  watcher.onDidCreate(firePrefsChanged);
  watcher.onDidDelete(firePrefsChanged);
  disposables.push(watcher);

  return [
    {
      getPrefs,
      setPrefs: async (prefs: Prefs) : Promise<void> => {
        server.setPrefs(prefs);
      }
    }, 
    {
      dispose() {
        for (const disposable of disposables) {
          disposable.dispose();
        }
      }
    }
  ];
}


async function readMarkdownPrefs(engine: MarkdownEngine, document: TextDocument) {

  // start with defaults
  const defaultPrefs = defaultMarkdownPrefs();

  // layer in vscode config
  const config = workspace.getConfiguration(undefined, document.uri);
  let prefs: MarkdownPrefs = {
    markdownWrap: config.get<'none' | 'column' | 'sentence'>(kQuartoEditorMarkdownWrap, defaultPrefs.markdownWrap),
    markdownWrapColumn: config.get<number>(kQuartoEditorMarkdownWrapColumn, defaultPrefs.markdownWrapColumn),
    markdownReferences: config.get<'block' | 'section' | 'document'>(kQuartoEditorMarkdownReferences, defaultPrefs.markdownReferences),
    markdownReferencesPrefix: defaultPrefs.markdownReferencesPrefix
  };

  // layer in project level settings if specified
  const projectDir = projectDirForDocument(document.uri.fsPath);
  if (projectDir) {
    const metadataFiles = metadataFilesForDocument(document.uri.fsPath);
    if (metadataFiles) {
      // scan from root _project.yml down so settings closer to us win
      for (const metadataFile of metadataFiles.reverse()) {
        const yaml = yamlFromMetadataFile(metadataFile);
        prefs = resolveMarkdownPrefs(yaml, prefs);
      }
    }
  }

  // finally, layer in document level options (highest priority)
  const docYaml = await documentFrontMatter(engine, document);
  return resolveMarkdownPrefs(docYaml, prefs);
}

function resolveMarkdownPrefs(frontMatter: Record<string,unknown>, prefs: MarkdownPrefs) {

  // copy baseline prefs
  const resolved = { ...prefs };

  // determine editor key
  const editorKey = (frontMatter["editor"] || frontMatter["editor_options"]) as Record<string,unknown>;
  if (!editorKey || typeof editorKey !== "object") {
    return resolved;
  }

  // markdown options
  const markdownKey = editorKey["markdown"] as Record<string,unknown>;
  if (!markdownKey || typeof markdownKey !== "object") {
    return resolved;
  }

  // markdown wrap
  const wrap = markdownKey["wrap"];
  if (wrap) {
    if (typeof(wrap) === "number") {
      resolved.markdownWrap = "column";
      resolved.markdownWrapColumn = wrap;
    } else if (wrap === "none") {
      resolved.markdownWrap = "none";
    } else if (wrap === "sentence") {
      resolved.markdownWrap = "sentence";
    }
  }

  // markdown references
  const referencesKey = markdownKey["references"] as Record<string,unknown>;
  if (referencesKey && typeof(referencesKey) === "object") {
    const location = referencesKey["location"];
    if (location) {
      if (location === 'block') {
        resolved.markdownReferences = 'block';
      } else if (location === 'section') {
        resolved.markdownReferences = 'section';
      } else if (location === 'document') {
        resolved.markdownReferences = 'document';
      }
    }
    const prefix = referencesKey["prefix"];
    resolved.markdownReferencesPrefix = prefix && typeof(prefix) === "string"
      ? prefix
      : resolved.markdownReferencesPrefix;
  }

  return resolved;
}

