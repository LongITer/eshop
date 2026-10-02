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

// ─── System Prompt ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `Bạn là chuyên gia tư vấn build PC cho cửa hàng trực tuyến Eshop.

## Nhiệm vụ
- Giúp khách hàng chọn cấu hình PC phù hợp với nhu cầu và ngân sách
- Giải thích kỹ thuật một cách dễ hiểu
- Đề xuất linh kiện tương thích với nhau

## Quy tắc
- Luôn trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp
- Nếu có sản phẩm trong cửa hàng, ưu tiên đề xuất sản phẩm đó
- Giải thích lý do chọn từng linh kiện ngắn gọn
- Cảnh báo nếu linh kiện không tương thích (ví dụ: socket CPU ≠ socket mainboard)
- Nếu ngân sách hạn chế, đề xuất linh kiện tốt nhất trong khả năng
- Nếu câu hỏi KHÔNG liên quan đến PC/máy tính/linh kiện, lịch sự từ chối và hướng dẫn quay lại chủ đề build PC
- Trả lời ngắn gọn, tối đa 200 từ
- Sử dụng emoji phù hợp để tăng tính thân thiện
- Format bằng Markdown khi cần (bold, list, headers)`;

// ─── Gemini Integration ─────────────────────────────────────────────

/**
 * Get AI response from Gemini API.
 * Falls back gracefully if API key is not configured.
 */
export async function getAIResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  availableProducts: MatchedProduct[] = []
): Promise<AIResponseResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      content: getFallbackResponse(userMessage),
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

    // Build conversation history for Gemini
    const contents = conversationHistory
      .filter((msg) => msg.role !== "system")
      .map((msg) => ({
        role: msg.role === "bot" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    });

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT + productContext }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API error:", response.status, errorData);
      return {
        content: getFallbackResponse(userMessage),
        error: `Gemini API error: ${response.status}`,
      };
    }

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return {
        content: getFallbackResponse(userMessage),
        error: "Empty response from Gemini",
      };
    }

    return { content: text };
  } catch (error) {
    console.error("AI Service error:", error);
    return {
      content: getFallbackResponse(userMessage),
      error: `AI Service error: ${(error as Error).message}`,
    };
  }
}

// ─── Fallback Response ──────────────────────────────────────────────

/**
 * Provides a helpful fallback when AI is unavailable.
 */
function getFallbackResponse(message: string): string {
  const lowerMsg = message.toLowerCase();

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

  if (/tương\s*thích|compatible|socket/.test(lowerMsg)) {
    return (
      "🔧 **Kiểm tra tương thích:**\n\n" +
      "• CPU Intel Gen 12/13/14 → Socket LGA 1700 → Mainboard B660/B760/Z690/Z790\n" +
      "• CPU AMD Ryzen 5000 → Socket AM4 → Mainboard B550/X570\n" +
      "• CPU AMD Ryzen 7000 → Socket AM5 → Mainboard B650/X670\n" +
      "• DDR4 ≠ DDR5 — kiểm tra mainboard hỗ trợ loại RAM nào\n\n" +
      "Hãy cho tôi biết CPU bạn đang chọn, tôi sẽ gợi ý mainboard phù hợp!"
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
