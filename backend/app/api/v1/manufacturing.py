from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import uuid
from datetime import datetime

from app.db.session import get_db
from app.models.pg_models import (
    ManufacturingOrder,
    ManufacturingOrderStatus,
    ManufacturingOrderSource,
    WorkOrder,
    WorkOrderStatus,
    BoM,
    BoMLine,
    BoMOperation,
    Product,
    ProductType,
    StockLedgerEntry,
    LedgerReason,
    ReferenceType,
    User
)
from app.schemas.manufacturing import (
    MOCreate,
    MOUpdate,
    MOResponse,
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse
)
from app.api.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

# Helper: Get MO or raise 404
async def get_mo_or_raise(mo_id: UUID, db: AsyncSession) -> ManufacturingOrder:
    result = await db.execute(
        select(ManufacturingOrder)
        .where(ManufacturingOrder.id == mo_id)
    )
    mo = result.scalars().first()
    if not mo:
        raise HTTPException(status_code=404, detail="Manufacturing Order not found")
    await db.refresh(mo, ["work_orders"])
    return mo

@router.post("/", response_model=MOResponse, status_code=status.HTTP_201_CREATED)
async def create_manufacturing_order(mo_in: MOCreate, db: AsyncSession = Depends(get_db)):
    # 1. Verify parent product exists & is FinishedGood
    prod_res = await db.execute(select(Product).where(Product.id == mo_in.product_id))
    product = prod_res.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.type != ProductType.FinishedGood:
        raise HTTPException(status_code=400, detail="Manufacturing Order parent product must be of type FinishedGood")

    # 2. Verify BoM exists & belongs to the product
    bom_res = await db.execute(select(BoM).where(BoM.id == mo_in.bom_id))
    bom = bom_res.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="BoM not found")
    if bom.product_id != mo_in.product_id:
        raise HTTPException(status_code=400, detail="BoM does not belong to the selected product")

    # 3. Verify assignee if provided
    if mo_in.assignee_id:
        user_res = await db.execute(select(User).where(User.id == mo_in.assignee_id))
        user = user_res.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="Assignee User not found")

    # 4. Create MO
    order_number = f"MO-{uuid.uuid4().hex[:8].upper()}"
    db_mo = ManufacturingOrder(
        product_id=mo_in.product_id,
        bom_id=mo_in.bom_id,
        quantity_to_produce=mo_in.quantity_to_produce,
        assignee_id=mo_in.assignee_id,
        order_number=order_number,
        status=ManufacturingOrderStatus.Draft,
        source=ManufacturingOrderSource.Manual
    )
    db.add(db_mo)
    await db.flush()

    # 5. Populate Default Work Orders from BoM Operations
    ops_res = await db.execute(
        select(BoMOperation)
        .where(BoMOperation.bom_id == mo_in.bom_id)
        .order_by(BoMOperation.sequence)
    )
    operations = ops_res.scalars().all()
    for op in operations:
        wo = WorkOrder(
            manufacturing_order_id=db_mo.id,
            operation_name=op.operation_name,
            sequence=op.sequence,
            work_center_id=op.work_center_id,
            status=WorkOrderStatus.Pending
        )
        db.add(wo)

    await db.commit()



    # Reload and return
    return await get_mo_or_raise(db_mo.id, db)

@router.get("/", response_model=List[MOResponse])
async def list_manufacturing_orders(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManufacturingOrder)
        .options(selectinload(ManufacturingOrder.work_orders))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{mo_id}", response_model=MOResponse)
async def get_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_mo_or_raise(mo_id, db)

