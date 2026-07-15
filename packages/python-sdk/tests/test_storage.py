"""In-memory and file-backed rule storage behaviour."""

from __future__ import annotations

from pathlib import Path

import pytest

from ruler import (
    FileStorage,
    FileVersionStore,
    InMemoryStorage,
    InMemoryVersionStore,
    RuleStatus,
)

from .rules import PASSTHROUGH

# --------------------------------------------------------------------- #
# InMemoryVersionStore                                                  #
# --------------------------------------------------------------------- #


def test_in_memory_version_store_bumps_version():
    vs = InMemoryVersionStore()

    v1 = vs.create_version("fruit", PASSTHROUGH, author="me")
    v2 = vs.create_version("fruit", PASSTHROUGH)
    v3 = vs.create_version("fruit", PASSTHROUGH)

    assert (v1.version, v2.version, v3.version) == (1, 2, 3)
    assert v1.author == "me"
    assert v2.author is None
    assert vs.list_versions("fruit")[0].version == 3  # newest first


def test_in_memory_version_store_default_status_is_draft():
    vs = InMemoryVersionStore()
    v = vs.create_version("fruit", PASSTHROUGH)
    assert v.status == RuleStatus.DRAFT


def test_in_memory_version_store_delete_version():
    vs = InMemoryVersionStore()
    vs.create_version("fruit", PASSTHROUGH)
    vs.create_version("fruit", PASSTHROUGH)

    assert vs.delete_version("fruit", 1) is True
    assert vs.delete_version("fruit", 99) is False
    versions = vs.list_versions("fruit")
    assert [v.version for v in versions] == [2]


# --------------------------------------------------------------------- #
# Legacy RuleStorage shim                                                #
# --------------------------------------------------------------------- #


def test_rule_storage_shim_returns_latest_when_no_published():
    storage = InMemoryStorage()
    storage.save("fruit", PASSTHROUGH)
    storage.save("fruit", PASSTHROUGH)

    record = storage.get("fruit")
    assert record is not None
    assert record.version == 2  # latest draft returned when nothing is published


def test_rule_storage_shim_prefers_published(monkeypatch):
    storage = InMemoryStorage()
    storage.save("fruit", PASSTHROUGH)  # v1
    v2 = storage.save("fruit", PASSTHROUGH)  # v2

    # Publish v1 manually via the underlying store
    v1 = storage.versions.get_version("fruit", 1)
    assert v1 is not None
    v1.status = RuleStatus.PUBLISHED
    storage.versions.update_version(v1)

    record = storage.get("fruit")
    assert record is not None
    # get() should now surface the published version even though a newer draft exists.
    assert record.version == 1
    assert v2.version == 2  # unaffected


# --------------------------------------------------------------------- #
# File-backed stores                                                     #
# --------------------------------------------------------------------- #


def test_file_version_store_persists_across_instances(tmp_path: Path):
    a = FileVersionStore(tmp_path)
    a.create_version("fruit", PASSTHROUGH, notes="v1")
    a.create_version("fruit", PASSTHROUGH, notes="v2")

    b = FileVersionStore(tmp_path)
    versions = b.list_versions("fruit")
    assert [v.notes for v in versions] == ["v2", "v1"]


def test_file_storage_shim_persists(tmp_path: Path):
    a = FileStorage(tmp_path)
    a.save("fruit", PASSTHROUGH)
    a.save("fruit", PASSTHROUGH)

    b = FileStorage(tmp_path)
    record = b.get("fruit")
    assert record is not None
    assert record.version == 2


def test_missing_rule_returns_none():
    storage = InMemoryStorage()
    assert storage.get("nope") is None
    deleted = storage.delete("nope")
    assert deleted is False


@pytest.mark.parametrize("rule_name", ["../escape", "/etc/evil", "a/../../b"])
def test_file_version_store_rejects_path_traversal(rule_name: str, tmp_path: Path):
    store = FileVersionStore(tmp_path)
    with pytest.raises(ValueError):
        store.create_version(rule_name, PASSTHROUGH)


@pytest.mark.parametrize("kind", ["memory", "file"])
def test_list_rules_across_backends(kind: str, tmp_path: Path):
    if kind == "memory":
        storage = InMemoryStorage()
    else:
        storage = FileStorage(tmp_path)

    storage.save("apple", PASSTHROUGH)
    storage.save("banana", PASSTHROUGH)

    names = sorted(r.name for r in storage.list())
    assert names == ["apple", "banana"]
