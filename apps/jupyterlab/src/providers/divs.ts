/*
* callouts.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { divPlugin } from "../plugins/divs";
import { markdownItExtension } from "./provider";

export const divs = markdownItExtension({
  id: '@quarto/divs',
  title: 'Pandoc fenced divs',
  plugin: async () => {
    return [divPlugin];
  },
  hooks: {
    preParse: {
      run: (content: string) => {
        // Detect close divs that are directly after text (e.g. not back to back whitespace)
        // and add a whitespace. This will cause the close div to become a 'block' 
        // rather than appearing as the end of the paragraph block
        const blockedDivs = content.replace(kCloseDivNoBlock, `$1\n\n$2`);
        return Promise.resolve(blockedDivs)
      }
    }
  }
});

const kCloseDivNoBlock = /([^\s])\n(:::+(?:\{.*\})?)/gm;