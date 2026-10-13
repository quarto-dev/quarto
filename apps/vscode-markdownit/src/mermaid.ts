/*
 * mermaid.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 *
 * Renders ```mermaid fences in notebook Markdown cells.
 *
 * markdown-it renders synchronously, but Mermaid's render API is async. So the
 * fence rule only emits an empty placeholder with a unique id. Once the host
 * has written the rendered HTML into the cell's shadow root (it does so right
 * after md.render returns), each diagram is rendered and the placeholder is
 * filled with an <img> whose src is the SVG as a data URL. The <img> keeps the
 * diagram inert: no script, no event handlers, and nothing is written into the
 * page as markup, so it doesn't bypass the host's sanitizer in Restricted Mode.
 */

import type { MarkdownIt, RendererRule, Token } from "markdown-it";
import type { Mermaid } from "mermaid";

const kLang = "mermaid";
const kPlaceholderClass = "quarto-mermaid";

interface PendingDiagram {
  id: string;
  source: string;
}

// Ids must be unique across render passes: a cell can re-render while an
// earlier pass is still in flight, and that pass must not find the new
// placeholders.
let nextId = 0;

// Diagrams found by the fence rule during the current md.renderer.render call
let pending: PendingDiagram[] = [];

export default function mermaidPlugin(md: MarkdownIt) {
  const defaultFenceRenderer = md.renderer.rules.fence;

  const mermaidFenceRenderer: RendererRule = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (isMermaidFence(token)) {
      const id = `${kPlaceholderClass}-${nextId++}`;
      pending.push({ id, source: token.content });
      return `<div class="${kPlaceholderClass}" id="${id}"></div>\n`;
    } else if (defaultFenceRenderer !== undefined) {
      return defaultFenceRenderer(tokens, idx, options, env, slf);
    } else {
      // Missing fence renderer!
      return "";
    }
  };
  md.renderer.rules.fence = mermaidFenceRenderer;

  const render = md.renderer.render;
  md.renderer.render = function (tokens, options, env) {
    const outer = pending;
    pending = [];
    try {
      const html = render.call(this, tokens, options, env);
      if (pending.length > 0 && typeof document !== "undefined") {
        const diagrams = pending;
        const hostId = outputItemId(env);
        queueMicrotask(() => void renderDiagrams(diagrams, hostId));
      }
      return html;
    } finally {
      pending = outer;
    }
  };
}

function isMermaidFence(token: Token) {
  return (
    token.info === kLang ||
    (token.attrs !== null &&
      token.attrs.length === 1 &&
      token.attrs[0][0] === kLang)
  );
}

// VS Code's notebook Markdown renderer passes { outputItem } as env, and the
// cell's element (whose shadow root holds the rendered HTML) has that id.
function outputItemId(env: unknown): string | undefined {
  const outputItem = (env as { outputItem?: { id?: unknown } } | undefined)
    ?.outputItem;
  return typeof outputItem?.id === "string" ? outputItem.id : undefined;
}

let mermaidPromise: Promise<Mermaid> | undefined;

// Load Mermaid on first use, so that notebooks without diagrams don't pay for it
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import("mermaid").then((m) => m.default);
  return mermaidPromise;
}

async function renderDiagrams(diagrams: PendingDiagram[], hostId?: string) {
  let mermaid: Mermaid;
  try {
    mermaid = await loadMermaid();
  } catch (e) {
    mermaidPromise = undefined;
    for (const { id } of diagrams) {
      showError(findPlaceholder(id, hostId), e);
    }
    return;
  }

  // Pick up the current theme, in case it changed since the last render
  const isDark =
    document.body.classList.contains("vscode-dark") ||
    document.body.classList.contains("vscode-high-contrast");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: isDark ? "dark" : "default",
    // report errors to us rather than drawing Mermaid's error diagram
    suppressErrorRendering: true,
  });

  for (const { id, source } of diagrams) {
    try {
      // Mermaid queues render calls internally, so they don't interleave
      const { svg } = await mermaid.render(`${id}-svg`, source);
      const placeholder = findPlaceholder(id, hostId);
      if (placeholder) {
        placeholder.replaceChildren(svgImage(svg));
      }
    } catch (e) {
      showError(findPlaceholder(id, hostId), e);
    }
  }
}

// Returns undefined if the placeholder is gone (e.g. the cell re-rendered)
function findPlaceholder(id: string, hostId?: string): HTMLElement | undefined {
  if (hostId !== undefined) {
    const host = document.getElementById(hostId);
    const el = (host?.shadowRoot ?? host)?.querySelector<HTMLElement>(
      `#${CSS.escape(id)}`
    );
    if (el) {
      return el;
    }
  }
  // Fall back to searching the document and every open shadow root
  const inDocument = document.getElementById(id);
  if (inDocument) {
    return inDocument;
  }
  for (const el of document.querySelectorAll("*")) {
    const found = el.shadowRoot?.getElementById(id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function svgImage(svg: string): HTMLImageElement {
  const img = document.createElement("img");
  // Mermaid sizes the diagram with a max-width on the root <svg>; the <img>
  // needs it too, or it scales up to the cell's width
  const maxWidth = svg.match(/^<svg[^>]*?style="[^"]*max-width:\s*([^;"]+)/)?.[1];
  if (maxWidth) {
    img.style.maxWidth = maxWidth;
  }
  img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return img;
}

function showError(placeholder: HTMLElement | undefined, e: unknown) {
  if (!placeholder) {
    return;
  }
  const pre = document.createElement("pre");
  const message = e instanceof Error ? e.message : String(e);
  pre.textContent = `Failed to render mermaid diagram. ${message}`;
  placeholder.replaceChildren(pre);
}
