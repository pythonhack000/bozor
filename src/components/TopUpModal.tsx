"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Wallet, Copy, Check, ShieldCheck, CheckCircle2, Paperclip } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { getPaymentMethods, requestDeposit, submitDepositProof } from "@/lib/db";
import { uploadDepositProof } from "@/lib/storage";
import type { PaymentMethod } from "@/lib/types";

const QUICK_AMOUNTS_TJS = [100, 500, 1000];
const QUICK_AMOUNTS_CRYPTO = [10, 50, 100];

function defaultAmountFor(m: PaymentMethod): string {
  return m.currency !== "TJS" ? "50" : "500";
}

type Step = "form" | "pay" | "done";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground/80 transition hover:border-brand/40"
    >
      {copied ? <Check size={13} className="text-brand" /> : <Copy size={13} />}
      {label}
    </button>
  );
}

export function TopUpModal({ onClose }: { onClose: () => void }) {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const { refresh } = useWallet();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [methodCode, setMethodCode] = useState("");
  const [amount, setAmount] = useState("500");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("form");
  const [reference, setReference] = useState("");
  const [depositId, setDepositId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    getPaymentMethods()
      .then((m) => {
        setMethods(m);
        if (m.length > 0) {
          setMethodCode(m[0].code);
          setAmount(defaultAmountFor(m[0]));
        }
      })
      .catch((err) => console.error("Failed to load payment methods", err))
      .finally(() => setLoadingMethods(false));
  }, []);

  const method = methods.find((m) => m.code === methodCode) ?? null;
  const isCrypto = method != null && method.currency !== "TJS";
  const quickAmounts = isCrypto ? QUICK_AMOUNTS_CRYPTO : QUICK_AMOUNTS_TJS;
  const value = Number(amount);
  const outOfRange = method != null && (!value || value < method.minAmount || value > method.maxAmount);

  const proceed = async () => {
    if (!method || outOfRange) return;
    setStatus("saving");
    try {
      const res = await requestDeposit(method.code, value);
      setReference(res.referenceCode);
      setDepositId(res.id);
      setStep("pay");
      setStatus("idle");
    } catch (err) {
      console.error("Failed to create deposit request", err);
      setStatus("error");
    }
  };

  const submit = async () => {
    if (!user) return;
    setStatus("saving");
    try {
      if (proofFile) {
        const path = await uploadDepositProof(proofFile, user.id);
        await submitDepositProof(depositId, path);
      }
      await refresh();
      setStep("done");
      setStatus("idle");
    } catch (err) {
      console.error("Failed to submit deposit proof", err);
      setStatus("error");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-sm animate-scale-in overflow-y-auto rounded-t-lg border border-border bg-surface-2 p-5 sm:rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Wallet size={18} className="text-brand" />
            {t("wallet.depositTitle")}
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
        ) : step === "done" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 size={44} className="animate-scale-in text-brand" />
            <p className="mt-4 text-sm font-medium text-foreground">{t("wallet.depositSubmitted")}</p>
            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted">{t("wallet.depositSubmittedDesc")}</p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-foreground"
            >
              {t("buyModal.close")}
            </button>
          </div>
        ) : step === "form" ? (
          <>
            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("wallet.chooseMethod")}</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {methods.map((m) => (
                <button
                  key={m.code}
                  onClick={() => {
                    setMethodCode(m.code);
                    setAmount(defaultAmountFor(m));
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

            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("wallet.amount")}</label>
            <div className="relative mt-2">
              <input
                type="number"
                min={method?.minAmount ?? 1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted">
                {method?.currency ?? t("common.currency")}
              </span>
            </div>
            {method && (
              <p className="mt-1.5 text-xs text-muted">
                {t("wallet.min")}: {method.minAmount} · {t("wallet.max")}: {method.maxAmount} {method.currency}
              </p>
            )}
            {isCrypto && method?.rate && value > 0 && (
              <p className="mt-1.5 text-sm font-semibold text-brand">
                ≈ {Math.round(value * method.rate * 100) / 100} {t("common.currency")}
                <span className="ml-1.5 text-xs font-normal text-muted">
                  (1 {method.currency} = {method.rate} {t("common.currency")})
                </span>
              </p>
            )}

            <div className="mt-2.5 flex gap-2">
              {quickAmounts.map((v) => (
                <button
                  key={v}
                  onClick={() => setAmount(String(v))}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-brand/40"
                >
                  {v} {method?.currency ?? t("common.currency")}
                </button>
              ))}
            </div>

            {isCrypto && <p className="mt-2.5 text-xs text-muted">{t("wallet.cryptoAmountNote")}</p>}

            {status === "error" && <p className="mt-3 text-xs text-danger">{t("wallet.depositError")}</p>}

            <button
              onClick={proceed}
              disabled={status === "saving" || outOfRange || !method}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
            >
              {status === "saving" && <Loader2 size={16} className="animate-spin" />}
              {t("wallet.continue")}
            </button>
          </>
        ) : (
          <>
            <div className="mt-4 flex gap-2.5 rounded-lg border border-brand/20 bg-brand/5 p-3 text-xs leading-relaxed text-muted">
              <ShieldCheck size={22} className="shrink-0 text-brand" />
              <p>{t("wallet.payInstructions")}</p>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{t("wallet.amount")}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {value} {method?.currency ?? t("common.currency")} · {method ? tl(method.name) : ""}
                  </p>
                  {isCrypto && method?.rate && (
                    <p className="text-xs text-brand">
                      ≈ {Math.round(value * method.rate * 100) / 100} {t("common.currency")}
                      <span className="ml-1 text-muted">
                        (1 {method.currency} = {method.rate} {t("common.currency")})
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{t("wallet.requisites")}</p>
                  <p className="truncate text-sm font-semibold text-foreground">{method?.details || "—"}</p>
                  {method?.network && (
                    <p className="text-xs text-muted">
                      {t("wallet.network")}: {method.network}
                    </p>
                  )}
                </div>
                {method?.details ? <CopyButton value={method.details} label={t("wallet.copy")} /> : null}
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{t("wallet.reference")}</p>
                  <p className="truncate text-sm font-semibold text-gold">{reference}</p>
                </div>
                <CopyButton value={reference} label={t("wallet.copy")} />
              </div>
            </div>

            <label className="mt-4 block text-xs font-semibold text-muted uppercase">{t("wallet.proofLabel")}</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground/80 transition hover:border-brand/40"
            >
              <Paperclip size={15} className="shrink-0 text-muted" />
              <span className="truncate">{proofFile ? proofFile.name : t("wallet.proofPlaceholder")}</span>
            </button>

            {status === "error" && <p className="mt-3 text-xs text-danger">{t("wallet.depositError")}</p>}

            <button
              onClick={submit}
              disabled={status === "saving"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-70"
            >
              {status === "saving" && <Loader2 size={16} className="animate-spin" />}
              {t("wallet.iPaid")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
