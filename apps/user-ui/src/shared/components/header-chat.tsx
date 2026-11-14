'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ChevronLeft, Loader2, MessageCircle, RefreshCw, Search, Send, Store, X } from 'lucide-react';
import { AttachmentPreview, ChatAttachments, MessageAttachment, useChatConnection } from '@packages/components/chat';
import { useStorefrontText } from '@packages/components/storefront-language';
import axios from '@/utils/axioInstance';
import useUser from '@/hooks/useUser';

export const headerActionClass = 'relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-current transition-colors hover:text-[#3489FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4';
export function HeaderActionCount({ count }: { count: number }) {
  return <span aria-hidden="true" className="absolute -right-2.5 -top-2.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-0.5 text-sm font-medium leading-none text-white">{count > 99 ? '99+' : count}</span>;
}

type ChatController = { open: boolean; panelId: string; toggle: (trigger: HTMLButtonElement) => void; close: (restoreFocus?: boolean) => void };
const HeaderChatContext = createContext<ChatController | null>(null);
export const useHeaderChatController = () => useContext(HeaderChatContext);
type Draft = { text: string; attachments: string[] };

/** Both header rows control one popup. The existing full-screen inbox owns its own chat connection. */
export function HeaderChatProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const pathname = usePathname();
  const panelId = useId();
  const [opened, setOpened] = useState<{ userId: string; pathname: string } | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const drafts = useRef<Record<string, Draft>>({});
  const isInbox = pathname === '/inbox' || pathname.startsWith('/inbox/');
  const open = !!user?.id && opened?.userId === user.id && opened?.pathname === pathname && !isInbox;
  useEffect(() => { setOpened(null); }, [pathname, user?.id]);
  useEffect(() => { drafts.current = {}; }, [user?.id]);
  const close = useCallback((restoreFocus = false) => {
    setOpened(null);
    if (restoreFocus && trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
  }, []);
  const toggle = (element: HTMLButtonElement) => {
    trigger.current = element;
    setOpened(open || !user?.id ? null : { userId: user.id, pathname });
  };
  return <HeaderChatContext.Provider value={{ open, panelId, toggle, close }}>
    {children}
    {open && <HeaderChatPopup key={user.id} userId={user.id} panelId={panelId} trigger={trigger.current} onClose={close} drafts={drafts.current} />}
  </HeaderChatContext.Provider>;
}

export function HeaderMessageButton({ userId }: { userId: string }) {
  const { t } = useStorefrontText();
  const controller = useContext(HeaderChatContext);
  const pathname = usePathname();
  const { data = 0 } = useQuery({
    queryKey: ['header-chat-unread', userId],
    queryFn: async ({ signal }) => (await axios.get('/chatting/api/unread-count', { signal })).data.unreadCount as number,
    staleTime: 10000, refetchInterval: 10000,
  });
  const contents = <><MessageCircle size={24} aria-hidden="true" /><HeaderActionCount count={data} /></>;
  const label = `${t('Messages')}: ${data} ${t('unread')}`;
  if (!controller || pathname === '/inbox' || pathname.startsWith('/inbox/')) return <Link href="/inbox" aria-label={label} title={t('Messages')} className={headerActionClass}>{contents}</Link>;
  return <button type="button" data-header-message-trigger aria-label={label} title={t('Messages')} aria-haspopup="dialog" aria-expanded={controller.open} aria-controls={controller.open ? controller.panelId : undefined} onClick={event => controller.toggle(event.currentTarget)} className={headerActionClass}>{contents}</button>;
}

type Seller = { id: string | null; name: string; avatar: string | null; isOnline: boolean };
type Conversation = { conversationId: string; seller: Seller; lastMessage: string; lastMessageAt: string; unreadCount: number };
type ChatMessage = { id: string; conversationId: string; senderId: string; senderType: string; content: string | null; attachments?: string[]; createdAt: string };
type MessagePage = { messages: ChatMessage[]; seller: Seller; hasMore: boolean };
type PendingMessage = { conversationId: string; text: string; attachments: string[] };

const emptyDraft = (): Draft => ({ text: '', attachments: [] });
const sameAttachments = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((url, index) => url === b[index]);
const actionClass = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50';

