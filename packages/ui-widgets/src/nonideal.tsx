/*
 * nonideal.tsx
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

import React, { PropsWithChildren } from 'react';

import { Text } from "@fluentui/react-components"
//import { DocumentRegular, ErrorCircleFilled, ErrorCircleRegular } from "@fluentui/react-icons"

export interface NonIdealStateProps {
  title: string;
  progress?: boolean;
  icon?: "document" | "issue" | "error";
  className?: string;
}

export const NonIdealState : React.FC<PropsWithChildren<NonIdealStateProps>> = props => {
  return (
    <div>
      <Text align='center' as='h2' block={true}>{props.title}</Text>
      {props.children}
    </div>
  );
}

