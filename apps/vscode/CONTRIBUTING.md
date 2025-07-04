# Building the extension

We collect our dev commands in `./justfile` and use the [just](https://github.com/casey/just) command runner to run these.

- `just` or `just install`: Build and package the extension into a `vsix` file, then install it in VS Code and Positron. Note that this command deletes `*.vsix` in the current directory.

- `just dev`: Build the extension and its dependencies with the `dev` flag and watch for changes.


# Debugging the extension

The extension must have been built in dev mode (see the build section). The `dev` build flag is essential for debugging:

- It disables minifying and generates source maps from generated JS files to source TS files. The source maps allow you to set breakpoints in our TS files and step through them.

- It causes the LSP node process to be spawned in debug mode. This allows VS Code or another debugger to connect to the LSP via a special port.

Here is the process:

- Let `just dev` run in the background somewhere.

- Open the `apps/vscode` folder in VS Code or Positron and go to the `Run and debug` pane.

- Run the `Run VS Code Extension` to open the dev version of the extension in a new window.

- If you need to set breakpoints in the LSP, you'll have to select the launch configuration `Attach to VS Code LSP server` and run that as well. You should see your LSP breakpoints bind (go from grayed out to red dots) as soon as the debugger is attached to the LSP.

  Note that if you close the dev window and stop the extension debugging session, you'll have to manually close the LSP debugging session.
