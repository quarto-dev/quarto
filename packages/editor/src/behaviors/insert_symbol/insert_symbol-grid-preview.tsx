/*
 * insert_symbol-grid-preview.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { CSSProperties, ReactNode } from 'react';

import { EditorUI } from '../../api/ui-types';
import { WidgetProps } from '../../api/widgets/react';

import { SymbolCharacter } from './insert_symbol-dataprovider';

import './insert_symbol-grid-preview.css';

interface SymbolPreviewProps extends WidgetProps {
  symbolCharacter: SymbolCharacter;
  symbolPreviewStyle: CSSProperties;
  ui: EditorUI;
  children: ReactNode;
}

export const SymbolPreview = React.forwardRef<any, SymbolPreviewProps>((props, ref) => {
  return (
    <div style={{ height: '54px' }} className="pm-popup-insert-symbol-preview-container" ref={ref}>
      <div className="pm-popup-insert-symbol-preview-thumbnail">
        <div style={props.symbolPreviewStyle}>{props.symbolCharacter.value}</div>
        <div className="pm-popup-insert-symbol-preview-summary">
          <div className="pm-popup-insert-symbol-preview-name pm-text-color">
            {props.ui.context.translateText(props.symbolCharacter.name)}
          </div>
          <div className="pm-popup-insert-symbol-preview-markdown pm-light-text-color">
            {props.symbolCharacter.markdown || `U+${props.symbolCharacter.codepoint?.toString(16)}`}
          </div>
        </div>
      </div>
      <div className="pm-popup-insert-symbol-preview-action">{props.children}</div>
    </div>
  );
});
