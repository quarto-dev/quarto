/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://jestjs.io/"}
 */

import {describe, test} from '@jest/globals';
import MarkdownIt, { Options } from 'markdown-it';
import { toAst } from '../../src/ast/ast';
import { MarkdownItPluginProvider } from '../../src/types';
import { RenderedMarkdown } from '../../src/widgets';

import plugins from '../../src/index';

// Provides resolved MarkdownIt options using the passed in options, the plugin
// options, and default options.
const resolveOptions = (widget: RenderedMarkdown, options: Options, providers: MarkdownItPluginProvider[]) => {
  // Build options table
  let allOptions: Options = {
    html: true,
    linkify: true,
    typographer: true,
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

// const _testMds = [
//   '# Hello\n\n## Subsection\n\n1. one\n2. two\n3. three\n\nWow.',
//   '[foo](Hello)',
//   '[foo]{#id .class attribute=\'value\'}',
//   'This is a paragraph with a [link](http://example.com).',
//   '::: container\n\nThis is a container\n\n:::'
// ];

describe('sum module', () => {
  test('adds 1 + 2 to equal 3', () => {
    const str = '# Hi there\n\nThis is a test.';

    const providers: MarkdownItPluginProvider[] = [];
    for (const plugin of plugins) {
      if (plugin?.provider) {
        providers.push(plugin.provider);
      }
    }

    // no current plugin uses this parameter
    const options = resolveOptions(
      undefined as unknown as RenderedMarkdown,
      {},
      providers
    );

    let md = new MarkdownIt('default', options);
    console.log(toAst(md.parse(str, {})));
  });
});


