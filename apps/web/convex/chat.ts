import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { type ActionCtx, action, internalMutation, mutation, query } from "./_generated/server";
import { currentOrg, requireOrg } from "./lib/auth";
import { CHAT_PROMPT } from "./lib/chatPrompt";
import { CHAT_TOOLS, functionTools, toolNamed } from "./lib/chatSpec";
import { EngineError, engineStream } from "./lib/engine";

/**
 * The global chat. Threads are private to one person in one organisation. A turn: save the question, then run
 * the model with the chat tools until it stops calling them, streaming its words to the browser as they come,
 * and save the answer. Tools run as the signed-in person, so they only ever see that organisation's figures.
 */

const MAX_ROUNDS = 5;
const HISTORY = 16;

export const threads = query({
  args: {},
  handler: async (ctx) => {
    const found = await currentOrg(ctx);
    if (!found) return [];
    return (
      await ctx.db
        .query("chatThreads")
        .withIndex("by_org_user", (q) => q.eq("orgId", found.org._id).eq("userId", found.who.userId))
        .order("desc")
        .take(30)
    ).map((t) => ({ id: t._id, title: t.title, updatedAt: t.updatedAt }));
  },
});

export const messages = query({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, { threadId }) => {
    const found = await currentOrg(ctx);
    const thread = await ctx.db.get(threadId);
    if (!found || !thread || thread.orgId !== found.org._id || thread.userId !== found.who.userId) return [];
    return (
      await ctx.db
        .query("chatMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", threadId))
        .collect()
    ).map((m) => ({ id: m._id, role: m.role, content: m.content, status: m.status, tools: m.tools ?? [], createdAt: m.createdAt }));
  },
});

export const removeThread = mutation({
  args: { threadId: v.id("chatThreads") },
  handler: async (ctx, { threadId }) => {
    const { org, who } = await requireOrg(ctx);
    const thread = await ctx.db.get(threadId);
    if (!thread || thread.orgId !== org._id || thread.userId !== who.userId) return;
    const rows = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    await ctx.db.delete(threadId);
  },
});

const title = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t;
};

/** Save the question and an empty answer to stream into; return the history the model sees. */
export const begin = internalMutation({
  args: { threadId: v.optional(v.id("chatThreads")), text: v.string(), page: v.optional(v.string()) },
  handler: async (ctx, { threadId, text, page }) => {
    const { org, who } = await requireOrg(ctx);
    const now = Date.now();
    let id = threadId;
    if (id) {
      const thread = await ctx.db.get(id);
      if (!thread || thread.orgId !== org._id || thread.userId !== who.userId) throw new ConvexError("Conversation not found.");
      await ctx.db.patch(id, { updatedAt: now });
    } else {
      id = await ctx.db.insert("chatThreads", { orgId: org._id, userId: who.userId, title: title(text), createdAt: now, updatedAt: now });
    }
    const earlier = await ctx.db
      .query("chatMessages")
      .withIndex("by_thread", (q) => q.eq("threadId", id))
      .order("desc")
      .take(HISTORY);
    await ctx.db.insert("chatMessages", { threadId: id, role: "user", content: text, status: "done", page, createdAt: now });
    const answerId = await ctx.db.insert("chatMessages", { threadId: id, role: "assistant", content: "", status: "streaming", createdAt: now + 1 });
    await ctx.db.insert("aiUsage", { orgId: org._id, action: "chat", by: who.name, at: now });
    return {
      threadId: id,
      answerId,
      company: org.name,
      asOf: org.asOf ?? null,
      who: who.name,
      history: earlier
        .reverse()
        .filter((m) => m.status === "done" && m.content)
        .map((m) => ({ role: m.role, content: m.content })),
    };
  },
});

export const finish = internalMutation({
  args: { answerId: v.id("chatMessages"), content: v.string(), status: v.union(v.literal("done"), v.literal("error")), tools: v.array(v.string()) },
  handler: async (ctx, { answerId, content, status, tools }) => {
    await ctx.db.patch(answerId, { content, status, tools });
  },
});

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type ModelMessage = { role: "system" | "user" | "assistant" | "tool"; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };
export type ChatEvent =
  | { type: "thread"; threadId: Id<"chatThreads">; answerId: Id<"chatMessages"> }
  | { type: "status"; tool: string; label: string }
  | { type: "round" }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Run one tool as the signed-in person, returning compact JSON for the model. */
async function runTool(ctx: ActionCtx, name: string, rawArgs: string) {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return JSON.stringify({ error: "The arguments weren't valid JSON." });
  }
  const tools = api.chatTools as unknown as Record<string, Parameters<typeof ctx.runQuery>[0]>;
  if (!toolNamed(name) || !tools[name]) return JSON.stringify({ error: `There is no tool called ${name}.` });
  try {
    const result = await ctx.runQuery(tools[name], args as never);
    const text = JSON.stringify(result);
    return text.length > 9000 ? `${text.slice(0, 9000)}…(truncated)` : text;
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message.slice(0, 200) : "The tool failed." });
  }
}

