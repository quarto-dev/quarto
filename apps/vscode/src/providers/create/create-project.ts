/*---------------------------------------------------------------------------------------------
 *  Copyright (c) RStudio, PBC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *---------------------------------------------------------------------------------------------
 */

import { commands, ExtensionContext, QuickPickItem, Uri, window } from "vscode";
import { Command } from "../../core/command";
import { withMinimumQuartoVersion } from "../../core/quarto";
import { QuartoContext } from "quarto-core";
import { resolveDirectoryForCreate } from "./directory";
import { createFirstRun } from "./firstrun";

export class CreateProjectCommand implements Command {
  constructor(
    public readonly id: string,
    private readonly context_: ExtensionContext,
    private readonly quartoContext_: QuartoContext
  ) {}

  async execute() {
    await withMinimumQuartoVersion(
      this.quartoContext_,
      "1.0.0",
      "Creating projects",
      async () => {
        // select project type
        const typePick = await selectProjectType(1, 2);
        if (!typePick) {
          return;
        }

        // resolve directory
        const projDir = await resolveDirectoryForCreate(
          this.context_,
          "Project",
          "Project Directory Name",
          false
        );
        if (!projDir) {
          return;
        }

        // create the project
        await createAndOpenProject(
          this.context_,
          this.quartoContext_,
          typePick,
          projDir
        );
      }
    );
  }
}

async function createAndOpenProject(
  context: ExtensionContext,
  quartoContext: QuartoContext,
  pick: CreateProjectQuickPickItem,
  projDir: string
) {
  // create the project
  quartoContext.runQuarto({}, "create-project", projDir, "--type", pick.type);

  // write the first run file
  createFirstRun(context, projDir, pick.firstRun);

  // open the project
  await commands.executeCommand("vscode.openFolder", Uri.file(projDir));
}

interface CreateProjectQuickPickItem extends QuickPickItem {
  type: string;
  name: string;
  firstRun: string[];
}

function selectProjectType(
  step?: number,
  totalSteps?: number
): Promise<CreateProjectQuickPickItem | undefined> {
  return new Promise<CreateProjectQuickPickItem | undefined>((resolve) => {
    const defaultType: CreateProjectQuickPickItem = {
      type: "default",
      name: "Default",
      firstRun: ["$(dirname).qmd"],
      label: "$(gear) Default Project",
      detail: "Simple project with starter document",
      alwaysShow: true,
    };
    const websiteType: CreateProjectQuickPickItem = {
      type: "website",
      name: "Website",
      firstRun: ["index.qmd"],
      label: "$(globe) Website Project",
      detail: "Website with index and about pages",
      alwaysShow: true,
    };
    const blogType: CreateProjectQuickPickItem = {
      type: "website:blog",
      name: "Blog",
      firstRun: ["index.qmd"],
      label: "$(preview) Blog Project",
      detail: "Blog with index/about pages and posts.",
      alwaysShow: true,
    };
    const bookType: CreateProjectQuickPickItem = {
      type: "book",
      name: "Book",
      firstRun: ["index.qmd"],
      label: "$(book) Book Project",
      detail: "Book with chapters and bibliography.",
      alwaysShow: true,
    };
    const quickPick = window.createQuickPick<CreateProjectQuickPickItem>();
    quickPick.title = "Create Quarto Project";
    quickPick.placeholder = "Select project type";
    quickPick.step = step;
    quickPick.totalSteps = totalSteps;
    quickPick.items = [defaultType, websiteType, blogType, bookType];
    let accepted = false;
    quickPick.onDidAccept(() => {
      accepted = true;
      quickPick.hide();
      resolve(quickPick.selectedItems[0]);
    });
    quickPick.onDidHide(() => {
      if (!accepted) {
        resolve(undefined);
      }
    });
    quickPick.show();
  });
}
