"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, MapPin, MessageCircle, Zap, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { getSeller, getSellerListings, getReviewsForSeller, type ListingWithRelations } from "@/lib/db";
import { getOrCreateConversation } from "@/lib/chat";
import type { Review, Seller } from "@/lib/types";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";
import { VerifiedBadge } from "./Badges";
import { ListingCard } from "./ListingCard";
import { Breadcrumbs } from "./Breadcrumbs";

export function SellerView() {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [seller, setSeller] = useState<Seller | null>(null);
  const [sellerListings, setSellerListings] = useState<ListingWithRelations[]>([]);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [messaging, setMessaging] = useState(false);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    getSeller(id).then(async (found) => {
      if (cancelled) return;
      setSeller(found);
      if (found) {
        const [listingRows, reviewRows] = await Promise.all([
          getSellerListings(found.id),
          getReviewsForSeller(found.id),
        ]);
        if (cancelled) return;
        setSellerListings(listingRows);
        setSellerReviews(reviewRows);
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleMessageClick = async () => {
    if (!seller) return;
    if (!user) {
      router.push("/auth?next=/messages");
      return;
    }
    setMessaging(true);
    try {
      const conversationId = await getOrCreateConversation(user.id, seller.id, null);
      router.push(`/messages?conversation=${conversationId}`);
    } finally {
      setMessaging(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!id || !seller) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted">{t("seller.notFound")}</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <Breadcrumbs items={[{ label: t("common.siteName"), href: "/" }, { label: seller.name }]} />

      <div className="mt-4 flex flex-col gap-5 rounded-lg border border-border bg-surface p-6 sm:flex-row sm:items-center">
        <Avatar name={seller.name} size={76} online={seller.online} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">{seller.name}</h1>
            {seller.verified && <VerifiedBadge />}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                seller.online ? "bg-brand/15 text-brand" : "bg-surface-2 text-muted"
              }`}
            >
              {seller.online ? t("common.online") : t("common.offline")}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-muted">
            {seller.reviewsCount > 0 ? (
              <>
                <RatingStars rating={seller.rating} />
                <span>
                  {seller.rating} ({seller.reviewsCount})
                </span>
              </>
            ) : (
              <span>{t("seller.noRating")}</span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {t("seller.memberSince")} {seller.registeredYear}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {seller.city}
            </span>
            <span className="flex items-center gap-1">
              <Zap size={12} />
              {seller.salesCount} {t("seller.sales")}
            </span>
          </div>
        </div>
        <button
          onClick={handleMessageClick}
          disabled={messaging}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
        >
          {messaging ? <Loader2 size={15} className="animate-spin" /> : <MessageCircle size={15} />}
          {t("seller.sendMessage")}
        </button>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          {t("seller.activeListings")} ({sellerListings.length})
        </h2>
        {sellerListings.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sellerListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-foreground">
          {t("seller.reviews")} {sellerReviews.length > 0 && `(${sellerReviews.length})`}
        </h2>
        {sellerReviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
            {t("listing.noReviews")}
          </p>
        ) : (
          <div className="space-y-3">
            {sellerReviews.map((r) => (
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
    </div>
  );
}
