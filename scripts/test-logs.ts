/**
 * Test script: gửi sample logs lên Kafka → logger-service → Admin UI
 *
 * Cách chạy:
 *   npx ts-node -e "require('dotenv').config()" scripts/test-logs.ts
 * Hoặc đơn giản hơn:
 *   npx ts-node --require dotenv/config scripts/test-logs.ts
 */

import { Kafka } from "kafkajs";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env từ root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const kafka = new Kafka({
  clientId: "test-log-producer",
  brokers: ["pkc-ldvr1.asia-southeast1.gcp.confluent.cloud:9092"],
  ssl: true,
  sasl: {
    mechanism: "plain",
    username: process.env.KAFKA_API_KEY!,
    password: process.env.KAFKA_API_SECRET!,
  },
  retry: { retries: 5 },
});

const LOG_TOPIC = "log-events";

const sampleLogs = [
  {
    type: "info",
    source: "auth-service",
    message: "User login attempt received",
    metadata: { ip: "192.168.1.1", userId: "user_abc123" },
  },
  {
    type: "success",
    source: "order-service",
    message: "Order #ORD-00421 created successfully",
    metadata: { orderId: "ORD-00421", amount: 38.0, currency: "USD" },
  },
  {
    type: "warn",
    source: "product-service",
    message: 'Product "Pink Pastel Bouquet" stock is low (3 remaining)',
    metadata: { productId: "prod_xyz", stock: 3 },
  },
  {
    type: "error",
    source: "payment-service",
    message: "Stripe webhook verification failed",
    metadata: { code: "STRIPE_INVALID_SIGNATURE", endpoint: "/api/webhook" },
  },
  {
    type: "success",
    source: "auth-service",
    message: "User longiter04@gmail.com logged in successfully",
    metadata: { userId: "user_abc123", role: "admin" },
  },
  {
    type: "info",
    source: "api-gateway",
    message: "GET /product/api/get-all-products — 200 OK (42ms)",
    metadata: { method: "GET", status: 200, duration: 42 },
  },
  {
    type: "error",
    source: "chatting-service",
    message: "WebSocket connection dropped unexpectedly",
    metadata: { clientId: "ws_client_789", reason: "ECONNRESET" },
  },
  {
    type: "warn",
    source: "api-gateway",
    message: "Rate limit approaching for IP 203.0.113.42",
    metadata: { ip: "203.0.113.42", requests: 95, limit: 100 },
  },
];

async function main() {
  // 1. Tạo topic nếu chưa tồn tại
  const admin = kafka.admin();
  console.log("🔌 Connecting admin client...");
  await admin.connect();

  const existingTopics = await admin.listTopics();
  if (!existingTopics.includes(LOG_TOPIC)) {
    console.log(`📋 Topic "${LOG_TOPIC}" not found — creating...`);
    await admin.createTopics({
      topics: [{ topic: LOG_TOPIC, numPartitions: 1, replicationFactor: 3 }],
    });
    console.log(`✅ Topic "${LOG_TOPIC}" created!`);
  } else {
    console.log(`✅ Topic "${LOG_TOPIC}" already exists.`);
  }
  await admin.disconnect();

  // 2. Produce logs
  const producer = kafka.producer({ allowAutoTopicCreation: false });

  console.log("\n🔌 Connecting producer...");
  await producer.connect();
  console.log("✅ Connected!\n");

  for (const log of sampleLogs) {
    const payload = {
      ...log,
      timestamp: new Date().toISOString(),
    };

    await producer.send({
      topic: LOG_TOPIC,
      messages: [{ value: JSON.stringify(payload) }],
    });

    const typeIcon: Record<string, string> = {
      info: "🔵",
      success: "🟢",
      warn: "🟡",
      error: "🔴",
    };
    console.log(
      `${typeIcon[log.type] || "⚪"} Sent [${log.type.toUpperCase()}] from ${log.source}: ${log.message}`,
    );

    // Delay 500ms giữa mỗi log để thấy rõ hơn trên UI
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n✅ All logs sent!");
  await producer.disconnect();
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
