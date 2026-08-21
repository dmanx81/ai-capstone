import os
import sys
from typing import Any

import requests


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from apps.api.embeddings import chunk_text, embed_chunks, persist_chunks  # noqa: E402


def get_rows(endpoint: str, headers: dict, table: str) -> list[dict[str, Any]]:
    select = "id,account_id,raw_text" if table == "interactions" else "interaction_id"
    response = requests.get(
        f"{endpoint}/{table}",
        headers=headers,
        params={"select": select, "limit": 1000},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def main() -> None:
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase_url = os.getenv("SUPABASE_URL")
    if not service_role_key or not supabase_url:
        raise SystemExit(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this admin-only script"
        )

    endpoint = f"{supabase_url.rstrip('/')}/rest/v1"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
    }
    interactions = get_rows(endpoint, headers, "interactions")
    existing = get_rows(endpoint, headers, "chunks")
    existing_interactions = {row["interaction_id"] for row in existing}

    for interaction in interactions:
        interaction_id = interaction["id"]
        if interaction_id in existing_interactions:
            print(f"skip interaction_id={interaction_id} reason=already_ingested")
            continue

        try:
            chunks = chunk_text(interaction["raw_text"])
            embeddings = embed_chunks(chunks)
            result = persist_chunks(
                interaction["account_id"],
                interaction_id,
                chunks,
                embeddings,
                service_role_key,
                api_key=service_role_key,
            )
            print(f"ingested interaction_id={interaction_id} chunks={result.chunks_created}")
        except Exception as error:
            print(
                f"failed interaction_id={interaction_id} error_category={type(error).__name__}",
                file=sys.stderr,
            )


if __name__ == "__main__":
    main()