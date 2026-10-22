/*
 * ui-tools.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { attrPartitionKeyvalue, kStyleAttrib, pandocAttrKeyvalueFromText } from "./pandoc_attr";
import { AttrEditInput, AttrProps } from "editor-types";


export function attrInputToProps(attr: AttrEditInput): AttrProps {
  const classes = attr.classes ? attr.classes.split(/\s+/) : [];
  let keyvalue: Array<[string, string]> | undefined;
  if (attr.keyvalue || attr.style) {
    let text = attr.keyvalue || '';
    if (attr.style) {
      text += `\nstyle=${attr.style}\n`;
    }
    keyvalue = pandocAttrKeyvalueFromText(text, '\n');
  }
  return {
    id: asPandocId(attr.id || ''),
    classes: classes.map(asPandocClass),
    keyvalue: keyvalue || [],
  };
}

export function asHtmlId(id: string | undefined) {
  if (id) {
    if (id.startsWith('#')) {
      return id;
    } else {
      return '#' + id;
    }
  } else {
    return id;
  }
}


export function asPandocId(id: string) {
  return id.replace(/^#/, '');
}

function asPandocClass(clz: string) {
  return clz.replace(/^\./, '');
}

export function attrPropsToInput(attr: AttrProps): AttrEditInput {
  let style = ""
  let keyvalue = ""
  if (attr.keyvalue) {
    const partitionedKeyvalue = attrPartitionKeyvalue([kStyleAttrib], attr.keyvalue);
    if (partitionedKeyvalue.partitioned.length > 0) {
      style = partitionedKeyvalue.partitioned[0][1];
    }
    keyvalue = attrTextFromKeyvalue(partitionedKeyvalue.base);
  }

  return {
    id: asHtmlId(attr.id) || "",
    classes: attr.classes ? attr.classes.map(asHtmlClass).join(' ') : "",
    style,
    keyvalue,
  };
}

function attrTextFromKeyvalue(keyvalue: Array<[string, string]>) {
  return keyvalue.map(kv => `${kv[0]}=${kv[1]}`).join('\n');
}

function asHtmlClass(clz: string | undefined) {
  if (clz) {
    if (clz.startsWith('.')) {
      return clz;
    } else {
      return '.' + clz;
    }
  } else {
    return clz;
  }
}

