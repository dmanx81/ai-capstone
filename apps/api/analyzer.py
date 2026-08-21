import json
import os

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


def analyze_account(customer_text, historical_chunks=None):
    client = get_client()

    model = get_configured_model_name()

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

    # First attempt
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
    )

    raw_response = response.choices[0].message.content

    try:
        return validate_response(raw_response)

    except (json.JSONDecodeError, ValidationError) as error:

        print("\nFirst response failed validation.")
        print("Retrying once...\n")

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

        messages.append(
            {
                "role": "assistant",
                "content": raw_response,
            }
        )

        messages.append(
            {
                "role": "user",
                "content": retry_message,
            }
        )

        # Second attempt
        retry_response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.1,
        )

        retry_raw_response = (
            retry_response.choices[0].message.content
        )

        try:
            return validate_response(retry_raw_response)

        except (json.JSONDecodeError, ValidationError):

            print("\nSecond response also failed validation.\n")
            print(retry_raw_response)

            raise


def answer_relationship_question(question, context):
    client = get_client()
    context_text = build_relationship_context(context)
    response = client.chat.completions.create(
        model=get_configured_model_name(),
        messages=[
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
        ],
        temperature=0.1,
    )
    answer = response.choices[0].message.content
    if not isinstance(answer, str) or not answer.strip():
        raise ValueError("The answer provider returned no answer")
    return answer.strip()