"""Lean feature-flag service: the flag state lives in a JSON file on disk."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "flags.json"

# Canonical catalogue: one flag per main graph of the refunds dashboard.
FLAGS: list[dict[str, str]] = [
    {
        "key": "refundedValueByReason",
        "label": "Refunded value by reason",
        "description": "Donut chart splitting refunded dollars by refund reason.",
    },
    {
        "key": "refundRateByProduct",
        "label": "Refund rate by product",
        "description": "Bar chart of refunded value over gross value per product.",
    },
    {
        "key": "monthlyGrossVsRefunded",
        "label": "Monthly gross vs refunded",
        "description": "Line chart trending gross and refunded revenue per month.",
    },
    {
        "key": "refundedValueByRegion",
        "label": "Refunded value by region",
        "description": "Horizontal bars of refunded value per region.",
    },
    {
        "key": "refundedValueByProduct",
        "label": "Refunded value by product",
        "description": "Bar chart of refunded dollars per product line.",
    },
    {
        "key": "refundRateByChannel",
        "label": "Refund rate by channel",
        "description": "Horizontal bars of refund rate per acquisition channel.",
    },
]

KEYS = {flag["key"] for flag in FLAGS}


class FlagUpdate(BaseModel):
    enabled: bool


def read_state() -> dict[str, bool]:
    """Flag state from disk, defaulting unknown or missing flags to enabled."""
    stored: dict[str, object] = {}
    if STORE_PATH.exists():
        stored = json.loads(STORE_PATH.read_text())
    return {key: bool(stored.get(key, True)) for key in KEYS}


def write_state(state: dict[str, bool]) -> None:
    STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(dict(sorted(state.items())), indent=2) + "\n")


def flag_list() -> list[dict[str, object]]:
    state = read_state()
    return [{**flag, "enabled": state[flag["key"]]} for flag in FLAGS]


# Subscribers of /api/flags/stream; each gets the full flag list pushed on every change.
subscribers: set[asyncio.Queue[str]] = set()


def publish(flags: list[dict[str, object]]) -> None:
    payload = json.dumps(flags)
    for queue in subscribers:
        queue.put_nowait(payload)


app = FastAPI(title="Feature Flags Admin")


@app.get("/api/flags")
def list_flags() -> list[dict[str, object]]:
    return flag_list()


@app.get("/api/flags/stream")
async def stream_flags(request: Request) -> StreamingResponse:
    """Server-sent events: the current flags, then a push after every toggle."""
    queue: asyncio.Queue[str] = asyncio.Queue()
    subscribers.add(queue)

    async def events() -> AsyncIterator[str]:
        try:
            yield f"data: {json.dumps(flag_list())}\n\n"
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"  # keeps proxies from dropping the stream
                else:
                    yield f"data: {payload}\n\n"
        finally:
            subscribers.discard(queue)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.put("/api/flags/{key}")
async def set_flag(key: str, update: FlagUpdate) -> dict[str, object]:
    if key not in KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown flag {key}")
    state = read_state()
    state[key] = update.enabled
    write_state(state)
    publish(flag_list())
    return {"key": key, "enabled": update.enabled}
