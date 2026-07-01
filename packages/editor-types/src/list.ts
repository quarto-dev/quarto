

/*
 * list.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

export enum ListType {
  Ordered = 'OrderedList',
  Bullet = 'BulletList',
}

export interface ListCapabilities {
  tasks: boolean;
  fancy: boolean;
  example: boolean;
  order: boolean;
  incremental: boolean;
}

export enum ListNumberStyle {
  DefaultStyle = 'DefaultStyle',
  Decimal = 'Decimal',
  LowerRoman = 'LowerRoman',
  UpperRoman = 'UpperRoman',
  LowerAlpha = 'LowerAlpha',
  UpperAlpha = 'UpperAlpha',
  Example = 'Example',
}

// NOTE: HTML output doesn't currently respect this and it's difficult to
// do with CSS (especially for nested lists). So we allow the user to edit
// it but it isn't reflected in the editor.
export enum ListNumberDelim {
  DefaultDelim = 'DefaultDelim',
  Period = 'Period',
  OneParen = 'OneParen',
  TwoParens = 'TwoParens',
}
