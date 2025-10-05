# Quarto Development Guide

## Project Overview

Quarto is an open-source scientific and technical publishing system built on [Pandoc](https://pandoc.org). This repository contains the source code for various parts of the Quarto ecosystem, with the main CLI implementation housed in a separate repository ([quarto-cli](https://github.com/quarto-dev/quarto-cli)).

### Main Components

- **VS Code Extension**: The primary VS Code extension for working with Quarto documents
- **Writer**: A web-based editor for Quarto documents
- **LSP**: Language server for Quarto documents
- **Core Packages**: Shared libraries used across multiple components

## Repository Structure

The repository is organized as a monorepo using Yarn workspaces:

- `apps/`: Contains standalone applications
  - `vscode/`: VS Code extension for Quarto
  - `writer/`: Web-based Quarto editor
  - `lsp/`: Language Server Protocol implementation
  - `panmirror/`: WYSIWYG editor component
- `packages/`: Contains shared libraries
  - `core/`: Core functionality shared across packages
  - `editor-*/`: Editor-related packages
  - `quarto-core/`: Quarto-specific core functionality
  - Other utility packages


## Additional Resources

- [Quarto Website](https://quarto.org)
- [Extension on Microsoft marketplace](https://marketplace.visualstudio.com/items?itemName=quarto.quarto)
- [Extension on Open VSX Registry](https://open-vsx.org/extension/quarto/quarto)
- [Quarto GitHub Organization](https://github.com/quarto-dev)
