import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.pg_models import Product, ProductType, ProcurementStrategy, BoM, BoMLine, WorkCenter, User, UserRole

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

async def test_create_recipe_success(client: AsyncClient, finished_good_product: Product, component_product_1: Product, component_product_2: Product):
    payload = {
        "product_id": str(finished_good_product.id),
        "name": "Cabinet Recipe",
        "version": "1.0",
        "lines": [
            {
                "component_product_id": str(component_product_1.id),
                "quantity_required": 2.0
            },
            {
                "component_product_id": str(component_product_2.id),
                "quantity_required": 4.0
            }
        ]
    }
    
    response = await client.post("/api/v1/recipes/", json=payload)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == "Cabinet Recipe"
    assert res_json["version"] == "1.0"
    assert len(res_json["lines"]) == 2

async def test_create_recipe_invalid_product(client: AsyncClient, component_product_1: Product):
    # Finished goods must use FinishedGood product type, not Component
    payload = {
        "product_id": str(component_product_1.id),
        "name": "Cabinet Recipe",
        "version": "1.0",
        "lines": [
            {
                "component_product_id": str(component_product_1.id),
                "quantity_required": 2.0
            }
        ]
    }
    response = await client.post("/api/v1/recipes/", json=payload)
    assert response.status_code == 400
    assert "must be of type FinishedGood" in response.json()["detail"]

async def test_create_recipe_circular_dependency(client: AsyncClient, finished_good_product: Product, finished_good_product_2: Product, db_session: AsyncSession):
    # 1. Create Recipe 1: Product 1 requires Product 2
    bom1 = BoM(id=uuid.uuid4(), product_id=finished_good_product.id, name="Recipe 1", version="1.0")
    db_session.add(bom1)
    await db_session.flush()
    line1 = BoMLine(bom_id=bom1.id, component_product_id=finished_good_product_2.id, quantity_required=1.0)
    db_session.add(line1)
    await db_session.commit()

    # 2. Attempt to create Recipe 2: Product 2 requires Product 1 (causes loop)
    payload = {
        "product_id": str(finished_good_product_2.id),
        "name": "Recipe 2",
        "version": "1.0",
        "lines": [
            {
                "component_product_id": str(finished_good_product.id),
                "quantity_required": 1.0
            }
        ]
    }
    response = await client.post("/api/v1/recipes/", json=payload)
    assert response.status_code == 400
    assert "Circular dependency detected" in response.json()["detail"]

async def test_update_recipe_success(client: AsyncClient, finished_good_product: Product, component_product_1: Product, component_product_2: Product, db_session: AsyncSession):
    # 1. Create a Recipe
    bom = BoM(id=uuid.uuid4(), product_id=finished_good_product.id, name="Recipe Original", version="1.0")
    db_session.add(bom)
    await db_session.flush()
    line = BoMLine(bom_id=bom.id, component_product_id=component_product_1.id, quantity_required=1.0)
    db_session.add(line)
    await db_session.commit()

    # 2. Update it
    update_payload = {
        "name": "Recipe Updated",
        "version": "2.0",
        "lines": [
            {
                "component_product_id": str(component_product_2.id),
                "quantity_required": 10.0
            }
        ]
    }
    response = await client.put(f"/api/v1/recipes/{bom.id}", json=update_payload)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["name"] == "Recipe Updated"
    assert res_json["version"] == "2.0"
    assert len(res_json["lines"]) == 1
    assert res_json["lines"][0]["component_product_id"] == str(component_product_2.id)
    assert res_json["lines"][0]["quantity_required"] == 10.0

async def test_delete_recipe_success(client: AsyncClient, finished_good_product: Product, component_product_1: Product, db_session: AsyncSession):
    # 1. Create a Recipe
    bom = BoM(id=uuid.uuid4(), product_id=finished_good_product.id, name="To Delete", version="1.0")
    db_session.add(bom)
    await db_session.flush()
    line = BoMLine(bom_id=bom.id, component_product_id=component_product_1.id, quantity_required=1.0)
    db_session.add(line)
    await db_session.commit()

    # 2. Delete it
    response = await client.delete(f"/api/v1/recipes/{bom.id}")
    assert response.status_code == 204

    # 3. Verify it's gone
    get_res = await client.get(f"/api/v1/recipes/{bom.id}")
    assert get_res.status_code == 404

async def test_non_admin_cannot_create_recipe(client: AsyncClient, finished_good_product: Product, component_product_1: Product):
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
            "product_id": str(finished_good_product.id),
            "name": "Cabinet Recipe",
            "version": "1.0",
            "lines": [{"component_product_id": str(component_product_1.id), "quantity_required": 1.0}]
        }
        response = await client.post("/api/v1/recipes/", json=payload)
        assert response.status_code == 403
        assert "permission to access this resource" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.fixture
async def sample_work_center(db_session: AsyncSession) -> WorkCenter:
    wc = WorkCenter(
        id=uuid.uuid4(),
        name="Wood Shop"
    )
    db_session.add(wc)
    await db_session.commit()
    await db_session.refresh(wc)
    return wc

async def test_create_recipe_with_operations_success(client: AsyncClient, finished_good_product: Product, component_product_1: Product, sample_work_center: WorkCenter):
    payload = {
        "product_id": str(finished_good_product.id),
        "name": "Cabinet with Assembly Recipe",
        "version": "1.0",
        "lines": [
            {
                "component_product_id": str(component_product_1.id),
                "quantity_required": 2.0
            }
        ],
        "operations": [
            {
                "operation_name": "Assembly",
                "sequence": 1,
                "duration_minutes": 15,
                "work_center_id": str(sample_work_center.id)
            }
        ]
    }
    
    response = await client.post("/api/v1/recipes/", json=payload)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["name"] == "Cabinet with Assembly Recipe"
    assert len(res_json["operations"]) == 1
    assert res_json["operations"][0]["operation_name"] == "Assembly"
    assert res_json["operations"][0]["duration_minutes"] == 15
    assert res_json["operations"][0]["work_center_id"] == str(sample_work_center.id)

