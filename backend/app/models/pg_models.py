import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, text
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.db.base import Base

class UserRole(str, enum.Enum):
    SuperAdmin = "SuperAdmin"
    StoreAdmin = "StoreAdmin"
    SalesUser = "SalesUser"
    PurchaseUser = "PurchaseUser"
    ManufacturingUser = "ManufacturingUser"
    InventoryManager = "InventoryManager"
    BusinessOwner = "BusinessOwner"

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.SalesUser, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
