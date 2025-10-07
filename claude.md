# Quarto Development Guide

## Project Overview

Quarto is an open-source scientific and technical publishing system built on [Pandoc](https://pandoc.org). This repository contains the source code for various parts of the Quarto ecosystem, with the main CLI implementation housed in a separate repository ([quarto-cli](https://github.com/quarto-dev/quarto-cli)).

### Main Components

- **VS Code Extension**: The primary VS Code extension for working with Quarto documents
- **Writer**: An experimental web-based editor for Quarto documents (not used in production yet)
- **LSP**: Language server for Quarto documents
- **Core Packages**: Shared libraries used across multiple components

## Repository Structure

The repository is organized as a monorepo using Yarn workspaces and Turborepo for build orchestration:

- `apps/`: Contains standalone applications
  - `vscode/`: VS Code extension for Quarto
  - `writer/`: Experimental web-based Quarto editor (not in production, ignore this for now)
  - `lsp/`: Language Server Protocol implementation
  - `panmirror/`: WYSIWYG editor component
- `packages/`: Contains shared libraries
  - `core/`: Core functionality shared across packages
  - `editor-*/`: Editor-related packages
  - `quarto-core/`: Quarto-specific core functionality
  - Other utility packages

## Build System

Quarto uses [turborepo](https://turbo.build/) to manage the monorepo build process:

- `turbo.json`: Defines the pipeline configuration for common tasks
- Common commands:
  - `yarn build`: Builds all packages and applications
  - `yarn dev-writer`: Runs the writer app in development mode
  - `yarn dev-vscode`: Runs the VS Code extension in development mode
  - `yarn lint`: Runs linters across all workspaces
  - `yarn build-vscode`: Builds only the VS Code extension and its dependencies

The turborepo pipeline helps optimize build times by caching build artifacts and respecting the dependency graph between packages.


## Additional Resources

- [Quarto Website](https://quarto.org)
- [Extension on Microsoft marketplace](https://marketplace.visualstudio.com/items?itemName=quarto.quarto)
- [Extension on Open VSX Registry](https://open-vsx.org/extension/quarto/quarto)
- [Quarto GitHub Organization](https://github.com/quarto-dev)

# Instructions
