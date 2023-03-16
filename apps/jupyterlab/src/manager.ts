/*
* manager.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { IRenderMime, markdownRendererFactory } from '@jupyterlab/rendermime';
import { CodeMirrorEditor, Mode } from '@jupyterlab/codemirror';

import MarkdownIt, { Options } from 'markdown-it';

import { RenderedMarkdown } from './widgets';
import { Hook, MarkdownItPluginProvider, Ranked, Renderer } from './types';

// Provides resolved MarkdownIt options using the passed in options, the plugin
// options, and default options.
const resolveOptions = (widget: RenderedMarkdown, options: Options, providers: MarkdownItPluginProvider[]) => {
  // Build options table
  let allOptions: Options = {
    html: true,
    linkify: true,
    typographer: true,
    langPrefix: `cm-s-${CodeMirrorEditor.defaultConfig.theme} language-`,
    highlight: codeMirrorHighlight
  };
  for (const plugin of providers) {
    if (plugin.options) {
      try {
        // Add options for this plugin
        allOptions = { ...allOptions, ...plugin.options(widget) };
      } catch (err) {
        console.warn(`Failed to get options from markdown-it plugin ${plugin.id}`, err);
      }  
    }
  }

  return {
    ...allOptions,
    ...options };
}

export function markdownItManager() {

  // The plugin providers
  const pluginProviders: Map<string, MarkdownItPluginProvider> = new Map();

  //  The IMarkdownItManager
  const manager = {
    registerPlugin(provider: MarkdownItPluginProvider): void {
      pluginProviders.set(provider.id, provider);
    },

    async getRenderer(
      widget: RenderedMarkdown,
      options: Options = {}
    ): Promise<Renderer> {
  
      // Fetch the list of providers
      const providers = [...pluginProviders.values()];
      providers.sort(sortRanked);
  
      // Create MarkdownIt instance
      const allOptions = resolveOptions(widget, options, providers);
      let md = new MarkdownIt('default', allOptions);
  
      // Lifecycle hooks
      const preParseHooks: Hook<string, string>[] = [];
      const postRenderHooks: Hook<HTMLElement, void>[] = [];

      // add mode pre-loading hook if using default highlighter
      if (codeMirrorHighlight === allOptions.highlight) {
        preParseHooks.push(codeMirrorPreloadHook());
      }
  
      // Build MarkdownIt and load lifecycle hooks
      for (const provider of providers) {
        try {
          // Load MarkdownIt plugin
          const [plugin, ...pluginOptions] = await provider.plugin();

          // Build MarkdownIt instance
          md = md.use(plugin, ...pluginOptions);

          // Build table of lifecycle hooks
          if (provider.hooks?.preParse !== undefined) {
            preParseHooks.push(provider.hooks?.preParse);
          }
          if (provider.hooks?.postRender !== undefined) {
            postRenderHooks.push(provider.hooks?.postRender);
          }
        } catch (err) {
          console.warn(`Failed to load/use markdown-it plugin ${provider.id}`, err);
        }
      }
      // Sort hooks by rank
      preParseHooks.sort(sortRanked);
      postRenderHooks.sort(sortRanked);

      return {

        // Parse and render Markdown
        render: (content) => {
          return md.render(content)
        },

        // Run hooks serially
        preParse: async (content: string) => {
          for (const hook of preParseHooks) {
            content = await hook.run(content);
          }
          return content;
        },

        // Run hooks serially
        postRender: async (node: HTMLElement) => {
          for (const hook of postRenderHooks) {
            await hook.run(node);
          }
        }
      };
    }
  }

  // Register the Renderer
  markdownRendererFactory.createRenderer = (options: IRenderMime.IRendererOptions) => {
    return new RenderedMarkdown(options, manager);
  };
  
  return manager;
}

function codeMirrorPreloadHook(): Hook<string, string> {
  // TODO: Properly deal with {r}, {{r}} style expressions
  const fenced = new RegExp(/^`{3}([^\s]+)/g);

  return {
    run: async source => {
      const newModes = new Map<string, Promise<any>>();
      let match: RegExpMatchArray | null;
      while ((match = fenced.exec(source))) {
        if (!newModes.has(match[1])) {
          newModes.set(match[1], Mode.ensure(match[1]));
        }
      }
      if (newModes.size) {
        Promise.all(newModes.values()).catch(console.warn);
      }
      return source;
    }
  };
}

const codeMirrorHighlight = (str: string, lang: string) => {
  if (!lang) {
    return ''; // use external default escaping
  }
  try {
    const spec = Mode.findBest(lang);
    if (!spec) {
      console.warn(`No CodeMirror mode: ${lang}`);
      return '';
    }

    const el = document.createElement('div');
    try {
      Mode.run(str, spec.mime, el);
      return el.innerHTML;
    } catch (err) {
      console.warn(`Failed to highlight ${lang} code`, err);
    }
  } catch (err) {
    console.warn(`No CodeMirror mode: ${lang}`);
    console.warn(`Require CodeMirror mode error: ${err}`);
  }
  return '';
};

// Sorts by rank, using 100 if no default is provided.
const kDefaultRank = 100;
const sortRanked = (left: Ranked, right: Ranked) => {
  return (left.rank ?? kDefaultRank) - (right.rank ?? kDefaultRank);
}
