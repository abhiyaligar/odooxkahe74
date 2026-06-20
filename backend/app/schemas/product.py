from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.pg_models import ProductType, ProcurementStrategy, ProcurementType

class ProductBase(BaseModel):
    name: str
    type: ProductType
    sales_price: float = 0.0
    cost_price: float = 0.0
    on_hand_qty: float = 0.0
    reserved_qty: float = 0.0
    procurement_strategy: ProcurementStrategy
    procure_on_demand: bool = False
    procurement_type: Optional[ProcurementType] = None
    vendor_id: Optional[UUID] = None
    bom_id: Optional[UUID] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ProductType] = None
    sales_price: Optional[float] = None
    cost_price: Optional[float] = None
    on_hand_qty: Optional[float] = None
    reserved_qty: Optional[float] = None
    procurement_strategy: Optional[ProcurementStrategy] = None
    procure_on_demand: Optional[bool] = None
    procurement_type: Optional[ProcurementType] = None
    vendor_id: Optional[UUID] = None
    bom_id: Optional[UUID] = None

class ProductResponse(ProductBase):
    id: UUID
    free_to_use_qty: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
