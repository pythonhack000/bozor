"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, Undo2, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { getDisputedOrders, resolveDispute } from "@/lib/db";
import type { DisputedOrder } from "@/lib/types";

export function AdminView() {
  const { t, tl } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [orders, setOrders] = useState<DisputedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [user, authLoading, router]);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const rows = await getDisputedOrders();
      setOrders(rows);
      setUnauthorized(false);
    } catch (err) {
      console.error("Failed to load disputed orders", err);
      setUnauthorized(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) return null;

  const resolve = async (orderId: string, resolution: "refund_buyer" | "release_seller") => {
    setResolvingId(orderId);
    try {
      await resolveDispute(orderId, resolution);
      await load();
    } catch (err) {
      console.error("Failed to resolve dispute", err);
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
        <ShieldAlert size={20} className="text-danger" />
        {t("admin.title")}
      </h1>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : unauthorized ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
          {t("admin.unauthorized")}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
          {t("admin.empty")}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-danger/30 bg-surface p-4">
              <p className="text-sm font-medium text-foreground">
                {order.listingTitle ? tl(order.listingTitle) : `#${order.id.slice(0, 8).toUpperCase()}`}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {order.price} {t("common.currency")} · {order.createdAt}
              </p>
              <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                <span>
                  {t("admin.buyer")}: {order.buyerName}
                </span>
                <span>
                  {t("admin.seller")}: {order.sellerName}
                </span>
              </div>
              <p className="mt-2 rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">{order.disputeReason}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => resolve(order.id, "refund_buyer")}
                  disabled={resolvingId === order.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
                >
                  {resolvingId === order.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                  {t("admin.refundBuyer")}
                </button>
                <button
                  onClick={() => resolve(order.id, "release_seller")}
                  disabled={resolvingId === order.id}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {resolvingId === order.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {t("admin.releaseSeller")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
