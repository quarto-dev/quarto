/*
 * image.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

export interface ImageDimensions {
  naturalWidth: number | null;
  naturalHeight: number | null;
  containerWidth: number;
}

export interface EditorUIImageResolver {
  // resolve image uris (make relative, copy to doc local 'images' dir, etc)
  resolveImageUris: (uris: string[]) => Promise<string[]>;

  // resolve base64 images (copy to doc local 'images' dir)
  resolveBase64Images?: (base64Images: string[]) => Promise<string[]>; 

  // prompt for a local image using a dialog
  selectImage?: () => Promise<string | null>;
}



