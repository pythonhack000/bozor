"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useCategories } from "@/lib/categories-context";
import { getPaymentMethods } from "@/lib/db";
import type { PaymentMethod } from "@/lib/types";

export function Footer() {
  const { t, tl } = useI18n();
  const { categories } = useCategories();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    getPaymentMethods()
      .then(setPaymentMethods)
      .catch((err) => console.error("Failed to load payment methods", err));
  }, []);
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

          {paymentMethods.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">{t("footer.payments")}</h4>
              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {paymentMethods.map((p) => (
                  <span key={p.code} className="rounded-md border border-border px-2 py-1">
                    {tl(p.name)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-xs text-muted">
          © {new Date().getFullYear()} AccBozor. {t("footer.rightsReserved")}.
        </div>
      </div>
    </footer>
  );
}
