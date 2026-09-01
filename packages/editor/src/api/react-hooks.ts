/*
 * react-hooks.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */

import { useEffect, useRef } from "react";

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
      ref.current = value;
  });
  return ref.current;
}