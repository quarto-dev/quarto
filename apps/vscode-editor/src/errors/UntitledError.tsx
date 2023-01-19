/*
 * Untitled.tsx
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

import React from "react";

import { IconNames } from "@blueprintjs/icons";

import { t } from "editor-ui";

import { VisualEditorHostClient } from "../sync";
import EditorError from "./EditorError";

interface UntitledErrorProps {
  host: VisualEditorHostClient;
}

const UntitledError:  React.FC<UntitledErrorProps> = (props) => {

  return (
    <EditorError
    icon={IconNames.Document}
    title={t("untitled_document")} 
    {...props}>
      <p>
        {t('untitled_document_cannot_be_edited')}<br/>
        {t('untitled_document_switch_and_save')}<br/>
        {t('untitled_document_reopen_visual')}
      </p>
    </EditorError> 
  );
};

export default UntitledError;

