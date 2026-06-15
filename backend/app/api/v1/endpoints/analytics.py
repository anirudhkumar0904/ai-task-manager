from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.models.document import Document
from app.models.activity_log import ActivityLog, ActionType
from app.schemas.analytics import (
    AnalyticsResponse, TaskStats, SearchStats, UserStats, DocumentStats
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # ── Task stats ──────────────────────────────────────────────────────────
    total_tasks = db.query(Task).count()
    pending = db.query(Task).filter(Task.status == TaskStatus.pending).count()
    in_progress = db.query(Task).filter(Task.status == TaskStatus.in_progress).count()
    completed = db.query(Task).filter(Task.status == TaskStatus.completed).count()
    completion_rate = round((completed / total_tasks * 100), 1) if total_tasks else 0.0

    task_stats = TaskStats(
        total=total_tasks,
        pending=pending,
        in_progress=in_progress,
        completed=completed,
        completion_rate=completion_rate,
    )

    # ── Search stats ────────────────────────────────────────────────────────
    total_searches = (
        db.query(ActivityLog).filter(ActivityLog.action == ActionType.search).count()
    )

    # Top 5 queries from metadata JSON
    search_logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.action == ActionType.search, ActivityLog.metadata_.isnot(None))
        .order_by(ActivityLog.created_at.desc())
        .limit(200)
        .all()
    )
    query_counts: dict[str, int] = {}
    for log in search_logs:
        q = (log.metadata_ or {}).get("query", "")
        if q:
            query_counts[q] = query_counts.get(q, 0) + 1

    top_queries = sorted(
        [{"query": k, "count": v} for k, v in query_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    search_stats = SearchStats(total_searches=total_searches, top_queries=top_queries)

    # ── User stats ──────────────────────────────────────────────────────────
    from app.models.role import Role

    total_users = db.query(User).count()
    active_users = db.query(User).filter(User.is_active == True).count()
    admin_count = (
        db.query(User).join(Role).filter(Role.name == "admin").count()
    )

    user_stats = UserStats(
        total_users=total_users,
        active_users=active_users,
        admin_count=admin_count,
        user_count=total_users - admin_count,
    )

    # ── Document stats ──────────────────────────────────────────────────────
    total_docs = db.query(Document).count()
    indexed_docs = db.query(Document).filter(Document.is_indexed == True).count()
    total_chunks = db.query(func.sum(Document.chunk_count)).scalar() or 0

    doc_stats = DocumentStats(
        total_documents=total_docs,
        indexed_documents=indexed_docs,
        total_chunks=int(total_chunks),
    )

    # ── Recent activity ─────────────────────────────────────────────────────
    recent = (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        {
            "id": a.id,
            "action": a.action,
            "description": a.description,
            "user_id": a.user_id,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in recent
    ]

    return AnalyticsResponse(
        tasks=task_stats,
        searches=search_stats,
        users=user_stats,
        documents=doc_stats,
        recent_activity=recent_activity,
    )
