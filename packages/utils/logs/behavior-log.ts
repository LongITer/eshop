import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { sendLog, LogEvent } from "./send-logs";

/**
 * All user-behavior action keys.
 * These keys map 1-to-1 with the boolean fields in the `log_config` Prisma model.
 */
export type BehaviorAction =
  // Auth
  | "userLogin"
  | "userRegistration"
  | "userLogout"
  | "passwordChange"
  | "passwordReset"
  // Product
  | "productView"
  | "productSearch"
  | "productFilter"
  | "addToCart"
  | "addToWishlist"
  // Order
  | "orderCreated"
  | "orderCancelled"
  | "paymentAttempt"
  | "paymentSuccess"
  | "paymentFailed"
  | "couponUsed"
  // Seller
  | "sellerLogin"
  | "sellerRegistration"
  | "shopCreated"
  | "productCreated"
  | "productDeleted"
  | "orderStatusChange"
  // System
  | "apiErrors"
  | "rateLimitHit"
  | "webhookEvents";

/** Human-readable labels for each behavior action */
export const BEHAVIOR_LABELS: Record<BehaviorAction, string> = {
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
  webhookEvents: "Webhook Events",
};

/** Groups for UI display */
export const BEHAVIOR_GROUPS: Record<string, BehaviorAction[]> = {
  "Authentication": [
    "userLogin",
    "userRegistration",
    "userLogout",
    "passwordChange",
    "passwordReset",
  ],
  "Products": [
    "productView",
    "productSearch",
    "productFilter",
    "addToCart",
    "addToWishlist",
  ],
  "Orders & Payments": [
    "orderCreated",
    "orderCancelled",
    "paymentAttempt",
    "paymentSuccess",
    "paymentFailed",
    "couponUsed",
  ],
  "Seller Activities": [
    "sellerLogin",
    "sellerRegistration",
    "shopCreated",
    "productCreated",
    "productDeleted",
    "orderStatusChange",
  ],
  "System & Infrastructure": ["apiErrors", "rateLimitHit", "webhookEvents"],
};

// ─── Shared config cache ─────────────────────────────────────────────
type LogConfig = Record<BehaviorAction, boolean>;

const LOG_CONFIG_CACHE_KEY = "logging:behavior-config";
const CACHE_TTL_SECONDS = 60;

/**
 * Load the log_config from DB (or use cache if fresh).
 * If no config row exists, creates one with defaults.
 */
export async function getLogConfig(): Promise<LogConfig> {
  try {
    const cachedConfig = await redis.get(LOG_CONFIG_CACHE_KEY);
    if (cachedConfig) {
      return JSON.parse(cachedConfig) as LogConfig;
    }
  } catch (error) {
    console.error("[behavior-log] Failed to read shared config cache:", error);
  }

  try {
    let config = await prisma.log_config.findFirst();

    if (!config) {
      // Create default config row
      config = await prisma.log_config.create({ data: {} });
    }

    // Map the Prisma record to a typed config object
    const mapped: LogConfig = {
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
      webhookEvents: config.webhookEvents,
    };

    try {
      await redis.set(
        LOG_CONFIG_CACHE_KEY,
        JSON.stringify(mapped),
        "EX",
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      console.error("[behavior-log] Failed to update shared config cache:", error);
    }

    return mapped;
  } catch (error) {
    console.error("[behavior-log] Failed to load log config:", error);
    // If DB is unreachable, default to logging everything
    return Object.fromEntries(
      Object.keys(BEHAVIOR_LABELS).map((k) => [k, true]),
    ) as LogConfig;
  }
}

/** Invalidate the shared cache after an admin config update. */
export async function invalidateLogConfigCache(): Promise<void> {
  try {
    await redis.del(LOG_CONFIG_CACHE_KEY);
  } catch (error) {
    console.error("[behavior-log] Failed to invalidate shared config cache:", error);
  }
}

/**
 * Send a behavior log to Kafka — but only if the corresponding action
 * is enabled in the log_config.
 *
 * @param action  - The behavior key (e.g. "userLogin", "orderCreated")
 * @param event   - The log event payload (type, message, source, metadata)
 *
 * @example
 *   await sendBehaviorLog("userLogin", {
 *     type: "success",
 *     source: "auth-service",
 *     message: `User ${email} logged in`,
 *     metadata: { userId, ip },
 *   });
 */
export async function sendBehaviorLog(
  action: BehaviorAction,
  event: LogEvent,
): Promise<void> {
  try {
    const config = await getLogConfig();
    if (!config[action]) {
      // Action is disabled — silently skip
      return;
    }

    // Enrich metadata with the behavior action for filtering in the UI
    const enrichedEvent: LogEvent = {
      ...event,
      metadata: {
        ...event.metadata,
        behaviorAction: action,
        behaviorLabel: BEHAVIOR_LABELS[action],
      },
    };

    await sendLog(enrichedEvent);
  } catch (error) {
    // Never let logging break the main flow
    console.error(`[behavior-log] Failed to send ${action} log:`, error);
  }
}
