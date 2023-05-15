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

import { Card, ControlGroup, FormGroup, HTMLSelect, HTMLTable } from "@blueprintjs/core";

import { Field, ProgressBar } from "@fluentui/react-components"

import { FormikProps, useField, useFormikContext } from "formik";

import * as yup from "yup"

import { ensureExtension, equalsIgnoreCase } from "core";

import { FormikDialog, FormikHTMLSelect, FormikTextInput, showValueEditorDialog } from "ui-widgets";

import { CiteField, DOIServer, InsertCiteProps, InsertCiteResult, kAlertTypeError, kStatusNoHost, kStatusNotFound, kStatusOK, PrefsProvider } from "editor-types";
import { UIToolsCitation } from "editor";

import { t } from './translate';
import { alert } from "./alert";

import styles from './styles.module.scss';
import { fluentTheme } from "../theme";

const kIdNone = "71896BB2-16CD-4AB5-B523-6372EEB84D5D";


export function insertCite(prefs: PrefsProvider, server: DOIServer, citationTools: UIToolsCitation) {
  return async (citeProps: InsertCiteProps): Promise<InsertCiteResult | null> => {
    const defaultBiblioFile = `references.${prefs.prefs().bibliographyDefaultType}`
    const values : InsertCiteDialogValues = citeProps.citeUI && citeProps.csl
      ? { 
          id: citeProps.citeUI.suggestedId, 
          bibliographyFile: citeProps.bibliographyFiles[0] || defaultBiblioFile, 
          csl: citeProps.csl, 
          previewFields: citeProps.citeUI.previewFields,
          bibliographyType: prefs.prefs().bibliographyDefaultType 
        }
      : { 
          id: kIdNone, 
          bibliographyFile: citeProps.bibliographyFiles[0] || defaultBiblioFile, 
          csl: { type: "other" }, 
          previewFields: [],
          bibliographyType: prefs.prefs().bibliographyDefaultType 
        };
    const options = { citeProps, server, citationTools, prefs };
    const result = await showValueEditorDialog(InsertCiteDialog, values, options);
    return result || null;
  };
}

interface InsertCiteDialogValues extends InsertCiteResult {
  previewFields: CiteField[];
  bibliographyType: string;
}

interface InsertCiteDialogOptions  {
  citeProps: InsertCiteProps;
  server: DOIServer;
  citationTools: UIToolsCitation;
  prefs: PrefsProvider;
}

const InsertCiteDialog: React.FC<{
  values: InsertCiteDialogValues,
  options: InsertCiteDialogOptions,
  onClosed: (values?: InsertCiteDialogValues) => void
}
> = props => {

  const kInvalidCiteIdChars = t('Invalid characters in citation id');
  const kNonUniqueCiteId = t('This citation id already exists in your bibliography');

  const [isOpen, setIsOpen] = useState<boolean>(true);

  const close = (values?: InsertCiteDialogValues) => {
    setIsOpen(false);
    props.onClosed(values);
  }

  // alias cite props
  const citeProps = props.options.citeProps;

  return (
    <FormikDialog
      title={props.options.citeProps.provider 
              ? `${t('Citation from')} ${props.options.citeProps.provider}` 
              : `${t("Citation from DOI: ")} ${citeProps.doi}`}
      isOpen={isOpen}
      initialValues={props.values}
      onSubmit={(values) => close(values.id !== kIdNone ? values : undefined)}
      onReset={() => close()}
      theme={fluentTheme()}
      className={styles.insertCiteDialog}
      validationSchema={
        yup.object().shape({
          id: yup.string()
            .required(t('Please specify a citation id'))
            .test(kInvalidCiteIdChars, kInvalidCiteIdChars, 
                  value => !/.*[@;[\]\s!,].*/.test(value || ""))
            .test(kNonUniqueCiteId, kNonUniqueCiteId, 
                  value => !props.options.citeProps.existingIds.find(id => equalsIgnoreCase(id, value || "")) ),
          bibliographyFile: yup.string()
            .required(t('You must provide a bibliography file name.'))
        })
      }
    >
        {(formikProps: FormikProps<InsertCiteDialogValues>) => {
          if (formikProps.values.id !== kIdNone) {
            return (
              <div className={styles.insertCitePanel}>
                <FormikTextInput name={"id"} label={t('Citation Id')} autoFocus={true} />
                <FormGroup label={t('Citation')}>
                  <Card className={styles.insertCitePreview}>
                    <HTMLTable condensed={true} >
                      <tbody>
                        {formikProps.values.previewFields.map(field => {
                          return (
                            <tr key={field.name}>
                              <td>{field.name}</td>
                              <td>{field.value}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </HTMLTable>
                  </Card>
                </FormGroup>
                <SelectBibliography {...props.options} />
              </div>
            )
          } else {
            return <FetchDOI {...props.options} />
          }
        }}
     
    </FormikDialog>
  );

};


const SelectBibliography: React.FC<InsertCiteDialogOptions> = (props) => {

  const formik = useFormikContext<InsertCiteResult>();

  if (props.citeProps.bibliographyFiles.length > 0) {
    return (
      <FormikHTMLSelect 
         name={"bibliographyFile"} 
         label={t('Add to bibliography')} 
         options={props.citeProps.bibliographyFiles}
      />
    );
  } else {

    const [ typeField ] = useField("bibliographyType");

    return (
      <ControlGroup vertical={false} fill={true}>
        <FormikTextInput name="bibliographyFile" label={t('Create bibliography file')} fill={true} />
        <FormGroup label={t('Format')}>
          <HTMLSelect {...typeField} multiple={undefined} fill={true} 
            onChange={event => {
              typeField.onChange(event);
              const extension = event.currentTarget.value;
              formik.setFieldValue(
                "bibliographyFile", 
                ensureExtension(formik.values.bibliographyFile, extension)
              );
              props.prefs.setPrefs({
                bibliographyDefaultType: extension
              });
            }}
            options={[
              { value: 'bib', label: 'BibLaTeX'},
              { value: 'yaml', label: 'CSL-YAML' },
              { value: 'json', label: 'CSL-JSON' }
            ]}
          />
        </FormGroup>
      </ControlGroup>
    );
  }
  
};


const FetchDOI: React.FC<InsertCiteDialogOptions> = (props) => {

  const formik = useFormikContext<InsertCiteResult>();

  // show error and dismiss dialog
  const displayError = (title: string, message: string) => {
    formik.resetForm();
    alert(title, message, kAlertTypeError);
  };

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
        } else if (result.status === kStatusNotFound) {
          displayError(
            t('DOI Not Found'), 
            `${t('The specified DOI')} (${props.citeProps.doi}) ${t('was not found. Are you sure this is a valid DOI?')}`
          );
        } else if (result.status === kStatusNoHost) {
          displayError(
            t('Unable to Lookup DOI'), 
            `${t('Unable to connect to DOI lookup service (this may be due to an unstable or offline internet connection).')}`
          );
        } else {
          displayError(
            t('Error Looking up DOI'),
            result.error
          )
        }
      });
    } catch (err) {
      displayError(
        t('Error Looking up DOI'),
        err instanceof Error ? err.message : JSON.stringify(err)
      )
    }
  }, []);


  return (
    <Field 
      style={{backgroundColor: 'transparent'}}
      validationMessage={`${t('Looking up DOI ' + props.citeProps.doi)}...`} 
      validationState="none"
    >
      <ProgressBar 
        shape="rounded"
        thickness="large"
      />
    </Field>
  )
}


