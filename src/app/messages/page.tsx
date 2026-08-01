"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n-context";
import { useAuth } from "@/lib/auth-context";
import { sellers } from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { VerifiedBadge } from "@/components/Badges";

interface ChatMessage {
  id: string;
  from: "me" | "them";
  text: string;
  time: string;
}

function seedConversations() {
  const templates: Record<string, ChatMessage[]> = {
    s1: [
      { id: "1", from: "them", text: "Здравствуйте! Аккаунт ещё в наличии, могу выдать сразу после оплаты.", time: "10:12" },
      { id: "2", from: "me", text: "Отлично, оформляю заказ через гарантию.", time: "10:14" },
      { id: "3", from: "them", text: "Хорошо, жду оплату, данные пришлю в течение 5 минут.", time: "10:15" },
    ],
    s2: [
      { id: "1", from: "them", text: "Добрый день, по каналу остались вопросы?", time: "Вчера" },
      { id: "2", from: "me", text: "Да, какой средний охват за последнюю неделю?", time: "Вчера" },
    ],
    s5: [
      { id: "1", from: "me", text: "Аккаунт с CS2 Prime ещё продаётся?", time: "Пн" },
      { id: "2", from: "them", text: "Да, актуально. Могу скинуть скриншот инвентаря.", time: "Пн" },
    ],
  };
  return templates;
}

export default function MessagesPage() {
  const { t } = useI18n();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [conversations] = useState(seedConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [threads, setThreads] = useState(conversations);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatSellers = sellers.filter((s) => s.id in threads);
  const active = activeId ? chatSellers.find((s) => s.id === activeId) : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeId, threads]);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth?next=/messages");
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  const send = () => {
    if (!draft.trim() || !activeId) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      from: "me",
      text: draft.trim(),
      time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    };
    setThreads((prev) => ({ ...prev, [activeId]: [...prev[activeId], msg] }));
    setDraft("");

    setTimeout(() => {
      setThreads((prev) => ({
        ...prev,
        [activeId]: [
          ...prev[activeId],
          {
            id: crypto.randomUUID(),
            from: "them",
            text: "Принято, отвечу в ближайшее время.",
            time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          },
        ],
      }));
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{t("messages.title")}</h1>

      <div className="grid h-[600px] overflow-hidden rounded-lg border border-border bg-surface md:grid-cols-[300px_1fr]">
        <div className={`overflow-y-auto border-border md:border-r ${active ? "hidden md:block" : ""}`}>
          {chatSellers.map((s) => {
            const thread = threads[s.id];
            const last = thread[thread.length - 1];
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`flex w-full items-center gap-2.5 border-b border-border p-3.5 text-left transition hover:bg-surface-2 ${
                  activeId === s.id ? "bg-surface-2" : ""
                }`}
              >
                <Avatar name={s.name} size={40} online={s.online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-medium text-foreground">{s.name}</span>
                    {s.verified && <VerifiedBadge />}
                  </div>
                  <p className="truncate text-xs text-muted">{last?.text}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{last?.time}</span>
              </button>
            );
          })}
        </div>

        <div className={`flex flex-col ${active ? "" : "hidden md:flex"}`}>
          {active ? (
            <>
              <div className="flex items-center gap-2.5 border-b border-border p-3.5">
                <button onClick={() => setActiveId(null)} className="text-muted md:hidden">
                  <ArrowLeft size={18} />
                </button>
                <Avatar name={active.name} size={34} online={active.online} />
                <div>
                  <div className="flex items-center gap-1 text-sm font-medium text-foreground">
                    {active.name}
                    {active.verified && <VerifiedBadge />}
                  </div>
                  <span className="text-xs text-muted">
                    {active.online ? t("common.online") : t("common.offline")}
                  </span>
                </div>
                <span className="ml-auto hidden items-center gap-1 text-xs text-brand sm:flex">
                  <ShieldCheck size={13} />
                  {t("common.guarantee")}
                </span>
              </div>

              <div ref={scrollRef} className="scrollbar-thin flex-1 space-y-2.5 overflow-y-auto p-4">
                {threads[active.id].map((m) => (
                  <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3.5 py-2 text-sm ${
                        m.from === "me"
                          ? "rounded-br-sm bg-brand text-brand-foreground"
                          : "rounded-bl-sm bg-surface-2 text-foreground/90"
                      }`}
                    >
                      {m.text}
                      <div
                        className={`mt-1 text-[10px] ${m.from === "me" ? "text-brand-foreground/70" : "text-muted"}`}
                      >
                        {m.time}
                      </div>
                    </div>
                  </div>
                ))}
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
