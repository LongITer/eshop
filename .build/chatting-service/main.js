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

// apps/chatting-service/src/main.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"));

// packages/utils/admin-access.ts
function isSuspended(account, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}

// packages/libs/redis/index.ts
var import_ioredis = __toESM(require("ioredis"));
var redis = new import_ioredis.default(process.env.REDIS_DATABASE_URL || process.env.REDIS_DATEBASE_URL || "redis://localhost:6379");
var redis_default = redis;

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

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

// apps/chatting-service/src/websocket.ts
var import_ws = __toESM(require("ws"));
var import_crypto = __toESM(require("crypto"));

// packages/libs/redis/message.redis.ts
var clearUnseenCount = async (receiverType, conversationId) => {
  const key = `unseen:${receiverType}_${conversationId}`;
  await redis_default.del(key);
};

// apps/chatting-service/src/websocket.ts
var producer = kafka.producer();
var sockets = /* @__PURE__ */ new Map();
function emit(key, event) {
  for (const socket of sockets.get(key) ?? [])
    if (socket.readyState === import_ws.default.OPEN)
      socket.send(JSON.stringify(event));
}
async function createWebSockerServer(server2) {
  const wss = new import_ws.WebSocketServer({ server: server2, maxPayload: 64e3 });
  await producer.connect();
  wss.on("connection", async (ws, req) => {
    try {
      const ticket = new URL(req.url || "/", "http://localhost").searchParams.get("ticket");
      if (!ticket || !/^[a-f\d]{64}$/.test(ticket)) {
        ws.close(1008, "Authentication required");
        return;
      }
      const stored = await redis_default.getdel(`chat-ticket:${ticket}`);
      if (!stored) {
        ws.close(1008, "Ticket expired");
        return;
      }
      const identity = JSON.parse(stored);
      const accountAllowed = async () => {
        const args = { where: { id: identity.id }, select: { suspendedAt: true, suspendedUntil: true } };
        const account = identity.type === "seller" ? await prisma_default.sellers.findUnique(args) : await prisma_default.users.findUnique(args);
        return account && !isSuspended(account);
      };
      if (!await accountAllowed()) {
        ws.close(1008, "Account unavailable");
        return;
      }
      const key = `${identity.type}_${identity.id}`;
      const peers = sockets.get(key) ?? /* @__PURE__ */ new Set();
      peers.add(ws);
      sockets.set(key, peers);
      const presenceKey = `online:${identity.type}:${identity.id}`;
      const presence = async (online) => {
        const groups = await prisma_default.conversationGroup.findMany({ where: { participantIds: { has: identity.id } } });
        for (const group of groups)
          for (const id of group.participantIds.filter((id2) => id2 !== identity.id))
            emit(`${identity.type === "user" ? "seller" : "user"}_${id}`, { type: "PRESENCE", payload: { conversationId: group.id, actorId: identity.id, online } });
      };
      await redis_default.set(presenceKey, "1", "EX", 90);
      await presence(true);
      ws.send(JSON.stringify({ type: "READY" }));
      let alive = true;
      ws.on("pong", () => {
        alive = true;
      });
      const heartbeat = setInterval(() => {
        if (!alive) {
          ws.terminate();
          return;
        }
        alive = false;
        ws.ping();
        redis_default.expire(presenceKey, 90).catch(console.error);
      }, 3e4);
      let windowStart = Date.now();
      let count = 0;
      ws.on("message", async (raw) => {
        try {
          if (Date.now() - windowStart > 1e4) {
            windowStart = Date.now();
            count = 0;
          }
          if (++count > 60)
            throw new Error("Too many messages");
          if (!await accountAllowed()) {
            ws.close(1008, "Account unavailable");
            return;
          }
          const text = raw.toString();
          if (!text.startsWith("{"))
            return;
          const data = JSON.parse(text);
          if (!/^[a-f\d]{24}$/i.test(data.conversationId ?? ""))
            throw new Error("Invalid conversation");
          const group = await prisma_default.conversationGroup.findFirst({ where: { id: data.conversationId, participantIds: { has: identity.id } } });
          if (!group)
            throw new Error("Conversation access denied");
          const receiverId = group.participantIds.find((id) => id !== identity.id);
          const receiverKey = `${identity.type === "user" ? "seller" : "user"}_${receiverId}`;
          if (data.type === "MARK_AS_SEEN") {
            await clearUnseenCount(identity.type, group.id);
            await prisma_default.participant.updateMany({ where: { conversationId: group.id, ...identity.type === "user" ? { userId: identity.id } : { sellerId: identity.id } }, data: { lastSeenAt: /* @__PURE__ */ new Date(), unreadCount: 0 } });
            return;
          }
          if (data.type === "TYPING") {
            emit(receiverKey, { type: "TYPING", payload: { conversationId: group.id, typing: !!data.typing } });
            return;
          }
          const content = typeof data.messageBody === "string" ? data.messageBody.trim() : "";
          const attachments = data.attachments ?? [];
          if (content.length > 5e3 || !Array.isArray(attachments) || attachments.length > 5 || !content && !attachments.length)
            throw new Error("Invalid message");
          if (attachments.length) {
            if (attachments.some((url) => typeof url !== "string"))
              throw new Error("Invalid attachment");
            const valid = await prisma_default.chatAttachment.count({ where: { conversationId: group.id, actorId: identity.id, url: { in: attachments } } });
            if (valid !== new Set(attachments).size)
              throw new Error("Attachment access denied");
          }
          const payload = { id: import_crypto.default.randomBytes(12).toString("hex"), conversationId: group.id, senderId: identity.id, senderType: identity.type, content, attachments, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
          await producer.send({ topic: "chat.new_message", messages: [{ key: group.id, value: JSON.stringify(payload) }] });
          emit(key, { type: "NEW_MESSAGE", payload });
          emit(receiverKey, { type: "NEW_MESSAGE", payload });
        } catch (error) {
          ws.send(JSON.stringify({ type: "ERROR", message: error.message || "Message rejected" }));
        }
      });
      ws.on("close", () => {
        clearInterval(heartbeat);
        peers.delete(ws);
        if (!peers.size) {
          sockets.delete(key);
          redis_default.del(presenceKey).then(() => presence(false)).catch(console.error);
        }
      });
    } catch {
      ws.close(1011, "Chat unavailable");
    }
  });
  wss.on("close", () => {
    producer.disconnect().catch(console.error);
  });
  return wss;
}

// apps/chatting-service/src/chat-extras.ts
var import_crypto2 = __toESM(require("crypto"));
var import_web_push = __toESM(require("web-push"));

// packages/libs/imagekit/index.ts
var import_imagekit = __toESM(require("imagekit"));
var instance = null;
var getInstance = () => {
  if (!instance) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!publicKey || !privateKey || !urlEndpoint) {
      throw new Error(
        "ImageKit environment variables are missing (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, or IMAGEKIT_URL_ENDPOINT)."
      );
    }
    instance = new import_imagekit.default({ publicKey, privateKey, urlEndpoint });
  }
  return instance;
};
var imageKit = new Proxy({}, {
  get: (target, prop) => {
    const inst = getInstance();
    const value = inst[prop];
    if (typeof value === "function") {
      return value.bind(inst);
    }
    return value;
  }
});

