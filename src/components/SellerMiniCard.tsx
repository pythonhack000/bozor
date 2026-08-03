"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, MessageCircle, Loader2 } from "lucide-react";
import type { Seller } from "@/lib/types";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateConversation } from "@/lib/chat";
import { Avatar } from "./Avatar";
import { RatingStars } from "./RatingStars";
import { VerifiedBadge } from "./Badges";

export function SellerMiniCard({ seller, listingId }: { seller: Seller; listingId?: string }) {
  const { t, tl } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const handleMessageClick = async () => {
    if (!user) {
      router.push("/auth?next=/messages");
      return;
    }
    setCreating(true);
    try {
      const conversationId = await getOrCreateConversation(user.id, seller.id, listingId ?? null);
      router.push(`/messages?conversation=${conversationId}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Link href={`/seller?id=${seller.id}`} className="flex items-center gap-3">
        <Avatar name={seller.name} size={44} online={seller.online} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{seller.name}</span>
            {seller.verified && <VerifiedBadge />}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <RatingStars rating={seller.rating} size={12} />
            <span>{seller.rating}</span>
          </div>
        </div>
      </Link>

      <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs text-muted">
        <div className="flex justify-between">
          <span>{t("seller.sales")}</span>
          <span className="text-foreground/80">{seller.salesCount}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("seller.responseTime")}</span>
          <span className="text-foreground/80">{tl(seller.responseTime)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {t("seller.city")}
          </span>
          <span className="text-foreground/80">{seller.city}</span>
        </div>
      </div>

      <button
        onClick={handleMessageClick}
        disabled={creating}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs font-medium text-foreground/90 transition hover:border-brand/40 hover:text-brand disabled:opacity-60"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
        {t("listing.writeMessage")}
      </button>
    </div>
  );
}