/** Read one streamed model turn: forward words as they arrive, collect any tool calls. */
async function readTurn(response: Response, onText: (text: string) => Promise<void>) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const calls: ToolCall[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      let chunk: { error?: { detail?: string; message?: string }; choices?: { delta?: { content?: string | null; tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[] };
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      if (chunk.error) throw new Error(chunk.error.detail ?? chunk.error.message ?? "The model failed.");
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        await onText(delta.content);
      }
      for (const t of delta.tool_calls ?? []) {
        const call = (calls[t.index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        if (t.id) call.id = t.id;
        if (t.function?.name) call.function.name += t.function.name;
        if (t.function?.arguments) call.function.arguments += t.function.arguments;
      }
    }
  }
  return { content, calls: calls.filter(Boolean) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * One chat turn, streamed as server-sent events: thread, status (a tool is running), round (earlier words were
 * the model thinking aloud; start the answer again), delta (more words), done or error.
 */
export async function chatTurn(ctx: ActionCtx, input: { threadId?: Id<"chatThreads">; text: string; page?: string; pageTitle?: string }, emit: (event: ChatEvent) => Promise<void>): Promise<{ threadId: Id<"chatThreads">; answer: string; tools: string[] }> {
  const turn = await ctx.runMutation(internal.chat.begin, { threadId: input.threadId, text: input.text, page: input.page });
  await emit({ type: "thread", threadId: turn.threadId, answerId: turn.answerId });
  const today = new Date();
  const context = [
    `Company: ${turn.company}. You're talking with ${turn.who}.`,
    `Today is ${today.getUTCDate()} ${MONTHS[today.getUTCMonth()]} ${today.getUTCFullYear()}.${turn.asOf ? ` The latest month in the books is ${MONTHS[Number(turn.asOf.slice(5, 7)) - 1]} ${turn.asOf.slice(0, 4)}.` : " There are no figures yet."}`,
    input.page ? `They are looking at the ${input.pageTitle ?? input.page} page (${input.page}).` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const messages: ModelMessage[] = [
    { role: "system", content: CHAT_PROMPT },
    { role: "system", content: context },
    ...turn.history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: input.text },
  ];
  const used: string[] = [];
  let answer = "";
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const last = round === MAX_ROUNDS - 1;
      const response = await engineStream("/chat/complete", { messages, tools: last ? [] : functionTools(), max_tokens: 3000 });
      if (round > 0) await emit({ type: "round" });
      answer = "";
      const { content, calls } = await readTurn(response, async (text) => {
        answer += text;
        await emit({ type: "delta", text });
      });
      if (!calls.length) break;
      messages.push({ role: "assistant", content: content || null, tool_calls: calls.map((c, i) => ({ ...c, id: c.id || `call_${round}_${i}` })) });
      for (const [i, call] of calls.entries()) {
        const tool = CHAT_TOOLS.find((t) => t.name === call.function.name);
        await emit({ type: "status", tool: call.function.name, label: tool?.status ?? "Reading the books" });
        used.push(call.function.name);
        messages.push({ role: "tool", tool_call_id: call.id || `call_${round}_${i}`, content: await runTool(ctx, call.function.name, call.function.arguments) });
      }
    }
    if (!answer.trim()) answer = "I couldn't put an answer together that time. Try asking again, perhaps more specifically.";
    await ctx.runMutation(internal.chat.finish, { answerId: turn.answerId, content: answer, status: "done", tools: [...new Set(used)] });
    await emit({ type: "done" });
    return { threadId: turn.threadId, answer, tools: [...new Set(used)] };
  } catch (err) {
    const message = err instanceof EngineError ? (err.status === 503 ? "Chat isn't set up on the server yet." : "The AI service didn't answer. Try again in a moment.") : "Something went wrong mid-answer. Try again.";
    console.error("chat turn failed", err instanceof EngineError ? `${err.status} ${JSON.stringify(err.body).slice(0, 300)}` : err);
    await ctx.runMutation(internal.chat.finish, { answerId: turn.answerId, content: answer || message, status: "error", tools: [...new Set(used)] });
    await emit({ type: "error", message });
    return { threadId: turn.threadId, answer: message, tools: [...new Set(used)] };
  }
}

/** A whole turn without streaming (the command line, and a fallback where streaming is blocked). */
export const turn = action({
  args: { text: v.string(), page: v.optional(v.string()), threadId: v.optional(v.id("chatThreads")) },
  handler: async (ctx, args): Promise<{ threadId: Id<"chatThreads">; answer: string; tools: string[]; statuses: string[] }> => {
    const statuses: string[] = [];
    const out = await chatTurn(ctx, args, async (e) => {
      if (e.type === "status") statuses.push(e.label);
    });
    return { ...out, statuses };
  },
});
