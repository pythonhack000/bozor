"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send, ShieldCheck, Loader2, Tag } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { useChat } from "@/lib/chat-context";
import { getMessages, sendMessage, subscribeToMessages, type ChatMessage } from "@/lib/chat";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/Badges";

export function MessagesView() {
  const { t, tl } = useI18n();
  const { user, isLoading } = useAuth();
  const { conversations, isLoading: loadingConversations, markRead, refresh } = useChat();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const appliedUrlConversation = useRef(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth?next=/messages");
  }, [user, isLoading, router]);

  useEffect(() => {
    // A conversation may have just been created (e.g. from a listing's
    // "message seller" button) after the global list was last fetched.
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (appliedUrlConversation.current) return;
    const fromUrl = searchParams.get("conversation");
    if (fromUrl && conversations.some((r) => r.id === fromUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(fromUrl);
      appliedUrlConversation.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    if (!activeId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingMessages(true);
    getMessages(activeId).then((rows) => {
      setMessages(rows);
      setLoadingMessages(false);
    });
    markRead(activeId);
    const unsubscribe = subscribeToMessages(activeId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== user?.id) markRead(activeId);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, messages]);

  if (isLoading || !user) return null;

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const send = async () => {
    if (!draft.trim() || !activeId || !user) return;
    const text = draft.trim();
    setDraft("");
    const inserted = await sendMessage(activeId, user.id, text);
    setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t("messages.title")}</h1>

      <div className="grid h-[600px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[300px_1fr]">
        <div className={`min-h-0 overflow-y-auto border-border md:border-r ${active ? "hidden md:block" : ""}`}>
          {loadingConversations ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">{t("messages.empty")}</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2.5 border-b border-border p-3.5 text-left transition hover:bg-surface-2 ${
                  activeId === c.id ? "bg-surface-2" : ""
                }`}
              >
                <Avatar name={c.otherParty.name} size={40} online={c.otherParty.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium text-foreground">{c.otherParty.name}</span>
                    {c.otherParty.verified && <VerifiedBadge />}
                  </div>
                  <p className="truncate text-xs text-muted">{c.lastMessage?.text ?? ""}</p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold leading-none text-white">
                    {c.unreadCount > 9 ? "9+" : c.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className={`flex min-h-0 flex-col ${active ? "" : "hidden md:flex"}`}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border p-3.5">
                <button onClick={() => setActiveId(null)} className="text-muted md:hidden">
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={active.otherParty.name} size={34} online={active.otherParty.online} />
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                    {active.otherParty.name}
                    {active.otherParty.verified && <VerifiedBadge />}
                  </div>
                  <span className="text-xs text-muted">
                    {active.otherParty.online ? t("common.online") : t("common.offline")}
                  </span>
                </div>
                <span className="ml-auto hidden items-center gap-1 text-xs text-brand sm:flex">
                  <ShieldCheck size={13} />
                  {t("common.guarantee")}
                </span>
              </div>

              {active.listing && (
                <Link
                  href={`/listing?id=${active.listing.id}`}
                  className="flex shrink-0 items-center gap-2.5 border-b border-border bg-surface-2/60 p-2.5 transition hover:bg-surface-2"
                >
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-surface">
                    {active.listing.image ? (
                      <Image src={active.listing.image} alt={tl(active.listing.title)} fill sizes="40px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted">
                        <Tag size={16} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{tl(active.listing.title)}</p>
                    <p className="text-[11px] text-muted">
                      {active.listing.price} {t("common.currency")}
                    </p>
                  </div>
                </Link>
              )}

              <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-muted" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-lg px-3.5 py-2 text-sm ${
                            mine
                              ? "rounded-br-sm bg-brand text-brand-foreground"
                              : "rounded-bl-sm bg-surface-2 text-foreground/90"
                          }`}
                        >
                          {m.text}
                          <div className={`mt-1 text-[10px] ${mine ? "text-brand-foreground/70" : "text-muted"}`}>
                            {new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-border p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={t("messages.typeMessage")}
                  className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-brand/50 focus:outline-none"
                />
                <button
                  onClick={send}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground transition hover:bg-brand-dark"
                  aria-label={t("common.send")}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              {t("messages.noConversations")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
