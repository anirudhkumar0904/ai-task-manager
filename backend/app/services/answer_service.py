"""
Answer Synthesis Service
------------------------
Optional layer on top of semantic search. The embedding + FAISS retrieval
pipeline (embedding_service.py) remains the actual search engine and does
all the core retrieval work. This module ONLY takes already-retrieved
chunks and asks an LLM (via Groq) to write a short, direct answer grounded
in that retrieved text — it never searches or ranks anything itself.

If GROQ_ENABLED is false or no API key is set, callers should just skip
this and show raw retrieval results, exactly as before.
"""
from __future__ import annotations

import logging
from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Groq | None = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY)
    return _client


SYSTEM_PROMPT = (
    "You are a precise, friendly workplace assistant. Answer the user's "
    "question using ONLY the provided document excerpts.\n"
    "Rules:\n"
    "1. Answer directly and naturally in 1-3 sentences, like a helpful "
    "colleague, not like you're quoting a document.\n"
    "2. Lead with the actual answer (the number, the policy, the fact) "
    "before any extra detail.\n"
    "3. If the excerpts don't contain the answer, say so plainly and "
    "suggest what the person could ask instead - never invent information.\n"
    "4. Never mention the words 'excerpt', 'document', 'context', or "
    "'chunk' in your reply."
)


def synthesize_answer(query: str, chunks: list[dict]) -> str | None:
    """Given the user's query and the chunks already retrieved by FAISS,
    ask the LLM to write a direct answer. Returns None on any failure or
    if Groq isn't configured, so callers can gracefully fall back to
    showing raw chunks."""
    if not settings.GROQ_ENABLED or not settings.GROQ_API_KEY:
        return None
    if not chunks:
        return None

    context = "\n\n---\n\n".join(
        f"[{c['document_title']}]\n{c['chunk_text']}" for c in chunks[:3]
    )

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Document excerpts:\n\n{context}\n\nQuestion: {query}",
                },
            ],
            temperature=0.1,
            max_tokens=200,
        )
        answer = response.choices[0].message.content.strip()
        print(f"[GROQ] Synthesis OK for query='{query}': {answer[:80]}...", flush=True)
        return answer
    except Exception as exc:  # noqa: BLE001 - synthesis is best-effort
        # print() always reaches `docker compose logs`, unlike logger.warning()
        # which can be silently dropped without explicit logging config.
        print(f"[GROQ] Synthesis FAILED for query='{query}': {type(exc).__name__}: {exc}", flush=True)
        logger.warning("Groq answer synthesis failed, falling back to raw chunks: %s", exc)
        return None
