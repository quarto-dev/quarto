/*
 * EditorOutlineSidebar.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
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

import { connect } from 'react-redux';

import { CSSTransition } from 'react-transition-group';

import { TFunction } from 'i18next';
import { withTranslation } from 'react-i18next';

import { IProps } from '@blueprintjs/core';

import { EditorOutline } from 'editor';

import { WorkbenchState } from '../../../store/store';
import { setPrefsShowOutline } from '../../../store/prefs/prefs-actions';

import { CommandManager, withCommandManager } from '../../../commands/CommandManager';
import { WorkbenchCommandId } from '../../../commands/commands';

import { EditorOutlineButton } from './EditorOutlineButton';
import { EditorOutlineHeader } from './EditorOutlineHeader';
import { EditorOutlineTree } from './EditorOutlineTree';
import { EditorOutlineEmpty } from './EditorOutlineEmpty';

import styles from './EditorOutlineSidebar.module.scss';
import transition from './EditorOutlineTransition.module.scss';

export interface EditorOutlineSidebarProps extends IProps {
  setShowOutline: (showOutline: boolean) => void;
  showOutline: boolean;
  outline: EditorOutline;
  commandManager: CommandManager;
  t: TFunction;
}

interface EditorOutlineSidebarState {
  animating: boolean;
}

class EditorOutlineSidebar extends React.Component<EditorOutlineSidebarProps,EditorOutlineSidebarState> {
  constructor(props: EditorOutlineSidebarProps) {
    super(props);
    this.state = { animating: false };
    this.onOpenClicked = this.onOpenClicked.bind(this);
    this.onCloseClicked = this.onCloseClicked.bind(this);
  }

  public componentDidMount() {
    // register command used to toggle pane
    this.props.commandManager.addCommands([
      {
        id: WorkbenchCommandId.ShowOutline,
        menuText: this.props.t('commands:show_outline_menu_text'),
        group: this.props.t('commands:group_view'),
        keymap: ['Ctrl-Alt-O'],
        isEnabled: () => true,
        isActive: () => this.props.showOutline,
        execute: () => {
          this.props.setShowOutline(!this.props.showOutline);
        },
      },
    ]);
  }

  public render() {
    const outlineClassName = [styles.outline];
    if (this.props.showOutline) {
      outlineClassName.push(styles.outlineVisible);
    }

    const setAnimating = (animating: boolean) => {
      return () => {
        this.setState({animating});
      }
    }

    return (
      <>
        <EditorOutlineButton visible={!this.props.showOutline} onClick={this.onOpenClicked} />
        <CSSTransition in={this.props.showOutline} timeout={200} classNames={{ ...transition }} 
          onEnter={setAnimating(true)}
          onEntered={setAnimating(false)}
          onExit={setAnimating(true)}
          onExited={setAnimating(false)}
        >            
          <div className={outlineClassName.join(' ')}>
            <EditorOutlineHeader onCloseClicked={this.onCloseClicked} />
            {this.props.outline.length ? <EditorOutlineTree outline={this.props.outline} /> : !this.state.animating ? <EditorOutlineEmpty /> : null}
          </div>
        </CSSTransition>
      </>
    );
  }

  private onOpenClicked() {
    this.props.setShowOutline(true);
  }

  private onCloseClicked() {
    this.props.setShowOutline(false);
  }
}

const mapStateToProps = (state: WorkbenchState) => {
  return {
    showOutline: state.prefs.showOutline,
    outline: state.editor.outline,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDispatchToProps = (dispatch: any) => {
  return {
    setShowOutline: (showOutline: boolean) => dispatch(setPrefsShowOutline(showOutline)),
  };
};

export default withCommandManager(
  withTranslation()(connect(mapStateToProps, mapDispatchToProps)(EditorOutlineSidebar)),
);
