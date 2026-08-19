"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Wallet, Check, Banknote, ShieldCheck, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { getSeller, getMyDeposits, getMyWithdrawals, getMyKyc, submitKyc, updateMyProfile } from "@/lib/db";
import { uploadKycDocument } from "@/lib/storage";
import type { DepositRequest, KycSubmission, Seller, WithdrawalRequest } from "@/lib/types";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";
import { TopUpModal } from "./TopUpModal";
import { WithdrawModal } from "./WithdrawModal";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-gold/10 text-gold",
  approved: "bg-brand/10 text-brand",
  rejected: "bg-danger/10 text-danger",
};

function RequestRow({
  label,
  amount,
  date,
  status,
  note,
}: {
  label: string;
  amount: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground/90">{label}</p>
          <p className="text-xs text-muted">{date}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold text-foreground">{amount}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[status]}`}>
            {t(`status.${status}`)}
          </span>
        </div>
      </div>
      {note && <p className="mt-1.5 text-xs text-danger">{note}</p>}
    </div>
  );
}

function KycSection({
  verified,
  submissions,
  userId,
  onSubmitted,
}: {
  verified: boolean;
  submissions: KycSubmission[];
  userId: string;
  onSubmitted: () => void;
}) {
  const { t } = useI18n();
  const [fullName, setFullName] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const latest = submissions[0];
  const pending = latest?.status === "pending";

  if (verified) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-brand">
          <ShieldCheck size={16} />
          {t("profile.kycVerified")}
        </p>
      </div>
    );
  }

  const submit = async () => {
    if (!fullName.trim() || !passportNumber.trim() || !file) return;
    setStatus("saving");
    try {
      const documentPath = await uploadKycDocument(file, userId);
      await submitKyc({ fullName: fullName.trim(), passportNumber: passportNumber.trim(), documentPath });
      setFullName("");
      setPassportNumber("");
      setFile(null);
      onSubmitted();
      setStatus("idle");
    } catch (err) {
      console.error("Failed to submit KYC", err);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ShieldCheck size={16} className="text-brand" />
        {t("profile.kycTitle")}
      </h2>
      <p className="mt-1 text-xs text-muted">{t("profile.kycDesc")}</p>

      {pending ? (
        <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-xs text-gold">{t("status.pending")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {latest?.status === "rejected" && (
            <p className="rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">
              {t("profile.kycRejectedNote")}
              {latest.adminNote ? `: ${latest.adminNote}` : ""}
            </p>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.kycFullName")}</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.kycPassportNumber")}</label>
            <input
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.kycDocument")}</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted transition hover:border-brand/40">
              <Upload size={14} />
              {file ? file.name : t("profile.kycDocument")}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {status === "error" && <p className="text-xs text-danger">{t("profile.kycError")}</p>}

          <button
            onClick={submit}
            disabled={status === "saving" || !fullName.trim() || !passportNumber.trim() || !file}
            className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
          >
            {status === "saving" && <Loader2 size={15} className="animate-spin" />}
            {t("profile.kycSubmit")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ProfileView() {
  const { t, tl } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const { balance } = useWallet();
  const router = useRouter();

  const [seller, setSeller] = useState<Seller | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [online, setOnline] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [kycSubmissions, setKycSubmissions] = useState<KycSubmission[]>([]);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/profile");
  }, [user, authLoading, router]);

  const loadRequests = useCallback(() => {
    if (!user) return;
    getMyDeposits(user.id).then(setDeposits).catch((e) => console.error("Failed to load deposits", e));
    getMyWithdrawals(user.id).then(setWithdrawals).catch((e) => console.error("Failed to load withdrawals", e));
    getMyKyc(user.id).then(setKycSubmissions).catch((e) => console.error("Failed to load KYC status", e));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    getSeller(user.id).then((found) => {
      setSeller(found);
      if (found) {
        setName(found.name);
        setCity(found.city);
        setOnline(found.online);
      }
      setIsLoading(false);
    });
    loadRequests();
  }, [user, loadRequests]);

  if (authLoading || !user) return null;

  const save = async () => {
    setSaveStatus("saving");
    try {
      await updateMyProfile(user.id, { name: name.trim(), city: city.trim(), online });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to update profile", err);
      setSaveStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t("profile.title")}</h1>

      {isLoading || !seller ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
            <Avatar name={seller.name} size={56} online={seller.online} />
            <div>
              <div className="flex items-center gap-2 text-base font-semibold text-foreground">{seller.name}</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                {seller.reviewsCount > 0 ? (
                  <>
                    <RatingStars rating={seller.rating} size={13} />
                    <span>
                      {seller.rating} ({seller.reviewsCount})
                    </span>
                  </>
                ) : (
                  <span>{t("seller.noRating")}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                {t("seller.memberSince")} {seller.registeredYear} · {seller.salesCount} {t("seller.sales")}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Wallet size={16} className="text-brand" />
                {t("wallet.balance")}
              </div>
              <span className="text-lg font-bold text-foreground">
                {balance} {t("common.currency")}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setTopUpOpen(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark"
              >
                <Wallet size={15} />
                {t("wallet.topUp")}
              </button>
              <button
                onClick={() => setWithdrawOpen(true)}
                disabled={balance <= 0}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm font-medium text-foreground/90 transition hover:border-brand/40 disabled:opacity-50"
              >
                <Banknote size={15} />
                {t("withdraw.button")}
              </button>
            </div>
          </div>

          {(deposits.length > 0 || withdrawals.length > 0) && (
            <div className="rounded-lg border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">{t("profile.requestsTitle")}</h2>
              <div className="space-y-2">
                {deposits.map((d) => (
                  <RequestRow
                    key={d.id}
                    label={`${t("wallet.topUp")} · ${d.methodName ? tl(d.methodName) : d.methodCode}`}
                    amount={`+${d.amount}`}
                    date={d.createdAt}
                    status={d.status}
                    note={d.adminNote}
                  />
                ))}
                {withdrawals.map((w) => (
                  <RequestRow
                    key={w.id}
                    label={`${t("withdraw.button")} · ${w.methodName ? tl(w.methodName) : w.methodCode}`}
                    amount={`−${w.amount}`}
                    date={w.createdAt}
                    status={w.status}
                    note={w.adminNote}
                  />
                ))}
              </div>
            </div>
          )}

          <KycSection
            verified={seller.verified}
            submissions={kycSubmissions}
            userId={user.id}
            onSubmitted={loadRequests}
          />

          <div className="rounded-lg border border-border bg-surface p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">{t("profile.editTitle")}</h2>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.emailLabel")}</label>
                <input
                  value={user.email}
                  disabled
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.nameLabel")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">{t("profile.cityLabel")}</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/90">
                <input
                  type="checkbox"
                  checked={online}
                  onChange={(e) => setOnline(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-[var(--brand)]"
                />
                {t("profile.onlineLabel")}
              </label>
            </div>

            {saveStatus === "error" && <p className="mt-3 text-xs text-danger">{t("profile.saveError")}</p>}

            <button
              onClick={save}
              disabled={saveStatus === "saving" || !name.trim()}
              className="mt-4 flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
            >
              {saveStatus === "saving" && <Loader2 size={15} className="animate-spin" />}
              {saveStatus === "saved" && <Check size={15} />}
              {t(saveStatus === "saved" ? "profile.saved" : "profile.save")}
            </button>
          </div>

          <Link
            href={`/seller?id=${user.id}`}
            className="block text-center text-sm text-brand hover:underline"
          >
            {t("profile.viewPublicProfile")}
          </Link>
        </div>
      )}

      {topUpOpen && (
        <TopUpModal
          onClose={() => {
            setTopUpOpen(false);
            loadRequests();
          }}
        />
      )}
      {withdrawOpen && (
        <WithdrawModal
          onClose={() => {
            setWithdrawOpen(false);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
