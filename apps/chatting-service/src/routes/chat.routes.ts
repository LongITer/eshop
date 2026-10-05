import isAuthenticated from "@packages/middleware/isAuthenticated";
import express from "express";
import {
  fetchMessages,
  fetchSellerMessages,
  getSellerConversations,
  getUserConversations,
  newConversation,
} from "../controllers/chatting.controllers";
import { isSeller } from "@packages/middleware/authorizeRoles";
import { socketTicket, attachment, pushKey, subscribePush } from '../chat-extras';
import { actor } from '../chat-extras';
import { handle } from '@packages/utils/api';
import prisma from '@packages/libs/prisma';

const router = express.Router();
router.get('/unread-count', isAuthenticated, handle(async (req, res) => {
  const identity = actor(req);
  const result = await prisma.participant.aggregate({ where: identity.type === 'user' ? { userId: identity.id } : { sellerId: identity.id }, _sum: { unreadCount: true } });
  res.json({ unreadCount: result._sum.unreadCount ?? 0 });
}));
router.post('/socket-ticket', isAuthenticated, socketTicket);
router.post('/attachments', isAuthenticated, attachment);
router.get('/push-key', isAuthenticated, pushKey);
router.post('/push-subscription', isAuthenticated, subscribePush);

router.post("/create-user-conversationGroup", isAuthenticated, newConversation);
router.get("/get-user-conversations", isAuthenticated, getUserConversations);
router.get(
  "/get-seller-conversations",
  isAuthenticated,
  isSeller,
  getSellerConversations,
);
router.get("/get-messages/:conversationId", isAuthenticated, fetchMessages);
router.get(
  "/get-seller-messages/:conversationId",
  isAuthenticated,
  isSeller,
  fetchSellerMessages,
);

export default router;
