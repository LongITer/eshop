'use client';
import { useEffect, useRef, useState, MutableRefObject, ReactNode } from 'react';
import type { AxiosInstance } from 'axios';
import { Bell, BellRing, ExternalLink, FileText, ImagePlus, Loader2, Paperclip, Upload, X } from 'lucide-react';

const chatActionClass = 'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-blue-500/10 hover:text-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50';

export function MessageAttachment({ url }: { url: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  let name = 'Attachment';
  let pathname = '';
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    pathname = parsed.pathname;
    name = decodeURIComponent(pathname.split('/').pop() || name)
      .replace(/^chat-[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}-/i, '');
  } catch { return null; }
  const isImage = /\.(png|jpe?g|webp)$/i.test(pathname);
  const type = /\.pdf$/i.test(pathname) ? 'PDF document' : /\.txt$/i.test(pathname) ? 'Text document' : 'File';
  return <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${name}`} aria-label={`Open ${name}`} className="my-2 block max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
    {isImage && failedImage !== url ? <img src={url} alt={name} loading="lazy" onError={() => setFailedImage(url)} className="max-h-72 w-full max-w-80 object-contain bg-slate-50" /> : <div className="flex items-center gap-3 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText size={22} aria-hidden="true" /></span>
      <div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{name}</p><p className="mt-1 text-xs text-slate-500">{isImage ? 'Image unavailable · Open original' : type}</p></div>
      <ExternalLink size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
    </div>}
  </a>;
}

export function AttachmentPreview({ url, onRemove }: { url: string; onRemove: () => void }) {
  return <div className="inline-flex max-w-64 items-start gap-1 p-1 text-blue-500">
    <div className="min-w-0 flex-1"><MessageAttachment url={url} /></div>
    <button type="button" onClick={onRemove} title="Remove attachment" aria-label="Remove attachment" className={chatActionClass}><X size={16} aria-hidden="true" /></button>
  </div>;
}
export function UnreadMessages({ api, href, renderLink }: { api: AxiosInstance; href: string; renderLink?: (count: number) => ReactNode }) {
  const [count, setCount] = useState(0);
  useEffect(() => { let active = true; const load = () => api.get('/chatting/api/unread-count').then(res => { if (active) setCount(res.data.unreadCount); }).catch(() => {}); load(); const timer = setInterval(load, 10000); return () => { active = false; clearInterval(timer); }; }, [api]);
  if (renderLink) return <>{renderLink(count)}</>;
  return <a href={href} className="block min-h-11 p-2">Messages{count > 0 && <span className="ml-2 bg-blue-600 text-white rounded-full px-2">{count}</span>}</a>;
}

export function useChatConnection({ actorId, api, socketRef, onEvent }: { actorId?: string; api: AxiosInstance; socketRef: MutableRefObject<WebSocket | null>; onEvent: (event: any) => void }) {
  const callback = useRef(onEvent); callback.current = onEvent;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!actorId) return;
    let stopped = false; let ws: WebSocket | null = null; let timer: ReturnType<typeof setTimeout>;
    const connect = async () => {
      try {
        const { data } = await api.post('/chatting/api/socket-ticket'); if (stopped) return;
        const base = process.env.NEXT_PUBLIC_CHAT_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:6006`;
        ws = new WebSocket(`${base}?ticket=${encodeURIComponent(data.ticket)}`); socketRef.current = ws;
        ws.onmessage = event => { try { const parsed = JSON.parse(event.data); if (parsed.type === 'READY') setReady(true); callback.current(parsed); } catch { /* Ignore malformed frames. */ } };
        ws.onclose = () => { setReady(false); if (!stopped) timer = setTimeout(connect, 3000); };
        ws.onerror = () => ws?.close();
      } catch { setReady(false); if (!stopped) timer = setTimeout(connect, 5000); }
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); ws?.close(); socketRef.current = null; };
  }, [actorId, api, socketRef]);
  return ready;
}
export function ChatAttachments({ api, conversationId, onUploaded }: { api: AxiosInstance; conversationId: string; onUploaded: (url: string) => void }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<'image' | 'file' | null>(null);
  const busy = uploading !== null;
  const [error, setError] = useState('');
  const [pending, setPending] = useState<{ kind: 'image' | 'file'; file: File } | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!pending) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(pending.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  const selectFile = (kind: 'image' | 'file', file?: File) => {
    if (!file || busy) return;
    setError('');
    try {
      const allowedTypes = kind === 'image' ? ['image/png', 'image/jpeg', 'image/webp'] : ['application/pdf', 'text/plain'];
      if (!allowedTypes.includes(file.type)) throw new Error(kind === 'image' ? 'Choose a PNG, JPEG or WebP image' : 'Choose a PDF or text file');
      if (file.size > 5 * 1024 * 1024) throw new Error('File exceeds 5 MB');
      setPreviewUrl('');
      setPending({ kind, file });
    } catch (e: any) { setError(e.message); }
  };

  const upload = async () => {
    if (!pending || busy) return;
    const { kind, file } = pending;
    setUploading(kind); setError('');
    try {
      const encoded = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const { data } = await api.post('/chatting/api/attachments', { conversationId, file: encoded, name: file.name }); onUploaded(data.url);
      setPending(null);
    } catch (e: any) { setError(e.response?.data?.message || e.message || 'Upload failed'); } finally { setUploading(null); }
  };
  const imageLabel = uploading === 'image' ? 'Uploading image…' : 'Attach image (PNG, JPEG, WebP — up to 5 MB)';
  const fileLabel = uploading === 'file' ? 'Uploading file…' : 'Attach file (PDF, text — up to 5 MB)';
  return <div className="relative flex items-center gap-1 text-sm">
    <button type="button" className={chatActionClass} disabled={busy} onClick={() => imageInputRef.current?.click()} title={imageLabel} aria-label={imageLabel} aria-busy={uploading === 'image'}>
      {uploading === 'image' ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
    </button>
    <button type="button" className={chatActionClass} disabled={busy} onClick={() => fileInputRef.current?.click()} title={fileLabel} aria-label={fileLabel} aria-busy={uploading === 'file'}>
      {uploading === 'file' ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Paperclip size={20} aria-hidden="true" />}
    </button>
    <input ref={imageInputRef} className="hidden" aria-label="Choose an image" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { selectFile('image', e.target.files?.[0]); e.target.value = ''; }} />
    <input ref={fileInputRef} className="hidden" aria-label="Choose a file" type="file" accept="application/pdf,text/plain" disabled={busy} onChange={e => { selectFile('file', e.target.files?.[0]); e.target.value = ''; }} />
    {pending && <section aria-label="Attachment preview" className="absolute bottom-full left-0 z-20 mb-3 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="font-medium">{pending.kind === 'image' ? 'Image preview' : 'File preview'}</span>
        <button type="button" disabled={busy} onClick={() => { setPending(null); setError(''); }} className={chatActionClass} title="Cancel attachment" aria-label="Cancel attachment"><X size={18} aria-hidden="true" /></button>
      </div>
      <div className="space-y-3 p-4">
        {pending.kind === 'image' && previewUrl ? <img src={previewUrl} alt={pending.file.name} className="max-h-48 w-full rounded-lg bg-slate-50 object-contain" /> : <div className="flex h-24 items-center justify-center rounded-lg bg-blue-50 text-blue-500"><FileText size={40} aria-hidden="true" /></div>}
        <div><p className="break-all font-medium">{pending.file.name}</p><p className="mt-1 text-xs text-slate-500">{pending.file.size >= 1024 * 1024 ? `${(pending.file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(pending.file.size / 1024)} KB`} · {pending.file.type}</p></div>
        {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-blue-600 hover:underline">Open preview</a>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="button" disabled={busy} onClick={upload} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}{busy ? 'Uploading…' : 'Upload attachment'}
        </button>
      </div>
    </section>}
    {error && !pending && <p role="alert" className="absolute bottom-full left-0 z-10 mb-2 w-60 rounded-lg border border-red-200 bg-white p-3 text-red-600 shadow-lg">{error}</p>}
  </div>;
}
export function PushOptIn({ api }: { api: AxiosInstance }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const enable = async () => {
    setBusy(true);
    setStatus('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Push is not supported in this browser');
      const { data } = await api.get('/chatting/api/push-key'); if (!data.publicKey) throw new Error('Push is not configured on the server');
      const permission = await Notification.requestPermission(); if (permission !== 'granted') throw new Error('Notifications are disabled in your browser');
      await navigator.serviceWorker.register('/chat-sw.js'); const registration = await navigator.serviceWorker.ready;
      const normalized = data.publicKey.replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
      const applicationServerKey = Uint8Array.from(raw, (c: string) => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      await api.post('/chatting/api/push-subscription', subscription.toJSON()); setStatus('Notifications enabled'); setEnabled(true);
    } catch (e: any) { setStatus(e.message || 'Could not enable notifications'); }
    finally { setBusy(false); }
  };
  const label = enabled ? 'Message notifications enabled' : busy ? 'Enabling notifications…' : 'Enable message notifications';
  return <div className="relative text-sm">
    <button type="button" className={chatActionClass} disabled={busy || enabled} title={label} aria-label={label} onClick={enable}>
      {busy ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : enabled ? <BellRing size={20} className="text-blue-500" aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
    </button>
    {status && <div role="status" className="absolute bottom-full left-0 z-10 mb-2 flex w-64 items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-lg"><p className="flex-1">{status}</p><button type="button" onClick={() => setStatus('')} title="Dismiss" aria-label="Dismiss notification status" className="rounded p-1 hover:bg-slate-100"><X size={16} aria-hidden="true" /></button></div>}
  </div>;
}
