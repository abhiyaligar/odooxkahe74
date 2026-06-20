import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import Customer, Product, ProductType, ProcurementStrategy, SalesOrder, SalesOrderLine, SalesOrderStatus, StockLedgerEntry, LedgerReason, ReferenceType

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_customer(db_session: AsyncSession) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        name="Acme Corp",
        email="info@acme.com",
        phone="555-1234"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer

@pytest.fixture
async def sample_product(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Super Widget",
        type=ProductType.FinishedGood,
        sales_price=100.0,
        cost_price=60.0,
        on_hand_qty=20.0,
        reserved_qty=2.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

async def test_create_sales_order_success(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    order_data = {
        "customer_id": str(sample_customer.id),
        "expected_delivery_date": "2026-06-30T12:00:00",
        "lines": [
            {
                "product_id": str(sample_product.id),
                "quantity_ordered": 25.0
            }
        ]
    }
    
    response = await client.post("/api/v1/sales-orders/", json=order_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["status"] == "Draft"
    assert res_json["customer_id"] == str(sample_customer.id)
    assert "order_number" in res_json
    assert "id" in res_json

    # Check that the unit price was fetched from the product table
    order_id = res_json["id"]
    lines_result = await db_session.execute(select(SalesOrderLine).where(SalesOrderLine.sales_order_id == uuid.UUID(order_id)))
    lines = lines_result.scalars().all()
    assert len(lines) == 1
    assert lines[0].unit_price == 100.0  # matches sample_product.sales_price
    assert lines[0].quantity_ordered == 25.0

async def test_confirm_sales_order_success(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    # 1. Create order
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [
            {
                "product_id": str(sample_product.id),
                "quantity_ordered": 25.0
            }
        ]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Confirm order
    confirm_res = await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    assert confirm_res.status_code == 200
    assert confirm_res.json()["message"] == "Order confirmed and stock reserved."

    # 3. Verify order status is Confirmed
    order_res = await db_session.execute(select(SalesOrder).where(SalesOrder.id == uuid.UUID(order_id)))
    order = order_res.scalars().first()
    assert order.status == SalesOrderStatus.Confirmed

    # 4. Verify stock reservation is updated: initial reserved (2.0) + order qty (25.0) = 27.0
    prod_res = await db_session.execute(select(Product).where(Product.id == sample_product.id))
    product = prod_res.scalars().first()
    assert product.reserved_qty == 27.0

async def test_confirm_order_not_draft_error(client: AsyncClient, sample_customer: Customer, sample_product: Product):
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 25.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # Confirm once
    await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    
    # Attempt to confirm again (status is now Confirmed, not Draft)
    confirm_res2 = await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    assert confirm_res2.status_code == 400
    assert confirm_res2.json()["detail"] == "Only Draft orders can be confirmed"

async def test_deliver_sales_order_success(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    # 1. Create order
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [
            {
                "product_id": str(sample_product.id),
                "quantity_ordered": 5.0
            }
        ]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Confirm order (necessary for stock reservation)
    await client.post(f"/api/v1/sales-orders/{order_id}/confirm")

    # 3. Deliver order
    deliver_res = await client.post(f"/api/v1/sales-orders/{order_id}/deliver")
    assert deliver_res.status_code == 200
    assert deliver_res.json()["message"] == "Order delivered and stock ledger updated."

    # 4. Verify order status is FullyDelivered
    order_res = await db_session.execute(select(SalesOrder).where(SalesOrder.id == uuid.UUID(order_id)))
    order = order_res.scalars().first()
    assert order.status == SalesOrderStatus.FullyDelivered
    assert order.delivered_at is not None

    # 5. Verify product stock quantities updated:
    # - reserved_qty should go back down by ordered qty: 7.0 - 5.0 = 2.0
    # - on_hand_qty should go down by ordered qty: 20.0 - 5.0 = 15.0
    prod_res = await db_session.execute(select(Product).where(Product.id == sample_product.id))
    product = prod_res.scalars().first()
    assert product.reserved_qty == 2.0
    assert product.on_hand_qty == 15.0

    # 6. Verify stock ledger entry was created
    ledger_res = await db_session.execute(
        select(StockLedgerEntry).where(StockLedgerEntry.reference_id == uuid.UUID(order_id))
    )
    ledger = ledger_res.scalars().first()
    assert ledger is not None
    assert ledger.product_id == sample_product.id
    assert ledger.change_qty == -5.0
    assert ledger.reason == LedgerReason.SaleDelivery
    assert ledger.reference_type == ReferenceType.SalesOrder
    assert ledger.resulting_on_hand_qty == 15.0

async def test_deliver_order_not_confirmed_error(client: AsyncClient, sample_customer: Customer, sample_product: Product):
    # Try to deliver a draft order directly without confirming it first
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 25.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    deliver_res = await client.post(f"/api/v1/sales-orders/{order_id}/deliver")
    assert deliver_res.status_code == 400
    assert deliver_res.json()["detail"] == "Only Confirmed orders can be delivered"

async def test_create_order_non_existent_product_error(client: AsyncClient, sample_customer: Customer):
    # Try to create a sales order with a random (non-existent) product ID
    random_product_id = str(uuid.uuid4())
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": random_product_id, "quantity_ordered": 1.0}]
    }
    response = await client.post("/api/v1/sales-orders/", json=order_data)
    assert response.status_code == 400
    assert "not found" in response.json()["detail"]

async def test_deliver_order_insufficient_stock_error(client: AsyncClient, sample_customer: Customer, sample_product: Product):
    # 1. Create order asking for 50.0 units when on_hand_qty is 20.0
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 50.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Confirm order (this is allowed, reserves stock)
    confirm_res = await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    assert confirm_res.status_code == 200

    # 3. Try to deliver (should fail due to insufficient on_hand stock)
    deliver_res = await client.post(f"/api/v1/sales-orders/{order_id}/deliver")
    assert deliver_res.status_code == 400
    assert "Insufficient stock" in deliver_res.json()["detail"]

async def test_cancel_draft_sales_order_success(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    # 1. Create draft order
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 25.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Cancel order
    cancel_res = await client.post(f"/api/v1/sales-orders/{order_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["message"] == "Order cancelled successfully."

    # 3. Verify status in database
    order_res = await db_session.execute(select(SalesOrder).where(SalesOrder.id == uuid.UUID(order_id)))
    order = order_res.scalars().first()
    assert order.status == SalesOrderStatus.Cancelled

async def test_cancel_confirmed_sales_order_releases_stock(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    # 1. Create draft order
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 25.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Confirm order (reserves 25.0 widgets)
    await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    prod_res = await db_session.execute(select(Product).where(Product.id == sample_product.id))
    product = prod_res.scalars().first()
    assert product.reserved_qty == 27.0  # 2.0 (initial) + 25.0 (ordered)

    # 3. Cancel order (releases reservation)
    cancel_res = await client.post(f"/api/v1/sales-orders/{order_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["message"] == "Order cancelled successfully."

    await db_session.refresh(product)
    assert product.reserved_qty == 2.0  # should revert back to 2.0

async def test_cancel_delivered_order_error(client: AsyncClient, sample_customer: Customer, sample_product: Product):
    # 1. Create order
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [{"product_id": str(sample_product.id), "quantity_ordered": 5.0}]
    }
    create_res = await client.post("/api/v1/sales-orders/", json=order_data)
    order_id = create_res.json()["id"]

    # 2. Confirm & deliver
    await client.post(f"/api/v1/sales-orders/{order_id}/confirm")
    await client.post(f"/api/v1/sales-orders/{order_id}/deliver")

    # 3. Try to cancel
    cancel_res = await client.post(f"/api/v1/sales-orders/{order_id}/cancel")
    assert cancel_res.status_code == 400
    assert "Cannot cancel" in cancel_res.json()["detail"]


async def test_create_sales_order_auto_confirm_success(client: AsyncClient, sample_customer: Customer, sample_product: Product, db_session: AsyncSession):
    # Ask for 5.0 units when free stock is 18.0 (available)
    order_data = {
        "customer_id": str(sample_customer.id),
        "lines": [
            {
                "product_id": str(sample_product.id),
                "quantity_ordered": 5.0
            }
        ]
    }
    response = await client.post("/api/v1/sales-orders/", json=order_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["status"] == "Confirmed"
    
    # Verify reservation is automatically incremented: initial (2.0) + order (5.0) = 7.0
    await db_session.refresh(sample_product)
    assert sample_product.reserved_qty == 7.0


