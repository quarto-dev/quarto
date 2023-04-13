/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 * Copyright (c) 2016-2020 ParkSB.
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import type * as MarkdownIt from 'markdown-it';
import type { RendererContext } from 'vscode-notebook-renderer';

import attrPlugin from "markdown-it-attrs";
import footnotes from "markdown-it-footnote";
import { citationPlugin } from './plugins/cites';
import { divPlugin } from './plugins/divs';
import { calloutPlugin } from './plugins/callouts';
import { decoratorPlugin } from './plugins/decorator';


const styleHref = import.meta.url.replace(/index.js$/, 'styles.css');


interface MarkdownItRenderer {
	extendMarkdownIt(fn: (md: MarkdownIt) => void): void;
  renderOutputItem: (x: unknown, y: unknown) => unknown;
}

export async function activate(ctx: RendererContext<void>) {
	const markdownItRenderer = await ctx.getRenderer('vscode.markdown-it-renderer') as MarkdownItRenderer | undefined;
	
  if (!markdownItRenderer) {
		throw new Error(`Could not load 'quarto.markdown-it.qmd-extension'`);
	}

  const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.classList.add('markdown-style');
	link.href = styleHref;

  const style = document.createElement('style');
	style.textContent = `
  
	`;

  const styleTemplate = document.createElement('template');
	styleTemplate.classList.add('markdown-style');
	styleTemplate.content.appendChild(style);
	styleTemplate.content.appendChild(link);
	document.head.appendChild(styleTemplate);


	markdownItRenderer.extendMarkdownIt((md: MarkdownIt) => {

    const render = md.render.bind(md);

    md.render = (src: string, env: Record<string,unknown>) => {
      
      return render(src, env);
    }


		return md.use(footnotes, {})
             .use(citationPlugin, {})
             .use(attrPlugin, {})
             .use(divPlugin, {})
             .use(calloutPlugin, {})
             .use(decoratorPlugin, {})


	});
}

/*
  footnotes, // footnote seriously render in the cell in which they appear in :(
  spans,
  attrs,
  deflist,
  figures,
  gridtables,
  sub,
  sup,
  tasklists,
  divs,
  math
  figureDivs,
  tableCaptions,
  cites,
  mermaid,
  callouts,
  decorator,
  yaml,
  shortcodes


  */
