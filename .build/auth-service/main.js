"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// apps/auth-service/src/swagger-output.json
var require_swagger_output = __commonJS({
  "apps/auth-service/src/swagger-output.json"(exports2, module2) {
    module2.exports = {
      swagger: "2.0",
      info: {
        title: "Auth service API",
        description: "Automatically generated swagger docs",
        version: "1.0.0"
      },
      host: "localhost:6001",
      basePath: "/api",
      schemes: [
        "http"
      ],
      paths: {
        "/user-registration": {
          post: {
            description: "",
            parameters: [
              {
                name: "body",
                in: "body",
                schema: {
                  type: "object",
                  properties: {
                    name: {
                      example: "Long"
                    },
                    email: {
                      example: "longiter2004@gmail.com"
                    },
                    password: {
                      example: "password"
                    }
                  }
                }
              }
            ],
            responses: {
              "200": {
                description: "OK"
              }
            }
          }
        },
        "/verify-user": {
          post: {
            description: "",
            parameters: [
              {
                name: "body",
                in: "body",
                schema: {
                  type: "object",
                  properties: {
                    email: {
                      example: "longiter2004@gmail.com"
                    },
                    otp: {
                      example: "5833"
                    },
                    password: {
                      example: "password"
                    },
                    name: {
                      example: "Long"
                    }
                  }
                }
              }
            ],
            responses: {
              "201": {
                description: "Created"
              }
            }
          }
        },
        "/login-user": {
          post: {
            description: "",
            parameters: [
              {
                name: "body",
                in: "body",
                schema: {
                  type: "object",
                  properties: {
                    email: {
                      example: "trandbaolong@dtu.edu.vn"
                    },
                    password: {
                      example: "password"
                    }
                  }
                }
              }
            ],
            responses: {
              "200": {
                description: "OK"
              }
            }
          }
        }
      }
    };
  }
});

// apps/auth-service/src/main.ts
var import_config = require("dotenv/config");
var import_express2 = __toESM(require("express"));
var import_cors = __toESM(require("cors"));

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

// apps/auth-service/src/main.ts
var import_cookie_parser = __toESM(require("cookie-parser"));

// apps/auth-service/src/routes/auth.router.ts
var import_express = __toESM(require("express"));

// packages/utils/admin-access.ts
function isSuspended(account, now = Date.now()) {
  return !!account.suspendedAt && (!account.suspendedUntil || new Date(account.suspendedUntil).getTime() > now);
}

// apps/auth-service/src/utils/auth.helper.ts
var import_crypto = __toESM(require("crypto"));

// packages/libs/redis/index.ts
var import_ioredis = __toESM(require("ioredis"));
var redis = new import_ioredis.default(process.env.REDIS_DATABASE_URL || process.env.REDIS_DATEBASE_URL || "redis://localhost:6379");
var redis_default = redis;

