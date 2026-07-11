"""Pydantic schemas for rules, versions, tests, and audit records."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RuleStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class RuleRecord(BaseModel):
    """Legacy convenience view: rule name + currently-published content."""

    name: str
    content: dict[str, Any]
    version: int = 1
    updated_at: datetime = Field(default_factory=_utcnow)


class RuleVersion(BaseModel):
    """One immutable snapshot of a rule.

    Versions move through a status flow: DRAFT -> REVIEW -> PUBLISHED
    (or REJECTED back to DRAFT, or ARCHIVED). Only one PUBLISHED version
    per rule at a time — publishing archives the previous published one.
    """

    rule_name: str
    version: int
    content: dict[str, Any]
    status: RuleStatus = RuleStatus.DRAFT
    author: str | None = None
    notes: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    submitted_at: datetime | None = None
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    review_decision: Literal["approved", "rejected"] | None = None
    review_comment: str | None = None
    published_at: datetime | None = None


class RuleTest(BaseModel):
    """Declared test case for a rule."""

    id: str
    rule_name: str
    name: str
    input: dict[str, Any]
    expected: Any
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)


class RuleTestResult(BaseModel):
    """One test run: pass/fail + actual output for inspection."""

    test_id: str
    test_name: str
    rule_name: str
    rule_version: int
    passed: bool
    expected: Any
    actual: Any
    error: str | None = None
    performance: str | None = None


class AuditRecord(BaseModel):
    """One evaluation: input, output, trace, rule snapshot."""

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
