from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user,
)
from app.schemas.auth import LoginRequest, TokenResponse, RegisterRequest, UserBasic
from app.services.activity_service import log_activity
from app.models.activity_log import ActionType

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")

    token = create_access_token({"sub": str(user.id), "role": user.role.name})

    log_activity(
        db,
        action=ActionType.login,
        user_id=user.id,
        description=f"User {user.email} logged in",
        ip_address=request.client.host if request.client else None,
    )

    return TokenResponse(
        access_token=token,
        user=UserBasic(id=user.id, name=user.name, email=user.email, role=user.role.name),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user_role = db.query(Role).filter(Role.name == "user").first()
    if not user_role:
        raise HTTPException(status_code=500, detail="Default role not found")

    user = User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role_id=user_role.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    log_activity(db, action=ActionType.user_create, user_id=user.id,
                 description=f"New user registered: {user.email}")

    token = create_access_token({"sub": str(user.id), "role": "user"})
    return TokenResponse(
        access_token=token,
        user=UserBasic(id=user.id, name=user.name, email=user.email, role="user"),
    )


@router.get("/me", response_model=UserBasic)
def me(current_user=Depends(get_current_user)):
    return UserBasic(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role.name,
    )
