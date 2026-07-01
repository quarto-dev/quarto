/*
 * WithCommand.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
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
