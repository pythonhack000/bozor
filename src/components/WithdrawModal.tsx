"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Banknote, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { getPaymentMethods, requestWithdrawal, getMyPayoutDestinations } from "@/lib/db";
import type { PaymentMethod } from "@/lib/types";

export function WithdrawModal({ onClose }: { onClose: () => void }) {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const { balance, refresh } = useWallet();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [savedDestinations, setSavedDestinations] = useState<Record<string, string>>({});
  const [methodCode, setMethodCode] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    if (!user) return;
    Promise.all([getPaymentMethods(), getMyPayoutDestinations(user.id)])
      .then(([m, saved]) => {
        setMethods(m);
        setSavedDestinations(saved);
        if (m.length > 0) {
          setMethodCode(m[0].code);
          setDestination(saved[m[0].code] ?? "");
        }
      })
      .catch((err) => console.error("Failed to load payment methods", err))
      .finally(() => setLoadingMethods(false));
  }, [user]);

  const method = methods.find((m) => m.code === methodCode) ?? null;
  const value = Number(amount);
  const insufficient = !value || value <= 0 || value > balance;

  const submit = async () => {
    if (!method || insufficient || !destination.trim()) return;
    setStatus("saving");
    try {
      await requestWithdrawal(method.code, value, destination.trim());
      await refresh();
      setDone(true);
      setStatus("idle");
    } catch (err) {
      console.error("Failed to create withdrawal request", err);
      setStatus("error");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-sm animate-scale-in overflow-y-auto rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Banknote size={18} className="text-brand" />
            {t("withdraw.title")}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>

        {loadingMethods ? (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin text-muted" />
          </div>
        ) : methods.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t("wallet.noMethods")}</p>
        ) : done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={44} className="animate-scale-in text-brand" />
            <p className="mt-4 text-sm font-medium text-foreground">{t("withdraw.submitted")}</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">{t("withdraw.submittedDesc")}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("buyModal.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
              <span className="text-muted">{t("withdraw.available")}</span>
              <span className="font-semibold text-foreground">
                {balance} {t("common.currency")}
              </span>
            </div>

            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("withdraw.method")}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {methods.map((m) => (
                <button
                  key={m.code}
                  onClick={() => {
                    setMethodCode(m.code);
                    setDestination(savedDestinations[m.code] ?? "");
                  }}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    m.code === methodCode
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border text-foreground/80 hover:border-brand/40"
                  }`}
                >
                  {tl(m.name)}
                </button>
              ))}
            </div>

            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("withdraw.amount")}</label>
            <div className="relative mt-2">
              <input
                type="number"
                min={1}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                {t("common.currency")}
              </span>
            </div>

            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("withdraw.destination")}</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder={t("withdraw.destinationPlaceholder")}
              className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
            />
            {savedDestinations[methodCode] && (
              <p className="mt-1.5 text-xs text-muted">{t("withdraw.destinationSaved")}</p>
            )}

            {value > balance && <p className="mt-3 text-xs text-danger">{t("withdraw.insufficient")}</p>}
            {status === "error" && <p className="mt-3 text-xs text-danger">{t("withdraw.error")}</p>}

            <button
              onClick={submit}
              disabled={status === "saving" || insufficient || !destination.trim() || !method}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "saving" && <Loader2 size={16} className="animate-spin" />}
              {t("withdraw.submit")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
