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

// apps/product-service/src/main.ts
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
var RateLimitError = class extends AppError {
  constructor(message = "Too many requests, please try again later !") {
    super(message, 429);
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

// apps/product-service/src/routes/product.router.ts
var import_express = __toESM(require("express"));

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

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

// apps/product-service/src/controllers/catalog-query.ts
var filteredCatalog = handle(async (req, res) => {
  const where = { status: "Active", isDeleted: false };
  const list = (key) => {
    const raw = req.query[key];
    const values = (Array.isArray(raw) ? raw : raw ? String(raw).split(",") : []).map(String).map((v) => v.trim()).filter(Boolean);
    if (values.length > 30 || values.some((v) => v.length > 100))
      throw new ValidationError("Too many filter values");
    return values;
  };
  for (const key of ["categories", "subCategories", "colors", "sizes"]) {
    const values = list(key);
    if (!values.length)
      continue;
    if (key === "categories")
      where.category = { in: values };
    if (key === "subCategories")
      where.subCategory = { in: values };
    if (key === "colors")
      where.colors = { hasSome: values };
    if (key === "sizes")
      where.sizes = { hasSome: values };
  }
  if (req.query.priceRange) {
    const range = String(req.query.priceRange).split(",").map(Number);
    if (range.length !== 2 || range.some((n) => !Number.isFinite(n) || n < 0) || range[0] > range[1])
      throw new ValidationError("Invalid price range");
    where.sale_price = { gte: range[0], lte: range[1] };
  } else {
    const price = {};
    for (const [key, op] of [["minPrice", "gte"], ["maxPrice", "lte"]])
      if (req.query[key] !== void 0 && req.query[key] !== "") {
        const value = Number(req.query[key]);
        if (!Number.isFinite(value) || value < 0)
          throw new ValidationError("Invalid price");
        price[op] = value;
      }
    if (typeof price.gte === "number" && typeof price.lte === "number" && price.gte > price.lte)
      throw new ValidationError("Invalid price range");
    if (Object.keys(price).length)
      where.sale_price = price;
  }
  if (req.query.excludeId)
    where.id = { not: objectId(req.query.excludeId) };
  const search = String(req.query.q ?? "").trim().slice(0, 150);
  if (search)
    where.OR = [{ title: { contains: search, mode: "insensitive" } }, { brand: { contains: search, mode: "insensitive" } }];
  if (req.query.inStock === "true")
    where.stock = { gt: 0 };
  const sorts = { newest: { createdAt: "desc" }, priceAsc: { sale_price: "asc" }, priceDesc: { sale_price: "desc" }, popular: { totalSales: "desc" }, rating: { rating: "desc" } };
  const sort = String(req.query.sort ?? "newest");
  if (!sorts[sort])
    throw new ValidationError("Invalid sort");
  const { skip, take } = pageArgs(req.query);
  const [products, total, bounds] = await Promise.all([
    prisma_default.products.findMany({ where, skip, take, orderBy: [sorts[sort], { id: "asc" }], include: { images: true, shop: { select: { id: true, name: true } } } }),
    prisma_default.products.count({ where }),
    prisma_default.products.aggregate({ where: { status: "Active", isDeleted: false }, _min: { sale_price: true }, _max: { sale_price: true } })
  ]);
  res.json({ products, priceBounds: { min: bounds._min.sale_price ?? 0, max: bounds._max.sale_price ?? 0 }, pagination: { total, page: skip / take + 1, totalPages: Math.max(1, Math.ceil(total / take)) } });
});

// apps/product-service/src/controllers/product.controller.ts
var getCategories = async (req, res, next) => {
  try {
    const config = await prisma_default.site_config.findFirst();
    if (!config) {
      return res.status(404).json({ message: "Categories not found" });
    }
    return res.status(200).json({
      categories: config.categories,
      subCategories: config.subCategories
    });
  } catch (error) {
    return next(error);
  }
};
var createDiscountCode = async (req, res, next) => {
  try {
    const { public_name, discountType, discountValue, discountCode, productIds = [] } = req.body;
    const value = Number(discountValue);
    if (typeof public_name !== "string" || !public_name.trim() || typeof discountCode !== "string" || !discountCode.trim() || discountCode.length > 100 || !["percentage", "fixed", "flat"].includes(discountType) || !Number.isFinite(value) || value <= 0 || discountType === "percentage" && value > 100)
      throw new ValidationError("Provide a valid name, code and discount value");
    if (!Array.isArray(productIds) || productIds.length > 1e3 || productIds.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)))
      throw new ValidationError("Invalid selected products");
    const selectedIds = [...new Set(productIds)];
    if (selectedIds.length && !req.seller.shop?.id)
      throw new ValidationError("Create a shop before selecting products");
    const isDiscountCodeExists = await prisma_default.discountCodes.findFirst({
      where: { discountCode: discountCode.trim() }
    });
    if (isDiscountCodeExists) {
      return res.status(400).json({ message: "Discount code already exists" });
    }
    const discount_code = await prisma_default.$transaction(async (tx) => {
      const where = { id: { in: selectedIds }, shopId: req.seller.shop?.id, isDeleted: false };
      if (selectedIds.length && await tx.products.count({ where }) !== selectedIds.length)
        throw new ValidationError("Select available products belonging to your shop");
      const code = await tx.discountCodes.create({
        data: {
          public_name: public_name.trim(),
          discountType: discountType === "flat" ? "fixed" : discountType,
          discountValue: value,
          discountCode: discountCode.trim(),
          sellerId: req.seller.id
        }
      });
      if (selectedIds.length) {
        const updated = await tx.products.updateMany({ where, data: { discount_codes: { push: code.id } } });
        if (updated.count !== selectedIds.length)
          throw new ValidationError("Selected products changed. Please retry");
      }
      return code;
    });
    try {
      await prisma_default.notifications.create({
        data: {
          title: "\u{1F389} Promotion created",
          message: `Your promotion "${public_name}" is ready.`,
          type: "Promotion",
          sellerId: req.seller.id,
          redirectUrl: "/dashboard/discount-codes",
          metadata: { discountCodeId: discount_code.id }
        }
      });
    } catch (notificationError) {
      console.error("Error creating promotion notification:", notificationError);
    }
    return res.status(201).json({ message: "Discount code created successfully", discount_code });
  } catch (error) {
    return next(error);
  }
};
var getDiscountCodes = async (req, res, next) => {
  try {
    const sellerId = req.seller.id;
    const discountCodes = await prisma_default.discountCodes.findMany({
      where: { sellerId }
    });
    return res.status(200).json({
      success: true,
      discount_codes: discountCodes
    });
  } catch (error) {
    return next(error);
  }
};
var deleteDiscountCodes = async (req, res, next) => {
  try {
    const id = objectId(req.params.id);
    const sellerId = req.seller.id;
    await transaction(async (tx) => {
      const discountCode = await tx.discountCodes.findUnique({
        where: { id },
        select: { id: true, sellerId: true }
      });
      if (!discountCode)
        throw new NotFoundError("Discount code not found");
      if (discountCode.sellerId !== sellerId)
        throw new ForbiddenError("You don't have permission to access this discount code");
      const shop = await tx.shops.findUnique({ where: { sellerId }, select: { id: true } });
      if (shop) {
        const products = await tx.products.findMany({
          where: { shopId: shop.id, discount_codes: { has: id } },
          select: { id: true, discount_codes: true }
        });
        for (const product of products) {
          await tx.products.update({
            where: { id: product.id, shopId: shop.id },
            data: { discount_codes: { set: product.discount_codes.filter((code) => code !== id) } }
          });
        }
      }
      await tx.discountCodes.delete({ where: { id, sellerId } });
    });
    return res.status(200).json({ message: "Discount code deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
var uploadProductImages = async (req, res, next) => {
  try {
    const { fileName } = req.body;
    if (typeof fileName !== "string" || !fileName.startsWith("data:image/")) {
      return next(new ValidationError("A valid product image is required."));
    }
    const response = await imageKit.upload({
      file: fileName,
      fileName: `product-${Date.now()}.jpg`,
      folder: "/products"
    });
    return res.status(201).json({
      file_url: response.url,
      fileName: response.fileId
    });
  } catch (error) {
    return next(error);
  }
};
var deleteProductImages = async (req, res, next) => {
  try {
    const { fileId } = req.body;
    await imageKit.deleteFile(fileId);
    return res.status(200).json({ message: "Product image deleted successfully" });
  } catch (error) {
    return next(error);
  }
};
var createProduct = async (req, res, next) => {
  try {
    const {
      title,
      short_description,
      detailed_description,
      detail_description,
      // UI sends this
      warranty = "No Warranty",
      custom_specification,
      slug,
      tags,
      tag,
      // UI sends this
      cash_on_delivery,
      brand,
      video_url,
      category,
      colors = [],
      sizes = [],
      discount_codes,
      discountCodes,
      // UI sends this
      stock,
      sale_price,
      regular_price,
      subCategory,
      custom_properties,
      customProperties,
      // UI sends this
      custom_specifications,
      // UI sends this
      images = []
    } = req.body;
    const finalTags = tags || tag;
    const finalDiscountCodes = discount_codes || discountCodes || [];
    const finalCustomProperties = custom_properties || customProperties || {};
    const finalCustomSpecifications = custom_specification || custom_specifications || [];
    const missingFields = [
      ["title", title],
      ["slug", slug],
      ["short_description", short_description],
      ["detail_description", detailed_description || detail_description],
      ["category", category],
      ["subCategory", subCategory],
      ["sale_price", sale_price],
      ["regular_price", regular_price],
      ["stock", stock],
      ["tag", finalTags]
    ].filter(([, value]) => value === void 0 || value === null || value === "").map(([field]) => field);
    if (missingFields.length > 0) {
      return next(
        new ValidationError(`Missing required fields: ${missingFields.join(", ")}`)
      );
    }
    const hasUploadedImage = Array.isArray(images) && images.some(
      (image) => typeof image?.url === "string" && image.url.length > 0 && typeof image?.fileId === "string" && image.fileId.length > 0
    );
    if (!hasUploadedImage) {
      return next(
        new ValidationError("At least one product image is required.")
      );
    }
    if (!req.seller?.shop?.id) {
      return next(
        new ValidationError("Create your shop before listing products.")
      );
    }
    const slugChecking = await prisma_default.products.findUnique({
      where: { slug }
    });
    if (slugChecking) {
      return next(
        new ValidationError(
          "Slug already exists! Please use a different slug."
        )
      );
    }
    const newProduct = await prisma_default.products.create({
      data: {
        title,
        short_description,
        detailed_description: detailed_description || detail_description,
        // Handle both names
        warranty,
        cash_on_delivery,
        slug,
        shopId: req.seller.shop.id,
        tags: Array.isArray(finalTags) ? finalTags : finalTags.split(","),
        brand,
        video_url,
        category,
        subCategory,
        colors: colors || [],
        discount_codes: Array.isArray(finalDiscountCodes) ? finalDiscountCodes : [],
        sizes: sizes || [],
        stock: parseInt(stock),
        sale_price: parseFloat(sale_price),
        regular_price: parseFloat(regular_price),
        custom_properties: finalCustomProperties,
        custom_specification: finalCustomSpecifications,
        images: {
          create: images.filter((img) => img && img.fileId && img.url).map((img) => ({ file_id: img.fileId, url: img.url }))
        }
      },
      include: {
        images: true
      }
    });
    await sendBehaviorLog("productCreated", {
      type: "success",
      source: "product-service",
      message: "Seller created a product",
      metadata: { sellerId: req.seller.id, productId: newProduct.id }
    });
    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      newProduct
    });
  } catch (error) {
    return next(error);
  }
};
var getShopProducts = async (req, res, next) => {
  try {
    const products = await prisma_default.products.findMany({
      where: {
        shopId: req.seller.shop.id
      },
      include: {
        images: true,
        _count: { select: { reviews: true } }
      }
    });
    return res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    return next(error);
  }
};
var deleteProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const sellerId = req.seller?.shop?.id;
    const product = await prisma_default.products.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isDeleted: true }
    });
    if (!product) {
      return next(new ValidationError("Product not found!"));
    }
    if (product.shopId !== sellerId) {
      return next(new ValidationError("Unauthorized!"));
    }
    if (product.isDeleted) {
      return next(new ValidationError("Product is already deleted!"));
    }
    const deletedProduct = await prisma_default.products.update({
      where: { id: productId },
      data: {
        isDeleted: true,
        deleteAt: new Date(Date.now() + 24 * 60 * 60 * 1e3)
      }
    });
    await sendBehaviorLog("productDeleted", {
      type: "success",
      source: "product-service",
      message: "Seller scheduled a product for deletion",
      metadata: { sellerId: req.seller.id, productId: deletedProduct.id }
    });
    return res.status(200).json({
      message: "Product is scheduled for deletion in 24 hours! You can restore it within this period.",
      deletedAt: deletedProduct.deleteAt
    });
  } catch (error) {
    return next(error);
  }
};
var restoreProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const sellerId = req.seller?.shop?.id;
    const product = await prisma_default.products.findUnique({
      where: { id: productId },
      select: { id: true, shopId: true, isDeleted: true }
    });
    if (!product) {
      return next(new ValidationError("Product not found!"));
    }
    if (product.shopId !== sellerId) {
      return next(new ValidationError("Unauthorized action!"));
    }
    if (!product.isDeleted) {
      return next(new ValidationError("Product is not in deleted state"));
    }
    await prisma_default.products.update({
      where: { id: productId },
      data: {
        isDeleted: false,
        deleteAt: null
      }
    });
    return res.status(200).json({
      message: "Product restored successfully"
    });
  } catch (error) {
    return next(error);
  }
};
var getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type;
    const baseFilter = {
      status: "Active",
      isDeleted: false,
      OR: [
        { starting_date: null },
        { starting_date: { isSet: false } },
        { ending_date: null },
        { ending_date: { isSet: false } }
      ]
    };
    const orderBy = type === "latest" ? { createdAt: "desc" } : { totalSales: "desc" };
    const [products, total, top10Products] = await Promise.all([
      await prisma_default.products.findMany({
        skip,
        take: limit,
        include: {
          images: true,
          shop: true
        },
        where: baseFilter,
        orderBy
      }),
      prisma_default.products.count({ where: baseFilter }),
      prisma_default.products.findMany({
        take: 10,
        where: baseFilter,
        orderBy
      })
    ]);
    return res.status(201).json({
      products,
      top10By: type === "latest" ? "latest" : "topSales",
      top10Products,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    return next(error);
  }
};
var getProductDetails = async (req, res, next) => {
  try {
    const product = await prisma_default.products.findUnique({
      where: { slug: req.params.slug, status: "Active", isDeleted: false },
      include: {
        images: true,
        shop: true
      }
    });
    if (product) {
      await sendBehaviorLog("productView", {
        type: "info",
        source: "product-service",
        message: "Product details viewed",
        metadata: { productId: product.id, slug: product.slug }
      });
    }
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    return next(error);
  }
};
var getFilteredEvents = async (req, res, next) => {
  try {
    const {
      priceRange = [0, 1e4],
      categories = [],
      colors = [],
      sizes = [],
      page = 1,
      limit = 12
    } = req.query;
    const parsedPriceRange = typeof priceRange === "string" ? priceRange.split(",").map(Number) : [0, 1e4];
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const skip = (parsedPage - 1) * parsedLimit;
    const filters = {
      status: "Active",
      isDeleted: false,
      sale_price: {
        gte: parsedPriceRange[0],
        lte: parsedPriceRange[1]
      },
      NOT: {
        starting_date: null
      }
    };
    if (categories && categories.length > 0) {
      filters.category = {
        in: Array.isArray(categories) ? categories : String(categories).split(",")
      };
    }
    if (colors && colors.length > 0) {
      filters.colors = {
        hasSome: Array.isArray(colors) ? colors : [colors]
      };
    }
    if (sizes && sizes.length > 0) {
      filters.sizes = {
        hasSome: Array.isArray(sizes) ? sizes : [sizes]
      };
    }
    const [products, total] = await Promise.all([
      prisma_default.products.findMany({
        where: filters,
        skip,
        take: parsedLimit,
        include: {
          images: true,
          shop: true
        }
      }),
      prisma_default.products.count({ where: filters })
    ]);
    const totalPages = Math.ceil(total / parsedLimit);
    return res.json({
      products,
      pagination: {
        total,
        page: parsedPage,
        totalPages
      }
    });
  } catch (error) {
    return next(error);
  }
};
var getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shop = await prisma_default.shops.findUnique({
      where: { id },
      include: {
        avatar: true,
        sellers: {
          select: {
            id: true,
            name: true,
            country: true
          }
        },
        products: {
          where: { isDeleted: false, status: "Active" },
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            images: true,
            shop: true
          }
        }
      }
    });
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    return res.json({
      shop: {
        ...shop,
        followerCount: await prisma_default.users.count({ where: { following: { has: id } } }),
        avatar: shop.avatar?.[0]?.url ?? ""
      },
      sellerId: shop.sellerId
    });
  } catch (error) {
    return next(error);
  }
};
var getFilteredShops = async (req, res, next) => {
  try {
    const { categories = [], countries = [], page = 1, limit = 12 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const skip = (parsedPage - 1) * parsedLimit;
    const filters = {
      status: "Active",
      isDeleted: false
    };
    if (categories && String(categories).length > 0) {
      filters.category = {
        in: Array.isArray(categories) ? categories : String(categories).split(","),
        mode: "insensitive"
      };
    }
    if (countries && String(countries).length > 0) {
      const countryArray = Array.isArray(countries) ? countries : String(countries).split(",");
      filters.sellers = {
        is: {
          country: {
            in: countryArray,
            mode: "insensitive"
          }
        }
      };
    }
    const [shops, total] = await Promise.all([
      prisma_default.shops.findMany({
        where: filters,
        skip,
        take: parsedLimit,
        include: {
          // followers: true,
          products: true
        }
      }),
      prisma_default.shops.count({ where: filters })
    ]);
    const totalPages = Math.ceil(total / parsedLimit);
    return res.json({
      shops,
      pagination: {
        total,
        page: parsedPage,
        totalPages
      }
    });
  } catch (error) {
    return next(error);
  }
};
var searchProducts = async (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: "Search query is required." });
    }
    const products = await prisma_default.products.findMany({
      where: {
        status: "Active",
        isDeleted: false,
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive"
            }
          },
          {
            short_description: {
              contains: query,
              mode: "insensitive"
            }
          }
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true
      },
      take: 10,
      orderBy: {
        createdAt: "desc"
      }
    });
    await sendBehaviorLog("productSearch", {
      type: "info",
      source: "product-service",
      message: "Product search completed",
      metadata: { queryLength: query.trim().length, resultCount: products.length }
    });
    return res.status(200).json({ products });
  } catch (error) {
    return next(error);
  }
};
var topShops = async (req, res, next) => {
  try {
    const topShopsData = await prisma_default.orders.groupBy({
      by: ["shopId"],
      _sum: {
        totalAmount: true
      },
      orderBy: {
        _sum: {
          totalAmount: "desc"
        }
      },
      take: 10
    });
    const shopIds = topShopsData.map((item) => item.shopId);
    const shops = await prisma_default.shops.findMany({
      where: {
        id: {
          in: shopIds
        }
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        coverBanner: true,
        address: true,
        ratings: true,
        category: true
      }
    });
    const fallbackShops = await prisma_default.shops.findMany({
      where: {
        id: {
          notIn: shopIds
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.max(0, 10 - shops.length),
      select: {
        id: true,
        name: true,
        avatar: true,
        coverBanner: true,
        address: true,
        ratings: true,
        category: true
      }
    });
    const enrichedShops = [...shops, ...fallbackShops].map((shop) => {
      const salesData = topShopsData.find((s) => s.shopId === shop.id);
      return {
        ...shop,
        avatar: shop.avatar[0]?.url ?? "",
        rating: shop.ratings ?? 0,
        totalSales: salesData?._sum.totalAmount ?? 0
      };
    });
    const top10Shops = enrichedShops.sort((a, b) => b.totalSales - a.totalSales).slice(0, 10);
    return res.status(200).json({ shops: top10Shops });
  } catch (error) {
    console.error("Error fetching top shop: ", error);
    return next(error);
  }
};
var getAllEvents = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const baseFilter = {
      status: "Active",
      isDeleted: false,
      AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }]
    };
    const [events, total, top10BySales] = await Promise.all([
      prisma_default.products.findMany({
        skip,
        take: limit,
        where: baseFilter,
        include: {
          images: true,
          shop: true
        },
        orderBy: {
          totalSales: "desc"
        }
      }),
      prisma_default.products.count({ where: baseFilter }),
      prisma_default.products.findMany({
        where: baseFilter,
        take: 10,
        orderBy: {
          totalSales: "desc"
        }
      })
    ]);
    return res.status(200).json({
      events,
      top10BySales,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Error fetching all events: ", error);
    return next(error);
  }
};

