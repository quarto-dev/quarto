/*
 * options.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { EditorTheme } from "../editor/editor-theme";

export interface EditorOptions {
  readonly autoFocus?: boolean;
  readonly browserSpellCheck?: boolean;
  readonly commenting?: boolean;
  readonly codeEditor?: string;
  readonly rmdImagePreview?: boolean;
  readonly rmdExampleHighlight?: boolean;
  readonly hideFormatComment?: boolean;
  readonly className?: string;
  readonly outerScrollContainer?: boolean;
  readonly cannotEditUntitled?: boolean;
  readonly initialTheme?: EditorTheme;
  readonly defaultCellTypePython?: boolean;
}
