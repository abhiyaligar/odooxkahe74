from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional

# --- Recipe Line Schemas ---
class RecipeLineBase(BaseModel):
    component_product_id: UUID
    quantity_required: float = Field(..., gt=0, description="Quantity must be greater than zero")

class RecipeLineCreate(RecipeLineBase):
    pass

class RecipeLineResponse(RecipeLineBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

# --- Recipe Operation Schemas ---
class RecipeOperationBase(BaseModel):
    operation_name: str = Field(..., min_length=1, max_length=100)
    sequence: int = Field(..., ge=1)
    duration_minutes: int = Field(..., ge=1)
    work_center_id: UUID

class RecipeOperationCreate(RecipeOperationBase):
    pass

class RecipeOperationResponse(RecipeOperationBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

# --- Recipe Header Schemas ---
class RecipeBase(BaseModel):
    product_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field("1.0", min_length=1, max_length=20)

class RecipeCreate(RecipeBase):
    lines: List[RecipeLineCreate] = Field(..., min_length=1, description="Recipe must contain at least one component")
    operations: List[RecipeOperationCreate] = []

class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    version: Optional[str] = Field(None, min_length=1, max_length=20)
    lines: Optional[List[RecipeLineCreate]] = None
    operations: Optional[List[RecipeOperationCreate]] = None

class RecipeResponse(RecipeBase):
    id: UUID
    created_at: datetime
    lines: List[RecipeLineResponse] = []
    operations: List[RecipeOperationResponse] = []

    model_config = ConfigDict(from_attributes=True)