// apps/product-service/src/controllers/seller-notification.controller.ts
var getSellerNotifications = async (req, res, next) => {
  try {
    const sellerId = req.seller.id;
    const where = { sellerId };
    const [notifications, unreadCount] = await Promise.all([
      prisma_default.notifications.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma_default.notifications.count({ where: { ...where, isRead: false } })
    ]);
    return res.status(200).json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    return next(error);
  }
};
var markSellerNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ message: "Invalid notification id" });
    }
    const result = await prisma_default.notifications.updateMany({
      where: { id, sellerId: req.seller.id },
      data: { isRead: true }
    });
    if (result.count === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
};
var markAllSellerNotificationsRead = async (req, res, next) => {
  try {
    const result = await prisma_default.notifications.updateMany({
      where: { sellerId: req.seller.id, isRead: false },
      data: { isRead: true }
    });
    return res.status(200).json({
      success: true,
      updatedCount: result.count
    });
  } catch (error) {
    return next(error);
  }
};

// apps/product-service/src/controllers/seller-stats.controller.ts
var LOW_STOCK_THRESHOLD = 5;
var REVENUE_DAYS = 30;
var getSellerStats = async (req, res, next) => {
  try {
    const shopId = req.seller?.shop?.id;
    if (!shopId) {
      return res.status(200).json({
        success: true,
        shop: null,
        stats: {
          totalRevenue: 0,
          totalOrders: 0,
          totalProducts: 0,
          lowStockCount: 0,
          pendingOrders: 0,
          statusCounts: {}
        },
        revenueByDay: [],
        recentOrders: [],
        topProducts: [],
        lowStockProducts: []
      });
    }
    const since = /* @__PURE__ */ new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (REVENUE_DAYS - 1));
    const [
      totalProducts,
      totalOrders,
      revenueAgg,
      statusGroups,
      paidOrdersInPeriod,
      recentOrders,
      topSales,
      lowStockCount,
      lowStockProducts,
      shop
    ] = await Promise.all([
      prisma_default.products.count({
        where: { shopId, isDeleted: false }
      }),
      prisma_default.orders.count({
        where: { shopId }
      }),
      prisma_default.orders.aggregate({
        where: { shopId, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] } },
        _sum: { totalAmount: true }
      }),
      prisma_default.orders.groupBy({
        by: ["status"],
        where: { shopId },
        _count: { _all: true }
      }),
      prisma_default.orders.findMany({
        where: { shopId, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] }, createdAt: { gte: since } },
        select: { createdAt: true, totalAmount: true }
      }),
      prisma_default.orders.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          user: { select: { name: true, email: true } },
          items: { select: { title: true, image: true, quantity: true } }
        }
      }),
      prisma_default.orderItems.groupBy({
        by: ["productId"],
        where: { order: { shopId, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5
      }),
      prisma_default.products.count({
        where: {
          shopId,
          isDeleted: false,
          stock: { lte: LOW_STOCK_THRESHOLD }
        }
      }),
      prisma_default.products.findMany({
        where: {
          shopId,
          isDeleted: false,
          stock: { lte: LOW_STOCK_THRESHOLD }
        },
        orderBy: { stock: "asc" },
        take: 8,
        include: { images: true }
      }),
      prisma_default.shops.findUnique({
        where: { id: shopId },
        select: { id: true, name: true, avatar: true }
      })
    ]);
    const revenueByDay = [];
    for (let i = 0; i < REVENUE_DAYS; i++) {
      const day = new Date(since);
      day.setUTCDate(since.getUTCDate() + i);
      revenueByDay.push({
        date: day.toISOString().slice(0, 10),
        revenue: 0,
        orders: 0
      });
    }
    const indexByDate = new Map(revenueByDay.map((entry) => [entry.date, entry]));
    for (const order of paidOrdersInPeriod) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const entry = indexByDate.get(key);
      if (entry) {
        entry.revenue += order.totalAmount;
        entry.orders += 1;
      }
    }
    const topProductIds = topSales.map((s) => s.productId);
    const topProductsFound = topProductIds.length > 0 ? await prisma_default.products.findMany({
      where: { id: { in: topProductIds } },
      include: { images: true }
    }) : [];
    const topProducts = topSales.map((s) => {
      const product = topProductsFound.find((p) => p.id === s.productId);
      return product ? {
        id: product.id,
        title: product.title,
        slug: product.slug,
        sale_price: product.sale_price,
        image: product.images[0]?.url ?? "",
        unitsSold: s._sum.quantity ?? 0
      } : null;
    }).filter((p) => p !== null);
    const statusCounts = {};
    for (const group of statusGroups) {
      statusCounts[group.status] = group._count._all;
    }
    res.status(200).json({
      success: true,
      shop: shop ? {
        id: shop.id,
        name: shop.name,
        avatar: shop.avatar?.[0]?.url ?? ""
      } : null,
      stats: {
        totalRevenue: revenueAgg._sum.totalAmount ?? 0,
        totalOrders,
        totalProducts,
        lowStockCount,
        pendingOrders: statusCounts["Pending"] ?? 0,
        statusCounts
      },
      revenueByDay,
      recentOrders,
      topProducts,
      lowStockProducts
    });
  } catch (error) {
    return next(error);
  }
};

// packages/middleware/isAuthenticated.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// packages/utils/admin-access.ts
function isSuspended(account, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}

