"""Audit sink: protocol + in-memory and file-backed impls."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from ruler_engine.schemas import AuditRecord


class AuditSink(Protocol):
    """Pluggable audit log. Implement for Postgres, S3, Kafka, etc."""

    def append(self, record: AuditRecord) -> None: ...
    def list(self, limit: int = 100, rule_name: str | None = None) -> list[AuditRecord]: ...
    def get(self, record_id: str) -> AuditRecord | None: ...


class InMemoryAuditSink:
    """List-backed. Great for tests and demos."""

    def __init__(self) -> None:
        self._records: list[AuditRecord] = []

    def append(self, record: AuditRecord) -> None:
        self._records.append(record)

    def list(self, limit: int = 100, rule_name: str | None = None) -> list[AuditRecord]:
        items = self._records
        if rule_name:
            items = [r for r in items if r.rule_name == rule_name]
        return list(reversed(items))[:limit]

    def get(self, record_id: str) -> AuditRecord | None:
        return next((r for r in self._records if r.id == record_id), None)


class FileAuditSink:
    """JSONL append log. One record per line."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.touch(exist_ok=True)

    def append(self, record: AuditRecord) -> None:
        with self.path.open("a") as f:
            f.write(record.model_dump_json() + "\n")

    def _iter(self):
        with self.path.open() as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield AuditRecord.model_validate_json(line)
                except Exception:
                    continue

    def list(self, limit: int = 100, rule_name: str | None = None) -> list[AuditRecord]:
        items = list(self._iter())
        if rule_name:
            items = [r for r in items if r.rule_name == rule_name]
        return list(reversed(items))[:limit]

    def get(self, record_id: str) -> AuditRecord | None:
        return next((r for r in self._iter() if r.id == record_id), None)
