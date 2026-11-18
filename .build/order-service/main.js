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

// apps/order-service/src/main.ts
var import_config = require("dotenv/config");
var import_cors = __toESM(require("cors"));
var import_express2 = __toESM(require("express"));
var import_cookie_parser = __toESM(require("cookie-parser"));
var import_body_parser = __toESM(require("body-parser"));

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
  owner: ["overview", "catalog", "accounts", "notifications", "settings", "team"],
  operations: ["overview", "catalog", "accounts", "notifications"],
  support: ["catalog", "accounts", "notifications"],
  finance: ["overview"]
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

// apps/order-service/src/routes/order.route.ts
var import_express = __toESM(require("express"));

// packages/utils/api.ts
var handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
function objectId(value) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new ValidationError("Invalid ID");
  return value;
}
function textField(value, name, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ValidationError(`Invalid ${name}`);
  return value.trim();
}
function pageArgs(query) {
  const rawPage = Number(query.page);
  const rawLimit = Number(query.limit);
  const page = Number.isFinite(rawPage) ? Math.min(1e6, Math.max(1, rawPage || 1)) : 1;
  const take = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit || 20)) : 20;
  return { skip: (Math.floor(page) - 1) * Math.floor(take), take: Math.floor(take) };
}

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

// packages/utils/cart.ts
function cartLineKey(item) {
  return JSON.stringify([item.id, item.selectedOptions?.color || "", item.selectedOptions?.size || ""]);
}

// packages/utils/money.ts
var STORE_CURRENCY = "usd";
function usdCents(amount) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents))
    throw new Error("Invalid USD amount");
  return cents;
}

// apps/order-service/src/routes/checkout-quote.ts
async function trustedCartItems(cart) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 100)
    throw new ValidationError("Provide 1\u2013100 cart items");
  const requested = cart.map((item) => {
    if (!item || typeof item.id !== "string" || !/^[a-f\d]{24}$/i.test(item.id) || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1e4)
      throw new ValidationError("Invalid cart item");
    const options = item.selectedOptions || {};
    if (["color", "size"].some((key) => options[key] !== void 0 && (typeof options[key] !== "string" || options[key].length > 200)))
      throw new ValidationError("Invalid product options");
    if (item.variantId != null && (typeof item.variantId !== "string" || !/^[a-f\d]{24}$/i.test(item.variantId)))
      throw new ValidationError("Invalid variant ID");
    return { id: item.id, quantity: item.quantity, variantId: item.variantId || null, selectedOptions: { color: options.color || "", size: options.size || "" } };
  });
  const products = await prisma_default.products.findMany({ where: { id: { in: [...new Set(requested.map((item) => item.id))] }, isDeleted: false, status: "Active" }, include: { images: true, variants: true, shop: { select: { sellers: { select: { suspendedAt: true, suspendedUntil: true } } } } } });
  const productById = new Map(products.map((product) => [product.id, product]));
  const totals = /* @__PURE__ */ new Map();
  const keys = /* @__PURE__ */ new Set();
  return requested.map((item) => {
    const product = productById.get(item.id);
    if (!product || product.shop?.sellers && isSuspended(product.shop.sellers))
      throw new ValidationError("A product or seller is unavailable");
    const variants = product.variants || [];
    const variant = variants.find((v) => item.variantId ? v.id === item.variantId : v.color === item.selectedOptions.color && v.size === item.selectedOptions.size);
    if (variants.length && (!variant || !variant.active))
      throw new ValidationError(`Choose an available variant for ${product.title}`);
    if (!variants.length && item.variantId)
      throw new ValidationError("Variant does not belong to this product");
    if (!variants.length && (item.selectedOptions.color && !product.colors.includes(item.selectedOptions.color) || item.selectedOptions.size && !product.sizes.includes(item.selectedOptions.size)))
      throw new ValidationError("Invalid product variant");
    if (!variants.length && (product.colors.length && !item.selectedOptions.color || product.sizes.length && !item.selectedOptions.size))
      throw new ValidationError(`Choose options for ${product.title}`);
    const trusted = { ...item, variantId: variant?.id || null, sku: variant?.sku || null, selectedOptions: variant ? { color: variant.color, size: variant.size } : item.selectedOptions, sale_price: (variant ? usdCents(variant.price) : usdCents(product.sale_price)) / 100, title: product.title, shopId: product.shopId, image: product.images[0]?.url || null, discount_codes: product.discount_codes };
    const key = cartLineKey(trusted);
    if (keys.has(key))
      throw new ValidationError("Cart contains duplicate variants");
    keys.add(key);
    const total = (totals.get(item.id) || 0) + item.quantity;
    totals.set(item.id, total);
    if (total > product.stock || variant && item.quantity > variant.stock)
      throw new ValidationError(`${product.title} is out of stock`);
    return trusted;
  });
}
async function trustedDiscount(cart, code) {
  if (!code)
    return null;
  if (typeof code !== "string" || code.length > 100)
    throw new ValidationError("Invalid coupon");
  const record = await prisma_default.discountCodes.findFirst({ where: { discountCode: code } });
  if (!record)
    throw new ValidationError("Coupon no longer exists");
  const eligible = cart.find((item) => item.discount_codes.includes(record.id));
  if (!eligible)
    throw new ValidationError("Coupon does not apply to these products");
  if (!["percentage", "fixed", "flat"].includes(record.discountType) || !Number.isFinite(record.discountValue) || record.discountValue < 0)
    throw new ValidationError("Invalid coupon amount");
  const price = usdCents(eligible.sale_price) * eligible.quantity;
  const discount = Math.min(price, record.discountType === "percentage" ? Math.round(price * record.discountValue / 100) : usdCents(record.discountValue));
  return { id: record.id, code, discountAmount: discount / 100, discountedProductId: eligible.id, discountedLineKey: cartLineKey(eligible), discountType: record.discountType, discountValue: record.discountValue };
}
function shippingQuote(shopIds) {
  const perShop = Number(process.env.SHIPPING_FEE_USD ?? "0");
  if (!Number.isFinite(perShop) || perShop < 0)
    throw new ValidationError("Shipping configuration is invalid");
  const cents = usdCents(perShop);
  return Object.fromEntries([...new Set(shopIds)].map((id) => [id, cents / 100]));
}

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

// apps/order-service/src/routes/order.controller.ts
var import_crypto2 = __toESM(require("crypto"));
var import_stripe2 = __toESM(require("stripe"));

// packages/libs/redis/index.ts
var import_ioredis = __toESM(require("ioredis"));
var redis = new import_ioredis.default(process.env.REDIS_DATABASE_URL || process.env.REDIS_DATEBASE_URL || "redis://localhost:6379");
var redis_default = redis;

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