// packages/utils/seller-remediation-access.ts
function sellerRemediationRequest(path, method) {
  const route = path.replace(/^\/api(?=\/)/, "");
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

// apps/product-service/src/controllers/product-management.controller.ts
var getEditableProduct = handle(async (req, res) => {
  const product = await prisma_default.products.findFirst({ where: { id: objectId(req.params.id), shopId: req.seller.shop?.id, isDeleted: false }, include: { images: true, variants: true } });
  if (!product || !req.seller.shop)
    throw new NotFoundError();
  res.json({ product });
});
var updateProduct = handle(async (req, res) => {
  if (!req.seller.shop?.id)
    throw new ForbiddenError("Create a shop first");
  const id = objectId(req.params.id);
  const shopId = req.seller.shop.id;
  const data = {};
  for (const field of ["title", "slug", "category", "subCategory", "detailed_description", "warranty"]) {
    if (req.body[field] !== void 0)
      data[field] = textField(req.body[field], field, field === "detailed_description" ? 5e4 : 200);
  }
  for (const field of ["short_description", "brand", "video_url", "cash_on_delivery"]) {
    if (req.body[field] !== void 0) {
      if (req.body[field] !== null && (typeof req.body[field] !== "string" || req.body[field].length > 5e3))
        throw new ValidationError(`Invalid ${field}`);
      data[field] = req.body[field];
    }
  }
  for (const field of ["sale_price", "regular_price", "stock"]) {
    if (req.body[field] !== void 0) {
      const value = req.body[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || field === "stock" && !Number.isSafeInteger(value))
        throw new ValidationError(`Invalid ${field}`);
      data[field] = value;
    }
  }
  for (const field of ["colors", "sizes", "tags", "discount_codes"]) {
    if (req.body[field] !== void 0) {
      if (!Array.isArray(req.body[field]) || req.body[field].length > 100 || req.body[field].some((s) => typeof s !== "string" || s.length > 200))
        throw new ValidationError(`Invalid ${field}`);
      data[field] = req.body[field];
    }
  }
  if (req.body.discount_codes?.length) {
    req.body.discount_codes.forEach(objectId);
    const codes = await prisma_default.discountCodes.count({ where: { id: { in: req.body.discount_codes }, sellerId: req.seller.id } });
    if (codes !== new Set(req.body.discount_codes).size)
      throw new ValidationError("Invalid discount codes");
  }
  for (const key of ["custom_specification", "custom_properties"]) {
    if (req.body[key] !== void 0) {
      if (req.body[key] === null) {
        data[key] = null;
        continue;
      }
      if (!req.body[key] || typeof req.body[key] !== "object" || JSON.stringify(req.body[key]).length > 2e4)
        throw new ValidationError(`Invalid ${key}`);
      data[key] = req.body[key];
    }
  }
  if (req.body.status !== void 0) {
    if (!["Active", "Inactive", "Draft"].includes(req.body.status))
      throw new ValidationError("Invalid status");
    data.status = req.body.status;
  }
  if (req.body.images !== void 0) {
    const images = req.body.images;
    if (!Array.isArray(images) || images.length < 1 || images.length > 10 || images.some((img) => !img || typeof img.url !== "string" || !img.url.startsWith("https://") || typeof img.file_id !== "string" || !img.file_id))
      throw new ValidationError("Provide 1\u201310 uploaded images");
    data.images = { deleteMany: {}, create: images.map((img) => ({ file_id: img.file_id, url: img.url })) };
  }
  const product = await transaction(async (tx) => {
    const current = await tx.products.findFirst({ where: { id, shopId, isDeleted: false } });
    if (!current)
      throw new NotFoundError();
    if (current.status === "Suspended" && data.status !== void 0)
      throw new ValidationError("Administrator review is required before republishing this product");
    const variantCount = await tx.productVariant.count({ where: { productId: id } });
    if (variantCount) {
      for (const key of ["stock", "sale_price", "colors", "sizes"]) {
        if (req.body[key] !== void 0 && JSON.stringify(req.body[key]) !== JSON.stringify(current[key]))
          throw new ValidationError("Update stock, price and options in the SKU editor");
        delete data[key];
      }
    }
    if ((req.body.sale_price ?? current.sale_price) > (req.body.regular_price ?? current.regular_price))
      throw new ValidationError("Sale price cannot exceed regular price");
    const updated = await tx.products.update({ where: { id, shopId }, data, include: { images: true } });
    if (updated.stock !== current.stock) {
      await tx.inventoryHistory.create({ data: { productId: id, shopId, delta: updated.stock - current.stock, stockAfter: updated.stock, reason: "Seller adjustment", actorId: req.seller.id } });
      if (updated.stock < 5 && current.stock >= 5)
        await tx.notifications.create({ data: { sellerId: req.seller.id, type: "LowStock", title: "Low stock", message: `${updated.title}: ${updated.stock} remaining`, redirectUrl: "/dashboard/inventory" } });
    }
    return updated;
  });
  res.json({ success: true, product });
});
var getInventory = handle(async (req, res) => {
  const shopId = req.seller.shop?.id;
  if (!shopId)
    throw new NotFoundError("Shop not found");
  const threshold = Math.max(1, Math.min(1e3, Number(req.query.threshold) || 5));
  const [products, history] = await Promise.all([
    prisma_default.products.findMany({ where: { shopId, isDeleted: false, ...req.query.low === "true" ? { stock: { lte: threshold } } : {} }, orderBy: { stock: "asc" }, include: { images: true } }),
    prisma_default.inventoryHistory.findMany({ where: { shopId }, ...pageArgs(req.query), orderBy: { createdAt: "desc" }, include: { product: { select: { title: true } } } })
  ]);
  res.json({ products, history, threshold });
});
var createReview = handle(async (req, res) => {
  const productId = objectId(req.body.productId);
  const userId = req.user.id;
  const rating = req.body.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new ValidationError("Rating must be 1\u20135");
  const comment = textField(req.body.comment, "comment", 3e3);
  const review = await transaction(async (tx) => {
    const purchase = await tx.orderItems.findFirst({ where: { productId, order: { userId, status: "Delivered" } } });
    if (!purchase)
      throw new ForbiddenError("Only buyers with a delivered order can review this product");
    const result = await tx.productReviews.upsert({ where: { productId_userId: { productId, userId } }, create: { productId, userId, rating, comment }, update: { rating, comment } });
    const average = await tx.productReviews.aggregate({ where: { productId }, _avg: { rating: true } });
    const product = await tx.products.update({ where: { id: productId }, data: { rating: average._avg.rating ?? 0 }, include: { shop: true } });
    await tx.notifications.create({ data: { sellerId: product.shop.sellerId, type: "NewReview", title: "Product review", message: `${product.title} received a ${rating}/5 review`, redirectUrl: `/dashboard/all-products` } });
    return result;
  });
  res.status(201).json({ review });
});
var getReviews = handle(async (req, res) => {
  const productId = objectId(req.params.productId);
  const [reviews, total, stats] = await Promise.all([
    prisma_default.productReviews.findMany({ where: { productId }, ...pageArgs(req.query), orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } }),
    prisma_default.productReviews.count({ where: { productId } }),
    prisma_default.productReviews.aggregate({ where: { productId }, _avg: { rating: true } })
  ]);
  res.json({ reviews, total, rating: stats._avg.rating ?? 0 });
});

// packages/utils/reporting.ts
function dateRange(query, defaultDays = 30) {
  const to = query.to ? new Date(String(query.to)) : /* @__PURE__ */ new Date();
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(String(query.to)))
    to.setUTCHours(23, 59, 59, 999);
  const from = query.from ? new Date(String(query.from)) : new Date(to.getTime() - defaultDays * 864e5);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 864e5)
    throw new ValidationError("Choose a valid date range of at most one year");
  return { gte: from, lte: to };
}
function bucket(date, interval) {
  const d = new Date(date);
  if (interval === "month")
    return d.toISOString().slice(0, 7);
  if (interval === "week")
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function csv(rows) {
  if (!rows.length)
    return "";
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s))
      s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [keys.map(escape).join(","), ...rows.map((row) => keys.map((k) => escape(row[k])).join(","))].join("\r\n");
}

// apps/product-service/src/controllers/reports.controller.ts
var revenueReport = handle(async (req, res) => {
  const shopId = req.seller.shop?.id;
  if (!shopId)
    throw new NotFoundError();
  const createdAt = dateRange(req.query, 90);
  const interval = ["day", "week", "month"].includes(req.query.interval) ? req.query.interval : "day";
  const orders = await prisma_default.orders.findMany({ where: { shopId, createdAt, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] } }, include: { items: true } });
  const timeline = {};
  const products = {};
  const coupons = {};
  for (let day = new Date(createdAt.gte); day <= createdAt.lte; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = bucket(day, interval);
    timeline[date] ??= { date, revenue: 0, orders: 0, discount: 0 };
  }
  for (const order of orders) {
    const date = bucket(order.createdAt, interval);
    const row = timeline[date] ??= { date, revenue: 0, orders: 0, discount: 0 };
    row.revenue += order.totalAmount;
    row.orders++;
    row.discount += order.discount;
    order.items.forEach((item) => {
      const product = products[item.productId] ??= { id: item.productId, title: item.title, quantity: 0, revenue: 0 };
      product.quantity += item.quantity;
      product.revenue += item.totalPrice;
    });
    if (order.discountCodeId) {
      const coupon = coupons[order.discountCodeId] ??= { id: order.discountCodeId, uses: 0, discount: 0 };
      coupon.uses++;
      coupon.discount += order.discount;
    }
  }
  const codes = await prisma_default.discountCodes.findMany({ where: { id: { in: Object.keys(coupons) }, sellerId: req.seller.id } });
  const report = { timeline: Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date)), topProducts: Object.values(products).sort((a, b) => b.quantity - a.quantity).slice(0, 20), coupons: Object.values(coupons).map((c) => ({ ...c, code: codes.find((code) => code.id === c.id)?.discountCode ?? c.id })), totalRevenue: orders.reduce((sum, o) => sum + o.totalAmount, 0), totalOrders: orders.length };
  if (req.query.format === "csv") {
    res.attachment("seller-revenue.csv").type("text/csv").send(csv(report.timeline));
    return;
  }
  res.json(report);
});

// packages/utils/commerce-statistics.ts
function purchaseStatistics() {
  const customers = /* @__PURE__ */ new Map();
  const products = /* @__PURE__ */ new Map();
  let orders = 0, units = 0, spentCents = 0, salesCents = 0;
  const entry = (map, id, name, date) => {
    let row = map.get(id);
    if (!row) {
      row = { id, name, orders: 0, units: 0, distinct: /* @__PURE__ */ new Set(), cents: 0, lastPurchasedAt: date };
      map.set(id, row);
    }
    if (date > row.lastPurchasedAt)
      row.lastPurchasedAt = date;
    return row;
  };
  return {
    add(order) {
      const date = order.createdAt.toISOString();
      const buyer = entry(customers, order.userId, order.user?.name || "Deleted customer", date);
      buyer.email = order.user?.email;
      buyer.orders++;
      buyer.cents += Math.round(order.totalAmount * 100);
      orders++;
      spentCents += Math.round(order.totalAmount * 100);
      const seenProducts = /* @__PURE__ */ new Set();
      for (const item of order.items) {
        const row = entry(products, item.productId, item.title, date);
        if (!seenProducts.has(item.productId)) {
          row.orders++;
          seenProducts.add(item.productId);
        }
        row.distinct.add(order.userId);
        row.units += item.quantity;
        row.cents += Math.round(item.totalPrice * 100);
        buyer.distinct.add(item.productId);
        buyer.units += item.quantity;
        units += item.quantity;
        salesCents += Math.round(item.totalPrice * 100);
      }
    },
    result(kind) {
      const rows = [...(kind === "customers" ? customers : products).values()].map((row) => ({
        id: row.id,
        name: row.name,
        ...row.email ? { email: row.email } : {},
        orders: row.orders,
        units: row.units,
        distinctCount: row.distinct.size,
        amount: row.cents / 100,
        average: Math.round(row.cents / (kind === "customers" ? row.orders : row.units || 1)) / 100,
        lastPurchasedAt: row.lastPurchasedAt
      }));
      return { rows, summary: { orders, units, customers: customers.size, products: products.size, totalSpent: spentCents / 100, productSales: salesCents / 100, averageOrderValue: orders ? Math.round(spentCents / orders) / 100 : 0 } };
    }
  };
}

// packages/utils/commerce-statistics-report.ts
function statisticsOptions(query, asOf = /* @__PURE__ */ new Date()) {
  const kind = query.kind ?? "customers";
  if (kind !== "customers" && kind !== "products")
    throw new ValidationError("Invalid statistics type");
  const sort = query.sort ?? "amount";
  if (!["amount", "units", "orders", "lastPurchasedAt"].includes(sort))
    throw new ValidationError("Invalid statistics sort");
  if (query.q !== void 0 && (typeof query.q !== "string" || query.q.length > 200))
    throw new ValidationError("Invalid search");
  if (query.format !== void 0 && query.format !== "csv")
    throw new ValidationError("Invalid export format");
  let createdAt = { lte: asOf };
  if (query.from !== void 0 || query.to !== void 0) {
    const parse = (value, end) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new ValidationError("Choose both valid reporting dates");
      const calendar = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value)
        throw new ValidationError("Invalid reporting date");
      return /* @__PURE__ */ new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
    };
    const gte = parse(query.from, false), lte = parse(query.to, true);
    if (gte > lte || lte.getTime() - gte.getTime() > 366 * 864e5)
      throw new ValidationError("Choose a date range of at most 366 days");
    createdAt = { gte, lte: new Date(Math.min(lte.getTime(), asOf.getTime())) };
  }
  return { kind, sort, search: String(query.q ?? "").trim().toLowerCase(), createdAt, exportCsv: query.format === "csv", ...pageArgs(query) };
}
async function commerceStatistics(query, shopId) {
  const asOf = /* @__PURE__ */ new Date();
  const options = statisticsOptions(query, asOf);
  const where = {
    ...shopId ? { shopId } : {},
    createdAt: options.createdAt,
    currency: "usd",
    paymentStatus: "Paid",
    status: { notIn: ["Cancelled", "Returned", "Refunded"] }
  };
  const accumulator = purchaseStatistics();
  let after;
  while (true) {
    const batch = await prisma_default.orders.findMany({
      where: { ...where, ...after ? { id: { gt: after } } : {} },
      take: 1e3,
      orderBy: { id: "asc" },
      select: {
        id: true,
        userId: true,
        totalAmount: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        items: { select: { productId: true, title: true, quantity: true, totalPrice: true } }
      }
    });
    batch.forEach((order) => accumulator.add(order));
    if (batch.length < 1e3)
      break;
    after = batch[batch.length - 1].id;
  }
  const { rows, summary: summary2 } = accumulator.result(options.kind);
  if (options.kind === "products") {
    for (let offset = 0; offset < rows.length; offset += 1e3) {
      const current = await prisma_default.products.findMany({ where: { id: { in: rows.slice(offset, offset + 1e3).map((row) => row.id) }, ...shopId ? { shopId } : {} }, select: { id: true, title: true, stock: true, shop: { select: { name: true } } } });
      const lookup = new Map(current.map((product) => [product.id, product]));
      for (const row of rows.slice(offset, offset + 1e3)) {
        const product = lookup.get(row.id);
        if (product) {
          row.name = product.title;
          row.stock = product.stock;
          row.shopName = product.shop?.name;
        }
      }
    }
  }
  const filtered = rows.filter((row) => !options.search || [row.name, row.email, row.shopName, row.id].some((value) => value?.toLowerCase().includes(options.search)));
  filtered.sort((a, b) => {
    const difference = options.sort === "lastPurchasedAt" ? b.lastPurchasedAt.localeCompare(a.lastPurchasedAt) : b[options.sort] - a[options.sort];
    return difference || a.id.localeCompare(b.id);
  });
  if (options.exportCsv) {
    const exported = filtered.map((row) => options.kind === "customers" ? {
      customerId: row.id,
      customer: row.name,
      email: row.email ?? "",
      paidOrders: row.orders,
      unitsPurchased: row.units,
      distinctProducts: row.distinctCount,
      totalSpentUSD: row.amount,
      averageOrderUSD: row.average,
      lastPurchaseUTC: row.lastPurchasedAt
    } : {
      productId: row.id,
      product: row.name,
      shop: row.shopName ?? "",
      paidOrders: row.orders,
      unitsSold: row.units,
      uniqueBuyers: row.distinctCount,
      grossProductSalesUSD: row.amount,
      averageUnitPriceUSD: row.average,
      currentStock: row.stock ?? "",
      lastSaleUTC: row.lastPurchasedAt
    });
    const headers = options.kind === "customers" ? ["customerId", "customer", "email", "paidOrders", "unitsPurchased", "distinctProducts", "totalSpentUSD", "averageOrderUSD", "lastPurchaseUTC"] : ["productId", "product", "shop", "paidOrders", "unitsSold", "uniqueBuyers", "grossProductSalesUSD", "averageUnitPriceUSD", "currentStock", "lastSaleUTC"];
    return { csv: exported.length ? csv(exported) : csv([Object.fromEntries(headers.map((key) => [key, ""]))]).split("\r\n")[0], kind: options.kind };
  }
  return {
    kind: options.kind,
    currency: "usd",
    asOf: asOf.toISOString(),
    summary: summary2,
    rows: filtered.slice(options.skip, options.skip + options.take),
    pagination: { page: options.skip / options.take + 1, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / options.take)) }
  };
}

