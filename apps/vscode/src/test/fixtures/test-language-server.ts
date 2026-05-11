import {
  createConnection,
  DiagnosticSeverity,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * This module defines a language server for testing.
 */

const undefinedVarRegExp = /undefined_var/;

const connection = createConnection();
const documents = new TextDocuments(TextDocument);
const { console } = connection;

/**
 * Publish diagnostics for a text document.
 */
function publishDiagnostics(document: TextDocument) {
  // Get the document's lines.
  const allText = document.getText();
  const lines = allText.split("\n");

  // Find instances of "undefined_var" and create diagnostics for them.
  const diagnostics = [];
  for (const [line, text] of lines.entries()) {
    const match = text.match(undefinedVarRegExp);
    if (match && match.index !== undefined) {
      diagnostics.push({
        range: {
          start: { line, character: match.index },
          end: { line, character: match.index + match[0].length },
        },
        message: "test-diagnostic: undefined_var is not defined",
        severity: DiagnosticSeverity.Warning,
      });
    }
  }

  // Publish the diagnostics to the client.
  console.log(`Publishing ${diagnostics.length} diagnostics for ${document.uri}\n` +
    diagnostics.map(d => `- ${d.message} at [${d.range.start.line}, ${d.range.start.character}]`).join("\n")
  );
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

// Initialize the server.
connection.onInitialize(() => {
  console.log(`Initialized!`);;
  return {
    capabilities: {},
  };
});

// Publish diagnostics on document open.
documents.onDidOpen(({ document }) => {
  console.log(`Document opened: ${document.uri}`);
  publishDiagnostics(document);
});

// Publish diagnostics on document change.
documents.onDidChangeContent(({ document }) => {
  console.log(`Document changed: ${document.uri}`);
  publishDiagnostics(document);
});

// Clear diagnostics on document close.
documents.onDidClose(({ document }) => {
  console.log(`Document closed: ${document.uri}`);
  console.log(`Publishing 0 diagnostics for ${document.uri}`);
  connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
});

// Connect the text document manager.
documents.listen(connection);

// Listen on the connection.
connection.listen();
