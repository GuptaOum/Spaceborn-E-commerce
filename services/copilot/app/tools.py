"""Geo-RAG tools. Location, cart and identity come from the gateway's request context, never from the model."""

import json
import re
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

import httpx
from langchain_core.tools import BaseTool, tool

from .catalog_client import CatalogClient, NotSignedIn
from .guardrails import check_cart
from .schemas import ChatContext

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE)
MAX_PER_LINE = 50

# Mirrors ORDER_STATUS_LABEL in packages/web-core/src/format.ts.
ORDER_STATUS_LABEL = {
    "pending_payment": "Awaiting payment",
    "placed": "Placed",
    "accepted": "Accepted",
    "packing": "Being packed",
    "ready_for_pickup": "Ready for delivery",
    "out_for_delivery": "Out for delivery",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
    "expired": "Expired",
}

PAGES: dict[str, str] = {
    "cart": "/cart",
    "checkout": "/checkout",
    "orders": "/orders",
    "fabrication": "/fabrication",
    "catalog": "/catalog",
    "compare": "/compare",
    "wishlist": "/wishlist",
    "datasheets": "/datasheets",
    "contact": "/contact",
    "warranty": "/warranty",
    "profile": "/profile",
}

Emit = Callable[[dict[str, Any]], Awaitable[None]]


@dataclass
class RequestContext:
    chat: ChatContext
    catalog: CatalogClient
    emit: Emit
    tool_calls: list[str] = field(default_factory=list)
    zero_result_queries: list[str] = field(default_factory=list)
    product_names: dict[str, str] = field(default_factory=dict)


def _compact(p: dict[str, Any]) -> dict[str, Any]:
    specs = p.get("specs") if isinstance(p.get("specs"), dict) else {}
    return {
        "id": p.get("id"),
        "name": p.get("name"),
        "brand": p.get("brand"),
        "category": p.get("categoryName"),
        "price": p.get("price"),
        "mrp": p.get("mrp"),
        "inStockNearby": p.get("nearbyStock", p.get("stock")),
        "etaMinutes": p.get("etaMinutes"),
        "specs": {str(k)[:40]: str(v)[:60] for k, v in list(specs.items())[:8]},
        "summary": (p.get("description") or "")[:240],
    }


