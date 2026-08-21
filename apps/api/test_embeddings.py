import os
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from apps.api.embeddings import EMBEDDING_DIMENSION, chunk_text, embed_chunks, ingest_interaction_memory


class EmbeddingTests(unittest.TestCase):
    def test_short_text_is_one_non_empty_chunk(self):
        self.assertEqual(chunk_text("A short interaction."), ["A short interaction."])

    def test_long_text_is_ordered_and_overlapping(self):
        text = "0123456789" * 260
        chunks = chunk_text(text, chunk_size=100, overlap=10)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunks))
        self.assertEqual(chunks[0][-10:], chunks[1][:10])

    def test_wrong_embedding_dimension_is_rejected(self):
        response = SimpleNamespace(
            data=[SimpleNamespace(index=0, embedding=[0.0] * (EMBEDDING_DIMENSION - 1))]
        )
        client = Mock()
        client.embeddings.create.return_value = response
        with patch("apps.api.embeddings.get_embedding_client", return_value=client):
            with self.assertRaises(ValueError):
                embed_chunks(["one chunk"])

    def test_ingestion_replaces_existing_chunks_and_uses_caller_jwt(self):
        embedding = [0.0] * EMBEDDING_DIMENSION
        with patch.dict(
            os.environ,
            {
                "SUPABASE_URL": "https://example.supabase.co",
                "SUPABASE_PUBLISHABLE_KEY": "publishable",
            },
        ), patch("apps.api.embeddings.embed_chunks", return_value=[embedding]), patch(
            "apps.api.embeddings.requests.delete"
        ) as delete, patch("apps.api.embeddings.requests.post") as post:
            result = ingest_interaction_memory(
                "00000000-0000-0000-0000-000000000001",
                "00000000-0000-0000-0000-000000000002",
                "A sufficiently long interaction note.",
                "caller.jwt.value",
            )
        self.assertEqual(result.chunks_created, 1)
        self.assertEqual(delete.call_args.kwargs["headers"]["Authorization"], "Bearer caller.jwt.value")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer caller.jwt.value")


if __name__ == "__main__":
    unittest.main()