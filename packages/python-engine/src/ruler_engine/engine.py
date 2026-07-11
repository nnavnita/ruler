"""RuleEngine: thin wrapper around zen-engine + pluggable storage + audit."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from typing import Any

from zen import ZenEngine

from ruler_engine.audit import AuditSink
from ruler_engine.schemas import AuditRecord, RuleRecord
from ruler_engine.storage import RuleStorage


class RuleNotFoundError(KeyError):
    """Raised when a rule name is not present in storage."""


@dataclass
class EvaluationOutcome:
    """Full result of an evaluation: output + trace + snapshot for auditing."""

    result: Any
    trace: dict[str, Any] | None
    performance: str | None
    rule_snapshot: dict[str, Any]
    rule_version: int


class RuleEngine:
    """
    Framework-agnostic rule engine.

    Give it any `RuleStorage` and optional `AuditSink`. Wraps `zen-engine` for
    execution and always returns the trace so callers can drive visual overlays.
    """

    def __init__(
        self,
        storage: RuleStorage,
        audit: AuditSink | None = None,
        *,
        zen_engine: ZenEngine | None = None,
    ) -> None:
        self.storage = storage
        self.audit = audit
        self._zen = zen_engine or ZenEngine()

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

    def evaluate(
        self,
        name: str,
        context: dict[str, Any],
        *,
        trace: bool = True,
        record_audit: bool = True,
    ) -> EvaluationOutcome:
        record = self.get_rule(name)
        content_bytes = json.dumps(record.content).encode("utf-8")
        decision = self._zen.create_decision(content_bytes)

        error: str | None = None
        result: Any = None
        trace_data: dict[str, Any] | None = None
        performance: str | None = None

        try:
            response = decision.evaluate(context, {"trace": trace})
            result = response.get("result") if isinstance(response, dict) else response
            trace_data = response.get("trace") if isinstance(response, dict) else None
            performance = response.get("performance") if isinstance(response, dict) else None
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"

        outcome = EvaluationOutcome(
            result=result,
            trace=trace_data,
            performance=performance,
            rule_snapshot=record.content,
            rule_version=record.version,
        )

        if record_audit and self.audit is not None:
            self.audit.append(
                AuditRecord(
                    id=uuid.uuid4().hex,
                    rule_name=record.name,
                    rule_version=record.version,
                    rule_snapshot=record.content,
                    input=context,
                    result=result,
                    trace=trace_data,
                    performance=performance,
                    error=error,
                )
            )

        if error is not None:
            raise RuntimeError(error)

        return outcome
