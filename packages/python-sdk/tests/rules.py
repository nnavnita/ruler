"""Shared JDM sample rules used across the test suite.

These are deliberately domain-neutral: a fruit classifier so the tests
read like literature-book examples, not real business logic.
"""

from __future__ import annotations


# Classifies a fruit into a short label. Single expression node.
FRUIT_CLASSIFIER: dict = {
    "nodes": [
        {
            "id": "input-1",
            "type": "inputNode",
            "name": "input",
            "position": {"x": 40, "y": 100},
            "content": {},
        },
        {
            "id": "expr-1",
            "type": "expressionNode",
            "name": "classify",
            "position": {"x": 260, "y": 100},
            "content": {
                "expressions": [
                    {
                        "id": "e1",
                        "key": "label",
                        "value": (
                            "fruit == 'apple' ? 'keeps the doctor away' : "
                            "fruit == 'banana' ? 'potassium boost' : "
                            "'unknown fruit'"
                        ),
                    },
                    {"id": "e2", "key": "fruit", "value": "fruit"},
                ]
            },
        },
        {
            "id": "output-1",
            "type": "outputNode",
            "name": "output",
            "position": {"x": 500, "y": 100},
            "content": {},
        },
    ],
    "edges": [
        {"id": "e-in", "sourceId": "input-1", "targetId": "expr-1", "type": "edge"},
        {"id": "e-out", "sourceId": "expr-1", "targetId": "output-1", "type": "edge"},
    ],
}


# Trivial pass-through rule — useful for testing lifecycle bits that
# don't care about actual output.
PASSTHROUGH: dict = {
    "nodes": [
        {"id": "in", "type": "inputNode", "name": "input", "position": {"x": 0, "y": 0}, "content": {}},
        {"id": "out", "type": "outputNode", "name": "output", "position": {"x": 200, "y": 0}, "content": {}},
    ],
    "edges": [
        {"id": "e", "sourceId": "in", "targetId": "out", "type": "edge"},
    ],
}