@router.put("/{mo_id}", response_model=MOResponse)
async def update_manufacturing_order(mo_id: UUID, mo_update: MOUpdate, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft Manufacturing Orders can be modified")

    if mo_update.quantity_to_produce is not None:
        db_mo.quantity_to_produce = mo_update.quantity_to_produce

    if mo_update.assignee_id is not None:
        user_res = await db.execute(select(User).where(User.id == mo_update.assignee_id))
        user = user_res.scalars().first()
        if not user:
            raise HTTPException(status_code=404, detail="Assignee User not found")
        db_mo.assignee_id = mo_update.assignee_id

    await db.commit()
    return await get_mo_or_raise(db_mo.id, db)

@router.delete("/{mo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft Manufacturing Orders can be deleted")

    await db.delete(db_mo)
    await db.commit()

# --- Work Order Overrides (Only Draft MO) ---

@router.post("/{mo_id}/work-orders/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(mo_id: UUID, wo_in: WorkOrderCreate, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Routing overrides are only allowed on Draft orders")

    db_wo = WorkOrder(
        manufacturing_order_id=db_mo.id,
        operation_name=wo_in.operation_name,
        sequence=wo_in.sequence,
        work_center_id=wo_in.work_center_id,
        status=WorkOrderStatus.Pending
    )
    db_mo.work_orders.append(db_wo)
    await db.commit()
    await db.refresh(db_wo)
    return db_wo

@router.put("/{mo_id}/work-orders/{wo_id}", response_model=WorkOrderResponse)
async def update_work_order(mo_id: UUID, wo_id: UUID, wo_update: WorkOrderUpdate, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Routing overrides are only allowed on Draft orders")

    wo_res = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.manufacturing_order_id == mo_id))
    db_wo = wo_res.scalars().first()
    if not db_wo:
        raise HTTPException(status_code=404, detail="Work Order not found on this Manufacturing Order")

    if wo_update.operation_name is not None:
        db_wo.operation_name = wo_update.operation_name
    if wo_update.sequence is not None:
        db_wo.sequence = wo_update.sequence
    if wo_update.work_center_id is not None:
        db_wo.work_center_id = wo_update.work_center_id

    await db.commit()
    await db.refresh(db_wo)
    return db_wo

@router.delete("/{mo_id}/work-orders/{wo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_work_order(mo_id: UUID, wo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Routing overrides are only allowed on Draft orders")

    wo_res = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.manufacturing_order_id == mo_id))
    db_wo = wo_res.scalars().first()
    if not db_wo:
        raise HTTPException(status_code=404, detail="Work Order not found on this Manufacturing Order")

    db_mo.work_orders.remove(db_wo)
    await db.commit()


# --- State Transitions ---

@router.post("/{mo_id}/confirm")
async def confirm_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft orders can be confirmed")

    # Explode BoM lines to calculate required component quantities
    bom_lines_res = await db.execute(select(BoMLine).where(BoMLine.bom_id == db_mo.bom_id))
    lines = bom_lines_res.scalars().all()
    if not lines:
        raise HTTPException(status_code=400, detail="Cannot confirm order: The BoM contains no component lines")

    # Atomic SQL Concurrency Check & Reservation
    for line in lines:
        required_qty = line.quantity_required * db_mo.quantity_to_produce
        component_product_id = line.component_product_id
        
        # Execute non-blocking update assertion
        stmt = (
            update(Product)
            .where(Product.id == component_product_id)
            .where((Product.on_hand_qty - Product.reserved_qty) >= required_qty)
            .values(reserved_qty=Product.reserved_qty + required_qty)
        )
        res = await db.execute(stmt)
        if res.rowcount == 0:
            # Insufficient stock detected! Rollback transaction
            await db.rollback()
            
            # Fetch product details for useful error detail
            p_res = await db.execute(select(Product).where(Product.id == component_product_id))
            prod = p_res.scalars().first()
            p_name = prod.name if prod else "Unknown Component"
            available = (prod.on_hand_qty - prod.reserved_qty) if prod else 0.0
            
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for raw material {p_name}. Available: {available}, Required: {required_qty}"
            )

    db_mo.status = ManufacturingOrderStatus.Confirmed
    await db.commit()
    return {"message": "Order confirmed and materials reserved successfully."}


@router.post("/{mo_id}/start")
async def start_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Confirmed:
        raise HTTPException(status_code=400, detail="Only Confirmed orders can be started")

    db_mo.status = ManufacturingOrderStatus.InProgress
    db_mo.started_at = datetime.utcnow()
    await db.commit()
    return {"message": "Manufacturing started."}

@router.post("/{mo_id}/work-orders/{wo_id}/start")
async def start_work_order_endpoint(mo_id: UUID, wo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.InProgress:
        raise HTTPException(status_code=400, detail="Operations can only be started if the Manufacturing Order is InProgress")

    wo_res = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.manufacturing_order_id == mo_id))
    db_wo = wo_res.scalars().first()
    if not db_wo:
        raise HTTPException(status_code=404, detail="Work Order not found")
    if db_wo.status != WorkOrderStatus.Pending:
        raise HTTPException(status_code=400, detail="Only Pending Work Orders can be started")

    # Enforce routing sequence: Verify all work orders with lower sequence are marked Done
    seq_check_res = await db.execute(
        select(WorkOrder).where(
            WorkOrder.manufacturing_order_id == mo_id,
            WorkOrder.sequence < db_wo.sequence,
            WorkOrder.status != WorkOrderStatus.Done
        )
    )
    incomplete_prev = seq_check_res.scalars().first()
    if incomplete_prev:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot start this operation. Previous sequence step '{incomplete_prev.operation_name}' must be completed first."
        )

    db_wo.status = WorkOrderStatus.InProgress
    db_wo.started_at = datetime.utcnow()
    await db.commit()
    return {"message": "Work Center operation started."}

