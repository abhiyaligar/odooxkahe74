from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.pg_models import VendorCategory, PaymentTerms

class VendorBase(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    category: VendorCategory = VendorCategory.RawMaterials
    payment_terms: PaymentTerms = PaymentTerms.PrePaid

class VendorCreate(VendorBase):
    pass

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    category: Optional[VendorCategory] = None
    payment_terms: Optional[PaymentTerms] = None
    outstanding_payable: Optional[float] = None

class VendorResponse(VendorBase):
    id: UUID
    outstanding_payable: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
