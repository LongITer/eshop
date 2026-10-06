import express from "express";
import cors from "cors";
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
// import swaggerUi from 'swagger-ui-express';
// import axios from 'axios';
import cookieParser from "cookie-parser";
import initializeSiteConfig from "./libs/initizeSizeConfig";
import { requestLimit } from "./libs/request-limit";

const app = express();

const proxyOptions = {
  proxyReqOptDecorator: (proxyReqOpts: any, srcReq: any) => {
    // Only forward auth/session headers — do NOT spread all srcReq.headers.
    // Spreading stale transport headers (content-length, transfer-encoding, etc.)
    // after express has already parsed the body causes "Cannot set headers after
    // they are sent to the client".
    proxyReqOpts.headers = {
      ...proxyReqOpts.headers,
      ...(srcReq.headers.authorization && {
        authorization: srcReq.headers.authorization,
      }),
      ...(srcReq.headers.cookie && { cookie: srcReq.headers.cookie }),
      "content-type": srcReq.headers["content-type"] || "application/json",
    };
    return proxyReqOpts;
  },
  userResHeaderDecorator: (headers: any) => {
    return {
      ...headers,
      "access-control-allow-credentials": "true",
    };
  },
};

app.post(
  "/api/create-order",
  proxy(process.env.ORDER_SERVICE_URL || "http://localhost:6004", {
    ...proxyOptions,
    proxyReqPathResolver: () => "/api/create-order",
  }),
);

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cookie",
    ],
    credentials: true,
  }),
);

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cookieParser());
app.set("trust proxy", 1);

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // SSR and HMR fan out into several guest API calls during local development.
  // Keep production protection unchanged while avoiding false 429s locally.
  max: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test' ? 1000 : requestLimit,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: any) => ipKeyGenerator(req.ip || req.socket.remoteAddress || "127.0.0.1"),
});
app.use(limiter);

app.get("/gateway-health", (req, res) => {
  res.send({ message: "Welcome to api-gateway!" });
});

app.use(
  "/product",
  proxy(process.env.PRODUCT_SERVICE_URL || "http://localhost:6002", {
    ...proxyOptions,
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace(/^\/product/, ""),
  }),
);
app.use(
  "/order",
  proxy(process.env.ORDER_SERVICE_URL || "http://localhost:6004", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl.replace(/^\/order/, ""),
  }),
);
app.use(
  "/admin",
  proxy(process.env.ADMIN_SERVICE_URL || "http://localhost:6005", {
    ...proxyOptions,
    proxyReqPathResolver: (req) => req.originalUrl,
  }),
);
app.use(
  "/chatbot",
  proxy(process.env.CHATBOT_SERVICE_URL || "http://localhost:6007", {
    ...proxyOptions,
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace(/^\/chatbot/, ""),
  }),
);
app.use(
  "/chatting",
  proxy(process.env.CHATTING_SERVICE_URL || "http://localhost:6006", {
    ...proxyOptions,
    proxyReqPathResolver: (req) =>
      req.originalUrl.replace(/^\/chatting/, ""),
  }),
);
app.use('/recommendation', proxy(process.env.RECOMMENDATION_SERVICE_URL || 'http://localhost:6008', { ...proxyOptions, proxyReqPathResolver: req => req.originalUrl.replace(/^\/recommendation/, '') }));
app.use("/", proxy(process.env.AUTH_SERVICE_URL || "http://localhost:6001", proxyOptions));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/gateway-health`);
  try {
    initializeSiteConfig();
  } catch (error) {
    console.error("Error initializing site config:", error);
  }
});
server.on("error", console.error);
