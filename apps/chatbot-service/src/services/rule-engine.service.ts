/**
 * Rule Engine Service
 * Handles the structured conversation flow for PC build consulting.
 * Manages conversation state transitions and generates appropriate responses.
 */

import {
  PURPOSE_PROFILES,
  BUDGET_RANGES,
  PREFERENCE_OPTIONS,
  detectPurpose,
  detectBudget,
  detectPreferences,
  getFallbackBuild,
} from "../data/pc-knowledge";
import type { BudgetRange, PurposeProfile } from "../data/pc-knowledge";

// ─── Conversation State Machine ─────────────────────────────────────

export type ConversationStep =
  | "greeting"
  | "ask_purpose"
  | "ask_budget"
  | "ask_preferences"
  | "suggest_config"
  | "follow_up"
  | "free_chat";

export interface ConversationContext {
  step: ConversationStep;
  purpose?: string;
  purposeLabel?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetLabel?: string;
  budgetTier?: string;
  preferences?: string[];
  suggestedBuildName?: string;
  suggestedTemplateId?: string;
}

export interface BotResponse {
  content: string;
  messageType: "text" | "quick_reply" | "config_suggestion" | "product_card";
  metadata?: Record<string, unknown>;
  newContext: ConversationContext;
  needsAI?: boolean;
}

// ─── Greeting Detection ─────────────────────────────────────────────

const GREETING_PATTERNS = [
  /^(xin\s+)?chào/i,
  /^hi\b/i,
  /^hello/i,
  /^hey/i,
  /^alo/i,
  /^bắt\s*đầu(?:\s+lại)?$/i,
  /^(?:tư\s*vấn|build\s*pc|lắp\s*máy|cấu\s*hình)(?:\s+(?:pc|máy\s*tính))?$/i,
  /^start$/i,
];

function isGreeting(message: string): boolean {
  return GREETING_PATTERNS.some((pattern) => pattern.test(message.trim()));
}

// ─── Main Rule Engine ───────────────────────────────────────────────

export function processMessage(
  userMessage: string,
  context: ConversationContext | null
): BotResponse {
  const currentContext: ConversationContext = context || {
    step: "greeting",
  };

  const trimmedMsg = userMessage.trim();

  // If no context or greeting detected, start fresh
  if (!context || isGreeting(trimmedMsg)) {
    return handleGreeting(trimmedMsg, currentContext);
  }

  switch (currentContext.step) {
    case "greeting":
    case "ask_purpose":
      return handlePurpose(trimmedMsg, currentContext);

    case "ask_budget":
      return handleBudget(trimmedMsg, currentContext);

    case "ask_preferences":
      return handlePreferences(trimmedMsg, currentContext);

    case "suggest_config":
    case "follow_up":
      return handleFollowUp(trimmedMsg, currentContext);

    case "free_chat":
      return handleFreeChat(trimmedMsg, currentContext);

    default:
      return handleGreeting(trimmedMsg, currentContext);
  }
}

// ─── Step Handlers ──────────────────────────────────────────────────

function handleGreeting(
  _message: string,
  _context: ConversationContext
): BotResponse {
  const purposeOptions = PURPOSE_PROFILES.map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description,
  }));

  return {
    content:
      "Xin chào! 👋 Tôi là trợ lý tư vấn build PC của Eshop.\n\n" +
      "Tôi sẽ giúp bạn chọn cấu hình PC phù hợp nhất với nhu cầu và ngân sách.\n\n" +
      "**Bạn muốn build PC cho mục đích gì?**",
    messageType: "quick_reply",
    metadata: {
      options: purposeOptions,
    },
    newContext: {
      step: "ask_purpose",
    },
  };
}

