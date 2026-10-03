import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { getAIResponse } from "./ai.service";

describe("AI service responses", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalApiKey;
    }
    global.fetch = originalFetch;
  });

  it("uses a generic fallback when Gemini is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await getAIResponse(
      "Tôi có CPU Intel Core i5-13400F và main ASUS PRIME B650M-A WIFI. Hai linh kiện này có lắp chung được không? Hãy giải thích dựa trên socket và đề xuất loại mainboard phù hợp.",
      []
    );

    expect(result.error).toBe("GEMINI_API_KEY not configured");
    expect(result.content).toContain("chưa thể xác minh");
    expect(result.content).not.toContain("i5-13400F");
  });

  it("sends an unlisted hardware compatibility question to Gemini", async () => {
    const userMessage =
      "Ryzen 7 9800X3D có tương thích với main MSI MAG X870E TOMAHAWK WIFI không?";
    const geminiAnswer = "Có, hai linh kiện dùng socket AM5 và tương thích.";
    process.env.GEMINI_API_KEY = "test-api-key";
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        steps: [
          {
            type: "model_output",
            status: "done",
            content: [{ type: "text", text: geminiAnswer }],
          },
        ],
      }),
    } as Response);
    global.fetch = fetchMock;

    const result = await getAIResponse(userMessage, []);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://generativelanguage.googleapis.com/v1beta/interactions"
    );
    const request = fetchMock.mock.calls[0][1];
    expect(request?.headers).toMatchObject({
      "x-goog-api-key": "test-api-key",
    });
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "gemini-3.8-flash",
      input: userMessage,
      system_instruction: expect.any(String),
      generation_config: {
        temperature: 0.7,
        top_p: 0.9,
        max_output_tokens: 1024,
      },
      store: false,
    });
    expect(result).toEqual({ content: geminiAnswer });
  });
});