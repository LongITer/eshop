import express from "express";
import cors from "cors";
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
// import swaggerUi from 'swagger-ui-express';
// import axios from 'axios';
import cookieParser from "cookie-parser";
import initializeSiteConfig from "./libs/initizeSizeConfig";

const app = express();

const proxyOptions = {
  proxyReqOptDecorator: (proxyReqOpts: any, srcReq: any) => {
    proxyReqOpts.headers = {
      ...proxyReqOpts.headers,
      ...srcReq.headers,
      host: srcReq.headers.host,
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
  proxy("http://localhost:6004", {
    ...proxyOptions,
    proxyReqPathResolver: () => "/api/create-order",
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any origin during development
      if (!origin || origin.startsWith("http://localhost")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
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
  max: (req: any) => (req?.user ? 1000 : 100),
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: true,
  keyGenerator: (req: any) => ipKeyGenerator(req),
});
app.use(limiter);

app.get("/gateway-health", (req, res) => {
  res.send({ message: "Welcome to api-gateway!" });
});

app.use("/product", proxy("http://localhost:6002", proxyOptions));
app.use("/order", proxy("http://localhost:6004", proxyOptions));
app.use("/", proxy("http://localhost:6001", proxyOptions));

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
