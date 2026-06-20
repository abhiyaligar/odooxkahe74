from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from typing import Optional
from app.models.pg_models import CustomerCategory

class CustomerBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: CustomerCategory = CustomerCategory.Retail

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    category: Optional[CustomerCategory] = None

class CustomerResponse(CustomerBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
