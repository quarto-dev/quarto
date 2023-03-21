/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { Title } from "@lumino/widgets";
import type MarkdownIt from "markdown-it/lib"
import Renderer from "markdown-it/lib/renderer";
import Token from "markdown-it/lib/token";
import { kDivRuleName, kTokDivClose, kTokDivOpen } from "./divs";


const kTokCalloutOpen = "quarto_callout_open";
const kTokCalloutClose = "quarto_callout_close";

const kCalloutRuleName = "quartoCallout";

const kCalloutPrefix = "callout-";

interface Callout {
  type: "note" | "caution" | "warning" | "important" | "tip" | string;
  clz: string;
  title?: string;
  icon?: boolean;
  appearance?: "default" | "minimal" | "simple";
  collapse?: boolean;
} 

const readAttrValue = (name: string, attrs: null | [string, string][]) => {
  if (attrs === null) {
    return undefined;
  }

  const attr = attrs.find((attr) => { return attr[0] === name; });
  return attr ? attr[1] : undefined;
}

const calloutAppearance = (val: string | undefined) => {
  if (val) {
    switch(val) {
      case "minimal":
        return "minimal";
      case "simple":
        return "simple"
      case "default":
      default:
        return "default";
    }
  } else {
    return "default";
  }
}

const parseCallout = (attrs: null | [string, string][]) : Callout | undefined => {
  if (attrs === null) { 
    return undefined;
  }

  const classAttr = attrs.find((attr) => { return attr[0] === "class"});
  if (!classAttr) {
    return undefined;
  }

  const classes = classAttr[1].split(" ");
  const calloutClass = classes.find((clz) => {
    return clz.startsWith('callout-');
  })

  if (calloutClass) { 
    const type = calloutClass.replace(kCalloutPrefix, "");
    const title = readAttrValue("title", attrs);
    const appearance = calloutAppearance(readAttrValue("appearance", attrs));

    return {
      type: type || "note",
      clz: calloutClass,
      title,
      appearance
    }

  } else {
    return undefined;
  }

}


// Render pandoc-style divs
function renderStartCallout(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {
  const token = tokens[idx];
  return `<div ${self.renderAttrs(token)}>`;
}

// Render pandoc-style divs
function renderEndCallout(tokens: Token[], idx: number, options: MarkdownIt.Options, env: any, self: Renderer): string {
  return `</div>`;
}

export const calloutPlugin = (md: MarkdownIt) => {
  


  // Handle pandoc-style divs
  md.core.ruler.push(
    kDivRuleName,
    (state) => {
      const noteStartCallout = (depth: number) => {
        if (calloutDepth == -1) {
          calloutDepth = depth;
        }
      }

      const isCloseCallout = (depth: number) => {
        return calloutDepth === depth;
      }

      const outTokens: Token[] = [];
      let calloutDepth = -1;
      let divDepth = 0;
      for (const token of state.tokens) {

        if (token.type === kTokDivOpen) {
          divDepth++;
          const callout = parseCallout(token.attrs);
          if (callout) {
            noteStartCallout(divDepth);
            const openCallout = new Token(kTokCalloutOpen, "", 1);
            openCallout.attrs = openCallout.attrs || [];
            openCallout.attrs.push(["class", callout.clz]);
            outTokens.push(openCallout);
          } else {
            outTokens.push(token);
          }
        } else if (token.type === kTokDivClose) {
          divDepth--;
          if (isCloseCallout(divDepth)) {
            outTokens.push(new Token(kTokCalloutClose, "", -1));
            calloutDepth = -1;
          } else {
            outTokens.push(token);
          }
        } else {
          outTokens.push(token);
        }
      }
      state.tokens = outTokens;
      return false;
    }
  )
  md.renderer.rules[kTokCalloutOpen] = renderStartCallout
  md.renderer.rules[kTokCalloutClose] = renderEndCallout
}
