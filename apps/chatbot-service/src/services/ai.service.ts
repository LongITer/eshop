/**
 * AI Service
 * Integrates with Google Gemini API for complex PC build consulting
 * when the rule engine cannot handle the user's request.
 */

import { MatchedProduct } from "./product-matcher.service";

// ─── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "bot" | "system";
  content: string;
}

interface AIResponseResult {
  content: string;
  error?: string;
}

export type ChatLanguage = "vi" | "en";

interface LocalizedResponse {
  content: string;
  metadata?: Record<string, unknown>;
}

// ─── System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Bạn là chuyên gia tư vấn build PC cho cửa hàng trực tuyến Eshop.

## Nhiệm vụ
- Giúp khách hàng chọn cấu hình PC phù hợp với nhu cầu và ngân sách
- Giải thích kỹ thuật một cách dễ hiểu
- Đề xuất linh kiện tương thích với nhau

## Quy tắc
- Trả lời bằng ngôn ngữ được yêu cầu, thân thiện và chuyên nghiệp
- Nếu có sản phẩm trong cửa hàng, ưu tiên đề xuất sản phẩm đó
- Khi hỏi sản phẩm của cửa hàng, chỉ xác nhận hoặc đề xuất sản phẩm có trong danh sách được cung cấp; nếu danh sách trống, hãy nói rõ chưa tìm thấy sản phẩm phù hợp
- Giải thích lý do chọn từng linh kiện ngắn gọn
- Cảnh báo nếu linh kiện không tương thích (ví dụ: socket CPU ≠ socket mainboard)
- Nếu ngân sách hạn chế, đề xuất linh kiện tốt nhất trong khả năng
- Nếu câu hỏi KHÔNG liên quan đến PC/máy tính/linh kiện, lịch sự từ chối và hướng dẫn quay lại chủ đề build PC
- Trả lời ngắn gọn, tối đa 200 từ
- Sử dụng emoji phù hợp để tăng tính thân thiện
- Format bằng Markdown khi cần (bold, list, headers)`;

const GEMINI_MODEL = "gemini-3.8-flash";

// ─── Gemini Integration ─────────────────────────────────────────────

/**
 * Get AI response from Gemini API.
 * Falls back gracefully if API key is not configured.
 */
export async function getAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  availableProducts: MatchedProduct[] = [],
  language: ChatLanguage = "vi"
): Promise<AIResponseResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      content: getFallbackResponse(userMessage, language),
      error: "GEMINI_API_KEY not configured",
    };
  }

  try {
    // Build context with available products
    let productContext = "";
    if (availableProducts.length > 0) {
      productContext =
        "\n\n## Sản phẩm có sẵn trong cửa hàng:\n" +
        JSON.stringify(
          availableProducts.map((p) => ({
            title: p.title,
            price: `${p.sale_price.toLocaleString("vi-VN")}đ`,
            category: p.subCategory || p.category,
            stock: p.stock,
            rating: p.rating,
            brand: p.brand,
          })),
          null,
          2
        );
    }

    const history = conversationHistory
      .filter((msg) => msg.role !== "system")
      .map((msg) => `${msg.role === "bot" ? "Trợ lý" : "Người dùng"}: ${msg.content}`)
      .join("\n");
    const input = history
      ? `${history}\nNgười dùng: ${userMessage}`
      : userMessage;

    // Interactions API stores requests by default; this stateless call opts out.
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          input,
          system_instruction:
            `${SYSTEM_PROMPT}\n\nTrả lời bằng ${language === "en" ? "tiếng Anh" : "tiếng Việt"}.` +
            productContext,
          generation_config: {
            temperature: 0.7,
            top_p: 0.9,
            max_output_tokens: 1024,
          },
          store: false,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", response.status, errorData);
      return {
        content: getFallbackResponse(userMessage, language),
        error: `Gemini API error: ${response.status}`,
      };
    }

    const data = await response.json();

    const text = Array.isArray(data?.steps)
      ? data.steps
          .filter((step: any) => step.type === "model_output")
          .flatMap((step: any) => step.content || [])
          .filter((content: any) => content.type === "text")
          .map((content: any) => content.text)
          .join("")
      : "";

    if (!text) {
      return {
        content: getFallbackResponse(userMessage, language),
        error: "Empty response from Gemini",
      };
    }

    return { content: text };
  } catch (error) {
    console.error("AI Service error:", error);
    return {
      content: getFallbackResponse(userMessage, language),
      error: `AI Service error: ${(error as Error).message}`,
    };
  }
}

export async function localizeChatResponse(
  content: string,
  metadata: Record<string, any> | undefined,
  language: ChatLanguage
): Promise<LocalizedResponse> {
  if (language === "vi") return { content, metadata };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { content, metadata };

  const options = Array.isArray(metadata?.options) ? metadata.options : [];
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          input: JSON.stringify({ content, options }),
          system_instruction:
            "Translate the content and option labels/descriptions into English. " +
            "Return only valid JSON with the same shape: {content, options}. " +
            "Preserve every option key exactly and do not translate product data.",
          generation_config: {
            temperature: 0.2,
            max_output_tokens: 1024,
          },
          store: false,
        }),
      }
    );

    if (!response.ok) return { content, metadata };

    const data = await response.json();
    const translatedText = Array.isArray(data?.steps)
      ? data.steps
          .filter((step: any) => step.type === "model_output")
          .flatMap((step: any) => step.content || [])
          .filter((item: any) => item.type === "text")
          .map((item: any) => item.text)
          .join("")
      : "";
    const translated = JSON.parse(translatedText) as {
      content?: string;
      options?: Array<{ key: string; label: string; description?: string }>;
    };

    return {
      content: translated.content || content,
      metadata: metadata
        ? {
            ...metadata,
            ...(options.length > 0 && Array.isArray(translated.options)
              ? { options: translated.options }
              : {}),
          }
        : undefined,
    };
  } catch (error) {
    console.error("Chat response localization error:", error);
    return { content, metadata };
  }
}

// ─── Fallback Response ──────────────────────────────────────────────

/**
 * Provides a helpful fallback when AI is unavailable.
 */
function getFallbackResponse(message: string, language: ChatLanguage): string {
  if (language === "en") {
    return "Sorry, the AI assistant is temporarily unavailable. Please try again later.";
  }

  const lowerMsg = message.toLowerCase();

  if (/tương\s*thích|compatible|socket/.test(lowerMsg)) {
    return (
      "Gemini hiện không khả dụng nên mình chưa thể xác minh độ tương thích của các linh kiện bạn nêu. " +
      "Vui lòng thử lại sau."
    );
  }

  // Common questions with pre-built answers
  if (/cpu|bộ\s*xử\s*lý|vi\s*xử\s*lý/.test(lowerMsg)) {
    return (
      "💡 **Về CPU:**\n\n" +
      "• **Gaming:** Intel Core i5-12400F hoặc AMD Ryzen 5 5600 là lựa chọn giá/hiệu năng tốt nhất\n" +
      "• **Đồ họa/Render:** Intel Core i7-13700 hoặc AMD Ryzen 7 7700X\n" +
      "• **Văn phòng:** Intel Core i3-12100 hoặc AMD Ryzen 3 4100\n\n" +
      "Bạn muốn biết thêm chi tiết về CPU nào?"
    );
  }

  if (/gpu|vga|card\s*(đồ\s*họa|màn\s*hình)/.test(lowerMsg)) {
    return (
      "🎮 **Về GPU/Card đồ họa:**\n\n" +
      "• **Entry (5-8tr):** GTX 1650, RX 6500 XT\n" +
      "• **Mid (8-15tr):** RTX 3060, RTX 4060, RX 6600 XT\n" +
      "• **High (15-25tr):** RTX 4060 Ti, RTX 4070, RX 7700 XT\n" +
      "• **Ultra (25tr+):** RTX 4070 Ti Super, RTX 4080, RX 7900 XT\n\n" +
      "Bạn cần card đồ họa cho mục đích gì?"
    );
  }

  if (/ram|bộ\s*nhớ/.test(lowerMsg)) {
    return (
      "🧠 **Về RAM:**\n\n" +
      "• **Văn phòng:** 8GB DDR4 3200MHz là đủ\n" +
      "• **Gaming:** 16GB DDR4 3600MHz (2x8GB dual channel)\n" +
      "• **Đồ họa/Render:** 32GB DDR4/DDR5\n" +
      "• **Workstation:** 64GB+ DDR5\n\n" +
      "Lưu ý: Luôn dùng 2 thanh RAM (dual channel) để tối ưu hiệu năng!"
    );
  }

  // Generic fallback
  return (
    "Cảm ơn câu hỏi của bạn! 🤔\n\n" +
    "Hiện tại tôi chưa thể trả lời chi tiết câu hỏi này. Bạn có thể:\n\n" +
    "1. **Bắt đầu lại** quy trình tư vấn build PC\n" +
    "2. Hỏi về **CPU, GPU, RAM, hay tương thích linh kiện**\n" +
    "3. Cho tôi biết **mục đích sử dụng** và **ngân sách** để được tư vấn cấu hình\n\n" +
    'Gõ "bắt đầu" để bắt đầu tư vấn từ đầu!'
  );
}
