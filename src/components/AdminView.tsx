"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, Undo2, CheckCircle2, Flag, Ban, X, Check, FileText, Image as ImageIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { adminNotifyUser } from "@/lib/chat";
import {
  getDisputedOrders,
  resolveDispute,
  getReports,
  resolveReport,
  adminListDeposits,
  adminApproveDeposit,
  adminRejectDeposit,
  adminListWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal,
  adminListPaymentMethods,
  adminUpdatePaymentMethod,
  adminListKyc,
  adminApproveKyc,
  adminRejectKyc,
} from "@/lib/db";
import { getKycDocumentSignedUrl, getDepositProofSignedUrl } from "@/lib/storage";
import type {
  DisputedOrder,
  ListingReport,
  DepositRequest,
  WithdrawalRequest,
  PaymentMethod,
  KycSubmission,
} from "@/lib/types";

type Tab = "disputes" | "reports" | "deposits" | "withdrawals" | "kyc" | "requisites";

const TABS: Tab[] = ["disputes", "reports", "deposits", "withdrawals", "kyc", "requisites"];

const TAB_LABEL: Record<Tab, string> = {
  disputes: "admin.tabDisputes",
  reports: "admin.tabReports",
  deposits: "admin.tabDeposits",
  withdrawals: "admin.tabWithdrawals",
  kyc: "admin.tabKyc",
  requisites: "admin.tabRequisites",
};

