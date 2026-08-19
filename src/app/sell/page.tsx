"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, CheckCircle2, ArrowRight, X, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useCategories } from "@/lib/categories-context";
import { CategoryImage } from "@/components/CategoryImage";
import { createListing, getSeller } from "@/lib/db";
import { uploadListingPhotos } from "@/lib/storage";
import type { DeliveryType, ListingKind } from "@/lib/types";

const STEPS = ["sell.step1Title", "sell.step2Title", "sell.step3Title"] as const;

// Must match commission_rate() in supabase/schema.sql
const COMMISSION_RATE = 0.1;

export default function SellPage() {
  const { t, tl } = useI18n();
  const { user, isLoading } = useAuth();
  const { categories } = useCategories();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth?next=/sell");
  }, [user, isLoading, router]);

  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    getSeller(user.id)
      .then((s) => setVerified(s?.verified ?? false))
      .catch((err) => {
        console.error("Failed to load verification status", err);
        setVerified(false);
      });
  }, [user]);

  const [step, setStep] = useState(0);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [kind, setKind] = useState<ListingKind>("account");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [delivery, setDelivery] = useState<DeliveryType>("manual");
  const [photos, setPhotos] = useState<{ id: string; file: File; url: string }[]>([]);
  const [published, setPublished] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 5;

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const next = Array.from(files)
      .slice(0, room)
      .map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setPhotos((prev) => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canNext =
    (step === 0 && categorySlug) || (step === 1 && title && description && price) || step === 2;

  const publish = async () => {
    if (!user || !categorySlug) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const images = photos.length
        ? await uploadListingPhotos(
            photos.map((p) => p.file),
            user.id
          )
        : [];
      const created = await createListing({
        categorySlug,
        sellerId: user.id,
        kind,
        title,
        description,
        price: Number(price),
        delivery,
        images,
      });
      setPublishedId(created.id);
      setPublished(true);
    } catch (err) {
      console.error("Failed to publish listing", err);
      setPublishError(t("sell.publishError"));
    } finally {
      setPublishing(false);
    }
  };

  if (isLoading || !user || verified === null) return null;

  if (!verified && !user.isAdmin) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <ShieldAlert size={44} className="text-gold" />
        <h1 className="mt-4 text-xl font-bold text-foreground">{t("sell.notVerifiedTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("sell.notVerifiedDesc")}</p>
        <Link
          href="/profile"
          className="mt-6 flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand-dark"
        >
          {t("sell.goVerify")}
          <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  if (published) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
        <CheckCircle2 size={48} className="text-brand" />
        <h1 className="mt-4 text-xl font-bold text-foreground">{t("sell.publishedTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("sell.publishedDesc")}</p>
        <div className="mt-6 flex gap-3">
          {publishedId && (
            <button
              onClick={() => router.push(`/listing?id=${publishedId}`)}
              className="rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground transition hover:border-brand/40"
            >
              {t("sell.viewListing")}
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand-dark"
          >
            {t("common.viewAll")}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl font-bold text-foreground">{t("sell.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("sell.subtitle")}</p>

      <div className="mt-4 flex gap-2.5 rounded-lg border border-gold/30 bg-gold/5 p-3 text-xs leading-relaxed text-muted">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" />
        <p>{t("sell.demoWarning")}</p>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {STEPS.map((key, i) => (
          <div key={key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i < step
                  ? "bg-brand text-brand-foreground"
                  : i === step
                    ? "border-2 border-brand text-brand"
                    : "border border-border text-muted"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 rounded ${i < step ? "bg-brand" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{t(STEPS[step])}</p>

      <div className="mt-6 rounded-lg border border-border bg-surface p-5">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {categories.map((c) => (
              <button
                key={c.slug}
                onClick={() => setCategorySlug(c.slug)}
                className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition ${
                  categorySlug === c.slug
                    ? "border-brand bg-brand/10"
                    : "border-border hover:border-brand/30"
                }`}
              >
                <CategoryImage category={c} size={40} />
                <span className="text-xs font-medium text-foreground">{tl(c.name)}</span>
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {user.isAdmin && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.kindLabel")}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["account", "topup"] as ListingKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        kind === k ? "border-brand bg-brand/10 text-foreground" : "border-border text-foreground/80 hover:border-brand/30"
                      }`}
                    >
                      {t(k === "account" ? "sell.kindAccount" : "sell.kindTopup")}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {t(kind === "account" ? "sell.kindAccountHint" : "sell.kindTopupHint")}
                </p>
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.titleLabel")}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("sell.titlePlaceholder")}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-brand/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.descriptionLabel")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("sell.descriptionPlaceholder")}
                rows={5}
                className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-brand/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.priceLabel")}</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground placeholder:text-muted/70 focus:border-brand/50 focus:outline-none"
                />
                {Number(price) > 0 && (
                  <p className="mt-1.5 text-xs text-muted">
                    {t("sell.youReceive")} {Math.round(Number(price) * (1 - COMMISSION_RATE))} {t("common.currency")}{" "}
                    {t("sell.afterCommission")}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.deliveryLabel")}</label>
                <select
                  value={delivery}
                  onChange={(e) => setDelivery(e.target.value as DeliveryType)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                >
                  <option value="manual">{t("catalog.deliveryManual")}</option>
                  <option value="instant">{t("catalog.deliveryInstant")}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("sell.photosLabel")}</label>

            {photos.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {photos.map((p) => (
                  <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => removePhoto(p.id)}
                      aria-label={t("common.cancel")}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {photos.length < MAX_PHOTOS && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-10 text-center transition hover:border-brand/40">
                <ImagePlus size={26} className="text-muted" />
                <span className="text-xs text-muted">
                  {photos.length > 0
                    ? `${photos.length}/${MAX_PHOTOS} ${t("sell.filesSelected")}`
                    : t("sell.photosHint")}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => addPhotos(e.target.files)}
                />
              </label>
            )}

            <div className="mt-5 rounded-lg border border-border bg-surface-2 p-4">
              <p className="text-xs font-medium text-muted">{t("sell.titleLabel")}</p>
              <p className="mb-2 text-sm text-foreground">{title || "—"}</p>
              <p className="text-xs font-medium text-muted">{t("sell.priceLabel")}</p>
              <p className="text-sm text-foreground">
                {price || "0"} {t("common.currency")}
              </p>
              {Number(price) > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {t("sell.youReceive")} {Math.round(Number(price) * (1 - COMMISSION_RATE))} {t("common.currency")}{" "}
                  {t("sell.afterCommission")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {publishError && <p className="mt-3 text-sm text-danger">{publishError}</p>}

      <div className="mt-5 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`rounded-xl border border-border px-5 py-2.5 text-sm text-foreground/90 transition hover:border-brand/40 ${
            step === 0 ? "invisible" : ""
          }`}
        >
          {t("sell.prev")}
        </button>
        {step < 2 ? (
          <button
            disabled={!canNext}
            onClick={() => setStep((s) => Math.min(2, s + 1))}
            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("sell.next")}
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={publishing}
            className="flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-70"
          >
            {publishing && <Loader2 size={16} className="animate-spin" />}
            {t("sell.publish")}
          </button>
        )}
      </div>
    </div>
  );
}
