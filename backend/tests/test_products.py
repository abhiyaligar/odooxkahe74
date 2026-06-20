import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.pg_models import Product, Vendor, BoM, ProductType, ProcurementStrategy, ProcurementType

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_vendor(db_session: AsyncSession) -> Vendor:
    vendor = Vendor(
        id=uuid.uuid4(),
        name="Test Vendor Inc.",
        email="vendor@example.com",
        phone="1234567890"
    )
    db_session.add(vendor)
    await db_session.commit()
    await db_session.refresh(vendor)
    return vendor

@pytest.fixture
async def sample_bom(db_session: AsyncSession) -> BoM:
    bom = BoM(
        id=uuid.uuid4(),
        name="Standard BoM",
        version="v1.0"
    )
    db_session.add(bom)
    await db_session.commit()
    await db_session.refresh(bom)
    return bom

async def test_create_product_success(client: AsyncClient, sample_vendor: Vendor):
    product_data = {
        "name": "Heavy Duty Widget",
        "type": "FinishedGood",
        "sales_price": 150.0,
        "cost_price": 90.0,
        "on_hand_qty": 50.0,
        "reserved_qty": 10.0,
        "procurement_strategy": "MTS",
        "procure_on_demand": True,
        "procurement_type": "Purchase",
        "vendor_id": str(sample_vendor.id)
    }
    
    response = await client.post("/api/v1/products/", json=product_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == product_data["name"]
    assert res_json["free_to_use_qty"] == 40.0  # 50.0 on hand - 10.0 reserved
    assert res_json["vendor_id"] == str(sample_vendor.id)
    assert "id" in res_json

async def test_create_product_purchase_validation_error(client: AsyncClient):
    # Try creating a Purchase product without vendor_id
    product_data = {
        "name": "Invalid Purchase Product",
        "type": "FinishedGood",
        "sales_price": 50.0,
        "cost_price": 30.0,
        "procurement_strategy": "MTS",
        "procure_on_demand": True,
        "procurement_type": "Purchase",
        "vendor_id": None
    }
    
    response = await client.post("/api/v1/products/", json=product_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "Vendor ID is required for Purchase procurement"

async def test_create_product_manufacturing_validation_error(client: AsyncClient):
    # Try creating a Manufacturing product without bom_id
    product_data = {
        "name": "Invalid Mfg Product",
        "type": "FinishedGood",
        "sales_price": 100.0,
        "cost_price": 60.0,
        "procurement_strategy": "MTO",
        "procure_on_demand": True,
        "procurement_type": "Manufacturing",
        "bom_id": None
    }
    
    response = await client.post("/api/v1/products/", json=product_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "BoM ID is required for Manufacturing procurement"

async def test_get_product_success(client: AsyncClient, db_session: AsyncSession):
    product = Product(
        id=uuid.uuid4(),
        name="Lookup Widget",
        type=ProductType.FinishedGood,
        sales_price=20.0,
        cost_price=10.0,
        on_hand_qty=100.0,
        reserved_qty=5.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()

    response = await client.get(f"/api/v1/products/{product.id}")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Lookup Widget"
    assert res_json["free_to_use_qty"] == 95.0

async def test_get_product_not_found(client: AsyncClient):
    random_id = uuid.uuid4()
    response = await client.get(f"/api/v1/products/{random_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Product not found"

async def test_list_products(client: AsyncClient, db_session: AsyncSession):
    # Empty existing products first
    # Add dummy products
    p1 = Product(name="Widget A", type=ProductType.Component, procurement_strategy=ProcurementStrategy.MTS)
    p2 = Product(name="Widget B", type=ProductType.FinishedGood, procurement_strategy=ProcurementStrategy.MTO)
    db_session.add_all([p1, p2])
    await db_session.commit()

    response = await client.get("/api/v1/products/")
    assert response.status_code == 200
    res_json = response.json()
    assert len(res_json) >= 2
    names = [p["name"] for p in res_json]
    assert "Widget A" in names
    assert "Widget B" in names

async def test_update_product_success(client: AsyncClient, db_session: AsyncSession, sample_vendor: Vendor):
    product = Product(
        id=uuid.uuid4(),
        name="Old Name",
        type=ProductType.FinishedGood,
        sales_price=10.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()

    update_data = {
        "name": "New Name",
        "sales_price": 12.5,
        "procurement_type": "Purchase",
        "vendor_id": str(sample_vendor.id)
    }
    response = await client.put(f"/api/v1/products/{product.id}", json=update_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "New Name"
    assert res_json["sales_price"] == 12.5
    assert res_json["vendor_id"] == str(sample_vendor.id)

async def test_update_product_constraint_violation(client: AsyncClient, db_session: AsyncSession):
    product = Product(
        id=uuid.uuid4(),
        name="Constraint Widget",
        type=ProductType.FinishedGood,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()

    # Attempt to change to Manufacturing without bom_id
    update_data = {
        "procurement_type": "Manufacturing",
        "bom_id": None
    }
    response = await client.put(f"/api/v1/products/{product.id}", json=update_data)
    assert response.status_code == 400
    assert response.json()["detail"] == "BoM ID is required for Manufacturing procurement"

async def test_delete_product(client: AsyncClient, db_session: AsyncSession):
    product = Product(
        id=uuid.uuid4(),
        name="To Be Deleted",
        type=ProductType.FinishedGood,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()

    response = await client.delete(f"/api/v1/products/{product.id}")
    assert response.status_code == 204
    
    # Check it no longer exists
    get_res = await client.get(f"/api/v1/products/{product.id}")
    assert get_res.status_code == 404

async def test_list_finished_goods(client: AsyncClient, db_session: AsyncSession):
    # Setup: Create one FinishedGood and one Component
    fg = Product(name="FG item", type=ProductType.FinishedGood, procurement_strategy=ProcurementStrategy.MTS)
    comp = Product(name="Component item", type=ProductType.Component, procurement_strategy=ProcurementStrategy.MTS)
    db_session.add_all([fg, comp])
    await db_session.commit()

    # Call /finished-goods
    response = await client.get("/api/v1/products/finished-goods")
    assert response.status_code == 200
    res_json = response.json()
    names = [p["name"] for p in res_json]
    assert "FG item" in names
    assert "Component item" not in names

async def test_list_components(client: AsyncClient, db_session: AsyncSession):
    # Setup: Create one FinishedGood and one Component
    fg = Product(name="FG item 2", type=ProductType.FinishedGood, procurement_strategy=ProcurementStrategy.MTS)
    comp = Product(name="Component item 2", type=ProductType.Component, procurement_strategy=ProcurementStrategy.MTS)
    db_session.add_all([fg, comp])
    await db_session.commit()

    # Call /components
    response = await client.get("/api/v1/products/components")
    assert response.status_code == 200
    res_json = response.json()
    names = [p["name"] for p in res_json]
    assert "Component item 2" in names
    assert "FG item 2" not in names

