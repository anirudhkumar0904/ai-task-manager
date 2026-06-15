"""
Semantic Search Service
-----------------------
* Splits documents into overlapping chunks
* Embeds them with sentence-transformers (all-MiniLM-L6-v2)
* Stores / loads a FAISS flat index persisted to disk
* Returns ranked results with cosine similarity scores
"""
from __future__ import annotations

import json
import time
import logging
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────
CHUNK_SIZE = 300          # tokens-ish (words)
CHUNK_OVERLAP = 50
EMBEDDING_DIM = 384       # all-MiniLM-L6-v2 output dimension


class EmbeddingService:
    """Singleton that holds the model + FAISS index in memory."""

    _instance: Optional["EmbeddingService"] = None

    def __new__(cls) -> "EmbeddingService":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialised = False
        return cls._instance

    def _init(self) -> None:
        if self._initialised:
            return
        logger.info("Loading embedding model: %s", settings.EMBEDDING_MODEL)
        self.model = SentenceTransformer(settings.EMBEDDING_MODEL)
        self.index: faiss.IndexFlatIP = faiss.IndexFlatIP(EMBEDDING_DIM)   # Inner-product ≈ cosine after normalise
        self.chunks: list[dict] = []   # [{doc_id, doc_title, text, chunk_idx}]
        self._load_from_disk()
        self._initialised = True
        logger.info("Embedding service ready. Chunks in index: %d", len(self.chunks))

    # ── Persistence ────────────────────────────────────────────────────────────

    @property
    def _index_path(self) -> Path:
        return settings.vector_store_path / "faiss.index"

    @property
    def _meta_path(self) -> Path:
        return settings.vector_store_path / "chunks.json"

    def _load_from_disk(self) -> None:
        if self._index_path.exists() and self._meta_path.exists():
            self.index = faiss.read_index(str(self._index_path))
            with open(self._meta_path) as f:
                self.chunks = json.load(f)
            logger.info("Loaded %d chunks from disk", len(self.chunks))

    def _save_to_disk(self) -> None:
        faiss.write_index(self.index, str(self._index_path))
        with open(self._meta_path, "w") as f:
            json.dump(self.chunks, f, ensure_ascii=False)

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _split_text(self, text: str) -> list[str]:
        words = text.split()
        chunks = []
        start = 0
        while start < len(words):
            end = min(start + CHUNK_SIZE, len(words))
            chunks.append(" ".join(words[start:end]))
            if end == len(words):
                break
            start += CHUNK_SIZE - CHUNK_OVERLAP
        return chunks

    def _embed(self, texts: list[str]) -> np.ndarray:
        vecs = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        # L2-normalise so inner product == cosine similarity
        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        return (vecs / norms).astype(np.float32)

    # ── Public API ─────────────────────────────────────────────────────────────

    def index_document(self, doc_id: int, doc_title: str, text: str) -> int:
        """Add a document to the index; returns number of chunks indexed."""
        self._init()
        raw_chunks = self._split_text(text)
        if not raw_chunks:
            return 0

        embeddings = self._embed(raw_chunks)
        self.index.add(embeddings)

        for i, chunk in enumerate(raw_chunks):
            self.chunks.append({
                "doc_id": doc_id,
                "doc_title": doc_title,
                "text": chunk,
                "chunk_idx": i,
            })

        self._save_to_disk()
        logger.info("Indexed doc %d (%d chunks)", doc_id, len(raw_chunks))
        return len(raw_chunks)

    def remove_document(self, doc_id: int) -> None:
        """Remove all chunks for a document and rebuild the index."""
        self._init()
        keep = [c for c in self.chunks if c["doc_id"] != doc_id]
        if len(keep) == len(self.chunks):
            return  # nothing to remove

        self.chunks = []
        self.index = faiss.IndexFlatIP(EMBEDDING_DIM)

        if keep:
            texts = [c["text"] for c in keep]
            embeddings = self._embed(texts)
            self.index.add(embeddings)
            self.chunks = keep

        self._save_to_disk()
        logger.info("Removed doc %d from index", doc_id)

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """Return top-k chunks with cosine similarity scores."""
        self._init()
        if self.index.ntotal == 0:
            return []

        q_vec = self._embed([query])
        k = min(top_k, self.index.ntotal)
        scores, indices = self.index.search(q_vec, k)

        results = []
        for rank, (idx, score) in enumerate(zip(indices[0], scores[0]), start=1):
            if idx == -1:
                continue
            chunk = self.chunks[idx]
            results.append({
                "document_id": chunk["doc_id"],
                "document_title": chunk["doc_title"],
                "chunk_text": chunk["text"],
                "score": float(score),
                "rank": rank,
            })
        return results

    def get_stats(self) -> dict:
        self._init()
        return {
            "total_chunks": self.index.ntotal,
            "unique_documents": len({c["doc_id"] for c in self.chunks}),
        }


# Module-level singleton
embedding_service = EmbeddingService()
