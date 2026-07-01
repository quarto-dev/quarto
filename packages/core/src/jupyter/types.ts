/*
 * types.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 */


// cell options + metadata
export const kCellCollapsed = "collapsed";
export const kCellAutoscroll = "autoscroll";
export const kCellDeletable = "deletable";
export const kCellFormat = "format";
export const kCellName = "name";
export const kCellTags = "tags";
export const kCellLinesToNext = "lines_to_next_cell";
export const kCellLanguage = "language";
export const kCellSlideshow = "slideshow";
export const kCellSlideshowSlideType = "slide_type";
export const kCellRawMimeType = "raw_mimetype";

export interface JupyterKernelspec {
  name: string;
  language: string;
  display_name: string;
}


export interface JupyterNotebook {
  metadata: {
    kernelspec: JupyterKernelspec;
    widgets?: Record<string, unknown>;
    [key: string]: unknown;
  };
  cells: JupyterCell[];
  nbformat: number;
  nbformat_minor: number;
}

export interface JupyterCell {
  id?: string;
  cell_type: "markdown" | "code" | "raw";
  execution_count?: null | number;
  metadata: JupyterCellMetadata;
  source: string[];
  attachments?: Record<string, Record<string, string>>;
  outputs?: JupyterOutput[];
}

export interface JupyterCellMetadata {
  // nbformat v4 spec
  [kCellCollapsed]?: boolean;
  [kCellAutoscroll]?: boolean | "auto";
  [kCellDeletable]?: boolean;
  [kCellFormat]?: string; // for "raw"
  [kCellName]?: string; // optional alias for 'label'
  [kCellTags]?: string[];
  [kCellRawMimeType]?: string;

  // used to preserve line spacing
  [kCellLinesToNext]?: number;

  // slideshow
  [kCellSlideshow]?: JupyterCellSlideshow;

  // nbdev language
  [kCellLanguage]?: string;

  // anything else
  [key: string]: unknown;
}

export interface JupyterCellSlideshow {
  [kCellSlideshowSlideType]: string;
}


export interface JupyterOutput {
  output_type: "stream" | "display_data" | "execute_result" | "error";
  execution_count?: null | number;
  isolated?: boolean;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  name?: string;
  text?: string[];
}

export interface JupyterOutputStream extends JupyterOutput {
  name: "stdout" | "stderr";
  text: string[];
}

export interface JupyterOutputDisplayData extends JupyterOutput {
  data: { [mimeType: string]: unknown };
  metadata: { [mimeType: string]: Record<string, unknown> };
  noCaption?: boolean;
}


