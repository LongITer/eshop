import redis from '@packages/libs/redis';
import prisma from '@packages/libs/prisma';
import { kafka } from '@packages/utils/kafka';
import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import crypto from 'crypto';
import { clearUnseenCount } from '@packages/libs/redis/message.redis';

const producer = kafka.producer();
const sockets = new Map<string, Set<WebSocket>>();
function emit(key: string, event: unknown) { for (const socket of sockets.get(key) ?? []) if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); }
export async function createWebSockerServer(server: HttpServer) {
  const wss = new WebSocketServer({ server, maxPayload: 64000 });
  await producer.connect();
  wss.on('connection', async (ws, req) => {
    try {
      const ticket = new URL(req.url || '/', 'http://localhost').searchParams.get('ticket');
      if (!ticket || !/^[a-f\d]{64}$/.test(ticket)) { ws.close(1008, 'Authentication required'); return; }
      const stored = await redis.getdel(`chat-ticket:${ticket}`);
      if (!stored) { ws.close(1008, 'Ticket expired'); return; }
      const identity: { id: string; type: "user" | "seller" } = JSON.parse(stored);
      const key = `${identity.type}_${identity.id}`;
      const peers = sockets.get(key) ?? new Set<WebSocket>(); peers.add(ws); sockets.set(key, peers);
      const presenceKey = `online:${identity.type}:${identity.id}`;
      const presence = async (online: boolean) => {
        const groups = await prisma.conversationGroup.findMany({ where: { participantIds: { has: identity.id } } });
        for (const group of groups) for (const id of group.participantIds.filter(id => id !== identity.id)) emit(`${identity.type === 'user' ? 'seller' : 'user'}_${id}`, { type: 'PRESENCE', payload: { conversationId: group.id, actorId: identity.id, online } });
      };
      await redis.set(presenceKey, '1', 'EX', 90); await presence(true);
      ws.send(JSON.stringify({ type: 'READY' }));
      let alive = true;
      ws.on('pong', () => { alive = true; });
      const heartbeat = setInterval(() => { if (!alive) { ws.terminate(); return; } alive = false; ws.ping(); redis.expire(presenceKey, 90).catch(console.error); }, 30000);
      let windowStart = Date.now(); let count = 0;
      ws.on('message', async raw => {
        try {
          if (Date.now() - windowStart > 10000) { windowStart = Date.now(); count = 0; }
          if (++count > 60) throw new Error('Too many messages');
          const text = raw.toString(); if (!text.startsWith('{')) return;
          const data = JSON.parse(text);
          if (!/^[a-f\d]{24}$/i.test(data.conversationId ?? '')) throw new Error('Invalid conversation');
          const group = await prisma.conversationGroup.findFirst({ where: { id: data.conversationId, participantIds: { has: identity.id } } });
          if (!group) throw new Error('Conversation access denied');
          const receiverId = group.participantIds.find(id => id !== identity.id);
          const receiverKey = `${identity.type === 'user' ? 'seller' : 'user'}_${receiverId}`;
          if (data.type === 'MARK_AS_SEEN') {
            await clearUnseenCount(identity.type, group.id);
            await prisma.participant.updateMany({ where: { conversationId: group.id, ...(identity.type === 'user' ? { userId: identity.id } : { sellerId: identity.id }) }, data: { lastSeenAt: new Date(), unreadCount: 0 } }); return;
          }
          if (data.type === 'TYPING') { emit(receiverKey, { type: 'TYPING', payload: { conversationId: group.id, typing: !!data.typing } }); return; }
          const content = typeof data.messageBody === 'string' ? data.messageBody.trim() : '';
          const attachments = data.attachments ?? [];
          if (content.length > 5000 || !Array.isArray(attachments) || attachments.length > 5 || (!content && !attachments.length)) throw new Error('Invalid message');
          if (attachments.length) {
            if (attachments.some((url: unknown) => typeof url !== 'string')) throw new Error('Invalid attachment');
            const valid = await prisma.chatAttachment.count({ where: { conversationId: group.id, actorId: identity.id, url: { in: attachments } } });
            if (valid !== new Set(attachments).size) throw new Error('Attachment access denied');
          }
          const payload = { id: crypto.randomBytes(12).toString('hex'), conversationId: group.id, senderId: identity.id, senderType: identity.type, content, attachments, createdAt: new Date().toISOString() };
          await producer.send({ topic: 'chat.new_message', messages: [{ key: group.id, value: JSON.stringify(payload) }] });
          emit(key, { type: 'NEW_MESSAGE', payload }); emit(receiverKey, { type: 'NEW_MESSAGE', payload });
        } catch (error: any) { ws.send(JSON.stringify({ type: 'ERROR', message: error.message || 'Message rejected' })); }
      });
      ws.on('close', () => { clearInterval(heartbeat); peers.delete(ws); if (!peers.size) { sockets.delete(key); redis.del(presenceKey).then(() => presence(false)).catch(console.error); } });
    } catch { ws.close(1011, 'Chat unavailable'); }
  });
  wss.on('close', () => { producer.disconnect().catch(console.error); });
  return wss;
}

