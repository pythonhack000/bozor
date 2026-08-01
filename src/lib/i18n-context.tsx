"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Lang, LocalizedText } from "./types";
import { dictionaries } from "./dictionaries";

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  tl: (text: LocalizedText) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "accbozor-lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ru");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && stored in dictionaries) {
      // Syncing from localStorage after mount is intentional: the initial render
      // must match the server-rendered "ru" markup to avoid a hydration mismatch.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLangState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => dictionaries[lang][key] ?? dictionaries.ru[key] ?? key,
      tl: (text: LocalizedText) => text[lang] ?? text.ru,
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
