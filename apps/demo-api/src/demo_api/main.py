"""Ruler reference FastAPI service.

Wires `ruler-engine` behind a small HTTP surface: save/load rules, evaluate,
and inspect audit history. Frontends and non-Python backends (Java, etc.)
consume this.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ruler_engine import (
    FileAuditSink,
    FileStorage,
    InMemoryAuditSink,
    InMemoryStorage,
    RuleEngine,
    RuleNotFoundError,
)

DATA_DIR = os.environ.get("RULER_DATA_DIR")

if DATA_DIR:
    storage = FileStorage(f"{DATA_DIR}/rules")
    audit = FileAuditSink(f"{DATA_DIR}/audit.jsonl")
else:
    storage = InMemoryStorage()
    audit = InMemoryAuditSink()

engine = RuleEngine(storage=storage, audit=audit)

app = FastAPI(title="Ruler API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SaveRuleRequest(BaseModel):
    content: dict[str, Any]


class EvaluateRequest(BaseModel):
    input: dict[str, Any]


class EvaluateResponse(BaseModel):
    result: Any
    trace: dict[str, Any] | None
    performance: str | None
    rule_version: int


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/rules")
def list_rules() -> list[dict[str, Any]]:
    return [r.model_dump(mode="json") for r in engine.list_rules()]


@app.get("/api/rules/{name}")
def get_rule(name: str) -> dict[str, Any]:
    try:
        return engine.get_rule(name).model_dump(mode="json")
    except RuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Rule '{name}' not found")


@app.post("/api/rules/{name}")
def save_rule(name: str, body: SaveRuleRequest) -> dict[str, Any]:
    return engine.save_rule(name, body.content).model_dump(mode="json")


@app.delete("/api/rules/{name}")
def delete_rule(name: str) -> dict[str, bool]:
    return {"deleted": engine.delete_rule(name)}


@app.post("/api/rules/{name}/evaluate", response_model=EvaluateResponse)
def evaluate_rule(name: str, body: EvaluateRequest) -> EvaluateResponse:
    try:
        outcome = engine.evaluate(name, body.input)
    except RuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Rule '{name}' not found")
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return EvaluateResponse(
        result=outcome.result,
        trace=outcome.trace,
        performance=outcome.performance,
        rule_version=outcome.rule_version,
    )


@app.get("/api/logs")
def list_logs(limit: int = 100, rule_name: str | None = None) -> list[dict[str, Any]]:
    return [r.model_dump(mode="json") for r in audit.list(limit=limit, rule_name=rule_name)]


@app.get("/api/logs/{record_id}")
def get_log(record_id: str) -> dict[str, Any]:
    record = audit.get(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Log '{record_id}' not found")
    return record.model_dump(mode="json")
