"""Talks to the Node API over the private network. The copilot never touches the database itself."""

from typing import Any

import httpx


class NotSignedIn(Exception):
    pass


class CatalogClient:
    def __init__(self, base_url: str, http: httpx.AsyncClient | None = None) -> None:
        self._http = http or httpx.AsyncClient(
            base_url=base_url,
            timeout=httpx.Timeout(6.0, connect=2.0),
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            headers={"User-Agent": "spaceborn-copilot"},
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    async def search(self, lat: float, lng: float, query: str, max_price: float | None, limit: int) -> list[dict[str, Any]]:
        params: dict[str, Any] = {"lat": lat, "lng": lng, "q": query[:80], "limit": limit}
        if max_price is not None:
            params["maxPrice"] = max_price
        res = await self._http.get("/v1/catalog/products", params=params)
        res.raise_for_status()
        return list(res.json().get("products", []))

    async def product(self, lat: float, lng: float, product_id: str) -> dict[str, Any] | None:
        res = await self._http.get(f"/v1/catalog/products/{product_id}", params={"lat": lat, "lng": lng})
        if res.status_code in (400, 404):
            return None
        res.raise_for_status()
        return res.json().get("product")

    async def orders(self, authorization: str, limit: int = 5) -> list[dict[str, Any]]:
        res = await self._http.get("/v1/orders", params={"limit": limit}, headers={"Authorization": authorization})
        if res.status_code in (401, 403):
            raise NotSignedIn()
        res.raise_for_status()
        return list(res.json().get("orders", []))
