"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useCategories } from "@/lib/categories-context";

export function Footer() {
  const { t, tl } = useI18n();
  const { categories } = useCategories();
  return (
    <footer className="mt-16 border-t border-border bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-12 lg:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-1.5 text-lg font-bold">
              <span className="text-foreground">Acc</span>
              <span className="text-brand">Bozor</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">{t("footer.aboutText")}</p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">
              <ShieldCheck size={13} />
              {t("common.guarantee")}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2 text-sm text-muted">
              {categories.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <Link href={`/catalog/${c.slug}`} className="hover:text-foreground">
                    {tl(c.name)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t("footer.forSellers")}</h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link href="/sell" className="hover:text-foreground">
                  {t("home.ctaButton")}
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-foreground">
                  {t("nav.howItWorks")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">{t("footer.payments")}</h4>
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              {["Корти Миллӣ", "Alif", "Eskhata", "USDT"].map((p) => (
                <span key={p} className="rounded-md border border-border px-2 py-1">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted">
          © {new Date().getFullYear()} AccBozor. {t("footer.rightsReserved")}.
        </div>
      </div>
    </footer>
  );
}
