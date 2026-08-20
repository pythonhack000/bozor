"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, Heart, Flag, ShieldCheck, Loader2, Star, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import {
  getListing,
  getListingsByCategory,
  getReviewsForListing,
  hasReleasedOrder,
  hasReviewedListing,
  deleteListing,
  adminDeleteListing,
  type ListingWithRelations,
} from "@/lib/db";
import type { Review } from "@/lib/types";
import { BASE_PATH } from "@/lib/base-path";
import { Breadcrumbs } from "./Breadcrumbs";
import { InstantBadge } from "./Badges";
import { SellerMiniCard } from "./SellerMiniCard";
import { ListingCard } from "./ListingCard";
import { RatingStars } from "./RatingStars";
import { Avatar } from "./Avatar";
import { BuyModal } from "./BuyModal";
import { ReviewModal } from "./ReviewModal";
import { ReportModal } from "./ReportModal";

function DeleteListingControls({
  listingId,
  isAdmin,
  onDeleted,
}: {
  listingId: string;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");

  const confirm = async () => {
    if (isAdmin && !reason.trim()) return;
    setStatus("deleting");
    try {
      if (isAdmin) {
        await adminDeleteListing(listingId, reason.trim());
      } else {
        await deleteListing(listingId);
      }
      onDeleted();
    } catch (err) {
      console.error("Failed to delete listing", err);
      setStatus("error");
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-danger/40 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
      >
        <Trash2 size={14} />
        {t(isAdmin ? "listing.adminDeleteButton" : "listing.deleteButton")}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-danger/30 bg-danger/5 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-danger">{t("listing.deleteConfirmTitle")}</p>
        <button onClick={() => setConfirming(false)} className="text-muted hover:text-foreground">
          <X size={15} />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">{t("listing.deleteConfirmDesc")}</p>

      {isAdmin && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={t("listing.adminDeleteReasonPlaceholder")}
          className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-danger/50 focus:outline-none"
        />
      )}

      {status === "error" && <p className="mt-2 text-xs text-danger">{t("listing.deleteError")}</p>}

      <div className="mt-2.5 flex gap-2">
        <button
          onClick={() => setConfirming(false)}
          disabled={status === "deleting"}
          className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
        >
          {t("listing.deleteCancel")}
        </button>
        <button
          onClick={confirm}
          disabled={status === "deleting" || (isAdmin && !reason.trim())}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-danger py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {status === "deleting" && <Loader2 size={13} className="animate-spin" />}
          {t("listing.deleteConfirm")}
        </button>
      </div>
    </div>
  );
}

export function ListingView() {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [listing, setListing] = useState<ListingWithRelations | null>(null);
  const [itemReviews, setItemReviews] = useState<Review[]>([]);
  const [similar, setSimilar] = useState<ListingWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    getListing(id).then(async (found) => {
      if (cancelled) return;
      setListing(found);
      if (found) {
        const [reviewRows, similarRows] = await Promise.all([
          getReviewsForListing(found.id),
          getListingsByCategory(found.categorySlug),
        ]);
        if (cancelled) return;
        setItemReviews(reviewRows);
        setSimilar(similarRows.filter((l) => l.id !== found.id).slice(0, 4));
      }
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!user || !listing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanReview(false);
      return;
    }
    let cancelled = false;
    Promise.all([hasReleasedOrder(user.id, listing.id), hasReviewedListing(user.id, listing.id)]).then(
      ([released, reviewed]) => {
        if (cancelled) return;
        setCanReview(released);
        setAlreadyReviewed(reviewed);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [user, listing]);

  const refreshReviews = () => {
    if (!listing) return;
    getReviewsForListing(listing.id).then(setItemReviews);
    setAlreadyReviewed(true);
  };

  const handlePurchased = () => {
    if (!listing) return;
    getListing(listing.id).then((found) => found && setListing(found));
  };

  const handleBuyClick = () => {
    if (!listing) return;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/listing?id=${listing.id}`)}`);
      return;
    }
    setBuyOpen(true);
  };

  const handleReportClick = () => {
    if (!listing) return;
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/listing?id=${listing.id}`)}`);
      return;
    }
    setReportOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted" />
      </div>
    );
  }

  if (!id || !listing) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted">{t("listing.notFound")}</div>;
  }

  const { category, seller } = listing;
  const coverImage = listing.images[0];

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
            {coverImage ? (
              <Image src={coverImage} alt={tl(listing.title)} fill sizes="(max-width: 1024px) 100vw, 800px" priority className="object-cover" />
            ) : (
              <>
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
              </>
            )}
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
            <button
              onClick={handleReportClick}
              className="ml-auto flex items-center gap-1 text-muted hover:text-danger"
            >
              <Flag size={13} />
              {t("listing.reportListing")}
            </button>
          </div>

          {listing.attrs.length > 0 && (
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
          )}

          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t("listing.description")}</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{tl(listing.description)}</p>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">
                {t("listing.reviewsTitle")} {itemReviews.length > 0 && `(${itemReviews.length})`}
              </h2>
              {canReview && !alreadyReviewed && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground/90 transition hover:border-brand/40"
                >
                  <Star size={13} />
                  {t("review.leaveReview")}
                </button>
              )}
            </div>
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

        <div className="order-first space-y-4 lg:order-last lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{listing.price}</span>
              <span className="text-sm text-muted">{t("common.currency")}</span>
              {listing.oldPrice && (
                <span className="text-sm text-muted line-through">{listing.oldPrice}</span>
              )}
            </div>
            {listing.status === "sold" ? (
              <p className="mt-1 text-xs text-muted">{t("listing.sold")}</p>
            ) : (
              <p className="mt-1 text-xs text-brand">{t("listing.inStock")}</p>
            )}

            {listing.status === "sold" ? (
              <button
                disabled
                className="mt-4 w-full rounded-xl bg-surface-2 py-3 text-sm font-semibold text-muted"
              >
                {t("listing.sold")}
              </button>
            ) : user?.id === seller.id ? null : (
              <button
                onClick={handleBuyClick}
                className="mt-4 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
              >
                {t("listing.buyNow")}
              </button>
            )}

            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={13} className="text-brand" />
              {t("listing.guaranteeText")}
            </div>

            {user?.isAdmin ? (
              <DeleteListingControls listingId={listing.id} isAdmin onDeleted={() => router.push("/")} />
            ) : user?.id === seller.id ? (
              <DeleteListingControls
                listingId={listing.id}
                isAdmin={false}
                onDeleted={() => router.push(`/seller?id=${user.id}`)}
              />
            ) : null}
          </div>

          <SellerMiniCard seller={seller} listingId={listing.id} />
        </div>
      </div>

      {buyOpen && user && (
        <BuyModal listing={listing} onClose={() => setBuyOpen(false)} onPurchased={handlePurchased} />
      )}

      {reviewOpen && (
        <ReviewModal listingId={listing.id} onClose={() => setReviewOpen(false)} onSuccess={refreshReviews} />
      )}

      {reportOpen && <ReportModal listingId={listing.id} onClose={() => setReportOpen(false)} />}
    </div>
  );
}
