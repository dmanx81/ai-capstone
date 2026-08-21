import json
import logging
import os
import time

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

from apps.api.prompts import (
    RELATIONSHIP_QA_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_enriched_analysis_prompt,
    build_relationship_context,
)
from apps.api.schemas import AccountBrief


logger = logging.getLogger("apps.api.analyzer")
load_dotenv()


def get_client():
    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        raise ValueError(
            "OPENROUTER_API_KEY is missing from the .env file"
        )

    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )


def get_configured_model_name():
    return os.getenv("MODEL_NAME", "openrouter/free")


def get_fallback_model_name():
    return os.getenv("MODEL_FALLBACK_NAME", "").strip()


def get_llm_timeout_seconds():
    return max(5, min(60, int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))))


def get_llm_max_retries():
    return max(0, min(5, int(os.getenv("LLM_MAX_RETRIES", "2"))))


def get_model_candidates():
    primary = get_configured_model_name()
    fallback = get_fallback_model_name()
    candidates = [primary]
    if fallback and fallback != primary:
        candidates.append(fallback)
    return candidates


def _is_retryable_error(error):
    message = str(error).lower()
    retryable_markers = (
        "timeout",
        "timed out",
        "rate limit",
        "temporarily unavailable",
        "too many requests",
        "connection",
        "overloaded",
        "server error",
        "internal",
        "429",
    )
    return any(marker in message for marker in retryable_markers)


def _create_chat_completion(client, *, model, messages, temperature):
    timeout_seconds = get_llm_timeout_seconds()
    max_retries = get_llm_max_retries()

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                timeout=timeout_seconds,
            ), model
        except Exception as error:  # pragma: no cover - exercised by provider mocks
            last_error = error
            if not _is_retryable_error(error) or attempt >= max_retries:
                raise
            backoff_seconds = min(2 ** attempt, 4)
            time.sleep(backoff_seconds)
    raise last_error


def _invoke_chat_completion_with_fallback(messages, temperature):
    candidates = get_model_candidates()
    last_error = None

    for model_name in candidates:
        client = get_client()
        try:
            response, model_used = _create_chat_completion(
                client,
                model=model_name,
                messages=messages,
                temperature=temperature,
            )
            return response, model_used
        except Exception as error:  # pragma: no cover - exercised by provider mocks
            last_error = error
            logger.warning(
                "LLM model failure model=%s error_category=%s fallback_available=%s",
                model_name,
                type(error).__name__,
                model_name != candidates[-1],
            )
            if model_name == candidates[-1]:
                raise last_error

    raise last_error


def clean_json_response(text):
    text = text.strip()

    if text.startswith("```json"):
        text = text[7:]

    elif text.startswith("```"):
        text = text[3:]

    if text.endswith("```"):
        text = text[:-3]

    return text.strip()


def validate_response(raw_response):
    cleaned_response = clean_json_response(raw_response)

    data = json.loads(cleaned_response)

    return AccountBrief.model_validate(data)


def analyze_account(customer_text, historical_chunks=None, return_model_used=False):
    user_content = (
        customer_text
        if historical_chunks is None
        else build_enriched_analysis_prompt(customer_text, historical_chunks)
    )
    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": user_content,
        },
    ]

    response, model_used = _invoke_chat_completion_with_fallback(messages, 0.2)
    raw_response = response.choices[0].message.content

    try:
        brief = validate_response(raw_response)
        if return_model_used:
            return brief, model_used
        return brief

    except (json.JSONDecodeError, ValidationError) as error:

        retry_message = f"""
Your previous response was invalid.

Validation error:
{error}

Return the answer again.

Important:
- Return ONLY valid JSON.
- Do not include Markdown.
- Do not include ```json fences.
- Follow the required schema exactly.
"""

        messages.append({"role": "assistant", "content": raw_response})
        messages.append({"role": "user", "content": retry_message})

        retry_response, retry_model = _invoke_chat_completion_with_fallback(messages, 0.1)
        retry_raw_response = retry_response.choices[0].message.content

        try:
            brief = validate_response(retry_raw_response)
            if return_model_used:
                return brief, retry_model
            return brief
        except (json.JSONDecodeError, ValidationError):
            logger.warning("LLM response validation failed on model=%s", retry_model)
            raise


def answer_relationship_question(question, context, return_model_used=False):
    context_text = build_relationship_context(context)
    messages = [
        {"role": "system", "content": RELATIONSHIP_QA_SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                "QUESTION:\n"
                f"{question}\n\n"
                "SUPPLIED RELATIONSHIP CONTEXT:\n"
                f"{context_text}"
            ),
        },
    ]
    response, model_used = _invoke_chat_completion_with_fallback(messages, 0.1)
    answer = response.choices[0].message.content
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("The answer provider returned no answer")
    sanitized = answer.strip()
    if return_model_used:
        return sanitized, model_used
    return sanitized