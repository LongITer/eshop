/**
 * Chatbot Controller
 * Handles HTTP endpoints for the PC builder chatbot.
 */

import { NextFunction, Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import prisma from "@packages/libs/prisma";
import { processMessage, ConversationContext } from "../services/rule-engine.service";
import {
  ChatLanguage,
  getAIResponse,
  localizeChatResponse,
} from "../services/ai.service";
import {
  findMatchingProducts,
  findBuildTemplates,
  getTemplateProducts,
  findShopProductsForAI,
} from "../services/product-matcher.service";
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

    // Get current context from conversation
    const currentContext =
      (conversation.context as ConversationContext | null) || null;

    // Process through rule engine first
    let botResponse = processMessage(message.trim(), currentContext);

    // If rule engine defers to AI, call AI service
    if (botResponse.needsAI) {
      const chatHistory = conversation.messages.slice().reverse().map((m) => ({
        role: m.role as "user" | "bot" | "system",
        content: m.content,
      }));

      // Find relevant products for AI context
      let products: any[] = [];
      if (botResponse.metadata?.action === "shop_product_query") {
        products = await findShopProductsForAI(message.trim());
      } else if (
        botResponse.newContext.budgetMax &&
        botResponse.newContext.purpose
      ) {
        products = await findMatchingProducts({
          purpose: botResponse.newContext.purpose,
          budgetMin: botResponse.newContext.budgetMin || 0,
          budgetMax: botResponse.newContext.budgetMax,
          preferences: botResponse.newContext.preferences || [],
        });
      }

      const aiResult = await getAIResponse(
        message.trim(),
        chatHistory,
        products,
        language
      );

      // AI owns the response for deferred requests; do not mix in rule prompts.
      if (aiResult.content) {
        botResponse = {
          ...botResponse,
          content: aiResult.content,
          messageType: "text",
          metadata: undefined,
        };
      }
    }

    if (!botResponse.needsAI) {
      const localized = await localizeChatResponse(
        botResponse.content,
        botResponse.metadata,
        language
      );
      botResponse.content = localized.content;
      botResponse.metadata = localized.metadata;
    }

    // If action is search_products, find matching products
    let matchedProducts: any[] = [];
    if (botResponse.messageType === "config_suggestion") {
      const suggestionContext = botResponse.metadata?.context as
        | ConversationContext
        | undefined;

      if (suggestionContext?.purpose && suggestionContext.budgetMax) {
        const templates = await findBuildTemplates(
          suggestionContext.purpose,
          suggestionContext.budgetMin || 0,
          suggestionContext.budgetMax
        );
        const targetBudget =
          ((suggestionContext.budgetMin || 0) + suggestionContext.budgetMax) / 2;
        const rankedTemplates = templates.sort(
          (a, b) =>
            Math.abs((a.budgetMin + a.budgetMax) / 2 - targetBudget) -
            Math.abs((b.budgetMin + b.budgetMax) / 2 - targetBudget)
        );
        let selectedTemplate = null;
        for (const template of rankedTemplates) {
          const templateProducts = await getTemplateProducts(template.productIds);
          if (templateProducts.length > 0) {
            selectedTemplate = template;
            matchedProducts = templateProducts;
            break;
          }
        }

        if (selectedTemplate) {
          const components = selectedTemplate.components as Record<string, unknown>;
          const componentsText = Object.entries(components)
            .map(([name, value]) => `• **${name.toUpperCase()}:** ${String(value)}`)
            .join("\n");
          botResponse.content =
            `🖥️ **Cấu hình đề xuất: ${selectedTemplate.name}**\n\n` +
            `Mục đích: ${suggestionContext.purposeLabel || suggestionContext.purpose}\n` +
            `Ngân sách: ${selectedTemplate.budgetMin.toLocaleString("vi-VN")} - ${selectedTemplate.budgetMax.toLocaleString("vi-VN")}đ\n\n` +
            `${componentsText}\n\n` +
            `${selectedTemplate.description || "Sản phẩm thực tế có trong cửa hàng được liệt kê bên dưới."}`;
          botResponse.metadata = {
            ...botResponse.metadata,
            build: {
              name: selectedTemplate.name,
              components,
              estimatedPrice: `${selectedTemplate.budgetMin.toLocaleString("vi-VN")} - ${selectedTemplate.budgetMax.toLocaleString("vi-VN")}đ`,
            },
            templateId: selectedTemplate.id,
          };
          botResponse.newContext = {
            ...botResponse.newContext,
            suggestedBuildName: selectedTemplate.name,
            suggestedTemplateId: selectedTemplate.id,
          };
        } else {
          matchedProducts = await findMatchingProducts({
            purpose: suggestionContext.purpose,
            budgetMin: suggestionContext.budgetMin || 0,
            budgetMax: suggestionContext.budgetMax,
            preferences: suggestionContext.preferences || [],
          });
        }

        if (matchedProducts.length > 0) {
          botResponse.metadata = {
            ...botResponse.metadata,
            products: matchedProducts.slice(0, 6),
          };
        }
      }
    }

    if (botResponse.metadata?.action === "alternative_config") {
      const alternativeContext = botResponse.metadata.context as
        | ConversationContext
        | undefined;

      if (alternativeContext?.purpose && alternativeContext.budgetMax) {
        const templates = await findBuildTemplates(
          alternativeContext.purpose,
          alternativeContext.budgetMin || 0,
          alternativeContext.budgetMax
        );
        const targetBudget =
          ((alternativeContext.budgetMin || 0) + alternativeContext.budgetMax) / 2;
        const candidates = templates
          .filter(
            (template) =>
              template.id !== alternativeContext.suggestedTemplateId &&
              template.name !== alternativeContext.suggestedBuildName
          )
          .sort(
            (a, b) =>
              Math.abs((a.budgetMin + a.budgetMax) / 2 - targetBudget) -
              Math.abs((b.budgetMin + b.budgetMax) / 2 - targetBudget)
          );

        let alternativeTemplate = null;
        for (const template of candidates) {
          const templateProducts = await getTemplateProducts(template.productIds);
          if (templateProducts.length > 0) {
            alternativeTemplate = template;
            matchedProducts = templateProducts.slice(0, 6);
            break;
          }
        }

        if (alternativeTemplate) {
          const components = alternativeTemplate.components as Record<string, unknown>;
          const componentsText = Object.entries(components)
            .map(([name, value]) => `• **${name.toUpperCase()}:** ${String(value)}`)
            .join("\n");
          botResponse.content =
            `🖥️ **Cấu hình thay thế: ${alternativeTemplate.name}**\n\n` +
            `Mục đích: ${alternativeContext.purposeLabel || alternativeContext.purpose}\n` +
            `Ngân sách: ${alternativeTemplate.budgetMin.toLocaleString("vi-VN")} - ${alternativeTemplate.budgetMax.toLocaleString("vi-VN")}đ\n\n` +
            `${componentsText}\n\n` +
            `${alternativeTemplate.description || "Sản phẩm thực tế có trong cửa hàng được liệt kê bên dưới."}`;
          botResponse.messageType = "config_suggestion";
          botResponse.metadata = {
            build: {
              name: alternativeTemplate.name,
              components,
              estimatedPrice: `${alternativeTemplate.budgetMin.toLocaleString("vi-VN")} - ${alternativeTemplate.budgetMax.toLocaleString("vi-VN")}đ`,
            },
            context: alternativeContext,
            templateId: alternativeTemplate.id,
            products: matchedProducts,
          };
          botResponse.newContext = {
            ...botResponse.newContext,
            suggestedBuildName: alternativeTemplate.name,
            suggestedTemplateId: alternativeTemplate.id,
          };
        } else {
          botResponse.content =
            `Trong ngân sách ${alternativeContext.budgetLabel || "đã chọn"}, ` +
            `hiện chưa có cấu hình mẫu khác cho nhu cầu ${alternativeContext.purposeLabel || alternativeContext.purpose}. ` +
            "Mình vẫn giữ nguyên mục đích và ngân sách của bạn. Bạn có thể yêu cầu đổi linh kiện cụ thể, ví dụ: “thêm RAM” hoặc “đổi GPU mạnh hơn”.";
          botResponse.messageType = "text";
          botResponse.metadata = undefined;
          botResponse.newContext = {
            ...botResponse.newContext,
            step: "follow_up",
          };
        }
      }
    }

    if (botResponse.metadata?.action === "search_products") {
      const searchCtx = botResponse.metadata.context as any;
      if (searchCtx) {
        matchedProducts = await findMatchingProducts({
          purpose: searchCtx.purpose || "gaming",
          budgetMin: searchCtx.budgetMin || 0,
          budgetMax: searchCtx.budgetMax || 50000000,
          preferences: searchCtx.preferences || [],
        });

        if (matchedProducts.length > 0) {
          botResponse.content =
            `🔍 Tôi tìm thấy **${matchedProducts.length} sản phẩm** phù hợp trong cửa hàng:\n\n` +
            "Dưới đây là những linh kiện được đánh giá cao nhất:";
          botResponse.messageType = "product_card";
          botResponse.metadata = {
            ...botResponse.metadata,
            products: matchedProducts.slice(0, 6),
          };
        } else {
          botResponse.content =
            "Hiện tại chưa có sản phẩm linh kiện PC phù hợp trong cửa hàng. " +
            "Bạn có thể duyệt qua tất cả sản phẩm tại trang **Products** nhé!\n\n" +
            'Gõ "bắt đầu" để tư vấn lại cấu hình.';
        }
      }
    }

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

    // Update conversation context
    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: {
        context: botResponse.newContext as any,
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
      products: matchedProducts.length > 0 ? matchedProducts : undefined,
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

    // Generate initial greeting message
    const greetingResponse = processMessage("", null);
    const localizedGreeting = await localizeChatResponse(
      greetingResponse.content,
      greetingResponse.metadata,
      language
    );

    const botMessage = await prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: "bot",
        content: localizedGreeting.content,
        messageType: greetingResponse.messageType,
        metadata: toPrismaJson(localizedGreeting.metadata),
      },
    });

    await prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { context: greetingResponse.newContext as any },
    });

    return res.status(201).json({
      conversationId: conversation.id,
      sessionId,
      message: {
        id: botMessage.id,
        role: "bot",
        content: localizedGreeting.content,
        messageType: greetingResponse.messageType,
        metadata: localizedGreeting.metadata || null,
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
