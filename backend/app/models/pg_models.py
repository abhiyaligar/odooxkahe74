import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Enum, Float, ForeignKey, text, Integer
from sqlalchemy.dialects.postgresql import UUID
import enum
from app.db.base import Base
from sqlalchemy.orm import relationship

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

class PaymentTerms(str, enum.Enum):
    PrePaid = "PrePaid"
    Net30 = "Net30"
    Manual = "Manual"

class VendorCategory(str, enum.Enum):
    RawMaterials = "RawMaterials"
    FinishedGoods = "FinishedGoods"
    Logistics = "Logistics"
    Services = "Services"

class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    category = Column(Enum(VendorCategory), default=VendorCategory.RawMaterials, nullable=False)
    outstanding_payable = Column(Float, default=0.0, nullable=False)
    payment_terms = Column(Enum(PaymentTerms), default=PaymentTerms.PrePaid, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class BoM(Base):
    __tablename__ = "boms"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    product_id = Column(UUID(as_uuid=True), index=True)  # Will link later properly
    name = Column(String, nullable=True)
    version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    lines = relationship("BoMLine", back_populates="bom", cascade="all, delete-orphan")
    product = relationship("Product", foreign_keys=[product_id], primaryjoin="BoM.product_id == Product.id")

class BoMLine(Base):
    __tablename__ = "bom_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    bom_id = Column(UUID(as_uuid=True), ForeignKey("boms.id"), nullable=False)
    component_product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity_required = Column(Float, nullable=False)

    bom = relationship("BoM", back_populates="lines")
    component = relationship("Product", foreign_keys=[component_product_id], primaryjoin="BoMLine.component_product_id == Product.id")


class WorkCenter(Base):
    __tablename__ = "work_centers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)

class BoMOperation(Base):
    __tablename__ = "bom_operations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    bom_id = Column(UUID(as_uuid=True), ForeignKey("boms.id"), nullable=False)
    operation_name = Column(String, nullable=False)
    sequence = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    work_center_id = Column(UUID(as_uuid=True), ForeignKey("work_centers.id"), nullable=False)

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

class CustomerCategory(str, enum.Enum):
    Retail = "Retail"
    Wholesale = "Wholesale"
    Corporate = "Corporate"
    Distributor = "Distributor"

class Customer(Base):
    __tablename__ = "customers"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    category = Column(Enum(CustomerCategory), default=CustomerCategory.Retail, nullable=False)

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

    lines = relationship("SalesOrderLine", back_populates="sales_order", cascade="all, delete-orphan")

class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    sales_order_id = Column(UUID(as_uuid=True), ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity_ordered = Column(Float, nullable=False)
    quantity_delivered = Column(Float, default=0.0)
    unit_price = Column(Float, nullable=False)

    sales_order = relationship("SalesOrder", back_populates="lines")


class PurchaseOrderStatus(str, enum.Enum):
    Draft = "Draft"
    Confirmed = "Confirmed"
    PartiallyReceived = "PartiallyReceived"
    FullyReceived = "FullyReceived"
    Cancelled = "Cancelled"

class PurchaseOrderSource(str, enum.Enum):
    Manual = "Manual"
    AutoGenerated = "AutoGenerated"

class PaymentStatus(str, enum.Enum):
    Unpaid = "Unpaid"
    PartiallyPaid = "PartiallyPaid"
    Paid = "Paid"

class PaymentMethod(str, enum.Enum):
    Cash = "Cash"
    Razorpay = "Razorpay"
    Wallet = "Wallet"

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    vendor_id = Column(UUID(as_uuid=True), ForeignKey("vendors.id"), nullable=False)
    status = Column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.Draft, nullable=False)
    source = Column(Enum(PurchaseOrderSource), default=PurchaseOrderSource.Manual, nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.Unpaid, nullable=False)
    payment_method = Column(Enum(PaymentMethod), default=PaymentMethod.Wallet, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    confirmed_at = Column(DateTime, nullable=True)
    received_at = Column(DateTime, nullable=True)

class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    quantity_ordered = Column(Float, nullable=False)
    quantity_received = Column(Float, default=0.0)
    unit_cost = Column(Float, nullable=False)

class ManufacturingOrderStatus(str, enum.Enum):
    Draft = "Draft"
    Confirmed = "Confirmed"
    InProgress = "InProgress"
    Completed = "Completed"
    Cancelled = "Cancelled"


class ManufacturingOrderSource(str, enum.Enum):
    Manual = "Manual"
    AutoGenerated = "AutoGenerated"

class ManufacturingOrder(Base):
    __tablename__ = "manufacturing_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    bom_id = Column(UUID(as_uuid=True), ForeignKey("boms.id"), nullable=False)
    quantity_to_produce = Column(Float, nullable=False)
    status = Column(Enum(ManufacturingOrderStatus), default=ManufacturingOrderStatus.Draft, nullable=False)
    source = Column(Enum(ManufacturingOrderSource), default=ManufacturingOrderSource.Manual, nullable=False)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    work_orders = relationship("WorkOrder", back_populates="manufacturing_order", cascade="all, delete-orphan")
    product = relationship("Product", foreign_keys=[product_id])
    bom = relationship("BoM")


class WorkOrderStatus(str, enum.Enum):
    Pending = "Pending"
    InProgress = "InProgress"
    Done = "Done"

class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    manufacturing_order_id = Column(UUID(as_uuid=True), ForeignKey("manufacturing_orders.id"), nullable=False)
    operation_name = Column(String, nullable=False)
    sequence = Column(Integer, nullable=False)
    work_center_id = Column(UUID(as_uuid=True), ForeignKey("work_centers.id"), nullable=False)
    status = Column(Enum(WorkOrderStatus), default=WorkOrderStatus.Pending, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    manufacturing_order = relationship("ManufacturingOrder", back_populates="work_orders")
    work_center = relationship("WorkCenter")


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

class TransactionType(str, enum.Enum):
    TopUp = "TopUp"
    PurchasePayment = "PurchasePayment"
    MfgExpense = "MfgExpense"
    Refund = "Refund"

class TransactionStatus(str, enum.Enum):
    Pending = "Pending"
    Completed = "Completed"
    Failed = "Failed"

class Wallet(Base):
    __tablename__ = "wallets"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    balance = Column(Float, default=0.0, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    wallet_id = Column(UUID(as_uuid=True), ForeignKey("wallets.id"), nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.Pending, nullable=False)
    razorpay_order_id = Column(String, nullable=True)
    razorpay_payment_id = Column(String, nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # References PO, MO etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
