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

async def test_customer_signup_creates_customer_profile(client: AsyncClient, db_session: AsyncSession):
    signup_data = {
        "name": "Customer User",
        "email": "customeruser@example.com",
        "password": "customerpassword123",
        "role": "Customer",
        "phone": "555-9876",
        "address": "789 Customer Ave"
    }
    response = await client.post("/api/v1/auth/signup", data=signup_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == signup_data["name"]
    assert res_json["email"] == signup_data["email"]
    assert res_json["role"] == "Customer"
    
    assert "customer_profile" in res_json
    assert res_json["customer_profile"] is not None
    assert res_json["customer_profile"]["phone"] == signup_data["phone"]
    assert res_json["customer_profile"]["address"] == signup_data["address"]
    
    from sqlalchemy.future import select
    from app.models.pg_models import Customer
    cust_id = uuid.UUID(res_json["id"])
    result = await db_session.execute(select(Customer).where(Customer.id == cust_id))
    db_customer = result.scalars().first()
    assert db_customer is not None
    assert db_customer.name == signup_data["name"]
    assert db_customer.email == signup_data["email"]
    assert db_customer.phone == signup_data["phone"]
    assert db_customer.address == signup_data["address"]

async def test_get_me_returns_customer_profile(client: AsyncClient, db_session: AsyncSession):
    cust_id = uuid.uuid4()
    mock_customer_user = User(
        id=cust_id,
        name="John Customer",
        email="john_me@customer.com",
        password_hash="hashed_pwd",
        role=UserRole.Customer,
        is_active=True
    )
    db_session.add(mock_customer_user)
    
    db_customer = Customer(
        id=cust_id,
        name="John Customer",
        email="john_me@customer.com",
        phone="555-555-5555",
        address="100 customer way"
    )
    db_session.add(db_customer)
    await db_session.commit()

    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_customer_user():
        return mock_customer_user
        
    app.dependency_overrides[get_current_user] = _get_mock_customer_user
    
    try:
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 200
        res_json = response.json()
        assert res_json["email"] == "john_me@customer.com"
        assert res_json["role"] == "Customer"
        assert res_json["customer_profile"] is not None
        assert res_json["customer_profile"]["phone"] == "555-555-5555"
        assert res_json["customer_profile"]["address"] == "100 customer way"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

async def test_customer_cannot_create_sales_order_for_different_customer(client: AsyncClient, db_session: AsyncSession, sample_product: Product):
    cust_id = uuid.uuid4()
    mock_customer_user = User(
        id=cust_id,
        name="John Customer",
        email="john_order@customer.com",
        password_hash="hashed_pwd",
        role=UserRole.Customer,
        is_active=True
    )
    db_session.add(mock_customer_user)
    
    db_customer = Customer(
        id=cust_id,
        name="John Customer",
        email="john_order@customer.com"
    )
    db_session.add(db_customer)
    
    other_cust_id = uuid.uuid4()
    other_customer = Customer(
        id=other_cust_id,
        name="Other Customer",
        email="other@customer.com"
    )
    db_session.add(other_customer)
    await db_session.commit()
    
    from app.main import app
    from app.api.dependencies import get_current_user
    
    async def _get_mock_customer_user():
        return mock_customer_user
        
    app.dependency_overrides[get_current_user] = _get_mock_customer_user
    
    try:
        order_data = {
            "customer_id": str(other_cust_id),
            "lines": [
                {
                    "product_id": str(sample_product.id),
                    "quantity_ordered": 5.0
                }
            ]
        }
        response = await client.post("/api/v1/sales-orders/", json=order_data)
        assert response.status_code == 403
        assert response.json()["detail"] == "Customers can only place orders for themselves."
        
        order_data_self = {
            "customer_id": str(cust_id),
            "lines": [
                {
                    "product_id": str(sample_product.id),
                    "quantity_ordered": 5.0
                }
            ]
        }
        response_self = await client.post("/api/v1/sales-orders/", json=order_data_self)
        assert response_self.status_code == 201
        res_json = response_self.json()
        assert res_json["customer_id"] == str(cust_id)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
