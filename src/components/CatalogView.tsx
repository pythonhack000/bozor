"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useCategories } from "@/lib/categories-context";
import { getListingsByCategory, type ListingWithRelations } from "@/lib/db";
import type { DeliveryType } from "@/lib/types";
import { CategoryImage } from "./CategoryImage";
import { ListingCard } from "./ListingCard";
import { Breadcrumbs } from "./Breadcrumbs";

type SortKey = "popular" | "priceAsc" | "priceDesc" | "new";

export function CatalogView({ categorySlug }: { categorySlug: string }) {
  const { t, tl } = useI18n();
  const { categories } = useCategories();
  const category = categories.find((c) => c.slug === categorySlug);
  const [allListings, setAllListings] = useState<ListingWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    getListingsByCategory(categorySlug).then((rows) => {
      if (!cancelled) {
        setAllListings(rows);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [categorySlug]);

  const [sort, setSort] = useState<SortKey>("popular");
  const [priceFrom, setPriceFrom] = useState("");
  const [priceTo, setPriceTo] = useState("");
  const [delivery, setDelivery] = useState<Set<DeliveryType>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleDelivery = (d: DeliveryType) => {
    setDelivery((prev) => {
      const next = new Set(prev);
      if (next.has(d)) {
        next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  };

  const results = useMemo(() => {
    let list = allListings.filter((l) => {
      if (priceFrom && l.price < Number(priceFrom)) return false;
      if (priceTo && l.price > Number(priceTo)) return false;
      if (delivery.size > 0 && !delivery.has(l.delivery)) return false;
      return true;
    });

    switch (sort) {
      case "priceAsc":
        list = [...list].sort((a, b) => a.price - b.price);
        break;
      case "priceDesc":
        list = [...list].sort((a, b) => b.price - a.price);
        break;
      case "new":
        list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        break;
      default:
        list = [...list].sort((a, b) => b.views - a.views);
    }
    return list;
  }, [allListings, sort, priceFrom, priceTo, delivery]);

  if (!category) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  const resetFilters = () => {
    setPriceFrom("");
    setPriceTo("");
    setDelivery(new Set());
  };

  const FiltersPanel = (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2.5 text-sm font-semibold text-foreground">{t("catalog.priceFrom")}</h4>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
            placeholder="0"
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
          <span className="text-xs text-muted">{t("catalog.priceTo")}</span>
          <input
            type="number"
            value={priceTo}
            onChange={(e) => setPriceTo(e.target.value)}
            placeholder="9999"
            className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-sm font-semibold text-foreground">{t("catalog.deliveryType")}</h4>
        <div className="space-y-2">
          {(["instant", "manual"] as DeliveryType[]).map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-foreground/90">
              <input
                type="checkbox"
                checked={delivery.has(d)}
                onChange={() => toggleDelivery(d)}
                className="h-4 w-4 rounded border-border accent-[var(--brand)]"
              />
              {d === "instant" ? t("catalog.deliveryInstant") : t("catalog.deliveryManual")}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={resetFilters}
        className="w-full rounded-lg border border-border py-2 text-sm text-muted transition hover:border-brand/40 hover:text-foreground"
      >
        {t("catalog.reset")}
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumbs
        items={[
          { label: t("common.siteName"), href: "/" },
          { label: t("nav.categories"), href: "/" },
          { label: tl(category.name) },
        ]}
      />

      <div className="mt-4 flex items-center gap-3">
        <CategoryImage category={category} size={48} />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tl(category.name)}</h1>
          <p className="text-sm text-muted">
            {results.length} {t("catalog.resultsCount")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <SlidersHorizontal size={15} />
              {t("catalog.filters")}
            </h3>
            {FiltersPanel}
          </div>
        </aside>

        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground/90 lg:hidden"
            >
              <SlidersHorizontal size={15} />
              {t("catalog.filters")}
            </button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="ml-auto rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
            >
              <option value="popular">{t("catalog.sortPopular")}</option>
              <option value="priceAsc">{t("catalog.sortPriceAsc")}</option>
              <option value="priceDesc">{t("catalog.sortPriceDesc")}</option>
              <option value="new">{t("catalog.sortNew")}</option>
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-muted" />
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
              {t("catalog.noResults")}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {results.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFiltersOpen(false)} />
          <div className="relative ml-auto flex h-full w-80 max-w-[85vw] flex-col overflow-y-auto bg-surface-2 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("catalog.filters")}</h3>
              <button onClick={() => setFiltersOpen(false)} className="text-muted">
                <X size={20} />
              </button>
            </div>
            {FiltersPanel}
            <button
              onClick={() => setFiltersOpen(false)}
              className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("catalog.apply")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
