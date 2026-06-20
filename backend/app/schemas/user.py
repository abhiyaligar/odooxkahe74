from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from app.models.pg_models import UserRole
from app.schemas.customer import CustomerResponse
from typing import Optional

class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name of the user")
    email: EmailStr
    role: UserRole = UserRole.SalesUser

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")
    phone: Optional[str] = None
    address: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime
    customer_profile: Optional[CustomerResponse] = None
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class UserPagedResponse(BaseModel):
    total_count: int
    users: list[UserResponse]
