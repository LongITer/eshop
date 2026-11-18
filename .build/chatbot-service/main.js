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

// apps/chatbot-service/src/main.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_cookie_parser = __toESM(require("cookie-parser"));

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

// packages/utils/admin-access.ts
var grants = {
  owner: ["fulfillment", "overview", "orders", "payments", "catalog", "accounts", "returns", "notifications", "logs", "settings", "team"],
  operations: ["fulfillment", "overview", "orders", "catalog", "returns", "notifications"],
  support: ["fulfillment", "orders", "accounts", "returns", "notifications"],
  finance: ["payments", "orders"]
};
function canAdmin(account, permission) {
  return account?.role === "admin" && !!grants[account.adminRole ?? "owner"]?.includes(permission);
}
function isSuspended(account, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}

// packages/middleware/adminPermission.ts
var adminPermission = (permission) => (req, _res, next) => {
  if (req.role !== "admin" || !canAdmin(req.user, permission))
    return next(new ForbiddenError("You do not have permission for this action"));
  next();
};

// apps/chatbot-service/src/routes/chatbot.routes.ts
var import_express = __toESM(require("express"));

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

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

// packages/middleware/authorizeRoles.ts
var isAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return next(new AuthError("Access denied: Admin only"));
  }
  next();
};

// apps/chatbot-service/src/services/ai.service.ts
var SYSTEM_PROMPT = `B\u1EA1n l\xE0 chuy\xEAn gia t\u01B0 v\u1EA5n build PC cho c\u1EEDa h\xE0ng tr\u1EF1c tuy\u1EBFn Eshop.

## Nhi\u1EC7m v\u1EE5
- Gi\xFAp kh\xE1ch h\xE0ng ch\u1ECDn c\u1EA5u h\xECnh PC ph\xF9 h\u1EE3p v\u1EDBi nhu c\u1EA7u v\xE0 ng\xE2n s\xE1ch
- Gi\u1EA3i th\xEDch k\u1EF9 thu\u1EADt m\u1ED9t c\xE1ch d\u1EC5 hi\u1EC3u
- \u0110\u1EC1 xu\u1EA5t linh ki\u1EC7n t\u01B0\u01A1ng th\xEDch v\u1EDBi nhau

## Quy t\u1EAFc
- Tr\u1EA3 l\u1EDDi b\u1EB1ng ng\xF4n ng\u1EEF \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u, th\xE2n thi\u1EC7n v\xE0 chuy\xEAn nghi\u1EC7p
- N\u1EBFu c\xF3 s\u1EA3n ph\u1EA9m trong c\u1EEDa h\xE0ng, \u01B0u ti\xEAn \u0111\u1EC1 xu\u1EA5t s\u1EA3n ph\u1EA9m \u0111\xF3
- Gi\xE1 trong danh m\u1EE5c \u0111\u01B0\u1EE3c t\xEDnh b\u1EB1ng USD. Kh\xF4ng g\u1EAFn nh\xE3n VND cho s\u1ED1 ti\u1EC1n USD v\xE0 kh\xF4ng t\u1EF1 suy \u0111o\xE1n t\u1EF7 gi\xE1. N\u1EBFu kh\xE1ch \u0111\u01B0a ng\xE2n s\xE1ch b\u1EB1ng VND, h\xE3y h\u1ECFi ng\xE2n s\xE1ch t\u01B0\u01A1ng \u0111\u01B0\u01A1ng USD tr\u01B0\u1EDBc khi so s\xE1nh gi\xE1.
- Khi h\u1ECFi s\u1EA3n ph\u1EA9m c\u1EE7a c\u1EEDa h\xE0ng, ch\u1EC9 x\xE1c nh\u1EADn ho\u1EB7c \u0111\u1EC1 xu\u1EA5t s\u1EA3n ph\u1EA9m c\xF3 trong danh s\xE1ch \u0111\u01B0\u1EE3c cung c\u1EA5p; n\u1EBFu danh s\xE1ch tr\u1ED1ng, h\xE3y n\xF3i r\xF5 ch\u01B0a t\xECm th\u1EA5y s\u1EA3n ph\u1EA9m ph\xF9 h\u1EE3p
- Gi\u1EA3i th\xEDch l\xFD do ch\u1ECDn t\u1EEBng linh ki\u1EC7n ng\u1EAFn g\u1ECDn
- C\u1EA3nh b\xE1o n\u1EBFu linh ki\u1EC7n kh\xF4ng t\u01B0\u01A1ng th\xEDch (v\xED d\u1EE5: socket CPU \u2260 socket mainboard)
- N\u1EBFu ng\xE2n s\xE1ch h\u1EA1n ch\u1EBF, \u0111\u1EC1 xu\u1EA5t linh ki\u1EC7n t\u1ED1t nh\u1EA5t trong kh\u1EA3 n\u0103ng
- N\u1EBFu c\xE2u h\u1ECFi KH\xD4NG li\xEAn quan \u0111\u1EBFn PC/m\xE1y t\xEDnh/linh ki\u1EC7n, l\u1ECBch s\u1EF1 t\u1EEB ch\u1ED1i v\xE0 h\u01B0\u1EDBng d\u1EABn quay l\u1EA1i ch\u1EE7 \u0111\u1EC1 build PC
- Tr\u1EA3 l\u1EDDi ng\u1EAFn g\u1ECDn, t\u1ED1i \u0111a 200 t\u1EEB
- S\u1EED d\u1EE5ng emoji ph\xF9 h\u1EE3p \u0111\u1EC3 t\u0103ng t\xEDnh th\xE2n thi\u1EC7n
- Format b\u1EB1ng Markdown khi c\u1EA7n (bold, list, headers)`;
var GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
var GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
var modelCooldowns = /* @__PURE__ */ new Map();
var cooldownApiKey = null;
function retryDelay(response, body) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1e3 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay > 0)
      return Math.min(delay, 864e5);
  }
  const duration = body.match(/retry in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (duration) {
    const delay = (Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0)) * 1e3;
    if (delay > 0)
      return Math.min(delay, 864e5);
  }
  return /per day|daily|per_day/i.test(body) ? 864e5 : 6e4;
}
async function requestGemini(url, init) {
  const apiKey = new Headers(init.headers).get("x-goog-api-key");
  if (apiKey !== cooldownApiKey) {
    modelCooldowns.clear();
    cooldownApiKey = apiKey;
  }
  const requestBody = JSON.parse(String(init.body || "{}"));
  let lastResponse;
  let lastError;
  for (const model of GEMINI_MODELS) {
    if ((modelCooldowns.get(model) || 0) > Date.now())
      continue;
    try {
      const response = await fetch(url, {
        ...init,
        body: JSON.stringify({ ...requestBody, model }),
        signal: AbortSignal.timeout(2e4)
      });
      lastResponse = response;
      if (response.ok)
        return response;
      if (![404, 429, 500, 502, 503, 504].includes(response.status))
        return response;
      const detail = await response.clone().text();
      modelCooldowns.set(model, Date.now() + (response.status === 429 ? retryDelay(response, detail) : 3e4));
      console.warn("Gemini model unavailable; trying fallback", { model, status: response.status });
    } catch (error) {
      lastError = error;
      modelCooldowns.set(model, Date.now() + 3e4);
      console.warn("Gemini request failed; trying fallback", { model, reason: error instanceof Error ? error.name : "NetworkError" });
    }
  }
  if (lastResponse)
    return lastResponse;
  throw lastError || new Error("All Gemini models are temporarily unavailable");
}
async function getAIResponse(userMessage, conversationHistory, availableProducts = [], language = "vi") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      content: getFallbackResponse(userMessage, language),
      error: "GEMINI_API_KEY not configured"
    };
  }
  try {
    let productContext = "";
    if (availableProducts.length > 0) {
      productContext = "\n\n## S\u1EA3n ph\u1EA9m c\xF3 s\u1EB5n trong c\u1EEDa h\xE0ng:\n" + JSON.stringify(
        availableProducts.map((p) => ({
          title: p.title,
          price: `${p.sale_price.toFixed(2)} USD`,
          category: p.subCategory || p.category,
          stock: p.stock,
          rating: p.rating,
          brand: p.brand
        })),
        null,
        2
      );
    }
    const history = conversationHistory.filter((msg) => msg.role !== "system" && !(msg.role === "bot" && [getFallbackResponse("", "vi"), getFallbackResponse("", "en")].includes(msg.content.trim()))).map((msg) => `${msg.role === "bot" ? "Tr\u1EE3 l\xFD" : "Ng\u01B0\u1EDDi d\xF9ng"}: ${msg.content}`).join("\n");
    const input = history ? `${history}
Ng\u01B0\u1EDDi d\xF9ng: ${userMessage}` : userMessage;
    const response = await requestGemini(
      GEMINI_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: GEMINI_MODELS[0],
          input,
          system_instruction: `${SYSTEM_PROMPT}

Tr\u1EA3 l\u1EDDi b\u1EB1ng ${language === "en" ? "ti\u1EBFng Anh" : "ti\u1EBFng Vi\u1EC7t"}.` + productContext,
          generation_config: {
            temperature: 0.7,
            top_p: 0.9,
            max_output_tokens: 1024
          },
          store: false
        })
      }
    );
    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", response.status, errorData);
      return {
        content: getFallbackResponse(userMessage, language),
        error: `Gemini API error: ${response.status}`
      };
    }
    const data = await response.json();
    const text = Array.isArray(data?.steps) ? data.steps.filter((step) => step.type === "model_output").flatMap((step) => step.content || []).filter((content) => content.type === "text").map((content) => content.text).join("") : "";
    if (!text) {
      return {
        content: getFallbackResponse(userMessage, language),
        error: "Empty response from Gemini"
      };
    }
    return { content: text };
  } catch (error) {
    console.error("AI Service error:", error);
    return {
      content: getFallbackResponse(userMessage, language),
      error: `AI Service error: ${error.message}`
    };
  }
}
function getFallbackResponse(_message, language) {
  return language === "en" ? "Sorry, the AI assistant is temporarily unavailable. Please try again shortly." : "Xin l\u1ED7i, AI hi\u1EC7n \u0111ang b\u1EADn ho\u1EB7c kh\xF4ng kh\u1EA3 d\u1EE5ng. Vui l\xF2ng th\u1EED l\u1EA1i sau \xEDt ph\xFAt.";
}

