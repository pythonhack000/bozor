"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Wallet, Search, ArrowRight, Wand2, HandCoins, CheckCircle2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useCategories } from "@/lib/categories-context";
import { getFeaturedListings, type ListingWithRelations } from "@/lib/db";
import { CategoryCard } from "@/components/CategoryCard";
import { ListingCard } from "@/components/ListingCard";

const steps = [
  { icon: Search, titleKey: "home.step1Title", descKey: "home.step1Desc" },
  { icon: Wallet, titleKey: "home.step2Title", descKey: "home.step2Desc" },
  { icon: Wand2, titleKey: "home.step3Title", descKey: "home.step3Desc" },
  { icon: CheckCircle2, titleKey: "home.step4Title", descKey: "home.step4Desc" },
];

export default function Home() {
  const { t } = useI18n();
  const { categories } = useCategories();
  const [featured, setFeatured] = useState<ListingWithRelations[]>([]);
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(true);

  useEffect(() => {
    getFeaturedListings(8)
      .then(setFeatured)
      .finally(() => setIsLoadingFeatured(false));
  }, []);

  return (
    <div>
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6 lg:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              <ShieldCheck size={13} />
              {t("common.tagline")}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">{t("home.heroSubtitle")}</p>

            <div className="relative mx-auto mt-6 max-w-md">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder={t("common.searchPlaceholder")}
                className="w-full rounded-lg border border-border bg-surface py-2.5 pr-3 pl-10 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link
                href="/catalog"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark sm:w-auto"
              >
                {t("home.heroCta")}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/sell"
                className="w-full rounded-lg border border-border px-5 py-2.5 text-center text-sm font-semibold text-foreground transition hover:border-brand/40 hover:bg-surface sm:w-auto"
              >
                {t("home.heroCtaSecondary")}
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 border-t border-border pt-5 text-sm">
              <span className="text-muted">
                <b className="font-semibold text-foreground">1 200+</b> {t("home.statSellers")}
              </span>
              <span className="text-muted">
                <b className="font-semibold text-foreground">45 000+</b> {t("home.statDeals")}
              </span>
              <span className="text-muted">
                <b className="font-semibold text-foreground">{categories.length}</b> {t("home.statCategories")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{t("home.categoriesTitle")}</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-foreground">{t("home.featuredTitle")}</h2>
          <Link href="/catalog" className="flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            {t("common.viewAll")}
            <ArrowRight size={14} />
          </Link>
        </div>
        {isLoadingFeatured ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-14 lg:px-6">
        <h2 className="mb-8 text-center text-xl font-bold text-foreground">{t("home.howItWorksTitle")}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, titleKey, descKey }, i) => (
            <div key={titleKey} className="relative rounded-lg border border-border bg-surface p-5">
              <span className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground">
                {i + 1}
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-brand">
                <Icon size={20} />
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{t(titleKey)}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-6">
        <div className="rounded-lg border border-border bg-surface p-8 text-center sm:p-12">
          <HandCoins size={28} className="mx-auto text-brand" />
          <h2 className="mt-3 text-2xl font-bold text-foreground">{t("home.ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{t("home.ctaSubtitle")}</p>
          <Link
            href="/sell"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
          >
            {t("home.ctaButton")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