// packages/utils/logs/send-logs.ts
var LOG_TOPIC = "log-events";
async function sendLog(event) {
  const producer = kafka.producer();
  let connected = false;
  try {
    await producer.connect();
    connected = true;
    const payload = {
      ...event,
      timestamp: event.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
    };
    const result = await producer.send({
      topic: LOG_TOPIC,
      messages: [{ value: JSON.stringify(payload) }]
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

// packages/utils/logs/behavior-log.ts
var BEHAVIOR_LABELS = {
  userLogin: "User Login",
  userRegistration: "User Registration",
  userLogout: "User Logout",
  passwordChange: "Password Change",
  passwordReset: "Password Reset",
  productView: "Product View",
  productSearch: "Product Search",
  productFilter: "Product Filter",
  addToCart: "Add to Cart",
  addToWishlist: "Add to Wishlist",
  orderCreated: "Order Created",
  orderCancelled: "Order Cancelled",
  paymentAttempt: "Payment Attempt",
  paymentSuccess: "Payment Success",
  paymentFailed: "Payment Failed",
  couponUsed: "Coupon Used",
  sellerLogin: "Seller Login",
  sellerRegistration: "Seller Registration",
  shopCreated: "Shop Created",
  productCreated: "Product Created",
  productDeleted: "Product Deleted",
  orderStatusChange: "Order Status Change",
  apiErrors: "API Errors",
  rateLimitHit: "Rate Limit Hit",
  webhookEvents: "Webhook Events"
};
var LOG_CONFIG_CACHE_KEY = "logging:behavior-config";
var CACHE_TTL_SECONDS = 60;
async function getLogConfig() {
  try {
    const cachedConfig = await redis_default.get(LOG_CONFIG_CACHE_KEY);
    if (cachedConfig) {
      return JSON.parse(cachedConfig);
    }
  } catch (error) {
    console.error("[behavior-log] Failed to read shared config cache:", error);
  }
  try {
    let config = await prisma_default.log_config.findFirst();
    if (!config) {
      config = await prisma_default.log_config.create({ data: {} });
    }
    const mapped = {
      userLogin: config.userLogin,
      userRegistration: config.userRegistration,
      userLogout: config.userLogout,
      passwordChange: config.passwordChange,
      passwordReset: config.passwordReset,
      productView: config.productView,
      productSearch: config.productSearch,
      productFilter: config.productFilter,
      addToCart: config.addToCart,
      addToWishlist: config.addToWishlist,
      orderCreated: config.orderCreated,
      orderCancelled: config.orderCancelled,
      paymentAttempt: config.paymentAttempt,
      paymentSuccess: config.paymentSuccess,
      paymentFailed: config.paymentFailed,
      couponUsed: config.couponUsed,
      sellerLogin: config.sellerLogin,
      sellerRegistration: config.sellerRegistration,
      shopCreated: config.shopCreated,
      productCreated: config.productCreated,
      productDeleted: config.productDeleted,
      orderStatusChange: config.orderStatusChange,
      apiErrors: config.apiErrors,
      rateLimitHit: config.rateLimitHit,
      webhookEvents: config.webhookEvents
    };
    try {
      await redis_default.set(
        LOG_CONFIG_CACHE_KEY,
        JSON.stringify(mapped),
        "EX",
        CACHE_TTL_SECONDS
      );
    } catch (error) {
      console.error("[behavior-log] Failed to update shared config cache:", error);
    }
    return mapped;
  } catch (error) {
    console.error("[behavior-log] Failed to load log config:", error);
    return Object.fromEntries(
      Object.keys(BEHAVIOR_LABELS).map((k) => [k, true])
    );
  }
}
async function sendBehaviorLog(action, event) {
  try {
    const config = await getLogConfig();
    if (!config[action]) {
      return;
    }
    const enrichedEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        behaviorAction: action,
        behaviorLabel: BEHAVIOR_LABELS[action]
      }
    };
    await sendLog(enrichedEvent);
  } catch (error) {
    console.error(`[behavior-log] Failed to send ${action} log:`, error);
  }
}

// packages/utils/order-refund.ts
function validateOrderRefund(order, refund, expectedId = order.stripeRefundId || null) {
  const paymentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (paymentId !== order.stripePaymentId || refund.metadata?.orderId !== order.id || refund.amount !== usdCents(order.totalAmount) || refund.currency !== (order.currency || STORE_CURRENCY) || expectedId && expectedId !== refund.id) {
    throw new ValidationError("Refund does not match this order. Review its payment, amount and currency.");
  }
}
var failedOrderRefund = (refund) => refund.status === "failed" || refund.status === "canceled";
async function orderRefundRelation(order, refund, retrieve) {
  validateOrderRefund(order, refund, null);
  if (order.stripeRefundId === refund.id)
    return "current";
  const descendsFrom = async (attempt, ancestor) => {
    const seen = /* @__PURE__ */ new Set([attempt.id]);
    for (let depth = 0; depth < 50; depth++) {
      const parentId = attempt.metadata?.previousRefundId;
      if (!parentId)
        return ancestor === null;
      if (seen.has(parentId))
        throw new ValidationError("Invalid refund retry history.");
      seen.add(parentId);
      const parent = await retrieve(parentId);
      validateOrderRefund(order, parent, parentId);
      if (!failedOrderRefund(parent))
        throw new ValidationError("Only failed or canceled refunds can be retried.");
      if (parent.id === ancestor)
        return true;
      attempt = parent;
    }
    throw new ValidationError("Refund retry history requires review.");
  };
  if (await descendsFrom(refund, order.stripeRefundId || null))
    return order.stripeRefundId ? "replacement" : "current";
  const head = await retrieve(order.stripeRefundId);
  validateOrderRefund(order, head);
  if (await descendsFrom(head, refund.id))
    return "stale";
  throw new ValidationError("Refund does not match the current order refund.");
}

// apps/order-service/src/routes/payment-webhook.controller.ts
var import_stripe = __toESM(require("stripe"));
var import_crypto = __toESM(require("crypto"));

// apps/order-service/src/utils/send-email/index.ts
var import_nodemailer = __toESM(require("nodemailer"));
var import_dotenv = __toESM(require("dotenv"));
var import_ejs = __toESM(require("ejs"));
var import_path = __toESM(require("path"));
import_dotenv.default.config();
var transporter = import_nodemailer.default.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
var renderEmailTemplate = async (templateName, data) => {
  const templatePath = import_path.default.join(
    process.cwd(),
    "apps",
    "order-service",
    "src",
    "utils",
    "send-email",
    "email-templates",
    `${templateName}.ejs`
  );
  return import_ejs.default.renderFile(templatePath, data);
};
var sendEmail = async (to, subject, templateName, data) => {
  if (/@[^@]+\.invalid$/i.test(to))
    return false;
  try {
    const html = await renderEmailTemplate(templateName, data);
    await transporter.sendMail({
      from: `<${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });
    return true;
  } catch (error) {
    console.log("Error sending email: ", error);
    return false;
  }
};

// apps/order-service/src/routes/payment-webhook.controller.ts
async function paymentWebhook(req, res) {
  const stripe2 = new import_stripe.default(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe2.webhooks.constructEvent(req.rawBody, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    res.status(400).json({ message: "Invalid webhook signature" });
    return;
  }
  try {
    if (["refund.updated", "refund.created", "refund.failed"].includes(event.type)) {
      const refund = event.data.object;
      if (refund.metadata?.orderId)
        await transaction(async (tx) => {
          const order = await tx.orders.findFirst({ where: { id: refund.metadata.orderId, stripePaymentId: typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id } });
          if (!order || order.paymentStatus === "Refunded")
            return;
          if (await orderRefundRelation(order, refund, (id) => stripe2.refunds.retrieve(id)) === "stale")
            return;
          if (order.stripeRefundId === refund.id && ["failed", "canceled"].includes(order.refundState || "") && refund.status !== "succeeded")
            return;
          await tx.orders.update({ where: { id: order.id }, data: { stripeRefundId: refund.id, refundState: refund.status, ...refund.status === "succeeded" ? { paymentStatus: "Refunded", status: "Refunded" } : {} } });
          if (refund.status === "succeeded")
            await tx.notifications.create({ data: { userId: order.userId, orderId: order.id, type: "OrderRefunded", title: "Order refunded", message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${order.id}` } });
        });
      res.json({ received: true });
      return;
    }
    if (event.type !== "payment_intent.succeeded") {
      res.json({ received: true });
      return;
    }
    const payment = event.data.object;
    if (await prisma_default.paymentReceipt.findUnique({ where: { id: payment.id } })) {
      res.json({ received: true, duplicate: true });
      return;
    }
    await fulfillPayment(payment);
    res.json({ received: true });
  } catch (error) {
    console.error("Payment fulfillment failed", error instanceof Error ? error.message : "Unknown error");
    res.status(503).json({ message: "Payment processing failed; retry required" });
  }
}
async function fulfillPayment(payment, sendConfirmation = true) {
  if (payment.status !== "succeeded")
    throw new Error("Payment has not succeeded");
  if (await prisma_default.paymentReceipt.findUnique({ where: { id: payment.id } }))
    return;
  const session = await prisma_default.paymentSession.findUnique({ where: { id: payment.metadata.sessionId || "" } });
  if (!session)
    throw new Error("Payment session unavailable; retry required");
  const payload = session.payload;
  if (session.userId !== payment.metadata.userId || payment.amount_received !== usdCents(payload.totalAmount) || payment.currency !== (payload.currency || STORE_CURRENCY) || payload.paymentIntentId && payload.paymentIntentId !== payment.id)
    throw new Error("Payment does not match checkout session");
  const ids = await transaction(async (tx) => {
    const receipt = await tx.paymentReceipt.findUnique({ where: { id: payment.id } });
    if (receipt)
      return null;
    const current = await tx.paymentSession.findUniqueOrThrow({ where: { id: session.id } });
    const currentPayload = current.payload;
    if (currentPayload.paymentIntentId && currentPayload.paymentIntentId !== payment.id || currentPayload.fulfilledPaymentIntentId && currentPayload.fulfilledPaymentIntentId !== payment.id || await tx.paymentReceipt.findFirst({ where: { sessionId: session.id } })) {
      throw new Error("Checkout already belongs to another payment; review required");
    }
    await tx.paymentSession.update({ where: { id: session.id }, data: { payload: { ...currentPayload, fulfilledPaymentIntentId: payment.id } } });
    await tx.paymentReceipt.create({ data: { id: payment.id, sessionId: session.id, userId: session.userId, orderIds: [] } });
    const grouped = /* @__PURE__ */ new Map();
    for (const item of payload.cart)
      grouped.set(item.shopId, [...grouped.get(item.shopId) || [], item]);
    const orderIds = [];
    for (const [shopId, items] of grouped) {
      const shop = await tx.shops.findUniqueOrThrow({ where: { id: shopId } });
      const subTotal = items.reduce((sum, item) => sum + Math.round(item.sale_price * 100) * item.quantity, 0) / 100;
      const coupon = payload.coupon;
      const discount = coupon && items.some((item) => item.id === coupon.discountedProductId) ? coupon.discountAmount : 0;
      const shippingFee = payload.shippingByShop?.[shopId] || 0;
      const order = await tx.orders.create({ data: { orderNumber: `ORD-${Date.now()}-${import_crypto.default.randomBytes(4).toString("hex").toUpperCase()}`, userId: session.userId, shopId, subTotal, discount, shippingFee, currency: payload.currency || STORE_CURRENCY, discountCodeId: discount ? coupon.id : null, totalAmount: (usdCents(subTotal) - usdCents(discount) + usdCents(shippingFee)) / 100, paymentStatus: "Paid", paymentMethod: "card", stripePaymentId: payment.id, platformFeeCents: grouped.size === 1 && typeof payment.application_fee_amount === "number" ? payment.application_fee_amount : null, shippingAddress: payload.shippingAddress, items: { create: items.map((item) => ({ productId: item.id, variantId: item.variantId || null, sku: item.sku || null, title: item.title, image: item.image, color: item.selectedOptions?.color || null, size: item.selectedOptions?.size || null, quantity: item.quantity, unitPrice: item.sale_price, totalPrice: Math.round(item.sale_price * 100) * item.quantity / 100 })) } } });
      orderIds.push(order.id);
      await tx.orderEvent.create({ data: { orderId: order.id, actorId: session.userId, from: "Checkout", to: "Pending" } });
      for (const item of items) {
        if (item.variantId) {
          const changedVariant = await tx.productVariant.updateMany({ where: { id: item.variantId, productId: item.id, active: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
          if (!changedVariant.count)
            throw new Error("Paid variant is no longer available; fulfillment requires intervention");
        }
        const changed = await tx.products.updateMany({ where: { id: item.id, stock: { gte: item.quantity }, isDeleted: false, status: "Active" }, data: { stock: { decrement: item.quantity }, totalSales: { increment: item.quantity } } });
        if (!changed.count)
          throw new Error("Paid product is no longer available; fulfillment requires intervention");
        const product = await tx.products.findUniqueOrThrow({ where: { id: item.id } });
        await tx.inventoryHistory.create({ data: { productId: item.id, shopId, delta: -item.quantity, stockAfter: product.stock, reason: `Purchase ${order.orderNumber}`, actorId: session.userId } });
        if (product.stock < 5 && product.stock + item.quantity >= 5)
          await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId: order.id, type: "LowStock", title: "Low stock", message: `${product.title}: ${product.stock} remaining`, redirectUrl: "/dashboard/inventory" } });
        await tx.productAnalytics.upsert({ where: { productId: item.id }, create: { productId: item.id, shopId, purchases: item.quantity, lastViewedAt: /* @__PURE__ */ new Date() }, update: { purchases: { increment: item.quantity } } });
      }
      await tx.notifications.createMany({ data: [{ sellerId: shop.sellerId, orderId: order.id, type: "NewOrder", title: "New order", message: `${order.orderNumber} is ready to process.`, redirectUrl: "/dashboard/orders" }, { userId: session.userId, orderId: order.id, type: "NewOrder", title: "Order received", message: `${order.orderNumber} has been paid.`, redirectUrl: `/order/${order.id}` }] });
    }
    const analytics = await tx.userAnalytics.findUnique({ where: { userId: session.userId } });
    const actions = [...analytics?.actions || [], ...payload.cart.map((item) => ({ productId: item.id, shopId: item.shopId, action: "purchase", timestamp: (/* @__PURE__ */ new Date()).toISOString() }))].slice(-100);
    await tx.userAnalytics.upsert({ where: { userId: session.userId }, create: { userId: session.userId, actions, lastVisited: /* @__PURE__ */ new Date() }, update: { actions, lastVisited: /* @__PURE__ */ new Date() } });
    await tx.paymentReceipt.update({ where: { id: payment.id }, data: { orderIds } });
    return orderIds;
  }, { timeout: 3e4 });
  if (!ids)
    return;
  await sendBehaviorLog("paymentSuccess", { type: "success", source: "order-service", message: "Payment completed", metadata: { userId: session.userId, paymentIntentId: payment.id, orderIds: ids, amount: payload.totalAmount } });
  const user = await prisma_default.users.findUnique({ where: { id: session.userId }, select: { email: true, name: true } });
  if (user && sendConfirmation)
    await sendEmail(user.email, "Your Eshop order confirmation", "order.confirmation", { name: user.name, cart: payload.cart, totalAmount: payload.totalAmount, trackingUrl: `${process.env.USER_UI_URL || "http://localhost:3000"}/order/${ids[0]}` });
}

