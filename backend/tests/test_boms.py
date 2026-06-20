import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import Product, ProductType, ProcurementStrategy, BoM, BoMLine, ManufacturingOrder, ManufacturingOrderStatus

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def finished_good_product(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Finished Cabinet",
        type=ProductType.FinishedGood,
        sales_price=500.0,
        cost_price=300.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def finished_good_product_2(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Finished Door",
        type=ProductType.FinishedGood,
        sales_price=200.0,
        cost_price=100.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def component_product_1(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Lumber Panel",
        type=ProductType.Component,
        sales_price=20.0,
        cost_price=10.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def component_product_2(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Cabinet Hinges",
        type=ProductType.Component,
        sales_price=5.0,
        cost_price=2.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

async def test_create_bom_success(
    client: AsyncClient, 
    finished_good_product: Product, 
    component_product_1: Product, 
    component_product_2: Product,
    db_session: AsyncSession
):
    bom_data = {
        "product_id": str(finished_good_product.id),
        "name": "Standard Cabinet Assembly",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(component_product_1.id), "quantity_required": 4.0},
            {"component_product_id": str(component_product_2.id), "quantity_required": 2.0}
        ]
    }
    
    response = await client.post("/api/v1/boms/", json=bom_data)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == bom_data["name"]
    assert res_json["version"] == bom_data["version"]
    assert len(res_json["lines"]) == 2
    
    # Verify DB records
    bom_id = uuid.UUID(res_json["id"])
    result = await db_session.execute(
        select(BoM).where(BoM.id == bom_id)
    )
    db_bom = result.scalars().first()
    assert db_bom is not None
    assert db_bom.product_id == finished_good_product.id
    
    lines_res = await db_session.execute(
        select(BoMLine).where(BoMLine.bom_id == bom_id)
    )
    db_lines = lines_res.scalars().all()
    assert len(db_lines) == 2

async def test_create_bom_parent_not_found(client: AsyncClient, component_product_1: Product):
    bom_data = {
        "product_id": str(uuid.uuid4()),
        "name": "Invalid Parent BoM",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(component_product_1.id), "quantity_required": 1.0}
        ]
    }
    response = await client.post("/api/v1/boms/", json=bom_data)
    assert response.status_code == 404
    assert "Parent Product" in response.json()["detail"]

async def test_create_bom_parent_not_finished_good(client: AsyncClient, component_product_1: Product, component_product_2: Product):
    bom_data = {
        "product_id": str(component_product_1.id), # Component is not FinishedGood
        "name": "Component BoM",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(component_product_2.id), "quantity_required": 1.0}
        ]
    }
    response = await client.post("/api/v1/boms/", json=bom_data)
    assert response.status_code == 400
    assert "must be of type FinishedGood" in response.json()["detail"]

async def test_create_bom_component_not_found(client: AsyncClient, finished_good_product: Product):
    bom_data = {
        "product_id": str(finished_good_product.id),
        "name": "Missing Component BoM",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(uuid.uuid4()), "quantity_required": 1.0}
        ]
    }
    response = await client.post("/api/v1/boms/", json=bom_data)
    assert response.status_code == 400
    assert "Component Product" in response.json()["detail"]

async def test_create_bom_self_reference(client: AsyncClient, finished_good_product: Product):
    bom_data = {
        "product_id": str(finished_good_product.id),
        "name": "Self Referencing BoM",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(finished_good_product.id), "quantity_required": 1.0}
        ]
    }
    response = await client.post("/api/v1/boms/", json=bom_data)
    assert response.status_code == 400
    assert "parent product as a component" in response.json()["detail"]

async def test_create_bom_circular_dependency(
    client: AsyncClient, 
    finished_good_product: Product, 
    finished_good_product_2: Product,
    db_session: AsyncSession
):
    # 1. Create a BoM for Product 2 which requires Product 1 as component
    bom_2_data = {
        "product_id": str(finished_good_product_2.id),
        "name": "BoM 2",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(finished_good_product.id), "quantity_required": 1.0}
        ]
    }
    res2 = await client.post("/api/v1/boms/", json=bom_2_data)
    assert res2.status_code == 201
    
    # 2. Try to create a BoM for Product 1 which requires Product 2 (creates a loop: 1 -> 2 -> 1)
    bom_1_data = {
        "product_id": str(finished_good_product.id),
        "name": "BoM 1",
        "version": "1.0",
        "lines": [
            {"component_product_id": str(finished_good_product_2.id), "quantity_required": 1.0}
        ]
    }
    res1 = await client.post("/api/v1/boms/", json=bom_1_data)
    assert res1.status_code == 400
    assert "Circular dependency detected" in res1.json()["detail"]

