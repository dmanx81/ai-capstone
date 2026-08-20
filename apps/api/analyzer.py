import json
import os

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import ValidationError

from apps.api.prompts import SYSTEM_PROMPT
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


def analyze_account(customer_text):
    client = get_client()

    model = get_configured_model_name()

    messages = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": customer_text,
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