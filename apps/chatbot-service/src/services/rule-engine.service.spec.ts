import { describe, expect, it } from "@jest/globals";
import {
  ConversationContext,
  processMessage,
} from "./rule-engine.service";

describe("chatbot rule engine conversation flow", () => {
  it("greets a new conversation and asks for purpose", () => {
    const response = processMessage("", null);

    expect(response.messageType).toBe("quick_reply");
    expect(response.newContext.step).toBe("ask_purpose");
  });

  it("extracts purpose and budget from one free-text message", () => {
    const response = processMessage(
      "Mình cần PC để học lập trình, chạy Docker, ngân sách khoảng 20 triệu",
      { step: "ask_purpose" }
    );

    expect(response.newContext).toMatchObject({
      step: "ask_preferences",
      purpose: "learning",
      budgetTier: "high",
      budgetMax: 25000000,
    });
    expect(response.content).not.toContain("Ngân sách dự kiến");
  });

  it("asks for budget when the user only gives a purpose", () => {
    const response = processMessage("học lập trình", { step: "ask_purpose" });

    expect(response.newContext.step).toBe("ask_budget");
    expect(response.newContext.purpose).toBe("learning");
  });

  it("parses a typed budget range", () => {
    const context: ConversationContext = {
      step: "ask_budget",
      purpose: "learning",
      purposeLabel: "Học tập / Lập trình",
    };
    const response = processMessage("10-15 triệu", context);

    expect(response.newContext).toMatchObject({
      step: "ask_preferences",
      budgetTier: "mid",
      budgetMin: 10000000,
      budgetMax: 15000000,
    });
  });

  it("uses quick-reply preference keys to generate a build", () => {
    const response = processMessage("gpu_priority", {
      step: "ask_preferences",
      purpose: "learning",
      purposeLabel: "Học tập / Lập trình",
      budgetMin: 15000000,
      budgetMax: 25000000,
      budgetLabel: "15 - 25 triệu",
      budgetTier: "high",
    });

    expect(response.messageType).toBe("config_suggestion");
    expect(response.newContext.step).toBe("follow_up");
    expect(response.newContext.preferences).toEqual(["gpu_priority"]);
  });

  it("keeps purpose and budget when requesting another configuration", () => {
    const context: ConversationContext = {
      step: "follow_up",
      purpose: "learning",
      purposeLabel: "Học tập / Lập trình",
      budgetMin: 15000000,
      budgetMax: 25000000,
      budgetLabel: "15 - 25 triệu",
      budgetTier: "high",
      suggestedBuildName: "Student / Developer PC",
    };
    const response = processMessage("Cấu hình khác", context);

    expect(response.metadata?.action).toBe("alternative_config");
    expect(response.newContext).toMatchObject({
      step: "follow_up",
      purpose: "learning",
      budgetTier: "high",
    });
  });

  it("only resets when the user explicitly asks to restart", () => {
    const response = processMessage("Bắt đầu lại", {
      step: "follow_up",
      purpose: "learning",
      budgetTier: "high",
    });

    expect(response.newContext.step).toBe("ask_purpose");
    expect(response.newContext.purpose).toBeUndefined();
  });

  it("routes component changes to AI without dropping context", () => {
    const response = processMessage("Thay đổi linh kiện", {
      step: "follow_up",
      purpose: "learning",
      budgetTier: "high",
    });

    expect(response.needsAI).toBe(true);
    expect(response.newContext).toMatchObject({
      step: "free_chat",
      purpose: "learning",
      budgetTier: "high",
    });
  });
});