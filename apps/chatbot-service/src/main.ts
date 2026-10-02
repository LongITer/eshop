import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import router from "./routes/chatbot.routes";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Hello Chatbot Service API 🤖" });
});

// Routes
app.use("/api", router);

app.use(errorMiddleware);

const port = process.env.CHATBOT_PORT || 6007;
const server = app.listen(port, () => {
  console.log(`🤖 Chatbot service is listening at http://localhost:${port}/`);
  console.log(`   Chat endpoint: POST http://localhost:${port}/api/chat`);
});

server.on("error", (err) => {
  console.error("Chatbot service error:", err);
});
