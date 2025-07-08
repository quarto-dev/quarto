
# Quarto

Quarto is an open-source scientific and technical publishing system built on [Pandoc](https://pandoc.org). Quarto documents are authored using [markdown](https://en.wikipedia.org/wiki/Markdown), an easy to write plain text format.

Here is where you can find the source code for various parts of the Quarto system:

- [Quarto Command Line Interface](https://github.com/quarto-dev/quarto-cli)

- [Quarto GitHub Actions](https://github.com/quarto-dev/quarto-actions)

- [Quarto VS Code Extension](https://github.com/quarto-dev/quarto/tree/main/apps/vscode)

## Development

### VS Code Extension

To develop the Quarto VS Code extension, clone this repo, run `yarn`, then run the `yarn dev-vscode` command:

```bash
yarn             # install dependencies
yarn dev-vscode  # run development/debug version of extension
```

Use the VS Code **Run and Debug** pane in the activity bar to run a version of VS Code with the development build of the extension.

See our [`CONTRIBUTING`](https://github.com/quarto-dev/quarto/blob/main/apps/vscode/CONTRIBUTING.md) file for more information
