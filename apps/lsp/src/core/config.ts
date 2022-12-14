/* --------------------------------------------------------------------------------------------
 * Copyright (c) RStudio, PBC. All rights reserved.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

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

  public update(configuration: Record<string, any>) {
    this.quartoPath_ = configuration?.path || this.quartoPath_;
    this.mathJaxExtensions_ =
      configuration?.mathjax?.extensions || this.mathJaxExtensions_;
    this.mathJaxScale_ = configuration?.mathjax?.scale || this.mathJaxScale_;
    this.mathJaxTheme_ = configuration?.mathjax?.theme || this.mathJaxTheme_;
  }

  private quartoPath_: string = "";
  private mathJaxExtensions_: SupportedExtension[] = [];
  private mathJaxScale_: number = 1;
  private mathJaxTheme_: "light" | "dark" = "dark";
}

export const config = new ExtensionConfig();
