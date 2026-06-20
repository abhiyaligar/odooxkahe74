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
    User,
    UserRole
)
from app.schemas.manufacturing import (
    MOCreate,
    MOUpdate,
    MOResponse,
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse
)
from app.api.dependencies import get_current_user, RoleChecker
from app.services.audit import log_action

router = APIRouter(dependencies=[Depends(get_current_user)])

mfg_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.ManufacturingUser])
read_checker = RoleChecker([
    UserRole.SuperAdmin,
    UserRole.StoreAdmin,
    UserRole.ManufacturingUser,
    UserRole.PurchaseUser,
    UserRole.InventoryManager,
    UserRole.BusinessOwner
])

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

@router.post("/", response_model=MOResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(mfg_checker)])
async def create_manufacturing_order(mo_in: MOCreate, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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

    from app.services.procurement import check_mo_components_for_procurement
    await check_mo_components_for_procurement(db_mo.id, db, user=current_user)

    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Create",
        field_changed="status",
        old_val=None,
        new_val="Draft"
    )
    await db.commit()

    # Reload and return
    return await get_mo_or_raise(db_mo.id, db)

@router.get("/", response_model=List[MOResponse], dependencies=[Depends(read_checker)])
async def list_manufacturing_orders(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ManufacturingOrder)
        .options(selectinload(ManufacturingOrder.work_orders))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{mo_id}", response_model=MOResponse, dependencies=[Depends(read_checker)])
async def get_manufacturing_order(mo_id: UUID, db: AsyncSession = Depends(get_db)):
    return await get_mo_or_raise(mo_id, db)

@router.put("/{mo_id}", response_model=MOResponse, dependencies=[Depends(mfg_checker)])
async def update_manufacturing_order(mo_id: UUID, mo_update: MOUpdate, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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

    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Update",
        field_changed="details",
        old_val="Draft",
        new_val="Draft Updated"
    )
    await db.commit()
    return await get_mo_or_raise(db_mo.id, db)

@router.delete("/{mo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(mfg_checker)])
async def delete_manufacturing_order(mo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft Manufacturing Orders can be deleted")

    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Delete",
        field_changed="status",
        old_val="Draft",
        new_val=None
    )
    await db.delete(db_mo)
    await db.commit()

# --- Work Order Overrides (Only Draft MO) ---

@router.post("/{mo_id}/work-orders/", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(mfg_checker)])
async def create_work_order(mo_id: UUID, wo_in: WorkOrderCreate, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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
    await db.flush()
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="WorkOrder",
        record_id=db_wo.id,
        action="Create",
        field_changed="operation_name",
        old_val=None,
        new_val=db_wo.operation_name
    )
    await db.commit()
    await db.refresh(db_wo)
    return db_wo

@router.put("/{mo_id}/work-orders/{wo_id}", response_model=WorkOrderResponse, dependencies=[Depends(mfg_checker)])
async def update_work_order(mo_id: UUID, wo_id: UUID, wo_update: WorkOrderUpdate, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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

    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="WorkOrder",
        record_id=db_wo.id,
        action="Update",
        field_changed="details",
        old_val="Pending",
        new_val="Updated"
    )
    await db.commit()
    await db.refresh(db_wo)
    return db_wo

@router.delete("/{mo_id}/work-orders/{wo_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(mfg_checker)])
async def delete_work_order(mo_id: UUID, wo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Routing overrides are only allowed on Draft orders")

    wo_res = await db.execute(select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.manufacturing_order_id == mo_id))
    db_wo = wo_res.scalars().first()
    if not db_wo:
        raise HTTPException(status_code=404, detail="Work Order not found on this Manufacturing Order")

    db_mo.work_orders.remove(db_wo)
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="WorkOrder",
        record_id=db_wo.id,
        action="Delete",
        field_changed="status",
        old_val=db_wo.status.value if hasattr(db_wo.status, "value") else str(db_wo.status),
        new_val=None
    )
    await db.commit()


# --- State Transitions ---

@router.post("/{mo_id}/confirm", dependencies=[Depends(mfg_checker)])
async def confirm_manufacturing_order(mo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Confirm",
        field_changed="status",
        old_val="Draft",
        new_val="Confirmed"
    )
    await db.commit()
    return {"message": "Order confirmed and materials reserved successfully."}


@router.post("/{mo_id}/start", dependencies=[Depends(mfg_checker)])
async def start_manufacturing_order(mo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
    db_mo = await get_mo_or_raise(mo_id, db)
    if db_mo.status != ManufacturingOrderStatus.Confirmed:
        raise HTTPException(status_code=400, detail="Only Confirmed orders can be started")

    db_mo.status = ManufacturingOrderStatus.InProgress
    db_mo.started_at = datetime.utcnow()
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Start",
        field_changed="status",
        old_val="Confirmed",
        new_val="InProgress"
    )
    await db.commit()
    return {"message": "Manufacturing started."}

@router.post("/{mo_id}/work-orders/{wo_id}/start", dependencies=[Depends(mfg_checker)])
async def start_work_order_endpoint(mo_id: UUID, wo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="WorkOrder",
        record_id=db_wo.id,
        action="Start",
        field_changed="status",
        old_val="Pending",
        new_val="InProgress"
    )
    await db.commit()
    return {"message": "Work Center operation started."}

@router.post("/{mo_id}/work-orders/{wo_id}/complete", dependencies=[Depends(mfg_checker)])
async def complete_work_order_endpoint(mo_id: UUID, wo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="WorkOrder",
        record_id=db_wo.id,
        action="Complete",
        field_changed="status",
        old_val="InProgress",
        new_val="Done"
    )
    await db.commit()
    return {"message": "Work Center operation completed."}

@router.post("/{mo_id}/complete", dependencies=[Depends(mfg_checker)])
async def complete_manufacturing_order(mo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Complete",
        field_changed="status",
        old_val="InProgress",
        new_val="Completed"
    )
    await db.commit()
    return {"message": "Manufacturing Order completed. Stock quantities and ledgers updated."}

@router.post("/{mo_id}/cancel", dependencies=[Depends(mfg_checker)])
async def cancel_manufacturing_order(mo_id: UUID, current_user: User = Depends(mfg_checker), db: AsyncSession = Depends(get_db)):
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

    old_status = db_mo.status.value if hasattr(db_mo.status, 'value') else str(db_mo.status)
    db_mo.status = ManufacturingOrderStatus.Cancelled
    await log_action(
        db=db,
        user=current_user,
        module="Manufacturing",
        record_type="ManufacturingOrder",
        record_id=db_mo.id,
        action="Cancel",
        field_changed="status",
        old_val=old_status,
        new_val="Cancelled"
    )
    await db.commit()
    return {"message": "Manufacturing Order cancelled."}
