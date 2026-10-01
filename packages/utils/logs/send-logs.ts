import { kafka } from "@packages/utils/kafka";

export type LogLevel = "info" | "success" | "warn" | "error";

export type LogEvent = {
  type: LogLevel;
  message: string;
  source: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

const LOG_TOPIC = "log-events";

export async function sendLog(event: LogEvent) {
  const producer = kafka.producer();
  let connected = false;

  try {
    await producer.connect();
    connected = true;

    const payload: LogEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    const result = await producer.send({
      topic: LOG_TOPIC,
      messages: [{ value: JSON.stringify(payload) }],
    });

    console.info(`[logging] sent ${event.type} event from ${event.source}`);
    return result;
  } catch (error) {
    console.error("[logging] failed to send event", error);
    throw error;
  } finally {
    if (connected) {
      await producer.disconnect();
    }
  }
}
