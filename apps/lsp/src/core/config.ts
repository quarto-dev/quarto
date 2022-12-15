/*
 * config.ts
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

import type { SupportedExtension } from "mathjax-full";

export class ExtensionConfig {
  public quartoPath(): string {
    return this.quartoPath_;
  }

  public mathJaxExtensions(): SupportedExtension[] {
    return this.mathJaxExtensions_;
  }

  public mathJaxScale(): number {
    return this.mathJaxScale_;
  }

  public mathJaxTheme(): "light" | "dark" {
    return this.mathJaxTheme_;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public update(configuration: Record<string, any>) {
    this.quartoPath_ = configuration?.path || this.quartoPath_;
    this.mathJaxExtensions_ =
      configuration?.mathjax?.extensions || this.mathJaxExtensions_;
    this.mathJaxScale_ = configuration?.mathjax?.scale || this.mathJaxScale_;
    this.mathJaxTheme_ = configuration?.mathjax?.theme || this.mathJaxTheme_;
  }

  private quartoPath_ = "";
  private mathJaxExtensions_: SupportedExtension[] = [];
  private mathJaxScale_ = 1;
  private mathJaxTheme_: "light" | "dark" = "dark";
}

export const config = new ExtensionConfig();