function handlePurpose(
  message: string,
  context: ConversationContext
): BotResponse {
  // Try to detect purpose from message
  let purpose: PurposeProfile | null = detectPurpose(message);

  // Also check if user selected a quick reply option by key
  if (!purpose) {
    const profile = PURPOSE_PROFILES.find(
      (p) =>
        p.key === message.toLowerCase() ||
        p.label.toLowerCase() === message.toLowerCase()
    );
    if (profile) purpose = profile;
  }

  if (!purpose) {
    // Could not detect purpose — ask AI or re-prompt
    return {
      content:
        "Tôi chưa hiểu rõ nhu cầu của bạn. Bạn có thể chọn một trong các mục đích sau:",
      messageType: "quick_reply",
      metadata: {
        options: PURPOSE_PROFILES.map((p) => ({
          key: p.key,
          label: p.label,
          description: p.description,
        })),
      },
      newContext: { ...context, step: "ask_purpose" },
      needsAI: true,
    };
  }

  const purposeContext = {
    ...context,
    purpose: purpose.key,
    purposeLabel: purpose.label,
  };
  if (detectBudget(message)) {
    return handleBudget(message, purposeContext);
  }

  const budgetOptions = BUDGET_RANGES.map((b) => ({
    key: b.key,
    label: b.label,
  }));

  return {
    content:
      `Tuyệt vời! Build PC cho **${purpose.label}** là lựa chọn rất tốt! 🎯\n\n` +
      `${purpose.description}.\n\n` +
      `**Ngân sách dự kiến của bạn khoảng bao nhiêu?**`,
    messageType: "quick_reply",
    metadata: {
      options: budgetOptions,
    },
    newContext: {
      ...purposeContext,
      step: "ask_budget",
    },
  };
}

function handleBudget(
  message: string,
  context: ConversationContext
): BotResponse {
  let budget: BudgetRange | null = detectBudget(message);

  // Check if user selected a quick reply by key or label
  if (!budget) {
    budget =
      BUDGET_RANGES.find(
        (b) =>
          b.key === message.toLowerCase() ||
          b.label.toLowerCase() === message.toLowerCase()
      ) || null;
  }

  if (!budget) {
    return {
      content:
        "Tôi chưa nhận được mức ngân sách. Bạn có thể chọn hoặc nhập số tiền cụ thể (ví dụ: 15 triệu):",
      messageType: "quick_reply",
      metadata: {
        options: BUDGET_RANGES.map((b) => ({
          key: b.key,
          label: b.label,
        })),
      },
      newContext: { ...context, step: "ask_budget" },
    };
  }

  const prefOptions = PREFERENCE_OPTIONS.map((p) => ({
    key: p.key,
    label: p.label,
    description: p.description,
  }));

  return {
    content:
      `Ngân sách **${budget.label}** — được rồi! 💰\n\n` +
      `Với mức này, tôi có thể gợi ý cấu hình phù hợp cho **${context.purposeLabel}**.\n\n` +
      `**Bạn có yêu cầu đặc biệt nào không?**`,
    messageType: "quick_reply",
    metadata: {
      options: prefOptions,
    },
    newContext: {
      ...context,
      step: "ask_preferences",
      budgetMin: budget.min,
      budgetMax: budget.max,
      budgetLabel: budget.label,
      budgetTier: budget.tier,
    },
  };
}

function handlePreferences(
  message: string,
  context: ConversationContext
): BotResponse {
  const prefs = detectPreferences(message);

  // Also check quick reply keys
  if (prefs.length === 1 && prefs[0].key === "none") {
    const selectedPref = PREFERENCE_OPTIONS.find(
      (p) =>
        p.key === message.toLowerCase() ||
        p.label.toLowerCase() === message.toLowerCase()
    );
    if (selectedPref && selectedPref.key !== "none") {
      prefs.splice(0, 1, selectedPref);
    }
  }

  const prefLabels = prefs.map((p) => p.label);

  // Generate config suggestion
  return generateConfigSuggestion(
    { ...context, preferences: prefs.map((p) => p.key) },
    prefLabels
  );
}

