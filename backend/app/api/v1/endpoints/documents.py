import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import Document
from app.core.security import require_admin, get_current_user
from app.core.config import settings
from app.schemas.document import DocumentResponse, DocumentListResponse
from app.services.embedding_service import embedding_service
from app.services.activity_service import log_activity
from app.models.activity_log import ActionType

router = APIRouter(prefix="/documents", tags=["Documents"])

ALLOWED_MIME_TYPES = {"text/plain", "application/pdf"}
MAX_BYTES = settings.MAX_FILE_SIZE_MB * 1024 * 1024


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Validate type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Only .txt and .pdf files are supported")

    content = await file.read()
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.MAX_FILE_SIZE_MB} MB limit")

    # Decode text
    if file.content_type == "text/plain":
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")
    else:
        # Basic PDF text extraction without dependencies
        text = _extract_pdf_text(content)

    # Persist file
    safe_name = f"{current_user.id}_{file.filename.replace(' ', '_')}"
    file_path = settings.upload_path / safe_name
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    # Save metadata
    doc = Document(
        title=title,
        original_filename=file.filename,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=file.content_type,
        content_preview=text[:500] if text else "",
        uploaded_by_id=current_user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Index for semantic search
    chunk_count = embedding_service.index_document(doc.id, doc.title, text)
    doc.chunk_count = chunk_count
    doc.is_indexed = chunk_count > 0
    db.commit()
    db.refresh(doc)

    log_activity(db, action=ActionType.document_upload, user_id=current_user.id,
                 entity_type="document", entity_id=doc.id,
                 description=f"Document '{doc.title}' uploaded ({chunk_count} chunks)")

    return DocumentResponse.model_validate(doc)


@router.get("", response_model=DocumentListResponse)
def list_documents(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return DocumentListResponse(documents=[DocumentResponse.model_validate(d) for d in docs], total=len(docs))


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse.model_validate(doc)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(doc_id: int, current_user=Depends(require_admin), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove from vector index
    embedding_service.remove_document(doc_id)

    # Remove file
    try:
        Path(doc.file_path).unlink(missing_ok=True)
    except Exception:
        pass

    db.delete(doc)
    db.commit()

    log_activity(db, action=ActionType.document_delete, user_id=current_user.id,
                 entity_type="document", entity_id=doc_id,
                 description=f"Document '{doc.title}' deleted")


def _extract_pdf_text(content: bytes) -> str:
    """Minimal PDF text extraction — looks for BT/ET blocks."""
    try:
        import re
        text_parts = []
        decoded = content.decode("latin-1", errors="ignore")
        for match in re.finditer(r"BT(.*?)ET", decoded, re.DOTALL):
            block = match.group(1)
            for tj in re.finditer(r"\((.*?)\)\s*Tj", block):
                text_parts.append(tj.group(1))
        return " ".join(text_parts) if text_parts else ""
    except Exception:
        return ""
