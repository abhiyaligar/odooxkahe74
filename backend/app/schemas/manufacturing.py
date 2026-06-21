from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from app.models.pg_models import ManufacturingOrderStatus, WorkOrderStatus

# --- Work Order Schemas ---
class WorkOrderBase(BaseModel):
    operation_name: str = Field(..., min_length=1, max_length=100)
    sequence: int = Field(..., ge=1)
    work_center_id: UUID

    @field_validator('work_center_id', mode='before')
    @classmethod
    def validate_work_center_id(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            val_clean = v.strip().lower()
            if val_clean == "wc1":
                return UUID("00000000-0000-0000-0000-000000000001")
            elif val_clean == "wc2":
                return UUID("00000000-0000-0000-0000-000000000002")
            elif val_clean == "wc3":
                return UUID("00000000-0000-0000-0000-000000000003")
        return v

class WorkOrderCreate(WorkOrderBase):
    pass

class WorkOrderUpdate(BaseModel):
    operation_name: Optional[str] = Field(None, min_length=1, max_length=100)
    sequence: Optional[int] = Field(None, ge=1)
    work_center_id: Optional[UUID] = None

    @field_validator('work_center_id', mode='before')
    @classmethod
    def validate_work_center_id(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            val_clean = v.strip().lower()
            if val_clean == "wc1":
                return UUID("00000000-0000-0000-0000-000000000001")
            elif val_clean == "wc2":
                return UUID("00000000-0000-0000-0000-000000000002")
            elif val_clean == "wc3":
                return UUID("00000000-0000-0000-0000-000000000003")
        return v

class WorkOrderResponse(WorkOrderBase):
    id: UUID
    manufacturing_order_id: UUID
    status: WorkOrderStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# --- Manufacturing Order Schemas ---
class MOBase(BaseModel):
    product_id: UUID
    bom_id: UUID
    quantity_to_produce: float = Field(..., gt=0)
    assignee_id: Optional[UUID] = None

class MOCreate(MOBase):
    pass

class MOUpdate(BaseModel):
    quantity_to_produce: Optional[float] = Field(None, gt=0)
    assignee_id: Optional[UUID] = None

class MOResponse(MOBase):
    id: UUID
    order_number: str
    status: ManufacturingOrderStatus
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    work_orders: List[WorkOrderResponse] = []

    model_config = ConfigDict(from_attributes=True)