// packages/error-handler/index.ts
var AppError = class extends Error {
  statusCode;
  isOperational;
  details;
  constructor(message, statusCode, isOperational = true, details) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this);
  }
};
var ValidationError = class extends AppError {
  constructor(message = "Invalid request data", details) {
    super(message, 400, true, details);
  }
};
var AuthError = class extends AppError {
  constructor(message = "Unauthorizes") {
    super(message, 401);
  }
};
var ForbiddenError = class extends AppError {
  constructor(message = "Forbidden access") {
    super(message, 403);
  }
};

// packages/utils/api.ts
var handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
function objectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new ValidationError("Invalid ID");
  return value;
}

// apps/chatting-service/src/chat-extras.ts
function actor(req) {
  const type = req.role === "seller" ? "seller" : "user";
  const id = type === "seller" ? req.seller?.id : req.user?.id;
  if (!id || !["user", "seller"].includes(req.role))
    throw new ForbiddenError();
  return { id, type };
}
var socketTicket = handle(async (req, res) => {
  const identity = actor(req);
  const ticket = import_crypto2.default.randomBytes(32).toString("hex");
  await redis_default.set(`chat-ticket:${ticket}`, JSON.stringify(identity), "EX", 60);
  res.json({ ticket });
});
var attachment = handle(async (req, res) => {
  const identity = actor(req);
  const conversationId = objectId(req.body.conversationId);
  if (!await prisma_default.conversationGroup.findFirst({ where: { id: conversationId, participantIds: { has: identity.id } } }))
    throw new ForbiddenError();
  if (typeof req.body.file !== "string" || req.body.file.length > 7e6 || !/^data:(image\/(png|jpeg|webp)|application\/pdf|text\/plain);base64,/.test(req.body.file))
    throw new ValidationError("Choose an image, PDF or text file under 5 MB");
  const result = await imageKit.upload({ file: req.body.file, fileName: `chat-${import_crypto2.default.randomUUID()}-${String(req.body.name || "attachment").replace(/[^\w.-]/g, "").slice(-100)}`, folder: "/chat" });
  await prisma_default.chatAttachment.create({ data: { url: result.url, actorId: identity.id, conversationId } });
  res.status(201).json({ url: result.url });
});
var pushKey = handle(async (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null });
});
var subscribePush = handle(async (req, res) => {
  const identity = actor(req);
  const subscription = req.body;
  let url;
  try {
    url = new URL(subscription.endpoint);
  } catch {
    throw new ValidationError("Invalid push endpoint");
  }
  const allowed = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
  if (url.protocol !== "https:" || url.port || url.username || url.password || !(allowed.includes(url.hostname) || url.hostname.endsWith(".notify.windows.com")) || typeof subscription.keys?.p256dh !== "string" || typeof subscription.keys?.auth !== "string")
    throw new ValidationError("Invalid push subscription");
  await prisma_default.pushSubscription.upsert({ where: { endpoint: subscription.endpoint }, create: { endpoint: subscription.endpoint, actorId: identity.id, actorType: identity.type, subscription }, update: { actorId: identity.id, actorType: identity.type, subscription } });
  res.json({ success: true });
});
async function sendPush(actorId, actorType, conversationId) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT)
    return;
  import_web_push.default.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subscriptions = await prisma_default.pushSubscription.findMany({ where: { actorId, actorType } });
  await Promise.all(subscriptions.map(async (record) => {
    try {
      await import_web_push.default.sendNotification(record.subscription, JSON.stringify({ title: "New message", body: "You have a new message on Eshop.", url: `${actorType === "seller" ? "/dashboard" : ""}/inbox?conversationId=${conversationId}` }));
    } catch (error) {
      if ([404, 410].includes(error.statusCode))
        await prisma_default.pushSubscription.deleteMany({ where: { id: record.id } });
      else
        console.error("Push delivery failed", error.statusCode);
    }
  }));
}

