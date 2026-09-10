import time
from typing import Any, Protocol

import httpx

from app.config import get_settings

settings = get_settings()


class LLMProvider(Protocol):
    name: str

    def complete_json(self, system: str, user: str) -> dict[str, Any]: ...


class GroundedLLM:
    """Placeholder provider — callers must not invent facts; they assemble from DB."""

    name = "grounded"

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        raise NotImplementedError("Grounded provider does not call an LLM")


def _request_json(send) -> dict[str, Any]:
    last_error: Exception | None = None
    attempts = max(1, settings.llm_retries + 1)
    for attempt in range(attempts):
        try:
            return send()
        except (httpx.TimeoutException, httpx.HTTPError, ValueError) as exc:
            last_error = exc
            if attempt < attempts - 1:
                time.sleep(0.4 * (attempt + 1))
    raise last_error or RuntimeError("LLM request failed")


class OpenAILLM:
    name = "openai"

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        import json

        def send() -> dict[str, Any]:
            response = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": settings.openai_model,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            if not isinstance(parsed, dict):
                raise ValueError("LLM did not return a JSON object")
            return parsed

        return _request_json(send)


class AnthropicLLM:
    name = "anthropic"

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        import json

        def send() -> dict[str, Any]:
            response = httpx.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": 2500,
                    "temperature": 0.1,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
                timeout=settings.llm_timeout_seconds,
            )
            response.raise_for_status()
            text = response.json()["content"][0]["text"]
            start = text.find("{")
            end = text.rfind("}")
            parsed = json.loads(text[start : end + 1])
            if not isinstance(parsed, dict):
                raise ValueError("LLM did not return a JSON object")
            return parsed

        return _request_json(send)


def get_llm() -> LLMProvider:
    if settings.llm_provider == "openai":
        return OpenAILLM()
    if settings.llm_provider == "anthropic":
        return AnthropicLLM()
    return GroundedLLM()