// packages/utils/commerce-analytics.ts
var ANALYTICS_TIMEZONE = "Asia/Ho_Chi_Minh";
var DAY_MS = 864e5;
var vnDay = (value) => new Date(new Date(value).getTime() + 7 * 36e5).toISOString().slice(0, 10);
function analyticsBucket(value, interval) {
  const day = /* @__PURE__ */ new Date(vnDay(value) + "T00:00:00.000Z");
  if (interval === "month")
    return day.toISOString().slice(0, 7);
  if (interval === "week")
    day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
}
function changeMetric(current, previous) {
  const difference = Math.round((current - previous) * 100) / 100;
  return { current, previous, difference, percent: previous === 0 ? current === 0 ? 0 : null : Math.round(difference / Math.abs(previous) * 1e4) / 100 };
}
function fillAnalyticsTimeline(rows, from, to, interval) {
  if (!from)
    return rows;
  const indexed = new Map(rows.map((row) => [row.date, row]));
  const result = [];
  const first = analyticsBucket(from, interval), last = analyticsBucket(to, interval);
  const cursor = /* @__PURE__ */ new Date((interval === "month" ? first + "-01" : first) + "T00:00:00.000Z");
  while ((interval === "month" ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10)) <= last) {
    const date = interval === "month" ? cursor.toISOString().slice(0, 7) : cursor.toISOString().slice(0, 10);
    result.push(indexed.get(date) ?? { date, grossSales: 0, discounts: 0, netSales: 0, units: 0, refundedAmount: 0 });
    if (interval === "month")
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else
      cursor.setUTCDate(cursor.getUTCDate() + (interval === "week" ? 7 : 1));
  }
  return result;
}

// packages/utils/commerce-analytics-options.ts
function analyticsOptions(query, audience, now = /* @__PURE__ */ new Date()) {
  if (audience === "admin" && ["customerId", "userId", "orderId", "email"].some((key) => query[key] !== void 0))
    throw new ForbiddenError("Administrator analytics do not expose customer or order records");
  const allowed = ["period", "from", "to", "interval", "q", "sort", "stock", "category", "page", "limit", "refresh", "view", "format", "shopId"];
  if (Object.keys(query).some((key) => !allowed.includes(key)))
    throw new ValidationError("Unsupported analytics filter");
  const preset = query.period ?? "30d";
  if (!["7d", "30d", "90d", "month", "year", "all", "custom"].includes(preset))
    throw new ValidationError("Invalid analytics period");
  const interval = query.interval ?? "auto";
  if (!["auto", "day", "week", "month"].includes(interval))
    throw new ValidationError("Invalid grouping interval");
  const parseDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new ValidationError("Choose both reporting dates");
    const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new ValidationError("Invalid reporting date");
    return /* @__PURE__ */ new Date(`${value}T00:00:00+07:00`);
  };
  const today = parseDate(vnDay(now));
  let from = null, to = now;
  if (preset === "custom") {
    from = parseDate(query.from);
    const end = new Date(parseDate(query.to).getTime() + DAY_MS - 1);
    if (end < from || end.getTime() - from.getTime() >= 366 * DAY_MS)
      throw new ValidationError("Choose a valid range of at most 366 days");
    to = new Date(Math.min(end.getTime(), now.getTime()));
    if (from > to)
      throw new ValidationError("The reporting period must start on or before today");
  } else {
    if (query.from !== void 0 || query.to !== void 0)
      throw new ValidationError("Use Custom dates for a date range");
    if (["7d", "30d", "90d"].includes(preset))
      from = new Date(today.getTime() - (Number(preset.slice(0, -1)) - 1) * DAY_MS);
    if (preset === "month")
      from = parseDate(vnDay(now).slice(0, 7) + "-01");
    if (preset === "year")
      from = parseDate(vnDay(now).slice(0, 4) + "-01-01");
  }
  const days = from ? (to.getTime() - from.getTime() + 1) / DAY_MS : 0;
  const grouping = interval === "auto" ? !from || days > 93 ? "month" : days > 31 ? "week" : "day" : interval;
  const previous = from ? { from: new Date(from.getTime() - (to.getTime() - from.getTime() + 1)).toISOString(), to: new Date(from.getTime() - 1).toISOString() } : null;
  const period = { preset, from: from?.toISOString() ?? null, to: to.toISOString(), interval: grouping, days, previous };
  const sort = query.sort ?? "netSales";
  if (!["netSales", "units", "stock", "coverage", "refunds", "lastSale"].includes(sort))
    throw new ValidationError("Invalid analytics sort");
  const stock = query.stock ?? "all";
  if (!["all", "low", "out", "noSales", "active", "archived"].includes(stock))
    throw new ValidationError("Invalid inventory filter");
  for (const key of ["q", "category", "refresh"])
    if (query[key] !== void 0 && (typeof query[key] !== "string" || String(query[key]).length > 200))
      throw new ValidationError("Invalid analytics search");
  const view = query.view ?? "products";
  if (!["products", "inventory", "shops", "categories", "timeline", "outcomes", "demand", "summary"].includes(view) || audience === "seller" && view === "shops")
    throw new ValidationError("Invalid report export");
  if (query.format !== void 0 && query.format !== "csv")
    throw new ValidationError("Invalid report format");
  return { period, sort, stock, search: String(query.q ?? "").trim().toLowerCase(), category: String(query.category ?? ""), refresh: String(query.refresh ?? ""), view, exportCsv: query.format === "csv", ...pageArgs(query) };
}

// packages/utils/commerce-analytics-pipeline.ts
var cents = (field) => ({ $toLong: { $round: [{ $multiply: [{ $ifNull: [field, 0] }, 100] }, 0] } });
var retained = { $and: [{ $eq: ["$paymentStatus", "Paid"] }, { $not: [{ $in: ["$status", ["Cancelled", "Returned", "Refunded"]] }] }] };
var sumIf = (field, condition = "$retained") => ({ $sum: { $cond: [condition, field, 0] } });
var dateString = (date, interval) => ({ $dateToString: { date: interval === "week" ? { $dateTrunc: { date, unit: "week", startOfWeek: "Monday", timezone: ANALYTICS_TIMEZONE } } : date, format: interval === "month" ? "%Y-%m" : "%Y-%m-%d", timezone: ANALYTICS_TIMEZONE } });
function analyticsBasePipeline(range, shopId) {
  return [
    { $match: { currency: "usd", createdAt: { ...range.from ? { $gte: { $date: range.from } } : {}, $lte: { $date: range.to } }, ...shopId ? { shopId: { $oid: shopId } } : {} } },
    { $lookup: { from: "orderItems", let: { orderId: "$_id" }, pipeline: [
      { $match: { $expr: { $eq: ["$orderId", "$$orderId"] } } },
      { $sort: { _id: 1 } },
      { $project: { productId: 1, variantId: 1, sku: 1, title: 1, color: 1, size: 1, quantity: 1, totalPrice: 1 } },
      { $set: { grossCents: cents("$totalPrice") } }
    ], as: "lines" } },
    { $set: { retained, totalCents: cents("$totalAmount"), discountCents: cents("$discount"), shippingCents: cents("$shippingFee"), grossCents: { $sum: "$lines.grossCents" }, units: { $sum: "$lines.quantity" } } },
    // Cumulative allocation conserves the exact discount cent across lines/SKUs.
    { $set: { allocated: { $reduce: { input: "$lines", initialValue: { gross: 0, discount: 0, lines: [] }, in: {
      $let: { vars: { nextGross: { $add: ["$$value.gross", "$$this.grossCents"] } }, in: {
        $let: { vars: { nextDiscount: { $cond: [{ $gt: ["$grossCents", 0] }, { $toLong: { $round: [{ $divide: [{ $multiply: ["$$nextGross", "$discountCents"] }, "$grossCents"] }, 0] } }, 0] } }, in: {
          gross: "$$nextGross",
          discount: "$$nextDiscount",
          lines: { $concatArrays: ["$$value.lines", [{ $mergeObjects: ["$$this", { discountCents: { $subtract: ["$$nextDiscount", "$$value.discount"] }, netCents: { $subtract: ["$$this.grossCents", { $subtract: ["$$nextDiscount", "$$value.discount"] }] } }] }]] }
        } }
      } }
    } } } } },
    { $set: { lines: "$allocated.lines", netCents: { $subtract: ["$grossCents", "$discountCents"] } } }
  ];
}
var productGroup = {
  _id: { product: "$lines.productId", shop: "$shopId" },
  name: { $first: "$lines.title" },
  units: sumIf("$lines.quantity"),
  grossCents: sumIf("$lines.grossCents"),
  discountCents: sumIf("$lines.discountCents"),
  netCents: sumIf("$lines.netCents"),
  lastSaleAt: { $max: { $cond: ["$retained", "$createdAt", null] } },
  cancelledUnits: sumIf("$lines.quantity", { $eq: ["$status", "Cancelled"] }),
  returnedUnits: sumIf("$lines.quantity", { $eq: ["$status", "Returned"] }),
  refundedUnits: sumIf("$lines.quantity", { $or: [{ $eq: ["$status", "Refunded"] }, { $eq: ["$paymentStatus", "Refunded"] }] })
};
function analyticsPipeline(range, shopId, seller) {
  return [...analyticsBasePipeline(range, shopId), { $facet: {
    totals: [{ $group: {
      _id: null,
      grossCents: sumIf("$grossCents"),
      discountCents: sumIf("$discountCents"),
      netCents: sumIf("$netCents"),
      shippingCents: sumIf("$shippingCents"),
      paidCents: sumIf("$totalCents"),
      units: sumIf("$units"),
      firstActivity: { $min: "$createdAt" },
      refundedCents: sumIf("$totalCents", { $eq: ["$paymentStatus", "Refunded"] }),
      awaitingCents: sumIf("$totalCents", { $and: [{ $eq: ["$paymentStatus", "Paid"] }, { $in: ["$status", ["Cancelled", "Returned"]] }] }),
      feesCents: sumIf({ $ifNull: ["$platformFeeCents", 0] }),
      feeKnown: sumIf(1, { $and: ["$retained", { $ne: [{ $ifNull: ["$platformFeeCents", null] }, null] }] }),
      retainedCount: sumIf(1),
      unallocatedCents: sumIf({ $subtract: ["$discountCents", "$allocated.discount"] })
    } }, { $project: { _id: 0 } }],
    products: [{ $unwind: "$lines" }, { $group: productGroup }, { $project: { _id: 0, id: { $toString: "$_id.product" }, shopId: { $toString: "$_id.shop" }, name: 1, units: 1, grossCents: 1, discountCents: 1, netCents: 1, cancelledUnits: 1, returnedUnits: 1, refundedUnits: 1, lastSaleAt: { $cond: ["$lastSaleAt", { $dateToString: { date: "$lastSaleAt", format: "%Y-%m-%dT%H:%M:%S.%LZ", timezone: "UTC" } }, null] } } }],
    timeline: [{ $group: { _id: dateString("$createdAt", range.interval), grossCents: sumIf("$grossCents"), discountCents: sumIf("$discountCents"), netCents: sumIf("$netCents"), units: sumIf("$units"), refundedCents: sumIf("$totalCents", { $eq: ["$paymentStatus", "Refunded"] }) } }, { $project: { _id: 0, date: "$_id", grossCents: 1, discountCents: 1, netCents: 1, units: 1, refundedCents: 1 } }, { $sort: { date: 1 } }],
    outcomes: [{ $unwind: "$lines" }, { $group: { _id: "$status", units: { $sum: "$lines.quantity" }, grossCents: { $sum: "$lines.grossCents" }, netCents: { $sum: "$lines.netCents" } } }, { $project: { _id: 0, status: "$_id", units: 1, grossCents: 1, netCents: 1 } }],
    demand: [{ $match: { retained: true } }, { $group: { _id: { weekday: { $dayOfWeek: { date: "$createdAt", timezone: ANALYTICS_TIMEZONE } }, hour: { $hour: { date: "$createdAt", timezone: ANALYTICS_TIMEZONE } } }, units: { $sum: "$units" }, netCents: { $sum: "$netCents" } } }, { $project: { _id: 0, weekday: { $mod: [{ $add: ["$_id.weekday", 5] }, 7] }, hour: "$_id.hour", units: 1, netCents: 1 } }],
    ...seller ? {
      customers: [{ $match: { retained: true } }, { $group: { _id: "$userId", purchases: { $sum: 1 } } }, { $group: { _id: null, customers: { $sum: 1 }, repeatCustomers: { $sum: { $cond: [{ $gte: ["$purchases", 2] }, 1, 0] } } } }, { $project: { _id: 0 } }],
      payments: [{ $group: { _id: "$paymentStatus", count: { $sum: 1 }, cents: { $sum: "$totalCents" } } }, { $project: { _id: 0, status: "$_id", count: 1, cents: 1 } }],
      statuses: [{ $group: { _id: "$status", count: { $sum: 1 } } }, { $project: { _id: 0, status: "$_id", count: 1 } }]
    } : {}
  } }];
}
function productDetailPipeline(range, productId, shopId) {
  return [...analyticsBasePipeline(range, shopId), { $unwind: "$lines" }, { $match: { "lines.productId": { $oid: productId }, retained: true } }, { $facet: {
    variants: [{ $group: { _id: { $ifNull: [{ $toString: "$lines.variantId" }, "base"] }, sku: { $first: "$lines.sku" }, color: { $first: "$lines.color" }, size: { $first: "$lines.size" }, units: { $sum: "$lines.quantity" }, grossCents: { $sum: "$lines.grossCents" }, discountCents: { $sum: "$lines.discountCents" }, netCents: { $sum: "$lines.netCents" } } }, { $project: { _id: 0, id: "$_id", sku: 1, color: 1, size: 1, units: 1, grossCents: 1, discountCents: 1, netCents: 1 } }],
    timeline: [{ $group: { _id: dateString("$createdAt", range.interval), units: { $sum: "$lines.quantity" }, grossCents: { $sum: "$lines.grossCents" }, discountCents: { $sum: "$lines.discountCents" }, netCents: { $sum: "$lines.netCents" } } }, { $project: { _id: 0, date: "$_id", units: 1, grossCents: 1, discountCents: 1, netCents: 1 } }, { $sort: { date: 1 } }]
  } }];
}