// apps/chatting-service/src/chat-message.consumer.ts
var import_crypto3 = __toESM(require("crypto"));

// packages/utils/transaction.ts
async function transaction(work, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma_default.$transaction(work, options);
    } catch (error) {
      if (error?.code !== "P2034" || attempt >= 3)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

// apps/chatting-service/src/chat-message.consumer.ts
async function startConsumer() {
  const consumer = kafka.consumer({ groupId: "chat-message-db-writer" });
  await consumer.connect();
  await consumer.subscribe({ topic: "chat.new_message", fromBeginning: false });
  await consumer.run({ eachMessage: async ({ topic, partition, message }) => {
    if (!message.value)
      return;
    let event;
    try {
      event = JSON.parse(message.value.toString());
    } catch {
      console.error("Invalid chat event");
      return;
    }
    const id = event.id || import_crypto3.default.createHash("sha256").update(`${topic}:${partition}:${message.offset}`).digest("hex").slice(0, 24);
    const receiverType = event.senderType === "user" ? "seller" : "user";
    const receiverId = await transaction(async (tx) => {
      if (await tx.message.findUnique({ where: { id } }))
        return null;
      const group = await tx.conversationGroup.findFirst({ where: { id: event.conversationId, participantIds: { has: event.senderId } } });
      if (!group)
        return null;
      const receiverId2 = group.participantIds.find((value) => value !== event.senderId);
      await tx.message.create({ data: { id, conversationId: group.id, senderId: event.senderId, senderType: event.senderType, content: event.content || "", attachments: event.attachments || [], createdAt: new Date(event.createdAt) } });
      await tx.conversationGroup.update({ where: { id: group.id }, data: { updatedAt: /* @__PURE__ */ new Date() } });
      const participantWhere = { conversationId: group.id, ...receiverType === "user" ? { userId: receiverId2 } : { sellerId: receiverId2 } };
      const participant = await tx.participant.findFirst({ where: participantWhere });
      if (!participant?.lastSeenAt || participant.lastSeenAt < new Date(event.createdAt))
        await tx.participant.updateMany({ where: participantWhere, data: { unreadCount: { increment: 1 } } });
      if (receiverId2)
        await tx.notifications.create({ data: { ...receiverType === "user" ? { userId: receiverId2 } : { sellerId: receiverId2 }, type: "System", title: "New message", message: String(event.content || "Attachment").slice(0, 120), redirectUrl: `${receiverType === "seller" ? "/dashboard" : ""}/inbox?conversationId=${group.id}`, metadata: { eventType: "NewMessage", conversationId: group.id } } });
      return receiverId2;
    });
    if (receiverId)
      await sendPush(receiverId, receiverType, event.conversationId);
  } });
}

// packages/middleware/isAuthenticated.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var isAuthenticated = async (req, res, next) => {
  try {
    const sessionRole = req.headers["x-session-role"];
    const cookieToken = sessionRole === "seller" ? req.cookies?.seller_access_token : sessionRole === "user" ? req.cookies?.access_token : req.cookies?.access_token || req.cookies?.seller_access_token;
    const token = req.headers.authorization?.split(" ")[1] || cookieToken;
    if (!token) {
      return res.status(401).json({
        message: "Unauthorization! Token missing."
      });
    }
    const decoded = await import_jsonwebtoken.default.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);
    if (!decoded || !["user", "seller", "admin"].includes(decoded.role) || !/^[a-f\d]{24}$/i.test(decoded.id)) {
      return res.status(401).json({
        message: "Unauthorized! Invalid Token."
      });
    }
    let account;
    if (decoded.role === "user") {
      account = await prisma_default.users.findUnique({ where: { id: decoded.id } });
      req.user = account;
    } else if (decoded.role === "seller") {
      account = await prisma_default.sellers.findUnique({
        where: { id: decoded.id },
        include: { shop: true }
      });
      req.seller = account;
    } else {
      account = await prisma_default.users.findUnique({ where: { id: decoded.id } });
      req.user = account;
    }
    if (!account) {
      return res.status(401).json({ message: "Unauthorized! Account not found." });
    }
    if (isSuspended(account)) {
      return res.status(403).json({ message: "Account suspended. Contact support." });
    }
    if (decoded.role === "admin" && account.role !== "admin") {
      return res.status(401).json({ message: "Account role changed. Please sign in again." });
    }
    req.role = decoded.role;
    return next();
  } catch (error) {
    console.error(error.message);
    return res.status(401).json({
      message: "Unauthorized! Token is invalid or expired!"
    });
  }
};
var isAuthenticated_default = isAuthenticated;

