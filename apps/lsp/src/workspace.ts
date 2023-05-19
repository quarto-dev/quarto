import { URI } from "vscode-uri";
import { FileStat } from "./service";
import { ITextDocument } from "./service";
import { IWorkspace } from "./service";




function languageServiceWorkspace() : IWorkspace {

  const workspace : IWorkspace = {
    workspaceFolders: [],
    onDidChangeMarkdownDocument: undefined,
    onDidCreateMarkdownDocument: undefined,
    onDidDeleteMarkdownDocument: undefined,
    getAllMarkdownDocuments: function (): Promise<Iterable<ITextDocument>> {
      throw new Error("Function not implemented.");
    },
    hasMarkdownDocument: function (resource: URI): boolean {
      throw new Error("Function not implemented.");
    },
    openMarkdownDocument: function (resource: URI): Promise<ITextDocument | undefined> {
      throw new Error("Function not implemented.");
    },
    stat: function (resource: URI): Promise<FileStat | undefined> {
      throw new Error("Function not implemented.");
    },
    readDirectory: function (resource: URI): Promise<Iterable<readonly [string, FileStat]>> {
      throw new Error("Function not implemented.");
    }
  };

  return workspace;

}