// apps/chatbot-service/src/controllers/chatbot.controller.ts
var import_crypto = __toESM(require("crypto"));

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

// packages/utils/admin-audit.ts
function audit(tx, actorId, action, targetId, reason, before, after) {
  const json = (value) => JSON.parse(JSON.stringify(value ?? {}));
  return tx.adminAudit.create({ data: { actorId, action, targetId, reason, before: json(before), after: json(after) } });
}

// apps/chatbot-service/src/controllers/chatbot.controller.ts
var ownsConversation = (conversation, req, sessionId) => typeof sessionId === "string" && sessionId === conversation.sessionId && (!conversation.userId || conversation.userId === req.user?.id);
var toPrismaJson = (value) => value;
var getProductContext = async () => {
  const products = await prisma_default.products.findMany({
    where: { stock: { gt: 0 }, status: "Active", isDeleted: false },
    include: { images: { take: 1 }, shop: { select: { name: true } } },
    orderBy: [{ rating: "desc" }, { totalSales: "desc" }],
    take: 100
  });
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    category: product.category,
    subCategory: product.subCategory,
    sale_price: product.sale_price,
    regular_price: product.regular_price,
    stock: product.stock,
    rating: product.rating,
    image: product.images[0]?.url || null,
    shopName: product.shop.name,
    shopId: product.shopId,
    brand: product.brand
  }));
};
var chat = async (req, res, next) => {
  try {
    const { conversationId, sessionId, message } = req.body;
    const language = req.body.language === "en" ? "en" : "vi";
    const userId = req.user?.id || null;
    if (sessionId != null && (typeof sessionId !== "string" || sessionId.length < 16 || sessionId.length > 128)) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Message is required" });
    }
    let conversation;
    if (conversationId) {
      conversation = await prisma_default.chatbotConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 20
          }
        }
      });
      if (!conversation || !ownsConversation(conversation, req, sessionId)) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    }
    if (!conversation) {
      const newSessionId = sessionId || import_crypto.default.randomUUID();
      conversation = await prisma_default.chatbotConversation.create({
        data: {
          userId,
          sessionId: newSessionId,
          status: "active",
          context: null
        },
        include: { messages: true }
      });
    }
    await prisma_default.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message.trim(),
        messageType: "text"
      }
    });
    const chatHistory = conversation.messages.slice().reverse().map((m) => ({
      role: m.role,
      content: m.content
    }));
    const products = await getProductContext();
    const aiResult = await getAIResponse(message.trim(), chatHistory, products, language);
    if (aiResult.error) {
      console.warn("Chatbot response unavailable:", aiResult.error);
      return res.status(200).json({
        conversationId: conversation.id,
        message: {
          id: import_crypto.default.randomUUID(),
          role: "bot",
          content: aiResult.content,
          messageType: "text",
          metadata: { aiUnavailable: true },
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    }
    const botResponse = {
      content: aiResult.content,
      messageType: "text",
      metadata: void 0
    };
    const botMessage = await prisma_default.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "bot",
        content: botResponse.content,
        messageType: botResponse.messageType,
        metadata: toPrismaJson(botResponse.metadata)
      }
    });
    return res.status(200).json({
      conversationId: conversation.id,
      message: {
        id: botMessage.id,
        role: "bot",
        content: botResponse.content,
        messageType: botResponse.messageType,
        metadata: botResponse.metadata || null,
        createdAt: botMessage.createdAt
      },
      products: void 0
    });
  } catch (error) {
    console.error("Chat error:", error);
    return next(error);
  }
};
var createConversation = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const language = req.body.language === "en" ? "en" : "vi";
    const requestedSessionId = req.body.sessionId;
    if (requestedSessionId != null && (typeof requestedSessionId !== "string" || requestedSessionId.length < 16 || requestedSessionId.length > 128)) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    const sessionId = requestedSessionId || import_crypto.default.randomUUID();
    const conversation = await prisma_default.chatbotConversation.create({
      data: {
        userId,
        sessionId,
        status: "active"
      }
    });
    const products = await getProductContext();
    const greetingResponse = await getAIResponse(
      "H\xE3y ch\xE0o ng\u01B0\u1EDDi d\xF9ng v\xE0 h\u1ECFi h\u1ECD \u0111ang c\u1EA7n t\u01B0 v\u1EA5n g\xEC v\u1EC1 m\xE1y t\xEDnh ho\u1EB7c s\u1EA3n ph\u1EA9m trong c\u1EEDa h\xE0ng.",
      [],
      products,
      language
    );
    const botMessage = await prisma_default.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "bot",
        content: greetingResponse.error ? language === "en" ? "Hello! What will you use your PC for, and what is your budget?" : "Ch\xE0o b\u1EA1n! B\u1EA1n mu\u1ED1n build PC cho nhu c\u1EA7u g\xEC v\xE0 ng\xE2n s\xE1ch kho\u1EA3ng bao nhi\xEAu?" : greetingResponse.content,
        messageType: "text",
        metadata: null
      }
    });
    return res.status(201).json({
      conversationId: conversation.id,
      sessionId,
      message: {
        id: botMessage.id,
        role: "bot",
        content: botMessage.content,
        messageType: "text",
        metadata: null,
        createdAt: botMessage.createdAt
      }
    });
  } catch (error) {
    return next(error);
  }
};
var getConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;
    const conversation = await prisma_default.chatbotConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!conversation || !ownsConversation(conversation, req, sessionId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    return res.status(200).json({ conversation });
  } catch (error) {
    return next(error);
  }
};
var deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;
    const conversation = await prisma_default.chatbotConversation.findUnique({
      where: { id }
    });
    if (!conversation || !ownsConversation(conversation, req, sessionId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }
    await prisma_default.chatbotMessage.deleteMany({
      where: { conversationId: id }
    });
    await prisma_default.chatbotConversation.delete({
      where: { id }
    });
    return res.status(200).json({ message: "Conversation deleted" });
  } catch (error) {
    return next(error);
  }
};
var getTemplates = async (req, res, next) => {
  try {
    const { purpose, budgetMin, budgetMax } = req.query;
    const where = { isActive: true };
    if (purpose)
      where.purpose = purpose;
    if (budgetMin || budgetMax) {
      where.budgetMin = budgetMin ? { gte: Number(budgetMin) } : void 0;
      where.budgetMax = budgetMax ? { lte: Number(budgetMax) } : void 0;
    }
    const templates = await prisma_default.pcBuildTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json({ templates });
  } catch (error) {
    return next(error);
  }
};
var createTemplate = async (req, res, next) => {
  try {
    const {
      name,
      purpose,
      budgetMin,
      budgetMax,
      components,
      productIds,
      description
    } = req.body;
    const parsedBudgetMin = Number(budgetMin);
    const parsedBudgetMax = Number(budgetMax);
    if (!name || !purpose || budgetMin == null || budgetMax == null || !components || typeof components !== "object" || Array.isArray(components) || !Number.isFinite(parsedBudgetMin) || !Number.isFinite(parsedBudgetMax) || parsedBudgetMin < 0 || parsedBudgetMax < parsedBudgetMin || productIds != null && (!Array.isArray(productIds) || productIds.some((id) => typeof id !== "string"))) {
      return res.status(400).json({
        message: "Invalid template data"
      });
    }
    const template = await transaction(async (tx) => {
      const result = await tx.pcBuildTemplate.create({
        data: {
          name,
          purpose,
          budgetMin: parsedBudgetMin,
          budgetMax: parsedBudgetMax,
          components,
          productIds: productIds || [],
          description: description || null
        }
      });
      await audit(tx, req.user.id, "template.save", result.id, "Created PC template", null, result);
      return result;
    });
    return res.status(201).json({ template });
  } catch (error) {
    return next(error);
  }
};
var updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "name",
      "purpose",
      "budgetMin",
      "budgetMax",
      "components",
      "productIds",
      "description",
      "isActive"
    ];
    const updateData = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );
    const existingTemplate = await prisma_default.pcBuildTemplate.findUnique({
      where: { id }
    });
    if (!existingTemplate) {
      return res.status(404).json({ message: "Template not found" });
    }
    if (updateData.budgetMin != null)
      updateData.budgetMin = Number(updateData.budgetMin);
    if (updateData.budgetMax != null)
      updateData.budgetMax = Number(updateData.budgetMax);
    const finalBudgetMin = Number(
      updateData.budgetMin ?? existingTemplate.budgetMin
    );
    const finalBudgetMax = Number(
      updateData.budgetMax ?? existingTemplate.budgetMax
    );
    if (!Number.isFinite(finalBudgetMin) || !Number.isFinite(finalBudgetMax) || finalBudgetMin < 0 || finalBudgetMax < finalBudgetMin || updateData.components != null && (typeof updateData.components !== "object" || Array.isArray(updateData.components)) || updateData.productIds != null && (!Array.isArray(updateData.productIds) || updateData.productIds.some((productId) => typeof productId !== "string"))) {
      return res.status(400).json({ message: "Invalid template data" });
    }
    const template = await transaction(async (tx) => {
      const before = await tx.pcBuildTemplate.findUniqueOrThrow({ where: { id } });
      const result = await tx.pcBuildTemplate.update({ where: { id }, data: updateData });
      await audit(tx, req.user.id, "template.save", id, "Updated PC template", before, result);
      return result;
    });
    return res.status(200).json({ template });
  } catch (error) {
    return next(error);
  }
};

