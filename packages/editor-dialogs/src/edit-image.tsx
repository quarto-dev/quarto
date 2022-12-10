/*
 * edit-image.tsx
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

import React, { useState } from "react";

import { ControlGroup, Tab, TabId, Tabs } from "@blueprintjs/core";

import { capitalizeWord } from "core"
import { FormikDialog, FormikRadioGroup, FormikTextInput, showValueEditorDialog} from "ui-widgets";
import { AttrEditInput, ImageDimensions, ImageProps, UIToolsAttr } from "editor-types";

import { editAttrFields } from "./edit-attr";

import { t } from './translate';

import styles from "./styles.module.scss";

export function editImage(attrUITools: UIToolsAttr) {
  return async (image: ImageProps, dims: ImageDimensions | null, figure: boolean, editAttributes: boolean): Promise<ImageProps | null> => {
    const { id, classes, keyvalue, ...imageAttr } = image;
    const values: EditImageDialogValues = { 
      ...attrUITools.propsToInput({ id, classes, keyvalue }), 
      ...imageAttr,
      // prevent undefined bound props
      src: imageAttr.src || '',
      title: imageAttr.title || '',
      caption: imageAttr.caption || '',
      linkTo: imageAttr.linkTo || ''
    };
 
    const result = await showValueEditorDialog(EditImageDialog, values, { 
      dims, 
      figure, 
      editAttributes
    });
    if (result && result.src) {
      const { id, classes, style, keyvalue, ...imageProps } = result;
      const props = {
        ...attrUITools.inputToProps({ id, classes, style, keyvalue }),
        ...imageProps
      };
     
      return { 
        ...props,
         // restore undefined bound props
        title: props.title || undefined,
        caption: props.caption || undefined,
        linkTo: props.linkTo || undefined
      }
    } else {
      return null;
    }
  };
}


type EditImageDialogValues = {
  src: string;
  title: string;
  caption?: string;
  alt?: string;
  align?: string;
  env?: string;
  linkTo?: string;
  width?: number;
  height?: number;
  units?: string;
  lockRatio?: boolean;
} & AttrEditInput;

interface EditImageDialogOptions {
  dims?: ImageDimensions | null;
  figure: boolean;
  editAttributes: boolean;
}


const EditImageDialog: React.FC<{ 
  values: EditImageDialogValues,
  options: EditImageDialogOptions,
  onClosed: (values?: EditImageDialogValues) => void }
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const [selectedTabId, setSelectedTabId] = useState<TabId>("image");

  const close = (values?: EditImageDialogValues) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  const sizingUI =
    props.options.editAttributes && 
    props.options.dims && 
    props.options.dims.naturalHeight !== null &&
    props.options.dims.naturalWidth !== null &&
    !props.values.keyvalue?.includes("width=") &&
    !props.values.keyvalue?.includes("height=")

  const imagePanel = 
    <div className={styles.editAttributesPanel}>
      <FormikTextInput name="src" label={t("Image")} labelInfo={t("(File or URL)")} autoFocus={true}/>
      {sizingUI ?
        <ControlGroup vertical={false}>


        </ControlGroup>
      : null}
      {props.values.align !== undefined
        ? <FormikRadioGroup 
            name={"align"} label={"Alignment:"} inline={true} 
            options={["default", "left", "center", "right"].map(value => { 
              return {
                value,
                label: capitalizeWord(value)
              }
            })} 
          />
        : null
      }
      <FormikTextInput name="caption" label={t("Caption")} placeholder={t("(Optional)")}/>
      {props.values.alt !== undefined
        ? <FormikTextInput name="alt" label={t("Alternative text")} placeholder={t("(Optional)")}/>
        : null
      }
      <FormikTextInput name="linkTo" label={t("Link to")} placeholder={t("(Optional)")}/>
    </div>;

  const attributesPanel = 
    <div className={styles.editAttributesPanel}>
      {editAttrFields()}
    </div>;

  const advancedPanel = 
    <div className={styles.editAttributesPanel}>
      {props.values.env 
        ? <FormikTextInput name="env" label={t("LaTeX environment")} />
        : null
      }
      <FormikTextInput name="title" label={t("Title attribute")} />
    </div>;

  return (
    <FormikDialog
      title={props.options.figure ? t("Figure") : t("Image")} 
      isOpen={isOpen} 
      initialValues={props.values} 
      onSubmit={(values) => close(values) }
      onReset={() => close() }
    >
       <Tabs
        id="edit-callout" 
        selectedTabId={selectedTabId} 
        onChange={tabId => setSelectedTabId(tabId)}
      >
        <Tab id="image" title={t("Image")} panel={imagePanel}/>
        {props.options.editAttributes 
          ? <Tab id="attributes" title={t("Attributes")} panel={attributesPanel} /> 
          : null
        }
        <Tab id="advanced" title={t("Advanced")} panel={advancedPanel}/>
      </Tabs>
      
    </FormikDialog>
  )
}