// apps/auth-service/src/utils/sendMail/index.ts
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
    "auth-service",
    "src",
    "utils",
    "email-templates",
    `${templateName}.ejs`
  );
  return import_ejs.default.renderFile(templatePath, data);
};
var sendEmail = async (to, subject, templateName, data) => {
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

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

// apps/auth-service/src/utils/auth.helper.ts
var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var validateRegistrationData = (data, userType) => {
  const { name, email, password, phone_number, country } = data;
  if (!name || !email || !password || userType === "seller" && (!phone_number || !country)) {
    throw new ValidationError("Missing required fields!");
  }
  if (!emailRegex.test(email)) {
    throw new ValidationError("Invalid email format!");
  }
};
var checkOtpRestrictions = async (email) => {
  if (await redis_default.get(`otp_lock:${email}`)) {
    throw new ValidationError("Account locked due to multiple failed attempts. Try again after 30 minutes");
  }
  if (await redis_default.get(`otp_spam_lock:${email}`)) {
    throw new ValidationError("Too many OTP requests. Please await 1 hour before requesting again");
  }
  if (await redis_default.get(`otp_cooldown:${email}`)) {
    throw new ValidationError("Please wait 60 seconds before requesting another OTP");
  }
};
var trackOtpRequests = async (email) => {
  const otpRequestKey = `otp_request_count:${email}`;
  let otpRequest = parseInt(await redis_default.get(otpRequestKey) || "0");
  if (otpRequest >= 2) {
    await redis_default.set(`otp_spam_lock:${email}`, "locked", "EX", 3600);
    throw new ValidationError("Too many OTP requests. Please await 1 hour before requesting again");
  }
  await redis_default.set(otpRequestKey, otpRequest + 1, "EX", 3600);
};
var sendOtp = async (name, email, template) => {
  const otp = import_crypto.default.randomInt(1e3, 9999).toString();
  await sendEmail(email, "Verify Your Email", template, { name, otp });
  await redis_default.set(`otp:${email}`, otp, "EX", 300);
  await redis_default.set(`otp_cooldown:${email}`, "true", "EX", 60);
};
var verifyOtp = async (email, otp) => {
  if (await redis_default.get(`otp_lock:${email}`)) {
    throw new ValidationError("Too many failed attempts. Your account is locked for 30 minutes!");
  }
  const storedOtp = await redis_default.get(`otp:${email}`);
  if (!storedOtp) {
    throw new ValidationError("Invalid or expired otp!");
  }
  const failedAttemptKeys = `otp_attempts:${email}`;
  const failedAttempts = parseInt(await redis_default.get(failedAttemptKeys) || "0");
  if (storedOtp !== otp) {
    if (failedAttempts >= 2) {
      await redis_default.set(`otp_lock:${email}`, "locked", "EX", 1800);
      await redis_default.del(`otp:${email}`, failedAttemptKeys);
      throw new ValidationError("Too many failed attempts. Your account is locked for 30 minutes!");
    }
    await redis_default.set(failedAttemptKeys, failedAttempts + 1, "EX", 1800);
    throw new ValidationError(`Incorrect OTP. ${2 - failedAttempts} attempts remaining`);
  }
  await redis_default.del(`otp:${email}`, failedAttemptKeys, `otp_request_count:${email}`, `otp_cooldown:${email}`);
};
var handleForgotPassword = async (req, res, next, userType) => {
  try {
    const { email } = req.body;
    if (!email)
      throw new ValidationError("Email is required");
    const user = userType === "user" ? await prisma_default.users.findUnique({ where: { email } }) : await prisma_default.sellers.findUnique({ where: { email } });
    if (!user)
      throw new ValidationError(`${userType} not found`);
    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
    await sendOtp(user.name, email, userType === "user" ? "forgot-password-user-mail" : "forgot-password-seller-mail");
    res.status(200).json({ message: "OTP sent to mail. Please verify your account." });
  } catch (error) {
    next(error);
  }
};
var verifyForgotPasswordOtp = async (req, res, next, userType) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      throw new ValidationError("Email and otp and required!");
    }
    await verifyOtp(email, otp);
    res.status(200).json({
      message: "OTP verified. You can now reset your password."
    });
  } catch (error) {
    next(error);
  }
};

// apps/auth-service/src/controllers/auth.controller.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));

// apps/auth-service/src/utils/cookies/setCookies.ts
var setCookie = (res, name, value) => {
  res.cookie(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1e3
    // 7 days
  });
};

// apps/auth-service/src/controllers/auth.controller.ts
var import_stripe = __toESM(require("stripe"));

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

