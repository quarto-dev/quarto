/*
 * WorkbenchPrefsDialog.tsx
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

import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormGroup } from '@blueprintjs/core';

import { FormikHelpers } from 'formik';
import * as yup from 'yup'

import { FormikCheckbox, FormikDialog, FormikHTMLSelect, FormikNumericInput, FormikRadioGroup, FormikSwitch, FormikTextArea, FormikTextInput } from 'ui-widgets';

import { CommandManagerContext } from '../commands/CommandManager';
import { WorkbenchCommandId } from '../commands/commands';


interface TestProps {
  name: string;
  color: 'red' | 'green' | 'blue';
  fruit: 'apple' | 'banana' | 'pear';
  level: number;
  email: string;
  enabled: boolean;
  cache: boolean;
  comments: string;
}

const WorkbenchTestDialog: React.FC = () => {

  // translations
  const { t } = useTranslation();

  // command to show dialog
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [, cmDispatch] = useContext(CommandManagerContext);
  useEffect(() => {
    cmDispatch({ type: "ADD_COMMANDS", payload: [
      {
        id: WorkbenchCommandId.TestDialog,
        menuText: "Test Dialog",
        group: t('commands:group_utilities'),
        keymap: ['Mod+Shift+K'],
        isEnabled: () => true,
        isActive: () => false,
        execute: () => {
          setIsOpen(true);
        },
      },
    ]})
  }, []);

  const onSubmit = (values: TestProps, helpers: FormikHelpers<TestProps>) => {
    console.log(values);
    helpers.setSubmitting(false);
    setIsOpen(false);
  };

  const onCancel = () => {
    setIsOpen(false);
  }

  const props: TestProps = {
    name: '',
    color: 'red',
    fruit: 'banana',
    level: 5,
    email: '',
    enabled: true,
    cache: false,
    comments: ''
  }

  return (
    <FormikDialog
      title="Test Dialog" 
      isOpen={isOpen} 
      initialValues={props} 
      onSubmit={onSubmit} 
      onReset={onCancel}
      validationSchema={yup.object().shape({
        name: yup.string().required(),
        level: yup.number().min(1).max(10),
        email: yup.string().email("You must provided a valid email").required("You must provided a valid email")
      })}
    >
      <FormikTextInput name="name" label='Name' labelInfo='Your full name' helperText='This is the name we will keep on file' autoFocus={true}/>
      <FormikTextInput name="email" label='Email' labelInfo='Correspondence address'/>
      <FormikHTMLSelect name="fruit" label='Fruit' labelInfo='The fruit you want' fill={true} options={[{ value: 'apple' }, { value: 'banana' }, { value: 'pear' }]} />
      <FormikRadioGroup name="color" label="Color" inline={true} options={[{ value: 'red' }, { value: 'green' }, { value: 'blue' }]} />
      <FormikNumericInput name="level" label="Level" fill={true} />
      <FormGroup>
        <FormikCheckbox name="enabled" label="Enabled" />
        <FormikSwitch name="cache" label="Cache" />
      </FormGroup>  
      <FormikTextArea name="comments" label="Comments" fill={true} />
    </FormikDialog>
  );
};


export default WorkbenchTestDialog;


