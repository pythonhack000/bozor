"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Wallet, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { getSeller, updateMyProfile } from "@/lib/db";
import type { Seller } from "@/lib/types";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";
import { TopUpModal } from "./TopUpModal";

export function ProfileView() {
  const { t } = useI18n();
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

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/profile");
  }, [user, authLoading, router]);

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
  }, [user]);

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
                <RatingStars rating={seller.rating} size={13} />
                <span>
                  {seller.rating} ({seller.reviewsCount})
                </span>
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
            <button
              onClick={() => setTopUpOpen(true)}
              className="mt-3 w-full rounded-lg border border-border py-2 text-sm font-medium text-foreground/90 transition hover:border-brand/40"
            >
              {t("wallet.topUp")}
            </button>
          </div>

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

      {topUpOpen && <TopUpModal onClose={() => setTopUpOpen(false)} />}
    </div>
  );
}