// packages/utils/commerce-analytics-report.ts
var number = (value) => Number(value?.$numberLong ?? value?.$numberDecimal ?? value ?? 0);
var money = (value) => number(value) / 100;
var percentage = (value, total) => total ? Math.round(value / total * 1e4) / 100 : 0;
var catalogSelect = {
  id: true,
  title: true,
  category: true,
  brand: true,
  shopId: true,
  status: true,
  isDeleted: true,
  stock: true,
  sale_price: true,
  variants: { select: { id: true, sku: true, color: true, size: true, active: true, stock: true, price: true } },
  shop: { select: { name: true, sellers: { select: { suspendedAt: true, suspendedUntil: true } } } }
};
async function readCatalog(shopId) {
  const products = [];
  let after;
  while (true) {
    const batch = await prisma_default.products.findMany({ where: { ...shopId ? { shopId } : {}, ...after ? { id: { gt: after } } : {} }, orderBy: { id: "asc" }, take: 1e3, select: catalogSelect });
    products.push(...batch);
    if (batch.length < 1e3)
      break;
    after = batch[batch.length - 1].id;
  }
  return products;
}
var rowKey = (row) => `${row.shopId}:${row.id}`;
var cache = /* @__PURE__ */ new Map();
function timeRows(rows) {
  return rows.map((row) => ({ date: String(row.date), grossSales: money(row.grossCents), discounts: money(row.discountCents), netSales: money(row.netCents), units: number(row.units), refundedAmount: money(row.refundedCents) }));
}
function summary(raw) {
  const totals = raw.totals?.[0] ?? {};
  return {
    grossSales: money(totals.grossCents),
    discounts: money(totals.discountCents),
    netSales: money(totals.netCents),
    shipping: money(totals.shippingCents),
    paidAmount: money(totals.paidCents),
    refundedAmount: money(totals.refundedCents),
    awaitingRefundAmount: money(totals.awaitingCents),
    platformFees: money(totals.feesCents),
    feeCoveragePercent: percentage(number(totals.feeKnown), number(totals.retainedCount)),
    units: number(totals.units),
    productsSold: (raw.products ?? []).filter((row) => number(row.units) > 0).length,
    averageUnitPrice: number(totals.units) ? Math.round(number(totals.netCents) / number(totals.units)) / 100 : 0,
    reconciliationDifference: money(number(totals.paidCents) - (number(totals.netCents) + number(totals.shippingCents))),
    unallocatedDiscount: money(totals.unallocatedCents)
  };
}
function productRows(catalog, rawRows, previousRows, days, netTotal, asOf) {
  const metadata = new Map(catalog.map((product) => [product.id, product]));
  const raw = new Map(rawRows.map((row) => [rowKey(row), row]));
  for (const product of catalog)
    if (!raw.has(rowKey(product)))
      raw.set(rowKey(product), { id: product.id, shopId: product.shopId });
  for (const row of previousRows)
    if (!raw.has(rowKey(row)))
      raw.set(rowKey(row), { id: row.id, shopId: row.shopId, name: row.name });
  const previous = new Map(previousRows.map((row) => [rowKey(row), row]));
  return [...raw.values()].map((row) => {
    const candidate = metadata.get(row.id), product = candidate?.shopId === row.shopId ? candidate : void 0, owner = product?.shop.sellers;
    const shopSuspended = !!owner?.suspendedAt && (!owner.suspendedUntil || owner.suspendedUntil > asOf);
    const active = !!product && !product.isDeleted && product.status === "Active" && !shopSuspended;
    const activeVariants = product?.variants.filter((variant) => variant.active) ?? [];
    const rawStock = product ? Math.max(0, product.stock) : 0;
    const stock = product?.variants.length ? Math.min(rawStock, activeVariants.reduce((n, variant) => n + Math.max(0, variant.stock), 0)) : rawStock;
    const availableStock = active ? stock : 0;
    const units = number(row.units), netSales = money(row.netCents), previousNetSales = money(previous.get(rowKey(row))?.netCents);
    return {
      id: row.id,
      shopId: row.shopId,
      name: product?.title ?? row.name ?? "Archived product",
      shopName: product?.shop.name ?? "Archived shop",
      category: product?.category ?? "Archived / unknown category",
      brand: product?.brand ?? "",
      status: product?.status ?? "Archived",
      archived: !product || product.isDeleted,
      shopSuspended,
      units,
      grossSales: money(row.grossCents),
      discounts: money(row.discountCents),
      netSales,
      previousNetSales,
      changePercent: changeMetric(netSales, previousNetSales).percent,
      sharePercent: percentage(netSales, netTotal),
      averageUnitPrice: units ? Math.round(number(row.netCents) / units) / 100 : 0,
      stock: product ? rawStock : null,
      availableStock,
      stockValue: product ? Math.round(availableStock * product.sale_price * 100) / 100 : 0,
      coverageDays: units && days > 0 && active ? Math.round(availableStock / (units / Math.max(1, days)) * 10) / 10 : null,
      lastSaleAt: row.lastSaleAt ?? null,
      cancelledUnits: number(row.cancelledUnits),
      returnedUnits: number(row.returnedUnits),
      refundedUnits: number(row.refundedUnits)
    };
  });
}
function groups(rows, by, total) {
  const result = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (row.archived && !row.units && !row.cancelledUnits && !row.returnedUnits && !row.refundedUnits)
      continue;
    const id = row[by];
    const group = result.get(id) ?? { id, name: by === "category" ? row.category : row.shopName, units: 0, netSales: 0, grossSales: 0, products: 0, availableStock: 0, sharePercent: 0, netCents: 0, grossCents: 0 };
    group.units += row.units;
    group.netCents += Math.round(row.netSales * 100);
    group.grossCents += Math.round(row.grossSales * 100);
    group.products++;
    group.availableStock += row.availableStock;
    result.set(id, group);
  }
  return [...result.values()].map(({ netCents, grossCents, ...row }) => ({ ...row, netSales: netCents / 100, grossSales: grossCents / 100, sharePercent: percentage(netCents / 100, total) })).sort((a, b) => b.netSales - a.netSales || a.name.localeCompare(b.name));
}
async function buildAnalytics(period, audience, shopId, asOf) {
  const seller = audience === "seller";
  const [currentResult, previousResult, catalog, pendingReports, severities] = await Promise.all([
    prisma_default.orders.aggregateRaw({ pipeline: analyticsPipeline(period, shopId, seller) }),
    period.previous ? prisma_default.orders.aggregateRaw({ pipeline: analyticsPipeline({ ...period.previous, interval: period.interval }, shopId, seller) }) : Promise.resolve([]),
    readCatalog(shopId),
    prisma_default.productReport.count({ where: { status: "Pending", ...shopId ? { shopId } : {} } }),
    prisma_default.productViolation.groupBy({ by: ["severity"], where: { ...shopId ? { shopId } : {}, createdAt: { ...period.from ? { gte: new Date(period.from) } : {}, lte: new Date(period.to) } }, _count: { _all: true } })
  ]);
  const raw = currentResult[0] ?? {}, previous = previousResult[0] ?? {};
  const firstActivity = raw.totals?.[0]?.firstActivity;
  const firstDate = firstActivity?.$date ?? firstActivity;
  const effectivePeriod = { ...period, ...!period.from && firstDate ? { from: new Date(firstDate).toISOString(), days: Math.max(1, (new Date(period.to).getTime() - new Date(firstDate).getTime() + 1) / DAY_MS) } : {} };
  if (period.interval === "day" && effectivePeriod.days > 366 || period.interval === "week" && effectivePeriod.days > 366 * 7)
    throw new ValidationError("Choose monthly grouping for this long reporting period");
  const totals = summary(raw), previousTotals = summary(previous);
  const rows = productRows(catalog, raw.products ?? [], previous.products ?? [], effectivePeriod.days, totals.netSales, asOf);
  const comparison = period.previous ? Object.fromEntries(["netSales", "units", "paidAmount", "refundedAmount"].map((key) => [key, changeMetric(totals[key], previousTotals[key])])) : null;
  const activeRows = rows.filter((row) => !row.archived && row.status === "Active" && !row.shopSuspended);
  const activeIds = new Set(activeRows.map((row) => row.id));
  const activeSkus = catalog.filter((product) => activeIds.has(product.id)).flatMap((product) => product.variants.filter((variant) => variant.active));
  const inventory = {
    products: catalog.filter((product) => !product.isDeleted).length,
    activeProducts: activeRows.length,
    availableUnits: rows.reduce((n, row) => n + row.availableStock, 0),
    recordedUnits: catalog.filter((product) => !product.isDeleted).reduce((n, product) => n + Math.max(0, product.stock), 0),
    retailValue: rows.reduce((n, row) => n + Math.round(row.stockValue * 100), 0) / 100,
    lowStock: activeRows.filter((row) => row.availableStock > 0 && row.availableStock <= 5).length,
    outOfStock: activeRows.filter((row) => !row.availableStock).length,
    noSales: activeRows.filter((row) => !row.units).length,
    activeSkus: activeSkus.length,
    lowStockSkus: activeSkus.filter((variant) => variant.stock > 0 && variant.stock <= 5).length,
    outOfStockSkus: activeSkus.filter((variant) => variant.stock <= 0).length,
    inconsistentStock: catalog.filter((product) => !product.isDeleted && product.variants.length && product.stock !== product.variants.filter((variant) => variant.active).reduce((n, variant) => n + Math.max(0, variant.stock), 0)).length
  };
  const customers = raw.customers?.[0] ?? {}, previousCustomers = previous.customers?.[0] ?? {};
  const sellerMetrics = seller ? { orders: number(raw.totals?.[0]?.retainedCount), customers: number(customers.customers), repeatCustomers: number(customers.repeatCustomers), repeatRate: percentage(number(customers.repeatCustomers), number(customers.customers)), averageOrderValue: number(raw.totals?.[0]?.retainedCount) ? Math.round(number(raw.totals?.[0]?.paidCents) / number(raw.totals?.[0]?.retainedCount)) / 100 : 0, payments: (raw.payments ?? []).map((row) => ({ status: String(row.status), count: number(row.count), amount: money(row.cents) })) } : void 0;
  if (comparison && sellerMetrics) {
    comparison.orders = changeMetric(sellerMetrics.orders, number(previous.totals?.[0]?.retainedCount));
    comparison.customers = changeMetric(sellerMetrics.customers, number(previousCustomers.customers));
  }
  const statusCounts = new Map((raw.statuses ?? []).map((row) => [row.status, number(row.count)]));
  const report = {
    audience,
    currency: "usd",
    generatedAt: asOf.toISOString(),
    period: effectivePeriod,
    summary: totals,
    comparison,
    inventory,
    timeline: fillAnalyticsTimeline(timeRows(raw.timeline ?? []), effectivePeriod.from, effectivePeriod.to, effectivePeriod.interval),
    outcomes: [.../* @__PURE__ */ new Set([...(raw.outcomes ?? []).map((row) => row.status), ...seller ? [...statusCounts.keys()] : []])].map((status) => {
      const row = (raw.outcomes ?? []).find((row2) => row2.status === status) ?? {};
      return { status: String(status), units: number(row.units), grossSales: money(row.grossCents), netSales: money(row.netCents), ...seller ? { count: number(statusCounts.get(status)) } : {} };
    }),
    demand: (raw.demand ?? []).map((row) => ({ weekday: number(row.weekday), hour: number(row.hour), units: number(row.units), netSales: money(row.netCents) })),
    categories: groups(rows, "category", totals.netSales),
    ...audience === "admin" ? { shops: groups(rows, "shopId", totals.netSales) } : {},
    ...sellerMetrics ? { seller: sellerMetrics } : {},
    governance: { pendingReports, violations: severities.reduce((n, row) => n + row._count._all, 0), bySeverity: severities.map((row) => ({ severity: row.severity, count: row._count._all })) }
  };
  return { report, rows, catalog };
}
async function cachedAnalytics(query, audience, shopId) {
  const now = /* @__PURE__ */ new Date(), options = analyticsOptions(query, audience, now);
  const key = JSON.stringify([audience, shopId ?? "all", options.period.preset, query.from, query.to, query.interval, options.refresh, vnDay(now)]);
  let entry = cache.get(key);
  if (!entry || entry.expires <= now.getTime()) {
    for (const [key2, value] of cache)
      if (value.expires <= now.getTime())
        cache.delete(key2);
    if (cache.size >= 8)
      cache.delete(cache.keys().next().value);
    entry = { expires: now.getTime() + 2e4, value: buildAnalytics(options.period, audience, shopId, now) };
    cache.set(key, entry);
    entry.value.catch(() => {
      if (cache.get(key) === entry)
        cache.delete(key);
    });
  }
  return { ...await entry.value, options };
}
function filteredProducts(rows, options) {
  return rows.filter((row) => (!options.search || [row.name, row.shopName, row.brand].some((value) => value.toLowerCase().includes(options.search))) && (!options.category || row.category === options.category) && (options.stock === "all" ? !row.archived || row.units > 0 || row.previousNetSales !== 0 || row.cancelledUnits > 0 || row.returnedUnits > 0 || row.refundedUnits > 0 : options.stock === "archived" ? row.archived : !row.archived && (options.stock === "low" ? row.availableStock > 0 && row.availableStock <= 5 : options.stock === "out" ? row.status === "Active" && !row.shopSuspended && row.availableStock === 0 : options.stock === "noSales" ? row.units === 0 && row.status === "Active" && !row.shopSuspended : row.status === "Active" && !row.shopSuspended))).sort((a, b) => {
    const difference = options.sort === "stock" ? b.availableStock - a.availableStock : options.sort === "coverage" ? (a.coverageDays ?? Infinity) - (b.coverageDays ?? Infinity) : options.sort === "refunds" ? b.refundedUnits - a.refundedUnits : options.sort === "lastSale" ? (b.lastSaleAt ?? "").localeCompare(a.lastSaleAt ?? "") : b[options.sort] - a[options.sort];
    return difference || a.id.localeCompare(b.id) || a.shopId.localeCompare(b.shopId);
  });
}
function analyticsCsv(headers, rows) {
  return rows.length ? csv(rows) : csv([Object.fromEntries(headers.map((key) => [key, ""]))]).split("\r\n")[0];
}
async function commerceAnalytics(query, audience, shopId) {
  if (audience === "seller" && !shopId)
    throw new NotFoundError("No shop linked to this seller");
  const { report, rows, options } = await cachedAnalytics(query, audience, shopId);
  const filtered = filteredProducts(rows, options);
  if (options.exportCsv) {
    let exported = [], headers = [];
    if (options.view === "products" || options.view === "inventory") {
      headers = ["product", "shop", "category", "brand", "listingStatus", "archived", "unitsSold", "grossSalesUSD", "allocatedDiscountUSD", "netProductSalesUSD", "previousNetSalesUSD", "changePercent", "salesSharePercent", "averageNetUnitPriceUSD", "availableStock", "recordedStock", "estimatedStockRetailValueUSD", "estimatedCoverageDays", "cancelledUnits", "returnedUnits", "refundedUnits", "lastSaleUTC"];
      exported = filtered.map((row) => ({ product: row.name, shop: row.shopName, category: row.category, brand: row.brand, listingStatus: row.status, archived: row.archived, unitsSold: row.units, grossSalesUSD: row.grossSales, allocatedDiscountUSD: row.discounts, netProductSalesUSD: row.netSales, previousNetSalesUSD: row.previousNetSales, changePercent: report.comparison ? row.changePercent ?? "" : "", salesSharePercent: row.sharePercent, averageNetUnitPriceUSD: row.averageUnitPrice, availableStock: row.availableStock, recordedStock: row.stock ?? "", estimatedStockRetailValueUSD: row.stockValue, estimatedCoverageDays: row.coverageDays ?? "", cancelledUnits: row.cancelledUnits, returnedUnits: row.returnedUnits, refundedUnits: row.refundedUnits, lastSaleUTC: row.lastSaleAt ?? "" }));
    } else if (options.view === "summary") {
      headers = ["metric", "value", "periodFromUTC", "periodToUTC"];
      exported = Object.entries(report.summary).map(([metric, value]) => ({ metric, value, periodFromUTC: report.period.from ?? "", periodToUTC: report.period.to }));
    } else {
      const source = options.view === "shops" ? report.shops ?? [] : report[options.view];
      headers = options.view === "timeline" ? ["date", "grossSalesUSD", "discountUSD", "netSalesUSD", "units", "refundedAmountUSD"] : options.view === "demand" ? ["weekdayMondayZero", "hourVietnamTime", "units", "netSalesUSD"] : options.view === "outcomes" ? ["status", "units", "grossSalesUSD", "netSalesUSD", ...audience === "seller" ? ["count"] : []] : ["name", "units", "netSalesUSD", "grossSalesUSD", "products", "availableStock", "salesSharePercent"];
      exported = source.map((row) => options.view === "timeline" ? { date: row.date, grossSalesUSD: row.grossSales, discountUSD: row.discounts, netSalesUSD: row.netSales, units: row.units, refundedAmountUSD: row.refundedAmount } : options.view === "demand" ? { weekdayMondayZero: row.weekday, hourVietnamTime: row.hour, units: row.units, netSalesUSD: row.netSales } : options.view === "outcomes" ? { status: row.status, units: row.units, grossSalesUSD: row.grossSales, netSalesUSD: row.netSales, ...audience === "seller" ? { count: row.count } : {} } : { name: row.name, units: row.units, netSalesUSD: row.netSales, grossSalesUSD: row.grossSales, products: row.products, availableStock: row.availableStock, salesSharePercent: row.sharePercent });
    }
    return { csv: analyticsCsv(headers, exported), view: options.view };
  }
  return { ...report, products: { rows: filtered.slice(options.skip, options.skip + options.take), total: filtered.length, page: options.skip / options.take + 1, totalPages: Math.max(1, Math.ceil(filtered.length / options.take)) } };
}
async function productAnalyticsDetail(productId, query, audience, shopId) {
  if (audience === "seller" && !shopId)
    throw new NotFoundError();
  const { report, rows, catalog } = await cachedAnalytics(query, audience, shopId);
  const product = rows.find((row) => row.id === productId);
  if (!product)
    throw new NotFoundError("Product is not part of this shop or reporting history");
  const [result, engagement, reviews] = await Promise.all([
    prisma_default.orders.aggregateRaw({ pipeline: productDetailPipeline(report.period, productId, shopId) }),
    prisma_default.productAnalytics.findUnique({ where: { productId }, select: { views: true, cartAdds: true, wishListAdds: true } }),
    prisma_default.productReviews.aggregate({ where: { productId }, _count: { _all: true }, _avg: { rating: true } })
  ]);
  const raw = result[0] ?? {};
  const versions = new Map((raw.variants ?? []).map((row) => [row.id, row]));
  const current = catalog.find((row) => row.id === productId);
  for (const variant of current?.variants ?? [])
    if (!versions.has(variant.id))
      versions.set(variant.id, { id: variant.id });
  if (current && !current.variants.length && !versions.has("base"))
    versions.set("base", { id: "base" });
  const variants = [...versions.values()].map((value) => {
    const row = value, variant = current?.variants.find((variant2) => variant2.id === row.id);
    return { id: String(row.id), sku: variant?.sku ?? row.sku ?? (row.id === "base" ? "Standard" : "Archived SKU"), color: variant?.color ?? row.color ?? "", size: variant?.size ?? row.size ?? "", active: row.id === "base" ? !!current && !current.variants.length : variant?.active ?? false, stock: variant ? Math.max(0, variant.stock) : row.id === "base" && current && !current.variants.length ? current.stock : null, units: number(row.units), grossSales: money(row.grossCents), discounts: money(row.discountCents), netSales: money(row.netCents) };
  }).sort((a, b) => b.netSales - a.netSales || a.sku.localeCompare(b.sku));
  return {
    product,
    period: report.period,
    generatedAt: report.generatedAt,
    timeline: fillAnalyticsTimeline(timeRows(raw.timeline ?? []), report.period.from, report.period.to, report.period.interval),
    variants,
    engagement: { views: engagement?.views ?? 0, cartAdds: engagement?.cartAdds ?? 0, wishListAdds: engagement?.wishListAdds ?? 0, reviews: reviews._count._all, averageRating: reviews._avg.rating }
  };
}