function ChatAvatar({ seller, size = 'h-10 w-10', showPresence = true }: { seller: Seller; size?: string; showPresence?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [seller.avatar]);
  return <span className={`relative inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-blue-50 text-blue-500 ${size}`}>
    {seller.avatar && !failed ? <img src={seller.avatar} alt="" onError={() => setFailed(true)} className="h-full w-full rounded-full object-cover" /> : <Store size={20} aria-hidden="true" />}
    {showPresence && seller.isOnline && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />}
  </span>;
}

function HeaderChatPopup({ userId, panelId, trigger, onClose, drafts }: {
  userId: string; panelId: string; trigger: HTMLButtonElement | null; onClose: (restoreFocus?: boolean) => void;
  drafts: Record<string, Draft>;
}) {
  const { t, locale } = useStorefrontText();
  const client = useQueryClient();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const socket = useRef<WebSocket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const pending = useRef<PendingMessage | null>(null);
  const focusAfterSend = useRef(false);
  const sendTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typingSentAt = useRef(0);
  const mounted = useRef(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const draftRef = useRef(draft); draftRef.current = draft;
  const [search, setSearch] = useState('');
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [typing, setTyping] = useState(false);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [position, setPosition] = useState({ top: 80, right: 12, width: 390, height: 560 });
  const conversationKey = ['header-chat-conversations', userId];
  const unreadKey = ['header-chat-unread', userId];
  const conversations = useQuery({
    queryKey: conversationKey,
    queryFn: async ({ signal }) => (await axios.get('/chatting/api/get-user-conversations', { signal })).data.conversations as Conversation[],
    staleTime: 0, refetchInterval: 15000, retry: 1,
  });
  const selected = conversations.data?.find(chat => chat.conversationId === selectedId);
  const messages = useInfiniteQuery({
    queryKey: ['header-chat-messages', userId, selectedId],
    enabled: !!selected,
    initialPageParam: 1,
    queryFn: async ({ signal, pageParam }) => (await axios.get(`/chatting/api/get-messages/${selectedId}?page=${pageParam}`, { signal })).data as MessagePage,
    getNextPageParam: (lastPage, pages) => lastPage.hasMore ? pages.length + 1 : undefined,
    staleTime: 0, retry: 1,
  });
  const sellerDetails = messages.data?.pages[0]?.seller || selected?.seller;
  const seller = sellerDetails ? { ...sellerDetails, isOnline: selected?.seller.isOnline ?? sellerDetails.isOnline } : undefined;
  const refreshCounts = () => {
    clearTimeout(refreshTimeout.current);
    refreshTimeout.current = setTimeout(() => {
      void client.invalidateQueries({ queryKey: conversationKey });
      void client.invalidateQueries({ queryKey: unreadKey });
    }, 800);
  };
  const sendFrame = (frame: object) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false;
    socket.current.send(JSON.stringify(frame));
    return true;
  };
  const ready = useChatConnection({ actorId: userId, api: axios, socketRef: socket, onEvent: event => {
    if (event.type === 'READY') {
      void client.invalidateQueries({ queryKey: conversationKey });
      void client.invalidateQueries({ queryKey: ['header-chat-messages', userId] });
      refreshCounts();
    }
    if (event.type === 'ERROR') {
      pending.current = null; clearTimeout(sendTimeout.current); setSending(false);
      setError('Could not send the message. Please try again.');
    }
    if (event.type === 'PRESENCE') void client.invalidateQueries({ queryKey: conversationKey });
    if (event.type === 'TYPING' && event.payload?.conversationId === selectedRef.current) {
      clearTimeout(typingTimeout.current); setTyping(!!event.payload.typing);
      if (event.payload.typing) typingTimeout.current = setTimeout(() => setTyping(false), 3000);
    }
    if (event.type === 'NEW_MESSAGE') {
      const message: ChatMessage = event.payload;
      if (message.conversationId === selectedRef.current) {
        setLive(current => [message, ...current.filter(item => item.id !== message.id)].slice(0, 100));
        setTyping(false);
        if (message.senderType !== 'user' && document.visibilityState === 'visible') sendFrame({ type: 'MARK_AS_SEEN', conversationId: message.conversationId });
        const sent = pending.current;
        if (sent && message.senderId === userId && message.conversationId === sent.conversationId && (message.content || '') === sent.text && sameAttachments(message.attachments, sent.attachments)) {
          pending.current = null; clearTimeout(sendTimeout.current); setSending(false); setError('');
          if (draftRef.current.text.trim() === sent.text && sameAttachments(draftRef.current.attachments, sent.attachments)) updateDraft(emptyDraft());
          focusAfterSend.current = true;
        }
      }
      refreshCounts();
    }
  } });

  function updateDraft(value: Draft) {
    draftRef.current = value; setDraft(value);
    if (selectedRef.current) drafts[selectedRef.current] = value;
  }
  function selectChat(id: string | null) {
    if (selectedRef.current) sendFrame({ type: 'TYPING', conversationId: selectedRef.current, typing: false });
    selectedRef.current = id; setSelectedId(id);
    pending.current = null; clearTimeout(sendTimeout.current); clearTimeout(typingTimeout.current);
    focusAfterSend.current = false;
    setSending(false); setError(''); setTyping(false); setLive([]);
    const next = id ? drafts[id] || emptyDraft() : emptyDraft();
    draftRef.current = next; setDraft(next);
  }
  useEffect(() => {
    if (messages.dataUpdatedAt && selectedId) {
      void client.invalidateQueries({ queryKey: unreadKey });
      client.setQueryData<Conversation[]>(conversationKey, current => current?.map(chat => chat.conversationId === selectedId ? { ...chat, unreadCount: 0 } : chat));
    }
    // Message queries are scoped to account and conversation; an old response cannot replace the active thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.dataUpdatedAt, selectedId, userId, client]);
  useEffect(() => {
    if (!sending && focusAfterSend.current) { focusAfterSend.current = false; input.current?.focus(); }
  }, [sending]);
  useLayoutEffect(() => {
    if (!input.current) return;
    input.current.style.height = '0px';
    input.current.style.height = `${Math.min(input.current.scrollHeight, 96)}px`;
  }, [draft.text, selectedId]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(sendTimeout.current); clearTimeout(refreshTimeout.current); clearTimeout(typingTimeout.current);
    };
  }, []);
  useLayoutEffect(() => {
    const place = () => {
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const margin = selectedId && viewportWidth >= 640 ? 24 : 12;
      const width = Math.min(390, viewportWidth - margin * 2);
      const height = Math.min(560, viewportHeight - margin * 2);
      if (selectedId) {
        setPosition({ top: viewportTop + viewportHeight - height - margin, right: margin, width, height });
        return;
      }
      const visible = (button: HTMLButtonElement) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.bottom > viewportTop && rect.top < viewportTop + viewportHeight;
      };
      const anchor = trigger && visible(trigger) ? trigger : [...document.querySelectorAll<HTMLButtonElement>('[data-header-message-trigger]')].find(visible);
      const rect = anchor?.getBoundingClientRect();
      if (!anchor) { onClose(); return; }
      setPosition({ top: Math.max(viewportTop + margin, Math.min((rect?.bottom || 66) + 14, viewportTop + viewportHeight - height - margin)), right: Math.max(margin, Math.min(viewportWidth - (rect?.right || viewportWidth - margin), viewportWidth - width - margin)), width, height });
    };
    const outside = (event: PointerEvent) => {
      if (!selectedId && event.target instanceof Element && !panel.current?.contains(event.target) && !event.target.closest('[data-header-message-trigger]')) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(true); } };
    const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !panel.current?.contains(event.target)) place(); };
    place(); panel.current?.focus();
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    window.addEventListener('resize', place); window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', place); window.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [trigger, onClose, selectedId]);

  const send = () => {
    if (!selectedId || !seller?.id || !ready || sending || (!draft.text.trim() && !draft.attachments.length)) return;
    const outgoing = { conversationId: selectedId, text: draft.text.trim(), attachments: [...draft.attachments] };
    if (!sendFrame({ messageBody: outgoing.text, attachments: outgoing.attachments, conversationId: selectedId })) { setError('Chat disconnected. Reconnecting…'); return; }
    pending.current = outgoing; setSending(true); setError('');
    sendFrame({ type: 'TYPING', conversationId: selectedId, typing: false });
    sendTimeout.current = setTimeout(() => {
      pending.current = null; setSending(false); setError('Could not confirm delivery. Check the conversation before sending again.');
    }, 15000);
  };
  const merged = new Map<string, ChatMessage>();
  for (const message of [...live, ...(messages.data?.pages.flatMap(page => page.messages) || [])]) {
    if (message.conversationId === selectedId && !merged.has(message.id)) merged.set(message.id, message);
  }
  const timeline = [...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visibleConversations = conversations.data?.filter(chat => chat.seller.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale))) || [];
  const detailHref = selectedId ? `/inbox?conversationId=${encodeURIComponent(selectedId)}` : '/inbox';
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return createPortal(<div id={panelId} ref={panel} role="dialog" aria-label={t('Messages')} tabIndex={-1} style={position} className={`fixed ${selectedId ? 'z-[11000]' : 'z-[200]'} flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_12px_50px_rgba(15,23,42,0.18)] outline-none`}>
    <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
      {selectedId ? <button type="button" onClick={() => selectChat(null)} className={actionClass} aria-label={t('Back to conversations')}><ChevronLeft size={21} /></button> : <span className="mr-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#3489FF]"><MessageCircle size={22} aria-hidden="true" /></span>}
      {selectedId && seller && <ChatAvatar seller={seller} size="h-9 w-9" />}
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{selectedId ? seller?.name || t('Messages') : t('Messages')}</h2><p className="mt-0.5 text-xs text-slate-500">{selectedId ? t(seller?.isOnline ? 'Online' : 'Offline') : t('Chat with your shops')}</p></div>
      <button type="button" onClick={() => onClose(true)} className={actionClass} aria-label={t('Close chat')}><X size={20} aria-hidden="true" /></button>
    </div>
    {!selectedId ? <>
      <label className="mx-4 my-3 flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-3 text-slate-400"><Search size={17} aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} aria-label={t('Search conversations')} placeholder={t('Search conversations')} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400" /></label>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {conversations.isLoading ? <div className="flex h-36 items-center justify-center" role="status"><Loader2 className="animate-spin text-blue-500" size={24} aria-hidden="true" /><span className="sr-only">{t('Loading messages…')}</span></div> : conversations.isError ? <ChatLoadError onRetry={() => void conversations.refetch()} /> : visibleConversations.length ? visibleConversations.map(chat => <button type="button" key={chat.conversationId} onClick={() => selectChat(chat.conversationId)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400">
          <ChatAvatar seller={chat.seller} /><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{chat.seller.name}</span><time className="shrink-0 text-[10px] text-slate-400">{time(chat.lastMessageAt)}</time></span><span className={`mt-1 block truncate text-xs ${chat.unreadCount ? 'font-medium text-slate-800' : 'text-slate-500'}`}>{chat.lastMessage || t('Say something to start a conversation')}</span></span>{chat.unreadCount > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#3489FF] px-1 text-[10px] font-semibold text-white">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>}
        </button>) : <div className="flex h-full min-h-40 flex-col items-center justify-center px-5 text-center"><Store size={32} className="mb-3 text-blue-400" aria-hidden="true" /><p className="text-sm font-medium">{t(search ? 'No conversations match your search.' : 'No conversations yet')}</p>{!search && <p className="mt-2 text-xs leading-5 text-slate-500">{t('Chat with sellers directly from a product page.')}</p>}</div>}
      </div>
    </> : <>
      <div role="log" aria-label={t('Messages')} aria-live="polite" aria-relevant="additions" className="flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-4">
        {timeline.map(message => <div key={message.id} className={`flex items-end gap-2 ${message.senderType === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.senderType !== 'user' && seller && <ChatAvatar seller={seller} size="h-7 w-7" showPresence={false} />}
          <div className="max-w-[85%] min-w-0">
            {message.content && <p className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-5 [overflow-wrap:anywhere] ${message.senderType === 'user' ? 'rounded-br-md bg-[#3489FF] text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'}`}>{message.content}</p>}
            {message.attachments?.map(url => <MessageAttachment key={url} url={url} />)}
            <time className={`mt-1 block text-[10px] text-slate-400 ${message.senderType === 'user' ? 'text-right' : ''}`}>{time(message.createdAt)}</time>
          </div>
        </div>)}
        {(messages.isLoading || conversations.isLoading) && <p role="status" className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500"><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t('Loading messages…')}</p>}
        {(messages.isError || conversations.isError) && <ChatLoadError onRetry={() => { void conversations.refetch(); void messages.refetch(); }} />}
        {!messages.isLoading && !messages.isError && selected && !timeline.length && <p className="py-6 text-center text-xs text-slate-500">{t('Say something to start a conversation')}</p>}
        {!conversations.isLoading && !conversations.isError && !selected && <p role="alert" className="py-6 text-center text-xs text-slate-500">{t('This conversation is unavailable.')}</p>}
        {messages.hasNextPage && <button type="button" disabled={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()} className="mx-auto py-2 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50">{t(messages.isFetchingNextPage ? 'Loading messages…' : 'Load older messages')}</button>}
      </div>
      <div className="shrink-0 border-t border-slate-100 bg-white">
        <div className="px-4 text-xs text-slate-500">{!ready && <p role="status" className="pt-2">{t('Connecting…')}</p>}{typing && <p className="pt-2">{t('Typing…')}</p>}{error && <p role="alert" className="pt-2 text-red-600">{t(error)}</p>}</div>
        <fieldset disabled={sending || !selected || !seller?.id} className="min-w-0">
          {!!draft.attachments.length && <div className="max-h-28 overflow-y-auto px-3">{draft.attachments.map(url => <AttachmentPreview key={url} url={url} onRemove={() => updateDraft({ ...draftRef.current, attachments: draftRef.current.attachments.filter(item => item !== url) })} />)}</div>}
          <form onSubmit={event => { event.preventDefault(); send(); }} className="flex items-end gap-1.5 p-3">
            <div className="pb-0.5">{selected && <ChatAttachments key={selected.conversationId} api={axios} conversationId={selected.conversationId} onUploaded={url => {
              const id = selected.conversationId;
              const previous = drafts[id] || emptyDraft();
              const next = { ...previous, attachments: [...previous.attachments, url].slice(0, 5) };
              drafts[id] = next;
              if (mounted.current && selectedRef.current === id) updateDraft(next);
            }} />}</div>
            <textarea ref={input} rows={1} maxLength={5000} aria-label={t('Type a message…')} placeholder={t('Type a message…')} value={draft.text} onChange={event => {
              updateDraft({ ...draftRef.current, text: event.target.value });
              if (ready && selectedId && (!event.target.value || Date.now() - typingSentAt.current > 1000)) { sendFrame({ type: 'TYPING', conversationId: selectedId, typing: !!event.target.value }); typingSentAt.current = Date.now(); }
            }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} className="max-h-24 min-h-11 min-w-0 flex-1 resize-none rounded-2xl bg-slate-100 px-3 py-3 text-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-300 disabled:opacity-60" />
            <button type="submit" disabled={sending || !ready || (!draft.text.trim() && !draft.attachments.length)} aria-label={t('Send message')} title={t('Send message')} className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#3489FF] text-white transition hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">{sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}</button>
          </form>
        </fieldset>
      </div>
    </>}
    <Link href={detailHref} onClick={() => onClose()} className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 border-t border-slate-100 bg-white px-4 py-3 text-xs font-semibold text-[#3489FF] transition hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">{t('View details')}<ArrowUpRight size={15} aria-hidden="true" /></Link>
  </div>, document.body);
}

function ChatLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useStorefrontText();
  return <div role="alert" className="px-4 py-6 text-center"><p className="text-xs leading-5 text-slate-500">{t('Unable to load messages. Please try again.')}</p><button type="button" onClick={onRetry} className="mx-auto mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"><RefreshCw size={14} aria-hidden="true" />{t('Retry')}</button></div>;
}
