# Changelog

## 1.86.0 (Unreleased)

- Visual Editor: Use Fluent UI v9 as component library
- Visual Editor: Allow for \ in completion token (Julia symbol completions)
- Visual Editor: Don't encode/decode image URLs when round-tripping through editor
## 1.85.0 (Release on 07 May 2023)

- Pass working directory to Julia REPL when executing cells
- Show Quarto Assist contextual help when editing cells in visual mode

## 1.84.0 (Release on 03 May 2023)

- Support for local Zotero databases in visaul editor citations
- Toggle comment (%%) for Mermaid diagram editing
- Support math preview in list items with > 2 blocks
- Don't show GitLens hovers in Quarto Assist panel
- Restore Quarto Assist for non-qmd file types
- Fix issue w/ Visual Editor paste behavior on Windows

## 1.83.0 (Release on 28 April 2023)

- Correct syntax highlighting for list items and blockquote character
- Enable Quarto: Render Project command for Hugo and Docusausus projects
- Exclude parens from cite/crossref highlighting in visual editor
- Correct hover/preview behavior for display math in lists
- Syntax highlighting for `plantuml` code blocks
- Remove custom paste hadling for links (too many unwanted side effects)
- Only update Quarto Assist panel for Quarto docs
- Visual mode select all in codeblock now targets just the code block
- Correctly advance selection for line-by-line execution in visual mode

## 1.82.0 (Release on 21 April 2023)

- Fixed position for preview toolbar and content frame.

## 1.81.0 (Release on 14 April 2023)

- Configurable zoom behavior for HTML document preview 
- Notebook markdown renderer for Pandoc/Quarto markdown extensions 
- Correct hover behavior for multiple equations on a single line

## 1.80.0 (Release on 09 April 2023)

- Support Zotero Web Libraries in visual editor citation insert/completions

## 1.79.0 (Release on 30 March 2023)

- Improved handling/display of errors during visual editor initialization
- Prevent freeze during multi-block paste on windows.

## 1.78.0 (Release on 23 March 2023)

- Fix crossref indexing when running with Quarto v1.3
- Improve highlighting regex for citation / reference ids
- Prevent redraw of visual editor decorators on save
- Preserve visual editor focus on render errors
- Navigation to slide at cursor for reveal preview initial load
- Improve fidelity of syncing to current slide for reveal preview

## 1.77.0 (Release on 17 March 2023)

- Make Shift-Drag/Drop of images conditional on VS Code >= 1.74

## 1.76.0 (Release on 16 March 2023)

- Support for Shift-Drag/Drop of images in markdown source editor
- Provide option for visual editor font (defaults to Markdown Preview font)
- Support languages with prefix (e.g. shinylive-python) in visual editor

## 1.75.0 (Release on 14 March 2023)

- Scope Format Cell change to Python 'black' formatter only.

## 1.74.0 (Release on 13 March 2023)

- Format Cell for language formatters that don't support selection formatting
- Handle errors cleaning up virtual docs more gracefully.

## 1.73.0 (Release on 9 March 2023)

- Support for Preview in GitHub Codespaces
- Support for codicons (editor, preview) in GitHub Codespaces

## 1.72.0 (Release on 7 March 2023)

- Correct scrolling behavior for visual editor outline
- Fix preview syncing for presentations with level 1 headings
- Improve visual editor insert menu (YAML, Code Cell vs. Block)
- Add Julia code cell command to visual editor
- Handle entirely empty documents in the visual editor

## 1.71.0 (Release on 28 February 2023)

- Format Document/Range now supports workspace formatting config
- Go to Definition now works with local file references
- Ensure that empty links survive visual editor round trip
- Protect against null ref when syncing source position

## 1.70.2 (Release on 27 February 2023)

- Fix issue w/ visual editor generating heading ids for Quarto v1.3 (Pandoc 3)

## 1.70.1 (Release on 26 February 2023)

- Correct theme for math preview in visual editor

