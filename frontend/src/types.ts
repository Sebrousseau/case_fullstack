export type SSEEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "text"
  | "done"
  | "error";

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  call_id?: string;
  plotly_file?: string | null;
}

// A single "block" rendered in the UI
export type MessageBlock =
  | { kind: "thinking"; content: string }
  | { kind: "tool_call"; tool: string; args: Record<string, unknown>; call_id: string }
  | { kind: "tool_result"; call_id: string; content: string; plotly_file?: string | null }
  | { kind: "text"; content: string };
