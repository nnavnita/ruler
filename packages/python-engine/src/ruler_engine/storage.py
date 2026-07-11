"""Rule storage: protocol + in-memory and file-backed impls."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Protocol

from ruler_engine.schemas import RuleRecord


class RuleStorage(Protocol):
    """Pluggable rule store. Implement for Postgres, Redis, S3, etc."""

    def save(self, name: str, content: dict[str, Any]) -> RuleRecord: ...
    def get(self, name: str) -> RuleRecord | None: ...
    def list(self) -> list[RuleRecord]: ...
    def delete(self, name: str) -> bool: ...


class InMemoryStorage:
    """Dict-backed. Great for tests and demos. Not for production."""

    def __init__(self) -> None:
        self._rules: dict[str, RuleRecord] = {}

    def save(self, name: str, content: dict[str, Any]) -> RuleRecord:
        prev = self._rules.get(name)
        record = RuleRecord(
            name=name,
            content=content,
            version=(prev.version + 1) if prev else 1,
        )
        self._rules[name] = record
        return record

    def get(self, name: str) -> RuleRecord | None:
        return self._rules.get(name)

    def list(self) -> list[RuleRecord]:
        return list(self._rules.values())

    def delete(self, name: str) -> bool:
        return self._rules.pop(name, None) is not None


class FileStorage:
    """Each rule as a JSON file under `root/`. Version bumps on save."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, name: str) -> Path:
        return self.root / f"{name}.json"

    def save(self, name: str, content: dict[str, Any]) -> RuleRecord:
        existing = self.get(name)
        record = RuleRecord(
            name=name,
            content=content,
            version=(existing.version + 1) if existing else 1,
        )
        self._path(name).write_text(record.model_dump_json(indent=2))
        return record

    def get(self, name: str) -> RuleRecord | None:
        path = self._path(name)
        if not path.exists():
            return None
        return RuleRecord.model_validate_json(path.read_text())

    def list(self) -> list[RuleRecord]:
        out: list[RuleRecord] = []
        for p in sorted(self.root.glob("*.json")):
            try:
                out.append(RuleRecord.model_validate_json(p.read_text()))
            except Exception:
                continue
        return out

    def delete(self, name: str) -> bool:
        path = self._path(name)
        if not path.exists():
            return False
        path.unlink()
        return True
