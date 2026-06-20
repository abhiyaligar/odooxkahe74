import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.pg_models import (
    Product,
    ProductType,
    ProcurementStrategy,
    BoM,
    BoMLine,
    BoMOperation,
    WorkCenter,
    ManufacturingOrder,
    ManufacturingOrderStatus,
    WorkOrder,
    WorkOrderStatus,
    StockLedgerEntry,
    LedgerReason
)

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def sample_work_center(db_session: AsyncSession) -> WorkCenter:
    wc = WorkCenter(id=uuid.uuid4(), name="Main assembly line")
    db_session.add(wc)
    await db_session.commit()
    await db_session.refresh(wc)
    return wc

@pytest.fixture
async def finished_good(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Premium Sofa",
        type=ProductType.FinishedGood,
        sales_price=1000.0,
        cost_price=600.0,
        on_hand_qty=5.0,
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def component_1(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Wood Frames",
        type=ProductType.Component,
        sales_price=100.0,
        cost_price=60.0,
        on_hand_qty=20.0, # Enough for 2 Sofas
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def component_2(db_session: AsyncSession) -> Product:
    product = Product(
        id=uuid.uuid4(),
        name="Fabric Roll",
        type=ProductType.Component,
        sales_price=50.0,
        cost_price=30.0,
        on_hand_qty=10.0, # Enough for 2 Sofas
        reserved_qty=0.0,
        procurement_strategy=ProcurementStrategy.MTS
    )
    db_session.add(product)
    await db_session.commit()
    await db_session.refresh(product)
    return product

@pytest.fixture
async def sample_bom(db_session: AsyncSession, finished_good: Product) -> BoM:
    bom = BoM(id=uuid.uuid4(), product_id=finished_good.id, name="Sofa Recipe", version="1.0")
    db_session.add(bom)
    await db_session.commit()
    await db_session.refresh(bom)
    return bom

@pytest.fixture
async def bom_setup(
    db_session: AsyncSession,
    sample_bom: BoM,
    component_1: Product,
    component_2: Product,
    sample_work_center: WorkCenter
) -> BoM:
    # BoM Lines
    line1 = BoMLine(bom_id=sample_bom.id, component_product_id=component_1.id, quantity_required=5.0)
    line2 = BoMLine(bom_id=sample_bom.id, component_product_id=component_2.id, quantity_required=2.0)
    db_session.add_all([line1, line2])
    
    # BoM Operations
    op1 = BoMOperation(
        bom_id=sample_bom.id,
        operation_name="Frame Framing",
        sequence=1,
        duration_minutes=60,
        work_center_id=sample_work_center.id
    )
    op2 = BoMOperation(
        bom_id=sample_bom.id,
        operation_name="Fabric Stapling",
        sequence=2,
        duration_minutes=30,
        work_center_id=sample_work_center.id
    )
    db_session.add_all([op1, op2])
    await db_session.commit()
    return sample_bom

async def test_create_mo_success(client: AsyncClient, finished_good: Product, bom_setup: BoM, db_session: AsyncSession):
    payload = {
        "product_id": str(finished_good.id),
        "bom_id": str(bom_setup.id),
        "quantity_to_produce": 2.0
    }
    
    response = await client.post("/api/v1/manufacturing-orders/", json=payload)
    assert response.status_code == 201
    res_json = response.json()
    assert res_json["status"] == "Draft"
    assert "order_number" in res_json
    assert len(res_json["work_orders"]) == 2
    
    # Sort and assert sequence
    wos = sorted(res_json["work_orders"], key=lambda w: w["sequence"])
    assert wos[0]["operation_name"] == "Frame Framing"
    assert wos[0]["sequence"] == 1
    assert wos[1]["operation_name"] == "Fabric Stapling"
    assert wos[1]["sequence"] == 2

async def test_update_and_delete_mo_draft(client: AsyncClient, finished_good: Product, bom_setup: BoM, db_session: AsyncSession):
    payload = {
        "product_id": str(finished_good.id),
        "bom_id": str(bom_setup.id),
        "quantity_to_produce": 2.0
    }
    # Create draft
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]

    # Update
    res_update = await client.put(f"/api/v1/manufacturing-orders/{mo_id}", json={"quantity_to_produce": 3.0})
    assert res_update.status_code == 200
    assert res_update.json()["quantity_to_produce"] == 3.0

    # Delete
    res_del = await client.delete(f"/api/v1/manufacturing-orders/{mo_id}")
    assert res_del.status_code == 204

    # Verify not found
    res_check = await client.get(f"/api/v1/manufacturing-orders/{mo_id}")
    assert res_check.status_code == 404

async def test_custom_routing_overrides(
    client: AsyncClient, 
    finished_good: Product, 
    bom_setup: BoM, 
    sample_work_center: WorkCenter
):
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 1.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]

    # Add custom step sequence 3
    custom_wo = {
        "operation_name": "Quality Check",
        "sequence": 3,
        "work_center_id": str(sample_work_center.id)
    }
    res_wo = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/", json=custom_wo)
    assert res_wo.status_code == 201
    wo_id = res_wo.json()["id"]

    # Read details and verify sequence 3 exists
    res_details = await client.get(f"/api/v1/manufacturing-orders/{mo_id}")
    wos = res_details.json()["work_orders"]
    assert len(wos) == 3
    assert any(w["operation_name"] == "Quality Check" and w["sequence"] == 3 for w in wos)

    # Edit step
    res_edit = await client.put(
        f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo_id}", 
        json={"operation_name": "QC Inspect"}
    )
    assert res_edit.status_code == 200
    assert res_edit.json()["operation_name"] == "QC Inspect"

    # Delete custom step
    res_del = await client.delete(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo_id}")
    assert res_del.status_code == 204

    # Verify back to 2 steps
    res_details2 = await client.get(f"/api/v1/manufacturing-orders/{mo_id}")
    assert len(res_details2.json()["work_orders"]) == 2

