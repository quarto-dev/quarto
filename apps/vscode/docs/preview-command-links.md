# Integrated preview command-link contract

Implementation contract for [issue #1242](https://github.com/quarto-dev/quarto/issues/1242).
This describes the intended behavior. The permission setting and extension-host
permission checks are implemented; command-link dispatch is not implemented yet.

## Link syntax

Support links with a `command:` URI in the integrated Quarto preview. Dispatch
the command through `vscode.commands.executeCommand(commandId, ...args)`.
Commands continue to be implemented by VS Code or the extension registering them.

```markdown
[Open terminal](command:workbench.action.terminal.new)

[Open this document](command:vscode.open?%5B%7B%22scheme%22%3A%22file%22%2C%22path%22%3A%22%2Fworkspace%2Fhello.qmd%22%7D%5D)

[Open this document](command:vscode.open){data-args='[{"scheme":"file","path":"/workspace/hello.qmd"}]'}

[Open terminal](command:workbench.action.terminal.new){.btn .btn-primary data-args='[{"location":1,"cwd":"/workspace"}]'}

[Open terminal][terminal]

[terminal]: command:workbench.action.terminal.new {data-args='[{"location":1,"cwd":"/workspace"}]'}
```

Inline and reference links have the same behavior. CSS classes and nested link
content do not change argument parsing or authorization. Ordinary document,
anchor, external and email links retain their existing behavior. This feature
does not enable command execution in published HTML or an external browser.

The URI must identify a nonempty command ID, without a URI authority or fragment.
Match command IDs exactly and case-sensitively; do not infer aliases or patterns.

## Arguments

Preserve the raw link target and whether `data-args` is present until validation
is complete. Do not normalize one argument source into the other in the browser
bridge, because doing so would hide conflicting input from the extension host.

| Argument source | Interpretation |
| --- | --- |
| No query and no `data-args` attribute | An empty positional argument array, `[]`. |
| URI query only | Percent-decode the entire query exactly once, then parse JSON. |
| `data-args` only | Parse the DOM attribute value directly as JSON. HTML entities have already been decoded by the browser; do not percent-decode it. |
| Both query and `data-args` | Reject, even if they contain identical arguments. |

An argument source counts as present even when empty: a trailing `?` supplies a
query, and `data-args=''` supplies an attribute. Either alone is invalid JSON;
together they conflict. A supplied value must be a JSON array. Reject malformed
percent escapes, malformed JSON, objects, strings, numbers, booleans and `null`
as the outer argument value. Array elements may be any JSON value.

Treat the query as one encoded JSON value, not as form data or key/value pairs.
Do not turn `+` into a space or decode a second time. For example, an argument
containing a literal `%20` must remain `%20`, rather than becoming a space.
Readable arguments containing `100%` do not need percent encoding.

Convert each top-level array element to `vscode.Uri` only when it is a JSON
object with a string `scheme` field and an absent `$mid` or `$mid: 1`. Construct
the URI from its `scheme`, `authority`, `path`, `query` and `fragment` components
using `vscode.Uri.from`; supplied components must be strings. An invalid URI
argument rejects the whole invocation. Additional object fields are not URI
components and are not preserved in the constructed URI.

Do not recursively convert nested arrays or objects. Objects without a string
`scheme`, or with another explicit `$mid`, remain ordinary JSON values. This
conversion does not reconstruct other VS Code types, resolve relative paths,
expand environment variables or translate host paths into container paths.
Authors must follow the target command's argument signature and use paths in
the environment where that command runs.

## Authorization and failure behavior

The setting is `quarto.preview.allowedCommands`, an array of exact
command IDs with an empty default. Only User Settings and Remote User Settings
may grant permission. Workspace, folder, document and project configuration must
not grant or expand permission. A configured list replaces the default; an empty
list disables command-link execution. Wildcard matching is not supported.

The setting uses VS Code's `window` scope so it is configurable in both User and
Remote User settings, including code-server. Machine scope hides it from the
User Settings tab in remote sessions. Window scope also exposes it in Workspace
Settings, but entries there are ignored. Permission checks read only the
configuration inspection's `globalValue`, which represents User/Remote User
settings, rather than the effective value that could contain workspace overrides.
Invalid lists (including non-string, empty or whitespace-containing entries)
deny execution for the entire list.

The extension host must validate each invocation and require a trusted workspace
and explicit permission for its command ID immediately before execution. Invalid
permission configuration fails closed. Browser-side checks are not authorization.
Changing or removing permission takes effect on the next invocation without
requiring a preview restart.

Reject invalid input before dispatch; a rejected link must not execute a command
or fall through to an external command-URI opener. Report a concise reason for
denial or failure without echoing argument values, a full command URL or raw
exception details. Do not automatically enable commands or change trust settings.

Allowing a command does not restrict its arguments or sandbox its effects.
Commands may execute code, modify files or open connections. Users must trust
both the document and the commands they enable. Link arguments remain visible
in source and generated HTML and must not contain credentials.

Authorization applies only to the command ID requested by the link. Composite
commands such as `runCommands` use the same policy as any other command: they
must be explicitly allowed, but Quarto does not inspect their arguments for
nested commands or require separate allowlist entries for those commands.

Allowing `runCommands` therefore permits document-provided sequences that invoke
commands absent from the allowlist. Other allowed extension commands can also
invoke commands internally. The allowlist controls entry points into VS Code,
not every downstream action. Users must understand the capabilities they grant
when enabling a composite command; nested-command validation is out of scope.

Before finalizing the PR, user documentation must explain this behavior and its
security implications, including the broad permissions granted by `runCommands`,
unrestricted arguments, and the need to trust the document. This is part of the
documentation step, not a separate composite-permission implementation step.

## Acceptance cases for later implementation steps

- Encoded and readable links produce equivalent positional arguments.
- Inline, reference and button-styled links use the same dispatch path.
- Missing arguments produce `[]`; malformed or conflicting arguments are rejected.
- Query decoding happens once; literal plus and percent characters survive.
- URI conversion is shallow and rejects invalid component types before dispatch.
- Empty permissions, untrusted workspaces and workspace-only grants deny execution.
- User/Remote permission changes apply to the next click.
- Composite commands require their own requested ID to be allowed; their nested
  commands do not require additional entries and their argument arrays are not
  recursively rewritten or authorized.
- Blocked, malformed or failed commands do not expose argument contents.
- Ordinary navigation, external links and preview refresh retain existing behavior.
