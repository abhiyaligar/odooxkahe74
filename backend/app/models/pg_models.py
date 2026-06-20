import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Float, ForeignKey, text
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

class ProductType(str, enum.Enum):
    FinishedGood = "FinishedGood"
    Component = "Component"

class ProcurementStrategy(str, enum.Enum):
    MTS = "MTS"
    MTO = "MTO"

class ProcurementType(str, enum.Enum):
    Purchase = "Purchase"
    Manufacturing = "Manufacturing"

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class BoM(Base):
    __tablename__ = "boms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    product_id = Column(UUID(as_uuid=True), index=True)  # Will link later properly
    name = Column(String, nullable=True)
    version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, index=True, nullable=False)
    type = Column(Enum(ProductType), nullable=False)
    sales_price = Column(Float, default=0.0)
    cost_price = Column(Float, default=0.0)
    on_hand_qty = Column(Float, default=0.0)
    reserved_qty = Column(Float, default=0.0)
    procurement_strategy = Column(Enum(ProcurementStrategy), nullable=False)
    procure_on_demand = Column(Boolean, default=False)
    procurement_type = Column(Enum(ProcurementType), nullable=True)
    
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=True)
    bom_id = Column(UUID(as_uuid=True), ForeignKey("boms.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)

class SalesOrderStatus(str, enum.Enum):
    Draft = "Draft"
    Confirmed = "Confirmed"
    PartiallyDelivered = "PartiallyDelivered"
    FullyDelivered = "FullyDelivered"
    Cancelled = "Cancelled"

class SalesOrder(Base):
    __tablename__ = "sales_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    status = Column(Enum(SalesOrderStatus), default=SalesOrderStatus.Draft, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    expected_delivery_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    sales_order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity_ordered = Column(Float, nullable=False)
    quantity_delivered = Column(Float, default=0.0)
    unit_price = Column(Float, nullable=False)

class LedgerReason(str, enum.Enum):
    SaleDelivery = "SaleDelivery"
    PurchaseReceipt = "PurchaseReceipt"
    ManufacturingConsume = "ManufacturingConsume"
    ManufacturingProduce = "ManufacturingProduce"
    ManualAdjustment = "ManualAdjustment"

class ReferenceType(str, enum.Enum):
    SalesOrder = "SalesOrder"
    PurchaseOrder = "PurchaseOrder"
    ManufacturingOrder = "ManufacturingOrder"
    Manual = "Manual"

class StockLedgerEntry(Base):
    __tablename__ = "stock_ledger_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    change_qty = Column(Float, nullable=False)
    reason = Column(Enum(LedgerReason), nullable=False)
    reference_type = Column(Enum(ReferenceType), nullable=False)
    reference_id = Column(UUID(as_uuid=True), nullable=False)
    resulting_on_hand_qty = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