async def test_confirm_mo_success(client: AsyncClient, finished_good: Product, bom_setup: BoM, component_1: Product, db_session: AsyncSession):
    # Setup stock: Wood Panels has 20. Fabric has 10.
    # Order Qty 2 needs: 2 * 5 = 10 Wood Panels, 2 * 2 = 4 Fabric.
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 2.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]

    res_conf = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/confirm")
    assert res_conf.status_code == 200
    assert res_conf.json()["message"] == "Order confirmed and materials reserved successfully."

    # Verify MO status is Confirmed
    mo_res = await db_session.execute(select(ManufacturingOrder).where(ManufacturingOrder.id == uuid.UUID(mo_id)))
    assert mo_res.scalars().first().status == ManufacturingOrderStatus.Confirmed

    # Verify component reservation
    c1_res = await db_session.execute(select(Product).where(Product.id == component_1.id))
    assert c1_res.scalars().first().reserved_qty == 10.0

async def test_confirm_mo_insufficient_stock_error(
    client: AsyncClient, 
    finished_good: Product, 
    bom_setup: BoM, 
    component_1: Product, 
    component_2: Product,
    db_session: AsyncSession
):
    # Setup stock: Wood Panels 20, Fabric 10.
    # Order Qty 6 needs: 6 * 5 = 30 Wood Panels (Insuf!), 6 * 2 = 12 Fabric (Insuf!).
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 6.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]

    res_conf = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/confirm")
    assert res_conf.status_code == 400
    assert "Insufficient stock for raw material" in res_conf.json()["detail"]

    # Verify NO component stock is reserved (atomic rollback assertion)
    await db_session.refresh(component_1)
    await db_session.refresh(component_2)
    assert component_1.reserved_qty == 0.0
    assert component_2.reserved_qty == 0.0

async def test_start_mo_and_sequence_enforcement(client: AsyncClient, finished_good: Product, bom_setup: BoM):
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 1.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]
    wos = sorted(res_create.json()["work_orders"], key=lambda w: w["sequence"])
    wo1_id = wos[0]["id"]
    wo2_id = wos[1]["id"]

    # Confirm order
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/confirm")

    # Start MO
    res_start = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/start")
    assert res_start.status_code == 200

    # Try starting Work Order 2 (sequence 2) first
    res_wo2 = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo2_id}/start")
    assert res_wo2.status_code == 400
    assert "Previous sequence step" in res_wo2.json()["detail"]

    # Start Work Order 1 (sequence 1)
    res_wo1 = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo1_id}/start")
    assert res_wo1.status_code == 200

async def test_complete_mo_success(
    client: AsyncClient, 
    finished_good: Product, 
    bom_setup: BoM, 
    component_1: Product, 
    component_2: Product,
    db_session: AsyncSession
):
    # Qty 1 needs: 5 wood panels, 2 fabrics.
    # Initial stock sofa=5, panel=20, fabric=10.
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 1.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]
    wos = sorted(res_create.json()["work_orders"], key=lambda w: w["sequence"])
    wo1_id = wos[0]["id"]
    wo2_id = wos[1]["id"]

    # 1. Confirm & Start
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/confirm")
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/start")

    # 2. Run operations
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo1_id}/start")
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo1_id}/complete")

    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo2_id}/start")
    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/work-orders/{wo2_id}/complete")

    # 3. Complete MO
    res_comp = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/complete")
    assert res_comp.status_code == 200

    # 4. Assert stock updates
    # Sofa: 5.0 initial + 1.0 produced = 6.0
    fg_res = await db_session.execute(select(Product).where(Product.id == finished_good.id))
    prod_fg = fg_res.scalars().first()
    assert prod_fg.on_hand_qty == 6.0

    # Wood Panel: 20.0 initial - 5.0 consumed = 15.0
    c1_res = await db_session.execute(select(Product).where(Product.id == component_1.id))
    prod_c1 = c1_res.scalars().first()
    assert prod_c1.on_hand_qty == 15.0
    assert prod_c1.reserved_qty == 0.0


    # 5. Assert stock ledger logs
    ledgers_res = await db_session.execute(
        select(StockLedgerEntry).where(StockLedgerEntry.reference_id == uuid.UUID(mo_id))
    )
    ledgers = ledgers_res.scalars().all()
    assert len(ledgers) == 3
    reasons = [l.reason for l in ledgers]
    assert LedgerReason.ManufacturingConsume in reasons
    assert LedgerReason.ManufacturingProduce in reasons

async def test_cancel_mo_releases_reservation(client: AsyncClient, finished_good: Product, bom_setup: BoM, component_1: Product, db_session: AsyncSession):
    payload = {"product_id": str(finished_good.id), "bom_id": str(bom_setup.id), "quantity_to_produce": 1.0}
    res_create = await client.post("/api/v1/manufacturing-orders/", json=payload)
    mo_id = res_create.json()["id"]

    await client.post(f"/api/v1/manufacturing-orders/{mo_id}/confirm")
    
    # Cancel it
    res_cancel = await client.post(f"/api/v1/manufacturing-orders/{mo_id}/cancel")
    assert res_cancel.status_code == 200

    # Assert reservation released
    c1_res = await db_session.execute(select(Product).where(Product.id == component_1.id))
    assert c1_res.scalars().first().reserved_qty == 0.0
