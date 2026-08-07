"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, Undo2, CheckCircle2, Flag, Ban, X } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { getDisputedOrders, resolveDispute, getReports, resolveReport } from "@/lib/db";
import type { DisputedOrder, ListingReport } from "@/lib/types";

type Tab = "disputes" | "reports";

export function AdminView() {
  const { t, tl } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("disputes");
  const [orders, setOrders] = useState<DisputedOrder[]>([]);
  const [reports, setReports] = useState<ListingReport[]>([]);
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
      const [disputeRows, reportRows] = await Promise.all([getDisputedOrders(), getReports()]);
      setOrders(disputeRows);
      setReports(reportRows);
      setUnauthorized(false);
    } catch (err) {
      console.error("Failed to load moderation queues", err);
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

  const resolveDisputeAction = async (orderId: string, resolution: "refund_buyer" | "release_seller") => {
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

  const resolveReportAction = async (reportId: string, action: "dismiss" | "remove_listing") => {
    setResolvingId(reportId);
    try {
      await resolveReport(reportId, action);
      await load();
    } catch (err) {
      console.error("Failed to resolve report", err);
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

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface p-1">
        {(["disputes", "reports"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              tab === tabKey ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t(tabKey === "disputes" ? "admin.tabDisputes" : "admin.tabReports")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-muted" />
        </div>
      ) : unauthorized ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
          {t("admin.unauthorized")}
        </div>
      ) : tab === "disputes" ? (
        orders.length === 0 ? (
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
                    onClick={() => resolveDisputeAction(order.id, "refund_buyer")}
                    disabled={resolvingId === order.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
                  >
                    {resolvingId === order.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Undo2 size={13} />
                    )}
                    {t("admin.refundBuyer")}
                  </button>
                  <button
                    onClick={() => resolveDisputeAction(order.id, "release_seller")}
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
        )
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">
          {t("admin.reportsEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-lg border border-danger/30 bg-surface p-4">
              <div className="flex items-center gap-2">
                <Flag size={13} className="shrink-0 text-danger" />
                <p className="text-sm font-medium text-foreground">
                  {report.listingTitle ? tl(report.listingTitle) : `#${report.listingId.slice(0, 8).toUpperCase()}`}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {t("admin.reportedBy")}: {report.reporterName} · {report.createdAt}
              </p>
              <p className="mt-2 rounded-lg bg-danger/5 px-3 py-2 text-xs text-danger">{report.reason}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => resolveReportAction(report.id, "dismiss")}
                  disabled={resolvingId === report.id}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
                >
                  {resolvingId === report.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                  {t("admin.dismissReport")}
                </button>
                <button
                  onClick={() => resolveReportAction(report.id, "remove_listing")}
                  disabled={resolvingId === report.id}
                  className="flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {resolvingId === report.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Ban size={13} />
                  )}
                  {t("admin.removeListing")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
