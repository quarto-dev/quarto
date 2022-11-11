/*
 * EditorDialogEditOrderedList.tsx
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
import { useTranslation } from 'react-i18next';

import { Checkbox, FormGroup, HTMLSelect } from '@blueprintjs/core';

import { ListProps, ListEditResult, ListType, ListCapabilities } from 'editor';
import { ListNumberStyle, ListNumberDelim } from 'editor/src/nodes/list/list';

import { Dialog } from '../../../widgets/dialog/Dialog';
import { DialogNumericInput } from '../../../widgets/dialog/DialogInputs';
import { focusInput } from '../../../widgets/utils';

export interface EditorDialogEditListProps {
  list: ListProps;
  capabilities: ListCapabilities;
  isOpen: boolean;
  onClosed: (result: ListEditResult | null) => void;
}

export function defaultEditListProps(): EditorDialogEditListProps {
  return {
    list: {
      type: ListType.Ordered,
      tight: true,
      order: 1,
      number_style: ListNumberStyle.Decimal.toString(),
      number_delim: ListNumberDelim.Period.toString(),
      incremental: "default"
    },
    capabilities: {
      tasks: true,
      order: true,
      fancy: true,
      example: true,
      incremental: true,
    },
    isOpen: false,
    onClosed: () => {
      /* */
    },
  };
}

export const EditorDialogEditList: React.FC<EditorDialogEditListProps> = props => {
  const { t } = useTranslation();

  let inputOrder: HTMLInputElement | null = null;
  const setInputOrder = (input: HTMLInputElement | null) => (inputOrder = input);

  let inputNumberStyle: HTMLSelectElement | null = null;
  const setInputNumberStyle = (input: HTMLSelectElement | null) => (inputNumberStyle = input);

  let inputNumberDelimiter: HTMLSelectElement | null = null;
  const setInputNumberDelimiter = (input: HTMLSelectElement | null) => (inputNumberDelimiter = input);

  let inputTight: HTMLInputElement | null = null;
  const setInputTight = (input: HTMLInputElement | null) => (inputTight = input);

  const onOpened = () => {
    if (inputOrder) {
      focusInput(inputOrder);

      // for whatever reason the Enter key is reloading the page,
      // suppress that behavior here
      inputOrder.addEventListener('keypress', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onOK();
        }
      });
    }
  };

  const onOK = () => {
    props.onClosed({
      ...props.list,
      tight: inputTight!.checked,
      order: props.capabilities.order ? parseInt(inputOrder!.value || '1', 10) : 1,
      number_style: props.capabilities.fancy ? inputNumberStyle!.value : ListNumberStyle.DefaultStyle,
      number_delim: props.capabilities.fancy ? inputNumberDelimiter!.value : ListNumberDelim.DefaultDelim,
    });
  };

  const onCancel = () => {
    props.onClosed(null);
  };

  return (
    <Dialog
      isOpen={props.isOpen}
      title={t('edit_ordered_list_dialog_caption')}
      onOpened={onOpened}
      onOK={onOK}
      onCancel={onCancel}
    >
      {props.capabilities.order ? (
        <DialogNumericInput
          defaultValue={props.list.order.toString()}
          label={t('edit_ordered_list_dialog_order')}
          min={1}
          max={100}
          ref={setInputOrder}
        />
      ) : null}
      {props.capabilities.fancy ? (
        <>
          <FormGroup label={t('edit_ordered_list_dialog_style')}>
            <HTMLSelect
              defaultValue={props.list.number_style}
              elementRef={setInputNumberStyle}
              options={Object.values(ListNumberStyle).filter(
                value => props.capabilities.example || value !== ListNumberStyle.Example,
              )}
              fill={true}
            />
          </FormGroup>
          <FormGroup
            label={t('edit_ordered_list_dialog_delimiter')}
            helperText={t('edit_ordered_list_dialog_delimiter_helper_text')}
          >
            <HTMLSelect
              defaultValue={props.list.number_delim}
              elementRef={setInputNumberDelimiter}
              options={Object.values(ListNumberDelim)}
              fill={true}
            />
          </FormGroup>
        </>
      ) : null}
      <FormGroup>
        <Checkbox defaultChecked={props.list.tight} inputRef={setInputTight}>
          {t('edit_ordered_list_dialog_tight')}
        </Checkbox>
      </FormGroup>
    </Dialog>
  );
};
