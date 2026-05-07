import path from "node:path";
import { OutputChannel } from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";

function testOutputChannel(name: string): OutputChannel {
  return {
    name,
    append: (value) => console.log(`[${name}] ${value}`),
    appendLine: (value) => console.log(`[${name}] ${value}`),
    clear: () => { },
    show: () => { },
    hide: () => { },
    dispose: () => { },
    replace: (_value) => { },
  };
}

export function testLanguageClient(): LanguageClient {
  const serverModule = path.join(__dirname, "test-language-server.js");

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: "python" }],
    outputChannel: testOutputChannel("Test Language Client"),
  };

  return new LanguageClient(
    "test-language-server",
    "Test Language Server",
    serverOptions,
    clientOptions
  );
}
