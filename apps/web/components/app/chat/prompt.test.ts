// @vitest-environment node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildChatPrompt } from "./prompt";

const target = join(__dirname, "../../../convex/lib/chatPrompt.ts");
const render = (prompt: string) =>
  `// Generated from components/app/chat/prompt.ts by its test. Run UPDATE_CHAT_PROMPT=1 npx vitest run components/app/chat to refresh.\nexport const CHAT_PROMPT = ${JSON.stringify(prompt)};\n`;

describe("the chat prompt", () => {
  it("is generated from the component library and kept in Convex", () => {
    const prompt = buildChatPrompt();
    expect(prompt).toContain("Kpi(label: string, value: any, format?:");
    expect(prompt).toContain("- monthly_trend(");
    if (process.env.UPDATE_CHAT_PROMPT) writeFileSync(target, render(prompt));
    expect(readFileSync(target, "utf8")).toBe(render(prompt));
  });
});