def _dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def build_tools(ctx: RequestContext) -> list[BaseTool]:
    chat = ctx.chat
    area = chat.areaLabel or "the customer's delivery location"

    def remember(products: list[dict[str, Any]]) -> None:
        for p in products:
            if p.get("id") and p.get("name"):
                ctx.product_names[str(p["id"])] = str(p["name"])

    @tool
    async def search_catalog(query: str, max_price: float | None = None, limit: int = 5) -> str:
        """Search products that nearby dark stores can deliver in about 15 minutes.

        Args:
            query: Short product search, e.g. "I2C OLED display" or "5V relay module". Not a full sentence.
            max_price: Optional budget in rupees; only offers at or under it are returned.
            limit: How many products to return, 1 to 8.
        """
        ctx.tool_calls.append("search_catalog")
        query = query.strip()[:80]
        if len(query) < 2:
            return "Ask the customer what they are looking for."
        limit = max(1, min(int(limit), 8))
        price = float(max_price) if max_price and max_price > 0 else None
        products = await ctx.catalog.search(chat.lat, chat.lng, query, price, limit)
        if not products and price is not None:
            # Over budget is not the same as unavailable: say so, and do not record it as unmet demand.
            above = await ctx.catalog.search(chat.lat, chat.lng, query, None, 3)
            if above:
                cheapest = min((p.get("price") for p in above if isinstance(p.get("price"), (int, float))), default=None)
                return _dumps({
                    "results": [],
                    "note": f"Nothing matching '{query}' nearby is at or under Rs {price:g}.",
                    "cheapestNearbyPrice": cheapest,
                })
        if not products:
            ctx.zero_result_queries.append(query)
            return _dumps({"results": [], "note": f"Nothing matching '{query}' is stocked within delivery range of {area}."})
        remember(products)
        await ctx.emit({"type": "products", "products": products})
        in_stock = [p for p in products if (p.get("nearbyStock") or p.get("stock") or 0) > 0]
        return _dumps({"results": [_compact(p) for p in products], "inStockCount": len(in_stock), "shownToCustomerAsCards": True})

    @tool
    async def check_local_inventory(product_id: str) -> str:
        """Check live stock, price and delivery time of one product at stores near the customer.

        Args:
            product_id: The product id (UUID) from a search result.
        """
        ctx.tool_calls.append("check_local_inventory")
        if not UUID_RE.match(product_id.strip()):
            return "That is not a valid product id. Use an id from search_catalog results."
        product = await ctx.catalog.product(chat.lat, chat.lng, product_id.strip())
        if not product:
            return _dumps({"available": False, "note": f"No store within delivery range of {area} lists this product."})
        remember([product])
        stock = product.get("nearbyStock", product.get("stock")) or 0
        return _dumps({"available": stock > 0, **_compact(product)})

    @tool
    async def add_to_cart(product_id: str, quantity: int = 1) -> str:
        """Offer to put a product in the customer's cart. The customer sees a card and must tap Confirm.

        Only use when the customer asked to add or buy something.

        Args:
            product_id: The product id (UUID) from a search result.
            quantity: Units to add, 1 to 50.
        """
        ctx.tool_calls.append("add_to_cart")
        if not UUID_RE.match(product_id.strip()):
            return "That is not a valid product id. Use an id from search_catalog results."
        product = await ctx.catalog.product(chat.lat, chat.lng, product_id.strip())
        stock = int((product or {}).get("nearbyStock", (product or {}).get("stock")) or 0)
        if not product or stock <= 0:
            return _dumps({"proposed": False, "note": "This product is out of stock near the customer. Suggest an in-stock alternative."})
        wanted = max(1, int(quantity))
        qty = min(wanted, stock, MAX_PER_LINE)
        remember([product])
        await ctx.emit({"type": "action", "action": {"kind": "add_to_cart", "productId": product["id"], "quantity": qty, "product": product}})
        note = "Shown to the customer with a Confirm button; it is not in the cart until they tap it."
        if qty < wanted:
            note += f" Only {qty} can be added (nearby stock or the per-item limit)."
        return _dumps({"proposed": True, "quantity": qty, "name": product.get("name"), "note": note})

    @tool
    async def navigate_to(page: Literal[
        "cart", "checkout", "orders", "fabrication", "catalog", "compare", "wishlist",
        "datasheets", "contact", "warranty", "profile", "product",
    ], product_id: str | None = None) -> str:
        """Show a button that opens a page of the store. Only use when they ask to go somewhere.
        The page does not open until they tap the button.

        Args:
            page: Which page to open. "product" needs product_id.
            product_id: Product id (UUID), only for page="product".
        """
        ctx.tool_calls.append("navigate_to")
        if page == "product":
            if not product_id or not UUID_RE.match(product_id.strip()):
                return "A product page needs a valid product id from search results."
            path = f"/product/{product_id.strip().lower()}"
        else:
            path = PAGES[page]
        await ctx.emit({"type": "action", "action": {"kind": "navigate", "path": path}})
        return _dumps({"buttonShown": True, "path": path, "note": "The page opens when the customer taps the button. Tell them to tap it."})

    @tool
    async def check_cart_compatibility() -> str:
        """Check the customer's current cart for missing companion parts and electrical mismatches."""
        ctx.tool_calls.append("check_cart_compatibility")
        if not chat.cart:
            return "The cart is empty."
        findings = check_cart(chat.cart)
        if not findings:
            return _dumps({"issues": [], "cart": [line.name for line in chat.cart]})
        return _dumps({"issues": [f.to_dict() for f in findings]})

    @tool
    async def get_my_orders() -> str:
        """Look up the signed-in customer's five most recent orders and their delivery status."""
        ctx.tool_calls.append("get_my_orders")
        if not chat.signedIn or not chat.authorization:
            return "The customer is not signed in. Ask them to sign in to see their orders."
        try:
            orders = await ctx.catalog.orders(chat.authorization, limit=5)
        except NotSignedIn:
            return "The customer's session has expired. Ask them to sign in again."
        # An explicit allow-list: order payloads also carry the handover OTP and the delivery address.
        summary = [
            {
                "orderNumber": o.get("orderNumber"),
                "status": ORDER_STATUS_LABEL.get(str(o.get("status")), str(o.get("status") or "Unknown")),
                "placedAt": o.get("createdAt"),
                "total": o.get("grandTotal"),
                "etaMinutes": o.get("etaMinutes") if o.get("status") == "out_for_delivery" else None,
                "items": [str(i.get("name"))[:80] for i in (o.get("items") or [])[:4]],
            }
            for o in orders[:5]
        ]
        return _dumps({"orders": summary} if summary else {"orders": [], "note": "No orders yet."})

    return [search_catalog, check_local_inventory, add_to_cart, navigate_to, check_cart_compatibility, get_my_orders]


def tool_error_message(err: Exception) -> str:
    if isinstance(err, httpx.HTTPError):
        return "The store catalog did not respond. Apologise briefly and suggest trying again in a moment."
    return "That lookup failed. Answer without it."