async def test_get_bom(client: AsyncClient, finished_good_product: Product, component_product_1: Product, db_session: AsyncSession):
    # Setup BoM in DB
    bom = BoM(product_id=finished_good_product.id, name="Test BoM", version="1.0")
    db_session.add(bom)
    await db_session.commit()
    
    db_line = BoMLine(bom_id=bom.id, component_product_id=component_product_1.id, quantity_required=5.0)
    db_session.add(db_line)
    await db_session.commit()

    response = await client.get(f"/api/v1/boms/{bom.id}")
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Test BoM"
    assert len(res_json["lines"]) == 1
    assert res_json["lines"][0]["component_product_id"] == str(component_product_1.id)

async def test_list_boms(client: AsyncClient, finished_good_product: Product, finished_good_product_2: Product, db_session: AsyncSession):
    bom1 = BoM(product_id=finished_good_product.id, name="List BoM 1", version="1.0")
    bom2 = BoM(product_id=finished_good_product_2.id, name="List BoM 2", version="2.0")
    db_session.add_all([bom1, bom2])
    await db_session.commit()

    # List all
    response = await client.get("/api/v1/boms/")
    assert response.status_code == 200
    assert len(response.json()) >= 2

    # Filter by product_id
    res_filtered = await client.get(f"/api/v1/boms/?product_id={finished_good_product.id}")
    assert res_filtered.status_code == 200
    assert len(res_filtered.json()) == 1
    assert res_filtered.json()[0]["name"] == "List BoM 1"

async def test_update_bom(
    client: AsyncClient, 
    finished_good_product: Product, 
    component_product_1: Product, 
    component_product_2: Product,
    db_session: AsyncSession
):
    bom = BoM(product_id=finished_good_product.id, name="Update BoM Old", version="1.0")
    db_session.add(bom)
    await db_session.commit()
    
    line = BoMLine(bom_id=bom.id, component_product_id=component_product_1.id, quantity_required=1.0)
    db_session.add(line)
    await db_session.commit()

    update_data = {
        "name": "Update BoM New",
        "version": "1.1",
        "lines": [
            {"component_product_id": str(component_product_2.id), "quantity_required": 10.0}
        ]
    }
    
    response = await client.put(f"/api/v1/boms/{bom.id}", json=update_data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Update BoM New"
    assert res_json["version"] == "1.1"
    assert len(res_json["lines"]) == 1
    assert res_json["lines"][0]["component_product_id"] == str(component_product_2.id)
    assert res_json["lines"][0]["quantity_required"] == 10.0

async def test_delete_bom_success(client: AsyncClient, finished_good_product: Product, db_session: AsyncSession):
    bom = BoM(product_id=finished_good_product.id, name="To Delete BoM", version="1.0")
    db_session.add(bom)
    await db_session.commit()

    response = await client.delete(f"/api/v1/boms/{bom.id}")
    assert response.status_code == 204

    # Verify not found
    get_res = await client.get(f"/api/v1/boms/{bom.id}")
    assert get_res.status_code == 404

async def test_delete_bom_active_mo_error(client: AsyncClient, finished_good_product: Product, db_session: AsyncSession):
    bom = BoM(product_id=finished_good_product.id, name="Locked BoM", version="1.0")
    db_session.add(bom)
    await db_session.commit()

    # Create active MO referencing this BoM
    mo = ManufacturingOrder(
        id=uuid.uuid4(),
        order_number="MO-1001",
        product_id=finished_good_product.id,
        bom_id=bom.id,
        quantity_to_produce=10.0,
        status=ManufacturingOrderStatus.Draft
    )
    db_session.add(mo)
    await db_session.commit()

    response = await client.delete(f"/api/v1/boms/{bom.id}")
    assert response.status_code == 400
    assert "referenced by active Manufacturing Order" in response.json()["detail"]
