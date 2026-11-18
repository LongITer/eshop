"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tests/acceptance/server.ts
var server_exports = {};
__export(server_exports, {
  start: () => start
});
module.exports = __toCommonJS(server_exports);

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

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

// packages/utils/admin-access.ts
var adminRoles = ["owner", "operations", "support", "finance"];
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

// apps/admin-service/src/lib/notification-jobs.ts
async function processNotificationJob() {
  const now = /* @__PURE__ */ new Date();
  const candidate = await prisma_default.notificationJob.findFirst({ where: { OR: [{ status: "Queued" }, { status: "Running", leaseUntil: { lt: now } }] }, orderBy: { createdAt: "asc" } });
  if (!candidate)
    return;
  const leaseUntil = new Date(Date.now() + 6e4);
  const claimed = await prisma_default.notificationJob.updateMany({ where: { id: candidate.id, status: candidate.status, ...candidate.status === "Running" ? { leaseUntil: { lt: now } } : {} }, data: { status: "Running", leaseUntil } });
  if (!claimed.count)
    return;
  try {
    await transaction(async (tx) => {
      const job = await tx.notificationJob.findUniqueOrThrow({ where: { id: candidate.id } });
      if (job.leaseUntil?.getTime() !== leaseUntil.getTime() || job.status !== "Running")
        return;
      await tx.notificationJob.update({ where: { id: job.id, status: "Running", leaseUntil }, data: { updatedAt: /* @__PURE__ */ new Date() } });
      const actor = await tx.users.findUnique({ where: { id: job.actorId } });
      if (!canAdmin(actor, "notifications") || isSuspended(actor))
        throw new Error("Sender no longer has permission");
      const where = { createdAt: { lte: job.createdAt }, ...job.recipientId ? { id: job.recipientId } : {} };
      const args = { where, select: { id: true }, take: 200, orderBy: { id: "asc" }, ...job.cursor ? { cursor: { id: job.cursor }, skip: 1 } : {} };
      const rows = job.audience === "users" ? await tx.users.findMany({ ...args, where: { ...where, role: "user" } }) : await tx.sellers.findMany(args);
      if (rows.length)
        await tx.notifications.createMany({ data: rows.map((row) => ({ title: job.title, message: job.message, type: "System", metadata: { jobId: job.id }, ...job.audience === "users" ? { userId: row.id } : { sellerId: row.id } })) });
      await tx.notificationJob.update({ where: { id: job.id }, data: { cursor: rows.at(-1)?.id ?? job.cursor, sent: { increment: rows.length }, status: rows.length === 200 ? "Queued" : "Completed", leaseUntil: null, error: null } });
    });
  } catch (error) {
    await prisma_default.notificationJob.updateMany({ where: { id: candidate.id, status: "Running", leaseUntil }, data: { status: "Failed", leaseUntil: null, error: error instanceof Error && error.message === "Sender no longer has permission" ? error.message : "Delivery failed. Retry to continue from the last completed batch." } });
  }
}
function startNotificationWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy)
      return;
    busy = true;
    try {
      await processNotificationJob();
    } catch (error) {
      console.error("Notification worker unavailable", error instanceof Error ? error.message : "Unknown error");
    } finally {
      busy = false;
    }
  }, 2e3);
  timer.unref();
  return timer;
}

// tests/acceptance/server.ts
var import_express5 = __toESM(require("express"));
var import_cookie_parser = __toESM(require("cookie-parser"));
var import_jsonwebtoken4 = __toESM(require("jsonwebtoken"));
var import_bcryptjs2 = __toESM(require("bcryptjs"));

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

// apps/auth-service/src/routes/auth.router.ts
var import_express = __toESM(require("express"));

// apps/auth-service/src/utils/auth.helper.ts
var import_crypto = __toESM(require("crypto"));

// tests/acceptance/redis.ts
var values = /* @__PURE__ */ new Map();
var redis_default = {
  get: async (key) => values.get(key) ?? null,
  set: async (key, value) => {
    values.set(key, value);
    return "OK";
  },
  setex: async (key, _ttl, value) => {
    values.set(key, value);
    return "OK";
  },
  getdel: async (key) => {
    const value = values.get(key);
    values.delete(key);
    return value ?? null;
  },
  del: async (key) => Number(values.delete(key)),
  expire: async () => 1
};

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

// tests/acceptance/stripe.ts
var refunds = /* @__PURE__ */ new Map();
var Stripe = class {
  paymentIntents = {
    list: async () => ({ data: [{ id: "pi_acceptance", amount: 32e3, currency: "usd", status: "succeeded", created: Math.floor(Date.now() / 1e3) }], has_more: false }),
    retrieve: async () => ({ id: "pi_acceptance", transfer_data: null }),
    create: async () => ({ client_secret: "pi_acceptance_secret_no_real_payment" })
  };
  refunds = {
    list: () => ({ async *[Symbol.asyncIterator]() {
      for (const refund2 of refunds.values())
        yield refund2;
    } }),
    retrieve: async (id) => refunds.get(id),
    create: async (data) => {
      const result = { id: `re_${data.metadata.orderId}`, status: "succeeded", ...data };
      refunds.set(result.id, result);
      return result;
    }
  };
};

// tests/acceptance/logging.ts
var sendBehaviorLog = async () => {
};
var invalidateLogConfigCache = async () => {
};

// apps/auth-service/src/controllers/auth.controller.ts
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
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
    if (isSuspended(account))
      return res.status(403).json({ message: "Account suspended. Contact support." });
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
    if (isSuspended(seller))
      return res.status(403).json({ message: "Account suspended. Contact support." });
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
    const seller = await prisma_default.sellers.findUnique({ where: { id: req.seller.id }, select: { id: true, name: true, email: true, phone_number: true, country: true, createdAt: true, stripe_id: true, shop: { include: { avatar: true } } } });
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
  const where = { userId: req.user.id };
  const [notifications2, unreadCount, total] = await Promise.all([
    prisma_default.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" } }),
    prisma_default.notifications.count({ where: { ...where, isRead: false } }),
    prisma_default.notifications.count({ where })
  ]);
  res.json({ notifications: notifications2, unreadCount, total });
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

// apps/product-service/src/routes/product.router.ts
var import_express2 = __toESM(require("express"));

