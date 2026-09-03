"""Lean feature-flag service: the flag state lives in a JSON file on disk."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException
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


app = FastAPI(title="Feature Flags Admin")


@app.get("/api/flags")
def list_flags() -> list[dict[str, object]]:
    state = read_state()
    return [{**flag, "enabled": state[flag["key"]]} for flag in FLAGS]


@app.put("/api/flags/{key}")
def set_flag(key: str, update: FlagUpdate) -> dict[str, object]:
    if key not in KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown flag {key}")
    state = read_state()
    state[key] = update.enabled
    write_state(state)
    return {"key": key, "enabled": update.enabled}
