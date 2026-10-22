/*
 * editor-citation.ts
 *
 * Copyright (C) 2026 by Posit Software, PBC
 */

import { EditorServer } from 'editor-types';

import { BibliographyManager, BibliographySource } from '../api/bibliography/bibliography';
import { bibliographyFilesFromYaml } from '../api/bibliography/bibliography-provider_local';
import { EditorUI } from '../api/ui-types';
import { parseYamlBlocks } from '../api/yaml';
import { InsertCitationDialogResult, showInsertCitationDialog } from '../behaviors/insert_citation/insert_citation';
import { writeSourcesToBibliography } from '../marks/cite/cite';

import { editorUIWithDefaultImages } from './editor-images';
import { EditorTheme, ensureTheme } from './editor-theme';

export interface InsertCitationOptions {
  // yaml front matter block(s) of the document (with or w/o enclosing ---)
  yaml: string[];
  // theme to apply (if not specified the default theme is applied if no theme is active)
  theme?: EditorTheme;
  // key of the source tree node to select initially (typically the selectionKey
  // returned from the previous invocation)
  selectionKey?: string;
}

export interface InsertCitationResult {
  // ids of the citations to insert (any new sources have already been written
  // to the bibliography)
  citationIds: string[];
  // whether the user requested an in-text citation (e.g. @smith) rather than
  // a bracketed citation (e.g. [@smith])
  intextCitationStyle: boolean;
  // bibliography file which the host should declare in the document's yaml
  // front matter (undefined if the document already declares a bibliography
  // or the file is a project-level bibliography)
  bibliographyFile?: string;
  // key of the source tree node that was selected when the dialog was dismissed
  selectionKey?: string;
}

// Hosts the insert citation dialog w/o an editor instance (e.g. for a plain text
// markdown editor). Only ui.dialogs, ui.context, ui.prefs and ui.images are used
// (images fall back to the defaults). Bibliography data is cached across invocations.
export class InsertCitationDialog {
  private readonly ui: EditorUI;
  private readonly server: EditorServer;
  private readonly bibliographyManager: BibliographyManager;

  constructor(ui: EditorUI, server: EditorServer) {
    this.ui = editorUIWithDefaultImages(ui);
    this.server = server;
    this.bibliographyManager = new BibliographyManager(server.pandoc, server.zotero);
  }

  // Load bibliography data ahead of showing the dialog (otherwise it is loaded on show)
  public prime(yaml: string[]): Promise<void> {
    return this.bibliographyManager.prime(this.ui, parseYamlBlocks(yaml));
  }

  // Show the dialog, returning null if it was cancelled
  public async show(options: InsertCitationOptions): Promise<InsertCitationResult | null> {
    ensureTheme(options.theme);

    const yamlBlocks = parseYamlBlocks(options.yaml);
    let result: InsertCitationResult | null = null;
    await showInsertCitationDialog(
      this.ui,
      yamlBlocks,
      this.bibliographyManager,
      this.server,
      async (dialogResult: InsertCitationDialogResult) => {
        // Remember whether the citation is intext for the future
        this.ui.prefs.setCitationDefaultInText(dialogResult.intextCitationStyle);

        // Write any new sources to the bibliography (the user may decline)
        const bibliography = dialogResult.bibliography;
        const written = await writeSourcesToBibliography(
          dialogResult.bibliographySources,
          bibliography,
          this.bibliographyManager,
          yamlBlocks,
          this.ui,
          this.server.pandoc,
        );
        if (!written) {
          return;
        }

        // The host needs to declare the bibliography unless the document already
        // declares one (or the bibliography is project-level)
        const declared = bibliographyFilesFromYaml(yamlBlocks) || [];
        const declareBibliography = !bibliography.isProject && declared.length === 0;
        result = {
          citationIds: dialogResult.bibliographySources.map((source: BibliographySource) => source.id),
          intextCitationStyle: dialogResult.intextCitationStyle,
          bibliographyFile: declareBibliography ? bibliography.displayPath : undefined,
          selectionKey: dialogResult.selectionKey,
        };
      },
      options.selectionKey,
    );
    return result;
  }
}
