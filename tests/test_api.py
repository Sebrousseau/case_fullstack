"""
Tests automatisés — Data Analysis Agent API
"""

import pytest
from httpx import AsyncClient, ASGITransport

# ---------------------------------------------------------------------------
# ThinkingStreamParser tests
# ---------------------------------------------------------------------------

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api import ThinkingStreamParser


class TestThinkingStreamParser:

    def test_plain_text_no_tags(self):
        """Texte sans balise thinking — tout sort en 'text'."""
        parser = ThinkingStreamParser()
        results = parser.feed("Bonjour, voici la réponse.")
        results += parser.flush()
        kinds = [k for k, _ in results]
        content = "".join(c for _, c in results)
        assert all(k == "text" for k in kinds)
        assert "Bonjour" in content

    def test_thinking_block_single_chunk(self):
        """Balise thinking complète dans un seul chunk."""
        parser = ThinkingStreamParser()
        results = parser.feed("<thinking>Je réfléchis.</thinking>Réponse finale.")
        results += parser.flush()

        thinking = "".join(c for k, c in results if k == "thinking")
        text = "".join(c for k, c in results if k == "text")

        assert "Je réfléchis." in thinking
        assert "Réponse finale." in text

    def test_thinking_block_split_across_chunks(self):
        """Balise thinking répartie sur plusieurs chunks (cas réel du streaming)."""
        parser = ThinkingStreamParser()
        chunks = [
            "<think",
            "ing>",
            "Analyse en cours.",
            "</think",
            "ing>",
            "Voici le résultat.",
        ]
        results = []
        for chunk in chunks:
            results += parser.feed(chunk)
        results += parser.flush()

        thinking = "".join(c for k, c in results if k == "thinking")
        text = "".join(c for k, c in results if k == "text")

        assert "Analyse en cours." in thinking
        assert "Voici le résultat." in text

    def test_multiple_thinking_blocks(self):
        """Plusieurs blocs thinking successifs."""
        parser = ThinkingStreamParser()
        content = (
            "<thinking>Étape 1.</thinking>"
            "Intermédiaire."
            "<thinking>Étape 2.</thinking>"
            "Conclusion."
        )
        results = parser.feed(content)
        results += parser.flush()

        thinking = "".join(c for k, c in results if k == "thinking")
        text = "".join(c for k, c in results if k == "text")

        assert "Étape 1." in thinking
        assert "Étape 2." in thinking
        assert "Intermédiaire." in text
        assert "Conclusion." in text

    def test_empty_input(self):
        """Feed vide ne produit rien."""
        parser = ThinkingStreamParser()
        results = parser.feed("")
        assert results == []

    def test_flush_empty_parser(self):
        """Flush sur parser vide ne produit rien."""
        parser = ThinkingStreamParser()
        results = parser.flush()
        assert results == []

    def test_unclosed_thinking_tag(self):
        """Balise thinking non fermée — flush émet le contenu comme thinking."""
        parser = ThinkingStreamParser()
        parser.feed("<thinking>Réflexion inachevée")
        results = parser.flush()
        kinds = [k for k, _ in results]
        assert "thinking" in kinds

    def test_text_before_thinking(self):
        """Texte avant une balise thinking."""
        parser = ThinkingStreamParser()
        results = parser.feed("Intro.<thinking>Pensée.</thinking>Fin.")
        results += parser.flush()

        text = "".join(c for k, c in results if k == "text")
        thinking = "".join(c for k, c in results if k == "thinking")

        assert "Intro." in text
        assert "Fin." in text
        assert "Pensée." in thinking


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_check():
    """L'endpoint /api/health retourne status ok et la liste des datasets."""
    from api import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "datasets" in data
    assert isinstance(data["datasets"], list)


@pytest.mark.asyncio
async def test_chat_missing_question():
    """L'endpoint /api/chat retourne 422 si 'question' est absent."""
    from api import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/chat", json={})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_returns_stream():
    """L'endpoint /api/chat retourne bien un content-type SSE."""
    from api import app

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        async with client.stream(
            "POST", "/api/chat", json={"question": "combien de lignes dans sales?"}
        ) as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
