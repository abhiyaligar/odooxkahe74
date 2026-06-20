from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Optional
from app.models.pg_models import SalesOrderStatus

class SalesOrderLineBase(BaseModel):
    product_id: UUID
    quantity_ordered: float

class SalesOrderLineCreate(SalesOrderLineBase):
    pass

class SalesOrderLineResponse(SalesOrderLineBase):
    id: UUID
    quantity_delivered: float
    unit_price: float
    model_config = ConfigDict(from_attributes=True)

class SalesOrderBase(BaseModel):
    customer_id: UUID
    expected_delivery_date: Optional[datetime] = None

class SalesOrderCreate(SalesOrderBase):
    lines: List[SalesOrderLineCreate]

class SalesOrderResponse(SalesOrderBase):
    id: UUID
    order_number: str
    status: SalesOrderStatus
    created_by: UUID
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
