import path from "node:path";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import { TestOutputChannel } from "./test-output-channel";

/**
 * A {@link LanguageClient} for testing, which connects to `test-language-server.js`.
 */
export function testLanguageClient(): LanguageClient {
  const serverModule = path.join(__dirname, "test-language-server.js");

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { language: "python" },
      { language: "r" },
    ],
    outputChannel: new TestOutputChannel("Test Language Client"),
  };

  return new LanguageClient(
    "test-language-server",
    "Test Language Server",
    serverOptions,
    clientOptions
  );
}
