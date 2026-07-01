/*
 * html.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import { Node as ProsemirrorNode, Schema, DOMSerializer, Fragment } from 'prosemirror-model';

export const kHTMLCommentRegEx = /(?:^|[^`])(<!--([\s\S]*?)-->)/;

export function isHTMLComment(html: string) {
  return !!html.match(kHTMLCommentRegEx);
}

export function isSingleLineHTML(html: string) {
  return html.trimRight().split('\n').length === 1;
}

export function asHTMLTag(
  tag: string,
  attribs: { [key: string]: unknown },
  selfClosing = false,
  noEmptyAttribs = false,
) {
  const attribsHTML = Object.keys(attribs)
    .filter(name => !noEmptyAttribs || attribs[name])
    .map(name => `${name}="${escapeHTMLAttribute(String(attribs[name]))}"`)
    .join(' ');
  return `<${tag} ${attribsHTML}${selfClosing ? '/' : ''}>`;
}

export function escapeHTMLAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;') // must be first replacement
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function nodeToHTML(schema: Schema, node: ProsemirrorNode) {
  return generateHTML(() => DOMSerializer.fromSchema(schema).serializeNode(node));
}

export function fragmentToHTML(schema: Schema, fragment: Fragment) {
  return generateHTML(() => DOMSerializer.fromSchema(schema).serializeFragment(fragment));
}

function generateHTML(generator: () => Node | DocumentFragment) {
  const div = document.createElement('div');
  const output = generator();
  div.appendChild(output);
  return div.innerHTML;
}
