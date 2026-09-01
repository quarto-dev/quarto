/*
 * panel.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from 'react';

import { WidgetProps } from './react';

export const Panel: React.FC<WidgetProps> = props => {
  const className = ['pm-horizontal-panel'].concat(props.classes || []).join(' ');

  const children = props.children;

  return (
    <div className={className}>
      {React.Children.map(children, child => (
        <div className="pm-horizontal-panel-cell">{child}</div>
      ))}
    </div>
  );
};
