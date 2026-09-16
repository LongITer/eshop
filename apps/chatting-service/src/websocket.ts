import redis from "@packages/libs/redis";
import { kafka } from "@packages/utils/kafka";
import { Server as HttpServer } from "http";
import WebSocket, { WebSocketServer } from "ws";

const producer = kafka.producer();
const connectedUsers: Map<string, WebSocket> = new Map();
const unseenCounts: Map<string, number> = new Map();

type IncomingMessage = {
  type?: string;
  fromUserId: string;
  toUserId: string;
  messageBody: string;
  conversationId: string;
  senderType: string;
};

export async function createWebSockerServer(server: HttpServer) {
  const wss = new WebSocketServer({ server });

  await producer.connect();
  console.log("Kafka producer connected!");

  wss.on("connection", (ws: WebSocket, req) => {
    console.log("New Websocket connection!");

    let registeredUserId: string | null = null;

    ws.on("message", async (rawMessage) => {
      try {
        const messageStr = rawMessage.toString();

        // Register the user on first plain message (non-JSON)
        if (!registeredUserId && !messageStr.startsWith("{")) {
          // Auto-prefix plain userIds so the key matches lookup format ("user_X" / "seller_X")
          const rawId = messageStr;
          registeredUserId =
            rawId.startsWith("user_") || rawId.startsWith("seller_")
              ? rawId
              : `user_${rawId}`;
          connectedUsers.set(registeredUserId, ws);
          console.log(`Registered websocket for userID: ${registeredUserId}`);

          const isSeller = registeredUserId.startsWith("seller_");
          const redisKey = isSeller
            ? `online:seller:${registeredUserId.replace("seller_", "")}`
            : `online:user:${registeredUserId}`;

          await redis.set(redisKey, "1");
          await redis.expire(redisKey, 300);
          return;
        }

        // Process the JSON message
        const data: IncomingMessage = JSON.parse(messageStr);

        // If it's seen update
        if (data.type === "MARK_AS_SEEN" && registeredUserId) {
          const seenKey = `${registeredUserId}_${data.conversationId}`;
          unseenCounts.set(seenKey, 0);
          return;
        }

        // Regular messages
        const {
          fromUserId,
          toUserId,
          messageBody,
          conversationId,
          senderType,
        } = data;

        if (!data || !toUserId || !messageBody || !conversationId) {
          console.warn("invalid message format: ", data);
          return;
        }

        const now = new Date().toISOString();

        const messagePayload = {
          conversationId,
          senderId: fromUserId,
          senderType,
          content: messageBody,
          createdAt: now,
        };

        const messageEvent = JSON.stringify({
          type: "NEW_MESSAGE",
          payload: messagePayload,
        });

        const receiverKey =
          senderType === "user" ? `seller_${toUserId}` : `user_${toUserId}`;
        const senderKey =
          senderType === "user" ? `user_${fromUserId}` : `seller_${fromUserId}`;

        // Update unseen count dynamically
        const unseenKey = `${receiverKey}_${conversationId}`;
        const prevCount = unseenCounts.get(unseenKey) || 0;
        unseenCounts.set(unseenKey, prevCount + 1);

        // Send new message to receiver
        const receiverSocket = connectedUsers.get(receiverKey);
        if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
          receiverSocket.send(messageEvent);

          // Notify unseen count
          receiverSocket.send(
            JSON.stringify({
              type: "UNSEEN_COUNT_UPDATE",
              payload: {
                conversationId,
                count: prevCount + 1,
              },
            }),
          );

          console.log(`Delivered message + unseen count to ${receiverKey}`);
        } else {
          console.log(`User ${receiverKey} is offline. Message queued.`);
        }
        // echo to sender
        const senderSocket = connectedUsers.get(senderKey);
        if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
          senderSocket.send(messageEvent);
          console.log(`Echo message to sender ${senderKey}`);
        }

        // push to kafka consumer
        await producer.send({
          topic: "chat.new_message",
          messages: [
            {
              key: "1",
              value: JSON.stringify(messagePayload),
            },
          ],
        });

        console.log(`message queued to kafka: ${conversationId}`);
      } catch (error) {
        console.error("Error processing Websocker message: ", error);
      }
    });

    ws.on("close", async () => {
      if (registeredUserId) {
        connectedUsers.delete(registeredUserId);
        console.log(`Disconnected user ${registeredUserId}`);

        const isSeller = registeredUserId.startsWith("seller_");
        const redisKey = isSeller
          ? `online:seller:${registeredUserId.replace("seller_", "")}`
          : `online:user:${registeredUserId}`;

        await redis.del(redisKey);
        console.log(`Removed from online set: ${redisKey}`);
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error: ", error);
    });
  });

  console.log("Websocket server started on port ", process.env.PORT);
}
