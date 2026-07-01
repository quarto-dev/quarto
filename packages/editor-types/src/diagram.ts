/*
 * diagram.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


export interface DiagramState {
  engine: "mermaid" | "graphviz";
  src: string;
}

