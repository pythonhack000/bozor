"use client";

import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { getTopupListings, type ListingWithRelations } from "@/lib/db";
import { ListingCard } from "./ListingCard";
import { ListingCardSkeleton } from "./Skeletons";
import { Breadcrumbs } from "./Breadcrumbs";

export function DonateView() {
  const { t } = useI18n();
  const [listings, setListings] = useState<ListingWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTopupListings().then((rows) => {
      if (cancelled) return;
      setListings(rows);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumbs items={[{ label: t("common.siteName"), href: "/" }, { label: t("nav.donate") }]} />

      <div className="mt-4 flex items-center gap-3 rounded-lg border border-brand/20 bg-brand/5 p-5">
        <Gift size={28} className="shrink-0 text-brand" />
        <div>
          <h1 className="text-lg font-bold text-foreground">{t("donatePage.title")}</h1>
          <p className="mt-0.5 text-sm text-muted">{t("donatePage.subtitle")}</p>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
            {t("donatePage.empty")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
