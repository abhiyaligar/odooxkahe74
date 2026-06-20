import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.pg_models import (
    Product,
    ProductType,
    ProcurementStrategy,
    ProcurementType,
    Vendor,
    Customer,
    BoM,
    BoMLine,
    BoMOperation,
    WorkCenter,
    SalesOrder,
    SalesOrderStatus,
    SalesOrderLine,
    ManufacturingOrder,
    ManufacturingOrderStatus,
    ManufacturingOrderSource,
    PurchaseOrder,
    PurchaseOrderStatus,
    PurchaseOrderSource,
    PurchaseOrderLine
)

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_vendor(db_session: AsyncSession) -> Vendor:
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Reliable Lumber Co",
        email="lumber@example.com"
    )
    db_session.add(vendor)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor

@pytest.fixture
async def sample_customer(db_session: AsyncSession) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        name="Alice Wood",
        email="alice@example.com"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer

@pytest.fixture
async def sample_work_center(db_session: AsyncSession) -> WorkCenter:
    wc = WorkCenter(id=uuid.uuid4(), name="Primary Workshop")
    db_session.add(wc)
    await db_session.commit()
    await db_session.refresh(wc)
    return wc

@pytest.fixture
async def raw_wood(db_session: AsyncSession, sample_vendor: Vendor) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Raw Wood Plank",
        type=ProductType.Component,
        cost_price=10.0,
        sales_price=15.0,
        on_hand_qty=2.0, # Will have a shortage of 8 if we need 10
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS,
        procure_on_demand=True,
        procurement_type=ProcurementType.Purchase,
        vendor_id=sample_vendor.id
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def raw_screws(db_session: AsyncSession, sample_vendor: Vendor) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Heavy Screws",
        type=ProductType.Component,
        cost_price=1.0,
        sales_price=2.0,
        on_hand_qty=0.0,
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS,
        procure_on_demand=True,
        procurement_type=ProcurementType.Purchase,
        vendor_id=sample_vendor.id
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def fine_table_bom(db_session: AsyncSession) -> BoM:
    # We will set the product_id after finished good is created
    bom = BoM(id=uuid.uuid4(), name="Fine Table Recipe", version="1.0")
    db_session.add(bom)
    await db_session.commit()
    await db_session.refresh(bom)
    return bom

@pytest.fixture
async def finished_table(db_session: AsyncSession, fine_table_bom: BoM) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Fine Wooden Table",
        type=ProductType.FinishedGood,
        cost_price=150.0,
        sales_price=250.0,
        on_hand_qty=1.0, # Shortage of 2 if ordered 3
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTO,
        procure_on_demand=True,
        procurement_type=ProcurementType.Manufacturing,
        bom_id=fine_table_bom.id
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    
    # Update BoM to point to product
    fine_table_bom.product_id = product.id
    await db_session.commit()
    return product

@pytest.fixture
async def bom_setup(
    db_session: AsyncSession,
    fine_table_bom: BoM,
    raw_wood: Product,
    raw_screws: Product,
    sample_work_center: WorkCenter
) -> BoM:
    # 1 Table requires 5 raw wood planks and 10 heavy screws
    line1 = BoMLine(bom_id=fine_table_bom.id, component_product_id=raw_wood.id, quantity_required=5.0)
    line2 = BoMLine(bom_id=fine_table_bom.id, component_product_id=raw_screws.id, quantity_required=10.0)
    
    op = BoMOperation(
        bom_id=fine_table_bom.id,
        operation_name="Table Assembly",
        sequence=1,
        duration_minutes=45,
        work_center_id=sample_work_center.id
    )
    db_session.add_all([line1, line2, op])
    await db_session.commit()
    return fine_table_bom

async def test_recursive_procurement_sales_to_mo_to_po(
    client: AsyncClient,
    db_session: AsyncSession,
    sample_customer: Customer,
    finished_table: Product,
    bom_setup: BoM,
    raw_wood: Product,
    raw_screws: Product,
    sample_vendor: Vendor
):
    # Order 3 tables:
    # 1 is on hand, shortage is 2 tables.
    # To build 2 tables, we need:
    # - 2 * 5 = 10 wood planks. Available on hand: 2. Shortage = 8 wood planks.
    # - 2 * 10 = 20 screws. Available on hand: 0. Shortage = 20 screws.
    
    # 1. Create Sales Order
    so_payload = {
        "customer_id": str(sample_customer.id),
        "lines": [
            {
                "product_id": str(finished_table.id),
                "quantity_ordered": 3.0
            }
        ]
    }
    
    res_so = await client.post("/api/v1/sales-orders/", json=so_payload)
    assert res_so.status_code == 201
    so_id = res_so.json()["id"]
    
    # 2. Confirm Sales Order to trigger procurement
    res_conf = await client.post(f"/api/v1/sales-orders/{so_id}/confirm")
    assert res_conf.status_code == 200
    
    # 3. Assert Sales Order reservation occurred
    await db_session.refresh(finished_table)
    assert finished_table.reserved_qty == 3.0
    
    # 4. Verify Manufacturing Order was auto-generated for shortage of 2 tables
    mo_query = await db_session.execute(
        select(ManufacturingOrder)
        .where(
            ManufacturingOrder.product_id == finished_table.id,
            ManufacturingOrder.source == ManufacturingOrderSource.AutoGenerated
        )
    )
    mo_list = mo_query.scalars().all()
    assert len(mo_list) == 1
    db_mo = mo_list[0]
    assert db_mo.status == ManufacturingOrderStatus.Draft
    assert db_mo.quantity_to_produce == 2.0
    
    # 5. Verify Purchase Order was auto-generated and bundled lines for components
    po_query = await db_session.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(
            PurchaseOrder.vendor_id == sample_vendor.id,
            PurchaseOrder.source == PurchaseOrderSource.AutoGenerated
        )
    )
    po_list = po_query.scalars().all()
    assert len(po_list) == 1
    db_po = po_list[0]
    assert db_po.status == PurchaseOrderStatus.Draft
    
    # Check bundled PO lines
    po_lines = db_po.lines
    assert len(po_lines) == 2
    
    wood_line = next(line for line in po_lines if line.product_id == raw_wood.id)
    screws_line = next(line for line in po_lines if line.product_id == raw_screws.id)
    
    # Raw Wood shortage = 2 * 5 required - 2 on hand = 8
    assert wood_line.quantity_ordered == 8.0
    # Screws shortage = 2 * 10 required - 0 on hand = 20
    assert screws_line.quantity_ordered == 20.0

async def test_no_procurement_strategy_does_not_trigger_automation(
    client: AsyncClient,
    db_session: AsyncSession,
    sample_customer: Customer,
    finished_table: Product
):
    # Disable procure_on_demand
    finished_table.procure_on_demand = False
    await db_session.commit()
    
    so_payload = {
        "customer_id": str(sample_customer.id),
        "lines": [
            {
                "product_id": str(finished_table.id),
                "quantity_ordered": 5.0
            }
        ]
    }
    
    res_so = await client.post("/api/v1/sales-orders/", json=so_payload)
    assert res_so.status_code == 201
    so_id = res_so.json()["id"]
    
    res_conf = await client.post(f"/api/v1/sales-orders/{so_id}/confirm")
    assert res_conf.status_code == 200
    
    # Verify no MO was created for this product
    mo_query = await db_session.execute(
        select(ManufacturingOrder).where(ManufacturingOrder.product_id == finished_table.id)
    )
    assert len(mo_query.scalars().all()) == 0