// apps/auth-service/src/controllers/auth.controller.ts
var stripe = new import_stripe.default(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia"
});
var userRegistration = async (req, res, next) => {
  try {
    validateRegistrationData(req.body, "user");
    const { name, email } = req.body;
    const existingUser = await prisma_default.users.findUnique({
      where: { email }
    });
    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }
    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
    await sendOtp(name, email, "user-activation-mail");
    res.status(200).json({
      message: "OTP sent to mail. Please verify your account."
    });
  } catch (error) {
    if (!res.headersSent)
      return next(error);
  }
};
var verifyUser = async (req, res, next) => {
  try {
    const { email, otp, password, name } = req.body;
    if (!email || !otp || !password || !name) {
      return next(new ValidationError("All fields are required"));
    }
    const existingUser = await prisma_default.users.findUnique({
      where: { email }
    });
    if (existingUser) {
      return next(new ValidationError("User already exists with this email!"));
    }
    await verifyOtp(email, otp);
    const hashedPassword = await import_bcryptjs.default.hash(password, 10);
    const user = await prisma_default.users.create({
      data: { name, email, password: hashedPassword }
    });
    await sendBehaviorLog("userRegistration", {
      type: "success",
      source: "auth-service",
      message: "User registration succeeded",
      metadata: { userId: user.id }
    });
    res.status(201).json({
      success: true,
      message: "User registered successfully"
    });
  } catch (error) {
    if (!res.headersSent)
      next(error);
  }
};
var loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ValidationError("Email and password are required!"));
    }
    const user = await prisma_default.users.findUnique({ where: { email } });
    if (!user)
      return next(new AuthError("Invalid email or password!"));
    if (isSuspended(user))
      return res.status(403).json({ message: "Account suspended. Contact support." });
    const isMatch = await import_bcryptjs.default.compare(password, user.password);
    if (!isMatch) {
      return next(new AuthError("Invalid email or password!"));
    }
    const accessToken = await import_jsonwebtoken.default.sign(
      { id: user.id, role: "user" },
      process.env.ACCESS_TOKEN_JWT_SECRET,
      {
        expiresIn: "15m"
      }
    );
    const refreshToken = await import_jsonwebtoken.default.sign(
      { id: user.id, role: "user" },
      process.env.REFRESH_TOKEN_JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );
    setCookie(res, "refresh_token", refreshToken);
    setCookie(res, "access_token", accessToken);
    await sendBehaviorLog("userLogin", {
      type: "success",
      source: "auth-service",
      message: "User login succeeded",
      metadata: { userId: user.id }
    });
    res.status(200).json({
      message: "Login successfully",
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    return next(error);
  }
};
var refreshUserToken = async (req, res, next) => {
  try {
    const token = req.cookies?.["refresh_token"] || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next(new AuthError("Your session has ended. Please sign in again."));
    }
    const decoded = import_jsonwebtoken.default.verify(
      token,
      process.env.REFRESH_TOKEN_JWT_SECRET
    );
    if (!decoded || !decoded.id || !["user", "admin"].includes(decoded.role)) {
      return next(
        new import_jsonwebtoken.JsonWebTokenError("Forbidden! Invalid account refresh token!")
      );
    }
    const account = await prisma_default.users.findUnique({
      where: { id: decoded.id }
    });
    if (!account) {
      return next(new AuthError("Forbidden! User not found!"));
    }
    if (isSuspended(account))
      return res.status(403).json({ message: "Account suspended. Contact support." });
    if (decoded.role === "admin" && account.role !== "admin")
      return next(new AuthError("Administrator access was revoked"));
    const newAccessToken = import_jsonwebtoken.default.sign(
      { id: decoded.id, role: decoded.role },
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: "15m" }
    );
    setCookie(res, "access_token", newAccessToken);
    req.role = decoded.role;
    req.user = account;
    return res.status(201).json({
      success: true,
      message: "Access token refreshed successfully!"
    });
  } catch (error) {
    return next(error);
  }
};
var refreshSellerToken = async (req, res, next) => {
  try {
    const token = req.cookies?.["seller_refresh_token"] || req.headers.authorization?.split(" ")[1];
    if (!token) {
      return next(
        new AuthError("Your session has ended. Please sign in again.")
      );
    }
    const decoded = import_jsonwebtoken.default.verify(
      token,
      process.env.REFRESH_TOKEN_JWT_SECRET
    );
    if (!decoded || !decoded.id || decoded.role !== "seller") {
      return next(
        new import_jsonwebtoken.JsonWebTokenError("Forbidden! Invalid seller refresh token!")
      );
    }
    const account = await prisma_default.sellers.findUnique({
      where: { id: decoded.id },
      include: { shop: true }
    });
    if (!account) {
      return next(new AuthError("Forbidden! Seller not found!"));
    }
    const newAccessToken = import_jsonwebtoken.default.sign(
      { id: decoded.id, role: "seller" },
      process.env.ACCESS_TOKEN_JWT_SECRET,
      { expiresIn: "15m" }
    );
    setCookie(res, "seller_access_token", newAccessToken);
    return res.status(201).json({
      success: true,
      message: "Access token refreshed successfully!"
    });
  } catch (error) {
    return next(error);
  }
};
var getUser = async (req, res, next) => {
  try {
    const user = await prisma_default.users.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, role: true, adminRole: true, createdAt: true, following: true, avatar: true } });
    if (!user) {
      return next(new ValidationError("User not found"));
    }
    res.status(200).json({
      success: true,
      user: { ...user, avatar: user.avatar[0]?.url ?? null }
    });
  } catch (error) {
    return next(error);
  }
};
var getAdmin = async (req, res, next) => {
  try {
    const admin = req.user;
    if (!admin) {
      return next(new ValidationError("Admin not found"));
    }
    res.status(200).json({
      success: true,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        adminRole: admin.adminRole ?? "owner"
      }
    });
  } catch (error) {
    return next(error);
  }
};
var changeUserPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = req.user;
    if (!currentPassword || !newPassword) {
      return next(
        new ValidationError("Current password and new password are required")
      );
    }
    if (!user) {
      return next(new AuthError("User not found"));
    }
    const isCurrentPasswordValid = await import_bcryptjs.default.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return next(new AuthError("Current password is incorrect"));
    }
    if (currentPassword === newPassword) {
      return next(
        new ValidationError("New password cannot be the same as the old password")
      );
    }
    const hashedPassword = await import_bcryptjs.default.hash(newPassword, 10);
    await prisma_default.users.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
    return res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    return next(error);
  }
};
var userForgotPassword = async (req, res, next) => {
  await handleForgotPassword(req, res, next, "user");
};
var verifyUserForgotPassword = async (req, res, next) => {
  await verifyForgotPasswordOtp(req, res, next, "user");
};
var resetUserPassword = async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return next(new ValidationError("Email and password are required"));
    const user = await prisma_default.users.findUnique({ where: { email } });
    if (!user)
      return next(new ValidationError("User not found"));
    const isSamePassword = await import_bcryptjs.default.compare(newPassword, user.password);
    if (isSamePassword) {
      return next(
        new ValidationError(
          "New password cannot be the same as the old password"
        )
      );
    }
    const hashedPassword = await import_bcryptjs.default.hash(newPassword, 10);
    await prisma_default.users.update({
      where: { email },
      data: { password: hashedPassword }
    });
    res.status(200).json({
      message: "Password reset successfully!"
    });
  } catch (error) {
    next(error);
  }
};
var registerSeller = async (req, res, next) => {
  try {
    validateRegistrationData(req.body, "seller");
    const { name, email } = req.body;
    const existingSeller = await prisma_default.sellers.findUnique({
      where: { email }
    });
    if (existingSeller) {
      throw new ValidationError("Seller already exists with this email");
    }
    await checkOtpRestrictions(email);
    await trackOtpRequests(email);
    await sendOtp(name, email, "seller-activation-mail");
    res.status(200).json({
      success: true,
      message: "OTP sent to mail. Please verify your account."
    });
  } catch (error) {
    next(error);
  }
};
var verifySeller = async (req, res, next) => {
  try {
    const { email, otp, password, name, phone_number, country } = req.body;
    if (!email || !otp || !password || !name || !phone_number || !country) {
      return next(new ValidationError("All fields are required"));
    }
    const existingSeller = await prisma_default.sellers.findUnique({
      where: { email }
    });
    if (existingSeller) {
      return next(new ValidationError("Seller already exists with this email"));
    }
    await verifyOtp(email, otp);
    const hashedPassword = await import_bcryptjs.default.hash(password, 10);
    const seller = await prisma_default.sellers.create({
      data: {
        name,
        email,
        password: hashedPassword,
        country,
        phone_number
      }
    });
    await sendBehaviorLog("sellerRegistration", {
      type: "success",
      source: "auth-service",
      message: "Seller registration succeeded",
      metadata: { sellerId: seller.id }
    });
    res.status(200).json({
      seller,
      message: "Seller registered successfully"
    });
  } catch (error) {
    next(error);
  }
};
var createShop = async (req, res, next) => {
  try {
    const { name, bio, address, opening_hours, website, category, sellerId } = req.body;
    if (!name || !address || !sellerId || !opening_hours || !category || !bio) {
      return next(new ValidationError("All fields are required"));
    }
    const shopData = {
      name,
      bio,
      address,
      category,
      website,
      opening_hours,
      sellerId
    };
    if (website && !website.trim("")) {
      shopData.website = website.trim();
    }
    const shop = await prisma_default.shops.create({
      data: shopData
    });
    res.status(201).json({
      success: true,
      shop,
      message: "Shop created successfully"
    });
  } catch (error) {
    next(error);
  }
};
var createStripeConnectLink = async (req, res, next) => {
  try {
    const { sellerId } = req.body;
    if (!sellerId)
      return next(new ValidationError("Seller ID is required"));
    const seller = await prisma_default.sellers.findUnique({ where: { id: sellerId } });
    if (!seller)
      return next(new ValidationError("Seller not found"));
    let stripeAccountId = seller.stripe_id;
    if (!stripeAccountId) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          email: seller.email,
          country: "US",
          // Hardcoded to US for testing purposes to avoid unsupported country errors
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          }
        });
        stripeAccountId = account.id;
        await prisma_default.sellers.update({
          where: { id: sellerId },
          data: { stripe_id: stripeAccountId }
        });
      } catch (stripeError) {
        console.error("Stripe Account Creation Error:", stripeError);
        return next(
          new AppError(
            stripeError.message || "Failed to create Stripe account. Please ensure Connect is enabled in your Stripe Dashboard.",
            400
          )
        );
      }
    }
    try {
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/success`,
        return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/success`,
        type: "account_onboarding"
      });
      return res.json({ url: accountLink.url });
    } catch (stripeError) {
      console.error("Stripe Account Link Error:", stripeError);
      return next(
        new AppError(
          stripeError.message || "Failed to create Stripe onboarding link.",
          400
        )
      );
    }
  } catch (error) {
    return next(error);
  }
};
var loginSeller = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ValidationError("Email and password are required!"));
    }
    const seller = await prisma_default.sellers.findUnique({ where: { email } });
    if (!seller)
      return next(new AuthError("Invalid email or password!"));
    if (!seller.password) {
      return next(new AuthError("Invalid email or password!"));
    }
    const isMatch = await import_bcryptjs.default.compare(password, seller.password);
    if (!isMatch) {
      return next(new AuthError("Invalid email or password!"));
    }
    const accessToken = await import_jsonwebtoken.default.sign(
      { id: seller.id, role: "seller" },
      process.env.ACCESS_TOKEN_JWT_SECRET,
      {
        expiresIn: "15m"
      }
    );
    const refreshToken = await import_jsonwebtoken.default.sign(
      { id: seller.id, role: "seller" },
      process.env.REFRESH_TOKEN_JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );
    setCookie(res, "seller_refresh_token", refreshToken);
    setCookie(res, "seller_access_token", accessToken);
    await sendBehaviorLog("sellerLogin", {
      type: "success",
      source: "auth-service",
      message: "Seller login succeeded",
      metadata: { sellerId: seller.id }
    });
    res.status(200).json({
      message: "Login successfully",
      seller: { id: seller.id, email: seller.email, name: seller.name }
    });
  } catch (error) {
    return next(error);
  }
};
var getSeller = async (req, res, next) => {
  try {
    const seller = await prisma_default.sellers.findUnique({ where: { id: req.seller.id }, select: { id: true, name: true, email: true, phone_number: true, country: true, createdAt: true, stripe_id: true, suspendedAt: true, suspendedUntil: true, suspensionReason: true, shop: { include: { avatar: true } } } });
    if (!seller) {
      return next(new ValidationError("Seller not found"));
    }
    res.status(200).json({
      success: true,
      seller
    });
  } catch (error) {
    return next(error);
  }
};
var deleteUserAddress = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    const { addressId: id } = req.params;
    if (!id) {
      return next(new ValidationError("Address ID is required"));
    }
    const address = await prisma_default.address.findUnique({
      where: {
        id,
        userId
      }
    });
    if (!address) {
      return next(new ValidationError("Address not found"));
    }
    await prisma_default.address.delete({
      where: {
        id,
        userId
      }
    });
    res.status(200).json({
      success: true,
      message: "Address deleted successfully"
    });
  } catch (error) {
    return next(error);
  }
};
var getUserAddress = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    const addresses = await prisma_default.address.findMany({
      where: {
        userId
      }
    });
    res.status(200).json({
      success: true,
      addresses
    });
  } catch (error) {
    return next(error);
  }
};
var loginAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ValidationError("Email and password are required!"));
    }
    const user = await prisma_default.users.findUnique({ where: { email } });
    if (!user)
      return next(new AuthError("Invalide email or password!"));
    if (isSuspended(user))
      return res.status(403).json({ message: "Account suspended. Contact support." });
    const isMatch = await import_bcryptjs.default.compare(password, user.password);
    if (!isMatch) {
      return next(new AuthError("Invalid email or password!"));
    }
    const isAdmin2 = user.role === "admin";
    if (!isAdmin2) {
      return next(new AuthError("Unauthorized! Not an admin!"));
    }
    const accessToken = await import_jsonwebtoken.default.sign(
      { id: user.id, role: "admin" },
      process.env.ACCESS_TOKEN_JWT_SECRET,
      {
        expiresIn: "15m"
      }
    );
    const refreshToken = await import_jsonwebtoken.default.sign(
      { id: user.id, role: "admin" },
      process.env.REFRESH_TOKEN_JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );
    setCookie(res, "refresh_token", refreshToken);
    setCookie(res, "access_token", accessToken);
    res.status(200).json({
      message: "Login successfully",
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    return next(error);
  }
};

