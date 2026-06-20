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

# --- Recipe Header Schemas ---
class RecipeBase(BaseModel):
    product_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    version: str = Field("1.0", min_length=1, max_length=20)

class RecipeCreate(RecipeBase):
    lines: List[RecipeLineCreate] = Field(..., min_length=1, description="Recipe must contain at least one component")

class RecipeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    version: Optional[str] = Field(None, min_length=1, max_length=20)
    lines: Optional[List[RecipeLineCreate]] = None

class RecipeResponse(RecipeBase):
    id: UUID
    created_at: datetime
    lines: List[RecipeLineResponse] = []

    model_config = ConfigDict(from_attributes=True)
