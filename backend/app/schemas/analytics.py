from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5


class SearchResult(BaseModel):
    document_id: int
    document_title: str
    chunk_text: str
    score: float
    rank: int


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    total_results: int
    search_time_ms: float


# ── Analytics ──────────────────────────────────────────────────────────────────

class TaskStats(BaseModel):
    total: int
    pending: int
    in_progress: int
    completed: int
    completion_rate: float


class SearchStats(BaseModel):
    total_searches: int
    top_queries: list[dict]


class UserStats(BaseModel):
    total_users: int
    active_users: int
    admin_count: int
    user_count: int


class DocumentStats(BaseModel):
    total_documents: int
    indexed_documents: int
    total_chunks: int


class AnalyticsResponse(BaseModel):
    tasks: TaskStats
    searches: SearchStats
    users: UserStats
    documents: DocumentStats
    recent_activity: list[dict]
