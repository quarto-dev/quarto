/*
 * text.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React, { ChangeEventHandler } from 'react';

import { WidgetProps } from './react';

import './text.css';

export interface CheckboxInputProps extends WidgetProps {
  id?: string;
  tabIndex?: number;
  className?: string;
  checked?: boolean;
  onChange?: ChangeEventHandler;
}
  
export const CheckboxInput= React.forwardRef<HTMLInputElement, CheckboxInputProps>((props, ref) => {
  const style: React.CSSProperties = {
    ...props.style,
  };

  return (
      <input
        id={props.id} 
        type="checkbox"
        className={`
          pm-input-checkbox
          pm-text-color 
          pm-background-color 
          ${props.className}`}
        style={style}
        checked={props.checked}
        onChange={props.onChange}
        tabIndex={props.tabIndex}
        ref={ref}
      />
  );
});