// packages/utils/admin-audit.ts
function audit(tx, actorId, action, targetId, reason, before, after) {
  const json = (value) => JSON.parse(JSON.stringify(value ?? {}));
  return tx.adminAudit.create({ data: { actorId, action, targetId, reason, before: json(before), after: json(after) } });
}

// packages/utils/order-lifecycle.ts
var import_client2 = require("@prisma/client");

// packages/utils/order-status.ts
var transitions = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Returned: [],
  Cancelled: [],
  Refunded: []
};

// packages/utils/order-lifecycle.ts
async function transitionOrder(id, status, scope, actorId, input = {}, adminAction = false) {
  if (!Object.values(import_client2.orderStatus).includes(status))
    throw new ValidationError("Invalid order status");
  return transaction(async (tx) => {
    const order = await tx.orders.findFirst({ where: { ...scope, id }, include: { items: true } });
    if (!order)
      throw new NotFoundError();
    if (["Confirmed", "Processing", "Shipped"].includes(status)) {
      const blocked = order.moderationHold || await tx.products.count({ where: { id: { in: order.items.map((item) => item.productId) }, status: "Suspended" } });
      if (blocked)
        throw new ValidationError("This order requires product violation review; fulfillment is blocked");
    }
    if (order.status === status)
      return order;
    if (!transitions[order.status]?.includes(status))
      throw new ValidationError(`Cannot change ${order.status} to ${status}`);
    const data = { status };
    if (input.trackingNumber !== void 0) {
      if (typeof input.trackingNumber !== "string" || input.trackingNumber.length > 120)
        throw new ValidationError("Invalid tracking number");
      data.trackingNumber = input.trackingNumber;
    }
    if (input.estimatedDelivery) {
      const date = new Date(input.estimatedDelivery);
      if (!Number.isFinite(date.getTime()))
        throw new ValidationError("Invalid delivery date");
      data.estimatedDelivery = date;
    }
    if (status === "Delivered")
      data.deliveredAt = /* @__PURE__ */ new Date();
    if (status === "Cancelled") {
      data.cancelledAt = /* @__PURE__ */ new Date();
      data.cancelReason = typeof input.reason === "string" ? input.reason.slice(0, 1e3) : "Cancelled by request";
      for (const item of order.items) {
        const variant = item.variantId ? await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } }) : null;
        const unassignedSku = !item.variantId && await tx.productVariant.count({ where: { productId: item.productId } }) > 0;
        const stockDelta = unassignedSku || variant && !variant.active ? 0 : item.quantity;
        const product = await tx.products.update({ where: { id: item.productId }, data: { stock: { increment: stockDelta }, totalSales: { decrement: item.quantity } } });
        await tx.inventoryHistory.create({ data: { productId: product.id, shopId: order.shopId, delta: stockDelta, stockAfter: product.stock, reason: `Cancellation ${order.orderNumber}${unassignedSku ? ": legacy item requires manual SKU allocation" : ""}`, actorId } });
        if (unassignedSku) {
          const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
          await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId: id, type: "System", title: "Inventory allocation required", message: `${order.orderNumber}: allocate ${item.quantity} returned ${product.title} units to the correct SKU. This older order did not record a SKU.`, redirectUrl: "/dashboard/inventory" } });
        }
      }
    }
    const updated = await tx.orders.update({ where: { id, status: order.status }, data, include: { items: true, shop: { select: { name: true } }, user: { select: { name: true, email: true } } } });
    await tx.orderEvent.create({ data: { orderId: id, actorId, from: order.status, to: status, reason: typeof input.reason === "string" ? input.reason.slice(0, 1e3) : null } });
    if (adminAction)
      await audit(tx, actorId, "order.status", id, input.reason, { status: order.status }, { status });
    const type = { Confirmed: "OrderConfirmed", Shipped: "OrderShipped", Delivered: "OrderDelivered", Cancelled: "OrderCancelled" }[status] ?? "System";
    await tx.notifications.create({ data: { userId: order.userId, orderId: id, type, title: `Order ${status.toLowerCase()}`, message: `${order.orderNumber}: ${status}${status === "Cancelled" && order.paymentStatus === "Paid" ? ". Your payment refund is awaiting processing." : ""}`, redirectUrl: `/order/${id}` } });
    return updated;
  });
}

