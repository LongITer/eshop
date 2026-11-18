"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// apps/logger-service/src/main.ts
var import_express = __toESM(require("express"));
var import_ws2 = __toESM(require("ws"));

// packages/utils/kafka/index.ts
var import_kafkajs = require("kafkajs");
var kafka = new import_kafkajs.Kafka({
  clientId: "kafka-service",
  brokers: (process.env.KAFKA_BROKERS || "pkc-ldvr1.asia-southeast1.gcp.confluent.cloud:9092").split(","),
  ssl: process.env.KAFKA_SSL !== "false",
  sasl: process.env.KAFKA_API_KEY ? {
    mechanism: "plain",
    username: process.env.KAFKA_API_KEY,
    password: process.env.KAFKA_API_SECRET
  } : void 0
});

// apps/logger-service/src/logger-consumer.ts
var import_ws = __toESM(require("ws"));

// apps/logger-service/src/logger-state.ts
var clients = /* @__PURE__ */ new Set();
var recentLogs = [];

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

// apps/logger-service/src/logger-consumer.ts
var consumer = kafka.consumer({ groupId: "log-events-group" });
var logQueue = [];
var processLog = () => {
  if (logQueue.length === 0)
    return;
  console.log(`Processing ${logQueue.length} logs in batch`);
  const logs = [...logQueue];
  logQueue.length = 0;
  recentLogs.push(...logs);
  if (recentLogs.length > 1e3) {
    recentLogs.splice(0, recentLogs.length - 1e3);
  }
  const openClients = [...clients].filter(
    (client) => client.readyState === import_ws.default.OPEN
  );
  console.log(
    `Broadcasting ${logs.length} logs to ${openClients.length} connected client(s)`
  );
  openClients.forEach((client) => {
    logs.forEach((log) => {
      client.send(log);
    });
  });
};
setInterval(processLog, 3e3).unref();
var consumeKafkaMessages = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "log-events", fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value)
        return;
      const log = message.value.toString();
      let event;
      try {
        event = JSON.parse(log);
      } catch {
        console.error("Ignoring malformed log event");
        return;
      }
      const eventId = `${topic}:${partition}:${message.offset}`;
      await prisma_default.behaviorLog.upsert({ where: { eventId }, update: {}, create: { eventId, action: String(event.metadata?.behaviorAction ?? event.action ?? "unknown"), userId: event.metadata?.userId ? String(event.metadata.userId) : null, source: String(event.source ?? "unknown"), type: String(event.type ?? "info"), message: String(event.message ?? ""), metadata: event.metadata ?? {}, createdAt: Number.isFinite(Date.parse(event.timestamp)) ? new Date(event.timestamp) : /* @__PURE__ */ new Date() } });
      logQueue.push(log);
    }
  });
};

// apps/logger-service/src/main.ts
var import_http = __toESM(require("http"));
var import_config = require("dotenv/config");

// packages/utils/internal-logger-access.ts
var import_node_crypto = require("node:crypto");
function mayReadInternalLogs(header, configuredToken = process.env.LOGGER_INTERNAL_TOKEN) {
  if (!configuredToken || configuredToken.length < 32 || typeof header !== "string" || !header.startsWith("Bearer "))
    return false;
  const supplied = Buffer.from(header.slice(7)), expected = Buffer.from(configuredToken);
  return supplied.length === expected.length && (0, import_node_crypto.timingSafeEqual)(Uint8Array.from(supplied), Uint8Array.from(expected));
}

// apps/logger-service/src/main.ts
var app = (0, import_express.default)();
var wsServer = new import_ws2.default.Server({ noServer: true });
wsServer.on("connection", (ws) => {
  console.log("New logger client connected!");
  clients.add(ws);
  recentLogs.forEach((log) => {
    if (ws.readyState === import_ws2.default.OPEN) {
      ws.send(log);
    }
  });
  ws.on("close", () => {
    console.log("Logger client disconnected!");
    clients.delete(ws);
  });
});
var server = import_http.default.createServer(app);
server.on("upgrade", (request, socket, head) => {
  if (!mayReadInternalLogs(request.headers.authorization)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  wsServer.handleUpgrade(request, socket, head, (ws) => {
    wsServer.emit("connection", ws, request);
  });
});
var port = process.env.PORT || 6009;
server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
consumeKafkaMessages().catch(console.error);
//# sourceMappingURL=main.js.map
