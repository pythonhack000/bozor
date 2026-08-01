import { ShieldCheck, BadgeCheck, Zap } from "lucide-react";

export function GuaranteeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
      <ShieldCheck size={14} />
      {label}
    </span>
  );
}

export function VerifiedBadge() {
  return <BadgeCheck size={16} className="text-brand" />;
}

export function InstantBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-medium text-gold">
      <Zap size={11} className="fill-gold" />
      {label}
    </span>
  );
}
