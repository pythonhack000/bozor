"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import { getOrdersAsBuyer, getOrdersAsSeller, confirmOrderReceipt } from "@/lib/db";
import type { Order, OrderStatus } from "@/lib/types";

type Tab = "purchases" | "sales";

function statusKey(status: OrderStatus) {
  switch (status) {
    case "paid":
      return "orders.statusPaid";
    case "released":
      return "orders.statusReleased";
    case "disputed":
      return "orders.statusDisputed";
    case "refunded":
      return "orders.statusRefunded";
  }
}

function statusClass(status: OrderStatus) {
  switch (status) {
    case "paid":
      return "bg-gold/15 text-gold";
    case "released":
      return "bg-brand/15 text-brand";
    case "disputed":
      return "bg-danger/15 text-danger";
    case "refunded":
      return "bg-surface-2 text-muted";
  }
}

export function OrdersView() {
  const { t, tl } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const { refresh: refreshBalance } = useWallet();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("purchases");
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/orders");
  }, [user, authLoading, router]);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    const [p, s] = await Promise.all([getOrdersAsBuyer(user.id), getOrdersAsSeller(user.id)]);
    setPurchases(p);
    setSales(s);
    setIsLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) return null;

  const confirmReceipt = async (orderId: string) => {
    setConfirmingId(orderId);
    setError(null);
    try {
      await confirmOrderReceipt(orderId);
      await load();
      await refreshBalance();
    } catch (err) {
      console.error("Failed to confirm receipt", err);
      setError(t("orders.confirmError"));
    } finally {
      setConfirmingId(null);
    }
  };

  const list = tab === "purchases" ? purchases : sales;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t("orders.title")}</h1>

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1">
        {(["purchases", "sales"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              tab === tabKey ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t(tabKey === "purchases" ? "orders.tabPurchases" : "orders.tabSales")}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
          {t("orders.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((order) => (
            <div key={order.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {order.listingTitle ? tl(order.listingTitle) : `#${order.id.slice(0, 8).toUpperCase()}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {order.otherPartyName} · {order.createdAt}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {order.price} {t("common.currency")}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusClass(order.status)}`}>
                    {t(statusKey(order.status))}
                  </span>
                </div>
              </div>

              {tab === "purchases" && order.status === "paid" && (
                <button
                  onClick={() => confirmReceipt(order.id)}
                  disabled={confirmingId === order.id}
                  className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {confirmingId === order.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {t("orders.confirmReceipt")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