// apps/order-service/src/routes/order-management.controller.ts
var cancelOrder = handle(async (req, res) => {
  const order = await transitionOrder(objectId(req.params.orderId), "Cancelled", { userId: req.user.id, status: "Pending" }, req.user.id, req.body);
  res.json({ order });
});
var sellerOrderStatus = handle(async (req, res) => {
  if (!req.seller.shop?.id)
    throw new ForbiddenError();
  if (isSuspended(req.seller) && !["Cancelled", "Delivered"].includes(req.body.status))
    throw new ForbiddenError("Suspended sellers can only remedy existing orders");
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, { shopId: req.seller.shop.id }, req.seller.id, req.body);
  res.json(order);
});

// apps/order-service/src/routes/order.controller.ts
var stripe = new import_stripe2.default(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia"
});
var createPaymentIntent = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (typeof sessionId !== "string" || !sessionId) {
      return next(new ValidationError("Payment session is required."));
    }
    const savedSession = await prisma_default.paymentSession.findUnique({ where: { id: sessionId } });
    if (!savedSession || savedSession.expiresAt.getTime() <= Date.now()) {
      return next(new ValidationError("Payment session has expired."));
    }
    const session = savedSession.payload;
    if (savedSession.userId !== req.user.id) {
      return next(
        new ValidationError("Payment session does not belong to you.")
      );
    }
    if (await prisma_default.paymentReceipt.findFirst({ where: { sessionId } }))
      throw new ValidationError("This checkout has already been paid.");
    const customerAmount = usdCents(session.totalAmount);
    if (!Number.isSafeInteger(customerAmount) || customerAmount <= 0) {
      return next(new ValidationError("Payment amount is invalid."));
    }
    const platformFee = Math.floor(customerAmount * 0.1);
    const intentData = {
      amount: customerAmount,
      currency: STORE_CURRENCY,
      payment_method_types: ["card"],
      metadata: {
        sessionId,
        userId: req.user.id
      }
    };
    const sellerAccountIds = session.seller.map((seller) => seller.stripeAccountId).filter(
      (accountId) => Boolean(accountId?.startsWith("acct_"))
    );
    if (sellerAccountIds.length === 1 && session.seller.length === 1) {
      intentData.application_fee_amount = platformFee;
      intentData.transfer_data = { destination: sellerAccountIds[0] };
    }
    const paymentIntent = await stripe.paymentIntents.create(intentData, { idempotencyKey: `checkout-${sessionId}` });
    await transaction(async (tx) => {
      const current = await tx.paymentSession.findUniqueOrThrow({ where: { id: sessionId } });
      const payload = current.payload;
      if (payload.paymentIntentId && payload.paymentIntentId !== paymentIntent.id)
        throw new ValidationError("Payment session already has a different payment.");
      await tx.paymentSession.update({ where: { id: sessionId }, data: { payload: { ...payload, paymentIntentId: paymentIntent.id } } });
    });
    await sendBehaviorLog("paymentAttempt", {
      type: "info",
      source: "order-service",
      message: "Payment attempt created",
      metadata: {
        userId: req.user.id,
        paymentIntentId: paymentIntent.id,
        amount: customerAmount / 100
      }
    });
    res.send({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    return next(error);
  }
};
var createPaymentSession = async (req, res, next) => {
  try {
    const { cart, selectedAddressId, coupon } = req.body;
    const userId = req.user.id;
    const trustedCart = await trustedCartItems(cart);
    let shippingAddress;
    if (!selectedAddressId)
      return next(new ValidationError("Choose a shipping address."));
    if (selectedAddressId) {
      const address = await prisma_default.address.findFirst({
        where: { id: selectedAddressId, userId },
        select: { id: true, name: true, street: true, city: true, zip: true, country: true, label: true }
      });
      shippingAddress = address;
      if (!address) {
        return next(new ValidationError("Shipping address is invalid."));
      }
    }
    const uniqueShopIds = [
      ...new Set(trustedCart.map((item) => item.shopId))
    ];
    const shops = await prisma_default.shops.findMany({
      where: {
        id: {
          in: uniqueShopIds
        }
      },
      select: {
        id: true,
        sellerId: true,
        sellers: {
          select: {
            stripe_id: true
          }
        }
      }
    });
    const sellerData = shops.map((shop) => ({
      shopId: shop.id,
      sellerId: shop.sellerId,
      stripeAccountId: shop?.sellers?.stripe_id
    }));
    const subTotal = trustedCart.reduce((sum, item) => sum + usdCents(item.sale_price) * item.quantity, 0) / 100;
    const trustedCoupon = await trustedDiscount(trustedCart, coupon?.code || coupon?.couponCode || coupon?.discountCode);
    const shippingByShop = shippingQuote(uniqueShopIds);
    const shippingFee = Object.values(shippingByShop).reduce((sum, fee) => sum + usdCents(fee), 0) / 100;
    const totalAmount = (usdCents(subTotal) - usdCents(trustedCoupon?.discountAmount || 0) + usdCents(shippingFee)) / 100;
    if (totalAmount <= 0)
      throw new ValidationError("Order total must be positive");
    const sessionId = import_crypto2.default.randomUUID();
    const sessionData = {
      userId,
      cart: trustedCart,
      seller: sellerData,
      totalAmount,
      subTotal,
      shippingFee,
      shippingByShop,
      currency: STORE_CURRENCY,
      shippingAddressId: selectedAddressId || null,
      coupon: trustedCoupon,
      shippingAddress
    };
    await prisma_default.paymentSession.create({ data: { id: sessionId, userId, payload: sessionData, expiresAt: new Date(Date.now() + 6e5) } });
    return res.status(200).json({ sessionId });
  } catch (error) {
    return next(error);
  }
};
var verifyPaymentSession = async (req, res, next) => {
  try {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
      return res.status(404).json({ error: "Session ID is required!" });
    }
    const savedSession = await prisma_default.paymentSession.findUnique({ where: { id: sessionId } });
    if (!savedSession || savedSession.expiresAt.getTime() <= Date.now()) {
      return res.status(404).json({ error: "Session not found!" });
    }
    const session = savedSession.payload;
    if (savedSession.userId !== req.user.id)
      return res.status(403).json({ message: "Session does not belong to you" });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      session
    });
  } catch (error) {
    return next(error);
  }
};
var getSellerOrders = async (req, res, next) => {
  try {
    const shop = await prisma_default.shops.findUnique({
      where: {
        sellerId: req.seller.id
      }
    });
    if (!shop)
      throw new NotFoundError("Seller shop not found");
    const orders = await prisma_default.orders.findMany({
      where: {
        shopId: shop?.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};
var getUserOrders = async (req, res, next) => {
  try {
    const orders = await prisma_default.orders.findMany({
      where: { userId: req.user.id },
      include: {
        shop: {
          select: { id: true, name: true }
        },
        items: true
      },
      orderBy: { createdAt: "desc" }
    });
    return res.status(200).json(orders);
  } catch (error) {
    return next(error);
  }
};
var getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!orderId || typeof orderId !== "string") {
      return next(new ValidationError("Order ID is required."));
    }
    const order = await prisma_default.orders.findFirst({
      where: { id: orderId, userId: req.user.id },
      include: {
        shop: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              select: { id: true, title: true, images: true }
            }
          }
        }
      }
    });
    if (!order) {
      return next(new NotFoundError("Order not found."));
    }
    return res.status(200).json({ order });
  } catch (error) {
    return next(error);
  }
};
var verifyConponCode = async (req, res, next) => {
  try {
    const { couponCode, cart } = req.body;
    if (!couponCode)
      throw new ValidationError("Coupon code is required");
    const items = await trustedCartItems(cart);
    const discount = await trustedDiscount(items, couponCode);
    res.json({ valid: true, discount: discount.discountValue, discountAmount: discount.discountAmount, discountProductId: discount.discountedProductId, discountLineKey: discount.discountedLineKey, discountType: discount.discountType });
  } catch (error) {
    return next(error);
  }
};
var getAdminOrders = async (req, res, next) => {
  try {
    const orders = await prisma_default.orders.findMany({
      ...pageArgs(req.query),
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true } },
        items: true
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    next(error);
  }
};

