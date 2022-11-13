/*
 * comment-content.tsx
 *
 * Copyright (C) 2019-20 by RStudio, PBC
 *
 * Unless you have received this program directly from RStudio pursuant
 * to the terms of a commercial license agreement with RStudio, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React from 'react';
import TextareaAutosize from 'react-textarea-autosize';

interface ContentPanelProps {
  readonly editable: boolean;
  readonly onCommentChange: (content: string) => void;
  readonly onHeightChange: () => void;
  readonly content: string;
}

export class ContentPanel extends React.Component<ContentPanelProps, never> {
  private readonly contentEl = React.createRef<HTMLTextAreaElement>();

  constructor(props: ContentPanelProps) {
    super(props);
    this.inputChangeListener = this.inputChangeListener.bind(this);
  }

  private inputChangeListener(e: React.ChangeEvent<HTMLTextAreaElement>) {
    this.props.onCommentChange(e.target.value || "");
  }

  private keydownListener(e: KeyboardEvent) {
    // Without this, Enter and Backspace take effect in the main document even
    // when the focus is in the comment editor
    e.stopPropagation();
  }

  public componentDidMount() {
    this.contentEl.current!.addEventListener("keydown", this.keydownListener);
    if (this.props.editable) {
      this.contentEl.current!.focus();
    }
  }

  public componentWillUnmount() {
    this.contentEl.current!.removeEventListener("keydown", this.keydownListener);
  }

  public componentDidUpdate(prevProps: ContentPanelProps) {
    // Grab focus if we just went editable
    if (this.props.editable && !prevProps.editable) {
      this.contentEl.current!.focus();
    }
  }

  public render() {
    return <TextareaAutosize
      ref = {this.contentEl}
      className = "pm-user-comment-content"
      disabled = {!this.props.editable}
      value = {this.props.content}
      onChange = {this.inputChangeListener}
      onHeightChange = {this.props.onHeightChange}
      cacheMeasurements = {true}
    />;
  }
}
