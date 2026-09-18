"use client";

import useSeller from "apps/seller-ui/src/hooks/useSeller";
import axiosInstance from "apps/seller-ui/src/utils/axioInstance";
import {
  ChevronLeft,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* --------------------------- types --------------------------- */
interface Buyer {
  id: string | null;
  name: string;
  avatar: string | null;
  isOnline: boolean;
}

interface Conversation {
  conversationId: string;
  user: Buyer;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: string;
  content: string | null;
  attachments: string[];
  status: string;
  createdAt: string;
}

/* --------------------------- helpers --------------------------- */
const DEFAULT_AVATAR =
  "https://hunggiaco.com/wp-content/uploads/2026/03/avatar-mac-dinh-facebook-1-1.jpg";

/** Return a non-empty avatar URL, falling back to DEFAULT_AVATAR */
const safeAvatar = (url?: string | null) => (url ? url : DEFAULT_AVATAR);

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
};

/* --------------------------- page --------------------------- */
const SellerInbox = () => {
  const searchParams = useSearchParams();
  const { seller, isLoading: sellerLoading } = useSeller();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const selectedChatRef = useRef<Conversation | null>(null);

  const [chats, setChats] = useState<Conversation[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const conversationId = searchParams.get("conversationId");

  /* -- fetch conversation list -- */
  const fetchConversations = useCallback(async () => {
    try {
      setChatsLoading(true);
      const res = await axiosInstance.get(
        "/chatting/api/get-seller-conversations",
      );
      setChats(res.data?.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sellerLoading && seller) fetchConversations();
  }, [sellerLoading, seller, fetchConversations]);

  /* -- auto-open conversation from URL param -- */
  useEffect(() => {
    if (conversationId && chats.length && !selectedChat) {
      const found = chats.find((c) => c.conversationId === conversationId);
      if (found) openChat(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, chats]);

  /* -- fetch messages -- */
  const fetchMessages = useCallback(async (convId: string, p: number = 1) => {
    try {
      setMessagesLoading(true);
      const res = await axiosInstance.get(
        `/chatting/api/get-seller-messages/${convId}?page=${p}`,
      );
      const fetched: Message[] = res.data?.messages || [];
      setBuyer(res.data?.user || null);
      setHasMore(res.data?.hasMore ?? false);
      setMessages((prev) => {
        if (p === 1) {
          // Keep WS messages (not yet in DB) at the top
          const wsOnly = prev.filter(
            (m) =>
              m.id.startsWith("ws-") &&
              !fetched.some(
                (f) => f.content === m.content && f.senderId === m.senderId,
              ),
          );
          return [...wsOnly, ...fetched];
        }
        return [...prev, ...fetched];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const openChat = (chat: Conversation) => {
    selectedChatRef.current = chat;
    setSelectedChat(chat);
    setMessages([]);
    setPage(1);
    setHasMore(true);
    fetchMessages(chat.conversationId, 1);
    setMobileShowChat(true);
    router.replace(`/dashboard/inbox?conversationId=${chat.conversationId}`);
  };

  /* -- WebSocket connection -- */
  useEffect(() => {
    if (!seller?.id) return;

    const ws = new WebSocket(`ws://localhost:6006`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(`seller_${seller.id}`);
      console.log("WebSocket connected as seller_" + seller.id);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE") {
          const msg = data.payload;
          // Only update messages if this conversation is currently open
          if (selectedChatRef.current?.conversationId === msg.conversationId) {
            setMessages((prev) => {
              const isDuplicate = prev.some(
                (m) =>
                  !m.id.startsWith("temp-") &&
                  m.content === msg.content &&
                  m.senderId === msg.senderId,
              );
              if (isDuplicate) return prev;
              const newMsg: Message = {
                id: `ws-${Date.now()}`,
                conversationId: msg.conversationId,
                senderId: msg.senderId,
                senderType: msg.senderType,
                content: msg.content,
                attachments: [],
                status: "sent",
                createdAt: msg.createdAt,
              };
              return [newMsg, ...prev.filter((m) => !m.id.startsWith("temp-"))];
            });
          }
          // Always refresh conversation list for incoming user messages
          if (msg.senderType !== "seller") {
            fetchConversations();
          }
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    ws.onerror = (e) => console.error("WebSocket error", e);
    ws.onclose = () => console.log("WebSocket closed");

    return () => {
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller?.id]);

  /* -- send message -- */
  const handleSend = () => {
    if (!message.trim() || !selectedChat || !buyer?.id) return;
    const content = message.trim();
    setMessage("");
    setSending(false);

    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedChat.conversationId,
      senderId: seller?.id || "",
      senderType: "seller",
      content,
      attachments: [],
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          fromUserId: seller?.id,
          toUserId: buyer.id,
          messageBody: content,
          conversationId: selectedChat.conversationId,
          senderType: "seller",
        }),
      );
    } else {
      console.warn("WebSocket not open");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const loadMore = () => {
    if (!hasMore || messagesLoading || !selectedChat) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchMessages(selectedChat.conversationId, nextPage);
  };

  if (sellerLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0a0a0a] min-h-screen p-6">
      <h1 className="text-2xl font-bold text-white mb-5 flex items-center gap-2">
        <MessageCircle className="w-6 h-6 text-blue-400" />
        Inbox
      </h1>

      <div className="flex h-[82vh] rounded-xl overflow-hidden border border-slate-800 bg-[#111]">
        {/* -- LEFT: Conversation List -- */}
        <div
          className={`w-full md:w-[35%] border-r border-slate-800 flex flex-col ${mobileShowChat ? "hidden md:flex" : "flex"}`}
        >
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-sm font-semibold text-slate-300">
              All Conversations
            </p>
          </div>

          <div className="overflow-y-auto flex-1">
            {chatsLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              </div>
            ) : chats.length === 0 ? (
              <EmptyConversations />
            ) : (
              chats.map((chat) => (
                <ConversationItem
                  key={chat.conversationId}
                  chat={chat}
                  active={selectedChat?.conversationId === chat.conversationId}
                  onClick={() => openChat(chat)}
                />
              ))
            )}
          </div>
        </div>

        {/* -- RIGHT: Message Panel -- */}
        <div
          className={`w-full md:w-[65%] flex flex-col ${!mobileShowChat ? "hidden md:flex" : "flex"}`}
        >
          {selectedChat ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[#111] shadow-sm">
                <button
                  className="md:hidden p-1 rounded-full hover:bg-slate-800 transition"
                  onClick={() => setMobileShowChat(false)}
                >
                  <ChevronLeft className="w-5 h-5 text-slate-400" />
                </button>

                <div className="relative">
                  <Image
                    src={safeAvatar(buyer?.avatar)}
                    alt={buyer?.name || "Buyer"}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700"
                  />
                  {buyer?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#111]" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {buyer?.name || selectedChat.user.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {buyer?.isOnline ? "Online" : "Offline"}
                  </p>
                </div>

                <button className="p-1.5 rounded-full hover:bg-slate-800 transition text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col-reverse gap-3 bg-[#0d0d0d]">
                <div ref={scrollAnchorRef} />

                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.senderType === "seller"}
                    sellerAvatar={seller?.shop?.avatar?.[0]?.url}
                    buyerAvatar={buyer?.avatar}
                  />
                ))}

                {messagesLoading && page === 1 && (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                  </div>
                )}

                {hasMore && !messagesLoading && (
                  <button
                    onClick={loadMore}
                    className="mx-auto text-xs text-blue-400 hover:underline py-2"
                  >
                    Load older messages
                  </button>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-800 bg-[#111] flex items-center gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 text-sm bg-slate-800 text-white rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sending}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition active:scale-95"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <EmptyChat />
          )}
        </div>
      </div>
    </div>
  );
};

export default SellerInbox;

/* --------------------------- sub-components --------------------------- */

const ConversationItem = ({
  chat,
  active,
  onClick,
}: {
  chat: Conversation;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-800/60 transition hover:bg-slate-800/50 ${active ? "bg-slate-800/70 border-l-2 border-l-blue-500" : ""}`}
  >
    <div className="relative flex-shrink-0">
      <Image
        src={safeAvatar(chat.user.avatar)}
        alt={chat.user.name}
        width={44}
        height={44}
        className="w-11 h-11 rounded-full object-cover border border-slate-700"
      />
      {chat.user.isOnline && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#111]" />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold text-slate-200 truncate">
          {chat.user.name}
        </p>
        <span className="text-[10px] text-slate-500 ml-1 flex-shrink-0">
          {formatTime(chat.lastMessageAt)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
        {chat.unreadCount > 0 && (
          <span className="ml-2 flex-shrink-0 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
          </span>
        )}
      </div>
    </div>
  </button>
);

const MessageBubble = ({
  msg,
  isOwn,
  sellerAvatar,
  buyerAvatar,
}: {
  msg: Message;
  isOwn: boolean;
  sellerAvatar?: string | null;
  buyerAvatar?: string | null;
}) => (
  <div
    className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
  >
    <Image
      src={isOwn ? safeAvatar(sellerAvatar) : safeAvatar(buyerAvatar)}
      alt="avatar"
      width={28}
      height={28}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-slate-700"
    />
    <div
      className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
        isOwn
          ? "bg-blue-600 text-white rounded-br-none"
          : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700"
      } ${msg.status === "sending" ? "opacity-60" : ""}`}
    >
      <p>{msg.content}</p>
      <p
        className={`text-[10px] mt-1 text-right ${isOwn ? "text-blue-200" : "text-slate-500"}`}
      >
        {msg.status === "sending" ? "Sending..." : formatTime(msg.createdAt)}
      </p>
    </div>
  </div>
);

const EmptyConversations = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
    <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
      <Users className="w-7 h-7 text-blue-400" />
    </div>
    <p className="font-semibold text-slate-300 text-sm">No conversations yet</p>
    <p className="text-xs text-slate-500">
      Customers who message your shop will appear here.
    </p>
  </div>
);

const EmptyChat = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
      <MessageCircle className="w-8 h-8 text-blue-400" />
    </div>
    <p className="font-semibold text-slate-300">Select a conversation</p>
    <p className="text-xs text-slate-500 max-w-[220px]">
      Choose a chat from the left to start messaging a customer.
    </p>
  </div>
);
