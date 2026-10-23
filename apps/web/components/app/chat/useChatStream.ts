"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";

const siteUrl = () => process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? (process.env.NEXT_PUBLIC_CONVEX_URL ?? "").replace(/\.convex\.cloud\/?$/, ".convex.site");

export type Live = {
  question: string;
  startedAt: number;
  threadId: Id<"chatThreads"> | null;
  answerId: Id<"chatMessages"> | null;
  content: string;
  steps: { tool: string; label: string; detail?: string }[];
  phase: "thinking" | "reading" | "writing" | "done" | "error";
  /** How long it read before it started writing. */
  thoughtMs?: number;
  error?: string;
};

/**
 * Send a question and stream the answer: the chat endpoint replies with server-sent events (thread, status for
 * each tool it reads, round when it starts over after reading, delta for words, then done or error).
 */
export function useChatStream(onThread: (id: Id<"chatThreads">) => void) {
  const { getToken } = useAuth();
  const [live, setLive] = useState<Live | null>(null);
  const abort = useRef<AbortController | null>(null);

  const send = useCallback(
    async (question: string, threadId: Id<"chatThreads"> | null, page: { path: string; title: string }, sources: string[] = []) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const state: Live = { question, startedAt: Date.now(), threadId, answerId: null, content: "", steps: [], phase: "thinking" };
      setLive({ ...state });
      const update = (patch: Partial<Live>) => {
        Object.assign(state, patch);
        setLive({ ...state, steps: [...state.steps] });
      };
      try {
        const token = await getToken({ template: "convex" });
        const response = await fetch(`${siteUrl()}/chat`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: question, threadId, page: page.path, pageTitle: page.title, sources }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "The assistant didn't answer. Try again.");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // Words arrive in bursts; release them on animation frames so the text flows rather than jumps.
        let pending = "";
        let raf = 0;
        const flush = () => {
          raf = 0;
          if (!pending) return;
          const take = Math.max(1, Math.ceil(pending.length / 4));
          state.content += pending.slice(0, take);
          pending = pending.slice(take);
          update({});
          if (pending) raf = requestAnimationFrame(flush);
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, cut).replace(/^data:\s?/, "");
            buffer = buffer.slice(cut + 2);
            let event: { type: string; [k: string]: unknown };
            try {
              event = JSON.parse(frame);
            } catch {
              continue;
            }
            if (event.type === "thread") {
              update({ threadId: event.threadId as Id<"chatThreads">, answerId: event.answerId as Id<"chatMessages"> });
              onThread(event.threadId as Id<"chatThreads">);
            } else if (event.type === "status") {
              state.steps.push({ tool: String(event.tool), label: String(event.label), detail: typeof event.detail === "string" ? event.detail : undefined });
              update({ phase: "reading" });
            } else if (event.type === "round") {
              pending = "";
              update({ content: "", phase: "reading" });
            } else if (event.type === "delta") {
              pending += String(event.text);
              if (state.phase !== "writing") update({ phase: "writing", thoughtMs: state.thoughtMs ?? Date.now() - state.startedAt });
              if (!raf) raf = requestAnimationFrame(flush);
            } else if (event.type === "error") {
              update({ phase: "error", error: String(event.message) });
            }
          }
        }
        // Let the last words land before calling it done.
        await new Promise<void>((resolve) => {
          const settle = () => (pending ? requestAnimationFrame(settle) : resolve());
          settle();
        });
        if (state.phase !== "error") update({ phase: "done" });
      } catch (err) {
        if (controller.signal.aborted) {
          update({ phase: "done" });
          return;
        }
        update({ phase: "error", error: err instanceof Error ? err.message : "The assistant didn't answer. Try again." });
      }
    },
    [getToken, onThread],
  );

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    setLive(null);
  }, []);
  return { live, send, stop, reset };
}
