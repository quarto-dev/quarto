## Terminology

- EXTENSION HOST
  - a.k.a. Visual Editor Host
- CLIENT
  - a.k.a. Visual Editor
- LSP

## Communication boundaries

- EXTENSION HOST --req-> CLIENT
  - received by[connection.ts](./vscode/src/providers/editor/connection.ts)
    `visualEditorServer`
  - sent by `request: JsonRpcRequestTransport`
- EXTENSION HOST <-req-- CLIENT
  - received by [sync.ts](./vscode-editor/src/sync.ts) `visualEditorHostServer`
  - sent by `request: JsonRpcRequestTransport`

- EXTENSION HOST --req-> LSP
  - received by [custom.ts](./lsp/src/custom.ts)
  - sent by `lspRequest: JsonRpcRequestTransport`
- EXTENSION HOST <-req-- LSP
  - I don't think this happens??

## Logging

You can use `console.log`. When running an extension development host to test
out the extension there are a couple of places where your logs can end up:

- browser console or `window` output console for [[CLIENT]] and [[EXTENSION
  HOST]] code
  - logs from these two places will look different. Logs from [[CLIENT]] will
    look like normal logs; logs from [[EXTENSION HOST]] will have a blue prefix
    that says EXTENSION HOST.
- `Quarto` output console for [[LSP]] code

## Controlling the Visual Editor from the server-side of the extension

### Example: Setting cursor position

for example in [commands.ts](./vscode/src/providers/cell/commands.ts):

```ts
const visualEditor = VisualEditorProvider.activeEditor();
visualEditor.setBlockSelection(blockContext, "nextblock");
```

which passes through `VisualEditorPovider`, `visualEditorClient`,
`visualEditorHostServer`, `Editor`. ???

## Getting server-side info from the Visual Editor

### Example: Getting diagnostics

#### Visual Editor

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

#### Source Editor

### Example: Completions

- [[EXTENSION HOST]] [codeview.ts](./vscode/src/providers/editor/codeview.ts)
  - [vdoc-completion.ts](./vscode/src/vdoc/vdoc-completion.ts)

```ts
await withVirtualDocUri(vdoc, parentUri, "completion", async (uri: Uri) => {
    return await commands.executeCommand<CompletionList>(
      "vscode.executeCompletionItemProvider"
      ...
```

### Example: Help Topic

We want to also look at how data is provided to the Source Editor so that we can
reuse functionality. This is related to PROVIDERS.

`EmbeddedHelpTopicProvider` in [](./vscode/src/host/hooks.ts)
