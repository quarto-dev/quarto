/*
 * WithCommand.tsx
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

import React, { PropsWithChildren, useContext } from 'react';

import { CommandManagerContext } from 'editor-ui';

export interface WithCommandProps {
  id: string;
}

export const WithCommand: React.FC<PropsWithChildren<WithCommandProps>> = props => {
  const [cmState] = useContext(CommandManagerContext);
  if (cmState.commands[props.id]) {
    return <>{props.children}</>;
  } else {
    return null;
  }
};
