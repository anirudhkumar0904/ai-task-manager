import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.schemas.analytics import SearchRequest, SearchResponse, SearchResult
from app.services.embedding_service import embedding_service
from app.services.activity_service import log_activity
from app.models.activity_log import ActionType

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=SearchResponse)
def semantic_search(
    payload: SearchRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start = time.perf_counter()
    raw = embedding_service.search(payload.query, top_k=payload.top_k)
    elapsed_ms = (time.perf_counter() - start) * 1000

    results = [SearchResult(**r) for r in raw]

    log_activity(
        db,
        action=ActionType.search,
        user_id=current_user.id,
        description=f"Search: '{payload.query}'",
        metadata={"query": payload.query, "result_count": len(results)},
    )

    return SearchResponse(
        query=payload.query,
        results=results,
        total_results=len(results),
        search_time_ms=round(elapsed_ms, 2),
    )
