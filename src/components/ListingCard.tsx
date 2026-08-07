"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import type { ListingWithRelations } from "@/lib/db";
import { CategoryImage } from "./CategoryImage";
import { Avatar } from "./Avatar";

export function ListingCard({ listing }: { listing: ListingWithRelations }) {
  const { t, tl } = useI18n();
  const [fav, setFav] = useState(false);
  const { category, seller } = listing;

  return (
    <Link
      href={`/listing?id=${listing.id}`}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:bg-surface-2 hover:shadow-lg hover:shadow-black/20"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <CategoryImage category={category} size={26} />
          <span className="truncate text-[11px] text-muted">{tl(category.name)}</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            setFav((v) => !v);
          }}
          aria-label={t("common.favorite")}
          className="shrink-0 text-muted transition hover:text-danger"
        >
          <Heart size={14} className={fav ? "fill-danger text-danger" : ""} />
        </button>
      </div>

      <h3 className="line-clamp-2 min-h-[2.3rem] text-[13px] leading-snug font-medium text-foreground group-hover:text-brand">
        {tl(listing.title)}
      </h3>

      <div className="flex flex-wrap items-center gap-1">
        {listing.delivery === "instant" && (
          <span className="flex items-center gap-0.5 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
            <Zap size={9} className="fill-gold" />
            {t("listing.deliveryInstant")}
          </span>
        )}
        {listing.server && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
            {listing.server}
          </span>
        )}
        {listing.level && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
            Lv.{listing.level}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-base font-bold text-foreground">
          {listing.price} <span className="text-[11px] font-normal text-muted">{t("common.currency")}</span>
        </span>
        {listing.oldPrice && <span className="text-[11px] text-muted line-through">{listing.oldPrice}</span>}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar name={seller.name} size={16} online={seller.online} />
          <span className="truncate text-[11px] text-muted">{seller.name}</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-gold">★ {seller.rating}</span>
      </div>
    </Link>
  );
}
