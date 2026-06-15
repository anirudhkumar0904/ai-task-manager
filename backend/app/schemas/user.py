from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_name: str = "user"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_user(cls, user):
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role.name,
            is_active=user.is_active,
            created_at=user.created_at,
        )


class UserListResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}
