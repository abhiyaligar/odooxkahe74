from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional

# --- BoM Line Schemas ---
class BoMLineBase(BaseModel):
    component_product_id: UUID
    quantity_required: float = Field(..., gt=0, description="Quantity must be greater than zero")

class BoMLineCreate(BoMLineBase):
    pass

class BoMLineResponse(BoMLineBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

# --- BoM Header Schemas ---
class BoMBase(BaseModel):
    product_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field("1.0", min_length=1, max_length=20)

class BoMCreate(BoMBase):
    lines: List[BoMLineCreate] = Field(..., min_length=1, description="BoM must contain at least one line item")

class BoMUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    version: Optional[str] = Field(None, min_length=1, max_length=20)
    lines: Optional[List[BoMLineCreate]] = None

class BoMResponse(BoMBase):
    id: UUID
    created_at: datetime
    lines: List[BoMLineResponse] = []

    model_config = ConfigDict(from_attributes=True)