// apps/product-service/src/controllers/catalog-query.ts
var filteredCatalog = handle(async (req, res) => {
  const where = { status: "Active", isDeleted: false };
  const list = (key) => {
    const raw = req.query[key];
    const values2 = (Array.isArray(raw) ? raw : raw ? String(raw).split(",") : []).map(String).map((v) => v.trim()).filter(Boolean);
    if (values2.length > 30 || values2.some((v) => v.length > 100))
      throw new ValidationError("Too many filter values");
    return values2;
  };
  for (const key of ["categories", "subCategories", "colors", "sizes"]) {
    const values2 = list(key);
    if (!values2.length)
      continue;
    if (key === "categories")
      where.category = { in: values2 };
    if (key === "subCategories")
      where.subCategory = { in: values2 };
    if (key === "colors")
      where.colors = { hasSome: values2 };
    if (key === "sizes")
      where.sizes = { hasSome: values2 };
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
    const limit2 = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit2;
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
        take: limit2,
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
      totalPages: Math.ceil(total / limit2)
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
      limit: limit2 = 12
    } = req.query;
    const parsedPriceRange = typeof priceRange === "string" ? priceRange.split(",").map(Number) : [0, 1e4];
    const parsedPage = Number(page);
    const parsedLimit = Number(limit2);
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
    const { categories = [], countries = [], page = 1, limit: limit2 = 12 } = req.query;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit2);
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
    const limit2 = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit2;
    const baseFilter = {
      status: "Active",
      isDeleted: false,
      AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }]
    };
    const [events, total, top10BySales] = await Promise.all([
      prisma_default.products.findMany({
        skip,
        take: limit2,
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
      totalPages: Math.ceil(total / limit2)
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
    const [notifications2, unreadCount] = await Promise.all([
      prisma_default.notifications.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 50
      }),
      prisma_default.notifications.count({ where: { ...where, isRead: false } })
    ]);
    return res.status(200).json({
      success: true,
      notifications: notifications2,
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
var STORE_CURRENCY = "usd";
function usdCents(amount) {
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents))
    throw new Error("Invalid USD amount");
  return cents;
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
  cooler: ["cooler", "t\u1EA3n nhi\u1EC7t"]
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
function hardwareTokens(values2, kind) {
  if (!values2.length)
    return [];
  const result = /* @__PURE__ */ new Set();
  for (const value of values2) {
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
function watts(values2) {
  const parsed = values2.map((value) => {
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
  const sort = req.query.sort ?? "priceAsc";
  if (sort !== "priceAsc" && sort !== "priceDesc")
    throw new ValidationError("Invalid sort option");
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const where = { ...availableProducts(), stock: { gt: 0 }, AND: [
    { OR: COMPONENT_TERMS[slot].flatMap((term) => [{ category: { contains: term, mode: "insensitive" } }, { subCategory: { contains: term, mode: "insensitive" } }, { tags: { has: term } }]) },
    ...q ? [{ title: { contains: q, mode: "insensitive" } }] : []
  ] };
  const { skip, take } = pageArgs(req.query);
  const [products, total] = await Promise.all([
    prisma_default.products.findMany({ where, skip, take, orderBy: [{ sale_price: sort === "priceDesc" ? "desc" : "asc" }, { id: "asc" }], select }),
    prisma_default.products.count({ where })
  ]);
  res.json({ products, currency: "usd", pagination: { page: skip / take + 1, total, totalPages: Math.max(1, Math.ceil(total / take)) } });
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
var router2 = import_express2.default.Router();
router2.get("/pc-builder/catalog", buildCatalog);
router2.post("/pc-builder/quote", quoteBuild);
router2.get("/pc-builder/saved", isAuthenticated_default, isUser, getSavedBuild);
router2.put("/pc-builder/saved", isAuthenticated_default, isUser, saveBuild);
router2.get("/variants/:id", listVariants);
router2.put("/variants/:id", isAuthenticated_default, isSeller, saveVariant);
router2.get("/sitemap-data", handle(async (req, res) => {
  const skip = Math.max(0, Math.floor(Number(req.query.page) || 0)) * 500;
  const [products, shops] = await Promise.all([
    prisma_default.products.findMany({ where: { isDeleted: false, status: "Active" }, orderBy: { id: "asc" }, skip, take: 500, select: { slug: true, updatedAt: true } }),
    prisma_default.shops.findMany({ orderBy: { id: "asc" }, skip, take: 500, select: { id: true, updatedAt: true } })
  ]);
  res.json({ entries: [...products.map((p) => ({ path: `/product/${encodeURIComponent(p.slug)}`, updatedAt: p.updatedAt })), ...shops.map((s) => ({ path: `/shop/${s.id}`, updatedAt: s.updatedAt }))], hasMore: products.length === 500 || shops.length === 500 });
}));
router2.get("/seller-reports", isAuthenticated_default, isSeller, revenueReport);
router2.get("/seller-product/:id", isAuthenticated_default, isSeller, getEditableProduct);
router2.put("/update-product/:id", isAuthenticated_default, isSeller, updateProduct);
router2.get("/inventory", isAuthenticated_default, isSeller, getInventory);
router2.post("/create-review", isAuthenticated_default, isUser, createReview);
router2.get("/product-reviews/:productId", getReviews);
router2.get("/get-categories", getCategories);
router2.get("/get-seller-stats", isAuthenticated_default, isSeller, getSellerStats);
router2.get("/get-discount-code", isAuthenticated_default, isSeller, getDiscountCodes);
router2.patch("/discount-code/:id/products", isAuthenticated_default, isSeller, updateDiscountProducts);
router2.get(
  "/get-seller-notifications",
  isAuthenticated_default,
  isSeller,
  getSellerNotifications
);
router2.patch(
  "/notifications/read-all",
  isAuthenticated_default,
  isSeller,
  markAllSellerNotificationsRead
);
router2.patch(
  "/notifications/:id/read",
  isAuthenticated_default,
  isSeller,
  markSellerNotificationRead
);
router2.post("/create-discount-code", isAuthenticated_default, isSeller, createDiscountCode);
router2.delete(
  "/delete-discount-code/:id",
  isAuthenticated_default,
  isSeller,
  deleteDiscountCodes
);
router2.post("/upload-product-image", isAuthenticated_default, isSeller, uploadProductImages);
router2.delete("/delete-product-image", isAuthenticated_default, isSeller, deleteProductImages);
router2.post("/create-product", isAuthenticated_default, isSeller, createProduct);
router2.get("/get-shop-products", isAuthenticated_default, isSeller, getShopProducts);
router2.post("/delete-product/:id", isAuthenticated_default, isSeller, deleteProduct);
router2.post("/restore-product/:id", isAuthenticated_default, isSeller, restoreProduct);
router2.get("/get-all-products", getAllProducts);
router2.get("/get-product/:slug", getProductDetails);
router2.get("/get-filtered-products", filteredCatalog);
router2.get("/get-filtered-offers", getFilteredEvents);
router2.get("/get-filtered-shops", getFilteredShops);
router2.get("/search-products", searchProducts);
router2.get("/top-shops", topShops);
router2.get("/get-shop/:id", getShopById);
router2.get("/get-all-events", getAllEvents);
var product_router_default = router2;

// packages/utils/admin-audit.ts
function audit(tx, actorId, action, targetId, reason, before, after) {
  const json = (value) => JSON.parse(JSON.stringify(value ?? {}));
  return tx.adminAudit.create({ data: { actorId, action, targetId, reason, before: json(before), after: json(after) } });
}

// apps/admin-service/src/controllers/notification-jobs.controller.ts
var queueNotification = handle(async (req, res) => {
  const title = textField(req.body.title, "title", 150);
  const message = textField(req.body.message, "message", 3e3);
  const audience = req.body.audience;
  const requestKey = textField(req.body.requestKey, "request key", 100);
  if (!["users", "sellers"].includes(audience))
    throw new ValidationError("Choose customers or sellers");
  const recipientId = req.body.recipientId ? objectId(req.body.recipientId) : null;
  if (!recipientId && req.body.confirmBroadcast !== true)
    throw new ValidationError("Confirm the broadcast");
  if (recipientId) {
    const recipient = audience === "users" ? await prisma_default.users.findFirst({ where: { id: recipientId, role: "user" }, select: { id: true } }) : await prisma_default.sellers.findUnique({ where: { id: recipientId }, select: { id: true } });
    if (!recipient)
      throw new NotFoundError("Recipient not found");
  }
  const data = { actorId: req.user.id, title, message, audience, recipientId };
  const job = await transaction(async (tx) => {
    const result = await tx.notificationJob.upsert({ where: { requestKey }, create: { requestKey, ...data }, update: {} });
    if (Object.entries(data).some(([key, value]) => result[key] !== value))
      throw new ValidationError("This request key belongs to another message");
    if (!await tx.adminAudit.findFirst({ where: { action: "notification.queue", targetId: result.id } }))
      await audit(tx, req.user.id, "notification.queue", result.id, recipientId ? "Individual notification" : "Confirmed broadcast", {}, data);
    return result;
  });
  res.status(202).json({ job });
});
var notificationJobs = handle(async (req, res) => {
  const where = { actorId: req.user.id };
  const [rows, total] = await Promise.all([prisma_default.notificationJob.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" } }), prisma_default.notificationJob.count({ where })]);
  res.json({ rows, total });
});
var retryNotification = handle(async (req, res) => {
  const id = objectId(req.params.id);
  await transaction(async (tx) => {
    const result = await tx.notificationJob.updateMany({ where: { id, actorId: req.user.id, status: "Failed" }, data: { status: "Queued", error: null } });
    if (!result.count)
      throw new ValidationError("Only your failed deliveries can be retried");
    await audit(tx, req.user.id, "notification.retry", id, "Resume failed delivery", { status: "Failed" }, { status: "Queued" });
  });
  res.json({ success: true });
});

// apps/admin-service/src/controllers/templates.controller.ts
var templates = handle(async (req, res) => {
  const [rows, total] = await Promise.all([prisma_default.pcBuildTemplate.findMany({ ...pageArgs(req.query), orderBy: { createdAt: "desc" } }), prisma_default.pcBuildTemplate.count()]);
  res.json({ rows, total });
});
var saveTemplate = handle(async (req, res) => {
  const name = textField(req.body.name, "name", 150), purpose = textField(req.body.purpose, "purpose", 40);
  const budgetMin = Number(req.body.budgetMin), budgetMax = Number(req.body.budgetMax);
  if (!["gaming", "office", "design", "streaming", "learning"].includes(purpose) || !Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0 || budgetMax < budgetMin)
    throw new ValidationError("Invalid purpose or budget range");
  const components = req.body.components;
  if (!components || typeof components !== "object" || Array.isArray(components) || !Object.keys(components).length || JSON.stringify(components).length > 2e4 || Object.values(components).some((v) => typeof v !== "string" || v.length > 300))
    throw new ValidationError("Provide component names");
  const productIds = req.body.productIds ?? [];
  if (!Array.isArray(productIds) || productIds.length > 20)
    throw new ValidationError("Up to 20 products allowed");
  productIds.forEach(objectId);
  if (typeof req.body.isActive !== "boolean")
    throw new ValidationError("Choose a publication state");
  const data = { name, purpose, budgetMin, budgetMax, components, productIds: [...new Set(productIds)], description: req.body.description ? textField(req.body.description, "description", 2e3) : null, isActive: req.body.isActive };
  const template = await transaction(async (tx) => {
    if (data.productIds.length && await tx.products.count({ where: { id: { in: data.productIds }, isDeleted: false, status: "Active" } }) !== data.productIds.length)
      throw new ValidationError("Linked products must be active");
    const before = req.params.id ? await tx.pcBuildTemplate.findUnique({ where: { id: objectId(req.params.id) } }) : null;
    if (req.params.id && !before)
      throw new NotFoundError();
    const result = before ? await tx.pcBuildTemplate.update({ where: { id: before.id }, data }) : await tx.pcBuildTemplate.create({ data });
    await audit(tx, req.user.id, "template.save", result.id, before ? "Updated PC template" : "Created PC template", before, result);
    return result;
  });
  res.json({ template });
});

// apps/admin-service/src/routes/admin.route.ts
var import_express3 = __toESM(require("express"));

// apps/admin-service/src/controllers/admin.controller.ts
var accountFields = { id: true, name: true, email: true, role: true, adminRole: true, createdAt: true, avatar: true, suspendedAt: true, suspendedUntil: true, suspensionReason: true };
var sellerFields = { id: true, name: true, email: true, phone_number: true, country: true, createdAt: true, suspendedAt: true, suspendedUntil: true, suspensionReason: true, shop: { select: { id: true, name: true, avatar: true, category: true, ratings: true } } };
var searchText = (value) => typeof value === "string" ? value.trim().slice(0, 200) : "";
var personSearch = (search) => search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {};
async function exportRows(res, name, fetch, map) {
  res.attachment(`${name}.csv`).type("text/csv");
  let cursor;
  let first = true;
  do {
    const batch = await fetch(cursor);
    if (!batch.length || res.destroyed)
      break;
    const encoded = csv(batch.map(map));
    if (!res.write((first ? "\uFEFF" + encoded : encoded.slice(encoded.indexOf("\n") + 1)) + "\r\n")) {
      await new Promise((resolve) => {
        const done = () => {
          res.off("drain", done);
          res.off("close", done);
          resolve();
        };
        res.once("drain", done);
        res.once("close", done);
      });
    }
    first = false;
    cursor = batch.length === 500 ? batch[batch.length - 1].id : void 0;
  } while (cursor && !res.destroyed);
  if (!res.destroyed)
    res.end();
}
var batchArgs = (cursor) => ({ take: 500, orderBy: { id: "asc" }, ...cursor ? { cursor: { id: cursor }, skip: 1 } : {} });
var pagination = (query, total) => {
  const { skip, take } = pageArgs(query);
  return { currentPage: skip / take + 1, totalPages: Math.max(1, Math.ceil(total / take)) };
};
function catalog(events) {
  return handle(async (req, res) => {
    const search = searchText(req.query.search);
    const where = {
      ...events ? { AND: [{ starting_date: { not: null } }, { ending_date: { not: null } }] } : {},
      ...search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { category: { contains: search, mode: "insensitive" } }] } : {}
    };
    if (req.query.status) {
      if (!["Active", "Inactive", "Draft", "Suspended"].includes(String(req.query.status)))
        throw new ValidationError("Invalid status");
      where.status = req.query.status;
    }
    const include = { images: true, shop: { select: { id: true, name: true, avatar: true } } };
    if (req.query.format === "csv")
      return exportRows(res, events ? "promotions" : "products", (cursor) => prisma_default.products.findMany({ where, ...batchArgs(cursor), include }), (p) => ({ Title: p.title, Price: p.sale_price, Stock: p.stock, Category: p.category, Rating: p.rating, Shop: p.shop?.name, Status: p.status, Deleted: p.isDeleted, Start: p.starting_date?.toISOString(), End: p.ending_date?.toISOString() }));
    const [rows, total] = await Promise.all([prisma_default.products.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "desc" }, { id: "desc" }], include }), prisma_default.products.count({ where })]);
    res.json({ success: true, [events ? "events" : "products"]: rows, total, ...pagination(req.query, total) });
  });
}
var getAllProducts2 = catalog(false);
var getAllEvents2 = catalog(true);
var getAllUsers = handle(async (req, res) => {
  const role = req.query.role ?? "user";
  if (!["user", "admin", "all"].includes(String(role)))
    throw new ValidationError("Invalid role filter");
  const where = { ...personSearch(searchText(req.query.search)), ...role === "all" ? { role: { in: ["user", "admin"] } } : { role: String(role) } };
  if (req.query.format === "csv")
    return exportRows(res, "users", (cursor) => prisma_default.users.findMany({ where, ...batchArgs(cursor), select: accountFields }), (u) => ({ Name: u.name, Email: u.email, Role: u.role, Joined: u.createdAt.toISOString(), Suspended: isSuspended(u) }));
  const [users, total] = await Promise.all([prisma_default.users.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: accountFields }), prisma_default.users.count({ where })]);
  res.json({ users, total, ...pagination(req.query, total) });
});
var getAllSellers = handle(async (req, res) => {
  const where = personSearch(searchText(req.query.search));
  if (req.query.format === "csv")
    return exportRows(res, "sellers", (cursor) => prisma_default.sellers.findMany({ where, ...batchArgs(cursor), select: sellerFields }), (s) => ({ Name: s.name, Email: s.email, Phone: s.phone_number, Country: s.country, Shop: s.shop?.name, Rating: s.shop?.ratings, Joined: s.createdAt.toISOString(), Suspended: isSuspended(s) }));
  const [sellers, total] = await Promise.all([prisma_default.sellers.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: sellerFields }), prisma_default.sellers.count({ where })]);
  res.json({ sellers, total, ...pagination(req.query, total) });
});
var getAllAdmin = handle(async (_req, res) => {
  res.json({ admins: await prisma_default.users.findMany({ where: { role: "admin" }, select: accountFields, orderBy: { createdAt: "asc" } }) });
});
var addAdmin = handle(async (req, res) => {
  const email = textField(req.body.email, "email", 254).toLowerCase();
  const role = req.body.role ?? "admin";
  const adminRole = req.body.adminRole ?? "operations";
  const reason = textField(req.body.reason, "reason", 1e3);
  if (!["admin", "user"].includes(role) || !adminRoles.includes(adminRole))
    throw new ValidationError("Invalid administrator role");
  const user = await transaction(async (tx) => {
    await tx.adminGuard.upsert({ where: { id: "owners" }, create: { id: "owners", revision: 1 }, update: { revision: { increment: 1 } } });
    const actor = await tx.users.findUnique({ where: { id: req.user.id } });
    if (!canAdmin(actor, "team") || isSuspended(actor))
      throw new ForbiddenError();
    const current = await tx.users.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: accountFields });
    if (!current)
      throw new NotFoundError("User not found");
    if (current.id === req.user.id)
      throw new ValidationError("Ask another owner to change your access");
    if (isSuspended(current) && role === "admin")
      throw new ValidationError("Restore the account before granting access");
    const updated = await tx.users.update({ where: { id: current.id }, data: { role, adminRole: role === "admin" ? adminRole : null }, select: accountFields });
    await audit(tx, req.user.id, "admin.role", current.id, reason, { role: current.role, adminRole: current.adminRole }, { role, adminRole: updated.adminRole });
    return updated;
  });
  res.json({ success: true, user });
});
var getSiteConfig = handle(async (_req, res) => {
  const config = await prisma_default.site_config.findFirst();
  if (!config)
    throw new NotFoundError("Site config not found");
  res.json({ config });
});
var updateSiteConfig = handle(async (req, res) => {
  const data = {};
  for (const key of ["logo", "banner"])
    if (req.body[key] !== void 0) {
      const value = req.body[key];
      if (value !== "" && value !== null && (typeof value !== "string" || value.length > 2e3 || !/^https:\/\//.test(value)))
        throw new ValidationError("Use an uploaded image or HTTPS URL");
      data[key] = value || null;
    }
  if (req.body.categories !== void 0) {
    if (!Array.isArray(req.body.categories) || req.body.categories.length > 200)
      throw new ValidationError("Invalid categories");
    const categories = req.body.categories.map((v) => textField(v, "category", 100));
    if (new Set(categories.map((v) => v.toLowerCase())).size !== categories.length)
      throw new ValidationError("Duplicate categories");
    data.categories = categories;
  }
  if (req.body.subCategories !== void 0) {
    const value = req.body.subCategories;
    if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 3e4 || Object.values(value).some((v) => !Array.isArray(v) || v.some((s) => typeof s !== "string" || !s.trim() || s.length > 100)))
      throw new ValidationError("Invalid subcategories");
    data.subCategories = value;
  }
  const config = await transaction(async (tx) => {
    const current = await tx.site_config.findFirst();
    if (!current)
      throw new NotFoundError();
    const categories = req.body.categories ?? current.categories;
    const subs = req.body.subCategories ?? current.subCategories;
    if (Object.keys(subs).some((key) => !categories.includes(key)))
      throw new ValidationError("Subcategories must belong to an existing category");
    const removed = current.categories.filter((c) => !categories.includes(c));
    if (removed.length && await tx.products.count({ where: { category: { in: removed }, isDeleted: false } }))
      throw new ValidationError("Move products before removing their category");
    const updated = await tx.site_config.update({ where: { id: current.id }, data });
    await audit(tx, req.user.id, "settings.site", current.id, "Updated site configuration", current, updated);
    return updated;
  });
  res.json({ config });
});

// apps/admin-service/src/controllers/log-config.controller.ts
var getLogConfig = async (req, res, next) => {
  try {
    let config = await prisma_default.log_config.findFirst();
    if (!config) {
      config = await prisma_default.log_config.create({ data: {} });
    }
    return res.status(200).json({ success: true, config });
  } catch (error) {
    return next(error);
  }
};
var updateLogConfig = async (req, res, next) => {
  try {
    const allowedFields = [
      "userLogin",
      "userRegistration",
      "userLogout",
      "passwordChange",
      "passwordReset",
      "productView",
      "productSearch",
      "productFilter",
      "addToCart",
      "addToWishlist",
      "orderCreated",
      "orderCancelled",
      "paymentAttempt",
      "paymentSuccess",
      "paymentFailed",
      "couponUsed",
      "sellerLogin",
      "sellerRegistration",
      "shopCreated",
      "productCreated",
      "productDeleted",
      "orderStatusChange",
      "apiErrors",
      "rateLimitHit",
      "webhookEvents"
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (typeof req.body[field] === "boolean") {
        updateData[field] = req.body[field];
      }
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update. Provide boolean values for behavior actions."
      });
    }
    const config = await transaction(async (tx) => {
      const before = await tx.log_config.findFirst();
      const after = before ? await tx.log_config.update({ where: { id: before.id }, data: updateData }) : await tx.log_config.create({ data: updateData });
      await audit(tx, req.user.id, "settings.logs", after.id, "Updated logging settings", before, after);
      return after;
    });
    await invalidateLogConfigCache();
    return res.status(200).json({
      success: true,
      message: "Log configuration updated successfully",
      config
    });
  } catch (error) {
    return next(error);
  }
};

