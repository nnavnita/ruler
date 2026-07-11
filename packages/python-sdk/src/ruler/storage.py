"""Rule / version / test storage: protocols + in-memory and file-backed impls."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Protocol

from ruler.schemas import (
    AuditRecord,
    RuleRecord,
    RuleStatus,
    RuleTest,
    RuleVersion,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Version store — canonical source of truth for rule content + status flow.  #
# --------------------------------------------------------------------------- #


class RuleVersionStore(Protocol):
    def create_version(
        self,
        rule_name: str,
        content: dict[str, Any],
        *,
        author: str | None = None,
        notes: str | None = None,
    ) -> RuleVersion: ...

    def list_versions(self, rule_name: str) -> list[RuleVersion]: ...
    def get_version(self, rule_name: str, version: int) -> RuleVersion | None: ...
    def get_published(self, rule_name: str) -> RuleVersion | None: ...
    def list_rules(self) -> list[str]: ...
    def update_version(self, version: RuleVersion) -> RuleVersion: ...
    def delete_version(self, rule_name: str, version: int) -> bool: ...


class InMemoryVersionStore:
    def __init__(self) -> None:
        self._by_rule: dict[str, list[RuleVersion]] = {}

    def _rule(self, rule_name: str) -> list[RuleVersion]:
        return self._by_rule.setdefault(rule_name, [])

    def create_version(
        self,
        rule_name: str,
        content: dict[str, Any],
        *,
        author: str | None = None,
        notes: str | None = None,
    ) -> RuleVersion:
        versions = self._rule(rule_name)
        next_v = (max((v.version for v in versions), default=0)) + 1
        version = RuleVersion(
            rule_name=rule_name,
            version=next_v,
            content=content,
            status=RuleStatus.DRAFT,
            author=author,
            notes=notes,
        )
        versions.append(version)
        return version

    def list_versions(self, rule_name: str) -> list[RuleVersion]:
        return sorted(self._rule(rule_name), key=lambda v: v.version, reverse=True)

    def get_version(self, rule_name: str, version: int) -> RuleVersion | None:
        return next((v for v in self._rule(rule_name) if v.version == version), None)

    def get_published(self, rule_name: str) -> RuleVersion | None:
        return next(
            (v for v in self._rule(rule_name) if v.status == RuleStatus.PUBLISHED),
            None,
        )

    def list_rules(self) -> list[str]:
        return sorted(self._by_rule.keys())

    def update_version(self, version: RuleVersion) -> RuleVersion:
        versions = self._rule(version.rule_name)
        for i, v in enumerate(versions):
            if v.version == version.version:
                versions[i] = version
                return version
        raise KeyError(f"Version {version.rule_name} v{version.version} not found")

    def delete_version(self, rule_name: str, version: int) -> bool:
        versions = self._rule(rule_name)
        before = len(versions)
        self._by_rule[rule_name] = [v for v in versions if v.version != version]
        return len(self._by_rule[rule_name]) < before


class FileVersionStore:
    """One JSON file per (rule, version): `root/<rule>/v<N>.json`."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _rule_dir(self, rule_name: str) -> Path:
        d = self.root / rule_name
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _path(self, rule_name: str, version: int) -> Path:
        return self._rule_dir(rule_name) / f"v{version}.json"

    def _all_files(self, rule_name: str) -> Iterable[Path]:
        return sorted(self._rule_dir(rule_name).glob("v*.json"))

    def create_version(
        self,
        rule_name: str,
        content: dict[str, Any],
        *,
        author: str | None = None,
        notes: str | None = None,
    ) -> RuleVersion:
        existing = [self._read(p) for p in self._all_files(rule_name)]
        next_v = (max((v.version for v in existing), default=0)) + 1
        version = RuleVersion(
            rule_name=rule_name,
            version=next_v,
            content=content,
            status=RuleStatus.DRAFT,
            author=author,
            notes=notes,
        )
        self._path(rule_name, next_v).write_text(version.model_dump_json(indent=2))
        return version

    def _read(self, path: Path) -> RuleVersion:
        return RuleVersion.model_validate_json(path.read_text())

    def list_versions(self, rule_name: str) -> list[RuleVersion]:
        items = [self._read(p) for p in self._all_files(rule_name)]
        return sorted(items, key=lambda v: v.version, reverse=True)

    def get_version(self, rule_name: str, version: int) -> RuleVersion | None:
        path = self._path(rule_name, version)
        return self._read(path) if path.exists() else None

    def get_published(self, rule_name: str) -> RuleVersion | None:
        for path in self._all_files(rule_name):
            v = self._read(path)
            if v.status == RuleStatus.PUBLISHED:
                return v
        return None

    def list_rules(self) -> list[str]:
        return sorted(p.name for p in self.root.iterdir() if p.is_dir())

    def update_version(self, version: RuleVersion) -> RuleVersion:
        path = self._path(version.rule_name, version.version)
        if not path.exists():
            raise KeyError(f"Version {version.rule_name} v{version.version} not found")
        path.write_text(version.model_dump_json(indent=2))
        return version

    def delete_version(self, rule_name: str, version: int) -> bool:
        path = self._path(rule_name, version)
        if not path.exists():
            return False
        path.unlink()
        return True


