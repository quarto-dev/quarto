/*
 * completion-detailed.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React from 'react';

import { WidgetProps } from './react';

import './completion-detailed.css';

export interface CompletionItemDetailedViewProps extends WidgetProps {
  width: number;
  image?: string;
  heading: string;
  title: string;
  subTitle: string;
}

export const CompletionItemDetailedView: React.FC<CompletionItemDetailedViewProps> = props => {
  const className = ['pm-completion-detailed-item'].concat(props.classes || []).join(' ');
  const style: React.CSSProperties = {
    width: props.width + 'px',
    ...props.style,
  };

  return (
    <div className={className} style={style}>
      <div className={'pm-completion-detailed-item-type'}>
        <img className={'pm-block-border-color'} src={props.image} draggable="false"/>
      </div>
      <div className={'pm-completion-item-detailed-summary'}>
        <div className={'pm-completion-item-detailed-heading'}>{props.heading}</div>
        <div className={'pm-completion-item-detailed-title'}>{props.title}</div>
        <div className={'pm-completion-item-detailed-subTitle'}>{props.subTitle}</div>
      </div>
    </div>
  );
};