// packages/utils/commerce-customer-analytics.ts
async function customerAnalyticsDetail(customerId, query, shopId) {
  if (!shopId)
    throw new NotFoundError();
  const now = /* @__PURE__ */ new Date(), options = analyticsOptions(query, "seller", now);
  const where = { shopId, userId: customerId, currency: "usd", paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] }, createdAt: { lte: now } };
  const all = purchaseStatistics(), selected = purchaseStatistics();
  const timeline = /* @__PURE__ */ new Map();
  let first = null, last = null, periodFirst = null, periodLast = null;
  let customer;
  const earliest = (a, b) => a === null || b.localeCompare(a) < 0 ? b : a;
  const latest = (a, b) => a === null || b.localeCompare(a) > 0 ? b : a;
  let after;
  while (true) {
    const batch = await prisma_default.orders.findMany({
      where: { ...where, ...after ? { id: { gt: after } } : {} },
      orderBy: { id: "asc" },
      take: 1e3,
      select: { id: true, userId: true, totalAmount: true, createdAt: true, user: { select: { name: true, email: true } }, items: { select: { productId: true, title: true, quantity: true, totalPrice: true } } }
    });
    for (const order of batch) {
      const date = order.createdAt.toISOString();
      customer ??= { id: customerId, name: order.user?.name ?? "Deleted customer", email: order.user?.email ?? "" };
      first = earliest(first, date);
      last = latest(last, date);
      all.add(order);
      if ((!options.period.from || date >= options.period.from) && date <= options.period.to) {
        selected.add(order);
        periodFirst = earliest(periodFirst, date);
        periodLast = latest(periodLast, date);
        const key = analyticsBucket(date, options.period.interval), point = timeline.get(key) ?? { amountCents: 0, units: 0, orders: 0 };
        point.amountCents += Math.round(order.totalAmount * 100);
        point.units += order.items.reduce((n, item) => n + item.quantity, 0);
        point.orders++;
        timeline.set(key, point);
      }
    }
    if (batch.length < 1e3)
      break;
    after = batch[batch.length - 1].id;
  }
  if (!customer)
    throw new NotFoundError("This customer has no qualifying purchases in your shop");
  const lifetime = all.result("customers").summary, inPeriod = selected.result("customers").summary;
  const products = selected.result("products").rows.map((row) => ({ id: row.id, name: row.name, units: row.units, orders: row.orders, grossSales: row.amount })).sort((a, b) => b.grossSales - a.grossSales || a.id.localeCompare(b.id));
  if (options.exportCsv)
    return { csv: analyticsCsv(["product", "unitsPurchased", "paidOrders", "grossProductSpendUSD"], products.map((row) => ({ product: row.name, unitsPurchased: row.units, paidOrders: row.orders, grossProductSpendUSD: row.grossSales }))) };
  const purchases = await prisma_default.orders.findMany({
    where: { ...where, createdAt: { ...options.period.from ? { gte: new Date(options.period.from) } : {}, lte: new Date(options.period.to) } },
    skip: options.skip,
    take: options.take,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, orderNumber: true, createdAt: true, status: true, totalAmount: true, items: { select: { title: true, quantity: true, totalPrice: true } } }
  });
  const emptyTimeline = fillAnalyticsTimeline([], options.period.from ?? first, options.period.to, options.period.interval);
  return {
    customer,
    generatedAt: now.toISOString(),
    period: options.period,
    summary: { orders: inPeriod.orders, units: inPeriod.units, products: inPeriod.products, totalSpent: inPeriod.totalSpent, averageOrderValue: inPeriod.averageOrderValue, firstPurchase: periodFirst, lastPurchase: periodLast },
    lifetime: { orders: lifetime.orders, units: lifetime.units, products: lifetime.products, totalSpent: lifetime.totalSpent, firstPurchase: first, lastPurchase: last },
    products,
    timeline: emptyTimeline.map((point) => ({ date: point.date, amount: (timeline.get(point.date)?.amountCents ?? 0) / 100, units: timeline.get(point.date)?.units ?? 0, orders: timeline.get(point.date)?.orders ?? 0 })),
    purchases: purchases.map((order) => ({ ...order, createdAt: order.createdAt.toISOString(), units: order.items.reduce((n, item) => n + item.quantity, 0) })),
    pagination: { page: options.skip / options.take + 1, total: inPeriod.orders, totalPages: Math.max(1, Math.ceil(inPeriod.orders / options.take)) }
  };
}

// apps/product-service/src/controllers/statistics.controller.ts
var sellerStatistics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId)
    throw new NotFoundError("No shop linked to this seller");
  const report = await commerceStatistics(req.query, shopId);
  res.setHeader("Cache-Control", "no-store");
  if ("csv" in report) {
    res.attachment(`seller-${report.kind}-statistics.csv`).type("text/csv").send(report.csv);
    return;
  }
  res.json(report);
});
var sellerAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId)
    throw new NotFoundError("No shop linked to this seller");
  const report = await commerceAnalytics(req.query, "seller", shopId);
  res.setHeader("Cache-Control", "no-store");
  if ("csv" in report) {
    res.attachment(`seller-${report.view}-analytics.csv`).type("text/csv").send(report.csv);
    return;
  }
  res.json(report);
});
var sellerProductAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId)
    throw new NotFoundError();
  res.setHeader("Cache-Control", "no-store");
  res.json(await productAnalyticsDetail(objectId(req.params.id), req.query, "seller", shopId));
});
var sellerCustomerAnalytics = handle(async (req, res) => {
  const shopId = req.seller?.shop?.id;
  if (!shopId)
    throw new NotFoundError();
  const report = await customerAnalyticsDetail(objectId(req.params.id), req.query, shopId);
  res.setHeader("Cache-Control", "no-store");
  if ("csv" in report) {
    res.attachment("customer-products.csv").type("text/csv").send(report.csv);
    return;
  }
  res.json(report);
});

// packages/utils/product-moderation.ts
var import_node_crypto = require("node:crypto");
var violationCategories = ["Prohibited", "Counterfeit", "Misleading", "Unsafe", "Other"];
var reportFields = { id: true, productId: true, shopId: true, source: true, category: true, reason: true, snapshot: true, status: true, resolutionReason: true, resolvedAt: true, violationId: true, createdAt: true };
var violationFields = { id: true, productId: true, shopId: true, sellerId: true, productTitle: true, category: true, reason: true, severity: true, productAction: true, sellerAction: true, suspendedUntil: true, occurrence: true, followupStatus: true, affectedOrders: true, createdAt: true };
function listingSnapshot(product) {
  return { title: product.title, category: product.category, description: product.detailed_description.replace(/<[^>]*>/g, " ").slice(0, 12e3) };
}
async function submitProductReport(productId, reporterId, source, category, reason, expectedSnapshot) {
  if (!violationCategories.includes(category))
    throw new ValidationError("Invalid violation category");
  const product = await prisma_default.products.findUnique({ where: { id: productId } });
  if (!product || source === "Customer" && (product.status !== "Active" || product.isDeleted))
    throw new NotFoundError("Product is unavailable");
  const snapshot = listingSnapshot(product);
  if (expectedSnapshot && JSON.stringify(snapshot) !== JSON.stringify(expectedSnapshot))
    throw new ValidationError("The listing changed during the AI scan. Review the updated listing again.");
  const version = (0, import_node_crypto.createHash)("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const dedupeKey = source === "Admin" ? (0, import_node_crypto.randomUUID)() : `${source}:${reporterId}:${productId}:${version}`;
  return prisma_default.productReport.upsert({ where: { dedupeKey }, update: {}, create: { productId, shopId: product.shopId, reporterId, source, category, reason, snapshot, dedupeKey }, select: reportFields });
}

// apps/product-service/src/controllers/product-reports.controller.ts
var reportProduct = handle(async (req, res) => {
  const productId = objectId(req.params.id), reason = textField(req.body.reason, "report reason", 2e3);
  const recent = await prisma_default.productReport.count({ where: { reporterId: req.user.id, source: "Customer", createdAt: { gte: new Date(Date.now() - 864e5) } } });
  if (recent >= 10)
    throw new RateLimitError("You can submit up to 10 product reports per day");
  const report = await submitProductReport(productId, req.user.id, "Customer", req.body.category, reason);
  res.status(201).json({ id: report.id, status: report.status, message: "Your report has been received for review" });
});
var sellerViolations = handle(async (req, res) => {
  if (!req.seller?.shop?.id)
    throw new ForbiddenError();
  const where = { sellerId: req.seller.id };
  const [rows, total] = await Promise.all([prisma_default.productViolation.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" }, select: violationFields }), prisma_default.productViolation.count({ where })]);
  res.setHeader("Cache-Control", "no-store");
  res.json({ rows, total });
});
var sellerModerationTasks = handle(async (req, res) => {
  if (!req.seller?.shop?.id)
    throw new ForbiddenError();
  const status = req.query.status ?? "Pending";
  if (status !== "Pending" && status !== "Resolved")
    throw new ValidationError("Invalid task status");
  const where = { shopId: req.seller.shop.id, status };
  const [tasks, total] = await Promise.all([prisma_default.moderationOrderTask.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "asc" } }), prisma_default.moderationOrderTask.count({ where })]);
  const orders = await prisma_default.orders.findMany({ where: { id: { in: tasks.map((task) => task.orderId) }, shopId: req.seller.shop.id }, select: { id: true, orderNumber: true, status: true, paymentStatus: true, stripePaymentId: true, moderationHold: true } });
  res.setHeader("Cache-Control", "no-store");
  res.json({ rows: tasks.map((task) => ({ ...task, order: orders.find((order) => order.id === task.orderId) })), total });
});
var resolveModerationTask = handle(async (req, res) => {
  if (!req.seller?.shop?.id)
    throw new ForbiddenError();
  const id = objectId(req.params.id), resolution = textField(req.body.resolution, "resolution", 2e3);
  await transaction(async (tx) => {
    const task = await tx.moderationOrderTask.findFirst({ where: { id, shopId: req.seller.shop.id } });
    if (!task)
      throw new ForbiddenError();
    const order = await tx.orders.findFirst({ where: { id: task.orderId, shopId: task.shopId } });
    if (!order)
      throw new ValidationError("Order is unavailable");
    if (order.moderationHold && !["Cancelled", "Returned", "Refunded"].includes(order.status))
      throw new ValidationError("Cancel the held order before completing its review");
    if (["Cancelled", "Returned"].includes(order.status) && order.paymentStatus === "Paid")
      throw new ValidationError("Complete the payment refund first");
    await tx.moderationOrderTask.update({ where: { id }, data: { status: "Resolved", resolution, resolvedAt: /* @__PURE__ */ new Date() } });
  });
  res.json({ success: true });
});

