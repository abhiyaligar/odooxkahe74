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
    is_email_verified: bool = False
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

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    new_password: str = Field(..., min_length=8, description="New password must be at least 8 characters")

class SendVerificationCodeRequest(BaseModel):
    email: EmailStr

class VerifyEmailCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