## 1.70.0 (Release on 26 February 2023)

- Cell execution and navigation for visual mode
- Mermaid and GraphViz diagram preview for visual mode
- Improved filtering of completion states based on spaces, trigger chars, etc.
- Formatting: only run for `qmd` (not `md`) and never delegate to other handlers

## 1.69.0 (Release on 23 February 2023)

- Automatically insert option comments (e.g. `#| `) on enter
- Completion for YAML options within cell comments
- Improved handling of escaped executable code blocks (required for Pandoc v3)
- Update background highlight for all visible editors (not just active)
- Improve cursor placement for YAML block insertion
- More robust handling when parsing empty yaml metadata blocks
- Fix for editor scrollIntoView that targets text nodes (as opposed to blocks)

## 1.68.0 (Release on 20 February 2023)

- Provide choice of language for insert cell command
- Fix YAML completions for 3-character prefix
- Improved gap cursor click handler (handle all code view types)
- Handle exceptions that occur when writing settings at startup
- Correct indentation for multi-line YAML completions
- Fix issue w/ handling visual mode untitled document warning
- Resolve issue w/ reading large bibliographies 
- Allow dot ('.') in citation highlighting regex 
- Derive `mathjax.theme` from name of `workbench.colorTheme`

## 1.67.0 (Release on 18 February 2023)

- Code completion for cells and YAML metadata within visual editor
- Support for editing Pandoc v3.0 Figure AST nodes.
- Change location of edit in visual/source context menu item
- Use resource scoping for visual editor preferences
- Resolve full path when setting QUARTO_PYTHON from Python extension config
- Don't offer LaTeX completions for `\\` 
- Ensure that empty code block class doesn't show up in the visual editor
- Add `mermaid` and `dot` to insert code cell snippet

## 1.66.0 (Release on 14 February 2023)

- Document, range, and cell formatting for Python and Julia code
- Write code blocks without attributes using back ticks rather than indented 4 spaces
- Automatically generate references prefix for book projects

## 1.65.0 (Release on 10 February 2023)

- Revert change to run Python blocks as one piece of code (breaks magics)

## 1.64.0 (Release on 9 February 2023)

- Support for writing markdown reference links
- Improve backspace handling for empty blocks that follow code blocks
- Fix issue with recognizing consecutive inline math expressions.
- Fix issue with shortcodes that start a line when going source to visual.
- Ignore leading and trailing whitespace when evaluating DOI search terms.
- Improved detection of inline math input (require leading space for disambiguation)
- Don't wrap sentences that are already followed by a line break
- Preserve list tight attribute when editing sublists

## 1.63.0 (Release on 8 February 2023)

- Support for executing `bash` and `sh` code cells
- Run Jupyter cells in one shot (otherwise they can run out of order)
- Implement support for Go to Definition within code cells
- Update to Mermaid JS v9.3.0 (prevent preview errors for YAML front matter)
- Only show Quarto Assist panel when the extension is activated
- Disable Copilot by default for Quarto documents
- Prevent preview from hanging when terminals run in an editor tab

## 1.62.0 (Release on 8 February 2023)

- Automatically update images in visual editor when they change on disk.
- Navigation to cross references located in other project files.
- Fix issue w/ spurious editor opens after switching modes.
- Preserve header bit when copying and pasting tables in visual mode.
- Improved paste handling from MS Word
- Scroll content in full page code blocks into view during fine
- Per-document state for show/hide of outline
- Improved editing (backspace key handling) for definition lists
- Sync visual editor syntax highlighting to current VS Code theme
- Completion: Respect absolute paths for bibliography and csl

## 1.61.0 (Release on 2 February 2023)

- Spell checking: ignore words with uppercase letters.
- Fix issue with render keybinding on Windows.
- Activate extension when visual editor loads.

## 1.60.0 (Release on 31 January 2023)

- Prevent render on save from occurring for documents not being actively previewed.
- Evaluate tex macros for equation hover/preview.
- Preview of visual markdown editor (use "Edit in Visual/Source Mode" command or context menu to switch modes).

