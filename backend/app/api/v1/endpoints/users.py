from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import require_admin, get_current_user, hash_password
from app.models.user import User
from app.models.role import Role
from app.schemas.user import UserCreate, UserResponse, UserListResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserListResponse])
def list_users(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        UserListResponse(
            id=u.id, name=u.name, email=u.email,
            role=u.role.name, is_active=u.is_active
        )
        for u in users
    ]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = db.query(Role).filter(Role.name == payload.role_name).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' not found")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role_id=role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse.from_orm_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user.is_active = False
    db.commit()
