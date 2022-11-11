/*
 * HRefSelect.tsx
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

import React, { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { ControlGroup, FormGroup, HTMLSelect, Classes, InputGroup } from '@blueprintjs/core';

import { LinkTargets, LinkCapabilities, LinkType } from 'editor';

export interface HRefSelectProps {
  type: LinkType;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (type: LinkType, href: string) => any;
  targets: LinkTargets;
  capabilities: LinkCapabilities;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeRef: (ref: HTMLSelectElement | null) => any;
}



export const HRefSelect : React.FC<HRefSelectProps> = ((props: HRefSelectProps) => {
  const { t } = useTranslation();

  const [type, setType] = useState(props.type);
  const [href, setHRef] = useState(props.href);

  const suggestionsForType = (linkType: LinkType) => {
    switch (linkType) {
      case LinkType.URL:
        return [];
      case LinkType.Heading:
        return props.targets.headings.map(heading => ({
          label: heading.text,
          value: heading.text,
        }));
      case LinkType.ID:
        return props.targets.ids.map(id => ({ value: '#' + id }));
    }
  };

  const defaultHRefForType = (linkType: LinkType) => {
    const suggestions = suggestionsForType(linkType);
    return suggestions.length ? suggestions[0].value : '';
  };

  return (
    <FormGroup label={t('edit_link_dialog_href')}>
      <ControlGroup fill={true}>
        <HTMLSelect
          defaultValue={type.toString()}
          onChange={event => {
            const newType = parseInt(event.currentTarget.value, 10);
            const newHRef = defaultHRefForType(newType);
            setType(newType);
            setHRef(newHRef);
            props.onChange(newType, newHRef);
          }}
          elementRef={props.typeRef}
          options={[
            { label: t('edit_link_dialog_type_url'), value: LinkType.URL },
            ...(props.capabilities.headings
              ? [{ label: t('edit_link_dialog_type_heading'), value: LinkType.Heading }]
              : []),
            { label: t('edit_link_dialog_type_id'), value: LinkType.ID },
          ]}
          className={Classes.FIXED}
        />

        {type === LinkType.URL ? (
          <InputGroup
            defaultValue={href}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const newHRef = event.currentTarget.value;
              setHRef(newHRef);
              props.onChange(type, newHRef);
            }}
            fill={true}
          />
        ) : (
          <HTMLSelect
            defaultValue={href}
            onChange={event => {
              const newHRef = event.currentTarget.value;
              setHRef(newHRef);
              props.onChange(type, newHRef);
            }}
            options={suggestionsForType(type)}
            fill={true}
          />
        )}
      </ControlGroup>
    </FormGroup>
  );
});