// apps/chatting-service/src/routes/chat.routes.ts
var import_express = __toESM(require("express"));

// apps/chatting-service/src/controllers/chatting.controllers.ts
var newConversation = async (req, res, next) => {
  try {
    const { sellerId } = req.body;
    const userId = req.user.id;
    if (!sellerId) {
      return next(new ValidationError("Seller Id is required!"));
    }
    const existingGroup = await prisma_default.conversationGroup.findFirst({
      where: {
        isGroup: false,
        participantIds: {
          hasEvery: [sellerId, userId]
        }
      }
    });
    if (existingGroup) {
      return res.status(200).json({
        conversationId: existingGroup.id,
        isNew: false
      });
    }
    const newGroup = await prisma_default.conversationGroup.create({
      data: {
        isGroup: false,
        creatorId: userId,
        participantIds: [userId, sellerId]
      }
    });
    await prisma_default.participant.createMany({
      data: [
        {
          userId,
          conversationId: newGroup.id
        },
        {
          sellerId,
          conversationId: newGroup.id
        }
      ]
    });
    return res.status(200).json({
      conversationId: newGroup.id,
      isNew: true
    });
  } catch (error) {
    return next(error);
  }
};
var getUserConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const conversations = await prisma_default.conversationGroup.findMany({
      where: {
        participantIds: {
          has: userId
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    const responseData = await Promise.all(
      conversations.map(async (group) => {
        const sellerParticipant = await prisma_default.participant.findFirst({
          where: {
            conversationId: group.id,
            sellerId: { not: null }
          }
        });
        let seller = null;
        if (sellerParticipant?.sellerId) {
          seller = await prisma_default.sellers.findUnique({
            where: {
              id: sellerParticipant.sellerId
            },
            include: {
              shop: {
                include: {
                  avatar: true
                }
              }
            }
          });
        }
        const lastMessage = await prisma_default.message.findFirst({
          where: {
            conversationId: group.id
          },
          orderBy: { createdAt: "desc" }
        });
        let isOnline = false;
        if (sellerParticipant?.sellerId) {
          const redisKey = `online:seller:${sellerParticipant.sellerId}`;
          const redisResult = await redis_default.get(redisKey);
          isOnline = !!redisResult;
        }
        const unreadCount = (await prisma_default.participant.findFirst({ where: { conversationId: group.id, userId } }))?.unreadCount ?? 0;
        return {
          conversationId: group.id,
          seller: {
            id: seller?.id || null,
            name: seller?.shop?.name || "Unknown",
            isOnline,
            avatar: seller?.shop?.avatar?.[0]?.url || null
          },
          lastMessage: lastMessage?.content || "Say something to start a conversation",
          lastMessageAt: lastMessage?.createdAt || group.updatedAt,
          unreadCount
        };
      })
    );
    return res.status(200).json({ conversations: responseData });
  } catch (error) {
    return next(error);
  }
};
var getSellerConversations = async (req, res, next) => {
  try {
    const sellerId = req.seller?.id;
    const conversations = await prisma_default.conversationGroup.findMany({
      where: {
        participantIds: {
          has: sellerId
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    const responseData = await Promise.all(
      conversations.map(async (group) => {
        const userParticipant = await prisma_default.participant.findFirst({
          where: {
            conversationId: group.id,
            userId: { not: null }
          }
        });
        let buyer = null;
        if (userParticipant?.userId) {
          buyer = await prisma_default.users.findUnique({
            where: {
              id: userParticipant.userId
            },
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          });
        }
        const lastMessage = await prisma_default.message.findFirst({
          where: {
            conversationId: group.id
          },
          orderBy: { createdAt: "desc" }
        });
        let isOnline = false;
        if (userParticipant?.userId) {
          const redisKey = `online:user:${userParticipant.userId}`;
          const redisResult = await redis_default.get(redisKey);
          isOnline = !!redisResult;
        }
        const unreadCount = (await prisma_default.participant.findFirst({ where: { conversationId: group.id, sellerId } }))?.unreadCount ?? 0;
        return {
          conversationId: group.id,
          user: {
            id: buyer?.id || null,
            name: buyer?.name || "Unknown",
            email: buyer?.email || null,
            avatar: buyer?.avatar?.[0]?.url || null,
            isOnline
          },
          lastMessage: lastMessage?.content || "Say something to start a conversation",
          lastMessageAt: lastMessage?.createdAt || group.updatedAt,
          unreadCount
        };
      })
    );
    return res.status(200).json({ conversations: responseData });
  } catch (error) {
    return next(error);
  }
};
var fetchMessages = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = 10;
    if (!conversationId) {
      return next(new ValidationError("Conversation Id is required!"));
    }
    const conversation = await prisma_default.conversationGroup.findUnique({
      where: {
        id: conversationId,
        participantIds: {
          has: userId
        }
      }
    });
    if (!conversation) {
      return next(new ValidationError("Conversation not found!"));
    }
    const userConversation = await prisma_default.conversationGroup.findUnique({
      where: { id: conversationId }
    });
    if (!userConversation) {
      return next(new ValidationError("Conversation not found!"));
    }
    const hasAccess = conversation.participantIds.includes(userId);
    if (!hasAccess) {
      return next(
        new ValidationError("You don't have access to this conversation!")
      );
    }
    await clearUnseenCount("user", conversationId);
    await prisma_default.participant.updateMany({ where: { conversationId, userId }, data: { lastSeenAt: /* @__PURE__ */ new Date(), unreadCount: 0 } });
    const sellerParticipant = await prisma_default.participant.findFirst({
      where: {
        conversationId,
        sellerId: { not: null }
      }
    });
    let seller = null;
    let isOnline = false;
    if (sellerParticipant?.sellerId) {
      seller = await prisma_default.sellers.findUnique({
        where: { id: sellerParticipant.sellerId },
        include: {
          shop: {
            include: {
              avatar: true
            }
          }
        }
      });
      const redisKey = `online:seller:${sellerParticipant.sellerId}`;
      const redisResult = await redis_default.get(redisKey);
      isOnline = !!redisResult;
    }
    const messages = await prisma_default.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return res.status(200).json({
      messages,
      seller: {
        id: seller?.id || null,
        name: seller?.shop?.name || "Unknown",
        avatar: seller?.shop?.avatar?.[0]?.url || null,
        isOnline
      },
      currentPage: page,
      hasMore: messages.length === pageSize
    });
  } catch (error) {
    return next(error);
  }
};
var fetchSellerMessages = async (req, res, next) => {
  try {
    const sellerId = req.seller?.id;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = 10;
    if (!conversationId) {
      return next(new ValidationError("Conversation Id is required!"));
    }
    const conversation = await prisma_default.conversationGroup.findUnique({
      where: {
        id: conversationId,
        participantIds: {
          has: sellerId
        }
      }
    });
    if (!conversation) {
      return next(new ValidationError("Conversation not found!"));
    }
    const hasAccess = conversation.participantIds.includes(sellerId);
    if (!hasAccess) {
      return next(
        new ValidationError("You don't have access to this conversation!")
      );
    }
    await clearUnseenCount("seller", conversationId);
    await prisma_default.participant.updateMany({ where: { conversationId, sellerId }, data: { lastSeenAt: /* @__PURE__ */ new Date(), unreadCount: 0 } });
    const userParticipant = await prisma_default.participant.findFirst({
      where: {
        conversationId,
        userId: { not: null }
      }
    });
    let buyer = null;
    let isOnline = false;
    if (userParticipant?.userId) {
      buyer = await prisma_default.users.findUnique({
        where: { id: userParticipant.userId },
        select: {
          id: true,
          name: true,
          avatar: true
        }
      });
      const redisKey = `online:user:${userParticipant.userId}`;
      const redisResult = await redis_default.get(redisKey);
      isOnline = !!redisResult;
    }
    const messages = await prisma_default.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    });
    return res.status(200).json({
      messages,
      user: {
        id: buyer?.id || null,
        name: buyer?.name || "Unknown",
        avatar: buyer?.avatar?.[0]?.url || null,
        isOnline
      },
      currentPage: page,
      hasMore: messages.length === pageSize
    });
  } catch (error) {
    return next(error);
  }
};

// packages/middleware/authorizeRoles.ts
var isSeller = (req, res, next) => {
  if (req.role !== "seller") {
    return next(new AuthError("Access denied: Seller only"));
  }
  next();
};

// apps/chatting-service/src/routes/chat.routes.ts
var router = import_express.default.Router();
router.get("/unread-count", isAuthenticated_default, handle(async (req, res) => {
  const identity = actor(req);
  const result = await prisma_default.participant.aggregate({ where: identity.type === "user" ? { userId: identity.id } : { sellerId: identity.id }, _sum: { unreadCount: true } });
  res.json({ unreadCount: result._sum.unreadCount ?? 0 });
}));
router.post("/socket-ticket", isAuthenticated_default, socketTicket);
router.post("/attachments", isAuthenticated_default, attachment);
router.get("/push-key", isAuthenticated_default, pushKey);
router.post("/push-subscription", isAuthenticated_default, subscribePush);
router.post("/create-user-conversationGroup", isAuthenticated_default, newConversation);
router.get("/get-user-conversations", isAuthenticated_default, getUserConversations);
router.get(
  "/get-seller-conversations",
  isAuthenticated_default,
  isSeller,
  getSellerConversations
);
router.get("/get-messages/:conversationId", isAuthenticated_default, fetchMessages);
router.get(
  "/get-seller-messages/:conversationId",
  isAuthenticated_default,
  isSeller,
  fetchSellerMessages
);
var chat_routes_default = router;

// apps/chatting-service/src/main.ts
var import_cookie_parser = __toESM(require("cookie-parser"));

// packages/error-handler/error-middleware.ts
var errorMiddleware = (err, req, res, next) => {
  if (res.headersSent)
    return next(err);
  if (err.code === "P2002")
    return res.status(409).json({ message: "This value already exists. Please use a different value or reload and retry." });
  if (err.code === "P2025")
    return res.status(404).json({ message: "The record no longer exists or has changed. Reload and retry." });
  if (err.code === "P2034")
    return res.status(409).json({ message: "Another update is in progress. Please retry." });
  if (err instanceof AppError) {
    console.log(`Error ${req.method} - ${req.url} - ${err.message}`);
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...err.details && { details: err.details }
    });
  }
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized! Invalid or expired token."
    });
  }
  console.log("Unhandle error: ", err);
  return res.status(500).json({
    error: "Something went wrong. Please try again!"
  });
};

// apps/chatting-service/src/main.ts
var app = (0, import_express2.default)();
app.use(import_express2.default.json({ limit: "8mb" }));
app.use((0, import_cookie_parser.default)());
app.get("/", (req, res) => {
  res.send({ message: "Welcome to chatting-service!" });
});
app.use("/api", chat_routes_default);
app.use(errorMiddleware);
var port = process.env.PORT || 6006;
var server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
createWebSockerServer(server);
startConsumer().catch((error) => {
  console.log(error);
});
server.on("error", console.error);
//# sourceMappingURL=main.js.map
