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


  const attrPlugin = (await import('markdown-it-attrs')).default;
  const citePlugin = (await import('./plugins/cites')).citationPlugin;
  const divPlugin = (await import('./plugins/divs')).divPlugin;
  const calloutPlugin = (await import('./plugins/callouts')).calloutPlugin;
	markdownItRenderer.extendMarkdownIt((md: MarkdownIt) => {

    const render = md.render.bind(md);

    md.render = (src: string, env: Record<string,unknown>) => {
      
      return render(src, env);
    }


		return md.use(citePlugin, {})
             .use(attrPlugin, {})
             .use(divPlugin, {})
             .use(calloutPlugin, {})
	});
}
