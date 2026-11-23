# Command links in the integrated preview

Quarto documents can include `command:` links that invoke commands registered
by VS Code or an installed extension. They work in the integrated HTML preview,
including book pages and Reveal.js presentations, after you grant permission.
Command links are disabled by default.

## Enable commands

1. Open a workspace you trust. Command execution requires VS Code Workspace
   Trust; Quarto does not change the workspace's trust status.
2. Add the exact command IDs you want to allow to **User Settings** or
   **Remote User Settings**, including when using code-server:

   ```json
   {
     "quarto.preview.allowedCommands": [
       "vscode.open",
       "workbench.action.terminal.new"
     ]
   }
   ```

3. Open an HTML document with **Quarto: Preview** and click a command link.
   The preview must be integrated into the editor. If necessary, set
   `quarto.render.previewType` to `"internal"` (the default).

**Only enable commands for documents and commands you trust.** An allowed
command can execute code, modify files or open connections. The allowlist does
not restrict arguments or sandbox a command's downstream effects. Arguments
remain visible in document source and generated HTML; do not put credentials
in them.

Workspace and Workspace Folder settings cannot grant permission. This includes
`.vscode/settings.json` and workspace files supplied by a document's repository.
The setting appears in the Workspace Settings UI because it uses window scope,
but the extension ignores those workspace values when authorizing commands.
Document front matter and `_quarto.yml` cannot grant permission either.

Command IDs match exactly and case-sensitively; wildcards such as `*` or
`vscode.*` do not grant permission. An empty list disables execution. A malformed
list, including a non-string, empty or whitespace-containing entry, blocks all
command links until corrected. The configured User/Remote User list replaces
the empty default; workspace values are never added to it. VS Code resolves
which User/Remote User value applies in the current environment.

Changes to permission take effect on the next click without restarting the
preview. Trust and permission are checked immediately before dispatch.

## Write command links

A link without arguments invokes the command with no positional arguments:

```markdown
[New terminal](command:workbench.action.terminal.new)
```

For readable arguments, add a `data-args` attribute containing a JSON array:

```markdown
[Open a document](command:vscode.open){data-args='[{"scheme":"file","path":"/absolute/path/hello.qmd"}]'}
```

Replace `/absolute/path/hello.qmd` with the path in the environment where the
command runs. Paths are not expanded or translated between your computer and a
remote host or container. This example converts the first argument into a
`vscode.Uri`, as described below.

The equivalent encoded form puts percent-encoded JSON after `?`:

```markdown
[Open a document](command:vscode.open?%5B%7B%22scheme%22%3A%22file%22%2C%22path%22%3A%22%2Fabsolute%2Fpath%2Fhello.qmd%22%7D%5D)
```

You can generate the query value with JavaScript:

```js
const args = [{ scheme: "file", path: "/absolute/path/hello.qmd" }];
const href = "command:vscode.open?" + encodeURIComponent(JSON.stringify(args));
```

CSS classes and reference links work too:

```markdown
[Styled terminal](command:workbench.action.terminal.new){.btn .btn-primary}

[New terminal][terminal]

[terminal]: command:workbench.action.terminal.new {.btn .btn-primary}
```

The target command defines its argument signature and behavior. For example,
`vscode.open` accepts an optional second argument with editor options:

```markdown
[Open in editor group 1](command:vscode.open){data-args='[{"scheme":"file","path":"/absolute/path/hello.qmd"},{"viewColumn":1,"preview":false}]'}
```

That example opens the file in editor group 1 with a persistent tab, which can
help keep the preview visible. Quarto passes these options to VS Code; it does
not redefine the command's editor placement or other behavior.

## Argument rules

Arguments are passed as `executeCommand(commandId, ...args)`, so the outer JSON
value must be an array. Its elements may be any JSON values.

