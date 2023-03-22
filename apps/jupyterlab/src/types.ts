/*
* types.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import MarkdownIt from 'markdown-it';
import { RenderedMarkdown } from './widgets';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { ISanitizer } from '@jupyterlab/apputils';


// Manages MarkdownIt Plugins
export interface MarkdownItManager {
  registerPlugin(provider: MarkdownItPluginProvider): void;

  getRenderer(
    widget: RenderedMarkdown,
    options?: MarkdownIt.Options
  ): Promise<Renderer>;
}

export interface Ranked {
  // Order (ascending)
  rank?: number;
}

export interface MarkdownItPlugin {
  (md: MarkdownIt, ...params: any[]): void;
}

// Interface for markup plugin lifecycle hooks
export interface Hook<A, V> extends Ranked {
  run(arg: A): Promise<V>;
}

export interface MarkdownItPluginProvider extends Ranked {
  // A unique identifier for the plugin
  id: string;
  title: string;

  // A lazy provider of the plugin function and plugin options
  plugin(): Promise<[MarkdownItPlugin, ...any]>;

  // Additional options to pass to the MarkdownIt constructor
  options?(widget: RenderedMarkdown): Partial<MarkdownIt.Options>;

  // Hooks called during the various Markdown rendering phases
  hooks?: { 
    // Source transformer hook, invoked before Markdown parsing
    preParse?: Hook<string, string>;

    // Modifier hook, invoked after rendered Markdown
    // has been added to the DOM
    postRender?: Hook<HTMLElement, void>;
  }
}

export interface RenderOptions {
  // The host node for the rendered Markdown.
  host: HTMLElement;

  // The Markdown source to render.
  source: string;

  // Whether the source is trusted.
  trusted: boolean;

  // The html sanitizer for untrusted source.
  sanitizer: ISanitizer;

  // An optional url resolver.
  resolver: IRenderMime.IResolver | null;

  // An optional link handler.
  linkHandler: IRenderMime.ILinkHandler | null;

  // Whether the node should be typeset.
  shouldTypeset: boolean;

  // MarkdownIt renderer
  renderer: Renderer;

  // The LaTeX typesetter for the application.
  latexTypesetter: IRenderMime.ILatexTypesetter | null;
}

export interface Renderer {

  // render content to HTML
  render(content: string): string;

  // Work on the pre-parsed markdown
  preParse(node: string): Promise<string>;

  // Work on the rendered HTML
  postRender(node: HTMLElement): Promise<void>;
}
