from pydantic import BaseModel, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.pg_models import TransactionType, PaymentMethod, TransactionStatus

class WalletResponse(BaseModel):
    id: UUID
    balance: float
    currency: str
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class WalletTransactionResponse(BaseModel):
    id: UUID
    wallet_id: UUID
    amount: float
    type: TransactionType
    payment_method: PaymentMethod
    status: TransactionStatus
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    reference_id: Optional[UUID] = None
    created_at: datetime
    created_by: Optional[UUID] = None

    model_config = ConfigDict(from_attributes=True)

class TopUpInitiate(BaseModel):
    amount: float

class TopUpInitiateResponse(BaseModel):
    razorpay_order_id: str
    amount: float
    currency: str
    status: str

class TopUpVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

class TransferRequest(BaseModel):
    from_wallet_id: UUID
    to_wallet_id: UUID
    amount: float
    reference_id: Optional[UUID] = None
