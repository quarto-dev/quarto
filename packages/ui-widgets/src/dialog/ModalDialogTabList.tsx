/*
 * ModalDialogTabList.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React from "react"

import { TabList, TabListProps, makeStyles, mergeClasses } from "@fluentui/react-components";


export const ModalDialogTabList : React.FC<TabListProps> = props => {
  const styles = useStyles();
  return (
    <TabList {...props} className={mergeClasses(styles.root, props.className)} />
  )
}


const useStyles = makeStyles({
  root: {
    columnGap: "12px",
    paddingBottom: "8px",
    "& .fui-Tab": {
      paddingLeft: 0,
      paddingRight: 0,
      '::after': {
        left: "2px",
        right: "2px"
      },
      '::before': {
        left: "2px",
        right: "2px"
      }
    }
  },
  
});
