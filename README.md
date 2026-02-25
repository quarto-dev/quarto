
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

## Licenses

This repository contains code under multiple open source licenses:

| Component | License |
|-----------|---------|
| [VS Code Extension](apps/vscode/package.json) | AGPL-3.0 |
| [Language Server](apps/lsp/package.json) | AGPL-3.0 |
| [Visual Editor](packages/editor/package.json) | AGPL-3.0 |
| [Panmirror](apps/panmirror/package.json) (RStudio integration) | AGPL-3.0 |
| @quarto/* npm packages | MIT (e.g. [mapped-string](packages/mapped-string/package.json)) |
| OJS Runtime | ISC (e.g. [quarto-ojs-runtime](packages/ojs/quarto-ojs-runtime/package.json)) |

Individual package licenses are specified in each package's `package.json` file.

Note that the [Quarto CLI](https://github.com/quarto-dev/quarto-cli) is in a separate repository and is MIT licensed. See the [Quarto license page](https://quarto.org/license.html) for an overview of licensing across all Quarto projects.
