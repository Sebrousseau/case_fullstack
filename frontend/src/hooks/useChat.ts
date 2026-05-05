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
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (question: string) => {
    if (isLoading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const newTurn: ChatTurn = { question, blocks: [], done: false };
    setTurns((prev) => [...prev, newTurn]);
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
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
            continue;
          }

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
// Merge incremental deltas into blocks
// ---------------------------------------------------------------------------

function appendEvent(blocks: MessageBlock[], event: SSEEvent): MessageBlock[] {
  const updated = [...blocks];

  // Text delta — append to last text block or create new one
  if (event.type === "text" && event.content) {
    const last = updated[updated.length - 1];
    if (last?.kind === "text") {
      updated[updated.length - 1] = { kind: "text", content: last.content + event.content };
    } else {
      updated.push({ kind: "text", content: event.content });
    }
  }

  // Thinking delta — append to last thinking block or create new one
  if (event.type === "thinking" && event.content) {
    const last = updated[updated.length - 1];
    if (last?.kind === "thinking") {
      updated[updated.length - 1] = { kind: "thinking", content: last.content + event.content };
    } else {
      updated.push({ kind: "thinking", content: event.content });
    }
  }

  // Tool call — new block
  if (event.type === "tool_call" && event.tool && event.call_id) {
    updated.push({
      kind: "tool_call",
      tool: event.tool,
      args: event.args ?? {},
      call_id: event.call_id,
    });
  }

  // Tool result — new block
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
