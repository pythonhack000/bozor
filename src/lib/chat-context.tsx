"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth-context";
import {
  getConversations,
  markConversationRead,
  subscribeToAllMessages,
  type ConversationSummary,
} from "./chat";

interface ChatContextValue {
  conversations: ConversationSummary[];
  unreadCount: number;
  isLoading: boolean;
  refresh: () => Promise<void>;
  markRead: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    setIsLoading(true);
    try {
      setConversations(await getConversations(user.id));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    return subscribeToAllMessages(user.id, refresh);
  }, [user, refresh]);

  const markRead = useCallback(
    async (conversationId: string) => {
      if (!user) return;
      await markConversationRead(conversationId);
      await refresh();
    },
    [user, refresh]
  );

  const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <ChatContext.Provider value={{ conversations, unreadCount, isLoading, refresh, markRead }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
