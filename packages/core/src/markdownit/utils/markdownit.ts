/*
* markdownit.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/

import type { Token } from "markdown-it";

// markdown-it types attribute values as `string | number`
type Attrs = Token["attrs"];
type Attr = NonNullable<Attrs>[number];

export const hasClass = (clz: string, attrs: Attrs) => {
  if (attrs === null) {
    return false
  }

  const classes = readAttrValue("class", attrs);
  if (classes === null) {
    return false;
  } else {
    return classes?.split(" ").includes(clz);
  }


}

export const readAttrValue = (name: string, attrs: Attrs) => {
  if (attrs === null) {
    return undefined;
  }

  const attr = attrs.find((attr) => { return attr[0] === name; });
  return attr ? String(attr[1]) : undefined;
}

export const addClass = (clz: string, attrs: Attrs): Attr[] => {
  if (attrs === null) {
    attrs = []
    attrs.push(["class", clz])
    return attrs;
  } else {
    const clzIdx = attrs.findIndex((attr) => attr[0] === "class");
    if (clzIdx >= 0) {
      const currentClz = attrs[clzIdx];
      attrs[clzIdx] = ["class", `${currentClz[1]} ${clz}`.trim()];
      return attrs;
    } else {
      attrs.push(["class", clz])
      return attrs; 
    }
  }
}
