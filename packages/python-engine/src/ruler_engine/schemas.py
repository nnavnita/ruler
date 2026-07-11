"""Pydantic schemas for rule + audit records."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RuleRecord(BaseModel):
    """A saved rule: JDM JSON + metadata."""

    name: str
    content: dict[str, Any] = Field(description="Raw JDM decision graph JSON.")
    version: int = 1
    updated_at: datetime = Field(default_factory=_utcnow)


class AuditRecord(BaseModel):
    """One execution: input, output, trace, rule snapshot."""

    id: str
    rule_name: str
    rule_version: int
    rule_snapshot: dict[str, Any]
    input: dict[str, Any]
    result: Any
    trace: dict[str, Any] | None = None
    performance: str | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
