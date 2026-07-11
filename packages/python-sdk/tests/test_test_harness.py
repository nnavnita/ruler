"""Rule-level declarative tests: save + run + pass/fail comparison."""

from __future__ import annotations

import pytest

from ruler import (
    InMemoryAuditSink,
    InMemoryStorage,
    InMemoryTestStore,
    RuleEngine,
)

from .rules import FRUIT_CLASSIFIER


@pytest.fixture()
def engine() -> RuleEngine:
    storage = InMemoryStorage()
    e = RuleEngine(
        storage=storage,
        audit=InMemoryAuditSink(),
        versions=storage.versions,
        tests=InMemoryTestStore(),
    )
    e.create_draft("fruit", FRUIT_CLASSIFIER)
    return e


def test_save_and_list_tests(engine: RuleEngine):
    engine.save_test(
        "fruit", "apple case", {"fruit": "apple"}, {"label": "keeps the doctor away", "fruit": "apple"},
    )
    engine.save_test(
        "fruit", "banana case", {"fruit": "banana"}, {"label": "potassium boost", "fruit": "banana"},
    )

    tests = engine.list_tests("fruit")
    assert sorted(t.name for t in tests) == ["apple case", "banana case"]


def test_run_tests_all_passing(engine: RuleEngine):
    engine.save_test(
        "fruit", "apple", {"fruit": "apple"}, {"label": "keeps the doctor away", "fruit": "apple"},
    )
    engine.save_test(
        "fruit", "banana", {"fruit": "banana"}, {"label": "potassium boost", "fruit": "banana"},
    )
    engine.save_test(
        "fruit", "unknown", {"fruit": "cherry"}, {"label": "unknown fruit", "fruit": "cherry"},
    )

    results = engine.run_tests("fruit")
    assert len(results) == 3
    assert all(r.passed for r in results)


def test_run_tests_flags_failures(engine: RuleEngine):
    engine.save_test(
        "fruit", "wrong expectation", {"fruit": "apple"}, {"label": "makes you fly", "fruit": "apple"},
    )
    results = engine.run_tests("fruit")
    assert len(results) == 1
    assert not results[0].passed
    assert results[0].actual["label"] == "keeps the doctor away"
    assert results[0].expected["label"] == "makes you fly"


def test_delete_test_removes_it(engine: RuleEngine):
    saved = engine.save_test("fruit", "temp", {"fruit": "apple"}, {"label": "x"})
    assert engine.delete_test("fruit", saved.id) is True
    assert engine.delete_test("fruit", saved.id) is False
    assert engine.list_tests("fruit") == []
