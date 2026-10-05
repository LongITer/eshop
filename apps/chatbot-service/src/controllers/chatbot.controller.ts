/**
 * Chatbot Controller
 * Handles HTTP endpoints for the PC builder chatbot.
 */

import { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { ChatLanguage, getAIResponse } from "../services/ai.service";
import crypto from "crypto";

const ownsConversation = (
  conversation: { sessionId: string; userId: string | null },
  req: Request,
  sessionId: unknown
) =>
  typeof sessionId === "string" &&
  sessionId === conversation.sessionId &&
  (!conversation.userId || conversation.userId === (req as any).user?.id);

const toPrismaJson = (
  value: Record<string, unknown> | undefined
): Prisma.InputJsonValue | undefined =>
  value as unknown as Prisma.InputJsonValue | undefined;

const getProductContext = async () => {
  const products = await prisma.products.findMany({
    where: { stock: { gt: 0 }, status: "Active", isDeleted: false },
    include: { images: { take: 1 }, shop: { select: { name: true } } },
    orderBy: [{ rating: "desc" }, { totalSales: "desc" }],
    take: 100,
  });

  return products.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    category: product.category,
    subCategory: product.subCategory,
    sale_price: product.sale_price,
    regular_price: product.regular_price,
    stock: product.stock,
    rating: product.rating,
    image: product.images[0]?.url || null,
    shopName: product.shop.name,
    shopId: product.shopId,
    brand: product.brand,
  }));
};

// ─── Chat Endpoint ──────────────────────────────────────────────────

/**
 * POST /api/chat
 * Main chat endpoint — receives user message, returns bot response.
 *
 * Body: { conversationId?, sessionId?, message }
 */
export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversationId, sessionId, message } = req.body;
    const language: ChatLanguage = req.body.language === "en" ? "en" : "vi";
    const userId = (req as any).user?.id || null;

    if (
      sessionId != null &&
      (typeof sessionId !== "string" || sessionId.length < 16 || sessionId.length > 128)
    ) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Get or create conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.chatbotConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      });

      if (!conversation || !ownsConversation(conversation, req, sessionId)) {
        return res.status(404).json({ message: "Conversation not found" });
      }
    }

    if (!conversation) {
      const newSessionId = sessionId || crypto.randomUUID();
      conversation = await prisma.chatbotConversation.create({
        data: {
          userId,
          sessionId: newSessionId,
          status: "active",
          context: null,
        },
        include: { messages: true },
      });
    }

    // Save user message
    await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: message.trim(),
        messageType: "text",
      },
    });

    const chatHistory = conversation.messages.slice().reverse().map((m) => ({
      role: m.role as "user" | "bot" | "system",
      content: m.content,
    }));
    const products = await getProductContext();
    const aiResult = await getAIResponse(message.trim(), chatHistory, products, language);
    if (aiResult.error) {
      console.warn("Chatbot response unavailable:", aiResult.error);
      // Return a transient error message without adding it to AI conversation history.
      return res.status(200).json({
        conversationId: conversation.id,
        message: {
          id: crypto.randomUUID(), role: "bot", content: aiResult.content,
          messageType: "text", metadata: { aiUnavailable: true }, createdAt: new Date().toISOString(),
        },
      });
    }
    const botResponse = {
      content: aiResult.content,
      messageType: "text" as const,
      metadata: undefined,
    };

    // Save bot response message
    const botMessage = await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "bot",
        content: botResponse.content,
        messageType: botResponse.messageType,
        metadata: toPrismaJson(botResponse.metadata),
      },
    });

    return res.status(200).json({
      conversationId: conversation.id,
      message: {
        id: botMessage.id,
        role: "bot",
        content: botResponse.content,
        messageType: botResponse.messageType,
        metadata: botResponse.metadata || null,
        createdAt: botMessage.createdAt,
      },
      products: undefined,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return next(error);
  }
};

// ─── Conversation CRUD ──────────────────────────────────────────────

/**
 * POST /api/conversations
 * Create a new chatbot conversation.
 */
