import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { getAIResponse } from "./ai.service";

describe("AI service responses", () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalFetch = global.fetch;
  let testSequence = 0;

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
    expect(result.content).toContain("không khả dụng");
    expect(result.content).not.toContain("i5-13400F");
  });

  it("retries an overloaded provider and returns its answer", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("overloaded", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        steps: [{ type: "model_output", content: [{ type: "text", text: "AI answer" }] }],
      }), { status: 200 }));
    global.fetch = fetchMock;
    expect(await getAIResponse("Compare two CPUs", [])).toEqual({ content: "AI answer" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bounds retries and reports unavailability instead of canned CPU advice", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = jest.fn<typeof fetch>().mockImplementation(async () =>
      new Response("overloaded", { status: 503 }));
    global.fetch = fetchMock;
    try {
      const result = await getAIResponse("CPU nào tốt?", []);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.error).toBe("Gemini API error: 503");
      expect(result.content).toContain("không khả dụng");
      expect(result.content).not.toContain("i5-12400F");
    } finally { log.mockRestore(); }
  });

  it("switches to the lite model after the primary model stays overloaded", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const fetchMock = jest.fn<typeof fetch>()

      .mockImplementationOnce(async () => new Response("overloaded", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        steps: [{ type: "model_output", content: [{ type: "text", text: "Lite answer" }] }],
      }), { status: 200 }));
    global.fetch = fetchMock;
    expect(await getAIResponse("Build a quiet PC", [])).toEqual({ content: "Lite answer" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).model).toBe("gemini-3.8-flash");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).model).toBe("gemini-3.5-flash-lite");
  });

  it("does not retry invalid credentials", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response("denied", { status: 403 }));
    global.fetch = fetchMock;
    try {
      expect((await getAIResponse("CPU?", [])).error).toBe("Gemini API error: 403");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });

  it("sends an unlisted hardware compatibility question to Gemini", async () => {
    const userMessage =
      "Ryzen 7 9800X3D có tương thích với main MSI MAG X870E TOMAHAWK WIFI không?";
    const geminiAnswer = "Có, hai linh kiện dùng socket AM5 và tương thích.";
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
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
      "x-goog-api-key": process.env.GEMINI_API_KEY,
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
  it("skips exhausted quota until Retry-After expires", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const clock = jest.spyOn(Date, "now").mockReturnValue(100000);
    const answer = () => new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "Lite answer" }] }] }));
    const fetchMock = jest.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("daily quota", { status: 429, headers: { "Retry-After": "3600" } }))
      .mockImplementation(async () => answer());
    global.fetch = fetchMock;
    try {
      expect((await getAIResponse("gaming", [])).error).toBeUndefined();
      expect((await getAIResponse("20 million", [])).error).toBeUndefined();
      expect(fetchMock.mock.calls.map(call => JSON.parse(String(call[1]?.body)).model)).toEqual([
        "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash-lite",
      ]);
      clock.mockReturnValue(3700001);
      await getAIResponse("try again", []);
      expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).model).toBe("gemini-3.8-flash");
    } finally { clock.mockRestore(); }
  });

  it("switches models on a timeout instead of returning an error immediately", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const fetchMock = jest.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "Recovered" }] }] })));
    global.fetch = fetchMock;
    expect(await getAIResponse("chơi game, 20 triệu", [])).toEqual({ content: "Recovered" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not send old fallback errors back to Gemini as assistant answers", async () => {
    process.env.GEMINI_API_KEY = `test-api-key-${++testSequence}`;
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: "Recovered" }] }] })));
    global.fetch = fetchMock;
    await getAIResponse("chơi game, 20 triệu", [{ role: "bot", content: "Xin lỗi, AI hiện đang bận hoặc không khả dụng. Vui lòng thử lại sau ít phút." }]);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).input).toBe("chơi game, 20 triệu");
  });

});
