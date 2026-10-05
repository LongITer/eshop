import { kafka } from '@packages/utils/kafka';
import { sendPush } from './chat-extras';
import crypto from 'crypto';
import { transaction } from '@packages/utils/transaction';

export async function startConsumer() {
  const consumer = kafka.consumer({ groupId: 'chat-message-db-writer' });
  await consumer.connect(); await consumer.subscribe({ topic: 'chat.new_message', fromBeginning: false });
  await consumer.run({ eachMessage: async ({ topic, partition, message }) => {
    if (!message.value) return;
    let event: any;
    try { event = JSON.parse(message.value.toString()); } catch { console.error('Invalid chat event'); return; }
    const id = event.id || crypto.createHash('sha256').update(`${topic}:${partition}:${message.offset}`).digest('hex').slice(0, 24);
    const receiverType = event.senderType === 'user' ? 'seller' : 'user';
    const receiverId = await transaction(async tx => {
      if (await tx.message.findUnique({ where: { id } })) return null;
      const group = await tx.conversationGroup.findFirst({ where: { id: event.conversationId, participantIds: { has: event.senderId } } });
      if (!group) return null;
      const receiverId = group.participantIds.find(value => value !== event.senderId);
      await tx.message.create({ data: { id, conversationId: group.id, senderId: event.senderId, senderType: event.senderType, content: event.content || '', attachments: event.attachments || [], createdAt: new Date(event.createdAt) } });
      await tx.conversationGroup.update({ where: { id: group.id }, data: { updatedAt: new Date() } });
      const participantWhere = { conversationId: group.id, ...(receiverType === 'user' ? { userId: receiverId } : { sellerId: receiverId }) };
      const participant = await tx.participant.findFirst({ where: participantWhere });
      if (!participant?.lastSeenAt || participant.lastSeenAt < new Date(event.createdAt)) await tx.participant.updateMany({ where: participantWhere, data: { unreadCount: { increment: 1 } } });
      if (receiverId) await tx.notifications.create({ data: { ...(receiverType === 'user' ? { userId: receiverId } : { sellerId: receiverId }), type: 'System', title: 'New message', message: String(event.content || 'Attachment').slice(0, 120), redirectUrl: `${receiverType === 'seller' ? '/dashboard' : ''}/inbox?conversationId=${group.id}`, metadata: { eventType: 'NewMessage', conversationId: group.id } } });
      return receiverId;
    });
    if (receiverId) await sendPush(receiverId, receiverType, event.conversationId);
  } });
}