// apps/chatbot-service/src/routes/chatbot.routes.ts
var router = import_express.default.Router();
var optionalAuthentication = (req, res, next) => {
  const hasToken = req.cookies?.access_token || req.cookies?.seller_access_token || req.headers.authorization?.startsWith("Bearer ");
  return hasToken ? isAuthenticated_default(req, res, next) : next();
};
router.post("/chat", optionalAuthentication, chat);
router.post("/conversations", optionalAuthentication, createConversation);
router.get("/conversations/:id", optionalAuthentication, getConversation);
router.delete("/conversations/:id", optionalAuthentication, deleteConversation);
router.get("/templates", getTemplates);
router.post("/templates", isAuthenticated_default, isAdmin, adminPermission("catalog"), createTemplate);
router.put("/templates/:id", isAuthenticated_default, isAdmin, adminPermission("catalog"), updateTemplate);
var chatbot_routes_default = router;

// apps/chatbot-service/src/main.ts
var app = (0, import_express2.default)();
app.use(
  (0, import_cors.default)({
    origin: true,
    credentials: true
  })
);
app.use(import_express2.default.json({ limit: "10mb" }));
app.use(import_express2.default.urlencoded({ extended: true, limit: "10mb" }));
app.use((0, import_cookie_parser.default)());
app.get("/", (req, res) => {
  res.send({ message: "Hello Chatbot Service API \u{1F916}" });
});
app.use("/api", chatbot_routes_default);
app.use(errorMiddleware);
var port = process.env.CHATBOT_PORT || 6007;
var server = app.listen(port, () => {
  console.log(`\u{1F916} Chatbot service is listening at http://localhost:${port}/`);
  console.log(`   Chat endpoint: POST http://localhost:${port}/api/chat`);
});
server.on("error", (err) => {
  console.error("Chatbot service error:", err);
});
//# sourceMappingURL=main.js.map
