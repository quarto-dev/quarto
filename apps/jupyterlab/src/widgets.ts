/*
* widgets.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { RenderedHTMLCommon, renderHTML } from '@jupyterlab/rendermime';
import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import { Message } from '@lumino/messaging';
import { MarkdownItManager, Renderer } from './types';

// A mime rendered that renders Quarto Markdown
export class RenderedMarkdown extends RenderedHTMLCommon {
  
  constructor(options: IRenderMime.IRendererOptions, manager: MarkdownItManager) {
    super(options);
    this.addClass('quarto-rendered-md');
    this.markdownItManager = manager;
  }
  private markdownItManager: MarkdownItManager;

  // Renders a mime model
  async render(model: IRenderMime.IMimeModel): Promise<void> {
    if (this.renderer === null) {
      this.renderer = await this.markdownItManager.getRenderer(this, {});
    }

    const { host, source, renderer, ...others } = {
      host: this.node,
      source: String(model.data[this.mimeType]),
      trusted: model.trusted,
      resolver: this.resolver,
      sanitizer: this.sanitizer,
      linkHandler: this.linkHandler,
      shouldTypeset: this.isAttached,
      renderer: this.renderer,
      latexTypesetter: this.latexTypesetter
    };

    // Transform source
    const markup = await renderer.preParse(source);
  
    // Clear the content if there is no source.
    if (!markup) {
      host.textContent = '';
      return;
    }
  
    // Render HTML.
    await renderHTML({
      host,
      source: renderer.render(markup),
      ...others,
      shouldTypeset: false
    });
    await renderer.postRender(host);
  }
  renderer: Renderer | null = null;

  /**
   * A message handler invoked on an `'after-attach'` message.
   */
  onAfterAttach(msg: Message): void {
    // Don't render math automatically
    // if (this.latexTypesetter ) {
    //   this.latexTypesetter.typeset(this.node);
    // }
  }
}
