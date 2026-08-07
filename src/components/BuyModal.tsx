"use client";

import { useState } from "react";
import { X, ShieldCheck, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import type { Listing } from "@/lib/types";
import { buyListing } from "@/lib/db";
import { useWallet } from "@/lib/wallet-context";
import { TopUpModal } from "./TopUpModal";

export function BuyModal({
  listing,
  onClose,
  onPurchased,
}: {
  listing: Listing;
  onClose: () => void;
  onPurchased?: () => void;
}) {
  const { t, tl } = useI18n();
  const { balance, isLoading: balanceLoading, refresh } = useWallet();
  const [status, setStatus] = useState<"idle" | "paying" | "success" | "error">("idle");
  const [topUpOpen, setTopUpOpen] = useState(false);

  const insufficient = !balanceLoading && balance < listing.price;

  const confirm = async () => {
    setStatus("paying");
    try {
      await buyListing(listing.id);
      await refresh();
      onPurchased?.();
      setStatus("success");
    } catch (err) {
      console.error("Failed to create order", err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md animate-scale-in overflow-y-auto rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{t("buyModal.title")}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={44} className="animate-scale-in text-brand" />
            <p className="mt-4 text-sm text-foreground">{tl(listing.title)}</p>
            <p className="mt-1 text-xs text-muted">
              #{listing.id.slice(0, 8).toUpperCase()} · {listing.price} {t("common.currency")}
            </p>
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">{t("buyModal.escrowText")}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("buyModal.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface p-3">
              <span className="line-clamp-1 text-sm text-foreground/90">{tl(listing.title)}</span>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {listing.price} {t("common.currency")}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              <span className="text-muted">{t("buyModal.yourBalance")}</span>
              <span className={`font-semibold ${insufficient ? "text-danger" : "text-foreground"}`}>
                {balanceLoading ? "…" : balance} {t("common.currency")}
              </span>
            </div>

            {insufficient ? (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 p-4 text-center">
                <AlertTriangle size={22} className="text-danger" />
                <p className="text-sm font-medium text-foreground">{t("buyModal.insufficientTitle")}</p>
                <p className="text-xs text-muted">{t("buyModal.insufficientDesc")}</p>
                <button
                  onClick={() => setTopUpOpen(true)}
                  className="mt-1 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
                >
                  {t("buyModal.topUp")}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2.5 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs leading-relaxed text-muted">
                  <ShieldCheck size={26} className="shrink-0 text-brand" />
                  <div>
                    <p className="font-medium text-foreground">{t("buyModal.escrowTitle")}</p>
                    <p className="mt-0.5">{t("buyModal.escrowText")}</p>
                  </div>
                </div>

                <div className="mt-2.5 flex gap-2 rounded-lg border border-gold/30 bg-gold/5 p-2.5 text-xs leading-relaxed text-muted">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-gold" />
                  <p>{t("wallet.demoDisclaimer")}</p>
                </div>

                {status === "error" && <p className="mt-3 text-xs text-danger">{t("buyModal.error")}</p>}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-sm text-muted">{t("buyModal.total")}</span>
                  <span className="text-lg font-bold text-foreground">
                    {listing.price} {t("common.currency")}
                  </span>
                </div>

                <button
                  onClick={confirm}
                  disabled={status === "paying"}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-70"
                >
                  {status === "paying" && <Loader2 size={16} className="animate-spin" />}
                  {t("buyModal.confirmOrder")}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} />}
    </div>
  );
}
