/*
 * edit-list.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import React, { useState } from "react";

import { ListCapabilities, ListNumberDelim, ListNumberStyle, ListProps, ListType } from "editor-types";

import { ModalDialog, showValueEditorDialog } from "ui-widgets";

import { t } from './translate';
import { fluentTheme } from "../theme";
import { Checkbox, Field, Input, Select } from "@fluentui/react-components";

export function editList(list: ListProps, capabilities: ListCapabilities): Promise<ListProps | null> {
  return showValueEditorDialog(EditListDialog, list, capabilities);
 }

const EditListDialog: React.FC<{ 
  values: ListProps,
  options: ListCapabilities,
  onClosed: (values?: ListProps) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const [type, setType] = useState(props.values.type);
  const [tight, setTight] = useState(props.values.tight);
  const [order, setOrder] = useState(props.values.order);
  const [number_style, setNumberStyle] = useState(props.values.number_style);
  const [number_delim, setNumberDelim] = useState(props.values.number_delim);
  const [incremental] = useState(props.values.incremental);

  const close = (values?: ListProps) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  return (
    <ModalDialog
      title={t("Ordered List")}
      theme={fluentTheme()}
      isOpen={isOpen} 
      onOK={() => close({ type, tight, order: order || 1, number_style, number_delim, incremental}) }
      onCancel={() => close() }
    >
      <Field label={t("List type")}>
        <Select 
          value={type} 
          onChange={(_ev, data) => setType(data.value === ListType.Ordered ? ListType.Ordered : ListType.Bullet)} 
          multiple={false}
        >
          {Object.values(ListType).map(listType => {
            return <option value={listType} key={listType}>{listType}</option>
          })}
        </Select>
      </Field>
    
      <Checkbox 
        label={t("Tight layout (less vertical space between items)")} 
        checked={tight} 
        onChange={(_ev, data) => setTight(!!data.checked)}
      /> 
    
      {type === ListType.Ordered 
        ? <>
          <Field label={t("Starting number")}>
            <Input value={order ? String(order) : ""} onChange={(_ev, data) => {
              setOrder(Number.parseFloat(data.value) || 0);
             }} />
          </Field>

          <Field label={t("Number style")}>
            <Select 
              value={number_style} 
              onChange={(_ev, data) => setNumberStyle(data.value)} 
              multiple={false}
            >
              {Object.values(ListNumberStyle)
                .filter(
                  value => props.options.example || value !== ListNumberStyle.Example,
                )
                .map(numberStyle => {
                  return <option value={numberStyle} key={numberStyle}>{numberStyle}</option>
                })}
            </Select>
          </Field>
    
          <Field 
            label={t("Number delimiter")} 
            hint={t("Pandoc HTML output does not support custom number delimiters, so the editor will always display the period style.")}
          >
            <Select 
              value={number_delim} 
              onChange={(_ev, data) => setNumberDelim(data.value)} 
              multiple={false}
            >
              {Object.values(ListNumberDelim).map(delim => {
                return <option value={delim} key={delim}>{delim}</option>
              })}
            </Select>
          </Field>
        </>
        : null
      }
        
    </ModalDialog>
  )
}