// packages/middleware/isAuthenticated.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// packages/utils/seller-remediation-access.ts
function sellerRemediationRequest(path2, method) {
  const route = path2.replace(/^\/api(?=\/)/, "");
  if (method === "GET")
    return ["/logged-in-seller", "/get-seller-orders", "/seller-payments", "/seller-violations", "/seller-moderation-tasks", "/get-seller-notifications"].includes(route) || /^\/seller-aftercare\/[a-f\d]{24}$/i.test(route);
  if (method === "PATCH")
    return /^\/(?:seller-moderation-tasks|update-order-status|returns|notifications)\/[a-f\d]{24}(?:\/read)?$/i.test(route) || route === "/notifications/read-all";
  return method === "POST" && /^\/seller-refund\/[a-f\d]{24}$/i.test(route);
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
    if (isSuspended(account) && !(decoded.role === "seller" && sellerRemediationRequest(req.path, req.method))) {
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
var isSeller = (req, res, next) => {
  if (req.role !== "seller") {
    return next(new AuthError("Access denied: Seller only"));
  }
  next();
};
var isUser = (req, res, next) => {
  if (req.role !== "user") {
    return next(new AuthError("Access denied: User only"));
  }
  next();
};
var isAdmin = (req, res, next) => {
  if (req.role !== "admin") {
    return next(new AuthError("Access denied: Admin only"));
  }
  next();
};

// apps/order-service/src/routes/seller-payments.controller.ts
var import_client3 = require("@prisma/client");
var getSellerPayments = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId)
    throw new ForbiddenError("Create a shop to view payments");
  const where = { shopId };
  if (req.query.month) {
    const month = String(req.query.month);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1e3) {
      throw new ValidationError("Choose a valid month");
    }
    const from = /* @__PURE__ */ new Date(`${month}-01T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);
    where.createdAt = { gte: from, lt: to };
  }
  if (req.query.status) {
    if (!Object.values(import_client3.paymentStatus).includes(req.query.status))
      throw new ValidationError("Invalid payment status");
    where.paymentStatus = req.query.status;
  }
  if (req.query.search) {
    if (typeof req.query.search !== "string" || req.query.search.length > 100)
      throw new ValidationError("Search must be at most 100 characters");
    const contains = req.query.search.trim();
    where.OR = [
      { orderNumber: { contains, mode: "insensitive" } },
      { stripePaymentId: { contains, mode: "insensitive" } }
    ];
  }
  const { skip, take } = pageArgs(req.query);
  const [payments, total, groups] = await Promise.all([
    prisma_default.orders.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        orderNumber: true,
        totalAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        stripePaymentId: true,
        stripeRefundId: true,
        refundState: true,
        status: true,
        createdAt: true,
        user: { select: { name: true } }
      }
    }),
    prisma_default.orders.count({ where }),
    prisma_default.orders.groupBy({ by: ["paymentStatus"], where, _sum: { totalAmount: true }, _count: { _all: true } })
  ]);
  const summary = Object.fromEntries(Object.values(import_client3.paymentStatus).map((status) => {
    const group = groups.find((item) => item.paymentStatus === status);
    return [status, { amount: group?._sum.totalAmount ?? 0, count: group?._count._all ?? 0 }];
  }));
  res.json({ payments, summary, total, page: skip / take + 1, pageSize: take, totalPages: Math.ceil(total / take) });
});

// packages/utils/seller-order-refund.ts
var import_stripe3 = __toESM(require("stripe"));
async function refundSellerOrder(orderId, shopId, sellerId, reason) {
  const order = await prisma_default.orders.findUnique({ where: { id: orderId, shopId } });
  if (!order || !order.stripePaymentId)
    throw new NotFoundError("Payment/order not found");
  if (order.paymentStatus === "Refunded")
    return { success: true, refundId: order.stripeRefundId, status: "succeeded" };
  if (order.paymentStatus !== "Paid" || !["Cancelled", "Returned"].includes(order.status))
    throw new ValidationError("Cancel or return the paid order before refunding");
  const stripe2 = new import_stripe3.default(process.env.STRIPE_SECRET_KEY);
  const intent = await stripe2.paymentIntents.retrieve(order.stripePaymentId);
  const attempts = /* @__PURE__ */ new Map();
  if (order.stripeRefundId) {
    const saved2 = await stripe2.refunds.retrieve(order.stripeRefundId);
    validateOrderRefund(order, saved2);
    attempts.set(saved2.id, saved2);
  }
  for await (const candidate of stripe2.refunds.list({ payment_intent: order.stripePaymentId, limit: 100 })) {
    if (candidate.metadata?.orderId !== order.id)
      continue;
    validateOrderRefund(order, candidate, null);
    attempts.set(candidate.id, candidate);
  }
  const parents = new Set([...attempts.values()].map((attempt) => attempt.metadata?.previousRefundId).filter(Boolean));
  const latest = [...attempts.values()].filter((attempt) => !parents.has(attempt.id));
  if (latest.length > 1)
    throw new ValidationError("Multiple refund attempts require review.");
  const retrieve = async (id) => attempts.get(id) || stripe2.refunds.retrieve(id);
  const existing = latest[0];
  if (existing)
    await orderRefundRelation(order, existing, retrieve);
  const retry = existing && failedOrderRefund(existing);
  const result = existing && !retry ? existing : await stripe2.refunds.create({ payment_intent: order.stripePaymentId, amount: Math.round(order.totalAmount * 100), ...intent.transfer_data?.destination ? { reverse_transfer: true, refund_application_fee: true } : {}, metadata: { orderId, ...retry ? { previousRefundId: existing.id } : {} } }, { idempotencyKey: retry ? `order-refund-${order.id}-retry-${existing.id}` : `order-refund-${order.id}` });
  validateOrderRefund(order, result, null);
  const saved = await transaction(async (tx) => {
    const current = await tx.orders.findUnique({ where: { id: orderId, shopId } });
    if (!current)
      throw new NotFoundError("Payment/order not found");
    if (current.paymentStatus === "Refunded")
      return current;
    const relation = await orderRefundRelation(current, result, retrieve);
    if (relation === "stale" || current.stripeRefundId === result.id && (current.refundState === result.status || ["failed", "canceled"].includes(current.refundState || "") && result.status !== "succeeded"))
      return current;
    const updated = await tx.orders.updateMany({ where: { id: orderId, shopId, paymentStatus: "Paid" }, data: { stripeRefundId: result.id, refundState: result.status, ...result.status === "succeeded" ? { paymentStatus: "Refunded", status: "Refunded" } : {} } });
    if (updated.count)
      await audit(tx, sellerId, "seller.refund", orderId, reason, { paymentStatus: order.paymentStatus }, { refundId: result.id, status: result.status, amount: order.totalAmount });
    if (updated.count && result.status === "succeeded")
      await tx.notifications.create({ data: { userId: order.userId, orderId, type: "OrderRefunded", title: "Order refunded", message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${orderId}` } });
    return { ...current, stripeRefundId: result.id, refundState: result.status };
  });
  if (failedOrderRefund({ status: saved.refundState }))
    throw new ValidationError("Stripe refund failed. You can retry this refund.");
  return { success: true, refundId: saved.stripeRefundId, status: saved.refundState };
}

