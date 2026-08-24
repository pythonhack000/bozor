"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, Star, KeyRound, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-context";
import {
  getOrdersAsBuyer,
  getOrdersAsSeller,
  confirmOrderReceipt,
  deliverOrder,
  getMyReviewedListingIds,
} from "@/lib/db";
import type { Order, OrderStatus } from "@/lib/types";
import { DisputeModal } from "./DisputeModal";
import { ReviewModal } from "./ReviewModal";

type Tab = "purchases" | "sales";

// Must match commission_rate() in supabase/schema.sql
const COMMISSION_RATE = 0.1;

function statusKey(status: OrderStatus) {
  switch (status) {
    case "paid":
      return "orders.statusPaid";
    case "delivered":
      return "orders.statusDelivered";
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
    case "delivered":
      return "bg-brand/15 text-brand";
    case "released":
      return "bg-brand/15 text-brand";
    case "disputed":
      return "bg-danger/15 text-danger";
    case "refunded":
      return "bg-surface-2 text-muted";
  }
}

function DeliverForm({ orderId, onDelivered }: { orderId: string; onDelivered: () => void }) {
  const { t } = useI18n();
  const [credentials, setCredentials] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const submit = async () => {
    if (!credentials.trim()) return;
    setStatus("saving");
    try {
      await deliverOrder(orderId, credentials.trim());
      onDelivered();
    } catch (err) {
      console.error("Failed to deliver order", err);
      setStatus("error");
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <KeyRound size={13} className="text-brand" />
        {t("orders.deliverTitle")}
      </p>
      <p className="mt-1 text-xs text-muted">{t("orders.deliverDesc")}</p>
      <textarea
        value={credentials}
        onChange={(e) => setCredentials(e.target.value)}
        placeholder={t("orders.deliverPlaceholder")}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
      />
      {status === "error" && <p className="mt-1.5 text-xs text-danger">{t("orders.deliverError")}</p>}
      <button
        onClick={submit}
        disabled={status === "saving" || !credentials.trim()}
        className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        {t("orders.deliverSubmit")}
      </button>
    </div>
  );
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
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [reviewingListingId, setReviewingListingId] = useState<string | null>(null);
  const [reviewedListingIds, setReviewedListingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/orders");
  }, [user, authLoading, router]);

  const load = async (opts?: { silent?: boolean }) => {
    if (!user) return;
    if (!opts?.silent) setIsLoading(true);
    const [p, s, reviewed] = await Promise.all([
      getOrdersAsBuyer(user.id),
      getOrdersAsSeller(user.id),
      getMyReviewedListingIds(user.id),
    ]);
    setPurchases(p);
    setSales(s);
    setReviewedListingIds(reviewed);
    setIsLoading(false);
  };
  const loadSilently = () => load({ silent: true });

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
      await load({ silent: true });
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

              {tab === "sales" && order.buyerNote && (
                <p className="mt-2 rounded-lg bg-gold/5 px-3 py-2 text-xs text-foreground/90">
                  {t("orders.buyerNoteLabel")}: {order.buyerNote}
                </p>
              )}

              {order.status === "disputed" && order.disputeReason && (
                <p className="mt-2 rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">
                  {t("orders.disputeReasonLabel")}: {order.disputeReason}
                </p>
              )}

              {tab === "sales" && order.status === "released" && (
                <p className="mt-1 text-xs text-muted">
                  {t("orders.netPayout")} {Math.round(order.price * (1 - COMMISSION_RATE))} {t("common.currency")}{" "}
                  ({t("sell.afterCommission")})
                </p>
              )}

              {tab === "purchases" && order.status === "released" && order.listingId && (
                <div className="mt-3">
                  {reviewedListingIds.has(order.listingId) ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted">
                      <Star size={13} className="fill-gold text-gold" />
                      {t("review.alreadyLeft")}
                    </span>
                  ) : (
                    <button
                      onClick={() => setReviewingListingId(order.listingId)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40"
                    >
                      <Star size={13} />
                      {t("review.leaveReview")}
                    </button>
                  )}
                </div>
              )}

              {order.status === "paid" && (
                <>
                  {tab === "sales" ? (
                    <DeliverForm orderId={order.id} onDelivered={load} />
                  ) : (
                    <p className="mt-3 text-xs text-muted">{t("orders.waitingDelivery")}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setDisputingId(order.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3.5 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10"
                    >
                      <AlertTriangle size={13} />
                      {t("orders.openDispute")}
                    </button>
                  </div>
                </>
              )}

              {order.status === "delivered" && (
                <>
                  {tab === "purchases" && order.credentials && (
                    <div className="mt-3 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <KeyRound size={13} className="text-brand" />
                        {t("orders.credentialsLabel")}
                      </p>
                      <p className="mt-1 text-xs break-all whitespace-pre-wrap text-foreground/90">
                        {order.credentials}
                      </p>
                    </div>
                  )}
                  {tab === "sales" && <p className="mt-3 text-xs text-muted">{t("orders.waitingConfirm")}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tab === "purchases" && (
                      <button
                        onClick={() => confirmReceipt(order.id)}
                        disabled={confirmingId === order.id}
                        className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
                      >
                        {confirmingId === order.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        {t("orders.confirmReceipt")}
                      </button>
                    )}
                    <button
                      onClick={() => setDisputingId(order.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-3.5 py-2 text-xs font-semibold text-danger transition hover:bg-danger/10"
                    >
                      <AlertTriangle size={13} />
                      {t("orders.openDispute")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {disputingId && (
        <DisputeModal
          orderId={disputingId}
          onClose={() => setDisputingId(null)}
          onSuccess={loadSilently}
        />
      )}

      {reviewingListingId && (
        <ReviewModal
          listingId={reviewingListingId}
          onClose={() => setReviewingListingId(null)}
          onSuccess={loadSilently}
        />
      )}
    </div>
  );
}