// apps/product-service/src/controllers/discount-products.controller.ts
var updateDiscountProducts = handle(async (req, res) => {
  const id = objectId(req.params.id);
  const shopId = req.seller.shop?.id;
  if (!shopId)
    throw new ForbiddenError();
  const ids = req.body.productIds;
  if (!Array.isArray(ids) || ids.length > 1e3)
    throw new ValidationError("Select up to 1000 products");
  const selected = new Set(ids.map(objectId));
  await transaction(async (tx) => {
    const code = await tx.discountCodes.findFirst({ where: { id, sellerId: req.seller.id } });
    if (!code)
      throw new NotFoundError("Discount code not found");
    const previousUpdate = code.updatedAt instanceof Date ? code.updatedAt.getTime() : 0;
    await tx.discountCodes.update({ where: { id, sellerId: req.seller.id }, data: { updatedAt: new Date(Math.max(Date.now(), previousUpdate + 1)) } });
    const products = await tx.products.findMany({ where: { shopId, OR: [{ id: { in: [...selected] } }, { discount_codes: { has: id } }] }, select: { id: true, discount_codes: true, isDeleted: true } });
    if (products.filter((p) => selected.has(p.id) && !p.isDeleted).length !== selected.size)
      throw new ValidationError("Select available products belonging to your shop");
    for (const product of products) {
      const codes = product.discount_codes.filter((codeId) => codeId !== id);
      if (selected.has(product.id))
        codes.push(id);
      await tx.products.update({ where: { id: product.id, shopId }, data: { discount_codes: { set: codes } } });
    }
  });
  res.json({ success: true, productIds: [...selected] });
});

// packages/utils/money.ts
function usdCents(amount) {
  const cents2 = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents2))
    throw new Error("Invalid USD amount");
  return cents2;
}

// apps/product-service/src/controllers/variants.controller.ts
var listVariants = handle(async (req, res) => {
  const product = await prisma_default.products.findFirst({ where: { id: objectId(req.params.id), isDeleted: false, status: "Active" }, include: { variants: { where: { active: true } } } });
  if (!product)
    throw new NotFoundError();
  res.json({ variants: product.variants });
});
var saveVariant = handle(async (req, res) => {
  const productId = objectId(req.params.id);
  const shopId = req.seller.shop?.id;
  if (!shopId)
    throw new ForbiddenError();
  const sku = textField(req.body.sku, "SKU", 80);
  const color = req.body.color ?? "";
  const size = req.body.size ?? "";
  if ([color, size].some((v) => typeof v !== "string" || v.length > 100))
    throw new ValidationError("Invalid variant options");
  const stock = req.body.stock;
  const price = req.body.price;
  if (!Number.isSafeInteger(stock) || stock < 0 || typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 1e7)
    throw new ValidationError("Invalid variant price or stock");
  if (req.body.active !== void 0 && typeof req.body.active !== "boolean")
    throw new ValidationError("Invalid availability");
  const id = req.body.id ? objectId(req.body.id) : null;
  const variant = await transaction(async (tx) => {
    const product = await tx.products.findFirst({ where: { id: productId, shopId, isDeleted: false }, include: { variants: true } });
    if (!product)
      throw new NotFoundError();
    if (id && !product.variants.some((v) => v.id === id))
      throw new NotFoundError();
    if (!id && product.variants.length >= 100)
      throw new ValidationError("Maximum 100 variants");
    if (product.variants.some((v) => v.id !== id && (v.sku === sku || v.color === color.trim() && v.size === size.trim())))
      throw new ValidationError("SKU or option combination already exists");
    const data = { sku, color: color.trim(), size: size.trim(), price: usdCents(price) / 100, stock, active: req.body.active ?? true };
    const result = id ? await tx.productVariant.update({ where: { id, productId }, data }) : await tx.productVariant.create({ data: { productId, ...data } });
    const all = [...product.variants.filter((v) => v.id !== id), result];
    const available = all.filter((v) => v.active);
    const total = available.reduce((sum, v) => sum + v.stock, 0);
    const minimum = available.length ? Math.min(...available.map((v) => v.price)) : product.sale_price;
    await tx.products.update({ where: { id: productId }, data: { stock: total, sale_price: minimum, regular_price: Math.max(product.regular_price, minimum), colors: [...new Set(available.map((v) => v.color).filter(Boolean))], sizes: [...new Set(available.map((v) => v.size).filter(Boolean))] } });
    if (product.stock !== total)
      await tx.inventoryHistory.create({ data: { productId, shopId, delta: total - product.stock, stockAfter: total, reason: `SKU ${sku} adjustment`, actorId: req.seller.id } });
    return result;
  });
  res.json({ variant });
});

// apps/product-service/src/controllers/pc-builder.controller.ts
var import_client2 = require("@prisma/client");

// packages/utils/pc-build.ts
var PC_SLOTS = ["cpu", "motherboard", "ram", "gpu", "storage", "psu", "case", "cooler"];
var COMPONENT_TERMS = {
  cpu: ["cpu", "processor", "b\u1ED9 x\u1EED l\xFD"],
  motherboard: ["motherboard", "mainboard", "bo m\u1EA1ch"],
  ram: ["ram", "memory", "b\u1ED9 nh\u1EDB"],
  gpu: ["gpu", "vga", "graphics", "card \u0111\u1ED3 h\u1ECDa"],
  storage: ["ssd", "hdd", "storage", "\u1ED5 c\u1EE9ng"],
  psu: ["psu", "power supply", "ngu\u1ED3n"],
  case: ["case", "v\u1ECF m\xE1y"],
  cooler: ["cooler", "cooling", "t\u1EA3n nhi\u1EC7t"]
};
function componentMatches(product, slot) {
  const text = `${product.category || ""} ${product.subCategory || ""} ${(product.tags || []).join(" ")}`.toLowerCase();
  return COMPONENT_TERMS[slot].some((term) => text.includes(term));
}
function specificationKey(key) {
  return key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function specifications(raw) {
  const result = /* @__PURE__ */ Object.create(null);
  const valueText = (value) => {
    if (typeof value === "string" || typeof value === "number")
      return String(value).trim().toUpperCase();
    if (Array.isArray(value))
      return value.filter((item) => typeof item === "string" || typeof item === "number").map(valueText).filter(Boolean).join(" / ");
    return "";
  };
  let count = 0;
  const add = (key, value) => {
    if (typeof key !== "string" || count++ >= 200)
      return;
    const normalized = specificationKey(key);
    const text = valueText(value);
    if (!normalized || !text)
      return;
    result[normalized] = result[normalized] && result[normalized] !== text ? `${result[normalized]} / ${text}` : text;
  };
  const visit = (value, depth = 0) => {
    if (depth > 3 || count >= 200 || !value || typeof value !== "object")
      return;
    if (Array.isArray(value)) {
      for (const row of value.slice(0, 200)) {
        if (!row || typeof row !== "object" || Array.isArray(row))
          continue;
        add([row.name, row.key, row.label].find((label) => typeof label === "string" && label.trim()), row.value);
      }
    } else {
      for (const [key, item] of Object.entries(value).slice(0, 200)) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          if ("value" in item)
            add(key, item.value);
          else
            visit(item, depth + 1);
        } else
          add(key, item);
      }
    }
  };
  if (typeof raw === "string" && raw.length <= 2e4) {
    try {
      visit(JSON.parse(raw));
    } catch {
    }
  } else
    visit(raw);
  return result;
}
var FIELD_ALIASES = {
  socket: ["socket", "cpusocket", "processorsocket", "sockettype", "socketcpu", "socketboxuly", "loaisocket", "socketmainboard", "socketmotherboard", "socketbomachchu", "socketbomach", "sockethotro", "supportedsocket", "khecamcpu", "chancamcpu"],
  memory: ["memorytype", "ramtype", "typeofmemory", "typeofram", "rammemorytype", "memorytechnology", "ramtechnology", "supportedmemorytype", "supportedmemory", "memorysupport", "ram", "memory", "loairam", "chuanram", "kieuram", "loaibonho", "loaibonhoram", "loaibonhohotro", "kieubonho", "congnghebonho", "loairamhotro", "ramhotro", "bonhohotro", "hotrobonho"],
  wattage: ["wattage", "wattagew", "power", "psuwattage", "psupower", "ratedpower", "outputpower", "poweroutput", "powersupplywattage", "congsuat", "congsuatw", "congsuatnguon", "congsuatdinhmuc", "congsuatthuc"],
  recommended: ["recommendedpsuwatts", "recommendedpsuw", "recommendedpsu", "recommendedpowersupply", "recommendedpsuwattage", "minimumpsuwatts", "minimumpsu", "minimumpowersupply", "psurequirement", "requiredpsuwatts", "nguondenghi", "nguonkhuyennghi", "congsuatnguonkhuyennghi", "nguontoithieu", "congsuatnguontoithieu"]
};
function fieldValues(specs, field) {
  return [...new Set(FIELD_ALIASES[field].map((alias) => specs[specificationKey(alias)]).filter(Boolean))];
}
function hardwareTokens(values, kind) {
  if (!values.length)
    return [];
  const result = /* @__PURE__ */ new Set();
  for (const value of values) {
    const text = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‐‑–—]/g, "-").toUpperCase();
    if (/\b(NO|NOT|WITHOUT|UNSUPPORTED|EXCEPT|EXCLUDES|EXCLUDING|UNKNOWN|UNSPECIFIED|TBD|KHONG)\b/.test(text))
      return [];
    const compact = text.replace(/\b(?:FC)?LGA\s*-?\s*(\d+)/g, "LGA$1").replace(/\b(LGA\d{3,4})\s*-\s*V?(\d+)\b/g, "$1V$2").replace(/\b((?:LP)?DDR)\s*-?\s*(\d)/g, "$1$2").replace(/\b(AM|FM)\s*-?\s*(\d)/g, "$1$2");
    const matches = kind === "socket" ? compact.match(/\b(?:LGA\d{3,4}(?:-?V\d)?|AM\d\+?|FM\d\+?|S?TRX?\d|TR4|SP\d)\b\+?/g) : compact.match(/\b(?:LP)?DDR[1-6]\b/g);
    const tokens = matches || (kind === "socket" && /^\d{3,4}$/.test(compact.trim()) ? [`LGA${compact.trim()}`] : []);
    if (!tokens.length)
      return [];
    for (const token of tokens)
      result.add(token.replace(/-V/g, "V"));
  }
  return [...result].sort();
}
function watts(values) {
  const parsed = values.map((value) => {
    const match = /^(\d{1,4}|\d{1,2}[,.]\d{3})\s*(?:W|WATTS?)?$/.exec(value.trim());
    if (!match)
      return NaN;
    return Number(match[1].replace(/[,.]/g, ""));
  });
  return parsed.length && parsed.every((value) => Number.isFinite(value) && value > 0 && value <= 1e4 && value === parsed[0]) ? parsed[0] : void 0;
}
var PC_MANUAL_CHECK_NOTE = "Also check BIOS support, case clearance, connectors and cooling with the product specifications. These checks are not exhaustive.";
function assessCompatibility(parts) {
  const checks = [];
  const specs = Object.fromEntries(Object.entries(parts).map(([slot, part]) => [slot, specifications(part?.custom_specification)]));
  const compare = (a, b, id, label, field) => {
    if (!parts[a] || !parts[b])
      return;
    const valuesA = hardwareTokens(fieldValues(specs[a], id), id);
    const valuesB = hardwareTokens(fieldValues(specs[b], id), id);
    const missing = [];
    if (valuesA.length !== 1)
      missing.push(a);
    if (valuesB.length !== 1)
      missing.push(b);
    if (id === "socket" && valuesA.length === 1 && valuesB.length === 1 && valuesA[0] !== valuesB[0]) {
      const sameUnspecifiedRevision = valuesA[0].replace(/V\d+$/, "") === valuesB[0].replace(/V\d+$/, "") && (!/V\d+$/.test(valuesA[0]) || !/V\d+$/.test(valuesB[0]));
      const differentPrefix = valuesA[0].replace(/^S(?=TR)/, "") === valuesB[0].replace(/^S(?=TR)/, "");
      if (sameUnspecifiedRevision || differentPrefix)
        missing.push(...[a, b].filter((slot) => !missing.includes(slot)));
    }
    const left = valuesA.join(" / "), right = valuesB.join(" / ");
    const status = missing.length ? "unknown" : valuesB.includes(valuesA[0]) ? "passed" : "conflict";
    checks.push({
      id,
      label,
      field,
      slots: [a, b],
      values: { ...left ? { [a]: left } : {}, ...right ? { [b]: right } : {} },
      missing,
      status,
      message: status === "unknown" ? `Cannot verify ${label}: specifications are missing.` : status === "conflict" ? `${label} mismatch: ${left} / ${right}.` : ""
    });
  };
  compare("cpu", "motherboard", "socket", "CPU / motherboard socket", "Socket");
  compare("ram", "motherboard", "memory", "RAM / motherboard memory type", "Memory type");
  if (parts.psu && parts.gpu) {
    const supply = watts(fieldValues(specs.psu, "wattage")), recommended = watts(fieldValues(specs.gpu, "recommended"));
    const missing = [...supply ? [] : ["psu"], ...recommended ? [] : ["gpu"]];
    const status = missing.length ? "unknown" : supply < recommended ? "conflict" : "passed";
    checks.push({
      id: "psu",
      label: "PSU capacity",
      field: "Wattage / recommended PSU",
      slots: ["psu", "gpu"],
      status,
      missing,
      values: { ...supply ? { psu: `${supply} W` } : {}, ...recommended ? { gpu: `${recommended} W` } : {} },
      message: status === "unknown" ? "Cannot verify PSU capacity: wattage or recommended PSU watts is missing." : status === "conflict" ? `GPU recommends at least ${recommended} W; selected PSU is ${supply} W.` : ""
    });
  }
  const issues = checks.filter((check) => check.status !== "passed").map((check) => ({ level: check.status === "conflict" ? "error" : "warning", message: check.message }));
  return { checks, issues, notes: [PC_MANUAL_CHECK_NOTE] };
}

