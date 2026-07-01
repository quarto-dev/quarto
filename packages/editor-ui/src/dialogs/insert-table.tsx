/*
 * insert-table.tsx
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import React, { useState } from "react";

import { Checkbox, Field, Input, makeStyles, Textarea } from "@fluentui/react-components";

import { 
  ModalDialog,
  showValueEditorDialog 
} from "ui-widgets";


import { InsertTableResult, TableCapabilities } from "editor-types";

import { t } from './translate';
import { fluentTheme } from "../theme";

export async function insertTable(capabilities: TableCapabilities): Promise<InsertTableResult | null> {
  const values: InsertTableResult = {
    rows: 3,
    cols: 3,
    header: true,
    caption: ''
  }
  return await showValueEditorDialog(InsertTableDialog, values, capabilities);
}

const InsertTableDialog: React.FC<{ 
  values: InsertTableResult,
  options: TableCapabilities,
  onClosed: (values?: InsertTableResult) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const [rows, setRows] = useState(props.values.rows);
  const [cols, setCols] = useState(props.values.cols);
  const [header, setHeader] = useState(props.values.header);
  const [caption, setCaption] = useState(props.values.caption);

  const close = (values?: InsertTableResult) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  const styles = useStyles();

  return (
    <ModalDialog
      title={t("Insert Table")} 
      theme={fluentTheme()}
      isOpen={isOpen} 
      onOK={() => close( { rows: rows || 1, cols: cols || 1, header, caption }) }
      onCancel={() => close() }
    >
      <div className={styles.dims}>

        <Field label={t("Rows")}>
          <Input 
            value={rows ? String(rows) : ""} 
            onChange={(_ev, data) => {
              setRows(Number.parseFloat(data.value) || 0);
            }} 
          />
        </Field>

        <Field label={t("Columns")}>
          <Input 
            type="number" 
            value={cols ? String(cols) : ""} 
            onChange={(_ev, data) => {
              setCols(Number.parseFloat(data.value) || 0);
            }} 
          />
        </Field>

      </div>

      {props.options.captions ? (
        <Field label={t("Caption")}>
          <Textarea
            value={caption}
            onChange={(_ev, data) => setCaption(data.value)}
            placeholder={t("(Optional)")}
            resize="vertical"
          />
        </Field>
      ) : null}

      {props.options.headerOptional ? (
        <Checkbox label={t("Include table header")} checked={header} onChange={(_ev, data) => setHeader(!!data.checked)}/> 
      ) : null}
    </ModalDialog>
  )
}

const useStyles = makeStyles({
  dims: {
    display: 'flex',
    flexDirection: 'row',
    columnGap: '8px',
    "& .fui-Field": {
      width: '50%'
    }
  },
})
