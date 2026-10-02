export default {
  displayName: "chatbot-service",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  transform: {
    "^.+\\.[tj]s$": ["ts-jest", { tsconfig: "apps/chatbot-service/tsconfig.spec.json" }],
  },
  moduleNameMapper: {
    "^@packages/(.*)$": "<rootDir>/../../packages/$1",
  },
  moduleFileExtensions: ["ts", "js", "html"],
};