import { InitializeParams, TextDocuments } from "vscode-languageserver";
import { FileStat, ILogger, IMdLanguageService, IMdParser, ITextDocument, IWorkspace, LogLevel, Token, createLanguageService } from "./v2/service";
import { TextDocument } from "vscode-languageserver-textdocument";


// create language service
function langaugeService(params: InitializeParams, documents: TextDocuments<TextDocument>) : IMdLanguageService {

  

  return createLanguageService({
    workspace: languageServiceWorkspace(),
    parser: langaugeServiceMdParser(),
    logger: languageServiceLogger()
  })

}

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

function langaugeServiceMdParser() : IMdParser {

  const mdParser : IMdParser = {
    slugifier: undefined,
    tokenize: function (document: ITextDocument): Promise<Token[]> {
      throw new Error("Function not implemented.");
    }
  };

  return mdParser;

}

function languageServiceLogger() : ILogger {

  const logger : ILogger = {
    level: LogLevel.Off,
    log: function (level: LogLevel, message: string, data?: Record<string, unknown> | undefined): void {
      throw new Error("Function not implemented.");
    }
  };

  return logger;

}