# --------------------------------------------------------------------------- #
# Backwards-compat convenience: `RuleStorage` shim over a version store.     #
# Older callers using save/get by name now get "published (or latest draft). #
# --------------------------------------------------------------------------- #


class RuleStorage:
    """Legacy-ish facade that wraps a `RuleVersionStore` so the old API
    (save/get/list/delete by name) still works. `save` creates a new
    version in DRAFT status."""

    def __init__(self, versions: RuleVersionStore) -> None:
        self.versions = versions

    def save(self, name: str, content: dict[str, Any]) -> RuleRecord:
        version = self.versions.create_version(name, content)
        return RuleRecord(name=name, content=content, version=version.version)

    def get(self, name: str) -> RuleRecord | None:
        v = self.versions.get_published(name)
        if v is None:
            versions = self.versions.list_versions(name)
            v = versions[0] if versions else None
        if v is None:
            return None
        return RuleRecord(name=name, content=v.content, version=v.version)

    def list(self) -> list[RuleRecord]:
        out: list[RuleRecord] = []
        for name in self.versions.list_rules():
            r = self.get(name)
            if r is not None:
                out.append(r)
        return out

    def delete(self, name: str) -> bool:
        deleted = False
        for v in self.versions.list_versions(name):
            deleted |= self.versions.delete_version(name, v.version)
        return deleted


def InMemoryStorage() -> RuleStorage:
    """Preserves old import surface."""
    return RuleStorage(InMemoryVersionStore())


def FileStorage(root: str | Path) -> RuleStorage:
    return RuleStorage(FileVersionStore(root))


# --------------------------------------------------------------------------- #
# Test store — declared test cases per rule.                                  #
# --------------------------------------------------------------------------- #


class RuleTestStore(Protocol):
    def save_test(
        self,
        rule_name: str,
        name: str,
        input: dict[str, Any],
        expected: Any,
        *,
        tags: list[str] | None = None,
        id: str | None = None,
    ) -> RuleTest: ...

    def list_tests(self, rule_name: str) -> list[RuleTest]: ...
    def get_test(self, rule_name: str, test_id: str) -> RuleTest | None: ...
    def delete_test(self, rule_name: str, test_id: str) -> bool: ...


class InMemoryTestStore:
    def __init__(self) -> None:
        self._by_rule: dict[str, dict[str, RuleTest]] = {}

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
        rule = self._by_rule.setdefault(rule_name, {})
        test_id = id or uuid.uuid4().hex
        test = RuleTest(
            id=test_id,
            rule_name=rule_name,
            name=name,
            input=input,
            expected=expected,
            tags=tags or [],
        )
        rule[test_id] = test
        return test

    def list_tests(self, rule_name: str) -> list[RuleTest]:
        return list(self._by_rule.get(rule_name, {}).values())

    def get_test(self, rule_name: str, test_id: str) -> RuleTest | None:
        return self._by_rule.get(rule_name, {}).get(test_id)

    def delete_test(self, rule_name: str, test_id: str) -> bool:
        return self._by_rule.get(rule_name, {}).pop(test_id, None) is not None


class FileTestStore:
    """One JSON file per (rule, test): `root/<rule>/<id>.json`."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _rule_dir(self, rule_name: str) -> Path:
        d = self.root / rule_name
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _path(self, rule_name: str, test_id: str) -> Path:
        return self._rule_dir(rule_name) / f"{test_id}.json"

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
        test_id = id or uuid.uuid4().hex
        test = RuleTest(
            id=test_id,
            rule_name=rule_name,
            name=name,
            input=input,
            expected=expected,
            tags=tags or [],
        )
        self._path(rule_name, test_id).write_text(test.model_dump_json(indent=2))
        return test

    def list_tests(self, rule_name: str) -> list[RuleTest]:
        d = self._rule_dir(rule_name)
        out: list[RuleTest] = []
        for p in sorted(d.glob("*.json")):
            try:
                out.append(RuleTest.model_validate_json(p.read_text()))
            except Exception:
                continue
        return out

    def get_test(self, rule_name: str, test_id: str) -> RuleTest | None:
        path = self._path(rule_name, test_id)
        return RuleTest.model_validate_json(path.read_text()) if path.exists() else None

    def delete_test(self, rule_name: str, test_id: str) -> bool:
        path = self._path(rule_name, test_id)
        if not path.exists():
            return False
        path.unlink()
        return True


__all__ = [
    "FileStorage",
    "FileTestStore",
    "FileVersionStore",
    "InMemoryStorage",
    "InMemoryTestStore",
    "InMemoryVersionStore",
    "RuleStorage",
    "RuleTestStore",
    "RuleVersionStore",
]
