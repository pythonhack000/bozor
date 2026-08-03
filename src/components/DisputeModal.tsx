"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { openDispute } from "@/lib/db";

export function DisputeModal({
  orderId,
  onClose,
  onSuccess,
}: {
  orderId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const confirm = async () => {
    if (!reason.trim()) return;
    setStatus("saving");
    try {
      await openDispute(orderId, reason.trim());
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to open dispute", err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <AlertTriangle size={18} className="text-danger" />
            {t("orders.disputeTitle")}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">{t("orders.disputeDesc")}</p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("orders.disputeReasonPlaceholder")}
          rows={4}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
        />

        {status === "error" && <p className="mt-3 text-xs text-danger">{t("orders.disputeError")}</p>}

        <button
          onClick={confirm}
          disabled={status === "saving" || !reason.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-danger py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {status === "saving" && <Loader2 size={16} className="animate-spin" />}
          {t("orders.disputeSubmit")}
        </button>
      </div>
    </div>
  );
}
