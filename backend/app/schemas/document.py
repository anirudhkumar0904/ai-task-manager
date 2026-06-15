from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DocumentResponse(BaseModel):
    id: int
    title: str
    original_filename: str
    file_size: Optional[int]
    mime_type: Optional[str]
    content_preview: Optional[str]
    chunk_count: int
    is_indexed: bool
    uploaded_by_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentResponse]
    total: int