@router.post("/{mo_id}/work-orders/{wo_id}/complete")
async def complete_work_order_endpoint(mo_id: UUID, wo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.InProgress:
        raise HTTPException(status_code=400, detail="Operations can only be modified if the Manufacturing Order is InProgress")

    wo_res = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.manufacturing_order_id == mo_id))
    db_wo = wo_res.scalars().first()
    if not db_wo:
        raise HTTPException(status_code=404, detail="Work Order not found")
    if db_wo.status != WorkOrderStatus.InProgress:
        raise HTTPException(status_code=400, detail="Only InProgress Work Orders can be completed")

    db_wo.status = WorkOrderStatus.Done
    db_wo.completed_at = datetime.utcnow()
    await db.commit()
    return {"message": "Work Center operation completed."}

@router.post("/{mo_id}/complete")
async def complete_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.InProgress:
        raise HTTPException(status_code=400, detail="Only InProgress orders can be completed")

    # Assert all work orders are completed
    incomplete_res = await db.execute(
        select(WorkOrder).where(WorkOrder.manufacturing_order_id == mo_id, WorkOrder.status != WorkOrderStatus.Done)
    )
    first_incomplete = incomplete_res.scalars().first()
    if first_incomplete:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete order: Operation step '{first_incomplete.operation_name}' is not finished."
        )

    # 1. Deduct component stocks
    bom_lines_res = await db.execute(select(BoMLine).where(BoMLine.bom_id == db_mo.bom_id))
    lines = bom_lines_res.scalars().all()
    for line in lines:
        required_qty = line.quantity_required * db_mo.quantity_to_produce
        
        prod_res = await db.execute(select(Product).where(Product.id == line.component_product_id))
        product = prod_res.scalars().first()
        if product:
            product.reserved_qty -= required_qty
            product.on_hand_qty -= required_qty
            
            # Log consume ledger entry
            ledger = StockLedgerEntry(
                product_id=product.id,
                change_qty=-required_qty,
                reason=LedgerReason.ManufacturingConsume,
                reference_type=ReferenceType.ManufacturingOrder,
                reference_id=db_mo.id,
                resulting_on_hand_qty=product.on_hand_qty,
                created_by=db_mo.assignee_id
            )
            db.add(ledger)

    # 2. Add finished good stock
    parent_res = await db.execute(select(Product).where(Product.id == db_mo.product_id))
    parent_product = parent_res.scalars().first()
    if parent_product:
        parent_product.on_hand_qty += db_mo.quantity_to_produce
        
        # Log produce ledger entry
        ledger = StockLedgerEntry(
            product_id=parent_product.id,
            change_qty=db_mo.quantity_to_produce,
            reason=LedgerReason.ManufacturingProduce,
            reference_type=ReferenceType.ManufacturingOrder,
            reference_id=db_mo.id,
            resulting_on_hand_qty=parent_product.on_hand_qty,
            created_by=db_mo.assignee_id
        )
        db.add(ledger)

    db_mo.status = ManufacturingOrderStatus.Completed
    db_mo.completed_at = datetime.utcnow()
    await db.commit()
    return {"message": "Manufacturing Order completed. Stock quantities and ledgers updated."}

@router.post("/{mo_id}/cancel")
async def cancel_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status in [ManufacturingOrderStatus.Completed, ManufacturingOrderStatus.Cancelled]:
        raise HTTPException(status_code=400, detail="Completed or Cancelled orders cannot be cancelled")

    # If Confirmed or InProgress, release reserved stock
    if db_mo.status in [ManufacturingOrderStatus.Confirmed, ManufacturingOrderStatus.InProgress]:
        bom_lines_res = await db.execute(select(BoMLine).where(BoMLine.bom_id == db_mo.bom_id))
        lines = bom_lines_res.scalars().all()
        for line in lines:
            required_qty = line.quantity_required * db_mo.quantity_to_produce
            
            # Atomic decrement of reservation
            stmt = (
                update(Product)
                .where(Product.id == line.component_product_id)
                .values(reserved_qty=Product.reserved_qty - required_qty)
            )
            await db.execute(stmt)

    db_mo.status = ManufacturingOrderStatus.Cancelled
    await db.commit()
    return {"message": "Manufacturing Order cancelled."}