## 1.59.0 (Release on 15 December 2022)

- Repo cleanup

## 1.58.0 (Release on 15 December 2022)

- Move to new repo (https://github.com/quarto-dev/quarto/tree/main/apps/vscode)

## 1.57.0 (Release on 3 December 2022)

- Enable preview of XML files (useful for JATS)
- Add "document" role to Quarto Lens

## 1.56.0 (Release on 19 November 2022)

- Resolve Python completion problems (adjust completion positions for inject)
- Return multiple hover results from hover provider

## 1.55.0 (Release on 11 November 2022)

- Don't use '-' as a completion trigger character (messes up crossref completions)

## 1.54.0 (Release on 31 October 2022)

- Intelligent run selection for R (runs complete statement not just line)
- Improve handling of first-run files for create project command

## 1.53.0 (Release on 27 October 2022)

- Once again use full path in WSL (previous change wasn't effective)

## 1.52.0 (Release on 26 October 2022)

- Don't include full path for preview file when running on WSL

## 1.51.0 (Release on 24 October 2022)

- Always render on save for notebooks (as they don't execute by default)
- Improved slide preview for notebooks (return last slide)

## 1.50.0 (Release on 19 October 2022)

- Run only selected text for non-empty editor selections
- Filter crossref completions by prefix match

## 1.49.0 (Release on 19 October 2022)

- Add create project command to file -> new file menu
- Don't re-show the terminal unless a rendering error occurs
- Add status bar progress for rendering
- Don't show bibliography completions unless they match the prefix

## 1.48.0 (Release on 14 October 2022)

- Implement smart paste of links (surround selected text)
- Use REditorSupport.r as ID for R extension

## 1.47.0 (Release on 13 October 2022)

- Quarto: Create Project command for creating common project types
- Don't use forward slashes in path when running Quarto with cmd /C

## 1.46.0 (Release on 10 October 2022)

- Survive missing vscode.workspace.onDidSaveNotebookDocument in versions < 1.67

## 1.45.0 (Release on 4 October 2022)

- Respect `eval: false` for cell execution commands
- LaTeX equation preview: include \newcommand (and similar) definitions in preview
- Correct package.json configuration for quick suggestions
- Outline view: protect against unparseable YAML in title block

## 1.44.0 (Release on 3 October 2022)

- Preview path compatibility for Git Bash terminal on Windows

## 1.43.0 (Release on 29 September 2022)

- Remove automatic spelling configuration for Spell Right
- Ensure that crossrefs aren't processed for display equation preview

## 1.42.0 (Release on 28 September 2022)

- Make Quarto Render commands available for `markdown` document type
- Improve default spelling ignore (ignore characters after `.` and `-` in words)
- Syntax highlighting for raw `mdx` blocks.

## 1.41.0 (Release on 25 September 2022)

- Automatically configure spell-checking for Quarto documents when the Spell Right extension is installed.
- Recognize control channel for external preview servers (Quarto v1.2)
- Allow preview for Hugo documents (Quarto v1.2 Hugo project type)

## 1.40.0 (Release on 21 September 2022)

- Improved default completion settings for Lua extension

## 1.39.0 (Release on 20 September 2022)

- Provide workspace type definitions for Lua filters and shortcodes
- Error navigation for Lua runtime errors in currently edited file
- Provide completions and diagnostics for profile specific \_quarto.yml
- Cleanup residual Quarto Preview panel on startup/reload
- Activate Quarto extension when .qmd files are in the workspace

## 1.38.0 (Release on 10 September 2022)

- Use `quarto inspect` for reading project configuration.
- Pass absolute path to `quarto preview` (prevent problems with shells that change dir on init)
- Only render on save when the preview server is already running

## 1.37.0 (Release on 5 September 2022)

- Open external preview links in new window (requires Quarto v1.2)
- Set `QUARTO_WORKING_DIR` environment variable (ensures correct working dir is used for preview)
- Remove default keybindings for bold, italic, and code (all had conflicts)

## 1.36.0 (Release on 1 September 2022)

- Render on Save option (automatically render when documents are saved)
- Keyboard shortcuts for toggling bold, italic, and code formatting
- Minimum required VS Code version is now 1.66

## 1.35.0 (Release on 31 August 2022)

- Support for render and preview of Shiny interactive docs
- Highlighting, completion, and execution for language block variations
- Rename Render Word to Render DOCX

## 1.34.0 (Release on 30 August 2022)

- Do not execute YAML option lines (enables execution of cell magics)
- Don't require a cell selection for 'Run All Cells'
- Run Python cells as distinct commands in Interactive Console
- Use Quarto executable rather than .cmd script when supported
- When not discovered on the PATH, scan for versions of Quarto in known locations

## 1.33.0 (Release on 24 August 2022)

- Code completion for cross references
- Automatic navigation to render errors for Jupyter, Knitr, and YAML
- Add Shift+Enter keybinding for running the current selection
- Fix: citation completions on Windows

## 1.32.0 (Release on 13 August 2022)

- Wait for Python environment to activate before quarto preview

## 1.31.0 (Release on 11 August 2022)

- Support for completions in \_extension.yml
- Fix for CMD shell quoting issues in quarto preview

## 1.30.0 (Release on 2 August 2022)

- Completions and hover/assist for citations
- Code snippet for inserting spans

## 1.29.0 (Release on 26 July 2022)

- Correct shell quoting for quarto preview on windows

## 1.28.0 (Release on 20 July 2022)

- Use terminal for quarto preview

## 1.27.0 (Release on 16 July 2022)

- Set LANG environment variable for quarto render/preview

## 1.26.0 (Release on 9 July 2022)

- Use output channel for quarto preview
- Fix syntax highlighting for strikethrough

## 1.25.0 (Release on 2 July 2022)

- Improve detection of current slide for revealjs preview
- Automatically disable terminal shell integration for workspace

## 1.24.0 (Release on 3 June 2022)

- Automatically insert option comment prefix in executable cells
- Remove 'Focus Lock' indicator from preview
- Fix for document outline display when there are empty headings

## 1.23.0 (Release on 29 May 2022)

- Support VS Code command keyboard shortcuts while preview is focused
- Support clipboard operations within preview iframe
- Prevent flake8 diagnostics from appearing in intellisense temp file
- Register Quarto assist panel as an explorer view

## 1.22.0 (Release on 23 May 2022)

- Improve math highlighting rules (delegate to builtin rules)

## 1.21.0 (Release on 20 May 2022)

- Move Quarto Assist panel to activity bar

## 1.20.2 (Release on 19 May 2022)

- Run preview from workspace root if there is no project
- Tolerate space between # and | for yaml option completion
- Trim trailing newline from selection for R execution

## 1.20.1 (Release on 13 May 2022)

- Debounce reporting of errors in diagram preview
- Correct path for graphviz language configuration

## 1.20.0 (Release on 12 May 2022)

- Syntax highlighting, snippets and live preview for diagrams
- Run preview for project files from project root directory
- Run cell for cells using inline knitr chunk options

## 1.19.1 (Release on 5 May 2022)

- Open file preview externally for non-localhost

## 1.19.0 (Release on 4 May 2022)

- Prompt for installation on render if quarto not found
- Print full proxied session URL when running under RSW

## 1.18.1 (Release on 3 May 2022)

- Support old and new (reditorsupport.r) R extension ids

## 1.18.0 (Release on 30 April 2022)

- Revert to using terminal for quarto preview
- Improved editor handling of shortcodes (auto-close, snippet)

## 1.17.0 (Release on 25 April 2022)

- Getting started with Quarto walkthrough
- Warn when files are saved with invalid extensions

## 1.16.0 (Release on 23 April 2022)

- Improved math syntax highlighting
- Don't include callout headers in toc

## 1.15.0 (Release on 22 April 2022)

- Icon for qmd file type
- Terminate preview command
- Don't auto-pair back-ticks

## 1.14.0 (Release on 19 April 2022)

- Format specific render commands (HTML, PDF, Word)
- Use output channel rather than terminal for preview
- Clear Cache command for Jupyter & Knitr caches
- Auto-closing pair behavior for quotes
- Preference to control preview location

## 1.13.0 (Release on 14 April 2022)

- Render button on editor toolbar
- Improved webview focus management
- Activate when executing new notebook command

## 1.12.1 (Release on 4 April 2022)

- Disable snippet suggestions by default

## 1.12.0 (Release on 3 April 2022)

- Insert code cell command (Ctrl+Shift+I)
- Navigate revealjs preview to slide at cursor
- Commands for creating documents and presentations
- Code folding for divs and front matter

## 1.11.2 (Release on 30 March 2022)

- Don't show preview in Hugo projects (hugo serve provides preview)
- Render Project command for full render of all documents in project
- Improved compatibility with VS Code web mode

## 1.11.1 (Release on 29 March 2022)

- Use Ctrl+Shift+K as keyboard shortcut for render
- Match current dark/light theme for text format preview

## 1.11.0 (Release on 29 March 2022)

- Render command with integrated preview pane
- Use same versions of Python and R as configured for their respective extensions
- Preference to use alternate quarto binary

## 1.10.0 (Release on 15 March 2022)

- Message when extensions required for cell execution aren't installed
- Scroll to top when setting assist pane contents

## 1.9.0 (Release on 13 March 2022)

- Syntax highlighting, completion, and cell execution for Julia
- Hover and assist preview for markdown images
- Assist panel content can now be pinned/unpinned

## 1.8.0 (Release on 11 March 2022)

- Syntax highlighting for embedded LaTeX
- Completion for MathJax-compatible LaTeX commands
- Hover and assist preview for MathJax equations

## 1.7.0 (Release on 8 March 2022)

- Quarto Assist panel for contextual help as you edit
- Code Lens to execute code from R executable code blocks
- Hover help provider for Quarto YAML options
- Additional language features (outline, folding, etc) in VS code for the web

## 1.6.0 (Release on 3 March 2022)

- Completion for Quarto markdown classes and attributes
- Commands and keyboard shortcuts for cell execution and navigation
- Improved markdown parsing performance
- VS code for the web compatibility (syntax highlighting and snippets)

## 1.5.2 (Release on 28 February 2022)

- Improved embedded completions for R (keep R LSP alive across requests)

## 1.5.0 (Release on 27 February 2022)

- Code completion and diagnostics for YAML front matter and cell options
- Commands and keybindings for running current cell, previous cells, and selected line(s)
- Code Lens to execute code from Python executable code blocks
- Workspace symbol provider for quick navigation to documents/headings

## 1.4.0 (Release on 23 February 2022)

- Completion, hover, and signature help for embedded languages, including
  Python, R, LaTeX, and HTML

## 1.3.0 (Release on 17 February 2022)

- Background highlighting for code cells
- Syntax highlighting for citations, divs, callouts, and code cells
- Snippets for divs, callouts, and code cells
- Improved TOC display (better icon, exclude heading markers)
- Improved completion defaults (enable quick suggestions, disable snippet and word-based suggestions)
- Use commonmark mode for markdown-it parsing

## 1.2.0 (Release on 15 February 2022)

- Clickable links within documents
- Code completion for link and image paths

## 1.1.0 (Release on 15 February 2022)

- Code folding and table of contents
- Workspace and document symbol providers
- Selection range provider

## 1.0.1 (Release on 10 February 2022)

- Minor patch to improve extension metadata and marketplace listing

## 1.0.0 (Release on 10 February 2022)

- Syntax highlighting for `.qmd` files
- Snippets for `.qmd` files
