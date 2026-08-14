import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

api_key = os.getenv("OPENROUTER_API_KEY")
model = os.getenv("MODEL_NAME", "openrouter/free")

if not api_key:
    raise ValueError("OPENROUTER_API_KEY is missing from .env")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

response = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "user",
            "content": """
You are an AI assistant for an Account Manager.

A university customer has low product adoption
and their contract expires in three months.

Identify the main customer risk in one sentence.
"""
        }
    ],
)

print(response.choices[0].message.content)