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

// apps/recommendation-service/src/main.ts
var import_express = __toESM(require("express"));
var import_config = require("dotenv/config");
var import_cookie_parser = __toESM(require("cookie-parser"));

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

// packages/middleware/isAuthenticated.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// packages/utils/admin-access.ts
function isSuspended(account, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}

// packages/middleware/isAuthenticated.ts
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
var NotFoundError = class extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
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

// packages/middleware/authorizeRoles.ts
var isUser = (req, res, next) => {
  if (req.role !== "user") {
    return next(new AuthError("Access denied: User only"));
  }
  next();
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

// packages/utils/api.ts
var handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
function objectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new ValidationError("Invalid ID");
  return value;
}

// apps/recommendation-service/src/services/scoring.ts
function similarity(a, b) {
  if (a.id === b.id)
    return 0;
  const tags = new Set(a.tags.map((tag) => tag.toLowerCase()));
  const overlap = b.tags.filter((tag) => tags.has(tag.toLowerCase())).length;
  const union = new Set([...a.tags, ...b.tags].map((tag) => tag.toLowerCase())).size;
  return (a.category === b.category ? 4 : 0) + (a.subCategory === b.subCategory ? 3 : 0) + (a.brand && a.brand === b.brand ? 2 : 0) + (union ? overlap / union * 2 : 0) + Math.max(0, 1 - Math.abs(a.sale_price - b.sale_price) / Math.max(1, a.sale_price, b.sale_price));
}
function popularity(analytics, now = Date.now()) {
  const days = Math.max(0, (now - new Date(analytics.lastViewedAt).getTime()) / 864e5);
  return Math.log1p(Math.max(0, analytics.views) + Math.max(0, analytics.cartAdds) * 3 + Math.max(0, analytics.wishListAdds) * 2 + Math.max(0, analytics.purchases) * 8) / (1 + days / 14);
}
function actionWeight(action) {
  return { product_view: 1, add_to_wishlist: 3, add_to_cart: 4, purchase: 6 }[action] ?? 0;
}

// apps/recommendation-service/src/controllers/recommendation.controller.ts
async function candidates() {
  const [products, analytics] = await Promise.all([
    prisma_default.products.findMany({ where: { isDeleted: false, status: "Active", stock: { gt: 0 } }, include: { images: true, shop: { select: { id: true, name: true, avatar: true, ratings: true } } }, orderBy: { updatedAt: "desc" }, take: 1e3 }),
    prisma_default.productAnalytics.findMany({ orderBy: { lastViewedAt: "desc" }, take: 5e3 })
  ]);
  const scores = new Map(analytics.map((a) => [a.productId, popularity(a)]));
  return { products, scores };
}
function limit(value) {
  return Math.min(50, Math.max(1, Math.floor(Number(value) || 12)));
}
var trending = handle(async (req, res) => {
  const { products, scores } = await candidates();
  products.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  res.json({ products: products.slice(0, limit(req.query.limit)), strategy: "engagement-recency" });
});
var similar = handle(async (req, res) => {
  const product = await prisma_default.products.findFirst({ where: { id: objectId(req.params.productId), isDeleted: false, status: "Active" } });
  if (!product)
    throw new NotFoundError();
  const { products, scores } = await candidates();
  const ranked = products.filter((p) => p.id !== product.id).map((p) => ({ product: p, score: similarity(product, p) + (scores.get(p.id) ?? 0) * 0.1 })).sort((a, b) => b.score - a.score);
  res.json({ products: ranked.slice(0, limit(req.query.limit)).map((p) => p.product), strategy: "content-based" });
});
var personalized = handle(async (req, res) => {
  const userId = objectId(req.params.userId);
  if (userId !== req.user.id)
    throw new ForbiddenError();
  const history = await prisma_default.userAnalytics.findUnique({ where: { userId } });
  const actions = (history?.actions ?? []).filter((a) => !!a && typeof a === "object");
  const ids = actions.map((a) => a.productId).filter((id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id));
  const [seeds, { products, scores }] = await Promise.all([prisma_default.products.findMany({ where: { id: { in: ids } } }), candidates()]);
  const weights = /* @__PURE__ */ new Map();
  for (const action of actions)
    weights.set(action.productId, (weights.get(action.productId) ?? 0) + actionWeight(action.action));
  const ranked = products.map((product) => ({ product, score: seeds.reduce((sum, seed) => sum + similarity(seed, product) * Math.min(10, weights.get(seed.id) ?? 0), 0) + (scores.get(product.id) ?? 0) })).sort((a, b) => b.score - a.score);
  res.json({ products: ranked.slice(0, limit(req.query.limit)).map((p) => p.product), strategy: seeds.length ? "content-based-personalized" : "cold-start-trending" });
});

// apps/recommendation-service/src/main.ts
var path = __toESM(require("path"));
var app = (0, import_express.default)();
app.use((0, import_cookie_parser.default)());
app.get("/api/recommendations/:userId", isAuthenticated_default, isUser, personalized);
app.get("/api/similar-products/:productId", similar);
app.get("/api/trending-products", trending);
app.use("/assets", import_express.default.static(path.join(__dirname, "assets")));
app.get("/api", (req, res) => {
  res.send({ message: "Welcome to recommendation-service!" });
});
app.use(errorMiddleware);
var port = process.env.PORT || process.env.RECOMMENDATION_PORT || 6008;
var server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
//# sourceMappingURL=main.js.map
