/*
 * EditorError.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 *
 * Unless you have received this program directly from Posit Software pursuant
 * to the terms of a commercial license agreement with Posit Software, then
 * this program is licensed to you under the terms of version 3 of the
 * GNU Affero General Public License. This program is distributed WITHOUT
 * ANY EXPRESS OR IMPLIED WARRANTY, INCLUDING THOSE OF NON-INFRINGEMENT,
 * MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. Please refer to the
 * AGPL (http://www.gnu.org/licenses/agpl-3.0.txt) for more details.
 *
 */

import React, { PropsWithChildren, ReactNode } from "react";

import { Button, Intent, NonIdealState } from "@blueprintjs/core";
import { IconName, IconNames } from "@blueprintjs/icons";

import { t } from "editor-ui";

import { VisualEditorHostClient } from "../sync";

interface EditorErrorProps {
  title: ReactNode;
  icon?: IconName;
  host: VisualEditorHostClient;
}

const EditorError:  React.FC<PropsWithChildren<EditorErrorProps>> = (props) => {

  const { title, icon = IconNames.Document, host } = props;

  const editAction = <Button 
   outlined={true} text={t('return_to_source_mode')} 
   icon={IconNames.Code} intent={Intent.PRIMARY} 
   onClick={() => host.reopenSourceMode()}
  />;

  return (
    <NonIdealState
      icon={icon}
      title={title}
      action={editAction}
    >
     {props.children}
    </NonIdealState>
  )
};

export default EditorError;

