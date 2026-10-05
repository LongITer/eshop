import { kafka } from "@packages/utils/kafka";
import WebSocket from "ws";
import { clients, recentLogs } from "./logger-state";
import prisma from '@packages/libs/prisma';

const consumer = kafka.consumer({ groupId: "log-events-group" });
const logQueue: string[] = [];

// WebSocket processing function for logs
const processLog = () => {
  if (logQueue.length === 0) return;
  console.log(`Processing ${logQueue.length} logs in batch`);

  const logs = [...logQueue];
  logQueue.length = 0;

  recentLogs.push(...logs);
  if (recentLogs.length > 1000) {
    recentLogs.splice(0, recentLogs.length - 1000);
  }

  const openClients = [...clients].filter(
    (client) => client.readyState === WebSocket.OPEN,
  );
  console.log(
    `Broadcasting ${logs.length} logs to ${openClients.length} connected client(s)`,
  );

  openClients.forEach((client) => {
    logs.forEach((log) => {
      client.send(log);
    });
  });
};

setInterval(processLog, 3000).unref();

// Consumer log messages from Kafka
export const consumeKafkaMessages = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "log-events", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) return;
      const log = message.value.toString();
      let event;
      try { event = JSON.parse(log); } catch { console.error('Ignoring malformed log event'); return; }
      const eventId = `${topic}:${partition}:${message.offset}`;
      await prisma.behaviorLog.upsert({ where: { eventId }, update: {}, create: { eventId, action: String(event.metadata?.behaviorAction ?? event.action ?? 'unknown'), userId: event.metadata?.userId ? String(event.metadata.userId) : null, source: String(event.source ?? 'unknown'), type: String(event.type ?? 'info'), message: String(event.message ?? ''), metadata: event.metadata ?? {}, createdAt: Number.isFinite(Date.parse(event.timestamp)) ? new Date(event.timestamp) : new Date() } });
      logQueue.push(log);
    },
  });
};