// packages/middleware/isAuthenticated.ts
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"));

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
    const decoded = await import_jsonwebtoken2.default.verify(token, process.env.ACCESS_TOKEN_JWT_SECRET);
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

// apps/auth-service/src/controllers/account.controller.ts
var getNotifications = handle(async (req, res) => {
  const owner = { userId: req.user.id };
  const unreadOnly = req.query.unread === "true";
  const where = unreadOnly ? { ...owner, isRead: false } : owner;
  const [notifications, unreadCount, totalCount] = await Promise.all([
    prisma_default.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" } }),
    prisma_default.notifications.count({ where: { ...owner, isRead: false } }),
    prisma_default.notifications.count({ where: owner })
  ]);
  res.json({ notifications, unreadCount, total: unreadOnly ? unreadCount : totalCount, totalCount });
});
var readNotification = handle(async (req, res) => {
  const result = await prisma_default.notifications.updateMany({ where: { id: objectId(req.params.id), userId: req.user.id }, data: { isRead: true } });
  if (!result.count)
    throw new NotFoundError();
  res.json({ success: true });
});
var readAllNotifications = handle(async (req, res) => {
  await prisma_default.notifications.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
  res.json({ success: true });
});
var addAddress = handle(async (req, res) => {
  const userId = req.user.id;
  const data = addressFields(req.body);
  const address = await transaction(async (tx) => {
    await tx.users.update({ where: { id: userId }, data: { updatedAt: /* @__PURE__ */ new Date() } });
    if (data.isDefault)
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...data, userId } });
  });
  res.status(201).json({ success: true, address });
});
function addressFields(body) {
  const data = Object.fromEntries(["label", "name", "street", "city", "zip", "country"].map((key) => [key, textField(body[key], key)]));
  if (typeof body.isDefault !== "boolean")
    throw new ValidationError("isDefault must be boolean");
  return { ...data, isDefault: body.isDefault };
}
var updateAddress = handle(async (req, res) => {
  const id = objectId(req.params.addressId);
  const userId = req.user.id;
  const data = addressFields(req.body);
  const address = await transaction(async (tx) => {
    if (!await tx.address.findFirst({ where: { id, userId } }))
      throw new NotFoundError();
    await tx.users.update({ where: { id: userId }, data: { updatedAt: /* @__PURE__ */ new Date() } });
    if (req.body.isDefault)
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.update({ where: { id, userId }, data: { ...data, isDefault: req.body.isDefault } });
  });
  res.json({ address });
});
var uploadAccountImage = handle(async (req, res) => {
  const file = req.body.file;
  if (typeof file !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(file) || file.length > 7e6)
    throw new ValidationError("Choose a PNG, JPEG or WebP image under 5 MB");
  const uploaded = await imageKit.upload({ file, fileName: `account-${Date.now()}`, folder: "/accounts" });
  res.status(201).json({ url: uploaded.url, file_id: uploaded.fileId });
});
function avatarData(avatar) {
  if (!avatar)
    return void 0;
  if (typeof avatar.url !== "string" || !avatar.url.startsWith("https://") || typeof avatar.file_id !== "string")
    throw new ValidationError("Invalid avatar");
  return { deleteMany: {}, create: { url: avatar.url, file_id: avatar.file_id } };
}
var updateUser = handle(async (req, res) => {
  const name = textField(req.body.name, "name", 100);
  const user = await prisma_default.users.update({ where: { id: req.user.id }, data: { name, avatar: avatarData(req.body.avatar) }, select: { id: true, name: true, email: true, avatar: true } });
  res.json({ user });
});
var updateShop = handle(async (req, res) => {
  const id = objectId(req.params.shopId);
  if (!await prisma_default.shops.findFirst({ where: { id, sellerId: req.seller.id } }))
    throw new NotFoundError();
  const data = { name: textField(req.body.name, "name", 100), avatar: avatarData(req.body.avatar) };
  for (const key of ["bio", "address", "opening_hours", "website", "coverBanner"]) {
    if (req.body[key] !== void 0) {
      if (req.body[key] === null) {
        data[key] = null;
        continue;
      }
      if (typeof req.body[key] !== "string" || req.body[key].length > 2e3)
        throw new ValidationError(`Invalid ${key}`);
      if (["website", "coverBanner"].includes(key) && req.body[key] && !/^https?:\/\//.test(req.body[key]))
        throw new ValidationError(`Invalid ${key} URL`);
      data[key] = req.body[key];
    }
  }
  if (req.body.socialLinks !== void 0) {
    if (!Array.isArray(req.body.socialLinks) || req.body.socialLinks.length > 10 || req.body.socialLinks.some((item) => !item || typeof item.url !== "string" || !/^https?:\/\//.test(item.url) || typeof item.name !== "string"))
      throw new ValidationError("Invalid social links");
    data.socialLinks = req.body.socialLinks;
  }
  const shop = await prisma_default.shops.update({ where: { id, sellerId: req.seller.id }, data, include: { avatar: true } });
  res.json({ shop });
});
var followShop = handle(async (req, res) => {
  const shopId = objectId(req.params.shopId);
  if (!await prisma_default.shops.findUnique({ where: { id: shopId } }))
    throw new NotFoundError();
  await prisma_default.users.updateMany({ where: { id: req.user.id, NOT: { following: { has: shopId } } }, data: { following: { push: shopId } } });
  res.json({ success: true });
});
var unfollowShop = handle(async (req, res) => {
  const shopId = objectId(req.params.shopId);
  await transaction(async (tx) => {
    const user = await tx.users.findUniqueOrThrow({ where: { id: req.user.id } });
    await tx.users.update({ where: { id: user.id }, data: { following: user.following.filter((id) => id !== shopId) } });
  });
  res.json({ success: true });
});
var followedShops = handle(async (req, res) => {
  const user = await prisma_default.users.findUniqueOrThrow({ where: { id: req.user.id } });
  const shops = await prisma_default.shops.findMany({ where: { id: { in: user.following } }, include: { avatar: true } });
  res.json({ shops });
});

// apps/auth-service/src/controllers/google.controller.ts
var import_crypto2 = __toESM(require("crypto"));
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"));
var import_google_auth_library = require("google-auth-library");
function oauthClient() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI)
    throw new AppError("Google sign-in is not configured", 503);
  return new import_google_auth_library.OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
}
var cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google" };
var googleStart = handle(async (_req, res) => {
  const client = oauthClient();
  const state = import_crypto2.default.randomBytes(32).toString("hex");
  const nonce = import_crypto2.default.randomBytes(32).toString("hex");
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  await redis_default.set(`oauth:${state}`, JSON.stringify({ nonce, codeVerifier }), "EX", 600);
  res.cookie("oauth_state", state, { ...cookieOptions, maxAge: 6e5 });
  res.redirect(client.generateAuthUrl({ scope: ["openid", "email", "profile"], state, nonce, code_challenge: codeChallenge, code_challenge_method: "S256", access_type: "online" }));
});
var googleCallback = handle(async (req, res) => {
  const client = oauthClient();
  const state = req.query.state;
  if (typeof state !== "string" || !/^[a-f\d]{64}$/.test(state) || state !== req.cookies?.oauth_state)
    throw new AuthError("Invalid Google sign-in state");
  res.clearCookie("oauth_state", cookieOptions);
  const stored = await redis_default.getdel(`oauth:${state}`);
  if (!stored || typeof req.query.code !== "string")
    throw new AuthError("Google sign-in expired or was cancelled");
  const { nonce, codeVerifier } = JSON.parse(stored);
  const { tokens } = await client.getToken({ code: req.query.code, codeVerifier });
  if (!tokens.id_token)
    throw new AuthError("Missing Google identity");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const identity = ticket.getPayload();
  if (!identity?.sub || !identity.email_verified || !identity.email || identity.nonce !== nonce)
    throw new AuthError("Google identity could not be verified");
  const email = String(identity.email).toLowerCase();
  const user = await prisma_default.$transaction(async (tx) => {
    const linked = await tx.oauthIdentity.findUnique({ where: { subject: identity.sub } });
    if (linked) {
      const account2 = await tx.users.findUniqueOrThrow({ where: { id: linked.userId } });
      if (isSuspended(account2))
        throw new AuthError("Account suspended. Contact support.");
      return account2;
    }
    let account = await tx.users.findUnique({ where: { email } });
    if (account && isSuspended(account))
      throw new AuthError("Account suspended. Contact support.");
    if (account && !email.endsWith("@gmail.com") && !identity.hd)
      throw new AuthError("Sign in with your existing password to use this account");
    if (account?.role === "admin")
      throw new AuthError("Use the administrator sign-in page");
    if (!account)
      account = await tx.users.create({ data: { email, name: String(identity.name || email.split("@")[0]).slice(0, 100), following: [] } });
    await tx.oauthIdentity.create({ data: { subject: identity.sub, userId: account.id } });
    return account;
  });
  setCookie(res, "access_token", import_jsonwebtoken3.default.sign({ id: user.id, role: "user" }, process.env.ACCESS_TOKEN_JWT_SECRET, { expiresIn: "15m" }));
  setCookie(res, "refresh_token", import_jsonwebtoken3.default.sign({ id: user.id, role: "user" }, process.env.REFRESH_TOKEN_JWT_SECRET, { expiresIn: "7d" }));
  res.redirect(`${process.env.USER_UI_URL || "http://localhost:3000"}/profile`);
});

// packages/utils/cart.ts
function cartLineKey(item) {
  return JSON.stringify([item.id, item.selectedOptions?.color || "", item.selectedOptions?.size || ""]);
}

// apps/auth-service/src/controllers/shopping-state.controller.ts
function shoppingPayload(body) {
  if (!body || !Array.isArray(body.cart) || !Array.isArray(body.wishlist) || body.cart.length > 100 || body.wishlist.length > 200 || JSON.stringify(body).length > 5e5)
    throw new ValidationError("Shopping state is too large");
  const line = (p) => {
    if (!p || typeof p !== "object")
      throw new ValidationError("Invalid item");
    objectId(p.id);
    if (p.variantId)
      objectId(p.variantId);
    const quantity = Number(p.quantity ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1e4)
      throw new ValidationError("Invalid quantity");
    const text = (v, max = 300) => typeof v === "string" ? v.slice(0, max) : "";
    const price = Number(p.sale_price ?? p.price ?? 0);
    if (!Number.isFinite(price) || price < 0)
      throw new ValidationError("Invalid price");
    const images = (Array.isArray(p.images) ? p.images : []).slice(0, 4).map((i) => typeof i === "string" ? i : i?.url).filter((url) => typeof url === "string" && url.startsWith("https://") && url.length < 2e3).map((url) => ({ url }));
    return { id: p.id, title: text(p.title), slug: text(p.slug), price, sale_price: price, regular_price: Number.isFinite(p.regular_price) ? p.regular_price : price, quantity, variantId: p.variantId || null, selectedOptions: { color: text(p.selectedOptions?.color, 200), size: text(p.selectedOptions?.size, 200) }, images, image: typeof p.image === "string" && p.image.startsWith("https://") ? p.image.slice(0, 2e3) : null, shopId: typeof p.shopId === "string" ? p.shopId : null, stock: Number.isSafeInteger(p.stock) ? Math.max(0, p.stock) : 0, category: text(p.category), rating: Number.isFinite(p.rating) ? p.rating : 0 };
  };
  const cart = body.cart.map(line), wishlist = body.wishlist.map(line);
  const keys = cart.map(cartLineKey);
  if (new Set(keys).size !== keys.length || new Set(wishlist.map((p) => p.id)).size !== wishlist.length)
    throw new ValidationError("Duplicate items");
  return { cart, wishlist };
}
var getShoppingState = handle(async (req, res) => {
  if (req.query.ownerId !== req.user.id)
    throw new ForbiddenError();
  res.setHeader("Cache-Control", "no-store");
  const state = await prisma_default.shoppingState.upsert({ where: { id: req.user.id }, create: { id: req.user.id, payload: { cart: [], wishlist: [] } }, update: {} });
  res.json(state);
});
var saveShoppingState = handle(async (req, res) => {
  if (req.body.ownerId !== req.user.id)
    throw new ForbiddenError();
  const revision = req.body.revision;
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new ValidationError("Invalid revision");
  const payload = shoppingPayload(req.body.payload);
  const result = await prisma_default.shoppingState.updateMany({ where: { id: req.user.id, revision }, data: { payload, revision: { increment: 1 } } });
  if (!result.count) {
    res.status(409).json({ message: "Shopping state changed on another device" });
    return;
  }
  res.json({ revision: revision + 1 });
});

// apps/auth-service/src/routes/auth.router.ts
var router = import_express.default.Router();
router.get("/shopping-state", isAuthenticated_default, isUser, getShoppingState);
router.put("/shopping-state", isAuthenticated_default, isUser, saveShoppingState);
router.get("/auth/google", googleStart);
router.get("/auth/google/callback", googleCallback);
router.get("/user-notifications", isAuthenticated_default, isUser, getNotifications);
router.patch("/notifications/read-all", isAuthenticated_default, isUser, readAllNotifications);
router.patch("/notifications/:id/read", isAuthenticated_default, isUser, readNotification);
router.put("/update-address/:addressId", isAuthenticated_default, isUser, updateAddress);
router.put("/update-user", isAuthenticated_default, isUser, updateUser);
router.post("/upload-account-image", isAuthenticated_default, uploadAccountImage);
router.put("/update-shop/:shopId", isAuthenticated_default, isSeller, updateShop);
router.post("/follow-shop/:shopId", isAuthenticated_default, isUser, followShop);
router.delete("/unfollow-shop/:shopId", isAuthenticated_default, isUser, unfollowShop);
router.get("/followed-shops", isAuthenticated_default, isUser, followedShops);
router.post("/user-registration", userRegistration);
router.post("/verify-user", verifyUser);
router.post("/login-user", loginUser);
router.get("/logout-user", (_req, res) => {
  for (const name of ["access_token", "refresh_token"])
    res.clearCookie(name, { path: "/" });
  res.json({ success: true });
});
router.get("/logout-admin", (_req, res) => {
  for (const name of ["access_token", "refresh_token"])
    res.clearCookie(name, { path: "/" });
  res.json({ success: true });
});
router.get("/logout-seller", (_req, res) => {
  for (const name of ["seller_access_token", "seller_refresh_token"])
    res.clearCookie(name, { path: "/" });
  res.json({ success: true });
});
router.post("/login-admin", loginAdmin);
router.post("/refresh-token", refreshUserToken);
router.post("/seller-refresh-token", refreshSellerToken);
router.get("/logged-in-user", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!req.cookies?.access_token && !req.cookies?.refresh_token && !req.headers.authorization) {
    res.status(401).json({ code: "SESSION_MISSING", message: "Please sign in." });
    return;
  }
  next();
}, isAuthenticated_default, isUser, getUser);
router.get("/logged-in-admin", isAuthenticated_default, isAdmin, getAdmin);
router.patch("/change-password", isAuthenticated_default, changeUserPassword);
router.post("/forgot-password-user", userForgotPassword);
router.post("/reset-password-user", resetUserPassword);
router.post("/verify-forgot-password-user", verifyUserForgotPassword);
router.post("/seller-registration", registerSeller);
router.post("/verify-seller", verifySeller);
router.post("/login-seller", loginSeller);
router.get("/logged-in-seller", isAuthenticated_default, isSeller, getSeller);
router.post("/create-shop", createShop);
router.post("/create-stripe-link", createStripeConnectLink);
router.get("/shipping-addresses", isAuthenticated_default, isUser, getUserAddress);
router.post("/add-address", isAuthenticated_default, isUser, addAddress);
router.delete("/delete-address/:addressId", isAuthenticated_default, isUser, deleteUserAddress);
var auth_router_default = router;

// apps/auth-service/src/main.ts
var import_swagger_ui_express = __toESM(require("swagger-ui-express"));
var swaggerDocument = require_swagger_output();
var app = (0, import_express2.default)();
app.use((0, import_cors.default)({
  origin: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));
app.use(import_express2.default.json({ limit: "100mb" }));
app.use(import_express2.default.urlencoded({ extended: true, limit: "100mb" }));
app.use((0, import_cookie_parser.default)());
app.get("/", (req, res) => {
  res.send({ "message": "Hello API" });
});
app.use("/api-docs", import_swagger_ui_express.default.serve, import_swagger_ui_express.default.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json(swaggerDocument);
});
app.use("/api", auth_router_default);
app.use(errorMiddleware);
var port = process.env.PORT || 6001;
var server = app.listen(port, () => {
  console.log(`Auth service is listening at http://localhost:${port}/`);
  console.log(`Swagger json available at http://localhost:${port}/docs-json`);
  console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
});
server.on("error", (err) => {
  console.error("Server error:", err);
});
//# sourceMappingURL=main.js.map
