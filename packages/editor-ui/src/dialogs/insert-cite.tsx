/*
 * insert-cite.tsx
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

import React, { useEffect, useState } from "react"

import { FormGroup, Intent, NonIdealState, Spinner, TextArea } from "@blueprintjs/core";

import { FormikProps, useFormikContext } from "formik";

import { FormikDialog, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { CiteField, DOIServer, InsertCiteProps, InsertCiteResult, kStatusOK } from "editor-types";
import { UIToolsCitation } from "editor";

import { t } from './translate';

import styles from './styles.module.scss';

export function insertCite(server: DOIServer, citationTools: UIToolsCitation) {
  return async (citeProps: InsertCiteProps): Promise<InsertCiteResult | null> => {
    const values : InsertCiteDialogValues = citeProps.citeUI && citeProps.csl
      ? { id: citeProps.citeUI.suggestedId, bibliographyFile: "", csl: citeProps.csl, previewFields: citeProps.citeUI.previewFields }
      : { id: "", bibliographyFile: "", csl: { type: "other" }, previewFields: [] };
    const options = { citeProps, server, citationTools };
    const result = await showValueEditorDialog(InsertCiteDialog, values, options);
    return result || null;
  };
}

interface InsertCiteDialogValues extends InsertCiteResult {
  previewFields: CiteField[];
}

interface InsertCiteDialogOptions  {
  citeProps: InsertCiteProps;
  server: DOIServer;
  citationTools: UIToolsCitation;
}

const InsertCiteDialog: React.FC<{
  values: InsertCiteDialogValues,
  options: InsertCiteDialogOptions,
  onClosed: (values?: InsertCiteDialogValues) => void
}
> = props => {

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: InsertCiteDialogValues) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  // alias cite props
  const citeProps = props.options.citeProps;

  return (
    <FormikDialog
      title={`${t("Citation from DOI: ")} ${citeProps.doi}`}
      isOpen={isOpen}
      initialValues={props.values}
      onSubmit={(values) => close(values.id ? values : undefined)}
      onReset={() => close()}
      className={styles.insertCiteDialog}
    >
        {(formikProps: FormikProps<InsertCiteDialogValues>) => {
          if (formikProps.values.id) {
            return (
              <div className={styles.insertCitePanel}>
                <FormikTextInput name={"id"} label={t('Citation Id')} required={true} autoFocus={true} />
                <FormGroup label={t('Citation')}>
                  <TextArea value={formikProps.values.previewFields.map(fld => `${fld.name}: ${fld.value}`).join('\n')}> 
                  </TextArea>
                </FormGroup>
              </div>
            )
          } else {
            return <FetchDOI {...props.options} />
          }
        }}
     
    </FormikDialog>
  );

};



const FetchDOI: React.FC<InsertCiteDialogOptions> = (props) => {

  const formik = useFormikContext<InsertCiteResult>();

  // initialize query after the first render
  useEffect(() => {
    try {
      props.server.fetchCSL(props.citeProps.doi).then(result => {
        if (result.status === kStatusOK) {
          const citeProps = { ...props.citeProps, csl: result.message! };
          const citeUI = props.citationTools.citeUI(citeProps);
          formik.setFieldValue("id", citeUI.suggestedId);
          formik.setFieldValue("csl", citeProps.csl);
          formik.setFieldValue("previewFields", citeUI.previewFields);
        } else {
          //
        }
      });
    } catch (err) {
      //
    }
  }, []);

  return (
    <NonIdealState
      className={styles.insertCitePanel}
      icon={<Spinner intent={Intent.PRIMARY} />}
      title={`${t('Looking up DOI')}...`}
      description={props.citeProps.doi}
    />
  )
}


