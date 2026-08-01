"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import type { Lang } from "@/lib/types";

const LABELS: Record<Lang, string> = { ru: "Русский", tj: "Тоҷикӣ", en: "English" };
const SHORT: Record<Lang, string> = { ru: "RU", tj: "TJ", en: "EN" };

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-brand/40 hover:text-foreground"
      >
        <Globe size={14} />
        {SHORT[lang]}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-40 overflow-hidden rounded-xl border border-border bg-surface-2 py-1 shadow-xl">
          {(Object.keys(LABELS) as Lang[]).map((l) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-sm text-foreground/90 hover:bg-surface"
            >
              {LABELS[l]}
              {lang === l && <Check size={14} className="text-brand" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