export const createConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user?.id || null;
    const language: ChatLanguage = req.body.language === "en" ? "en" : "vi";
    const requestedSessionId = req.body.sessionId;
    if (
      requestedSessionId != null &&
      (typeof requestedSessionId !== "string" ||
        requestedSessionId.length < 16 ||
        requestedSessionId.length > 128)
    ) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    const sessionId = requestedSessionId || crypto.randomUUID();

    const conversation = await prisma.chatbotConversation.create({
      data: {
        userId,
        sessionId,
        status: "active",
      },
    });

    const products = await getProductContext();
    const greetingResponse = await getAIResponse(
      "Hãy chào người dùng và hỏi họ đang cần tư vấn gì về máy tính hoặc sản phẩm trong cửa hàng.",
      [],
      products,
      language
    );

    const botMessage = await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "bot",
        content: greetingResponse.error
          ? (language === "en" ? "Hello! What will you use your PC for, and what is your budget?" : "Chào bạn! Bạn muốn build PC cho nhu cầu gì và ngân sách khoảng bao nhiêu?")
          : greetingResponse.content,
        messageType: "text",
        metadata: null,
      },
    });

    return res.status(201).json({
      conversationId: conversation.id,
      sessionId,
      message: {
        id: botMessage.id,
        role: "bot",
        content: botMessage.content,
        messageType: "text",
        metadata: null,
        createdAt: botMessage.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/conversations/:id
 * Get conversation with all messages.
 */
export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;

    const conversation = await prisma.chatbotConversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation || !ownsConversation(conversation, req, sessionId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    return res.status(200).json({ conversation });
  } catch (error) {
    return next(error);
  }
};

/**
 * DELETE /api/conversations/:id
 * Delete a conversation and all its messages.
 */
export const deleteConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { sessionId } = req.query;

    const conversation = await prisma.chatbotConversation.findUnique({
      where: { id },
    });

    if (!conversation || !ownsConversation(conversation, req, sessionId)) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Delete messages first
    await prisma.chatbotMessage.deleteMany({
      where: { conversationId: id },
    });

    await prisma.chatbotConversation.delete({
      where: { id },
    });

    return res.status(200).json({ message: "Conversation deleted" });
  } catch (error) {
    return next(error);
  }
};

// ─── Template Endpoints ─────────────────────────────────────────────

/**
 * GET /api/templates
 * List all active PC build templates.
 */
export const getTemplates = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { purpose, budgetMin, budgetMax } = req.query;

    const where: any = { isActive: true };
    if (purpose) where.purpose = purpose as string;
    if (budgetMin || budgetMax) {
      where.budgetMin = budgetMin ? { gte: Number(budgetMin) } : undefined;
      where.budgetMax = budgetMax ? { lte: Number(budgetMax) } : undefined;
    }

    const templates = await prisma.pcBuildTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ templates });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/templates
 * Create a new PC build template.
 */
export const createTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      name,
      purpose,
      budgetMin,
      budgetMax,
      components,
      productIds,
      description,
    } = req.body;

    const parsedBudgetMin = Number(budgetMin);
    const parsedBudgetMax = Number(budgetMax);

    if (
      !name ||
      !purpose ||
      budgetMin == null ||
      budgetMax == null ||
      !components ||
      typeof components !== "object" ||
      Array.isArray(components) ||
      !Number.isFinite(parsedBudgetMin) ||
      !Number.isFinite(parsedBudgetMax) ||
      parsedBudgetMin < 0 ||
      parsedBudgetMax < parsedBudgetMin ||
      (productIds != null &&
        (!Array.isArray(productIds) ||
          productIds.some((id: unknown) => typeof id !== "string")))
    ) {
      return res.status(400).json({
        message: "Invalid template data",
      });
    }

    const template = await prisma.pcBuildTemplate.create({
      data: {
        name,
        purpose,
        budgetMin: parsedBudgetMin,
        budgetMax: parsedBudgetMax,
        components,
        productIds: productIds || [],
        description: description || null,
      },
    });

    return res.status(201).json({ template });
  } catch (error) {
    return next(error);
  }
};

/**
 * PUT /api/templates/:id
 * Update an existing template.
 */
export const updateTemplate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      "name",
      "purpose",
      "budgetMin",
      "budgetMax",
      "components",
      "productIds",
      "description",
      "isActive",
    ];
    const updateData: Record<string, any> = Object.fromEntries(
      Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
    );

    const existingTemplate = await prisma.pcBuildTemplate.findUnique({
      where: { id },
    });
    if (!existingTemplate) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (updateData.budgetMin != null)
      updateData.budgetMin = Number(updateData.budgetMin);
    if (updateData.budgetMax != null)
      updateData.budgetMax = Number(updateData.budgetMax);
    const finalBudgetMin = Number(
      updateData.budgetMin ?? existingTemplate.budgetMin
    );
    const finalBudgetMax = Number(
      updateData.budgetMax ?? existingTemplate.budgetMax
    );
    if (
      !Number.isFinite(finalBudgetMin) ||
      !Number.isFinite(finalBudgetMax) ||
      finalBudgetMin < 0 ||
      finalBudgetMax < finalBudgetMin ||
      (updateData.components != null &&
        (typeof updateData.components !== "object" ||
          Array.isArray(updateData.components))) ||
      (updateData.productIds != null &&
        (!Array.isArray(updateData.productIds) ||
          updateData.productIds.some((productId: unknown) => typeof productId !== "string")))
    ) {
      return res.status(400).json({ message: "Invalid template data" });
    }

    const template = await prisma.pcBuildTemplate.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({ template });
  } catch (error) {
    return next(error);
  }
};
