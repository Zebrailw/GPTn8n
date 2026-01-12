from app.nodes import NodeContext, handle_if, handle_set


def test_set_node_merges_fields():
    result = handle_set({"fields": {"hello": "world"}}, [{"id": 1}], NodeContext("e", "n"))
    assert result["default"] == [{"id": 1, "hello": "world"}]


def test_if_node_splits_outputs():
    result = handle_if(
        {"field": "status", "operator": "equals", "value": "ok"},
        [{"status": "ok"}, {"status": "fail"}],
        NodeContext("e", "n"),
    )
    assert len(result["outputs"]["true"]) == 1
    assert len(result["outputs"]["false"]) == 1