// apps/order-service/src/routes/seller-refund.controller.ts
var sellerRefund = handle(async (req, res) => {
  if (!req.seller?.shop?.id)
    throw new ForbiddenError();
  const result = await refundSellerOrder(objectId(req.params.orderId), req.seller.shop.id, req.seller.id, textField(req.body.reason, "refund reason", 1e3));
  res.json(result);
});

// apps/order-service/src/routes/customer-tools.controller.ts
var inspectCart = handle(async (req, res) => {
  const cart = req.body.cart;
  if (!Array.isArray(cart) || cart.length > 100)
    throw new ValidationError("Cart has too many items");
  for (const line of cart) {
    if (!line || typeof line !== "object")
      throw new ValidationError("Invalid item");
    objectId(line.id);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1e4)
      throw new ValidationError("Invalid quantity");
    if (line.variantId)
      objectId(line.variantId);
  }
  const products = await prisma_default.products.findMany({ where: { id: { in: cart.map((p) => p.id) }, status: "Active", isDeleted: false }, include: { images: true, variants: true, shop: { select: { name: true, sellers: { select: { suspendedAt: true, suspendedUntil: true } } } } } });
  const totals = /* @__PURE__ */ new Map();
  cart.forEach((p) => totals.set(p.id, (totals.get(p.id) || 0) + p.quantity));
  const keys = /* @__PURE__ */ new Set();
  const rows = cart.map((line) => {
    const key = cartLineKey(line);
    if (keys.has(key))
      throw new ValidationError("Duplicate cart line");
    keys.add(key);
    const p = products.find((p2) => p2.id === line.id);
    const unavailable = { key, id: line.id, available: false, reason: "S\u1EA3n ph\u1EA9m ho\u1EB7c bi\u1EBFn th\u1EC3 kh\xF4ng c\xF2n b\xE1n", maxQuantity: 0 };
    if (!p || isSuspended(p.shop.sellers))
      return unavailable;
    const options = line.selectedOptions || {};
    const variant = p.variants.find((v) => line.variantId ? v.id === line.variantId : v.color === (options.color || "") && v.size === (options.size || ""));
    if (p.variants.length && (!variant || !variant.active) || !p.variants.length && line.variantId)
      return unavailable;
    if (!p.variants.length && (p.colors.length && !p.colors.includes(options.color) || p.sizes.length && !p.sizes.includes(options.size) || options.color && !p.colors.includes(options.color) || options.size && !p.sizes.includes(options.size)))
      return unavailable;
    const maxQuantity = Math.max(0, Math.min(variant?.stock ?? p.stock, p.stock - ((totals.get(p.id) || 0) - line.quantity)));
    return { key, id: p.id, title: p.title, slug: p.slug, shopId: p.shopId, shopName: p.shop.name, images: p.images.map((i) => ({ url: i.url })), sale_price: variant?.price ?? p.sale_price, variantId: variant?.id ?? null, selectedOptions: variant ? { color: variant.color, size: variant.size } : options, stock: maxQuantity, maxQuantity, available: maxQuantity >= line.quantity, reason: maxQuantity < line.quantity ? `Ch\u1EC9 c\xF2n t\u1ED1i \u0111a ${maxQuantity} s\u1EA3n ph\u1EA9m cho l\u1EF1a ch\u1ECDn n\xE0y` : null };
  });
  res.json({ rows, shippingByShop: shippingQuote([...new Set(rows.flatMap((r) => "shopId" in r ? [r.shopId] : []))]) });
});
var orderStats = handle(async (req, res) => {
  const rows = await prisma_default.orders.groupBy({ by: ["status"], where: { userId: req.user.id }, _count: { _all: true } });
  res.json({ total: rows.reduce((n, r) => n + r._count._all, 0), processing: rows.filter((r) => ["Pending", "Confirmed", "Processing", "Shipped"].includes(r.status)).reduce((n, r) => n + r._count._all, 0), completed: rows.find((r) => r.status === "Delivered")?._count._all ?? 0 });
});
var customerOrders = handle(async (req, res) => {
  const where = { userId: req.user.id };
  if (req.query.status) {
    if (!["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded"].includes(String(req.query.status)))
      throw new ValidationError("Invalid status");
    where.status = req.query.status;
  }
  if (req.query.q)
    where.orderNumber = { contains: String(req.query.q).slice(0, 100), mode: "insensitive" };
  if (req.query.from || req.query.to) {
    const from = req.query.from ? /* @__PURE__ */ new Date(`${req.query.from}T00:00:00+07:00`) : /* @__PURE__ */ new Date(0), to = req.query.to ? /* @__PURE__ */ new Date(`${req.query.to}T23:59:59.999+07:00`) : /* @__PURE__ */ new Date();
    if (!Number.isFinite(+from) || !Number.isFinite(+to) || from > to)
      throw new ValidationError("Invalid dates");
    where.createdAt = { gte: from, lte: to };
  }
  const { skip, take } = pageArgs(req.query);
  const [orders, total] = await Promise.all([prisma_default.orders.findMany({ where, skip, take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { shop: { select: { id: true, name: true } }, items: true } }), prisma_default.orders.count({ where })]);
  res.json({ orders, total, page: skip / take + 1, totalPages: Math.max(1, Math.ceil(total / take)) });
});
var reorder = handle(async (req, res) => {
  const order = await prisma_default.orders.findFirst({ where: { id: objectId(req.params.orderId), userId: req.user.id }, include: { items: true } });
  if (!order)
    throw new NotFoundError();
  res.json({ cart: order.items.map((i) => ({ id: i.productId, title: i.title, price: i.unitPrice, sale_price: i.unitPrice, quantity: i.quantity, variantId: i.variantId, selectedOptions: { color: i.color || "", size: i.size || "" }, image: i.image })) });
});

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

