/**
 * useChat — core hook for streaming chat interactions.
 *
 * Manages the full lifecycle of a conversation turn:
 *   1. Sends the user's question to the backend SSE endpoint.
 *   2. Reads the response stream chunk by chunk using the Streams API.
 *   3. Parses SSE lines and dispatches each event to `appendEvent`, which
 *      accumulates incremental deltas into a flat list of typed MessageBlocks.
 *   4. Exposes `setTurns` so the parent can restore a previous conversation
 *      from history without re-fetching from the server.
 *
 * Concurrency: only one request can be in-flight at a time. Sending a new
 * message while one is pending aborts the previous request via AbortController.
 */

import { useState, useCallback, useRef } from "react";
import type { MessageBlock, SSEEvent } from "../types";

export interface ChatTurn {
  question: string;
  blocks: MessageBlock[];
  done: boolean;
  error?: string;
}

export function useChat() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Holds the AbortController for the current in-flight request so it can be
  // cancelled if the user sends a new message before the previous one completes.
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (question: string) => {
    if (isLoading) return;

    // Cancel any pending request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const newTurn: ChatTurn = { question, blocks: [], done: false };
    setTurns((prev) => [...prev, newTurn]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      // Incomplete lines are held in `buffer` across read() calls because a
      // single chunk from the network may contain partial SSE lines.
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Split on newlines but keep the last (potentially incomplete) segment
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: SSEEvent;
          try {
            event = JSON.parse(raw);
          } catch {
            // Malformed JSON — skip silently rather than crashing the stream
            continue;
          }

          // Always update the last turn in the array (the one currently streaming)
          setTurns((prev) => {
            const updated = [...prev];
            const turn = { ...updated[updated.length - 1] };
            turn.blocks = appendEvent(turn.blocks, event);
            if (event.type === "done") turn.done = true;
            if (event.type === "error") {
              turn.error = event.content;
              turn.done = true;
            }
            updated[updated.length - 1] = turn;
            return updated;
          });
        }
      }
    } catch (err: unknown) {
      // AbortError is expected when the user sends a new message — ignore it
      if (err instanceof Error && err.name === "AbortError") return;
      setTurns((prev) => {
        const updated = [...prev];
        const turn = { ...updated[updated.length - 1] };
        turn.error = String(err);
        turn.done = true;
        updated[updated.length - 1] = turn;
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  return { turns, isLoading, sendMessage, setTurns };
}

// ---------------------------------------------------------------------------
// Delta accumulator
// ---------------------------------------------------------------------------

/**
 * Merge an incoming SSE event into the current list of MessageBlocks.
 *
 * Text and thinking events are streamed as incremental deltas, so consecutive
 * events of the same kind are merged into the last block rather than creating
 * a new one each time. This prevents the UI from re-rendering a new component
 * on every token and keeps the block list stable during streaming.
 *
 * Tool calls and tool results are always appended as new blocks since they
 * represent discrete steps and are never split across multiple events.
 */
function appendEvent(blocks: MessageBlock[], event: SSEEvent): MessageBlock[] {
  const updated = [...blocks];

  if (event.type === "text" && event.content) {
    const last = updated[updated.length - 1];
    if (last?.kind === "text") {
      // Merge delta into the existing text block
      updated[updated.length - 1] = { kind: "text", content: last.content + event.content };
    } else {
      updated.push({ kind: "text", content: event.content });
    }
  }

  if (event.type === "thinking" && event.content) {
    const last = updated[updated.length - 1];
    if (last?.kind === "thinking") {
      // Merge delta into the existing thinking block
      updated[updated.length - 1] = { kind: "thinking", content: last.content + event.content };
    } else {
      updated.push({ kind: "thinking", content: event.content });
    }
  }

  if (event.type === "tool_call" && event.tool && event.call_id) {
    updated.push({
      kind: "tool_call",
      tool: event.tool,
      args: event.args ?? {},
      call_id: event.call_id,
    });
  }

  if (event.type === "tool_result" && event.call_id) {
    updated.push({
      kind: "tool_result",
      call_id: event.call_id,
      content: event.content ?? "",
      plotly_file: event.plotly_file,
    });
  }

  return updated;
}
