# JupyterLab Quarto Extension

[Quarto](https://www.quarto.org) is an open source project that combines Jupyter notebooks with flexible options to use a single source document to produce high-quality articles, reports, presentations, websites, and books in HTML, PDF, MS Word, ePub, and more. Quarto supports a wide variety of useful new features useful in technical documents, including support for LaTeX equations, citations, cross-references, figure panels, callouts, advanced page layout, and more. 

The JupyterLab Quarto extension allows JupyterLab to render notebooks which include Quarto markdown content.
<br/><br/>
<p align="center">
<img src="https://user-images.githubusercontent.com/261654/230087634-d5027ebc-8508-43b4-81c9-c4b7d6cfa738.png" width="60%">
</p>

## Requirements

- JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab-quarto
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab-quarto
```

## Contributing

### Development install

```bash
# From apps/jupyterlab
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Rebuild extension Typescript source after making changes
yarn build
```
Note: You will need NodeJS to build the extension package.

Note: The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
yarn watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall jupyterlab-quarto
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `jupyterlab-quarto` within that folder.

### Packaging the extension

See [RELEASE](RELEASE.md)
