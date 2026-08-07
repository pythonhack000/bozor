"use client";

import { useState } from "react";
import { X, Loader2, Star, MessageSquareText } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { createReview } from "@/lib/db";

export function ReviewModal({
  listingId,
  onClose,
  onSuccess,
}: {
  listingId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const confirm = async () => {
    if (!text.trim()) return;
    setStatus("saving");
    try {
      await createReview(listingId, rating, text.trim());
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to create review", err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-sm animate-scale-in overflow-y-auto rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MessageSquareText size={18} className="text-brand" />
            {t("review.title")}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              onMouseEnter={() => setHoverRating(v)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(v)}
              aria-label={`${v}`}
            >
              <Star
                size={30}
                className={
                  v <= (hoverRating || rating) ? "fill-gold text-gold" : "fill-transparent text-border"
                }
              />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("review.textPlaceholder")}
          rows={4}
          className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
        />

        {status === "error" && <p className="mt-3 text-xs text-danger">{t("review.error")}</p>}

        <button
          onClick={confirm}
          disabled={status === "saving" || !text.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
        >
          {status === "saving" && <Loader2 size={16} className="animate-spin" />}
          {t("review.submit")}
        </button>
      </div>
    </div>
  );
}
