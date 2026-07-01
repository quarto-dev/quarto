/*
 * nonideal.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { PropsWithChildren } from 'react';

import { Text, makeStyles, tokens } from "@fluentui/react-components"
import { DocumentRegular, ErrorCircleFilled, ErrorCircleRegular } from "@fluentui/react-icons"

export interface NonIdealStateProps {
  title: string;
  action?: JSX.Element,
  icon?: "document" | "issue" | "error";
  className?: string;
}

export const NonIdealState : React.FC<PropsWithChildren<NonIdealStateProps>> = props => {

  const classes = useStyles();

  const icon = () => {
    if (props.icon) {
      switch (props.icon) {
        case "document":
          return <DocumentRegular className={classes.icon} />;
        case "issue":
          return <ErrorCircleRegular className={classes.icon}/>
        case "error":
        default:
          return <ErrorCircleFilled className={classes.icon} />
      }
    } else {
      return null;
    }
  }

  return (
    <div className={classes.root}>
      {icon()}
      <Text className={classes.title}>{props.title}</Text>
      <div className={classes.action}>
        {props.action}
      </div>
      {props.children}
    </div>
  );
}

const kVerticalSpacing = '15px';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: kVerticalSpacing,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    height: '100%',
    width: '100%',
    color: tokens.colorNeutralForeground4
  },
  icon: {
    fontSize: '64px',
  },
  title: {
    fontSize: tokens.fontSizeBase500,
  },
  action: {
  },
})

