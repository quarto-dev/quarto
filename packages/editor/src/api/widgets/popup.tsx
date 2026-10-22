/*
 * popup.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from 'react';

import { WidgetProps } from './react';

export type PopupProps = WidgetProps;

export const Popup: React.FC<PopupProps> = props => {
  const className = ['pm-popup', 'pm-text-color', 'pm-proportional-font', 'pm-pane-border-color', 'pm-background-color']
    .concat(props.classes || [])
    .join(' ');

  const style: React.CSSProperties = {
    ...props.style,
    position: 'absolute',
    zIndex: 10,
  };

  return (
    <div className={className} style={style} contentEditable={false} suppressContentEditableWarning={true}>
      {props.children}
    </div>
  );
};
