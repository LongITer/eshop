import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import prisma from "../../../../packages/libs/prisma";
import { chat } from "./chatbot.controller";
import {
  findMatchingProducts,
  findBuildTemplates,
  getTemplateProducts,
  findShopProductsForAI,
} from "../services/product-matcher.service";
import { getAIResponse } from "../services/ai.service";

jest.mock("@packages/libs/prisma", () => ({
  __esModule: true,
  default: {
    chatbotConversation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatbotMessage: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../services/product-matcher.service", () => ({
  findBuildTemplates: jest.fn(),
  getTemplateProducts: jest.fn(),
  findMatchingProducts: jest.fn(),
  findShopProductsForAI: jest.fn(),
}));

jest.mock("../services/ai.service", () => ({
  getAIResponse: jest.fn(),
  localizeChatResponse: jest.fn(async (content: string, metadata: any) => ({
    content,
    metadata,
  })),
}));

describe("chat controller alternative configuration", () => {
  const database = prisma as any;
  const findTemplatesMock = findBuildTemplates as unknown as {
    mockResolvedValue: (value: any) => void;
  };
  const getProductsMock = getTemplateProducts as unknown as {
    mockResolvedValue: (value: any) => void;
  };
  const findProductsMock = findMatchingProducts as unknown as {
    mockResolvedValue: (value: any) => void;
  };
  const shopProductsMock = findShopProductsForAI as unknown as {
    mockResolvedValue: (value: any) => void;
  };
  const aiResponseMock = getAIResponse as unknown as {
    mockResolvedValue: (value: any) => void;
  };
  const sessionId = "0123456789abcdef0123456789abcdef";
  let conversationContext: Record<string, unknown>;
  let responseBody: any;
  let res: any;

  beforeEach(() => {
    jest.clearAllMocks();
    shopProductsMock.mockResolvedValue([]);
    conversationContext = {
      step: "follow_up",
      purpose: "learning",
      purposeLabel: "Học tập / Lập trình",
      budgetMin: 15000000,
      budgetMax: 25000000,
      budgetLabel: "15 - 25 triệu",
      budgetTier: "high",
      suggestedBuildName: "Student / Developer PC",
    };
    database.chatbotConversation.findUnique.mockResolvedValue({
      id: "conversation-1",
      sessionId,
      userId: null,
      context: conversationContext,
      messages: [],
    });
    database.chatbotConversation.update.mockResolvedValue({});
    database.chatbotMessage.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: `${data.role}-message`, createdAt: new Date() })
    );
    responseBody = undefined;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((body) => {
        responseBody = body;
        return res;
      }),
    };
  });

  const sendMessage = async (
    message = "Cấu hình khác",
    language: "vi" | "en" = "vi"
  ) => {
    await chat(
      {
        body: {
          conversationId: "conversation-1",
          sessionId,
          message,
          language,
        },
      } as any,
      res,
      jest.fn()
    );
  };

  it("returns another matching template and updates the active context", async () => {
    findTemplatesMock.mockResolvedValue([
      {
        id: "template-current",
        name: "Student / Developer PC",
        budgetMin: 15000000,
        budgetMax: 25000000,
        productIds: ["product-current"],
        components: { cpu: "Current CPU" },
      },
      {
        id: "template-alternative",
        name: "Developer Performance PC",
        budgetMin: 18000000,
        budgetMax: 25000000,
        productIds: ["product-alternative"],
        components: { cpu: "Alternative CPU", ram: "32GB" },
      },
    ] as any);
    getProductsMock.mockResolvedValue([
      {
        id: "product-alternative",
        title: "Alternative CPU",
        slug: "alternative-cpu",
        sale_price: 5000000,
        regular_price: 5500000,
        stock: 3,
        rating: 5,
        image: null,
        shopName: "Eshop",
        shopId: "shop-1",
        brand: "Example",
      },
    ] as any);

    await sendMessage();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(responseBody.message.content).toContain("Developer Performance PC");
    expect(responseBody.message.metadata.templateId).toBe("template-alternative");
    expect(database.chatbotConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          context: expect.objectContaining({
            purpose: "learning",
            budgetTier: "high",
            suggestedTemplateId: "template-alternative",
          }),
        },
      })
    );
  });

  it("keeps the current context when there is no second template", async () => {
    findTemplatesMock.mockResolvedValue([
      {
        id: "template-current",
        name: "Student / Developer PC",
        budgetMin: 15000000,
        budgetMax: 25000000,
        productIds: ["product-current"],
        components: { cpu: "Current CPU" },
      },
    ] as any);

    await sendMessage();

    expect(responseBody.message.content).toContain("chưa có cấu hình mẫu khác");
    expect(database.chatbotConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          context: expect.objectContaining({
            step: "follow_up",
            purpose: "learning",
            budgetTier: "high",
          }),
        },
      })
    );
  });

  it("sends free-form follow-up questions to the AI service", async () => {
    conversationContext = {
      ...conversationContext,
      step: "free_chat",
    };
    database.chatbotConversation.findUnique.mockResolvedValue({
      id: "conversation-1",
      sessionId,
      userId: null,
      context: conversationContext,
      messages: [],
    });
    findProductsMock.mockResolvedValue([]);
    aiResponseMock.mockResolvedValue({ content: "AI response for test" });

    await sendMessage("CPU này có phù hợp với nhu cầu của tôi không?", "en");

    expect(aiResponseMock).toHaveBeenCalledWith(
      "CPU này có phù hợp với nhu cầu của tôi không?",
      [],
      [],
      "en"
    );
    expect(responseBody.message.content).toContain("AI response for test");
  });

  it("uses only the AI response when the rule engine cannot classify the request", async () => {
    conversationContext = { step: "ask_purpose" };
    database.chatbotConversation.findUnique.mockResolvedValue({
      id: "conversation-1",
      sessionId,
      userId: null,
      context: conversationContext,
      messages: [],
    });
    aiResponseMock.mockResolvedValue({
      content: "Có, CPU Ryzen 5 7600 và mainboard B650 đều dùng socket AM5.",
    });

    await sendMessage(
      "Tôi có CPU AMD Ryzen 5 7600 và main ASUS PRIME B650M-A WIFI. Hai linh kiện này có lắp chung được không?"
    );

    expect(aiResponseMock).toHaveBeenCalledWith(
      "Tôi có CPU AMD Ryzen 5 7600 và main ASUS PRIME B650M-A WIFI. Hai linh kiện này có lắp chung được không?",
      [],
      [],
      "vi"
    );
    expect(responseBody.message.content).toBe(
      "Có, CPU Ryzen 5 7600 và mainboard B650 đều dùng socket AM5."
    );
    expect(responseBody.message.messageType).toBe("text");
    expect(responseBody.message.metadata).toBeNull();
  });

  it("provides in-stock CPU products to AI for shop ranking questions", async () => {
    conversationContext = { step: "ask_budget", purpose: "gaming" };
    database.chatbotConversation.findUnique.mockResolvedValue({
      id: "conversation-1",
      sessionId,
      userId: null,
      context: conversationContext,
      messages: [],
    });
    const shopProducts = [
      {
        id: "cpu-1",
        title: "AMD Ryzen 7 Example",
        sale_price: 9000000,
        stock: 4,
      },
    ];
    shopProductsMock.mockResolvedValue(shopProducts);
    aiResponseMock.mockResolvedValue({ content: "CPU mạnh nhất là AMD Ryzen 7 Example." });

    await sendMessage("CPU nào của shop mạnh nhất cho gaming");

    expect(shopProductsMock).toHaveBeenCalledWith(
      "CPU nào của shop mạnh nhất cho gaming"
    );
    expect(aiResponseMock).toHaveBeenCalledWith(
      "CPU nào của shop mạnh nhất cho gaming",
      [],
      shopProducts,
      "vi"
    );
    expect(responseBody.message.content).toBe(
      "CPU mạnh nhất là AMD Ryzen 7 Example."
    );
  });
});