from pydantic import BaseModel, ConfigDict, Field, EmailStr, field_validator
from typing import Optional

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: float = Field(..., ge=0)

class ProductCreate(ProductBase):
    pass

class Product(ProductBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class VendorBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\+91\d{10}$", description="Phone number must be +91 followed by 10 digits")

    @field_validator('phone', mode='before')
    @classmethod
    def format_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and isinstance(v, str) and v.isdigit() and len(v) == 10:
            return f"+91{v}"
        return v

class VendorCreate(VendorBase):
    pass

class VendorUpdate(VendorBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None

class Vendor(VendorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class CustomerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, pattern=r"^\+91\d{10}$", description="Phone number must be +91 followed by 10 digits")

    @field_validator('phone', mode='before')
    @classmethod
    def format_phone(cls, v: Optional[str]) -> Optional[str]:
        if v and isinstance(v, str) and v.isdigit() and len(v) == 10:
            return f"+91{v}"
        return v

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(CustomerBase):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None

class Customer(CustomerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

