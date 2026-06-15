import math
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.user import User
from app.core.security import get_current_user, require_admin
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, TaskListResponse, TaskStatusUpdate
)
from app.services.activity_service import log_activity
from app.models.activity_log import ActionType

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _task_to_response(task: Task) -> TaskResponse:
    return TaskResponse.model_validate(task)


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    priority: Optional[TaskPriority] = Query(None),
    assigned_to: Optional[int] = Query(None, alias="assigned_to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List tasks with dynamic filters. Users only see their own tasks."""
    q = db.query(Task)

    # RBAC: regular users only see tasks assigned to them
    if current_user.role.name != "admin":
        q = q.filter(Task.assigned_to_id == current_user.id)

    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if assigned_to and current_user.role.name == "admin":
        q = q.filter(Task.assigned_to_id == assigned_to)

    total = q.count()
    tasks = q.order_by(Task.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return TaskListResponse(
        tasks=[_task_to_response(t) for t in tasks],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.assigned_to_id:
        assignee = db.query(User).filter(User.id == payload.assigned_to_id).first()
        if not assignee:
            raise HTTPException(status_code=404, detail="Assigned user not found")

    task = Task(**payload.model_dump(), created_by_id=current_user.id)
    db.add(task)
    db.commit()
    db.refresh(task)

    log_activity(db, action=ActionType.task_create, user_id=current_user.id,
                 entity_type="task", entity_id=task.id,
                 description=f"Task '{task.title}' created")
    return _task_to_response(task)


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role.name != "admin" and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _task_to_response(task)


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Users can only update status of their own tasks
    if current_user.role.name != "admin":
        if task.assigned_to_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        # Users can only change status, not other fields
        allowed = {"status"}
        updates = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k in allowed}
    else:
        updates = payload.model_dump(exclude_none=True)

    for field, value in updates.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    log_activity(db, action=ActionType.task_update, user_id=current_user.id,
                 entity_type="task", entity_id=task.id,
                 description=f"Task '{task.title}' updated",
                 metadata=updates)
    return _task_to_response(task)


@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Dedicated endpoint for status transition (Pending → In Progress → Completed)."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user.role.name != "admin" and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    task.status = payload.status
    db.commit()
    db.refresh(task)

    log_activity(db, action=ActionType.task_update, user_id=current_user.id,
                 entity_type="task", entity_id=task.id,
                 description=f"Task '{task.title}' status changed to {payload.status}")
    return _task_to_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()

    log_activity(db, action=ActionType.task_delete, user_id=current_user.id,
                 entity_type="task", entity_id=task_id,
                 description=f"Task {task_id} deleted")