export function AdminView() {
  const { t, tl } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("disputes");
  const [orders, setOrders] = useState<DisputedOrder[]>([]);
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [kyc, setKyc] = useState<KycSubmission[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth?next=/admin");
  }, [user, authLoading, router]);

  const load = async (opts?: { silent?: boolean }) => {
    if (!user) return;
    if (!opts?.silent) setIsLoading(true);
    try {
      const [disputeRows, reportRows, depositRows, withdrawalRows, kycRows, methodRows] = await Promise.all([
        getDisputedOrders(),
        getReports(),
        adminListDeposits(),
        adminListWithdrawals(),
        adminListKyc(),
        adminListPaymentMethods(),
      ]);
      setOrders(disputeRows);
      setReports(reportRows);
      setDeposits(depositRows);
      setWithdrawals(withdrawalRows);
      setKyc(kycRows);
      setMethods(methodRows);
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

  // Live-refresh the queues as new deposits/withdrawals/reports/disputes/KYC
  // submissions come in, instead of only loading once on mount.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => load({ silent: true }), 500);
    };
    const channel = supabase
      .channel("admin-queues")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposit_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "kyc_submissions" }, scheduleReload)
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading || !user) return null;

  const resolveDisputeAction = async (orderId: string, resolution: "refund_buyer" | "release_seller") => {
    setResolvingId(orderId);
    try {
      await resolveDispute(orderId, resolution);
      await load({ silent: true });
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
      await load({ silent: true });
    } catch (err) {
      console.error("Failed to resolve report", err);
    } finally {
      setResolvingId(null);
    }
  };

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setResolvingId(id);
    try {
      await fn();
      setRejectingId(null);
      setRejectNote("");
      await load({ silent: true });
    } catch (err) {
      console.error("Payment action failed", err);
    } finally {
      setResolvingId(null);
    }
  };

  // Lets the affected user actually see why their request was rejected,
  // instead of the reason sitting silently in admin-only history.
  const notifyRejection = async (profileId: string, note: string) => {
    if (!user || !note.trim()) return;
    try {
      await adminNotifyUser(user.id, profileId, `${t("admin.rejectMessagePrefix")}: ${note.trim()}`);
    } catch (err) {
      console.error("Failed to notify user of rejection", err);
    }
  };

  const saveMethod = async (input: {
    code: string;
    details: string;
    network?: string;
    minAmount: number;
    maxAmount: number;
    enabled: boolean;
    rate?: number;
  }) => {
    await adminUpdatePaymentMethod(input);
    await load({ silent: true });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
        <ShieldAlert size={20} className="text-danger" />
        {t("admin.title")}
      </h1>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {TABS.map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === tabKey ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t(TAB_LABEL[tabKey])}
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
          <Empty text={t("admin.empty")} />
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
                    {resolvingId === order.id ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
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
      ) : tab === "reports" ? (
        reports.length === 0 ? (
          <Empty text={t("admin.reportsEmpty")} />
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-lg border border-danger/30 bg-surface p-4">
                <div className="flex items-center gap-2">
                  <Flag size={13} className="shrink-0 text-danger" />
                  <p className="text-sm font-medium text-foreground">
                    {report.listingTitle
                      ? tl(report.listingTitle)
                      : `#${report.listingId.slice(0, 8).toUpperCase()}`}
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
                    {resolvingId === report.id ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                    {t("admin.removeListing")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === "deposits" ? (
        deposits.length === 0 ? (
          <Empty text={t("admin.depositsEmpty")} />
        ) : (
          <>
            <div className="space-y-3">
              {deposits
                .filter((d) => d.status === "pending")
                .map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          +{d.amount} {d.currency ?? t("common.currency")}
                        </p>
                        {d.currency && d.currency !== "TJS" && d.rate && (
                          <p className="text-xs text-muted">
                            ≈ {Math.round(d.amount * d.rate * 100) / 100} {t("common.currency")} · {t("admin.reqRate")}{" "}
                            {d.rate}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted">{d.createdAt}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                      <span>
                        {t("admin.user")}: {d.userName}
                      </span>
                      <span>
                        {t("admin.method")}: {d.methodName ? tl(d.methodName) : d.methodCode}
                      </span>
                      <span>
                        {t("admin.reference")}: <span className="font-mono text-gold">{d.referenceCode}</span>
                      </span>
                    </div>
                    {d.proof && <ProofButton path={d.proof} />}
                    {d.currency && d.currency !== "TJS" ? (
                      <CryptoApproveRow
                        id={d.id}
                        suggestedAmount={d.rate ? d.amount * d.rate : undefined}
                        resolvingId={resolvingId}
                        rejectingId={rejectingId}
                        rejectNote={rejectNote}
                        setRejectNote={setRejectNote}
                        startReject={() => setRejectingId(d.id)}
                        cancelReject={() => setRejectingId(null)}
                        onApprove={(creditAmount) => runAction(d.id, () => adminApproveDeposit(d.id, creditAmount))}
                        onReject={() =>
                          runAction(d.id, async () => {
                            await adminRejectDeposit(d.id, rejectNote);
                            await notifyRejection(d.profileId, rejectNote);
                          })
                        }
                      />
                    ) : (
                      <ApproveRejectRow
                        id={d.id}
                        resolvingId={resolvingId}
                        rejectingId={rejectingId}
                        rejectNote={rejectNote}
                        setRejectNote={setRejectNote}
                        startReject={() => setRejectingId(d.id)}
                        cancelReject={() => setRejectingId(null)}
                        onApprove={() => runAction(d.id, () => adminApproveDeposit(d.id))}
                        onReject={() =>
                          runAction(d.id, async () => {
                            await adminRejectDeposit(d.id, rejectNote);
                            await notifyRejection(d.profileId, rejectNote);
                          })
                        }
                      />
                    )}
                  </div>
                ))}
            </div>
            <RequestHistory
              title={t("admin.historyTitle")}
              items={deposits
                .filter((d) => d.status !== "pending")
                .map((d) => ({
                  id: d.id,
                  status: d.status,
                  adminNote: d.adminNote,
                  createdAt: d.createdAt,
                  label:
                    d.creditedAmount != null
                      ? `+${d.creditedAmount} ${t("common.currency")}`
                      : `+${d.amount} ${d.currency ?? t("common.currency")}`,
                  detail: `${d.userName} · ${d.methodName ? tl(d.methodName) : d.methodCode}`,
                }))}
            />
          </>
        )
      ) : tab === "withdrawals" ? (
        withdrawals.length === 0 ? (
          <Empty text={t("admin.withdrawalsEmpty")} />
        ) : (
          <>
            <div className="space-y-3">
              {withdrawals
                .filter((w) => w.status === "pending")
                .map((w) => (
                  <div key={w.id} className="rounded-lg border border-border bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        −{w.amount} {t("common.currency")}
                      </p>
                      <span className="text-xs text-muted">{w.createdAt}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                      <span>
                        {t("admin.user")}: {w.userName}
                      </span>
                      <span>
                        {t("admin.method")}: {w.methodName ? tl(w.methodName) : w.methodCode}
                      </span>
                    </div>
                    <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs break-all text-foreground/80">
                      {t("admin.destination")}: {w.destination}
                    </p>
                    <ApproveRejectRow
                      id={w.id}
                      resolvingId={resolvingId}
                      rejectingId={rejectingId}
                      rejectNote={rejectNote}
                      setRejectNote={setRejectNote}
                      startReject={() => setRejectingId(w.id)}
                      cancelReject={() => setRejectingId(null)}
                      onApprove={() => runAction(w.id, () => adminApproveWithdrawal(w.id))}
                      onReject={() =>
                        runAction(w.id, async () => {
                          await adminRejectWithdrawal(w.id, rejectNote);
                          await notifyRejection(w.profileId, rejectNote);
                        })
                      }
                    />
                  </div>
                ))}
            </div>
            <RequestHistory
              title={t("admin.historyTitle")}
              items={withdrawals
                .filter((w) => w.status !== "pending")
                .map((w) => ({
                  id: w.id,
                  status: w.status,
                  adminNote: w.adminNote,
                  createdAt: w.createdAt,
                  label: `−${w.amount} ${t("common.currency")}`,
                  detail: `${w.userName} · ${w.methodName ? tl(w.methodName) : w.methodCode}`,
                }))}
            />
          </>
        )
      ) : tab === "kyc" ? (
        kyc.length === 0 ? (
          <Empty text={t("admin.kycEmpty")} />
        ) : (
          <div className="space-y-3">
            {kyc.map((k) => (
              <div key={k.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{k.fullName}</p>
                  <span className="text-xs text-muted">{k.createdAt}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
                  <span>
                    {t("admin.user")}: {k.userName}
                  </span>
                  <span>{t("admin.kycPassport")}: {k.passportNumber}</span>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const url = await getKycDocumentSignedUrl(k.documentPath);
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      console.error("Failed to open KYC document", err);
                    }
                  }}
                  className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-brand/40"
                >
                  <FileText size={13} />
                  {t("admin.kycViewDocument")}
                </button>
                <ApproveRejectRow
                  id={k.id}
                  resolvingId={resolvingId}
                  rejectingId={rejectingId}
                  rejectNote={rejectNote}
                  setRejectNote={setRejectNote}
                  startReject={() => setRejectingId(k.id)}
                  cancelReject={() => setRejectingId(null)}
                  onApprove={() => runAction(k.id, () => adminApproveKyc(k.id))}
                  onReject={() =>
                    runAction(k.id, async () => {
                      await adminRejectKyc(k.id, rejectNote);
                      await notifyRejection(k.profileId, rejectNote);
                    })
                  }
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {methods.map((m) => (
            <MethodEditor key={m.code} method={m} onSave={saveMethod} />
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted">{text}</div>
  );
}

function ProofButton({ path }: { path: string }) {
  const { t } = useI18n();
  return (
    <button
      onClick={async () => {
        try {
          const url = await getDepositProofSignedUrl(path);
          window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
          console.error("Failed to open deposit proof", err);
        }
      }}
      className="mt-2 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/80 transition hover:border-brand/40"
    >
      <ImageIcon size={13} />
      {t("admin.viewProof")}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const styles =
    status === "approved"
      ? "border-brand/30 bg-brand/10 text-brand"
      : status === "rejected"
        ? "border-danger/30 bg-danger/10 text-danger"
        : "border-border bg-surface-2 text-muted";
  const label =
    status === "approved" ? t("admin.statusApproved") : status === "rejected" ? t("admin.statusRejected") : status;
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles}`}>{label}</span>;
}

function RequestHistory({
  title,
  items,
}: {
  title: string;
  items: {
    id: string;
    status: string;
    adminNote?: string;
    createdAt: string;
    label: string;
    detail: string;
  }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-6">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-surface/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{item.label}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{item.createdAt}</span>
                <StatusBadge status={item.status} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">{item.detail}</p>
            {item.adminNote && <p className="mt-1 text-xs text-foreground/70">{item.adminNote}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CryptoApproveRow({
  id,
  suggestedAmount,
  resolvingId,
  rejectingId,
  rejectNote,
  setRejectNote,
  startReject,
  cancelReject,
  onApprove,
  onReject,
}: {
  id: string;
  suggestedAmount?: number;
  resolvingId: string | null;
  rejectingId: string | null;
  rejectNote: string;
  setRejectNote: (v: string) => void;
  startReject: () => void;
  cancelReject: () => void;
  onApprove: (creditAmount: number) => void;
  onReject: () => void;
}) {
  const { t } = useI18n();
  const busy = resolvingId === id;
  const [creditAmount, setCreditAmount] = useState(
    suggestedAmount != null ? String(Math.round(suggestedAmount * 100) / 100) : ""
  );
  const amount = Number(creditAmount);

  if (rejectingId === id) {
    return (
      <div className="mt-3 space-y-2">
        <input
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t("admin.rejectNotePlaceholder")}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={cancelReject}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
          >
            <X size={13} />
            {t("admin.cancel")}
          </button>
          <button
            onClick={onReject}
            disabled={busy || !rejectNote.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
            {t("admin.confirmReject")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <div>
        <label className="block text-xs font-medium text-muted">{t("admin.creditAmountLabel")}</label>
        <input
          type="number"
          value={creditAmount}
          onChange={(e) => setCreditAmount(e.target.value)}
          placeholder={t("common.currency")}
          className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
        />
        {suggestedAmount != null && <p className="mt-1 text-xs text-muted">{t("admin.creditAmountByRate")}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onApprove(amount)}
          disabled={busy || !amount || amount <= 0}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
          {t("admin.approve")}
        </button>
        <button
          onClick={startReject}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-danger/40 disabled:opacity-60"
        >
          <X size={13} />
          {t("admin.reject")}
        </button>
      </div>
    </div>
  );
}

function ApproveRejectRow({
  id,
  resolvingId,
  rejectingId,
  rejectNote,
  setRejectNote,
  startReject,
  cancelReject,
  onApprove,
  onReject,
}: {
  id: string;
  resolvingId: string | null;
  rejectingId: string | null;
  rejectNote: string;
  setRejectNote: (v: string) => void;
  startReject: () => void;
  cancelReject: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useI18n();
  const busy = resolvingId === id;

  if (rejectingId === id) {
    return (
      <div className="mt-3 space-y-2">
        <input
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder={t("admin.rejectNotePlaceholder")}
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground focus:border-brand/50 focus:outline-none"
        />
        <div className="flex gap-2">
          <button
            onClick={cancelReject}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-brand/40 disabled:opacity-60"
          >
            <X size={13} />
            {t("admin.cancel")}
          </button>
          <button
            onClick={onReject}
            disabled={busy || !rejectNote.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-danger px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
            {t("admin.confirmReject")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
        {t("admin.approve")}
      </button>
      <button
        onClick={startReject}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground/90 transition hover:border-danger/40 disabled:opacity-60"
      >
        <X size={13} />
        {t("admin.reject")}
      </button>
    </div>
  );
}

function MethodEditor({
  method,
  onSave,
}: {
  method: PaymentMethod;
  onSave: (input: {
    code: string;
    details: string;
    network?: string;
    minAmount: number;
    maxAmount: number;
    enabled: boolean;
    rate?: number;
  }) => Promise<void>;
}) {
  const { t, tl } = useI18n();
  const [details, setDetails] = useState(method.details);
  const [network, setNetwork] = useState(method.network ?? "");
  const [minAmount, setMinAmount] = useState(String(method.minAmount));
  const [maxAmount, setMaxAmount] = useState(String(method.maxAmount));
  const [rate, setRate] = useState(method.rate != null ? String(method.rate) : "");
  const [enabled, setEnabled] = useState(method.enabled);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isCrypto = method.currency !== "TJS";

  const save = async () => {
    setStatus("saving");
    try {
      await onSave({
        code: method.code,
        details: details.trim(),
        network: network.trim() || undefined,
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        enabled,
        rate: isCrypto && rate.trim() ? Number(rate) : undefined,
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save payment method", err);
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{tl(method.name)}</h3>
        <label className="flex items-center gap-2 text-xs text-foreground/90">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-[var(--brand)]"
          />
          {t("admin.reqEnabled")}
        </label>
      </div>

      <label className="mt-3 block text-xs font-medium text-muted">{t("admin.reqDetails")}</label>
      <input
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder={t("admin.reqDetailsPlaceholder")}
        className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
      />

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-muted">{t("admin.reqNetwork")}</label>
          <input
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            placeholder="TRC20"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">{t("admin.reqMin")}</label>
          <input
            type="number"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted">{t("admin.reqMax")}</label>
          <input
            type="number"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
        </div>
      </div>

      {isCrypto && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted">
            {t("admin.reqRate")} (1 {method.currency} = ? {t("common.currency")})
          </label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="10.9"
            className="mt-1.5 w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-foreground focus:border-brand/50 focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">{t("admin.reqRateNote")}</p>
        </div>
      )}

      {status === "error" && <p className="mt-2 text-xs text-danger">{t("profile.saveError")}</p>}

      <button
        onClick={save}
        disabled={status === "saving"}
        className="mt-3 flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground transition hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "saving" && <Loader2 size={15} className="animate-spin" />}
        {status === "saved" && <Check size={15} />}
        {t(status === "saved" ? "admin.reqSaved" : "admin.reqSave")}
      </button>
    </div>
  );
}
