"use client";

import { useState } from "react";
import { X, Loader2, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { reportListing } from "@/lib/db";

export function ReportModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "success">("idle");

  const confirm = async () => {
    if (!reason.trim()) return;
    setStatus("saving");
    try {
      await reportListing(listingId, reason.trim());
      setStatus("success");
    } catch (err) {
      console.error("Failed to report listing", err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-sm animate-scale-in overflow-y-auto rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Flag size={18} className="text-danger" />
            {t("report.title")}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {status === "success" ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-foreground">{t("report.success")}</p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("buyModal.close")}
            </button>
          </div>
        ) : (
          <>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("report.reasonPlaceholder")}
              rows={4}
              className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
            />

            {status === "error" && <p className="mt-3 text-xs text-danger">{t("report.error")}</p>}

            <button
              onClick={confirm}
              disabled={status === "saving" || !reason.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-danger py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {status === "saving" && <Loader2 size={16} className="animate-spin" />}
              {t("report.submit")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
