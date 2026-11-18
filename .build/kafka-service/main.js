"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/kafka-service/src/main.ts
var main_exports = {};
__export(main_exports, {
  consumeKafkaMessages: () => consumeKafkaMessages
});
module.exports = __toCommonJS(main_exports);

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

// packages/libs/prisma/index.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
if (process.env.NODE_ENV === "production")
  global.prismadb = prisma;
var prisma_default = prisma;

// apps/kafka-service/src/services/analytics.service.ts
var updateUserAnalytics = async (event) => {
  try {
    const existingData = await prisma_default.userAnalytics.findUnique({
      where: {
        userId: event.userId
      },
      select: { actions: true }
    });
    let updatedOptions = existingData?.actions || [];
    const actionExists = updatedOptions.some(
      (entry) => entry.productId === event.productId && entry.action === event.action
    );
    if (event.action === "product_view") {
      updatedOptions.push({
        productId: event?.productId,
        shopId: event.shopId,
        action: event.action,
        timestamp: /* @__PURE__ */ new Date()
      });
    } else if (["add_to_cart", "add_to_wishlist"].includes(event.action) && !actionExists) {
      updatedOptions.push({
        productId: event?.productId,
        shopId: event.shopId,
        action: event?.action,
        timestamp: /* @__PURE__ */ new Date()
      });
    } else if (event.action === "remove_from_cart") {
      updatedOptions = updatedOptions.filter(
        (entry) => !(entry.productId === event.productId && entry.action === "add_to_cart")
      );
    } else if (event.action === "remove_from_wishlist") {
      updatedOptions = updatedOptions.filter(
        (entry) => !(entry.productId === event.productId && entry.action === "add_to_wishlist")
      );
    }
    if (updatedOptions.length > 100) {
      updatedOptions.shift();
    }
    const extraFields = {};
    if (event.country) {
      extraFields.country = event.country;
    }
    if (event.city) {
      extraFields.city = event.city;
    }
    await prisma_default.userAnalytics.upsert({
      where: { userId: event.userId },
      create: {
        userId: event.userId,
        lastVisited: /* @__PURE__ */ new Date(),
        actions: updatedOptions,
        ...extraFields
      },
      update: {
        userId: event?.userId,
        lastVisited: /* @__PURE__ */ new Date(),
        actions: updatedOptions,
        ...extraFields
      }
    });
  } catch (error) {
    console.error("Error updating user analytics:", error);
  }
};
var updateProductAnalytics = async (event) => {
  try {
    if (!event.productId)
      return;
    const updateFields = {};
    if (event.action === "product_view")
      updateFields.views = { increment: 1 };
    if (event.action === "add_to_cart")
      updateFields.cartAdds = { increment: 1 };
    if (event.action === "remove_from_cart")
      updateFields.cartAdds = { decrement: 1 };
    if (event.action === "add_to_wishlist")
      updateFields.wishListAdds = { increment: 1 };
    if (event.action === "remove_from_wishlist")
      updateFields.wishListAdds = { decrement: 1 };
    if (event.action === "purchase")
      updateFields.purchases = { increment: 1 };
    await prisma_default.productAnalytics.upsert({
      where: { productId: event.productId },
      update: {
        lastViewedAt: /* @__PURE__ */ new Date(),
        ...updateFields
        // Apply the correct increment field
      },
      create: {
        productId: event.productId,
        shopId: event.shopId || null,
        views: event.action === "product_view" ? 1 : 0,
        cartAdds: event.action === "add_to_cart" ? 1 : 0,
        wishListAdds: event.action === "add_to_wishlist" ? 1 : 0,
        purchases: event.action === "purchase" ? 1 : 0,
        lastViewedAt: /* @__PURE__ */ new Date()
      }
    });
  } catch (error) {
    console.log("Error updating product analytics", error);
  }
};

// apps/kafka-service/src/main.ts
var consumer = kafka.consumer({ groupId: "user-events-group" });
var eventQueue = [];
var processQueue = async () => {
  if (eventQueue.length === 0)
    return;
  const events = [...eventQueue];
  eventQueue.length = 0;
  for (const event of events) {
    if (event.action === "shop_visit") {
    }
    const validActions = [
      "add_to_wishlist",
      "add_to_cart",
      "product_view",
      "remove_from_cart",
      "remove_from_wishlist"
    ];
    if (!event.action || !validActions.includes(event.action)) {
      continue;
    }
    try {
      await updateUserAnalytics(event);
      await updateProductAnalytics(event);
    } catch (error) {
      console.log("Error processing event: ", error);
    }
  }
};
setInterval(processQueue, 3e3);
var consumeKafkaMessages = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "users-events", fromBeginning: false });
  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value)
        return;
      const event = JSON.parse(message.value.toString());
      eventQueue.push(event);
    }
  });
};
consumeKafkaMessages().catch(console.error);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  consumeKafkaMessages
});
//# sourceMappingURL=main.js.map
