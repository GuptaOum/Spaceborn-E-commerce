import asyncio
import hmac
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from botocore.config import Config as BotoConfig
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from langchain_aws import ChatBedrockConverse
from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessageChunk

from .catalog_client import CatalogClient
from .config import Settings, load_settings
from .graph import build_graph, build_messages
from .guardrails import check_cart
from .prompts import SYSTEM_PROMPT, context_block
from .schemas import ChatRequest
from .stream_filter import ThinkingFilter
from .tools import RequestContext, build_tools

logging.basicConfig(level=logging.INFO, format='{"level":"%(levelname)s","logger":"%(name)s","msg":"%(message)s"}')
log = logging.getLogger("copilot")


def make_model(settings: Settings) -> BaseChatModel:
    return ChatBedrockConverse(
        model_id=settings.model_id,
        region_name=settings.aws_region,
        temperature=0.2,
        max_tokens=settings.max_tokens,
        config=BotoConfig(connect_timeout=5, read_timeout=30, retries={"max_attempts": 2, "mode": "adaptive"}),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()
    app.state.settings = settings
    app.state.catalog = CatalogClient(settings.api_url)
    app.state.model = make_model(settings)
    log.info("copilot ready model=%s api=%s", settings.model_id, settings.api_url)
    try:
        yield
    finally:
        await app.state.catalog.aclose()


app = FastAPI(title="Spaceborn Copilot", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.get("/health")
async def health(request: Request) -> dict[str, Any]:
    return {"ok": True, "model": request.app.state.settings.model_id}


def _text(chunk: AIMessageChunk) -> str:
    content = chunk.content
    if isinstance(content, str):
        return content
    parts = []
    for block in content or []:
        if isinstance(block, str):
            parts.append(block)
        elif isinstance(block, dict) and block.get("type") == "text":
            parts.append(str(block.get("text", "")))
    return "".join(parts)


def _sse(event: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n".encode()


async def stream_chat(req: ChatRequest, settings: Settings, catalog: CatalogClient, model: BaseChatModel) -> AsyncIterator[bytes]:
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
    started = time.monotonic()

    async def emit(event: dict[str, Any]) -> None:
        await queue.put(event)

    ctx = RequestContext(chat=req.context, catalog=catalog, emit=emit)
    findings = check_cart(req.context.cart)
    graph = build_graph(model, build_tools(ctx), settings.max_tool_rounds)
    system = f"{SYSTEM_PROMPT}\n\n{context_block(req.context, findings)}"
    messages = build_messages(system, req.history, req.message)

    async def run() -> None:
        usage = {"input": 0, "output": 0}
        emitted = False
        separator = False
        current_id: str | None = None
        filt = ThinkingFilter()
        try:
            async with asyncio.timeout(settings.request_timeout_s):
                async for chunk, meta in graph.astream(
                    {"messages": messages},
                    {"recursion_limit": 2 * settings.max_tool_rounds + 6},
                    stream_mode="messages",
                ):
                    if meta.get("langgraph_node") != "agent" or not isinstance(chunk, AIMessageChunk):
                        continue
                    if chunk.usage_metadata:
                        usage["input"] += chunk.usage_metadata.get("input_tokens", 0)
                        usage["output"] += chunk.usage_metadata.get("output_tokens", 0)
                    if chunk.id and chunk.id != current_id:
                        # A new model turn: anything left unclosed in the previous one is dropped.
                        filt.flush()
                        filt = ThinkingFilter()
                        current_id = chunk.id
                        separator = emitted
                    text = filt.feed(_text(chunk))
                    if text:
                        await emit({"type": "token", "text": ("\n\n" if separator else "") + text})
                        emitted = True
                        separator = False
            tail = filt.flush()
            if tail:
                await emit({"type": "token", "text": ("\n\n" if separator else "") + tail})
                emitted = True
            await emit({
                "type": "done",
                "meta": {
                    "model": settings.model_id,
                    "answered": emitted,
                    "toolCalls": ctx.tool_calls,
                    "zeroResultQueries": ctx.zero_result_queries,
                    "productsShown": ctx.product_names,
                    "findings": [f.rule for f in findings],
                    "usage": usage,
                    "latencyMs": int((time.monotonic() - started) * 1000),
                },
            })
        except TimeoutError:
            log.warning("chat timed out after %ss", settings.request_timeout_s)
            await emit({"type": "error", "code": "timeout", "answered": emitted})
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("chat failed")
            await emit({"type": "error", "code": "model_error", "answered": emitted})
        finally:
            await queue.put(None)

    task = asyncio.create_task(run())
    try:
        while (event := await queue.get()) is not None:
            yield _sse(event)
    finally:
        # The gateway hung up (customer closed the drawer): stop paying for tokens nobody reads.
        task.cancel()


@app.post("/v1/chat")
async def chat(req: ChatRequest, request: Request, x_internal_token: str = Header(default="")):
    settings: Settings = request.app.state.settings
    if not hmac.compare_digest(x_internal_token.encode(), settings.internal_token.encode()):
        raise HTTPException(status_code=401, detail="unauthorized")
    return StreamingResponse(
        stream_chat(req, settings, request.app.state.catalog, request.app.state.model),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )
