from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)


class CartLine(BaseModel):
    model_config = ConfigDict(extra="ignore")

    productId: str = Field(max_length=64)
    name: str = Field(max_length=300)
    category: str | None = Field(default=None, max_length=120)
    quantity: int = Field(ge=1, le=1000)
    price: float | None = None


class ShownProduct(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=200)


class ChatContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Set by the gateway from the customer's delivery location. Tools never let the model choose another.
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    areaLabel: str | None = Field(default=None, max_length=120)
    signedIn: bool = False
    userName: str | None = Field(default=None, max_length=80)
    cart: list[CartLine] = Field(default_factory=list, max_length=40)
    # Products shown earlier in this conversation, newest first, so follow-ups can refer to them.
    recentProducts: list[ShownProduct] = Field(default_factory=list, max_length=12)
    # The customer's own Authorization header, relayed so order lookups run with their permissions.
    authorization: str | None = Field(default=None, max_length=4096)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = Field(default_factory=list, max_length=24)
    context: ChatContext
