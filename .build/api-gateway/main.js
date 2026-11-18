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

// apps/api-gateway/src/main.ts
var import_express = __toESM(require("express"));
var import_cors = __toESM(require("cors"));
var import_express_http_proxy = __toESM(require("express-http-proxy"));
var import_morgan = __toESM(require("morgan"));
var import_express_rate_limit = __toESM(require("express-rate-limit"));
var import_cookie_parser = __toESM(require("cookie-parser"));

// apps/api-gateway/src/libs/initizeSizeConfig.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
var initializeSiteConfig = async () => {
  try {
    const existingConfig = await prisma.site_config.findFirst();
    if (!existingConfig) {
      await prisma.site_config.create({
        data: {
          categories: [
            "Electronics",
            "Fashion",
            "Home & Kitchen",
            "Sports & Fitness"
          ],
          subCategories: {
            Electronics: ["Mobiles", "Laptops", "Accessories", "Gaming"],
            Fashion: ["Men", "Women", "Kids", "Footwear"],
            "Home & Kitchen": ["Furniture", "Appliances", "Decor"],
            "Sports & Fitness": [
              "Gym Equipment",
              "Outdoor Sports",
              "Wearables"
            ]
          }
        }
      });
    }
  } catch (error) {
    console.error("Failed to Initialize Config : ", error);
  }
};
var initizeSizeConfig_default = initializeSiteConfig;

// apps/api-gateway/src/libs/request-limit.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
function requestLimit(req) {
  const token = req.headers.authorization?.split(" ")[1] || req.cookies?.access_token || req.cookies?.seller_access_token;
  const secret = process.env.ACCESS_TOKEN_JWT_SECRET;
  if (!token || !secret)
    return 100;
  try {
    const payload = import_jsonwebtoken.default.verify(token, secret);
    if (typeof payload !== "string" && /^[a-f\d]{24}$/i.test(payload.id) && ["user", "seller", "admin"].includes(payload.role))
      return 1e3;
  } catch {
  }
  return 100;
}

// apps/api-gateway/src/main.ts
var app = (0, import_express.default)();
var proxyOptions = {
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    proxyReqOpts.headers = {
      ...proxyReqOpts.headers,
      ...srcReq.headers.authorization && {
        authorization: srcReq.headers.authorization
      },
      ...srcReq.headers.cookie && { cookie: srcReq.headers.cookie },
      "content-type": srcReq.headers["content-type"] || "application/json"
    };
    return proxyReqOpts;
  },
  userResHeaderDecorator: (headers) => {
    return {
      ...headers,
      "access-control-allow-credentials": "true"
    };
  }
};
app.post(
  "/api/create-order",
  (0, import_express_http_proxy.default)(process.env.ORDER_SERVICE_URL || "http://localhost:6004", {
    ...proxyOptions,
    proxyReqPathResolver: () => "/api/create-order"
  })
);
app.use(
  (0, import_cors.default)({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Session-Role",
      "Accept",
      "Origin",
      "Cookie"
    ],
    credentials: true
  })
);
app.use((0, import_morgan.default)("dev"));
app.use(import_express.default.json({ limit: "100mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "100mb" }));
app.use((0, import_cookie_parser.default)());
app.set("trust proxy", 1);
var limiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  // SSR and HMR fan out into several guest API calls during local development.
  // Keep production protection unchanged while avoiding false 429s locally.
  max: process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test" ? 1e3 : requestLimit,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req) => (0, import_express_rate_limit.ipKeyGenerator)(req.ip || req.socket.remoteAddress || "127.0.0.1")
});
app.use(limiter);
app.get("/gateway-health", (req, res) => {
  res.send({ message: "Welcome to api-gateway!" });
});
app.use(
  "/product",
  (0, import_express_http_proxy.default)(process.env.PRODUCT_SERVICE_URL || "http://localhost:6002", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/product/, "")
  })
);
app.use(
  "/order",
  (0, import_express_http_proxy.default)(process.env.ORDER_SERVICE_URL || "http://localhost:6004", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/order/, "")
  })
);
app.use(
  "/admin",
  (0, import_express_http_proxy.default)(process.env.ADMIN_SERVICE_URL || "http://localhost:6005", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl
  })
);
app.use(
  "/chatbot",
  (0, import_express_http_proxy.default)(process.env.CHATBOT_SERVICE_URL || "http://localhost:6007", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/chatbot/, "")
  })
);
app.use(
  "/chatting",
  (0, import_express_http_proxy.default)(process.env.CHATTING_SERVICE_URL || "http://localhost:6006", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/chatting/, "")
  })
);
app.use("/recommendation", (0, import_express_http_proxy.default)(process.env.RECOMMENDATION_SERVICE_URL || "http://localhost:6008", { ...proxyOptions, proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/recommendation/, "") }));
app.use("/", (0, import_express_http_proxy.default)(process.env.AUTH_SERVICE_URL || "http://localhost:6001", proxyOptions));
var port = process.env.PORT || 8080;
var server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/gateway-health`);
  try {
    initizeSizeConfig_default();
  } catch (error) {
    console.error("Error initializing site config:", error);
  }
});
server.on("error", console.error);
//# sourceMappingURL=main.js.map