// apps/order-service/src/routes/return-evidence.controller.ts
function evidenceImage(file) {
  if (typeof file !== "string")
    throw new ValidationError("Choose a PNG, JPEG or WebP image");
  if (file.length > 4 * Math.ceil(5 * 1024 * 1024 / 3) + 32)
    throw new ValidationError("Image must be under 5 MB");
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(file);
  if (!match)
    throw new ValidationError("Choose a PNG, JPEG or WebP image");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12)
    throw new ValidationError("Image must be under 5 MB");
  if (bytes.toString("base64") !== match[2])
    throw new ValidationError("Invalid image contents");
  const format = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpeg" : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
  if (!format)
    throw new ValidationError("Invalid image contents");
  if (format !== match[1])
    throw new ValidationError("Image format does not match its contents");
  return { file, format };
}
var uploadEvidence = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  if (!await prisma_default.orders.findFirst({ where: { id: orderId, userId: req.user.id, status: "Delivered", paymentStatus: "Paid" } }))
    throw new NotFoundError();
  if (await prisma_default.returnRequest.findUnique({ where: { orderId } }))
    throw new ValidationError("The return request has already been submitted");
  const { file, format } = evidenceImage(req.body.file);
  try {
    const uploaded = await imageKit.upload({ file, fileName: `evidence-${Date.now()}.${format}`, folder: `/returns/${orderId}` });
    const url = new URL(uploaded.url);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Invalid upload response");
    res.status(201).json({ url: url.toString() });
  } catch {
    throw new AppError("Image upload is temporarily unavailable. Successfully uploaded images are retained; retry the remaining files.", 503);
  }
});
var escalateReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId), reason = textField(req.body.reason, "reason", 2e3);
  const result = await transaction(async (tx) => {
    const order = await tx.orders.findFirst({ where: { id: orderId, userId: req.user.id, status: "Delivered", paymentStatus: "Paid" } });
    const current = await tx.returnRequest.findUnique({ where: { orderId } });
    if (!order || !current)
      throw new NotFoundError();
    if (current.escalatedAt)
      throw new ValidationError("This return has already been escalated");
    if (current.status !== "Rejected")
      throw new ValidationError("Only a rejected return can be escalated");
    await tx.orders.update({ where: { id: orderId, status: "Delivered" }, data: { updatedAt: /* @__PURE__ */ new Date() } });
    const request = await tx.returnRequest.update({ where: { id: current.id, status: "Rejected" }, data: { status: "Escalated", escalatedAt: /* @__PURE__ */ new Date(), escalationReason: reason } });
    await tx.orderEvent.create({ data: { orderId, actorId: req.user.id, from: "Return:Rejected", to: "Return:Escalated", reason } });
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId, type: "System", title: "Buyer requests return reconsideration", message: reason, redirectUrl: `/dashboard/orders/${orderId}` } });
    return request;
  });
  res.json({ request: result });
});

