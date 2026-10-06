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

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"] as const;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

// Provider cooldowns prevent every chat turn from retrying an exhausted model.
const modelCooldowns = new Map<string, number>();
let cooldownApiKey: string | null = null;

function retryDelay(response: Response, body: string): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(delay) && delay > 0) return Math.min(delay, 86400000);
  }
  const duration = body.match(/retry in\s+(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/i);
  if (duration) {
    const delay = (Number(duration[1] || 0) * 3600 + Number(duration[2] || 0) * 60 + Number(duration[3] || 0)) * 1000;
    if (delay > 0) return Math.min(delay, 86400000);
  }
  return /per day|daily|per_day/i.test(body) ? 86400000 : 60000;
}

async function requestGemini(url: string, init: RequestInit): Promise<Response> {
  const apiKey = new Headers(init.headers).get("x-goog-api-key");
  if (apiKey !== cooldownApiKey) {
    modelCooldowns.clear();
    cooldownApiKey = apiKey;
  }
  const requestBody = JSON.parse(String(init.body || "{}"));
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (const model of GEMINI_MODELS) {
    if ((modelCooldowns.get(model) || 0) > Date.now()) continue;
    try {
      const response = await fetch(url, {
        ...init,
        body: JSON.stringify({ ...requestBody, model }),
        signal: AbortSignal.timeout(20000),
      });
      lastResponse = response;
      if (response.ok) return response;
      // Invalid credentials or malformed requests cannot be fixed by another model.
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) return response;
      const detail = await response.clone().text();
      modelCooldowns.set(model, Date.now() + (response.status === 429 ? retryDelay(response, detail) : 30000));
      console.warn("Gemini model unavailable; trying fallback", { model, status: response.status });
    } catch (error) {
      // A timeout/network failure must not bypass the fallback model.
      lastError = error;
      modelCooldowns.set(model, Date.now() + 30000);
      console.warn("Gemini request failed; trying fallback", { model, reason: error instanceof Error ? error.name : "NetworkError" });
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error("All Gemini models are temporarily unavailable");
}

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
      .filter((msg) => msg.role !== "system" && !(msg.role === "bot" && [getFallbackResponse("", "vi"), getFallbackResponse("", "en")].includes(msg.content.trim())))
      .map((msg) => `${msg.role === "bot" ? "Trợ lý" : "Người dùng"}: ${msg.content}`)
      .join("\n");
    const input = history
      ? `${history}\nNgười dùng: ${userMessage}`
      : userMessage;

    // Interactions API stores requests by default; this stateless call opts out.
    const response = await requestGemini(
      GEMINI_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: GEMINI_MODELS[0],
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
    const response = await requestGemini(
      GEMINI_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: GEMINI_MODELS[0],
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
function getFallbackResponse(_message: string, language: ChatLanguage): string {
  return language === "en"
    ? "Sorry, the AI assistant is temporarily unavailable. Please try again shortly."
    : "Xin lỗi, AI hiện đang bận hoặc không khả dụng. Vui lòng thử lại sau ít phút.";
}
