"""
Data Analysis Agent — FastAPI Backend
Exposes a streaming SSE endpoint to interact with the PydanticAI agent.
"""

import json
import re
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_ai import (
    AgentRunResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ThinkingPartDelta,
)
from pydantic_ai.messages import ToolCallPart

load_dotenv()

from agent.agent import create_agent
from agent.context import AgentContext

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="Data Analysis Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

output_dir = Path("output")
output_dir.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")

# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------

def load_datasets(data_dir: str = "data") -> tuple[dict[str, pd.DataFrame], str]:
    data_path = Path(data_dir)
    if not data_path.exists():
        data_path.mkdir(parents=True, exist_ok=True)
        return {}, "No datasets available."

    datasets: dict[str, pd.DataFrame] = {}
    info_lines: list[str] = []

    for csv_file in sorted(data_path.glob("*.csv")):
        name = re.sub(r"[^a-zA-Z0-9_]", "_", csv_file.stem).strip("_").lower()
        df = pd.read_csv(csv_file)
        datasets[name] = df
        cols = ", ".join(df.columns.tolist())
        info_lines.append(
            f"- **{name}** ({df.shape[0]} rows, {df.shape[1]} columns)\n"
            f"  Columns: {cols}"
        )

    if not info_lines:
        return {}, "No datasets available."

    return datasets, "\n".join(info_lines)


datasets, dataset_info = load_datasets()
agent = create_agent(dataset_info)

# ---------------------------------------------------------------------------
# Request model
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    question: str

# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------

def sse(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, **data}, ensure_ascii=False)
    return f"data: {payload}\n\n"

# ---------------------------------------------------------------------------
# Thinking tag stream parser
#
# Parses <thinking>...</thinking> tags on-the-fly from a character stream.
# Yields ("thinking", chunk) or ("text", chunk) tuples as content arrives.
# ---------------------------------------------------------------------------

class ThinkingStreamParser:
    def __init__(self):
        self._buffer = ""
        self._in_thinking = False

    def feed(self, delta: str):
        """Feed a text delta, yield (type, chunk) tuples in real time."""
        results = []
        self._buffer += delta

        while self._buffer:
            if self._in_thinking:
                end = self._buffer.find("</thinking>")
                if end != -1:
                    if end > 0:
                        results.append(("thinking", self._buffer[:end]))
                    self._buffer = self._buffer[end + len("</thinking>"):]
                    self._in_thinking = False
                else:
                    # Keep last 11 chars buffered in case closing tag spans chunks
                    safe = len(self._buffer) - 11
                    if safe > 0:
                        results.append(("thinking", self._buffer[:safe]))
                        self._buffer = self._buffer[safe:]
                    break
            else:
                start = self._buffer.find("<thinking>")
                if start != -1:
                    if start > 0:
                        results.append(("text", self._buffer[:start]))
                    self._buffer = self._buffer[start + len("<thinking>"):]
                    self._in_thinking = True
                else:
                    # Keep last 10 chars buffered in case opening tag spans chunks
                    safe = len(self._buffer) - 10
                    if safe > 0:
                        results.append(("text", self._buffer[:safe]))
                        self._buffer = self._buffer[safe:]
                    break

        return results

    def flush(self):
        """Flush remaining buffer at end of stream."""
        results = []
        if self._buffer:
            kind = "thinking" if self._in_thinking else "text"
            results.append((kind, self._buffer))
            self._buffer = ""
        return results


# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(request: ChatRequest):
    async def generate():
        context = AgentContext(datasets=datasets, dataset_info=dataset_info)
        emitted_tool_calls: set[str] = set()
        emitted_tool_results: set[str] = set()

        try:
            parser = ThinkingStreamParser()

            async for event in agent.run_stream_events(request.question, deps=context):

                # Final result — flush parser and signal done
                if isinstance(event, AgentRunResultEvent):
                    for kind, chunk in parser.flush():
                        if chunk.strip():
                            yield sse(kind, {"content": chunk})
                    yield sse("done", {"content": ""})

                # Tool call (compat: emitted either as FunctionToolCallEvent
                # or as PartStartEvent with ToolCallPart depending on provider/version)
                elif isinstance(event, FunctionToolCallEvent):
                    call_id = event.part.tool_call_id
                    if call_id and call_id in emitted_tool_calls:
                        continue
                    try:
                        args = event.part.args_as_dict()
                    except Exception:
                        args = {}
                    # Some providers emit an early tool-call event with empty args,
                    # followed by a richer event. Skip the empty one to avoid
                    # rendering a blank duplicate and keep the detailed payload.
                    if not args:
                        continue
                    if call_id:
                        emitted_tool_calls.add(call_id)
                    yield sse("tool_call", {
                        "tool": event.part.tool_name,
                        "args": args,
                        "call_id": call_id,
                    })

                # Start of a new part (tool call, text block, etc.)
                elif isinstance(event, PartStartEvent):
                    part = event.part
                    if isinstance(part, ToolCallPart):
                        call_id = part.tool_call_id
                        if call_id and call_id in emitted_tool_calls:
                            continue
                        try:
                            args = part.args_as_dict()
                        except Exception:
                            args = {}
                        # Same guard as FunctionToolCallEvent: ignore early empty
                        # payloads so we keep only the detailed tool-call event.
                        if not args:
                            continue
                        if call_id:
                            emitted_tool_calls.add(call_id)
                        yield sse("tool_call", {
                            "tool": part.tool_name,
                            "args": args,
                            "call_id": call_id,
                        })

                # Text or thinking delta
                elif isinstance(event, PartDeltaEvent):
                    delta = event.delta

                    if isinstance(delta, TextPartDelta) and delta.content_delta:
                        for kind, chunk in parser.feed(delta.content_delta):
                            yield sse(kind, {"content": chunk})

                    elif isinstance(delta, ThinkingPartDelta) and delta.content_delta:
                        # Native thinking blocks (e.g. Claude extended thinking)
                        yield sse("thinking", {"content": delta.content_delta})

                # Tool result
                elif isinstance(event, FunctionToolResultEvent):
                    call_id = event.tool_call_id
                    if call_id and call_id in emitted_tool_results:
                        continue
                    content = str(event.result.content)
                    plotly_file = None
                    if "Saved to:" in content:
                        match = re.search(r"Saved to: (output/[^\s]+)", content)
                        if match:
                            plotly_file = match.group(1)

                    if call_id:
                        emitted_tool_results.add(call_id)
                    yield sse("tool_result", {
                        "call_id": call_id,
                        "content": content[:500],
                        "plotly_file": plotly_file,
                    })

        except Exception as e:
            from anyio import BrokenResourceError
            if isinstance(e, BrokenResourceError):
                return  # client déconnecté, on arrête silencieusement
            yield sse("error", {"content": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "datasets": list(datasets.keys())}
