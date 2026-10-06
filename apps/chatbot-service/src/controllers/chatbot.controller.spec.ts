import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import prisma from "@packages/libs/prisma";
import { chat, createConversation } from "./chatbot.controller";
import { getAIResponse } from "../services/ai.service";

jest.mock("@packages/libs/prisma", () => ({
  __esModule: true,
  default: {
    products: { findMany: jest.fn() },
    chatbotConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    chatbotMessage: { create: jest.fn() },
  },
}));

jest.mock("../services/ai.service", () => ({
  getAIResponse: jest.fn(),
}));

describe("chatbot controller Gemini flow", () => {
  const database = prisma as any;
  const aiMock = getAIResponse as jest.MockedFunction<typeof getAIResponse>;
  const sessionId = "0123456789abcdef0123456789abcdef";
  let responseBody: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    database.products.findMany.mockResolvedValue([]);
    database.chatbotConversation.findUnique.mockResolvedValue({
      id: "conversation-1",
      sessionId,
      userId: null,
      messages: [],
    });
    database.chatbotConversation.create.mockResolvedValue({
      id: "conversation-1",
      sessionId,
    });
    database.chatbotMessage.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...data, id: `${data.role}-message`, createdAt: new Date() })
    );
    aiMock.mockResolvedValue({ content: "Gemini response" });
    responseBody = undefined;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((body) => {
        responseBody = body;
        return res;
      }),
    };
  });

  it("sends every user message directly to Gemini with product context", async () => {
    await chat(
      {
        body: {
          conversationId: "conversation-1",
          sessionId,
          message: "Tư vấn CPU cho gaming",
          language: "vi",
        },
      } as any,
      res,
      jest.fn()
    );

    expect(aiMock).toHaveBeenCalledWith(
      "Tư vấn CPU cho gaming",
      [],
      [],
      "vi"
    );
    expect(responseBody.message.content).toBe("Gemini response");
    expect(responseBody.message.messageType).toBe("text");
  });

  it("uses Gemini for the initial conversation greeting", async () => {
    await createConversation(
      { body: { language: "en", sessionId } } as any,
      res,
      jest.fn()
    );

    expect(aiMock).toHaveBeenCalledWith(
      expect.stringContaining("chào người dùng"),
      [],
      [],
      "en"
    );
    expect(responseBody.message.content).toBe("Gemini response");
  });
  it("does not persist provider errors as assistant messages", async () => {
    aiMock.mockResolvedValue({ content: "Temporarily unavailable", error: "Gemini API error: 429" });
    await chat({ body: { conversationId: "conversation-1", sessionId, message: "gaming" } } as any, res, jest.fn());
    expect(database.chatbotMessage.create).toHaveBeenCalledTimes(1);
    expect(database.chatbotMessage.create.mock.calls[0][0].data.role).toBe("user");
    expect(responseBody.message.metadata).toEqual({ aiUnavailable: true });
  });
  it("greets the user even if the provider is unavailable", async () => {
    aiMock.mockResolvedValue({ content: "Temporarily unavailable", error: "quota" });
    await createConversation({ body: { language: "vi", sessionId } } as any, res, jest.fn());
    expect(responseBody.message.content).toContain("ngân sách");
    expect(responseBody.message.content).not.toContain("unavailable");
  });

});
