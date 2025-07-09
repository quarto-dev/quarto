# Building the extension

To develop the Quarto VS Code extension, clone the quarto mono-repo, run `yarn` at top level, then run the `yarn dev-vscode` command:

```sh
yarn             # install dependencies
yarn dev-vscode  # run development/debug version of extension
```

Install the dev version of the extension in VS Code or Positron with:

```sh
yarn install-vscode
yarn install-positron
```


# Debugging the extension

The extension must have been built in dev mode (see the build section). The `dev` build flag is essential for debugging:

- It disables minifying and generates source maps from generated JS files to source TS files. The source maps allow you to set breakpoints in our TS files and step through them.

- It causes the LSP node process to be spawned in debug mode. This allows VS Code or another debugger to connect to the LSP via a special port.

Here is the process:

- Let `yarn dev-vscode` run in the background somewhere.

- Open the `apps/vscode` folder in VS Code or Positron and go to the `Run and debug` pane.

- Run the `Run VS Code Extension` to open the dev version of the extension in a new window.

- If you need to set breakpoints in the LSP, you'll have to select the launch configuration `Attach to VS Code LSP server` and run that as well. You should see your LSP breakpoints bind (go from grayed out to red dots) as soon as the debugger is attached to the LSP.

  Note that if you close the dev window and stop the extension debugging session, you'll have to manually close the LSP debugging session.
