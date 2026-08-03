"use client";

import { useState } from "react";
import { X, Loader2, Wallet, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useWallet } from "@/lib/wallet-context";

const QUICK_AMOUNTS = [100, 500, 1000];

export function TopUpModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { topUp } = useWallet();
  const [amount, setAmount] = useState("500");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const confirm = async () => {
    const value = Number(amount);
    if (!value || value <= 0) return;
    setStatus("saving");
    try {
      await topUp(value);
      onClose();
    } catch (err) {
      console.error("Failed to top up balance", err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wallet size={18} className="text-brand" />
            {t("wallet.topUpTitle")}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="mt-3 flex gap-2 rounded-lg border border-gold/30 bg-gold/5 p-2.5 text-xs leading-relaxed text-muted">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-gold" />
          <p>{t("wallet.demoDisclaimer")}</p>
        </div>

        <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("wallet.amount")}</label>
        <div className="relative mt-2">
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
            {t("common.currency")}
          </span>
        </div>

        <div className="mt-2.5 flex gap-2">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              onClick={() => setAmount(String(v))}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-brand/40"
            >
              {v} {t("common.currency")}
            </button>
          ))}
        </div>

        {status === "error" && <p className="mt-3 text-xs text-danger">{t("wallet.topUpError")}</p>}

        <button
          onClick={confirm}
          disabled={status === "saving"}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-70"
        >
          {status === "saving" && <Loader2 size={16} className="animate-spin" />}
          {t("wallet.topUpConfirm")}
        </button>
      </div>
    </div>
  );
}
