import { supabase } from "./supabase";

export interface ConversationSummary {
  id: string;
  otherParty: { id: string; name: string; online: boolean; verified: boolean };
  lastMessage: { text: string; createdAt: string } | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export async function getOrCreateConversation(
  buyerId: string,
  sellerId: string,
  listingId: string | null
): Promise<string> {
  let query = supabase.from("conversations").select("id").eq("buyer_id", buyerId).eq("seller_id", sellerId);
  query = listingId ? query.eq("listing_id", listingId) : query.is("listing_id", null);
  const { data: existing, error: selError } = await query.maybeSingle();
  if (selError) throw selError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ buyer_id: buyerId, seller_id: sellerId, listing_id: listingId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

interface ConversationRow {
  id: string;
  buyer_id: string;
  seller_id: string;
  buyer: { id: string; name: string; online: boolean; verified: boolean };
  seller: { id: string; name: string; online: boolean; verified: boolean };
  messages: { text: string; created_at: string }[];
}

export async function getConversations(userId: string): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, buyer_id, seller_id, buyer:profiles!buyer_id(id,name,online,verified), seller:profiles!seller_id(id,name,online,verified), messages(text, created_at)"
    )
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as ConversationRow[]).map((row) => {
    const isBuyer = row.buyer_id === userId;
    const other = isBuyer ? row.seller : row.buyer;
    const msgs = [...(row.messages ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = msgs[msgs.length - 1];
    return {
      id: row.id,
      otherParty: other,
      lastMessage: last ? { text: last.text, createdAt: last.created_at } : null,
    };
  });
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, text, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    text: m.text,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, text })
    .select("id, sender_id, text, created_at")
    .single();
  if (error) throw error;
  return { id: data.id, senderId: data.sender_id, text: data.text, createdAt: data.created_at };
}

export function subscribeToMessages(conversationId: string, onInsert: (message: ChatMessage) => void) {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const m = payload.new as { id: string; sender_id: string; text: string; created_at: string };
        onInsert({ id: m.id, senderId: m.sender_id, text: m.text, createdAt: m.created_at });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