// packages/utils/pc-build-selection.ts
function parsePcSelections(value) {
  if (!Array.isArray(value) || value.length > PC_SLOTS.length)
    throw new Error("Invalid PC build");
  const slots = /* @__PURE__ */ new Set();
  const id = (input) => {
    if (typeof input !== "string" || !/^[a-f\d]{24}$/i.test(input))
      throw new Error("Invalid component ID");
    return input.toLowerCase();
  };
  const option = (input) => {
    if (input === void 0 || input === null)
      return "";
    if (typeof input !== "string" || input.length > 200)
      throw new Error("Invalid component option");
    return input;
  };
  return value.map((part) => {
    if (!part || typeof part !== "object" || Array.isArray(part) || !PC_SLOTS.includes(part.slot) || slots.has(part.slot))
      throw new Error("Choose one product per component slot");
    slots.add(part.slot);
    const options = part.selectedOptions ?? {};
    if (typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((key) => key !== "color" && key !== "size"))
      throw new Error("Invalid component options");
    return {
      slot: part.slot,
      id: id(part.id),
      ...part.variantId == null ? {} : { variantId: id(part.variantId) },
      selectedOptions: { color: option(options.color), size: option(options.size) }
    };
  });
}

// packages/utils/pc-recommendations.ts
function pcAvailableStock(product) {
  const variants = (product.variants || []).filter((variant) => variant.active !== false);
  const total = Math.max(0, Number(product.stock) || 0);
  return variants.length ? Math.min(total, variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)) : total;
}
function recommendPcProducts(products, slot, selected, sort) {
  return products.flatMap((product) => {
    const stock = pcAvailableStock(product);
    if (!stock)
      return [];
    const checks = assessCompatibility({ ...selected, [slot]: product }).checks.filter((check) => check.slots.includes(slot));
    if (checks.some((check) => check.status === "conflict"))
      return [];
    const status = checks.length === 0 ? "unchecked" : checks.some((check) => check.status === "unknown") ? "unknown" : "matched";
    return [{ ...product, recommendation: { status, stock, checks } }];
  }).sort((a, b) => {
    if (sort === "recommended") {
      const rank = { matched: 0, unchecked: 1, unknown: 2 };
      const compatibility = rank[a.recommendation.status] - rank[b.recommendation.status];
      if (compatibility)
        return compatibility;
      const stock = b.recommendation.stock - a.recommendation.stock;
      if (stock)
        return stock;
    }
    return (sort === "priceDesc" ? b.sale_price - a.sale_price : a.sale_price - b.sale_price) || a.id.localeCompare(b.id);
  });
}

// apps/product-service/src/controllers/pc-builder.controller.ts
var select = { id: true, title: true, slug: true, category: true, subCategory: true, tags: true, colors: true, sizes: true, sale_price: true, stock: true, custom_specification: true, warranty: true, images: { select: { url: true }, take: 1 }, variants: { where: { active: true }, select: { id: true, sku: true, color: true, size: true, price: true, stock: true } } };
var availableProducts = () => ({
  status: "Active",
  isDeleted: false,
  shop: { sellers: { OR: [{ suspendedAt: null }, { suspendedAt: { isSet: false } }, { suspendedUntil: { not: null, isSet: true, lte: /* @__PURE__ */ new Date() } }] } }
});
function selectionsFrom(value) {
  try {
    return parsePcSelections(value);
  } catch (error) {
    throw new ValidationError(error instanceof Error ? error.message : "Invalid PC build");
  }
}
var getSavedBuild = handle(async (req, res) => {
  if (req.query.ownerId !== req.user.id)
    throw new ForbiddenError();
  res.setHeader("Cache-Control", "no-store");
  const id = req.user.id;
  let saved;
  try {
    saved = await prisma_default.savedPcBuild.upsert({ where: { id }, create: { id, parts: [] }, update: {} });
  } catch (error) {
    if (!(error instanceof import_client2.Prisma.PrismaClientKnownRequestError) || error.code !== "P2002")
      throw error;
    saved = await prisma_default.savedPcBuild.findUniqueOrThrow({ where: { id } });
  }
  res.json({ parts: saved.parts, revision: saved.revision, updatedAt: saved.updatedAt });
});
var saveBuild = handle(async (req, res) => {
  if (req.body.ownerId !== req.user.id)
    throw new ForbiddenError();
  res.setHeader("Cache-Control", "no-store");
  const revision = req.body.revision;
  if (!Number.isInteger(revision) || revision < 0 || revision >= 2147483647)
    throw new ValidationError("Invalid revision");
  const parts = selectionsFrom(req.body.parts);
  if (!parts.length)
    throw new ValidationError("Choose at least one component");
  const result = await prisma_default.savedPcBuild.updateMany({
    where: { id: req.user.id, revision },
    data: { parts, revision: { increment: 1 } }
  });
  if (!result.count) {
    res.status(409).json({ message: "Saved PC build changed on another device", code: "PC_BUILD_CONFLICT" });
    return;
  }
  res.json({ revision: revision + 1 });
});
var buildCatalog = handle(async (req, res) => {
  const slot = req.query.slot;
  if (!PC_SLOTS.includes(slot))
    throw new ValidationError("Invalid component type");
  const sort = req.query.sort ?? "recommended";
  if (sort !== "recommended" && sort !== "priceAsc" && sort !== "priceDesc")
    throw new ValidationError("Invalid sort option");
  let rawParts = [];
  if (req.query.parts !== void 0) {
    if (typeof req.query.parts !== "string" || req.query.parts.length > 12e3)
      throw new ValidationError("Invalid PC build");
    try {
      rawParts = JSON.parse(req.query.parts);
    } catch {
      throw new ValidationError("Invalid PC build");
    }
  }
  const selections = selectionsFrom(rawParts).filter((part) => part.slot !== slot);
  const selectedProducts = selections.length ? await prisma_default.products.findMany({ where: { ...availableProducts(), id: { in: selections.map((part) => part.id) } }, select }) : [];
  const selected = Object.fromEntries(selections.map((selection) => {
    const product = selectedProducts.find((product2) => product2.id === selection.id);
    if (!product || !componentMatches(product, selection.slot))
      throw new ValidationError("A selected component is unavailable or belongs to a different category");
    return [selection.slot, product];
  }));
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const where = { ...availableProducts(), stock: { gt: 0 }, AND: [
    { OR: COMPONENT_TERMS[slot].flatMap((term) => [{ category: { contains: term, mode: "insensitive" } }, { subCategory: { contains: term, mode: "insensitive" } }, { tags: { has: term } }]) },
    ...q ? [{ title: { contains: q, mode: "insensitive" } }] : []
  ] };
  const { skip, take } = pageArgs(req.query);
  const candidates = await prisma_default.products.findMany({ where, select });
  const ranked = recommendPcProducts(candidates, slot, selected, sort);
  const total = ranked.length;
  res.setHeader("Cache-Control", "no-store");
  res.json({ products: ranked.slice(skip, skip + take), currency: "usd", pagination: { page: skip / take + 1, total, totalPages: Math.max(1, Math.ceil(total / take)) } });
});
var quoteBuild = handle(async (req, res) => {
  const selections = selectionsFrom(req.body.parts);
  if (!selections.length)
    throw new ValidationError("Choose at least one component");
  const ids = selections.map((p) => p.id);
  const products = await prisma_default.products.findMany({ where: { ...availableProducts(), id: { in: ids } }, select });
  const parts = selections.map((selection) => {
    const product = products.find((p) => p.id === selection.id);
    if (!product || !componentMatches(product, selection.slot))
      throw new ValidationError("A selected component is unavailable or belongs to a different category");
    const variant = product.variants.find((v) => v.id === selection.variantId);
    if (product.variants.length && !variant || !product.variants.length && selection.variantId)
      throw new ValidationError(`Select a variant for ${product.title}`);
    const options = selection.selectedOptions || {};
    if (!variant && (product.colors.length && !product.colors.includes(options.color) || product.sizes.length && !product.sizes.includes(options.size)))
      throw new ValidationError(`Select options for ${product.title}`);
    const stock = Math.min(product.stock, variant?.stock ?? product.stock);
    return { ...product, slot: selection.slot, stock, variantId: variant?.id || null, sale_price: variant?.price ?? product.sale_price, selectedOptions: variant ? { color: variant.color, size: variant.size } : { color: options.color || "", size: options.size || "" } };
  });
  const { issues, checks, notes } = assessCompatibility(Object.fromEntries(parts.map((p) => [p.slot, p])));
  for (const part of parts)
    if (part.stock < 1)
      issues.push({ level: "error", message: `${part.title} is out of stock.` });
  res.json({ parts, issues, compatibility: { checks, notes }, total: parts.reduce((sum, p) => sum + usdCents(p.sale_price), 0) / 100, currency: "usd", canAddToCart: !issues.some((i) => i.level === "error") });
});

// apps/product-service/src/routes/product.router.ts
var router = import_express.default.Router();
router.post("/products/:id/report", isAuthenticated_default, isUser, reportProduct);
router.get("/seller-violations", isAuthenticated_default, isSeller, sellerViolations);
router.get("/seller-moderation-tasks", isAuthenticated_default, isSeller, sellerModerationTasks);
router.patch("/seller-moderation-tasks/:id", isAuthenticated_default, isSeller, resolveModerationTask);
router.get("/pc-builder/catalog", buildCatalog);
router.post("/pc-builder/quote", quoteBuild);
router.get("/pc-builder/saved", isAuthenticated_default, isUser, getSavedBuild);
router.put("/pc-builder/saved", isAuthenticated_default, isUser, saveBuild);
router.get("/variants/:id", listVariants);
router.put("/variants/:id", isAuthenticated_default, isSeller, saveVariant);
router.get("/sitemap-data", handle(async (req, res) => {
  const skip = Math.max(0, Math.floor(Number(req.query.page) || 0)) * 500;
  const [products, shops] = await Promise.all([
    prisma_default.products.findMany({ where: { isDeleted: false, status: "Active" }, orderBy: { id: "asc" }, skip, take: 500, select: { slug: true, updatedAt: true } }),
    prisma_default.shops.findMany({ orderBy: { id: "asc" }, skip, take: 500, select: { id: true, updatedAt: true } })
  ]);
  res.json({ entries: [...products.map((p) => ({ path: `/product/${encodeURIComponent(p.slug)}`, updatedAt: p.updatedAt })), ...shops.map((s) => ({ path: `/shop/${s.id}`, updatedAt: s.updatedAt }))], hasMore: products.length === 500 || shops.length === 500 });
}));
router.get("/seller-reports", isAuthenticated_default, isSeller, revenueReport);
router.get("/seller-statistics", isAuthenticated_default, isSeller, sellerStatistics);
router.get("/seller-analytics", isAuthenticated_default, isSeller, sellerAnalytics);
router.get("/seller-analytics/products/:id", isAuthenticated_default, isSeller, sellerProductAnalytics);
router.get("/seller-analytics/customers/:id", isAuthenticated_default, isSeller, sellerCustomerAnalytics);
router.get("/seller-product/:id", isAuthenticated_default, isSeller, getEditableProduct);
router.put("/update-product/:id", isAuthenticated_default, isSeller, updateProduct);
router.get("/inventory", isAuthenticated_default, isSeller, getInventory);
router.post("/create-review", isAuthenticated_default, isUser, createReview);
router.get("/product-reviews/:productId", getReviews);
router.get("/get-categories", getCategories);
router.get("/get-seller-stats", isAuthenticated_default, isSeller, getSellerStats);
router.get("/get-discount-code", isAuthenticated_default, isSeller, getDiscountCodes);
router.patch("/discount-code/:id/products", isAuthenticated_default, isSeller, updateDiscountProducts);
router.get(
  "/get-seller-notifications",
  isAuthenticated_default,
  isSeller,
  getSellerNotifications
);
router.patch(
  "/notifications/read-all",
  isAuthenticated_default,
  isSeller,
  markAllSellerNotificationsRead
);
router.patch(
  "/notifications/:id/read",
  isAuthenticated_default,
  isSeller,
  markSellerNotificationRead
);
router.post("/create-discount-code", isAuthenticated_default, isSeller, createDiscountCode);
router.delete(
  "/delete-discount-code/:id",
  isAuthenticated_default,
  isSeller,
  deleteDiscountCodes
);
router.post("/upload-product-image", isAuthenticated_default, isSeller, uploadProductImages);
router.delete("/delete-product-image", isAuthenticated_default, isSeller, deleteProductImages);
router.post("/create-product", isAuthenticated_default, isSeller, createProduct);
router.get("/get-shop-products", isAuthenticated_default, isSeller, getShopProducts);
router.post("/delete-product/:id", isAuthenticated_default, isSeller, deleteProduct);
router.post("/restore-product/:id", isAuthenticated_default, isSeller, restoreProduct);
router.get("/get-all-products", getAllProducts);
router.get("/get-product/:slug", getProductDetails);
router.get("/get-filtered-products", filteredCatalog);
router.get("/get-filtered-offers", getFilteredEvents);
router.get("/get-filtered-shops", getFilteredShops);
router.get("/search-products", searchProducts);
router.get("/top-shops", topShops);
router.get("/get-shop/:id", getShopById);
router.get("/get-all-events", getAllEvents);
var product_router_default = router;

// apps/product-service/jobs/product.cron-job.ts
var import_node_cron = __toESM(require("node-cron"));
import_node_cron.default.schedule("0 * * * *", async () => {
  try {
    const now = /* @__PURE__ */ new Date();
    await prisma_default.products.deleteMany({
      where: {
        isDeleted: true,
        deleteAt: { lte: now }
      }
    });
  } catch (error) {
    console.log("Error in product cleanup cron job:", error);
  }
});

// apps/product-service/src/main.ts
var app = (0, import_express2.default)();
app.use(
  (0, import_cors.default)({
    origin: true,
    credentials: true
  })
);
app.use(import_express2.default.json({ limit: "100mb" }));
app.use(import_express2.default.urlencoded({ extended: true, limit: "100mb" }));
app.use((0, import_cookie_parser.default)());
app.get("/", (req, res) => {
  res.send({ message: "Hello Product API" });
});
app.use("/api", product_router_default);
app.use(errorMiddleware);
var port = process.env.PORT || 6002;
var server = app.listen(port, () => {
  console.log(`Product service is listening at http://localhost:${port}/`);
  console.log(`Swagger json available at http://localhost:${port}/docs-json`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
server.on("error", (err) => {
  console.error("Server error:", err);
});
//# sourceMappingURL=main.js.map
