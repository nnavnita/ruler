"""RuleEngine: version-aware wrapper around zen-engine + pluggable stores."""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from zen import ZenEngine

from ruler.audit import AuditSink
from ruler.schemas import (
    AuditRecord,
    RuleRecord,
    RuleStatus,
    RuleTest,
    RuleTestResult,
    RuleVersion,
)
from ruler.storage import (
    RuleStorage,
    RuleTestStore,
    RuleVersionStore,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RuleNotFoundError(KeyError):
    """Raised when a rule name is not present."""


class VersionNotFoundError(KeyError):
    """Raised when the requested (rule, version) pair is not present."""


class InvalidStatusTransitionError(ValueError):
    """Raised on an illegal status transition (e.g. publish from DRAFT)."""


@dataclass
class EvaluationOutcome:
    result: Any
    trace: dict[str, Any] | None
    performance: str | None
    rule_snapshot: dict[str, Any]
    rule_version: int


@dataclass
class ReplayEntry:
    input: dict[str, Any]
    result: Any
    trace: dict[str, Any] | None
    performance: str | None
    error: str | None


class RuleEngine:
    """Framework-agnostic engine. Uses a version store as the source of truth."""

    def __init__(
        self,
        storage: RuleStorage,
        audit: AuditSink | None = None,
        *,
        versions: RuleVersionStore | None = None,
        tests: RuleTestStore | None = None,
        zen_engine: ZenEngine | None = None,
    ) -> None:
        self.storage = storage
        self.audit = audit
        self.versions = versions or storage.versions
        self.tests = tests
        self._zen = zen_engine or ZenEngine()

    # ------------------------------------------------------------------ #
    # Legacy rule CRUD — keeps the old surface working.                  #
    # ------------------------------------------------------------------ #

    def save_rule(self, name: str, content: dict[str, Any]) -> RuleRecord:
        return self.storage.save(name, content)

    def get_rule(self, name: str) -> RuleRecord:
        record = self.storage.get(name)
        if record is None:
            raise RuleNotFoundError(name)
        return record

    def list_rules(self) -> list[RuleRecord]:
        return self.storage.list()

    def delete_rule(self, name: str) -> bool:
        return self.storage.delete(name)

    # ------------------------------------------------------------------ #
    # Version ops                                                         #
    # ------------------------------------------------------------------ #

    def create_draft(
        self,
        rule_name: str,
        content: dict[str, Any],
        *,
        author: str | None = None,
        notes: str | None = None,
    ) -> RuleVersion:
        return self.versions.create_version(
            rule_name, content, author=author, notes=notes
        )

    def list_versions(self, rule_name: str) -> list[RuleVersion]:
        return self.versions.list_versions(rule_name)

    def get_version(self, rule_name: str, version: int) -> RuleVersion:
        v = self.versions.get_version(rule_name, version)
        if v is None:
            raise VersionNotFoundError(f"{rule_name} v{version}")
        return v

    def get_published(self, rule_name: str) -> RuleVersion | None:
        return self.versions.get_published(rule_name)

    def submit_for_review(self, rule_name: str, version: int) -> RuleVersion:
        v = self.get_version(rule_name, version)
        if v.status != RuleStatus.DRAFT:
            raise InvalidStatusTransitionError(
                f"Can only submit DRAFT versions for review, got {v.status}"
            )
        v.status = RuleStatus.REVIEW
        v.submitted_at = _utcnow()
        return self.versions.update_version(v)

    def approve(
        self,
        rule_name: str,
        version: int,
        *,
        reviewer: str | None = None,
        comment: str | None = None,
    ) -> RuleVersion:
        v = self.get_version(rule_name, version)
        if v.status != RuleStatus.REVIEW:
            raise InvalidStatusTransitionError(
                f"Can only approve versions in REVIEW, got {v.status}"
            )
        v.reviewed_at = _utcnow()
        v.reviewed_by = reviewer
        v.review_decision = "approved"
        v.review_comment = comment
        return self.versions.update_version(v)

    def reject(
        self,
        rule_name: str,
        version: int,
        *,
        reviewer: str | None = None,
        comment: str | None = None,
    ) -> RuleVersion:
        v = self.get_version(rule_name, version)
        if v.status != RuleStatus.REVIEW:
            raise InvalidStatusTransitionError(
                f"Can only reject versions in REVIEW, got {v.status}"
            )
        v.status = RuleStatus.DRAFT
        v.reviewed_at = _utcnow()
        v.reviewed_by = reviewer
        v.review_decision = "rejected"
        v.review_comment = comment
        return self.versions.update_version(v)

    def publish(self, rule_name: str, version: int) -> RuleVersion:
        v = self.get_version(rule_name, version)
        if v.status not in (RuleStatus.REVIEW, RuleStatus.DRAFT):
            raise InvalidStatusTransitionError(
                f"Cannot publish from {v.status}"
            )
        if v.status == RuleStatus.REVIEW and v.review_decision != "approved":
            raise InvalidStatusTransitionError(
                "Publishing from REVIEW requires review_decision=approved"
            )
        # Archive current published, if any.
        current = self.get_published(rule_name)
        if current is not None and current.version != v.version:
            current.status = RuleStatus.ARCHIVED
            self.versions.update_version(current)
        v.status = RuleStatus.PUBLISHED
        v.published_at = _utcnow()
        return self.versions.update_version(v)

    def archive(self, rule_name: str, version: int) -> RuleVersion:
        v = self.get_version(rule_name, version)
        v.status = RuleStatus.ARCHIVED
        return self.versions.update_version(v)

    # ------------------------------------------------------------------ #
    # Evaluation                                                          #
    # ------------------------------------------------------------------ #

    def _evaluate_content(
        self, content: dict[str, Any], context: dict[str, Any], *, trace: bool
    ) -> tuple[Any, dict[str, Any] | None, str | None, str | None]:
        """Returns (result, trace, performance, error).

        `zen-engine` (Python bindings) expects a Mapping for
        `create_decision`, not raw bytes / str. Pass the dict straight
        through.
        """
        try:
            decision = self._zen.create_decision(content)
            response = decision.evaluate(context, {"trace": trace})
            if isinstance(response, dict):
                return (
                    response.get("result"),
                    response.get("trace") if trace else None,
                    response.get("performance"),
                    None,
                )
            return response, None, None, None
        except Exception as exc:
            return None, None, None, f"{type(exc).__name__}: {exc}"

    def evaluate(
        self,
        name: str,
        context: dict[str, Any],
        *,
        version: int | None = None,
        trace: bool = True,
        record_audit: bool = True,
    ) -> EvaluationOutcome:
        """Evaluate a rule. Defaults to the currently PUBLISHED version;
        if none exists, falls back to the latest draft (dev convenience)."""

        if version is not None:
            v = self.get_version(name, version)
        else:
            v = self.get_published(name)
            if v is None:
                versions = self.list_versions(name)
                if not versions:
                    raise RuleNotFoundError(name)
                v = versions[0]

        result, trace_data, perf, err = self._evaluate_content(
            v.content, context, trace=trace
        )

        if record_audit and self.audit is not None:
            self.audit.append(
                AuditRecord(
                    id=uuid.uuid4().hex,
                    rule_name=v.rule_name,
                    rule_version=v.version,
                    rule_snapshot=v.content,
                    input=context,
                    result=result,
                    trace=trace_data,
                    performance=perf,
                    error=err,
                )
            )

        if err is not None:
            raise RuntimeError(err)

        return EvaluationOutcome(
            result=result,
            trace=trace_data,
            performance=perf,
            rule_snapshot=v.content,
            rule_version=v.version,
        )

    def replay(
        self,
        rule_name: str,
        version: int,
        contexts: Iterable[dict[str, Any]],
    ) -> list[ReplayEntry]:
        """Evaluate an arbitrary batch of input contexts against one version
        without touching the audit log. Used for regression / what-if."""
        v = self.get_version(rule_name, version)
        out: list[ReplayEntry] = []
        for ctx in contexts:
            result, trace_data, perf, err = self._evaluate_content(
                v.content, ctx, trace=True
            )
            out.append(
                ReplayEntry(
                    input=ctx,
                    result=result,
                    trace=trace_data,
                    performance=perf,
                    error=err,
                )
            )
        return out

    def replay_history(
        self, rule_name: str, version: int, *, limit: int = 50
    ) -> list[ReplayEntry]:
        """Replay past audit inputs against a target version — useful to see
        how a candidate rule change would have decided historical cases."""
        if self.audit is None:
            return []
        records = self.audit.list(limit=limit, rule_name=rule_name)
        return self.replay(rule_name, version, (r.input for r in records))

    # ------------------------------------------------------------------ #
    # Test harness                                                        #
    # ------------------------------------------------------------------ #

    def _require_tests(self) -> RuleTestStore:
        if self.tests is None:
            raise RuntimeError(
                "RuleEngine was constructed without a test store; "
                "pass `tests=` when instantiating."
            )
        return self.tests

    def save_test(
        self,
        rule_name: str,
        name: str,
        input: dict[str, Any],
        expected: Any,
        *,
        tags: list[str] | None = None,
        id: str | None = None,
    ) -> RuleTest:
        return self._require_tests().save_test(
            rule_name, name, input, expected, tags=tags, id=id
        )

    def list_tests(self, rule_name: str) -> list[RuleTest]:
        return self._require_tests().list_tests(rule_name)

    def delete_test(self, rule_name: str, test_id: str) -> bool:
        return self._require_tests().delete_test(rule_name, test_id)

    def run_tests(
        self,
        rule_name: str,
        *,
        version: int | None = None,
    ) -> list[RuleTestResult]:
        store = self._require_tests()
        tests = store.list_tests(rule_name)
        if version is not None:
            v = self.get_version(rule_name, version)
        else:
            v = self.get_published(rule_name)
            if v is None:
                versions = self.list_versions(rule_name)
                if not versions:
                    raise RuleNotFoundError(rule_name)
                v = versions[0]

        results: list[RuleTestResult] = []
        for t in tests:
            actual, _trace, perf, err = self._evaluate_content(
                v.content, t.input, trace=False
            )
            passed = err is None and _deep_eq(actual, t.expected)
            results.append(
                RuleTestResult(
                    test_id=t.id,
                    test_name=t.name,
                    rule_name=rule_name,
                    rule_version=v.version,
                    passed=passed,
                    expected=t.expected,
                    actual=actual,
                    error=err,
                    performance=perf,
                )
            )
        return results


def _deep_eq(a: Any, b: Any) -> bool:
    """Order-insensitive dict compare so JSON round-trip differences don't
    spuriously fail tests."""
    if isinstance(a, dict) and isinstance(b, dict):
        if a.keys() != b.keys():
            return False
        return all(_deep_eq(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(_deep_eq(x, y) for x, y in zip(a, b, strict=True))
    return a == b
