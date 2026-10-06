import db, { resetDb } from './mocks/prisma';
import { kafka } from '@packages/utils/kafka';
import { startConsumer } from '../../apps/chatting-service/src/chat-message.consumer';
import { consumeKafkaMessages } from '../../apps/logger-service/src/logger-consumer';
import { sendPush } from '../../apps/chatting-service/src/chat-extras';
jest.mock('@packages/utils/kafka', () => {
  const consumer = { connect: jest.fn(), subscribe: jest.fn(), run: jest.fn() };
  return { kafka: { consumer: () => consumer } };
});
jest.mock('../../apps/chatting-service/src/chat-extras', () => ({ sendPush: jest.fn() }));
const consumer = kafka.consumer({ groupId: 'test' });
beforeEach(resetDb);
const conversationId = '111111111111111111111111';
const senderId = '222222222222222222222222';
const receiverId = '333333333333333333333333';
const event = { id: '444444444444444444444444', conversationId, senderId, senderType: 'user', content: 'Hello', attachments: [], createdAt: new Date().toISOString() };
function envelope(data: unknown) { return { topic: 'chat.new_message', partition: 0, message: { offset: '1', value: Buffer.from(JSON.stringify(data)) } }; }
async function chatHandler() { await startConsumer(); return (consumer.run as jest.Mock).mock.calls.at(-1)[0].eachMessage; }
test('chat consumer persists message, increments unread and notifies the recipient', async () => {
  db.conversationGroup.findFirst.mockResolvedValue({ id: conversationId, participantIds: [senderId, receiverId] });
  db.participant.findFirst.mockResolvedValue({ lastSeenAt: null });
  await (await chatHandler())(envelope(event));
  expect(db.message.create.mock.calls[0][0].data).toMatchObject({ id: event.id, senderId, content: 'Hello' });
  expect(db.participant.updateMany.mock.calls[0][0]).toEqual({ where: { conversationId, sellerId: receiverId }, data: { unreadCount: { increment: 1 } } });
  expect(db.notifications.create.mock.calls[0][0].data.sellerId).toBe(receiverId);
  expect(sendPush).toHaveBeenCalledWith(receiverId, 'seller', conversationId);
});
test('replayed chat event never duplicates message, unread count or notification', async () => {
  db.message.findUnique.mockResolvedValue({ id: event.id });
  await (await chatHandler())(envelope(event));
  expect(db.message.create).not.toHaveBeenCalled(); expect(db.participant.updateMany).not.toHaveBeenCalled(); expect(sendPush).not.toHaveBeenCalled();
});
test('message already seen before consumer persistence stays read', async () => {
  db.conversationGroup.findFirst.mockResolvedValue({ id: conversationId, participantIds: [senderId, receiverId] });
  db.participant.findFirst.mockResolvedValue({ lastSeenAt: new Date(Date.now() + 1000) });
  await (await chatHandler())(envelope(event)); expect(db.participant.updateMany).not.toHaveBeenCalled();
});
test('logger persists action and event identity for idempotent replay', async () => {
  await consumeKafkaMessages(); const handle = (consumer.run as jest.Mock).mock.calls.at(-1)[0].eachMessage;
  const log = { source: 'product-service', action: 'click', metadata: { behaviorAction: 'productView', userId: senderId }, timestamp: '2026-10-04T01:00:00Z' };
  await handle({ ...envelope(log), topic: 'log-events' });
  expect(db.behaviorLog.upsert.mock.calls[0][0]).toMatchObject({ where: { eventId: 'log-events:0:1' }, update: {}, create: { action: 'productView', userId: senderId, source: 'product-service' } });
});
