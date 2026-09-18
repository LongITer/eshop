"use client";

import useRequireAuth from "@/hooks/useRequireAuth";
import axiosInstance from "@/utils/axioInstance";
import isProtected from "@/utils/protected";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  Store,
} from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/* ─────────────────────────── types ─────────────────────────── */
interface Seller {
  id: string | null;
  name: string;
  avatar: string | null;
  isOnline: boolean;
}

interface Conversation {
  conversationId: string;
  seller: Seller;
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

/* ─────────────────────────── helpers ─────────────────────────── */
const DEFAULT_AVATAR =
  "https://hunggiaco.com/wp-content/uploads/2026/03/avatar-mac-dinh-facebook-1-1.jpg";

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
};

/* ═══════════════════════════ page ═══════════════════════════ */
const Inbox = () => {
  const searchParams = useSearchParams();
  const { user, isLoading: userLoading } = useRequireAuth();
  const router = useRouter();
  const wsRef = useRef<WebSocket | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const selectedChatRef = useRef<Conversation | null>(null);
  const queryClient = useQueryClient();

  const [chats, setChats] = useState<Conversation[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const conversationId = searchParams.get("conversationId");

  /* ── fetch conversation list ── */
  const fetchConversations = useCallback(async () => {
    try {
      setChatsLoading(true);
      const res = await axiosInstance.get(
        "/chatting/api/get-user-conversations",
        isProtected,
      );
      setChats(res.data?.conversations || []);
    } catch (e) {
      console.error(e);
    } finally {
      setChatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading && user) fetchConversations();
  }, [userLoading, user, fetchConversations]);

  /* ── auto-open conversation from URL param (only on initial load) ── */
  useEffect(() => {
    if (conversationId && chats.length && !selectedChat) {
      const found = chats.find((c) => c.conversationId === conversationId);
      if (found) openChat(found);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, chats]);

  /* ── fetch messages for selected conversation ── */
  const fetchMessages = useCallback(
    async (convId: string, p: number = 1) => {
      try {
        setMessagesLoading(true);
        const res = await axiosInstance.get(
          `/chatting/api/get-messages/${convId}?page=${p}`,
          isProtected,
        );
        const fetched: Message[] = res.data?.messages || [];
        setSeller(res.data?.seller || null);
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
    },
    [],
  );

  const openChat = (chat: Conversation) => {
    selectedChatRef.current = chat;
    setSelectedChat(chat);
    setMessages([]);
    setPage(1);
    setHasMore(true);
    fetchMessages(chat.conversationId, 1);
    setMobileShowChat(true);
    router.replace(`/inbox?conversationId=${chat.conversationId}`);
  };

  /* ── WebSocket connection ── */
  useEffect(() => {
    if (!user?.id) return;

    const ws = new WebSocket(`ws://localhost:6006`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Register this user with the WS server
      ws.send(`user_${user.id}`);
      console.log("WebSocket connected and registered as user_" + user.id);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE") {
          const msg = data.payload;
          // Only update messages if this conversation is currently open
          if (selectedChatRef.current?.conversationId === msg.conversationId) {
            setMessages((prev) => {
              // Avoid duplicating optimistic messages
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
          // Only refresh conversation list for incoming messages (not own echo)
          if (msg.senderType !== "user") {
            fetchConversations();
          }
        }
      } catch (e) {
        console.error("WS message parse error", e);
      }
    };

    ws.onerror = (e) => console.error("WebSocket error", e);
    ws.onclose = () => console.log("WebSocket closed");

    return () => {
      ws.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  /* ── send message via WebSocket ── */
  const handleSend = () => {
    if (!message.trim() || !selectedChat || !seller?.id) return;
    const content = message.trim();
    setMessage("");

    // Optimistic UI
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedChat.conversationId,
      senderId: user?.id || "",
      senderType: "user",
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
          fromUserId: user?.id,
          toUserId: seller.id,
          messageBody: content,
          conversationId: selectedChat.conversationId,
          senderType: "user",
        }),
      );
    } else {
      console.warn("WebSocket not open — message may not be delivered");
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

  /* ─────────────────────────── render ─────────────────────────── */
  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="md:w-[85%] mx-auto pt-5 pb-10 px-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-5 flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-blue-500" />
          Inbox
        </h1>

        <div className="flex h-[80vh] rounded-xl shadow-md overflow-hidden border border-gray-200 bg-white">
          {/* ── LEFT: Conversation List ── */}
          <div
            className={`w-full md:w-[35%] border-r border-gray-100 flex flex-col ${mobileShowChat ? "hidden md:flex" : "flex"}`}
          >
            {/* header */}
            <div className="px-4 py-3 border-b border-gray-100 bg-white">
              <p className="text-sm font-semibold text-gray-700">
                All Conversations
              </p>
            </div>

            {/* list */}
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
                    active={
                      selectedChat?.conversationId === chat.conversationId
                    }
                    onClick={() => openChat(chat)}
                    userId={user?.id}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── RIGHT: Message Panel ── */}
          <div
            className={`w-full md:w-[65%] flex flex-col ${!mobileShowChat ? "hidden md:flex" : "flex"}`}
          >
            {selectedChat ? (
              <>
                {/* chat header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shadow-sm">
                  {/* back button (mobile) */}
                  <button
                    className="md:hidden p-1 rounded-full hover:bg-gray-100 transition"
                    onClick={() => setMobileShowChat(false)}
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-500" />
                  </button>

                  <div className="relative">
                    <Image
                      src={seller?.avatar || DEFAULT_AVATAR}
                      alt={seller?.name || "Seller"}
                      width={40}
                      height={40}
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
                    {seller?.isOnline && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {seller?.name || selectedChat.seller.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {seller?.isOnline ? "Online" : "Offline"}
                    </p>
                  </div>

                  <button className="p-1.5 rounded-full hover:bg-gray-100 transition text-gray-400">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* messages */}
                <div
                  ref={messageContainerRef}
                  className="flex-1 overflow-y-auto px-4 py-4 flex flex-col-reverse gap-3 bg-gray-50"
                >
                  <div ref={scrollAnchorRef} />

                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      isOwn={msg.senderType === "user"}
                      userAvatar={user?.avatar}
                      sellerAvatar={seller?.avatar}
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
                      className="mx-auto text-xs text-blue-500 hover:underline py-2"
                    >
                      Load older messages
                    </button>
                  )}
                </div>

                {/* input */}
                <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center gap-3">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    className="flex-1 text-sm bg-gray-100 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-300 transition placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition active:scale-95"
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
    </div>
  );
};

export default Inbox;

/* ─────────────────────────── sub-components ─────────────────────────── */

const ConversationItem = ({
  chat,
  active,
  onClick,
  userId,
}: {
  chat: Conversation;
  active: boolean;
  onClick: () => void;
  userId?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-50 transition hover:bg-blue-50 ${active ? "bg-blue-50 border-l-2 border-l-blue-500" : ""}`}
  >
    <div className="relative flex-shrink-0">
      <Image
        src={chat.seller.avatar || DEFAULT_AVATAR}
        alt={chat.seller.name}
        width={44}
        height={44}
        className="w-11 h-11 rounded-full object-cover border border-gray-200"
      />
      {chat.seller.isOnline && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex justify-between items-baseline">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {chat.seller.name}
        </p>
        <span className="text-[10px] text-gray-400 ml-1 flex-shrink-0">
          {formatTime(chat.lastMessageAt)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
        {chat.unreadCount > 0 && (
          <span className="ml-2 flex-shrink-0 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
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
  userAvatar,
  sellerAvatar,
}: {
  msg: Message;
  isOwn: boolean;
  userAvatar?: string | null;
  sellerAvatar?: string | null;
}) => (
  <div className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
    <Image
      src={
        isOwn
          ? userAvatar || DEFAULT_AVATAR
          : sellerAvatar || DEFAULT_AVATAR
      }
      alt="avatar"
      width={28}
      height={28}
      className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200"
    />
    <div
      className={`max-w-[65%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
        isOwn
          ? "bg-blue-500 text-white rounded-br-none"
          : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
      } ${msg.status === "sending" ? "opacity-60" : ""}`}
    >
      <p>{msg.content}</p>
      <p
        className={`text-[10px] mt-1 text-right ${isOwn ? "text-blue-100" : "text-gray-400"}`}
      >
        {msg.status === "sending" ? "Sending…" : formatTime(msg.createdAt)}
      </p>
    </div>
  </div>
);

const EmptyConversations = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
      <Store className="w-7 h-7 text-blue-400" />
    </div>
    <p className="font-semibold text-gray-700 text-sm">No conversations yet</p>
    <p className="text-xs text-gray-400">
      Chat with sellers directly from a product page.
    </p>
  </div>
);

const EmptyChat = () => (
  <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
      <MessageCircle className="w-8 h-8 text-blue-400" />
    </div>
    <p className="font-semibold text-gray-700">Select a conversation</p>
    <p className="text-xs text-gray-400 max-w-[220px]">
      Choose a chat from the left to start messaging a seller.
    </p>
  </div>
);
