import json

import httpx
import respx
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from app.graph import build_messages
from app.main import app
from app.schemas import Turn

from .conftest import PRODUCT, ScriptedModel

TOKEN = "test-token-0123456789abcdef"
BODY = {"message": "need an oled display under 250", "history": [], "context": {"lat": 26.45, "lng": 80.33, "areaLabel": "Kanpur"}}


def events(response) -> list[dict]:
    return [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]


def test_rejects_missing_or_wrong_token():
    with TestClient(app) as client:
        assert client.post("/v1/chat", json=BODY).status_code == 401
        assert client.post("/v1/chat", json=BODY, headers={"X-Internal-Token": "nope"}).status_code == 401


@respx.mock
def test_streams_tool_cards_then_answer():
    respx.get("http://api.test/v1/catalog/products").mock(return_value=httpx.Response(200, json={"products": [PRODUCT]}))
    with TestClient(app) as client:
        client.app.state.model = ScriptedModel(replies=[
            AIMessage(content="", tool_calls=[{"name": "search_catalog", "args": {"query": "oled", "max_price": 250}, "id": "t1"}]),
            AIMessage(content="<thinking>pick the cheapest</thinking>The **0.96 inch I2C OLED** is Rs 219 and arrives in about 12 minutes."),
        ])
        res = client.post("/v1/chat", json=BODY, headers={"X-Internal-Token": TOKEN})
    assert res.status_code == 200
    evs = events(res)
    kinds = [e["type"] for e in evs]
    assert kinds[0] == "products" and kinds[-1] == "done"
    text = "".join(e["text"] for e in evs if e["type"] == "token")
    assert text == "The **0.96 inch I2C OLED** is Rs 219 and arrives in about 12 minutes."
    meta = evs[-1]["meta"]
    assert meta["toolCalls"] == ["search_catalog"] and meta["answered"] is True
    assert meta["productsShown"] == {PRODUCT["id"]: PRODUCT["name"]}


def test_tool_loop_is_bounded():
    looping = AIMessage(content="", tool_calls=[{"name": "check_cart_compatibility", "args": {}, "id": "loop"}])
    with TestClient(app) as client:
        model = ScriptedModel(replies=[looping])
        client.app.state.model = model
        res = client.post("/v1/chat", json=BODY, headers={"X-Internal-Token": TOKEN})
    evs = events(res)
    assert evs[-1]["type"] == "done" and evs[-1]["meta"]["answered"] is False
    max_rounds = client.app.state.settings.max_tool_rounds
    assert model.calls == max_rounds + 2


def test_history_is_normalised_for_bedrock():
    msgs = build_messages("sys", [
        Turn(role="assistant", text="stray greeting"),
        Turn(role="user", text="a"),
        Turn(role="user", text="b"),
        Turn(role="assistant", text="c"),
        Turn(role="user", text="dangling"),
    ], "new")
    assert [type(m) for m in msgs] == [SystemMessage, HumanMessage, AIMessage, HumanMessage]
    assert msgs[1].content == "a\n\nb" and msgs[-1].content == "new"
