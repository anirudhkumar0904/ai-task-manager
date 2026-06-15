import enum
from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class ActionType(str, enum.Enum):
    login = "login"
    logout = "logout"
    task_create = "task_create"
    task_update = "task_update"
    task_delete = "task_delete"
    document_upload = "document_upload"
    document_delete = "document_delete"
    search = "search"
    user_create = "user_create"


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(Enum(ActionType), nullable=False, index=True)
    entity_type = Column(String(50))        # e.g. "task", "document"
    entity_id = Column(Integer, nullable=True)
    description = Column(Text)
    metadata_ = Column("metadata", JSON, nullable=True)   # extra context (query, old/new values)
    ip_address = Column(String(45))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    user = relationship("User", back_populates="activity_logs")
