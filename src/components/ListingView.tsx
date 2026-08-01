"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, Heart, Flag, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { getCategory, getListing, getListingsByCategory, getSeller, reviews } from "@/lib/data";
import { BASE_PATH } from "@/lib/base-path";
import { Breadcrumbs } from "./Breadcrumbs";
import { InstantBadge } from "./Badges";
import { SellerMiniCard } from "./SellerMiniCard";
import { ListingCard } from "./ListingCard";
import { RatingStars } from "./RatingStars";
import { Avatar } from "./Avatar";
import { BuyModal } from "./BuyModal";

export function ListingView({ listingId }: { listingId: string }) {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [fav, setFav] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);

  const listing = getListing(listingId);
  if (!listing) return null;
  const category = getCategory(listing.categorySlug);
  const seller = getSeller(listing.sellerId);
  if (!category || !seller) return null;

  const handleBuyClick = () => {
    if (!user) {
      router.push(`/auth?next=/listing/${listingId}`);
      return;
    }
    setBuyOpen(true);
  };

  const itemReviews = reviews.filter((r) => r.listingTitle.ru === listing.title.ru);
  const similar = getListingsByCategory(listing.categorySlug)
    .filter((l) => l.id !== listing.id)
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumbs
        items={[
          { label: t("common.siteName"), href: "/" },
          { label: tl(category.name), href: `/catalog/${category.slug}` },
          { label: tl(listing.title) },
        ]}
      />

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div
            className="relative h-48 overflow-hidden rounded-lg border border-border sm:h-64"
            style={{ backgroundColor: category.color }}
          >
            {category.imageFit === "cover" && (
              <Image
                src={`${BASE_PATH}${category.image}`}
                alt=""
                fill
                aria-hidden
                sizes="(max-width: 1024px) 100vw, 800px"
                className="scale-125 object-cover opacity-50 blur-2xl"
              />
            )}
            <Image
              src={`${BASE_PATH}${category.image}`}
              alt={tl(category.name)}
              fill
              sizes="(max-width: 1024px) 100vw, 800px"
              priority
              className={`relative object-contain p-10 sm:p-14 ${category.imageFit === "contain" ? "brightness-0 invert" : ""}`}
            />
            {listing.delivery === "instant" && (
              <span className="absolute top-3 left-3">
                <InstantBadge label={t("listing.deliveryInstant")} />
              </span>
            )}
            <button
              onClick={() => setFav((v) => !v)}
              className="absolute top-3 right-3 rounded-full bg-black/30 p-2 backdrop-blur transition hover:bg-black/50"
            >
              <Heart size={17} className={fav ? "fill-danger text-danger" : "text-white"} />
            </button>
          </div>

          <h1 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">{tl(listing.title)}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Eye size={13} />
              {listing.views} {t("listing.views")}
            </span>
            <span>·</span>
            <span>{listing.createdAt}</span>
            <button className="ml-auto flex items-center gap-1 text-muted hover:text-danger">
              <Flag size={13} />
              {t("listing.reportListing")}
            </button>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t("listing.characteristics")}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {listing.attrs.map((a, i) => (
                <div key={i}>
                  <dt className="text-xs text-muted">{tl(a.label)}</dt>
                  <dd className="text-sm font-medium text-foreground">{tl(a.value)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t("listing.description")}</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{tl(listing.description)}</p>
          </div>

          <div className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {t("listing.reviewsTitle")} {itemReviews.length > 0 && `(${itemReviews.length})`}
            </h2>
            {itemReviews.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
                {t("listing.noReviews")}
              </p>
            ) : (
              <div className="space-y-3">
                {itemReviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.authorName} size={32} />
                      <div>
                        <div className="text-sm font-medium text-foreground">{r.authorName}</div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <RatingStars rating={r.rating} size={11} />
                          {r.date}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{tl(r.text)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {similar.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t("listing.similarListings")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {similar.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{listing.price}</span>
              <span className="text-sm text-muted">{t("common.currency")}</span>
              {listing.oldPrice && (
                <span className="text-sm text-muted line-through">{listing.oldPrice}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-brand">{t("listing.inStock")}</p>

            <button
              onClick={handleBuyClick}
              className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
            >
              {t("listing.buyNow")}
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={13} className="text-brand" />
              {t("listing.guaranteeText")}
            </div>
          </div>

          <SellerMiniCard seller={seller} />
        </div>
      </div>

      {buyOpen && <BuyModal listing={listing} onClose={() => setBuyOpen(false)} />}
    </div>
  );
}