// apps/order-service/src/routes/returns.controller.ts
var import_stripe4 = __toESM(require("stripe"));
var requestReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  const reason = textField(req.body.reason, "return reason", 2e3);
  const evidence = req.body.evidence || [];
  if (!Array.isArray(evidence) || evidence.length > 5 || evidence.some((url) => {
    if (typeof url !== "string" || url.length > 2e3)
      return true;
    try {
      return new URL(url).protocol !== "https:";
    } catch {
      return true;
    }
  }))
    throw new ValidationError("Provide up to five HTTPS evidence links");
  const result = await transaction(async (tx) => {
    const order = await tx.orders.findFirst({ where: { id: orderId, userId: req.user.id, status: "Delivered", paymentStatus: "Paid" } });
    if (!order)
      throw new NotFoundError("Only your delivered, paid orders can be returned");
    const existing = await tx.returnRequest.findUnique({ where: { orderId } });
    if (existing)
      return existing;
    await tx.orders.update({ where: { id: orderId, status: "Delivered" }, data: { updatedAt: /* @__PURE__ */ new Date() } });
    const result2 = await tx.returnRequest.create({ data: { orderId, userId: req.user.id, shopId: order.shopId, reason, evidence } });
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.create({ data: { sellerId: shop.sellerId, orderId, type: "System", title: "Return requested", message: `${order.orderNumber}: ${reason}`, redirectUrl: `/dashboard/orders/${orderId}` } });
    return result2;
  });
  res.status(201).json({ request: result });
});
var orderAftercare = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  const scope = req.role === "seller" ? { shopId: req.seller?.shop?.id || "000000000000000000000000" } : { userId: req.user.id };
  if (!await prisma_default.orders.findFirst({ where: { id: orderId, ...scope } }))
    throw new NotFoundError();
  const [request, events] = await Promise.all([
    prisma_default.returnRequest.findUnique({ where: { orderId } }),
    prisma_default.orderEvent.findMany({ where: { orderId }, orderBy: { createdAt: "asc" }, take: 100 })
  ]);
  res.json({ request, events });
});
var reviewReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  const status = req.body.status;
  if (!req.seller?.shop?.id)
    throw new ForbiddenError();
  if (!["Approved", "Rejected", "Received"].includes(status))
    throw new ValidationError("Invalid return action");
  const sellerNote = textField(req.body.sellerNote, "seller note", 2e3);
  const result = await transaction(async (tx) => {
    const order = await tx.orders.findFirst({ where: { id: orderId, shopId: req.seller.shop.id }, include: { items: true } });
    const request = await tx.returnRequest.findUnique({ where: { orderId } });
    if (!order || !request)
      throw new NotFoundError();
    if (request.status === status)
      return request;
    if (!(request.status === "Requested" && ["Approved", "Rejected"].includes(status)) && !(request.status === "Escalated" && status === "Approved") && !(request.status === "Approved" && status === "Received"))
      throw new ValidationError("Invalid return transition");
    if (order.status !== "Delivered")
      throw new ValidationError("Order is no longer eligible for this return action");
    if (status === "Received") {
      await tx.orders.update({ where: { id: orderId, status: "Delivered" }, data: { status: "Returned" } });
    } else
      await tx.orders.update({ where: { id: orderId, status: "Delivered" }, data: { updatedAt: /* @__PURE__ */ new Date() } });
    const updated = await tx.returnRequest.update({ where: { id: request.id, status: request.status }, data: { status, sellerNote } });
    await tx.orderEvent.create({ data: { orderId, actorId: req.seller.id, from: `Return:${request.status}`, to: `Return:${status}`, reason: sellerNote } });
    await tx.notifications.create({ data: { userId: order.userId, orderId, type: "System", title: `Return ${status.toLowerCase()}`, message: sellerNote, redirectUrl: `/order/${orderId}` } });
    return updated;
  });
  res.json({ request: result });
});
var paymentResult = handle(async (req, res) => {
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== "string" || sessionId.length > 100)
    throw new ValidationError("Invalid session");
  const session = await prisma_default.paymentSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== req.user.id)
    throw new NotFoundError();
  res.setHeader("Cache-Control", "no-store");
  let receipt = await prisma_default.paymentReceipt.findFirst({ where: { sessionId, userId: req.user.id } });
  const payload = session.payload;
  let status = "pending";
  const paymentId = payload.paymentIntentId || req.query.paymentIntentId;
  if (!receipt && paymentId) {
    if (typeof paymentId !== "string" || !/^pi_[A-Za-z0-9]+$/.test(paymentId))
      throw new ValidationError("Invalid payment");
    const payment = await new import_stripe4.default(process.env.STRIPE_SECRET_KEY, { timeout: 1e4, maxNetworkRetries: 1 }).paymentIntents.retrieve(paymentId);
    if (payment.metadata.sessionId !== sessionId || payment.metadata.userId !== req.user.id)
      throw new ForbiddenError();
    status = payment.status;
    if (payment.status === "succeeded") {
      try {
        await fulfillPayment(payment, false);
      } catch {
        status = "needs_review";
      }
      receipt = await prisma_default.paymentReceipt.findFirst({ where: { sessionId, userId: req.user.id } });
    }
  } else if (!receipt && session.expiresAt && new Date(session.expiresAt).getTime() < Date.now())
    status = "expired";
  res.json({ complete: !!receipt?.orderIds.length, status: receipt?.orderIds.length ? "complete" : status, orderIds: receipt?.orderIds || [], cart: receipt ? payload.cart : [] });
});

// apps/order-service/src/routes/order.route.ts
var router = import_express.default.Router();
router.post("/seller-refund/:orderId", isAuthenticated_default, isSeller, sellerRefund);
router.post("/return-evidence/:orderId", isAuthenticated_default, isUser, uploadEvidence);
router.post("/escalate-return/:orderId", isAuthenticated_default, isUser, escalateReturn);
router.post("/inspect-cart", inspectCart);
router.get("/my-orders", isAuthenticated_default, isUser, customerOrders);
router.get("/my-order-stats", isAuthenticated_default, isUser, orderStats);
router.get("/reorder/:orderId", isAuthenticated_default, isUser, reorder);
router.get("/payment-result", isAuthenticated_default, isUser, paymentResult);
router.get("/aftercare/:orderId", isAuthenticated_default, isUser, orderAftercare);
router.get("/seller-aftercare/:orderId", isAuthenticated_default, isSeller, orderAftercare);
router.post("/returns/:orderId", isAuthenticated_default, isUser, requestReturn);
router.patch("/returns/:orderId", isAuthenticated_default, isSeller, reviewReturn);
router.post("/cancel-order/:orderId", isAuthenticated_default, isUser, cancelOrder);
router.post("/create-payment-intent", isAuthenticated_default, isUser, createPaymentIntent);
router.post("/create-payment-session", isAuthenticated_default, isUser, createPaymentSession);
router.get("/verify-payment-session", isAuthenticated_default, isUser, verifyPaymentSession);
router.get("/get-user-orders", isAuthenticated_default, isUser, getUserOrders);
router.get("/get-order/:orderId", isAuthenticated_default, isUser, getOrderById);
router.get("/get-seller-orders", isAuthenticated_default, isSeller, getSellerOrders);
router.get("/seller-payments", isAuthenticated_default, isSeller, getSellerPayments);
router.get("/get-admin-orders", isAuthenticated_default, isAdmin, adminPermission("orders"), getAdminOrders);
router.patch(
  "/update-order-status/:orderId",
  isAuthenticated_default,
  isSeller,
  sellerOrderStatus
);
router.post("/verify-coupon", isAuthenticated_default, isUser, verifyConponCode);
var order_route_default = router;

// apps/order-service/src/main.ts
var app = (0, import_express2.default)();
app.use(
  (0, import_cors.default)({
    origin: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true
  })
);
app.post(
  "/api/create-order",
  import_body_parser.default.raw({ type: "application/json" }),
  (req, res, next) => {
    req.rawBody = req.body;
    next();
  },
  paymentWebhook
);
app.use(import_express2.default.json({ limit: "8mb" }));
app.use((0, import_cookie_parser.default)());
app.use("/", order_route_default);
app.use("/api", order_route_default);
app.use(errorMiddleware);
var port = process.env.PORT || 6004;
var server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
//# sourceMappingURL=main.js.map
