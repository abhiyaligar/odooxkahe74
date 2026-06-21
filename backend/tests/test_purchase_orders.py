import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import (
    Vendor,
    Product,
    ProductType,
    ProcurementStrategy,
    PurchaseOrder,
    PurchaseOrderStatus,
    PurchaseOrderLine,
    StockLedgerEntry,
    LedgerReason
)

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_vendor(db_session: AsyncSession) -> Vendor:
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Apex Timber",
        email="apex@timber.com"
    )
    db_session.add(vendor)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor

@pytest.fixture
async def sample_component(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Oak Planks",
        type=ProductType.Component,
        sales_price=5.0,
        cost_price=3.0,
        on_hand_qty=10.0,
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

async def test_create_purchase_order_success(client: AsyncClient, sample_vendor: Vendor, sample_component: Product, db_session: AsyncSession):
    order_data = {
        "vendor_id": str(sample_vendor.id),
        "lines": [
            {
                "product_id": str(sample_component.id),
                "quantity_ordered": 50.0,
                "unit_cost": 2.80
            }
        ]
    }
    response = await client.post("/api/v1/purchase-orders/", json=order_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["status"] == "Draft"
    assert res_json["vendor_id"] == str(sample_vendor.id)
    assert len(res_json["lines"]) == 1
    assert res_json["lines"][0]["product_id"] == str(sample_component.id)
    assert res_json["lines"][0]["quantity_ordered"] == 50.0
    assert res_json["lines"][0]["unit_cost"] == 2.80

async def test_list_and_get_purchase_orders(client: AsyncClient, sample_vendor: Vendor, sample_component: Product):
    # 1. Create PO
    order_data = {
        "vendor_id": str(sample_vendor.id),
        "lines": [{"product_id": str(sample_component.id), "quantity_ordered": 10.0}]
    }
    create_res = await client.post("/api/v1/purchase-orders/", json=order_data)
    po_id = create_res.json()["id"]

    # 2. List POs
    list_res = await client.get("/api/v1/purchase-orders/")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Get single PO
    get_res = await client.get(f"/api/v1/purchase-orders/{po_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == po_id

async def test_confirm_purchase_order(client: AsyncClient, sample_vendor: Vendor, sample_component: Product):
    # Create PO
    order_data = {
        "vendor_id": str(sample_vendor.id),
        "payment_method": "Cash",
        "lines": [{"product_id": str(sample_component.id), "quantity_ordered": 20.0}]
    }
    create_res = await client.post("/api/v1/purchase-orders/", json=order_data)
    po_id = create_res.json()["id"]

    # Confirm PO
    confirm_res = await client.post(f"/api/v1/purchase-orders/{po_id}/confirm")
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "Confirmed"

async def test_receive_purchase_order_line(client: AsyncClient, sample_vendor: Vendor, sample_component: Product, db_session: AsyncSession):
    # Create and Confirm PO
    order_data = {
        "vendor_id": str(sample_vendor.id),
        "payment_method": "Cash",
        "lines": [{"product_id": str(sample_component.id), "quantity_ordered": 20.0}]
    }
    create_res = await client.post("/api/v1/purchase-orders/", json=order_data)
    po = create_res.json()
    po_id = po["id"]
    line_id = po["lines"][0]["id"]

    # Confirm PO
    await client.post(f"/api/v1/purchase-orders/{po_id}/confirm")

    # Receive 15 items
    receive_data = {"quantity_received": 15.0}
    receive_res = await client.post(f"/api/v1/purchase-orders/lines/{line_id}/receive", json=receive_data)
    assert receive_res.status_code == 200
    res_json = receive_res.json()
    assert res_json["status"] == "PartiallyReceived"
    assert res_json["lines"][0]["quantity_received"] == 15.0

    # Verify inventory is incremented: 10 (initial) + 15 = 25
    prod_res = await db_session.execute(select(Product).where(Product.id == sample_component.id))
    product = prod_res.scalars().first()
    assert product.on_hand_qty == 25.0

    # Verify StockLedgerEntry
    ledger_res = await db_session.execute(
        select(StockLedgerEntry).where(StockLedgerEntry.product_id == sample_component.id)
    )
    ledger_entries = ledger_res.scalars().all()
    assert len(ledger_entries) == 1
    assert ledger_entries[0].change_qty == 15.0
    assert ledger_entries[0].reason == LedgerReason.PurchaseReceipt

    # Receive remaining 5 items
    receive_data_final = {"quantity_received": 5.0}
    receive_res_final = await client.post(f"/api/v1/purchase-orders/lines/{line_id}/receive", json=receive_data_final)
    assert receive_res_final.status_code == 200
    assert receive_res_final.json()["status"] == "FullyReceived"

    # Verify inventory is incremented: 25 + 5 = 30
    await db_session.refresh(product)
    assert product.on_hand_qty == 30.0

async def test_cancel_purchase_order(client: AsyncClient, sample_vendor: Vendor, sample_component: Product):
    # Create PO
    order_data = {
        "vendor_id": str(sample_vendor.id),
        "lines": [{"product_id": str(sample_component.id), "quantity_ordered": 10.0}]
    }
    create_res = await client.post("/api/v1/purchase-orders/", json=order_data)
    po_id = create_res.json()["id"]

    # Cancel PO
    cancel_res = await client.post(f"/api/v1/purchase-orders/{po_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "Cancelled"