// packages/middleware/adminPermission.ts
var adminPermission = (permission) => (req, _res, next) => {
  if (req.role !== "admin" || !canAdmin(req.user, permission))
    return next(new ForbiddenError("You do not have permission for this action"));
  next();
};

// apps/admin-service/src/lib/reporting.ts
var REPORT_TIMEZONE = "Asia/Ho_Chi_Minh";
function adminDateRange(query, days = 30) {
  const parse = (value, end) => {
    const text = String(value);
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00` : text);
  };
  const lte = query.to ? parse(query.to, true) : /* @__PURE__ */ new Date();
  const gte = query.from ? parse(query.from, false) : new Date(lte.getTime() - days * 864e5);
  if (!Number.isFinite(gte.getTime()) || !Number.isFinite(lte.getTime()) || gte > lte || lte.getTime() - gte.getTime() > 366 * 864e5)
    throw new ValidationError("Choose a valid date range of at most one year");
  return { gte, lte };
}
var reportDay = (date) => new Date(date.getTime() + 7 * 36e5).toISOString().slice(0, 10);
async function orderTotals(range, shopId) {
  const paid = { $and: [{ $eq: ["$paymentStatus", "Paid"] }, { $not: [{ $in: ["$status", ["Cancelled", "Returned", "Refunded"]] }] }] };
  const cents = { $round: [{ $multiply: ["$totalAmount", 100] }, 0] };
  const data = await prisma_default.orders.aggregateRaw({ pipeline: [
    { $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...shopId ? { shopId: { $oid: shopId } } : {} } },
    { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: REPORT_TIMEZONE } }, orders: { $sum: 1 }, revenueCents: { $sum: { $cond: [paid, cents, 0] } }, earningsCents: { $sum: { $cond: [paid, { $ifNull: ["$platformFeeCents", { $floor: { $multiply: [cents, 0.1] } }] }, 0] } }, estimatedOrders: { $sum: { $cond: [{ $and: [paid, { $eq: [{ $ifNull: ["$platformFeeCents", null] }, null] }] }, 1, 0] } } } },
    { $sort: { _id: 1 } }
  ] });
  return data.map((row) => ({ date: row._id, orders: row.orders, revenue: row.revenueCents / 100, earnings: row.earningsCents / 100, estimatedOrders: row.estimatedOrders }));
}
async function registrations(model, range) {
  const args = { pipeline: [{ $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...model === "users" ? { role: "user" } : {} } }, { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: REPORT_TIMEZONE } }, count: { $sum: 1 } } }] };
  return await prisma_default[model].aggregateRaw(args);
}

// apps/admin-service/src/controllers/governance.controller.ts
var suspendAccount = handle(async (req, res) => {
  const id = objectId(req.params.id);
  const seller = req.params.kind === "sellers";
  if (!["users", "sellers"].includes(req.params.kind) || typeof req.body.suspended !== "boolean")
    throw new ValidationError("Invalid account action");
  const reason = textField(req.body.reason, "reason", 1e3);
  const until = req.body.until ? new Date(req.body.until) : null;
  if (until && (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now()))
    throw new ValidationError("Choose a future expiry");
  await transaction(async (tx) => {
    const current = seller ? await tx.sellers.findUnique({ where: { id } }) : await tx.users.findUnique({ where: { id } });
    if (!current)
      throw new NotFoundError();
    if (id === req.user.id || "role" in current && current.role === "admin")
      throw new ValidationError("Revoke administrator access through team management first");
    const data = { suspendedAt: req.body.suspended ? /* @__PURE__ */ new Date() : null, suspendedUntil: req.body.suspended ? until : null, suspensionReason: req.body.suspended ? reason : null };
    if (seller)
      await tx.sellers.update({ where: { id }, data });
    else
      await tx.users.update({ where: { id }, data });
    await audit(tx, req.user.id, `${req.params.kind}.${req.body.suspended ? "suspend" : "restore"}`, id, reason, { suspendedAt: current.suspendedAt, suspendedUntil: current.suspendedUntil }, data);
    await tx.notifications.create({ data: { ...seller ? { sellerId: id } : { userId: id }, type: "System", title: req.body.suspended ? "Account suspended" : "Account restored", message: reason } });
  });
  res.json({ success: true });
});
var moderateProduct = handle(async (req, res) => {
  const id = objectId(req.params.id);
  const reason = textField(req.body.reason, "reason", 1e3);
  if (typeof req.body.hidden !== "boolean")
    throw new ValidationError("Choose hide or restore");
  const product = await transaction(async (tx) => {
    const current = await tx.products.findUnique({ where: { id }, include: { shop: { select: { sellerId: true } } } });
    if (!current)
      throw new NotFoundError();
    if (!req.body.hidden && current.status !== "Suspended")
      throw new ValidationError("Product is not suspended");
    const status = req.body.hidden ? "Suspended" : "Inactive";
    const updated = await tx.products.update({ where: { id, status: current.status }, data: { status, moderationReason: reason } });
    await audit(tx, req.user.id, "product.moderation", id, reason, { status: current.status }, { status });
    await tx.notifications.create({ data: { sellerId: current.shop.sellerId, type: "System", title: req.body.hidden ? "Product hidden by administrator" : "Product restored for editing", message: `${current.title}: ${reason}`, redirectUrl: "/dashboard/all-products" } });
    return updated;
  });
  res.json({ product });
});
var auditLog = handle(async (req, res) => {
  const where = { createdAt: adminDateRange(req.query, 90), ...req.query.targetId ? { targetId: String(req.query.targetId) } : {}, ...req.query.action ? { action: String(req.query.action) } : {} };
  const [rows, total] = await Promise.all([prisma_default.adminAudit.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "desc" }, { id: "desc" }] }), prisma_default.adminAudit.count({ where })]);
  const actors = await prisma_default.users.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: { id: true, name: true, email: true } });
  res.json({ rows: rows.map((row) => ({ ...row, actor: actors.find((a) => a.id === row.actorId) })), total });
});
var returns = handle(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : void 0;
  if (status && !["Requested", "Approved", "Rejected", "Received", "Escalated"].includes(status))
    throw new ValidationError("Invalid return status");
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([prisma_default.returnRequest.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "asc" }, { id: "asc" }] }), prisma_default.returnRequest.count({ where })]);
  const orders = await prisma_default.orders.findMany({ where: { id: { in: rows.map((r) => r.orderId) } }, include: { user: { select: { name: true, email: true } }, shop: { select: { name: true } }, items: true } });
  res.json({ rows: rows.map((r) => ({ ...r, order: orders.find((o) => o.id === r.orderId) })), total });
});
var reviewReturn = handle(async (req, res) => {
  const orderId = objectId(req.params.orderId);
  const status = req.body.status;
  const reason = textField(req.body.reason, "reason", 2e3);
  if (!["Approved", "Rejected", "Received"].includes(status))
    throw new ValidationError("Invalid return decision");
  const request = await transaction(async (tx) => {
    const current = await tx.returnRequest.findUnique({ where: { orderId } });
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (!current || !order)
      throw new NotFoundError();
    const allowed = { Escalated: ["Approved", "Rejected"], Requested: ["Approved", "Rejected"], Rejected: ["Approved"], Approved: ["Received"] };
    if (!allowed[current.status]?.includes(status) || order.status !== "Delivered" || order.paymentStatus !== "Paid")
      throw new ValidationError("This return can no longer receive that decision");
    await tx.orders.update({ where: { id: orderId, status: "Delivered" }, data: { ...status === "Received" ? { status: "Returned" } : {}, updatedAt: /* @__PURE__ */ new Date() } });
    const updated = await tx.returnRequest.update({ where: { id: current.id, status: current.status }, data: { status, sellerNote: `Admin: ${reason}` } });
    await tx.orderEvent.create({ data: { orderId, actorId: req.user.id, from: `Return:${current.status}`, to: `Return:${status}`, reason } });
    await audit(tx, req.user.id, "return.review", orderId, reason, { status: current.status }, { status });
    const shop = await tx.shops.findUniqueOrThrow({ where: { id: order.shopId } });
    await tx.notifications.createMany({ data: [{ userId: order.userId, orderId, type: "System", title: `Return ${status}`, message: reason, redirectUrl: `/order/${orderId}` }, { sellerId: shop.sellerId, orderId, type: "System", title: `Administrator reviewed return: ${status}`, message: reason, redirectUrl: `/dashboard/orders/${orderId}` }] });
    return updated;
  });
  res.json({ request });
});
var workQueue = handle(async (req, res) => {
  const [overdue, refunds2, returnCount] = await Promise.all([
    canAdmin(req.user, "orders") ? prisma_default.orders.count({ where: { status: { in: ["Pending", "Confirmed", "Processing"] }, createdAt: { lt: new Date(Date.now() - 48 * 36e5) } } }) : 0,
    canAdmin(req.user, "payments") ? prisma_default.orders.count({ where: { status: { in: ["Cancelled", "Returned"] }, paymentStatus: "Paid" } }) : 0,
    canAdmin(req.user, "returns") ? prisma_default.returnRequest.count({ where: { status: { in: ["Requested", "Approved", "Escalated"] } } }) : 0
  ]);
  res.json({ overdue, refunds: refunds2, returns: returnCount });
});
var lookup = handle(async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.slice(0, 100).trim() : "";
  const contains = { contains: search, mode: "insensitive" };
  const kind = String(req.query.kind);
  if (kind === "shops") {
    if (!["orders", "payments", "catalog"].some((p) => canAdmin(req.user, p)))
      throw new ForbiddenError();
    res.json({ rows: await prisma_default.shops.findMany({ where: { name: contains }, take: 20, select: { id: true, name: true } }) });
  } else {
    if (!canAdmin(req.user, "notifications"))
      throw new ForbiddenError();
    const where = { OR: [{ name: contains }, { email: contains }] };
    const rows = kind === "sellers" ? await prisma_default.sellers.findMany({ where, take: 20, select: { id: true, name: true, email: true } }) : await prisma_default.users.findMany({ where: { ...where, role: "user" }, take: 20, select: { id: true, name: true, email: true } });
    res.json({ rows });
  }
});
var uploadImage = handle(async (req, res) => {
  const file = req.body.file;
  if (typeof file !== "string" || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(file))
    throw new ValidationError("Choose a PNG, JPG or WebP image");
  const bytes = Buffer.from(file.slice(file.indexOf(",") + 1), "base64");
  if (bytes.length > 5 * 1024 * 1024 || bytes.length < 12)
    throw new ValidationError("Image must be at most 5 MB");
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!png && !jpg && !webp)
    throw new ValidationError("Invalid image contents");
  const result = await imageKit.upload({ file, fileName: `site-${Date.now()}.${png ? "png" : jpg ? "jpg" : "webp"}`, folder: "/site" });
  res.json({ url: result.url });
});

// packages/utils/order-lifecycle.ts
var import_client3 = require("@prisma/client");

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
  if (!Object.values(import_client3.orderStatus).includes(status))
    throw new ValidationError("Invalid order status");
  return transaction(async (tx) => {
    const order = await tx.orders.findFirst({ where: { ...scope, id }, include: { items: true } });
    if (!order)
      throw new NotFoundError();
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

// packages/utils/order-refund.ts
function validateOrderRefund(order, refund2, expectedId = order.stripeRefundId || null) {
  const paymentId = typeof refund2.payment_intent === "string" ? refund2.payment_intent : refund2.payment_intent?.id;
  if (paymentId !== order.stripePaymentId || refund2.metadata?.orderId !== order.id || refund2.amount !== usdCents(order.totalAmount) || refund2.currency !== (order.currency || STORE_CURRENCY) || expectedId && expectedId !== refund2.id) {
    throw new ValidationError("Refund does not match this order. Review its payment, amount and currency.");
  }
}
var failedOrderRefund = (refund2) => refund2.status === "failed" || refund2.status === "canceled";
async function orderRefundRelation(order, refund2, retrieve) {
  validateOrderRefund(order, refund2, null);
  if (order.stripeRefundId === refund2.id)
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
  if (await descendsFrom(refund2, order.stripeRefundId || null))
    return order.stripeRefundId ? "replacement" : "current";
  const head = await retrieve(order.stripeRefundId);
  validateOrderRefund(order, head);
  if (await descendsFrom(head, refund2.id))
    return "stale";
  throw new ValidationError("Refund does not match the current order refund.");
}

// apps/admin-service/src/controllers/operations.controller.ts
var getOrders = handle(async (req, res) => {
  const where = req.query.overdue === "true" ? { status: { in: ["Pending", "Confirmed", "Processing"] }, createdAt: { lt: new Date(Date.now() - 48 * 36e5) } } : { createdAt: adminDateRange(req.query, 90) };
  if (req.query.search) {
    const search = String(req.query.search).trim().slice(0, 200);
    where.OR = [{ orderNumber: { contains: search, mode: "insensitive" } }, { stripePaymentId: { contains: search } }, { user: { email: { contains: search, mode: "insensitive" } } }];
  }
  if (req.query.status) {
    if (!["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Refunded"].includes(String(req.query.status)))
      throw new ValidationError("Invalid status");
    where.status = req.query.status;
  }
  if (req.query.shopId)
    where.shopId = objectId(req.query.shopId);
  const [orders, total] = await Promise.all([prisma_default.orders.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { id: true, name: true, email: true } } } }), prisma_default.orders.count({ where })]);
  res.json({ orders, total });
});
var orderDetail = handle(async (req, res) => {
  const order = await prisma_default.orders.findUnique({ where: { id: objectId(req.params.orderId) }, include: { items: true, shop: { select: { id: true, name: true } }, user: { select: { name: true, email: true } } } });
  if (!order)
    throw new NotFoundError();
  const [events, request] = await Promise.all([prisma_default.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } }), prisma_default.returnRequest.findUnique({ where: { orderId: order.id } })]);
  res.json({ order: { ...order, events, request } });
});
var updateStatus = handle(async (req, res) => {
  textField(req.body.reason, "reason", 1e3);
  if (req.body.status === "Returned")
    throw new ValidationError("Review and receive the return through Returns first");
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, {}, req.user.id, req.body, true);
  res.json({ order });
});
var dashboard = handle(async (req, res) => {
  const createdAt = adminDateRange(req.query);
  const [totals, users, sellers, totalUsers, totalSellers, totalProducts, top] = await Promise.all([
    orderTotals(createdAt),
    registrations("users", createdAt),
    registrations("sellers", createdAt),
    prisma_default.users.count({ where: { role: "user" } }),
    prisma_default.sellers.count(),
    prisma_default.products.count({ where: { isDeleted: false } }),
    prisma_default.orderItems.groupBy({ by: ["productId"], where: { order: { createdAt, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] } } }, _sum: { quantity: true, totalPrice: true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 })
  ]);
  const timeline = {};
  for (let day = /* @__PURE__ */ new Date(reportDay(createdAt.gte) + "T00:00:00+07:00"); reportDay(day) <= reportDay(createdAt.lte); day.setUTCDate(day.getUTCDate() + 1)) {
    const date = reportDay(day);
    timeline[date] = { date, revenue: 0, earnings: 0, users: 0, sellers: 0, orders: 0 };
  }
  totals.forEach((row) => {
    timeline[row.date] = { ...timeline[row.date], ...row };
  });
  users.forEach((row) => {
    if (timeline[row._id])
      timeline[row._id].users = row.count;
  });
  sellers.forEach((row) => {
    if (timeline[row._id])
      timeline[row._id].sellers = row.count;
  });
  const products = await prisma_default.products.findMany({ where: { id: { in: top.map((p) => p.productId) } }, select: { id: true, title: true } });
  res.json({ stats: { totalUsers, totalSellers, totalProducts, totalOrders: totals.reduce((n, r) => n + r.orders, 0), revenue: totals.reduce((n, r) => n + Math.round(r.revenue * 100), 0) / 100, earnings: totals.reduce((n, r) => n + Math.round(r.earnings * 100), 0) / 100, estimatedOrders: totals.reduce((n, r) => n + r.estimatedOrders, 0) }, timeline: Object.values(timeline), topProducts: top.map((p) => ({ ...p._sum, id: p.productId, title: products.find((product) => product.id === p.productId)?.title ?? "Deleted product" })) });
});
var notifications = handle(async (req, res) => {
  const where = { OR: [{ userId: req.user.id }, { AND: [{ OR: [{ userId: null }, { userId: { isSet: false } }] }, { OR: [{ sellerId: null }, { sellerId: { isSet: false } }] }] }] };
  const [notifications2, total] = await Promise.all([prisma_default.notifications.findMany({ where, ...pageArgs(req.query), orderBy: { createdAt: "desc" } }), prisma_default.notifications.count({ where })]);
  res.json({ notifications: notifications2, total });
});
var payments = handle(async (req, res) => {
  const createdAt = adminDateRange(req.query, 30);
  const shopId = req.query.shopId ? objectId(req.query.shopId) : void 0;
  const refundWhere = { paymentStatus: "Paid", status: { in: ["Cancelled", "Returned"] }, ...shopId ? { shopId } : {} };
  const stripe3 = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 1e4, maxNetworkRetries: 1 });
  let stripeUnavailable = false;
  const [result, orders, total, shops, timeline] = await Promise.all([
    stripe3.paymentIntents.list({ limit: 50, created: { gte: Math.floor(createdAt.gte.getTime() / 1e3), lte: Math.floor(createdAt.lte.getTime() / 1e3) }, ...req.query.after ? { starting_after: String(req.query.after) } : {} }).catch(() => {
      stripeUnavailable = true;
      return { data: [], has_more: false };
    }),
    prisma_default.orders.findMany({ where: refundWhere, ...pageArgs(req.query), include: { shop: { select: { name: true } }, user: { select: { name: true, email: true } }, items: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma_default.orders.count({ where: refundWhere }),
    prisma_default.orders.groupBy({ by: ["shopId"], where: { createdAt, ...shopId ? { shopId } : {}, paymentStatus: "Paid", status: { notIn: ["Cancelled", "Returned", "Refunded"] } }, _sum: { totalAmount: true }, _count: { _all: true }, orderBy: { _sum: { totalAmount: "desc" } }, take: 20 }),
    orderTotals(createdAt, shopId)
  ]);
  const names = await prisma_default.shops.findMany({ where: { id: { in: shops.map((s) => s.shopId) } }, select: { id: true, name: true } });
  res.json({ stripeUnavailable, payments: result.data.map((p) => ({ id: p.id, amount: p.amount / 100, currency: p.currency, status: p.status, created: p.created })), hasMore: result.has_more, nextCursor: result.data.at(-1)?.id, orders, total, byShop: shops.map((s) => ({ name: names.find((n) => n.id === s.shopId)?.name ?? s.shopId, revenue: s._sum.totalAmount ?? 0, orders: s._count._all })), timeline });
});
var refund = handle(async (req, res) => {
  const orderId = objectId(req.body.orderId);
  const reason = textField(req.body.reason, "refund reason", 1e3);
  const order = await prisma_default.orders.findUnique({ where: { id: orderId } });
  if (!order || order.stripePaymentId !== req.params.paymentId)
    throw new NotFoundError("Payment/order not found");
  if (order.paymentStatus === "Refunded") {
    res.json({ success: true, refundId: order.stripeRefundId });
    return;
  }
  if (order.paymentStatus !== "Paid" || !["Cancelled", "Returned"].includes(order.status))
    throw new ValidationError("Cancel or return the paid order before refunding");
  const stripe3 = new Stripe(process.env.STRIPE_SECRET_KEY);
  const intent = await stripe3.paymentIntents.retrieve(order.stripePaymentId);
  const attempts = /* @__PURE__ */ new Map();
  if (order.stripeRefundId) {
    const saved2 = await stripe3.refunds.retrieve(order.stripeRefundId);
    validateOrderRefund(order, saved2);
    attempts.set(saved2.id, saved2);
  }
  for await (const candidate of stripe3.refunds.list({ payment_intent: order.stripePaymentId, limit: 100 })) {
    if (candidate.metadata?.orderId !== order.id)
      continue;
    validateOrderRefund(order, candidate, null);
    attempts.set(candidate.id, candidate);
  }
  const parents = new Set([...attempts.values()].map((attempt) => attempt.metadata?.previousRefundId).filter(Boolean));
  const latest = [...attempts.values()].filter((attempt) => !parents.has(attempt.id));
  if (latest.length > 1)
    throw new ValidationError("Multiple refund attempts require review.");
  const retrieve = async (id) => attempts.get(id) || stripe3.refunds.retrieve(id);
  const existing = latest[0];
  if (existing)
    await orderRefundRelation(order, existing, retrieve);
  const retry = existing && failedOrderRefund(existing);
  const result = existing && !retry ? existing : await stripe3.refunds.create({ payment_intent: order.stripePaymentId, amount: Math.round(order.totalAmount * 100), ...intent.transfer_data?.destination ? { reverse_transfer: true, refund_application_fee: true } : {}, metadata: { orderId, ...retry ? { previousRefundId: existing.id } : {} } }, { idempotencyKey: retry ? `order-refund-${order.id}-retry-${existing.id}` : `order-refund-${order.id}` });
  validateOrderRefund(order, result, null);
  const saved = await transaction(async (tx) => {
    const current = await tx.orders.findUnique({ where: { id: orderId } });
    if (!current)
      throw new NotFoundError("Payment/order not found");
    if (current.paymentStatus === "Refunded")
      return current;
    const relation = await orderRefundRelation(current, result, retrieve);
    if (relation === "stale" || current.stripeRefundId === result.id && (current.refundState === result.status || ["failed", "canceled"].includes(current.refundState || "") && result.status !== "succeeded"))
      return current;
    const updated = await tx.orders.updateMany({ where: { id: orderId, paymentStatus: "Paid" }, data: { stripeRefundId: result.id, refundState: result.status, ...result.status === "succeeded" ? { paymentStatus: "Refunded", status: "Refunded" } : {} } });
    if (updated.count)
      await audit(tx, req.user.id, "payment.refund", orderId, reason, { paymentStatus: order.paymentStatus }, { refundId: result.id, status: result.status, amount: order.totalAmount });
    if (updated.count && result.status === "succeeded")
      await tx.notifications.create({ data: { userId: order.userId, orderId, type: "OrderRefunded", title: "Order refunded", message: `${order.orderNumber} has been refunded.`, redirectUrl: `/order/${orderId}` } });
    return { ...current, stripeRefundId: result.id, refundState: result.status };
  });
  if (failedOrderRefund({ status: saved.refundState }))
    throw new ValidationError("Stripe refund failed. You can retry this refund.");
  res.json({ success: true, refundId: saved.stripeRefundId, status: saved.refundState });
});
var logs = handle(async (req, res) => {
  const range = adminDateRange(req.query);
  const where = { createdAt: range };
  if (req.query.action)
    where.action = String(req.query.action);
  if (req.query.userId)
    where.userId = String(req.query.userId);
  const exporting = req.query.format === "csv" || req.query.format === "json";
  if (exporting) {
    const format = req.query.format;
    res.attachment(`logs.${format}`);
    res.type(format === "csv" ? "text/csv" : "application/json");
    res.setHeader("X-Export-Truncated", "false");
    let cursor;
    let first = true;
    if (format === "json")
      res.write("[");
    do {
      const batch = await prisma_default.behaviorLog.findMany({ where, take: 1e3, orderBy: { id: "asc" }, ...cursor ? { cursor: { id: cursor }, skip: 1 } : {} });
      if (!batch.length || res.destroyed)
        break;
      let output;
      if (format === "json")
        output = `${first ? "" : ","}${batch.map((log) => JSON.stringify(log)).join(",")}`;
      else {
        const encoded = csv(batch.map((log) => ({ ...log, metadata: JSON.stringify(log.metadata), createdAt: log.createdAt.toISOString() })));
        output = first ? encoded : encoded.slice(encoded.indexOf("\n") + 1);
        output += "\n";
      }
      if (!res.write(output))
        await new Promise((resolve) => {
          const done = () => {
            res.off("drain", done);
            res.off("close", done);
            resolve();
          };
          res.once("drain", done);
          res.once("close", done);
        });
      first = false;
      cursor = batch.length === 1e3 ? batch[batch.length - 1].id : void 0;
    } while (cursor && !res.destroyed);
    if (!res.destroyed)
      res.end(format === "json" ? "]" : "");
    return;
  }
  const [logs2, total, events] = await Promise.all([
    prisma_default.behaviorLog.findMany({ where, ...pageArgs(req.query), orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    prisma_default.behaviorLog.count({ where }),
    prisma_default.behaviorLog.aggregateRaw({ pipeline: [
      { $match: { createdAt: { $gte: { $date: range.gte.toISOString() }, $lte: { $date: range.lte.toISOString() } }, ...req.query.action ? { action: String(req.query.action) } : {}, ...req.query.userId ? { userId: String(req.query.userId) } : {} } },
      { $group: { _id: { $dateToString: { date: "$createdAt", format: "%Y-%m-%d", timezone: REPORT_TIMEZONE } }, views: { $sum: { $cond: [{ $in: ["$action", ["productView", "product_view"]] }, 1, 0] } }, cartAdds: { $sum: { $cond: [{ $in: ["$action", ["addToCart", "add_to_cart"]] }, 1, 0] } }, purchases: { $sum: { $cond: [{ $in: ["$action", ["paymentSuccess", "purchase"]] }, 1, 0] } } } },
      { $sort: { _id: 1 } }
    ] })
  ]);
  res.json({ logs: logs2, total, timeline: events.map((row) => ({ date: row._id, views: row.views, cartAdds: row.cartAdds, purchases: row.purchases })), chartTruncated: false });
});

// apps/admin-service/src/routes/admin.route.ts
var router3 = import_express3.default.Router();
router3.get("/orders", isAuthenticated_default, isAdmin, adminPermission("orders"), getOrders);
router3.get("/orders/:orderId", isAuthenticated_default, isAdmin, adminPermission("orders"), orderDetail);
router3.patch("/update-order-status/:orderId", isAuthenticated_default, isAdmin, adminPermission("fulfillment"), updateStatus);
router3.get("/dashboard-stats", isAuthenticated_default, isAdmin, adminPermission("overview"), dashboard);
router3.get("/notifications", isAuthenticated_default, isAdmin, adminPermission("notifications"), notifications);
router3.post("/send-notification", isAuthenticated_default, isAdmin, adminPermission("notifications"), queueNotification);
router3.get("/payments", isAuthenticated_default, isAdmin, adminPermission("payments"), payments);
router3.post("/refund/:paymentId", isAuthenticated_default, isAdmin, adminPermission("payments"), refund);
router3.get("/logs", isAuthenticated_default, isAdmin, adminPermission("logs"), logs);
router3.get("/get-all-products", isAuthenticated_default, isAdmin, adminPermission("catalog"), getAllProducts2);
router3.get("/get-all-events", isAuthenticated_default, isAdmin, adminPermission("catalog"), getAllEvents2);
router3.get("/get-all-admins", isAuthenticated_default, isAdmin, adminPermission("team"), getAllAdmin);
router3.post("/add-admin", isAuthenticated_default, isAdmin, adminPermission("team"), addAdmin);
router3.get("/get-site-config", isAuthenticated_default, isAdmin, adminPermission("settings"), getSiteConfig);
router3.patch("/update-site-config", isAuthenticated_default, isAdmin, adminPermission("settings"), updateSiteConfig);
router3.get("/log-config", isAuthenticated_default, isAdmin, adminPermission("settings"), getLogConfig);
router3.patch("/update-log-config", isAuthenticated_default, isAdmin, adminPermission("settings"), updateLogConfig);
router3.get("/get-all-users", isAuthenticated_default, isAdmin, adminPermission("accounts"), getAllUsers);
router3.get("/get-all-sellers", isAuthenticated_default, isAdmin, adminPermission("accounts"), getAllSellers);
router3.patch("/accounts/:kind/:id", isAuthenticated_default, isAdmin, adminPermission("accounts"), suspendAccount);
router3.patch("/products/:id/moderation", isAuthenticated_default, isAdmin, adminPermission("catalog"), moderateProduct);
router3.get("/audit", isAuthenticated_default, isAdmin, adminPermission("team"), auditLog);
router3.get("/returns", isAuthenticated_default, isAdmin, adminPermission("returns"), returns);
router3.patch("/returns/:orderId", isAuthenticated_default, isAdmin, adminPermission("returns"), reviewReturn);
router3.get("/work-queue", isAuthenticated_default, isAdmin, workQueue);
router3.get("/lookup", isAuthenticated_default, isAdmin, lookup);
router3.post("/site-image", isAuthenticated_default, isAdmin, adminPermission("settings"), uploadImage);
router3.get("/notification-jobs", isAuthenticated_default, isAdmin, adminPermission("notifications"), notificationJobs);
router3.post("/notification-jobs/:id/retry", isAuthenticated_default, isAdmin, adminPermission("notifications"), retryNotification);
router3.get("/templates", isAuthenticated_default, isAdmin, adminPermission("catalog"), templates);
router3.post("/templates", isAuthenticated_default, isAdmin, adminPermission("catalog"), saveTemplate);
router3.put("/templates/:id", isAuthenticated_default, isAdmin, adminPermission("catalog"), saveTemplate);
var admin_route_default = router3;

// apps/order-service/src/routes/order.route.ts
var import_express4 = __toESM(require("express"));

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

// apps/order-service/src/routes/order.controller.ts
var import_crypto4 = __toESM(require("crypto"));

// apps/order-service/src/routes/payment-webhook.controller.ts
var import_crypto3 = __toESM(require("crypto"));

// apps/order-service/src/utils/send-email/index.ts
var import_nodemailer2 = __toESM(require("nodemailer"));
var import_dotenv2 = __toESM(require("dotenv"));
var import_ejs2 = __toESM(require("ejs"));
var import_path2 = __toESM(require("path"));
import_dotenv2.default.config();
var transporter2 = import_nodemailer2.default.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
var renderEmailTemplate2 = async (templateName, data) => {
  const templatePath = import_path2.default.join(
    process.cwd(),
    "apps",
    "order-service",
    "src",
    "utils",
    "send-email",
    "email-templates",
    `${templateName}.ejs`
  );
  return import_ejs2.default.renderFile(templatePath, data);
};
var sendEmail2 = async (to, subject, templateName, data) => {
  if (/@[^@]+\.invalid$/i.test(to))
    return false;
  try {
    const html = await renderEmailTemplate2(templateName, data);
    await transporter2.sendMail({
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
      const order = await tx.orders.create({ data: { orderNumber: `ORD-${Date.now()}-${import_crypto3.default.randomBytes(4).toString("hex").toUpperCase()}`, userId: session.userId, shopId, subTotal, discount, shippingFee, currency: payload.currency || STORE_CURRENCY, discountCodeId: discount ? coupon.id : null, totalAmount: (usdCents(subTotal) - usdCents(discount) + usdCents(shippingFee)) / 100, paymentStatus: "Paid", paymentMethod: "card", stripePaymentId: payment.id, platformFeeCents: grouped.size === 1 && typeof payment.application_fee_amount === "number" ? payment.application_fee_amount : null, shippingAddress: payload.shippingAddress, items: { create: items.map((item) => ({ productId: item.id, variantId: item.variantId || null, sku: item.sku || null, title: item.title, image: item.image, color: item.selectedOptions?.color || null, size: item.selectedOptions?.size || null, quantity: item.quantity, unitPrice: item.sale_price, totalPrice: Math.round(item.sale_price * 100) * item.quantity / 100 })) } } });
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
      await tx.notifications.createMany({ data: [{ sellerId: shop.sellerId, orderId: order.id, type: "NewOrder", title: "New order", message: `${order.orderNumber} is ready to process.`, redirectUrl: "/dashboard/orders" }, { userId: session.userId, orderId: order.id, type: "NewOrder", title: "Order received", message: `${order.orderNumber} has been paid.`, redirectUrl: `/order/${order.id}` }, { type: "System", title: "New platform order", message: order.orderNumber, orderId: order.id, redirectUrl: "/dashboard/orders" }] });
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
    await sendEmail2(user.email, "Your Eshop order confirmation", "order.confirmation", { name: user.name, cart: payload.cart, totalAmount: payload.totalAmount, trackingUrl: `${process.env.USER_UI_URL || "http://localhost:3000"}/order/${ids[0]}` });
}

// apps/order-service/src/routes/order-management.controller.ts
var cancelOrder = handle(async (req, res) => {
  const order = await transitionOrder(objectId(req.params.orderId), "Cancelled", { userId: req.user.id, status: "Pending" }, req.user.id, req.body);
  res.json({ order });
});
var sellerOrderStatus = handle(async (req, res) => {
  if (!req.seller.shop?.id)
    throw new ForbiddenError();
  const order = await transitionOrder(objectId(req.params.orderId), req.body.status, { shopId: req.seller.shop.id }, req.seller.id, req.body);
  res.json(order);
});

// apps/order-service/src/routes/order.controller.ts
var stripe2 = new Stripe(process.env.STRIPE_SECRET_KEY, {
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
    const paymentIntent = await stripe2.paymentIntents.create(intentData, { idempotencyKey: `checkout-${sessionId}` });
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
    const sessionId = import_crypto4.default.randomUUID();
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

// apps/order-service/src/routes/seller-payments.controller.ts
var import_client4 = require("@prisma/client");
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
    if (!Object.values(import_client4.paymentStatus).includes(req.query.status))
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
  const [payments2, total, groups] = await Promise.all([
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
  const summary = Object.fromEntries(Object.values(import_client4.paymentStatus).map((status) => {
    const group = groups.find((item) => item.paymentStatus === status);
    return [status, { amount: group?._sum.totalAmount ?? 0, count: group?._count._all ?? 0 }];
  }));
  res.json({ payments: payments2, summary, total, page: skip / take + 1, pageSize: take, totalPages: Math.ceil(total / take) });
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
    return request;
  });
  res.json({ request: result });
});

// apps/order-service/src/routes/returns.controller.ts
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
var reviewReturn2 = handle(async (req, res) => {
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
    if (!(request.status === "Requested" && ["Approved", "Rejected"].includes(status)) && !(request.status === "Approved" && status === "Received"))
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
    const payment = await new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 1e4, maxNetworkRetries: 1 }).paymentIntents.retrieve(paymentId);
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
var router4 = import_express4.default.Router();
router4.post("/return-evidence/:orderId", isAuthenticated_default, isUser, uploadEvidence);
router4.post("/escalate-return/:orderId", isAuthenticated_default, isUser, escalateReturn);
router4.post("/inspect-cart", inspectCart);
router4.get("/my-orders", isAuthenticated_default, isUser, customerOrders);
router4.get("/my-order-stats", isAuthenticated_default, isUser, orderStats);
router4.get("/reorder/:orderId", isAuthenticated_default, isUser, reorder);
router4.get("/payment-result", isAuthenticated_default, isUser, paymentResult);
router4.get("/aftercare/:orderId", isAuthenticated_default, isUser, orderAftercare);
router4.get("/seller-aftercare/:orderId", isAuthenticated_default, isSeller, orderAftercare);
router4.post("/returns/:orderId", isAuthenticated_default, isUser, requestReturn);
router4.patch("/returns/:orderId", isAuthenticated_default, isSeller, reviewReturn2);
router4.post("/cancel-order/:orderId", isAuthenticated_default, isUser, cancelOrder);
router4.post("/create-payment-intent", isAuthenticated_default, isUser, createPaymentIntent);
router4.post("/create-payment-session", isAuthenticated_default, isUser, createPaymentSession);
router4.get("/verify-payment-session", isAuthenticated_default, isUser, verifyPaymentSession);
router4.get("/get-user-orders", isAuthenticated_default, isUser, getUserOrders);
router4.get("/get-order/:orderId", isAuthenticated_default, isUser, getOrderById);
router4.get("/get-seller-orders", isAuthenticated_default, isSeller, getSellerOrders);
router4.get("/seller-payments", isAuthenticated_default, isSeller, getSellerPayments);
router4.get("/get-admin-orders", isAuthenticated_default, isAdmin, adminPermission("orders"), getAdminOrders);
router4.patch(
  "/update-order-status/:orderId",
  isAuthenticated_default,
  isSeller,
  sellerOrderStatus
);
router4.post("/verify-coupon", isAuthenticated_default, isUser, verifyConponCode);
var order_route_default = router4;

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

// tests/acceptance/server.ts
async function start() {
  const password = await import_bcryptjs2.default.hash("Acceptance123!", 4);
  const buyer = await prisma_default.users.create({ data: { name: "Acceptance Buyer", email: "buyer@example.test", password, following: [] } });
  const administrator = await prisma_default.users.create({ data: { name: "Acceptance Admin", email: "admin@example.test", password, role: "admin", following: [] } });
  const seller = await prisma_default.sellers.create({ data: { name: "Acceptance Seller", email: "seller@example.test", password, phone_number: "0123456789", country: "Vietnam" } });
  const shop = await prisma_default.shops.create({ data: { name: "Saigon PC Store", sellerId: seller.id, category: "PC Components", bio: "Components for your next PC build.", opening_hours: "09:00\u201318:00", address: "Ho Chi Minh City" } });
  const image = "https://hunggiaco.com/wp-content/uploads/2026/03/avatar-mac-dinh-facebook-1-1.jpg";
  const cpu = await prisma_default.products.create({ data: { title: "Ryzen Gaming CPU", slug: "acceptance-cpu", category: "PC Components", subCategory: "CPU", short_description: "A fast processor for daily work and gaming.", detailed_description: "Six cores for your next desktop build.", tags: ["gaming"], colors: ["Black"], sizes: [], stock: 3, sale_price: 80, regular_price: 100, warranty: "24 months", shopId: shop.id, discount_codes: [], images: { create: { url: image, file_id: "acceptance-image" } } } });
  await prisma_default.site_config.create({ data: { categories: ["PC Components"], subCategories: { "PC Components": ["CPU", "GPU", "Memory"] } } });
  await prisma_default.products.update({ where: { id: cpu.id }, data: { custom_specification: { socket: "AM5" } } });
  for (const [subCategory, title, price, specs] of [
    ["Motherboard", "AM5 DDR5 Motherboard", 120, { socket: "AM5", memoryType: "DDR5" }],
    ["RAM", "DDR5 Memory Kit", 60, { memoryType: "DDR5" }],
    ["Motherboard", "Incompatible Intel Motherboard", 100, { socket: "LGA1700", memoryType: "DDR4" }]
  ]) {
    await prisma_default.products.create({ data: { title, slug: title.toLowerCase().replaceAll(" ", "-"), category: "PC Components", subCategory, detailed_description: title, tags: [], colors: [], sizes: [], stock: 10, sale_price: price, regular_price: price, warranty: "24 months", shopId: shop.id, discount_codes: [], custom_specification: specs } });
  }
  const address = await prisma_default.address.create({ data: { userId: buyer.id, name: buyer.name, label: "Home", street: "12 Nguyen Hue", city: "Ho Chi Minh City", zip: "70000", country: "Vietnam", isDefault: true } });
  const orders = [];
  for (const [i, status] of ["Pending", "Delivered", "Shipped", "Cancelled"].entries()) {
    orders.push(await prisma_default.orders.create({ data: { orderNumber: `ACCEPTANCE-${i + 1}`, userId: buyer.id, shopId: shop.id, status, paymentStatus: "Paid", stripePaymentId: "pi_acceptance", subTotal: 80, totalAmount: 80, shippingAddress: { name: buyer.name, street: address.street, city: address.city, country: address.country }, trackingNumber: status === "Shipped" ? "TRACK12345" : null, estimatedDelivery: status === "Shipped" ? new Date(Date.now() + 2 * 864e5) : null, createdAt: new Date(Date.now() - i * 864e5), items: { create: { productId: cpu.id, title: cpu.title, quantity: 1, unitPrice: 80, totalPrice: 80 } } } }));
  }
  await prisma_default.returnRequest.create({ data: { orderId: orders[1].id, userId: buyer.id, shopId: shop.id, reason: "Damaged packaging; please inspect", evidence: [] } });
  startNotificationWorker();
  await prisma_default.notifications.createMany({ data: [{ userId: buyer.id, type: "OrderShipped", title: "Your order is on the way", message: "Track your package for the latest updates.", redirectUrl: `/order/${orders[2].id}` }, { sellerId: seller.id, type: "LowStock", title: "Low stock", message: "Ryzen Gaming CPU has 3 units remaining.", redirectUrl: "/dashboard/inventory" }, { type: "System", title: "Platform order alert", message: "New order from Saigon PC Store." }] });
  await prisma_default.behaviorLog.createMany({ data: ["productView", "addToCart", "paymentSuccess"].map((action, i) => ({ eventId: `acceptance-${i}`, action, userId: buyer.id, source: "acceptance", type: "info", message: `Example ${action}`, metadata: { productId: cpu.id } })) });
  await prisma_default.productAnalytics.create({ data: { productId: cpu.id, shopId: shop.id, views: 20, cartAdds: 4, purchases: 3, lastViewedAt: /* @__PURE__ */ new Date() } });
  const app = (0, import_express5.default)();
  app.use(import_express5.default.json({ limit: "8mb" }));
  app.use((0, import_cookie_parser.default)());
  app.get("/api/acceptance/session/:role", (req, res) => {
    const role = req.params.role;
    const actor = role === "seller" ? seller : role === "admin" ? administrator : buyer;
    res.clearCookie("access_token");
    res.clearCookie("seller_access_token");
    res.cookie(role === "seller" ? "seller_access_token" : "access_token", import_jsonwebtoken4.default.sign({ id: actor.id, role }, process.env.ACCESS_TOKEN_JWT_SECRET, { expiresIn: "2h" }), { httpOnly: true, sameSite: "lax" });
    res.redirect(role === "user" ? "/profile" : "/dashboard");
  });
  app.get("/api/acceptance/fixture", (_req, res) => {
    res.json({ productId: cpu.id, shopId: shop.id, orders: orders.map((o) => ({ id: o.id, status: o.status })), buyerId: buyer.id });
  });
  app.get("/chatting/api/unread-count", isAuthenticated_default, (_req, res) => {
    res.json({ unreadCount: 0 });
  });
  app.use("/api", auth_router_default);
  app.use("/product/api", product_router_default);
  app.use("/admin", admin_route_default);
  app.use("/order/api", order_route_default);
  app.use("/order", order_route_default);
  app.get("/recommendation/api/trending-products", trending);
  app.get("/recommendation/api/similar-products/:productId", similar);
  app.get("/recommendation/api/recommendations/:userId", isAuthenticated_default, isUser, personalized);
  app.get("/gateway-health", handle(async (_req, res) => {
    res.json({ fixture: true });
  }));
  app.use(errorMiddleware);
  const port = Number(process.env.ACCEPTANCE_PORT || 8080);
  const server = app.listen(port, "127.0.0.1", () => console.log(`ACCEPTANCE_READY http://localhost:${port} (isolated MongoDB; Stripe/Redis/logging doubles)`));
  return { server, prisma: prisma_default };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  start
});
