/*
 * basekeys-types.ts
 *
 * Copyright (C) 2022-2026 by Posit Software, PBC
 */


import { CommandFn } from "./command";

export enum BaseKey {
  Home = 'Home',
  End = 'End',
  Enter = 'Enter',
  ModEnter = 'Mod-Enter',
  ShiftEnter = 'Shift-Enter',
  Backspace = 'Backspace',
  Delete = 'Delete|Mod-Delete', // Use pipes to register multiple commands
  Tab = 'Tab',
  ShiftTab = 'Shift-Tab',
  ArrowUp = 'Up|ArrowUp',
  ArrowDown = 'Down|ArrowDown',
  ArrowLeft = 'Left|ArrowLeft',
  ArrowRight = 'Right|ArrowRight',
  ModArrowUp = 'Mod-Up|Mod-ArrowUp',
  ModArrowDown = 'Mod-Down|Mod-ArrowDown',
  CtrlHome = 'Ctrl-Home',
  CtrlEnd = 'Ctrl-End',
  ShiftArrowLeft = 'Shift-Left|Shift-ArrowLeft',
  ShiftArrowRight = 'Shift-Right|Shift-ArrowRight',
  AltArrowLeft = 'Alt-Left|Alt-ArrowLeft',
  AltArrowRight = 'Alt-Right|Alt-ArrowRight',
  CtrlArrowLeft = 'Ctrl-Left|Ctrl-ArrowLeft',
  CtrlArrowRight = 'Ctrl-Right|Ctrl-ArrowRight',
  CtrlShiftArrowLeft = 'Ctrl-Shift-Left|Ctrl-Shift-ArrowLeft',
  CtrlShiftArrowRight = 'Ctrl-Shift-Right|Ctrl-Shift-ArrowRight',
}

export interface BaseKeyBinding {
  key: BaseKey;
  command: CommandFn;
}
