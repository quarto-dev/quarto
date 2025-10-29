## Terminology

- Source Editor
  - controlled by VSCode/Positron
  - we add some functionality to the source editor by registering commands and
    providing our LSP

- Visual Editor
  - controlled by this repo! See CLIENT below.

- EXTENSION HOST
  - a.k.a. HOST
  - code lives in [./vscode](./vscode/) and various packages
  - entry point in [main.ts](./vscode/src/main.ts), this is the entry point to
    the entire extension. The `activate` function is called by VSCODE/Positron
    to start the extension.
- CLIENT
  - a.k.a. Visual Editor
  - code lives in [./vscode-editor](./vscode-editor/) and various packages
  - initialized in the HOST by `VisualEditorProvider` in
    [editor.ts](./vscode/src/providers/editor/editor.ts)
    - more specifically, the actual html with css and scripts for the Visual
      Editor is created in `getHtmlForWebview`
    - this is loaded into a webview, a separate process from the HOST,
      containing the Visual Editor
    - there may be multiple CLIENTs running at the same time (one for every file
      open in the Visual Editor). There is code in here to manage and coordinate
      from the HOST to multiple CLIENTs.
  - entry point in `runEditor` in [index.tsx](./vscode-editor/src/index.tsx)
- LSP
  - code lives in [./vscode](./vscode/src/lsp/)
  - initialized in the HOST by `activateLSP` in
    [client.ts](./vscode/src/lsp/client.ts)
  - entry point in [index.ts](./lsp/src/index.ts)
    - this runs in a separate process from the HOST

## Handling User Input

- VSCODE/POSITRON --commands-> EXTENSION HOST
  - see [package.json](./vscode/package.json) for declaration of commands
  - see [main.ts](./vscode/src/main.ts) for registration of command

- Look for "behaviors" in ProseMirror, CodeMirror
  - arrow keys, ctrl+z, mouse click, etc.

- [commands in Ace](packages/editor/src/optional/ace/ace.ts)
  - used instead of CodeMirror for code cells in the Visual Editor in RStudio

## Communication boundaries

- EXTENSION HOST <-req-> CLIENT
  - Set up on the EXTENSION HOST side:
    [connection.ts](./vscode/src/providers/editor/connection.ts)
    `visualEditorServer` and `visualEditorClient`
  - Set up on the CLIENT side: [sync.ts](./vscode-editor/src/sync.ts)
    `visualEditorHostServer` and `visualEditorHostClient`
  - Communication is sent by using `request: JsonRpcRequestTransport` e.g.
    `request(kCodeViewGetDiagnostics, [context])`

- EXTENSION HOST --req-> LSP
  - received by [custom.ts](./lsp/src/custom.ts)
  - sent by `lspRequest: JsonRpcRequestTransport`
- EXTENSION HOST <-req-- LSP
  - I don't think this happens?

- EXTENSION HOST / LSP --command-> VSCODE/POSITRON
  - sent by `vscode.commands.executeCommand(..)`

- LSP <-provider-- VSCODE/POSITRON
  - How does this work?

- LSP --req-> Quarto CLI
  - [quarto.ts](./lsp/src/quarto.ts) defines the methods that the LSP uses to
    call the Quarto CLI.

## Logging

You can use `console.log`. When running an extension development host to test
out the extension there are a couple of places where your logs can end up:

- browser console or `window` output console for [[CLIENT]] and [[EXTENSION
  HOST]] code
  - logs from these two places will look different. Logs from [[CLIENT]] will
    look like normal logs; logs from [[EXTENSION HOST]] will have a blue prefix
    that says EXTENSION HOST.
- `Quarto` output console for [[LSP]] code

## Examples of Controlling the Visual Editor from the server-side of the extension

### Example: Setting cursor position

for example in [commands.ts](./vscode/src/providers/cell/commands.ts):

```ts
const visualEditor = VisualEditorProvider.activeEditor();
visualEditor.setBlockSelection(blockContext, "nextblock");
```

which passes through `VisualEditorPovider`, `visualEditorClient`,
`visualEditorHostServer`, `Editor`. See the "Communication Boundaries" section.

## Examples of Getting server-side info from the Visual Editor

### Example: Getting diagnostics for YAML front matter

For example in
[diagnostics.ts](../packages/editor-codemirror/src/behaviors/diagnostics.ts)

```ts
const diagnostics = await getDiagnostics(cellContext, behaviorContext);
if (!diagnostics) return;

for (const error of diagnostics) {
  underline(
    cmView,
    rowColumnToIndex(code, [error[kStartColumn], error[kStartRow]]),
    rowColumnToIndex(code, [error[kEndColumn], error[kEndRow]]),
    error.text,
  );
}
```

which passes through

- [[CLIENT]] [services.ts](../packages/editor-core/src/services.ts) function
  `editorCodeViewJsonRpcServer` registers `codeViewDiagnostics` calls
  `request(kCodeViewGetDiagnostics`
  - request seems to communicate from the CLIENT to the EXTENSION HOST?
- [[EXTENSION HOST]]
  [codeview.ts](../packages/editor-server/src/services/codeview.ts) function
  `codeViewServerMethods` registers `kCodeViewGetDiagnostics` calls
  `server.codeViewDiagnostics`
- [[EXTENSION HOST]]
  [other codeview.ts](./vscode/src/providers/editor/codeview.ts) function
  `vscodeCodeViewServer` return object with prop `codeViewDiagnostics` calls
  `lspRequest(kCodeViewGetDiagnostics, [context])`
- [[LSP]] [custom.ts](./lsp/src/custom.ts) `codeViewDiagnostics`
  `getYamlDiagnostics`
  - `initializeQuartoYamlModule`

#### Examples providing information to the Source Editor

### Example: Completions

- [vdoc-completion.ts](./vscode/src/vdoc/vdoc-completion.ts)

```ts
await withVirtualDocUri(vdoc, parentUri, "completion", async (uri: Uri) => {
    return await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider"
      ...
```

In the Visual Editor, completions are obtained via
[codeview.ts](./vscode/src/providers/editor/codeview.ts)

In the Source Editor, completions are obtained `embeddedCodeCompletionProvider`
in [client.ts](./vscode/src/lsp/client.ts)

### Example: Positron Specific - Help Topic & Statement Range

`EmbeddedStatementRangeProvider` or `EmbeddedHelpTopicProvider` in
[hooks.ts](./vscode/src/host/hooks.ts)

- simply executes the command "vscode.executeStatementRangeProvider" or
  "positron.executeHelpTopicProvider" respectively inside a virtual doc for a
  cell
