from typing import Any, Protocol

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


class OpenAILLM:
    name = "openai"

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        import json

        import httpx

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
            timeout=60.0,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return json.loads(content)


class AnthropicLLM:
    name = "anthropic"

    def complete_json(self, system: str, user: str) -> dict[str, Any]:
        import json

        import httpx

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
            timeout=60.0,
        )
        response.raise_for_status()
        text = response.json()["content"][0]["text"]
        start = text.find("{")
        end = text.rfind("}")
        return json.loads(text[start : end + 1])


def get_llm() -> LLMProvider:
    if settings.llm_provider == "openai":
        return OpenAILLM()
    if settings.llm_provider == "anthropic":
        return AnthropicLLM()
    return GroundedLLM()
