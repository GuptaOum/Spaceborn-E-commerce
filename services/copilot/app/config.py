import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    return int(raw) if raw else default


@dataclass(frozen=True)
class Settings:
    # Shared secret the Node gateway sends in X-Internal-Token. Required: this service has no other auth.
    internal_token: str
    # Base URL of the Node API, used for catalog and order lookups (e.g. http://api.spaceborn.internal:4000).
    api_url: str
    aws_region: str
    model_id: str
    max_tokens: int
    request_timeout_s: int
    max_tool_rounds: int


def load_settings() -> Settings:
    token = os.environ.get("COPILOT_TOKEN", "")
    if len(token) < 24:
        raise RuntimeError("COPILOT_TOKEN must be set to a secret of at least 24 characters")
    return Settings(
        internal_token=token,
        api_url=os.environ.get("CATALOG_API_URL", "http://localhost:4000").rstrip("/"),
        aws_region=os.environ.get("AWS_REGION", "ap-south-1"),
        model_id=os.environ.get("BEDROCK_CHAT_MODEL", "global.amazon.nova-2-lite-v1:0"),
        max_tokens=_int("COPILOT_MAX_TOKENS", 900),
        request_timeout_s=_int("COPILOT_TIMEOUT_SECONDS", 40),
        max_tool_rounds=_int("COPILOT_MAX_TOOL_ROUNDS", 4),
    )
