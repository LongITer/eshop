/**
 * Chatbot Routes
 * Defines HTTP endpoints for the PC builder chatbot service.
 */

import express from "express";
import type { NextFunction, Request, Response } from "express";
import isAuthenticated from "@packages/middleware/isAuthenticated";
import { isAdmin } from "@packages/middleware/authorizeRoles";
import {
  chat,
  createConversation,
  getConversation,
  deleteConversation,
  getTemplates,
  createTemplate,
  updateTemplate,
} from "../controllers/chatbot.controller";

const router = express.Router();

const optionalAuthentication = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const hasToken =
    req.cookies?.access_token ||
    req.cookies?.seller_access_token ||
    req.headers.authorization?.startsWith("Bearer ");

  return hasToken ? isAuthenticated(req, res, next) : next();
};

// ─── Chat ───────────────────────────────────────────────────────────
// Main chat endpoint — public (allows anonymous users)
router.post("/chat", optionalAuthentication, chat);

// ─── Conversations ──────────────────────────────────────────────────
router.post("/conversations", optionalAuthentication, createConversation);
router.get("/conversations/:id", optionalAuthentication, getConversation);
router.delete("/conversations/:id", optionalAuthentication, deleteConversation);

// ─── Templates (admin) ─────────────────────────────────────────────
router.get("/templates", getTemplates);
router.post("/templates", isAuthenticated, isAdmin, createTemplate);
router.put("/templates/:id", isAuthenticated, isAdmin, updateTemplate);

export default router;
