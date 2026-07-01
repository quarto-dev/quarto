/*
 * slugify.ts
 *
 * Copyright (C) 2023 by Posit Software, PBC
 * Copyright (c) Microsoft Corporation. All rights reserved.
 */

import { pandocAutoIdentifier } from "core";
export class Slug {
  public constructor(
    public readonly value: string
  ) { }

  public equals(other: Slug): boolean {
    return this.value === other.value;
  }
}

/**
 * Generates unique ids for headers in the Markdown.
 */
export interface ISlugifier {
  fromHeading(heading: string): Slug;
}

export const pandocSlugifier: ISlugifier = new class implements ISlugifier {
  fromHeading(heading: string): Slug {
    const slugifiedHeading = pandocAutoIdentifier(heading);
    return new Slug(slugifiedHeading);
  }
};
