import express from "express";
import WebSocket from "ws";
import { consumeKafkaMessages } from "./logger-consumer";
import { clients, recentLogs } from "./logger-state";
import http from "http";

const app = express();

const wsServer = new WebSocket.Server({ noServer: true });

wsServer.on("connection", (ws) => {
  console.log("New logger client connected!");

  clients.add(ws);
  recentLogs.forEach((log) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(log);
    }
  });

  ws.on("close", () => {
    console.log("Logger client disconnected!");
    clients.delete(ws);
  });
});

const server = http.createServer(app);
server.on("upgrade", (request: any, socket: any, head: any) => {
  wsServer.handleUpgrade(request, socket, head, (ws: WebSocket) => {
    wsServer.emit("connection", ws, request);
  });
});

const port = process.env.PORT || 6008;
server.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});

// Start Kafka consumer
consumeKafkaMessages().catch(console.error);
