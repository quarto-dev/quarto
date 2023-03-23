/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://jestjs.io/"}
 */

import {describe, test, expect} from '@jest/globals';
import MarkdownIt, { Options } from 'markdown-it';
import { toAst } from '../../src/ast/ast';

import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import deflist from 'markdown-it-deflist';
import figures from 'markdown-it-implicit-figures';
import footnotes from 'markdown-it-footnote';
import tasklists from 'markdown-it-task-lists';
import mermaid from '../plugins/mermaid';
import attrs from 'markdown-it-attrs';
import gridtables from '../plugins/gridtables';

import { citationPlugin as cites } from '../plugins/cites';
import { calloutPlugin as callouts } from '../plugins/callouts';
import { divPlugin as divs } from '../plugins/divs';
import { headingsPlugin as headings } from '../plugins/headings';

// Provides resolved MarkdownIt options using the passed in options, the plugin
// options, and default options.
const resolveOptions = (options: Options) => {
  // Build options table
  let allOptions: Options = {
    html: true,
    linkify: true,
    typographer: true,
  };
  return {
    ...allOptions,
    ...options 
  };
}

describe('sum module', () => {
  test('adds 1 + 2 to equal 3', () => {
    const str = '# Hi there\n\nThis is a test.';

    // no current plugin uses this parameter
    const options = resolveOptions({});

    let md = new MarkdownIt('default', options)
      .use(sub)
      .use(sup)
      .use(deflist)
      .use(figures, { figcaption: true })
      .use(footnotes)
      .use(tasklists)
      .use(cites)
      .use(mermaid)
      .use(callouts)
      .use(attrs)
      .use(divs)
      .use(headings)
      .use(gridtables);
    
    console.log(toAst(md.parse(str, {})));
    expect(true).toBe(true);
  });
});


describe('nothing', () => {
  test('nothing', () => {
    expect(true).toBe(true);
  });
});
