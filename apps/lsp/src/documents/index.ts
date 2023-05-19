
import { Connection, TextDocuments } from "vscode-languageserver/node";

import { URI } from "vscode-uri";

import { QuartoContext, Token, parseDocument } from "quarto-core";

import { TextDocument } from "vscode-languageserver-textdocument";
import { isQuartoDoc } from "../core/doc";




export interface DocumentsIndex {
  documentTokens(uri: URI): Token[];


}


export function initDocumentsIndex(context: QuartoContext, connection: Connection) {

  // open documents
  const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  documents.listen(connection);

  


  // keep workspace index up to date

  // return interface
  return {
    documentTokens: documentTokens(context, documents)
  };
}

function documentTokens(
  context: QuartoContext,
  documents: TextDocuments<TextDocument>
) {
  // token cache for last document requested
  let tokenCache: Token[] | undefined;
  let tokenCacheDocUri: string | undefined;
  let tokenCacheDocVersion: number | undefined;

  return (uri: URI): Token[] | undefined => {

    const doc = documents.get(uri.toString());
    if (doc && isQuartoDoc(doc)) {
      if (
        !tokenCache ||
        doc.uri.toString() !== tokenCacheDocUri ||
        doc.version !== tokenCacheDocVersion
      ) {
        tokenCache = parseDocument(context, "resources", doc.getText());
        tokenCacheDocUri = doc.uri.toString();
        tokenCacheDocVersion = doc.version;
      }
      return tokenCache;
    } else {
      return undefined;
    }
  }
}

