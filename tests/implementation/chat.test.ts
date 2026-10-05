import { createServer, Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import request from 'supertest';
import db, { resetDb } from './mocks/prisma';
import redis from '@packages/libs/redis';
import { imageKit } from '@packages/libs/imagekit';
import { appFor, userId, otherId, shopId } from './helpers';
import * as chat from '../../apps/chatting-service/src/chat-extras';
import { createWebSockerServer } from '../../apps/chatting-service/src/websocket';

jest.mock('@packages/utils/kafka', () => {
  const producer = { connect: jest.fn(), disconnect: jest.fn(async () => {}), send: jest.fn() };
  return { kafka: { producer: () => producer } };
});
const producer = require('@packages/utils/kafka').kafka.producer();
let server: Server; let wss: WebSocketServer; let port: number;
const clients: WebSocket[] = [];
function nextFrame(ws: WebSocket): Promise<any> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Frame timed out')), 2000); ws.once('message', data => { clearTimeout(timer); resolve(JSON.parse(data.toString())); }); }); }
async function connect(id: string, type = 'user') {
  (redis.getdel as jest.Mock).mockResolvedValueOnce(JSON.stringify({ id, type }));
  const ws = new WebSocket(`ws://127.0.0.1:${port}?ticket=${'a'.repeat(64)}`); clients.push(ws);
  const ready = await nextFrame(ws); expect(ready.type).toBe('READY'); return ws;
}
beforeAll(async () => {
  server = createServer(); wss = await createWebSockerServer(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); port = (server.address() as any).port;
});
beforeEach(() => { resetDb(); jest.clearAllMocks(); db.conversationGroup.findMany.mockResolvedValue([]); (redis.del as jest.Mock).mockResolvedValue(1); });
afterEach(async () => { await Promise.all(clients.splice(0).map(ws => new Promise<void>(resolve => { if (ws.readyState === WebSocket.CLOSED) return resolve(); ws.once('close', () => resolve()); ws.close(); }))); });
afterAll(async () => { await new Promise<void>(resolve => wss.close(() => resolve())); await new Promise<void>(resolve => server.close(() => resolve())); });

test('socket rejects a connection without a single-use ticket', async () => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`); clients.push(ws);
  const code = await new Promise<number>(resolve => ws.once('close', resolve)); expect(code).toBe(1008);
});
test('expired or reused socket ticket is rejected', async () => {
  (redis.getdel as jest.Mock).mockResolvedValueOnce(null);
  const ws = new WebSocket(`ws://127.0.0.1:${port}?ticket=${'b'.repeat(64)}`); clients.push(ws);
  expect(await new Promise<number>(resolve => ws.once('close', resolve))).toBe(1008);
});
test('conversation membership is required before publishing messages', async () => {
  const ws = await connect(userId); db.conversationGroup.findFirst.mockResolvedValue(null);
  const frame = nextFrame(ws); ws.send(JSON.stringify({ conversationId: shopId, messageBody: 'Unauthorized' }));
  expect((await frame).type).toBe('ERROR'); expect(producer.send).not.toHaveBeenCalled();
});
test('message identity comes from ticket, never from spoofed payload', async () => {
  const ws = await connect(userId); db.conversationGroup.findFirst.mockResolvedValue({ id: shopId, participantIds: [userId, otherId] });
  const frame = nextFrame(ws); ws.send(JSON.stringify({ conversationId: shopId, senderId: otherId, senderType: 'seller', messageBody: 'Hello' }));
  const event = await frame; expect(event.payload.senderId).toBe(userId); expect(event.payload.senderType).toBe('user');
  expect(JSON.parse(producer.send.mock.calls[0][0].messages[0].value).content).toBe('Hello');
});
test('typing reaches the other participant and arbitrary attachments fail', async () => {
  const user = await connect(userId); const seller = await connect(otherId, 'seller');
  db.conversationGroup.findFirst.mockResolvedValue({ id: shopId, participantIds: [userId, otherId] });
  const typing = nextFrame(seller); user.send(JSON.stringify({ type: 'TYPING', conversationId: shopId, typing: true }));
  expect(await typing).toEqual({ type: 'TYPING', payload: { conversationId: shopId, typing: true } });
  db.chatAttachment.count.mockResolvedValue(0);
  const rejected = nextFrame(user); user.send(JSON.stringify({ conversationId: shopId, attachments: ['https://example.test/foreign.pdf'] }));
  expect((await rejected).message).toBe('Attachment access denied'); expect(producer.send).not.toHaveBeenCalled();
});
test('attachment upload requires membership and rejects active content', async () => {
  db.conversationGroup.findFirst.mockResolvedValue(null);
  expect((await request(appFor('post', '/', chat.attachment)).post('/').send({ conversationId: shopId, file: 'data:application/pdf;base64,dGVzdA==' })).status).toBe(403);
  db.conversationGroup.findFirst.mockResolvedValue({ id: shopId });
  expect((await request(appFor('post', '/', chat.attachment)).post('/').send({ conversationId: shopId, file: 'data:text/html;base64,dGVzdA==' })).status).toBe(400);
  expect(imageKit.upload).not.toHaveBeenCalled();
});
test('push subscriptions reject internal or untrusted endpoints', async () => {
  for (const endpoint of ['http://127.0.0.1:8080', 'https://evil.test', 'https://fcm.googleapis.com.evil.test']) {
    expect((await request(appFor('post', '/', chat.subscribePush)).post('/').send({ endpoint, keys: { auth: 'x', p256dh: 'y' } })).status).toBe(400);
  }
  expect(db.pushSubscription.upsert).not.toHaveBeenCalled();
});
