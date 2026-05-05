"""
Data Analysis Agent — FastAPI Backend
Exposes a streaming SSE endpoint to interact with the PydanticAI agent.
"""

import asyncio
import json
import os
import re
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)

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

# Serve generated Plotly HTML files
output_dir = Path("output")
output_dir.mkdir(exist_ok=True)
app.mount("/output", StaticFiles(directory="output"), name="output")

# ---------------------------------------------------------------------------
# Dataset loading (same logic as main.py)
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
        return {}, "No datasets available. Add CSV files to the data/ directory."

    return datasets, "\n".join(info_lines)


datasets, dataset_info = load_datasets()
agent = create_agent(dataset_info)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    history: list[ChatMessage] = []

# ---------------------------------------------------------------------------
# SSE helpers
# ---------------------------------------------------------------------------

def sse_event(event_type: str, data: dict) -> str:
    payload = json.dumps({"type": event_type, **data}, ensure_ascii=False)
    return f"data: {payload}\n\n"

# ---------------------------------------------------------------------------
# Streaming endpoint
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(request: ChatRequest):
    async def generate():
        context = AgentContext(datasets=datasets, dataset_info=dataset_info)

        try:
            async with agent.run_stream(
                request.question,
                deps=context,
            ) as result:
                # Stream text tokens as they arrive
                async for chunk in result.stream_text(delta=True):
                    yield sse_event("text", {"content": chunk})

                # After streaming, parse all messages for tool calls / thinking
                all_messages = result.all_messages()
                for msg in all_messages:
                    if isinstance(msg, ModelResponse):
                        for part in msg.parts:
                            if isinstance(part, TextPart) and part.content.strip():
                                # Extract <thinking> blocks
                                thinking_match = re.findall(
                                    r"<thinking>(.*?)</thinking>",
                                    part.content,
                                    re.DOTALL,
                                )
                                if thinking_match:
                                    thinking_text = "\n".join(
                                        t.strip() for t in thinking_match
                                    )
                                    yield sse_event("thinking", {"content": thinking_text})

                            elif isinstance(part, ToolCallPart):
                                args = (
                                    part.args
                                    if isinstance(part.args, dict)
                                    else json.loads(part.args)
                                    if isinstance(part.args, str)
                                    else {}
                                )
                                yield sse_event(
                                    "tool_call",
                                    {"tool": part.tool_name, "args": args, "call_id": part.tool_call_id},
                                )

                    elif isinstance(msg, ModelRequest):
                        for part in msg.parts:
                            if isinstance(part, ToolReturnPart):
                                content = part.content
                                # Try to detect Plotly figure output
                                plotly_file = None
                                if isinstance(content, str) and "Saved to:" in content:
                                    match = re.search(r"Saved to: (output/[^\s]+)", content)
                                    if match:
                                        plotly_file = match.group(1)

                                yield sse_event(
                                    "tool_result",
                                    {
                                        "call_id": part.tool_call_id,
                                        "content": str(content)[:500],
                                        "plotly_file": plotly_file,
                                    },
                                )

                yield sse_event("done", {"content": ""})

        except Exception as e:
            yield sse_event("error", {"content": str(e)})

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
    return {
        "status": "ok",
        "datasets": list(datasets.keys()),
    }
