/*
 * xref-popup.tsx
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { Schema } from 'prosemirror-model';
import { PluginKey } from 'prosemirror-state';
import { DecorationSet, EditorView } from 'prosemirror-view';

import React from 'react';

import { EditorUI } from '../../api/ui-types';
import { textPopupDecorationPlugin, TextPopupTarget } from '../../api/text-popup';
import { WidgetProps } from '../../api/widgets/react';
import { Popup } from '../../api/widgets/popup';
import { xrefKey, parseQuartoXRef } from '../../api/xref';
import { LinkButton } from '../../api/widgets/button';

import './cite-popup-xref.css';
import { EditorServer, XRef } from 'editor-types';

const kMaxWidth = 350;

export function citeXrefPopupPlugin(schema: Schema, ui: EditorUI, server: EditorServer) {
  return textPopupDecorationPlugin({
    key: new PluginKey<DecorationSet>('cite-xref-popup'),
    markType: schema.marks.cite_id,
    maxWidth: kMaxWidth,
    dismissOnEdit: false,
    createPopup: async (_view: EditorView, target: TextPopupTarget, style: React.CSSProperties) => {

      // lookup xref on server
      const docPath = ui.context.getDocumentPath();
      if (docPath) {

        const citeId = target.text.replace(/^-@|^@/, '');
        const parsed = parseQuartoXRef(citeId);
        if (parsed) {
          const { id, type } = parsed;

          const xrefs = await server.xref.quartoXrefForId(docPath, `${type.toLowerCase()}-${id}`);
          if (xrefs.refs.length > 0) {
            if (xrefs.refs.length) {
              const xref = xrefs.refs[0];

              // click handler
              const onClick = () => {
                const file = xrefs.baseDir + '/' + xref.file;
                ui.display.navigateToXRef(file, xref);
              };

              return <XrefCitefPopup xref={xref} onClick={onClick} style={style} />;
            }
          }
        }
      }
      return null;
    }
  });
}

interface XRefCitePopupProps extends WidgetProps {
  xref: XRef;
  onClick: VoidFunction;
  style: React.CSSProperties;
}

const XrefCitefPopup: React.FC<XRefCitePopupProps> = props => {
  return (
    <Popup classes={['pm-cite-xref-popup']} style={props.style} >
      <div>
        <LinkButton
          text={xrefKey(props.xref, "quarto")}
          onClick={props.onClick}
          maxWidth={kMaxWidth - 20
          }
          classes={['pm-cite-xref-popup-key pm-fixedwidth-font']}
        />
      </div>
      {props.xref.title ? (
        <div className="pm-cite-xref-popup-text" >{props.xref.title} </div>
      ) : null}
      <div className="pm-cite-xref-popup-file" >{props.xref.file} </div>
    </Popup>
  );
};
