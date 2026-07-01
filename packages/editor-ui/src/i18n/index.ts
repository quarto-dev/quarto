/*
 * index.ts
 *
 * Copyright (C) 2022 by Posit Software, PBC
 */

import i18n, { TFunction } from 'i18next';

import enCommands from "./locales/en/commands.json";
import enTranslations from "./locales/en/translations.json";

export async function initEditorTranslations(): Promise<TFunction> {
  t = await i18n
    .init({
      fallbackLng: 'en',
      debug: false,
      ns: ['translations', 'commands'],
      defaultNS: 'translations',
      resources: {
        en: {
          commands: enCommands,
          translations: enTranslations
        }
      },
      keySeparator: false,
      interpolation: {
        escapeValue: false,
      },
    });
  
  

  return t;
}

export let t: TFunction;
