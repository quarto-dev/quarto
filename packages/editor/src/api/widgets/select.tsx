/*
 * select.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { ChangeEventHandler, ReactNode } from 'react';

import { WidgetProps } from './react';

export interface SelectInputProps extends WidgetProps {
  tabIndex?: number;
  className?: string;
  onChange?: ChangeEventHandler;
  children: ReactNode;
  defaultValue?: string;
}

export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>((props, ref) => {
  const style: React.CSSProperties = {
    ...props.style,
  };

  return (
    <select
      className={`pm-input-select pm-background-color pm-pane-border-color pm-text-color ${props.className}`}
      style={style}
      tabIndex={props.tabIndex}
      ref={ref}
      onChange={props.onChange}
      defaultValue={props.defaultValue}
    >
      {props.children}
    </select>
  );
});
