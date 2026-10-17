import json

import httpx
import pytest
import respx

from app.catalog_client import CatalogClient
from app.schemas import CartLine, ChatContext
from app.tools import RequestContext, build_tools

from .conftest import PRODUCT


@pytest.fixture
async def setup():
    events: list[dict] = []

    async def emit(e):
        events.append(e)

    client = CatalogClient("http://api.test")
    chat = ChatContext(lat=26.45, lng=80.33, areaLabel="Kanpur", signedIn=True, authorization="Bearer abc",
                       cart=[CartLine(productId="x", name="HC-SR04 Ultrasonic Sensor", quantity=1),
                             CartLine(productId="y", name="ESP32 DevKit", quantity=1)])
    ctx = RequestContext(chat=chat, catalog=client, emit=emit)
    tools = {t.name: t for t in build_tools(ctx)}
    yield ctx, tools, events
    await client.aclose()


@respx.mock
async def test_search_uses_gateway_location_and_emits_cards(setup):
    ctx, tools, events = setup
    route = respx.get("http://api.test/v1/catalog/products").mock(return_value=httpx.Response(200, json={"products": [PRODUCT]}))
    out = json.loads(await tools["search_catalog"].ainvoke({"query": "oled display", "max_price": 250}))
    params = route.calls.last.request.url.params
    assert params["lat"] == "26.45" and params["lng"] == "80.33" and params["maxPrice"] == "250.0"
    assert out["results"][0]["id"] == PRODUCT["id"]
    assert events == [{"type": "products", "products": [PRODUCT]}]
    assert ctx.product_names[PRODUCT["id"]] == PRODUCT["name"]


@respx.mock
async def test_search_with_no_results_records_demand(setup):
    ctx, tools, events = setup
    respx.get("http://api.test/v1/catalog/products").mock(return_value=httpx.Response(200, json={"products": []}))
    out = json.loads(await tools["search_catalog"].ainvoke({"query": "flux capacitor"}))
    assert out["results"] == [] and "Kanpur" in out["note"]
    assert ctx.zero_result_queries == ["flux capacitor"]
    assert events == []


@respx.mock
async def test_over_budget_is_not_recorded_as_missing_stock(setup):
    ctx, tools, events = setup

    def answer(request: httpx.Request) -> httpx.Response:
        within_budget = "maxPrice" in request.url.params
        return httpx.Response(200, json={"products": [] if within_budget else [{**PRODUCT, "price": 480}]})

    respx.get("http://api.test/v1/catalog/products").mock(side_effect=answer)
    out = json.loads(await tools["search_catalog"].ainvoke({"query": "oled display", "max_price": 100}))
    assert out["results"] == [] and out["cheapestNearbyPrice"] == 480
    assert "Rs 100" in out["note"]
    assert ctx.zero_result_queries == []
    assert events == []


@respx.mock
async def test_add_to_cart_clamps_to_stock_and_needs_confirmation(setup):
    _, tools, events = setup
    respx.get(f"http://api.test/v1/catalog/products/{PRODUCT['id']}").mock(return_value=httpx.Response(200, json={"product": PRODUCT}))
    out = json.loads(await tools["add_to_cart"].ainvoke({"product_id": PRODUCT["id"], "quantity": 40}))
    assert out["proposed"] is True and out["quantity"] == 9
    assert events[0]["action"] == {"kind": "add_to_cart", "productId": PRODUCT["id"], "quantity": 9, "product": PRODUCT}


@respx.mock
async def test_add_to_cart_rejects_unknown_product(setup):
    _, tools, events = setup
    respx.get(f"http://api.test/v1/catalog/products/{PRODUCT['id']}").mock(return_value=httpx.Response(404, json={}))
    out = json.loads(await tools["add_to_cart"].ainvoke({"product_id": PRODUCT["id"]}))
    assert out["proposed"] is False
    assert events == []


async def test_invalid_ids_never_reach_the_api(setup):
    _, tools, events = setup
    with respx.mock(assert_all_called=False) as mock:
        out = await tools["add_to_cart"].ainvoke({"product_id": "../admin/users"})
        assert "not a valid product id" in out
        assert not mock.calls
    nav = await tools["navigate_to"].ainvoke({"page": "product", "product_id": "javascript:alert(1)"})
    assert "valid product id" in nav and events == []


async def test_navigate_only_to_known_pages(setup):
    _, tools, events = setup
    await tools["navigate_to"].ainvoke({"page": "checkout"})
    assert events == [{"type": "action", "action": {"kind": "navigate", "path": "/checkout"}}]


@respx.mock
async def test_orders_relay_token_and_never_expose_otp_or_address(setup):
    _, tools, _ = setup
    route = respx.get("http://api.test/v1/orders").mock(return_value=httpx.Response(200, json={"orders": [{
        "orderNumber": 1042, "status": "out_for_delivery", "createdAt": "2026-10-16T10:00:00Z", "grandTotal": 548,
        "etaMinutes": 11, "handoverOtp": "4821", "deliveryAddress": {"line1": "12 MG Road"},
        "items": [{"name": "ESP32 DevKit"}],
    }]}))
    out = await tools["get_my_orders"].ainvoke({})
    assert route.calls.last.request.headers["authorization"] == "Bearer abc"
    assert "4821" not in out and "MG Road" not in out
    assert json.loads(out)["orders"][0]["status"] == "Out for delivery"


async def test_cart_compatibility_flags_logic_levels(setup):
    _, tools, _ = setup
    out = json.loads(await tools["check_cart_compatibility"].ainvoke({}))
    assert [i["rule"] for i in out["issues"]] == ["5v-sensor-3v3-logic"]
