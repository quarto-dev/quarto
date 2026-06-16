import path from "node:path";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { TestLogOutputChannel } from "./test-log-output-channel";

/**
 * A {@link LanguageClient} for testing, which connects to `test-language-server.js`.
 */
export function testLanguageClient(): LanguageClient {
  // This code runs from bundled test files in test-out/, so __dirname is
  // apps/vscode/test-out/. The server is a standalone .js file (not part of
  // the bundle) because the LanguageClient spawns it as a child process.
  const serverModule = path.join(__dirname, "..", "src", "test", "fixtures", "test-language-server.js");

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "python" },
      { language: "r" },
    ],
    outputChannel: new TestLogOutputChannel("Test Language Client"),
  };

  return new LanguageClient(
    "test-language-server",
    "Test Language Server",
    serverOptions,
    clientOptions
  );
}
