import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pg_models import User, UserRole, Product, ProductType, ProcurementStrategy, Customer, Vendor, BoM, SalesOrder, ManufacturingOrder

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_product(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Cabinet Wood",
        type=ProductType.Component,
        sales_price=10.0,
        cost_price=5.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def sample_customer(db_session: AsyncSession) -> Customer:
    customer = Customer(
        id=uuid.uuid4(),
        name="Retail Buyer",
        email="buyer@example.com"
    )
    db_session.add(customer)
    await db_session.commit()
    await db_session.refresh(customer)
    return customer

@pytest.fixture
async def sample_vendor(db_session: AsyncSession) -> Vendor:
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Wood Supplier",
        email="wood@example.com"
    )
    db_session.add(vendor)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor

@pytest.fixture
async def sample_sales_order(db_session: AsyncSession, sample_customer: Customer) -> SalesOrder:
    order = SalesOrder(
        id=uuid.uuid4(),
        order_number="SO-RBAC-TEST",
        customer_id=sample_customer.id,
        created_by=uuid.uuid4()
    )
    db_session.add(order)
    await db_session.commit()
    await db_session.refresh(order)
    return order

async def test_sales_user_cannot_create_product(client: AsyncClient):
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_sales_user():
        return User(
            id=uuid.uuid4(),
            name="Mock Sales",
            email="sales@example.com",
            role=UserRole.SalesUser,
            is_active=True
        )
    
    app.dependency_overrides[get_current_user] = _get_mock_sales_user
    
    try:
        payload = {
            "name": "Secret Table",
            "type": "FinishedGood",
            "sales_price": 200.0,
            "cost_price": 100.0,
            "procurement_strategy": "MTS",
            "procure_on_demand": False
        }
        response = await client.post("/api/v1/products/", json=payload)
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

async def test_purchase_user_cannot_confirm_sales_order(client: AsyncClient, sample_sales_order: SalesOrder):
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_purchase_user():
        return User(
            id=uuid.uuid4(),
            name="Mock Purchase",
            email="purchase@example.com",
            role=UserRole.PurchaseUser,
            is_active=True
        )
    
    app.dependency_overrides[get_current_user] = _get_mock_purchase_user
    
    try:
        response = await client.post(f"/api/v1/sales-orders/{sample_sales_order.id}/confirm")
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

async def test_sales_user_cannot_create_manufacturing_order(client: AsyncClient, sample_product: Product):
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_sales_user():
        return User(
            id=uuid.uuid4(),
            name="Mock Sales",
            email="sales@example.com",
            role=UserRole.SalesUser,
            is_active=True
        )
    
    app.dependency_overrides[get_current_user] = _get_mock_sales_user
    
    try:
        payload = {
            "product_id": str(sample_product.id),
            "bom_id": str(uuid.uuid4()),
            "quantity_to_produce": 10.0
        }
        response = await client.post("/api/v1/manufacturing-orders/", json=payload)
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

async def test_purchase_user_cannot_delete_customer(client: AsyncClient, sample_customer: Customer):
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_purchase_user():
        return User(
            id=uuid.uuid4(),
            name="Mock Purchase",
            email="purchase@example.com",
            role=UserRole.PurchaseUser,
            is_active=True
        )
    
    app.dependency_overrides[get_current_user] = _get_mock_purchase_user
    
    try:
        response = await client.delete(f"/api/v1/customers/{sample_customer.id}")
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

async def test_sales_user_cannot_delete_vendor(client: AsyncClient, sample_vendor: Vendor):
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_sales_user():
        return User(
            id=uuid.uuid4(),
            name="Mock Sales",
            email="sales@example.com",
            role=UserRole.SalesUser,
            is_active=True
        )
    
    app.dependency_overrides[get_current_user] = _get_mock_sales_user
    
    try:
        response = await client.delete(f"/api/v1/vendors/{sample_vendor.id}")
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
