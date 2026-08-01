"use client";

import { useState } from "react";
import { X, ShieldCheck, Loader2, CheckCircle2, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import type { Listing } from "@/lib/types";

const PAYMENT_METHODS = ["Корти Миллӣ", "Alif Mobi", "Эсхата", "USDT"];

export function BuyModal({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { t, tl } = useI18n();
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [status, setStatus] = useState<"idle" | "paying" | "success">("idle");

  const confirm = () => {
    setStatus("paying");
    setTimeout(() => setStatus("success"), 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">{t("buyModal.title")}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {status === "success" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={44} className="text-brand" />
            <p className="mt-4 text-sm text-foreground">{tl(listing.title)}</p>
            <p className="mt-1 text-xs text-muted">
              #{listing.id.toUpperCase()} · {listing.price} {t("common.currency")}
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
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-surface p-3">
              <span className="line-clamp-1 text-sm text-foreground/90">{tl(listing.title)}</span>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {listing.price} {t("common.currency")}
              </span>
            </div>

            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold text-muted uppercase">{t("buyModal.paymentMethod")}</h4>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                      method === m
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border text-foreground/80 hover:border-brand/30"
                    }`}
                  >
                    <Wallet size={13} />
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs leading-relaxed text-muted">
              <ShieldCheck size={26} className="shrink-0 text-brand" />
              <div>
                <p className="font-medium text-foreground">{t("buyModal.escrowTitle")}</p>
                <p className="mt-0.5">{t("buyModal.escrowText")}</p>
              </div>
            </div>

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
      </div>
    </div>
  );
}
