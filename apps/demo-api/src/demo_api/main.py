"""Ruler reference FastAPI service.

Endpoints:
    * /api/rules                        list + save (legacy convenience)
    * /api/rules/{name}                 GET current, POST save, DELETE
    * /api/rules/{name}/evaluate        run current published version
    * /api/rules/{name}/versions        version history
    * /api/rules/{name}/versions/{v}    single version detail + status transitions
    * /api/rules/{name}/versions/{v}/replay          batch eval vs a version
    * /api/rules/{name}/versions/{v}/replay-history  replay past inputs
    * /api/rules/{name}/tests           CRUD test cases
    * /api/rules/{name}/tests/run       run tests against current or a version
    * /api/logs                         audit history
"""

from __future__ import annotations

import os
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ruler_engine import (
    FileAuditSink,
    FileStorage,
    FileTestStore,
    FileVersionStore,
    InMemoryAuditSink,
    InMemoryStorage,
    InMemoryTestStore,
    InvalidStatusTransitionError,
    RuleEngine,
    RuleNotFoundError,
    RuleStorage,
    VersionNotFoundError,
)

DATA_DIR = os.environ.get("RULER_DATA_DIR")

if DATA_DIR:
    version_store = FileVersionStore(f"{DATA_DIR}/versions")
    storage = RuleStorage(version_store)
    audit = FileAuditSink(f"{DATA_DIR}/audit.jsonl")
    tests = FileTestStore(f"{DATA_DIR}/tests")
else:
    storage = InMemoryStorage()
    version_store = storage.versions
    audit = InMemoryAuditSink()
    tests = InMemoryTestStore()

engine = RuleEngine(
    storage=storage, audit=audit, versions=version_store, tests=tests
)

app = FastAPI(title="Ruler API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------------ #
# Request / response models                                          #
# ------------------------------------------------------------------ #


class SaveRuleRequest(BaseModel):
    content: dict[str, Any]


class EvaluateRequest(BaseModel):
    input: dict[str, Any]


class EvaluateResponse(BaseModel):
    result: Any
    trace: dict[str, Any] | None
    performance: str | None
    rule_version: int


class CreateVersionRequest(BaseModel):
    content: dict[str, Any]
    author: str | None = None
    notes: str | None = None


class ReviewActionRequest(BaseModel):
    reviewer: str | None = None
    comment: str | None = None


class ReplayRequest(BaseModel):
    inputs: list[dict[str, Any]]


class ReplayHistoryRequest(BaseModel):
    limit: int = 50


class SaveTestRequest(BaseModel):
    id: str | None = None
    name: str
    input: dict[str, Any]
    expected: Any
    tags: list[str] | None = None


class TestRunRequest(BaseModel):
    version: int | None = None


class StatusTransitionRequest(BaseModel):
    action: Literal["submit", "approve", "reject", "publish", "archive"]
    reviewer: str | None = None
    comment: str | None = None


# ------------------------------------------------------------------ #
# Health / rules (legacy convenience) / evaluate                      #
# ------------------------------------------------------------------ #


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
def evaluate_rule(
    name: str, body: EvaluateRequest, version: int | None = None
) -> EvaluateResponse:
    try:
        outcome = engine.evaluate(name, body.input, version=version)
    except RuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Rule '{name}' not found")
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return EvaluateResponse(
        result=outcome.result,
        trace=outcome.trace,
        performance=outcome.performance,
        rule_version=outcome.rule_version,
    )


# ------------------------------------------------------------------ #
# Versions                                                            #
# ------------------------------------------------------------------ #


@app.get("/api/rules/{name}/versions")
def list_versions(name: str) -> list[dict[str, Any]]:
    return [v.model_dump(mode="json") for v in engine.list_versions(name)]


@app.post("/api/rules/{name}/versions")
def create_version(name: str, body: CreateVersionRequest) -> dict[str, Any]:
    version = engine.create_draft(
        name, body.content, author=body.author, notes=body.notes
    )
    return version.model_dump(mode="json")


@app.get("/api/rules/{name}/versions/{version}")
def get_version(name: str, version: int) -> dict[str, Any]:
    try:
        return engine.get_version(name, version).model_dump(mode="json")
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/rules/{name}/versions/{version}/transition")
def transition_version(
    name: str, version: int, body: StatusTransitionRequest
) -> dict[str, Any]:
    try:
        if body.action == "submit":
            v = engine.submit_for_review(name, version)
        elif body.action == "approve":
            v = engine.approve(
                name, version, reviewer=body.reviewer, comment=body.comment
            )
        elif body.action == "reject":
            v = engine.reject(
                name, version, reviewer=body.reviewer, comment=body.comment
            )
        elif body.action == "publish":
            v = engine.publish(name, version)
        elif body.action == "archive":
            v = engine.archive(name, version)
        else:  # pragma: no cover — pydantic keeps us honest
            raise HTTPException(status_code=400, detail=f"Unknown action {body.action}")
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    return v.model_dump(mode="json")


@app.post("/api/rules/{name}/versions/{version}/replay")
def replay_version(
    name: str, version: int, body: ReplayRequest
) -> list[dict[str, Any]]:
    try:
        entries = engine.replay(name, version, body.inputs)
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return [_replay_entry_to_dict(e) for e in entries]


@app.post("/api/rules/{name}/versions/{version}/replay-history")
def replay_history(
    name: str, version: int, body: ReplayHistoryRequest
) -> list[dict[str, Any]]:
    try:
        entries = engine.replay_history(name, version, limit=body.limit)
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return [_replay_entry_to_dict(e) for e in entries]


def _replay_entry_to_dict(entry) -> dict[str, Any]:
    return {
        "input": entry.input,
        "result": entry.result,
        "trace": entry.trace,
        "performance": entry.performance,
        "error": entry.error,
    }


# ------------------------------------------------------------------ #
# Tests                                                               #
# ------------------------------------------------------------------ #


@app.get("/api/rules/{name}/tests")
def list_tests(name: str) -> list[dict[str, Any]]:
    return [t.model_dump(mode="json") for t in engine.list_tests(name)]


@app.post("/api/rules/{name}/tests")
def save_test(name: str, body: SaveTestRequest) -> dict[str, Any]:
    test = engine.save_test(
        name,
        body.name,
        body.input,
        body.expected,
        tags=body.tags,
        id=body.id,
    )
    return test.model_dump(mode="json")


@app.delete("/api/rules/{name}/tests/{test_id}")
def delete_test(name: str, test_id: str) -> dict[str, bool]:
    return {"deleted": engine.delete_test(name, test_id)}


@app.post("/api/rules/{name}/tests/run")
def run_tests(name: str, body: TestRunRequest) -> list[dict[str, Any]]:
    try:
        results = engine.run_tests(name, version=body.version)
    except RuleNotFoundError:
        raise HTTPException(status_code=404, detail=f"Rule '{name}' not found")
    except VersionNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return [r.model_dump(mode="json") for r in results]


# ------------------------------------------------------------------ #
# Audit log                                                           #
# ------------------------------------------------------------------ #


@app.get("/api/logs")
def list_logs(limit: int = 100, rule_name: str | None = None) -> list[dict[str, Any]]:
    return [
        r.model_dump(mode="json")
        for r in audit.list(limit=limit, rule_name=rule_name)
    ]


@app.get("/api/logs/{record_id}")
def get_log(record_id: str) -> dict[str, Any]:
    record = audit.get(record_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Log '{record_id}' not found")
    return record.model_dump(mode="json")
