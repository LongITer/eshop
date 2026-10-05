import 'dotenv/config';
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import router from "./routes/order.route";
import { createOrder } from "./routes/order.controller";
const app = express();

app.use(
  cors({
    origin: true,
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  }),
);
app.post(
  "/api/create-order",
  bodyParser.raw({ type: "application/json" }),
  (req, res, next) => {
    (req as any).rawBody = req.body;
    next();
  },
  createOrder,
);
app.use(express.json());
app.use(cookieParser());

app.use("/", router);
app.use('/api', router);
app.use(errorMiddleware);

const port = process.env.PORT || 6004;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