function generateConfigSuggestion(
  context: ConversationContext,
  prefLabels: string[]
): BotResponse {
  const purpose = context.purpose || "gaming";
  const budgetTier = context.budgetTier || "mid";

  const fallbackBuild = getFallbackBuild(purpose, budgetTier);

  if (!fallbackBuild) {
    return {
      content:
        "Xin lỗi, tôi chưa có cấu hình mẫu phù hợp. Để tôi tìm giúp bạn từ cửa hàng...",
      messageType: "text",
      newContext: { ...context, step: "follow_up" },
      needsAI: true,
    };
  }

  const componentsText = Object.entries(fallbackBuild.components)
    .map(([key, value]) => `• **${key.toUpperCase()}:** ${value}`)
    .join("\n");

  return {
    content:
      `🖥️ **Cấu hình đề xuất: ${fallbackBuild.name}**\n\n` +
      `Mục đích: ${context.purposeLabel}\n` +
      `Ngân sách: ${context.budgetLabel}\n` +
      (prefLabels[0] !== "Không có yêu cầu đặc biệt"
        ? `Ưu tiên: ${prefLabels.join(", ")}\n`
        : "") +
      `\n---\n\n` +
      `${componentsText}\n\n` +
      `💰 **Giá ước tính: ${fallbackBuild.estimatedPrice}**\n\n` +
      `---\n\n` +
      `Bạn muốn tôi:\n` +
      `1. Tìm sản phẩm cụ thể trong cửa hàng?\n` +
      `2. Thay đổi linh kiện nào?\n` +
      `3. Xem cấu hình khác?`,
    messageType: "config_suggestion",
    metadata: {
      build: fallbackBuild,
      context: {
        purpose,
        budgetTier,
        preferences: context.preferences,
      },
    },
    newContext: {
      ...context,
      step: "follow_up",
      suggestedBuildName: fallbackBuild.name,
    },
  };
}

function handleFollowUp(
  message: string,
  context: ConversationContext
): BotResponse {
  const lowerMsg = message.toLowerCase();

  // User wants to see products in store
  if (
    /tìm\s*(sản phẩm|linh kiện)|trong\s*cửa\s*hàng|xem\s*sản\s*phẩm|mua|1/.test(
      lowerMsg
    )
  ) {
    return {
      content:
        "Tôi sẽ tìm sản phẩm phù hợp trong cửa hàng cho bạn. Vui lòng chờ một chút... 🔍",
      messageType: "text",
      metadata: {
        action: "search_products",
        context: {
          purpose: context.purpose,
          budgetMin: context.budgetMin,
          budgetMax: context.budgetMax,
          preferences: context.preferences,
        },
      },
      newContext: { ...context, step: "follow_up" },
      needsAI: false,
    };
  }

  // User wants to change components
  if (/thay\s*đổi|đổi|thay|sửa|chỉnh|2/.test(lowerMsg)) {
    return {
      content:
        "Bạn muốn thay đổi linh kiện nào? Hãy cho tôi biết cụ thể (ví dụ: 'đổi GPU mạnh hơn', 'thêm RAM').",
      messageType: "text",
      newContext: { ...context, step: "free_chat" },
      needsAI: true,
    };
  }

  // User wants different config
  if (/cấu\s*hình\s*khác|khác|xem\s*thêm|3/.test(lowerMsg)) {
    return {
      content: "Để tôi tìm một cấu hình khác trong cùng mục đích và ngân sách cho bạn...",
      messageType: "text",
      metadata: {
        action: "alternative_config",
        context: {
          purpose: context.purpose,
          purposeLabel: context.purposeLabel,
          budgetMin: context.budgetMin,
          budgetMax: context.budgetMax,
          budgetLabel: context.budgetLabel,
          budgetTier: context.budgetTier,
          preferences: context.preferences || [],
          suggestedTemplateId: context.suggestedTemplateId,
          suggestedBuildName: context.suggestedBuildName,
        },
      },
      newContext: { ...context, step: "follow_up" },
    };
  }

  // User wants to restart
  if (/lại|restart|bắt\s*đầu\s*lại|reset/.test(lowerMsg)) {
    return handleGreeting("", { step: "greeting" });
  }

  // Unknown intent — send to AI
  return {
    content: "",
    messageType: "text",
    newContext: { ...context, step: "free_chat" },
    needsAI: true,
  };
}

function handleFreeChat(
  _message: string,
  context: ConversationContext
): BotResponse {
  // All free chat goes to AI
  return {
    content: "",
    messageType: "text",
    newContext: { ...context, step: "free_chat" },
    needsAI: true,
  };
}
