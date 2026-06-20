from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from app.models.pg_models import PurchaseOrderStatus, PurchaseOrderSource, PaymentStatus, PaymentMethod

class PurchaseOrderLineBase(BaseModel):
    product_id: UUID
    quantity_ordered: float = Field(..., gt=0)

class PurchaseOrderLineCreate(PurchaseOrderLineBase):
    unit_cost: Optional[float] = None

class PurchaseOrderLineResponse(PurchaseOrderLineBase):
    id: UUID
    purchase_order_id: UUID
    quantity_received: float
    unit_cost: float

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderBase(BaseModel):
    vendor_id: UUID
    payment_method: Optional[PaymentMethod] = PaymentMethod.Wallet

class PurchaseOrderCreate(PurchaseOrderBase):
    lines: List[PurchaseOrderLineCreate]

class PurchaseOrderResponse(PurchaseOrderBase):
    id: UUID
    order_number: str
    status: PurchaseOrderStatus
    source: PurchaseOrderSource
    payment_status: PaymentStatus
    created_at: datetime
    lines: List[PurchaseOrderLineResponse] = []

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderLineReceive(BaseModel):
    quantity_received: float = Field(..., gt=0)