| Link arguments | Behavior |
| --- | --- |
| Neither a query nor `data-args` | Use an empty argument array. |
| Query only | Percent-decode the entire query once, then parse JSON. |
| `data-args` only | Parse the DOM attribute value as JSON without percent-decoding. |
| Both a query and `data-args` | Reject, even when they contain identical arguments. |

An empty source still counts as present: `command:example?` and `data-args=''`
are invalid JSON, and supplying both is a conflict. Malformed percent escapes,
invalid JSON and non-array outer values are rejected before execution.

The query is one encoded JSON value, not form data or a list of key/value pairs.
A literal `+` stays `+`. Decoding happens once, so an argument containing the
literal text `%20` stays `%20`. Readable arguments containing `100%` do not need
percent encoding. HTML attribute escaping still applies to `data-args`; the
browser has decoded HTML entities before the extension receives its value.

A command URI needs a nonempty command ID and must not have an authority
(`command://...`) or a fragment (`#...`). Only the URI scheme is matched
case-insensitively; command IDs retain their case.

### URI arguments

Commands such as `vscode.open` expect a URI argument. Quarto converts top-level
argument objects containing a string `scheme` field into VS Code URIs. Use
standard URI fields such as `scheme` and `path`; nested objects are left
unchanged, and invalid URI components prevent execution.

## Composite commands and downstream effects

Permission applies **only to the command ID requested by the link**. For
example, adding `runCommands` to `quarto.preview.allowedCommands` permits that
command to execute document-provided sequences. Nested commands do not need
separate allowlist entries:

```json
{
  "quarto.preview.allowedCommands": ["runCommands"]
}
```

```markdown
[Run a sequence](command:runCommands){data-args='[{"commands":["workbench.action.terminal.new"]}]'}
```

Here, the terminal command can run even though it is absent from the allowlist.
Quarto does not inspect, rewrite or separately authorize the nested command
sequence. Conversely, allowing a nested command does not automatically allow
`runCommands` itself.

**Allowing `runCommands` grants broad access to arbitrary document-provided
command sequences.** Other allowed extension commands may also invoke commands
internally. The list controls which command a link may request, not every
subsequent action. Arguments and downstream effects remain unrestricted by the
allowlist, so trust both the document and the capabilities of every allowed
command. Quarto does not block composite commands or validate their nested IDs.

## Compatibility and failures

- Command links require the integrated preview started with `quarto preview`.
  They do not gain editor-command execution in an external browser, published
  HTML, or non-HTML output such as PDF.
- Shiny knitr/R documents use `quarto serve`. Other Shiny documents also use it
  with Quarto 1.4.414 or earlier. That command has no `--metadata-file` option,
  so these workflows retain their prior behavior and do not support command
  links. This includes the knitr/R workflow with current CLI versions; it is not
  limited to old documents or installations.
- Validation used Quarto CLI 1.11.9 and code-server 4.146.0 on Linux ARM64, with
  automated HTML, book and Reveal.js checks. Windows/macOS execution, other CLI
  versions and live Shiny/language-runtime behavior were not validated by this
  change. Newer Shiny workflows using `quarto preview` are eligible for bridge
  injection, but that does not establish live Shiny compatibility.

> The CLI's existing click relay omits `data-args`, and the extension cannot read
> the preview iframe's DOM directly. A temporary `--metadata-file` and Lua filter
> add a script that forwards both the URL and `data-args` before the existing
> handler. Extending the CLI relay could replace this workaround once a
> compatible CLI version and extension protocol are available.

A blocked or malformed link does not execute or fall through to an external
command-URI opener. Notifications explain validation, permission or execution
failures without echoing arguments, full command URLs or raw exceptions. An
allowed command can still fail if it is unavailable or its arguments are not
supported. Such a failure does not disable subsequent valid links.

If a link is blocked, check workspace trust and the exact command ID in the
applicable User/Remote User setting. If it fails during execution, check that
the command is registered and that its arguments match the command's API.
A preview created without the bridge cannot execute links through Quarto's
older URL-only relay. Ordinary document, anchor, external and email links keep
their existing behavior.
