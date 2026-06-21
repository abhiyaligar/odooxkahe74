from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import uuid

from app.db.session import get_db
from app.models.pg_models import (
    PurchaseOrder,
    PurchaseOrderStatus,
    PurchaseOrderSource,
    PurchaseOrderLine,
    PaymentStatus,
    PaymentMethod,
    Product,
    Vendor,
    StockLedgerEntry,
    LedgerReason,
    ReferenceType,
    User,
    UserRole
)
from app.schemas.purchase import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderLineReceive
)
from app.api.dependencies import get_current_user, RoleChecker
from app.services.audit import log_action

router = APIRouter(dependencies=[Depends(get_current_user)])

write_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.PurchaseUser])
read_checker = RoleChecker([
    UserRole.SuperAdmin,
    UserRole.StoreAdmin,
    UserRole.PurchaseUser,
    UserRole.InventoryManager,
    UserRole.BusinessOwner,
    UserRole.SalesUser,
    UserRole.ManufacturingUser
])

@router.get("/", response_model=List[PurchaseOrderResponse], dependencies=[Depends(read_checker)])
async def list_purchase_orders(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{po_id}", response_model=PurchaseOrderResponse, dependencies=[Depends(read_checker)])
async def get_purchase_order(
    po_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return po

@router.post("/", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(write_checker)])
async def create_purchase_order(
    po_in: PurchaseOrderCreate,
    current_user: User = Depends(write_checker),
    db: AsyncSession = Depends(get_db)
):
    order_number = f"PO-{uuid.uuid4().hex[:6].upper()}"
    db_po = PurchaseOrder(
        vendor_id=po_in.vendor_id,
        payment_method=po_in.payment_method,
        status=PurchaseOrderStatus.Draft,
        source=PurchaseOrderSource.Manual,
        order_number=order_number,
        payment_status=PaymentStatus.Unpaid
    )
    db.add(db_po)
    await db.flush()

    for line in po_in.lines:
        prod_res = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_res.scalars().first()
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {line.product_id} not found")
        
        unit_cost = line.unit_cost if line.unit_cost is not None else product.cost_price
        db_line = PurchaseOrderLine(
            purchase_order_id=db_po.id,
            product_id=line.product_id,
            quantity_ordered=line.quantity_ordered,
            unit_cost=unit_cost,
            quantity_received=0.0
        )
        db.add(db_line)

    await log_action(
        db=db,
        user=current_user,
        module="Purchase",
        record_type="PurchaseOrder",
        record_id=db_po.id,
        action="Create",
        field_changed="status",
        old_val=None,
        new_val="Draft"
    )
    await db.commit()
    
    res_result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == db_po.id)
    )
    return res_result.scalars().first()

@router.post("/{po_id}/confirm", response_model=PurchaseOrderResponse, dependencies=[Depends(write_checker)])
async def confirm_purchase_order(
    po_id: UUID,
    current_user: User = Depends(write_checker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    if po.status != PurchaseOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft purchase orders can be confirmed")

    # ── Wallet auto-payment ───────────────────────────────────────────────────
    if po.payment_method == PaymentMethod.Wallet:
        total_cost = sum(line.quantity_ordered * line.unit_cost for line in po.lines)

        if total_cost > 0:
            from app.api.v1.wallets import get_or_create_wallet, STORE_WALLET_ID
            from app.models.pg_models import (
                WalletTransaction, TransactionType,
                TransactionStatus, PaymentMethod as WalletPaymentMethod
            )
            from datetime import datetime

            store_wallet = await get_or_create_wallet(STORE_WALLET_ID, db)

            # Atomic balance check before touching anything
            if store_wallet.balance < total_cost:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient funds in Store Wallet. "
                        f"Required: ₹{total_cost:,.2f}, "
                        f"Available: ₹{store_wallet.balance:,.2f}. "
                        f"Please top-up the store wallet before confirming."
                    )
                )

            vendor_wallet = await get_or_create_wallet(po.vendor_id, db)

            # Debit store wallet
            store_wallet.balance -= total_cost
            db_debit = WalletTransaction(
                wallet_id=STORE_WALLET_ID,
                amount=total_cost,
                type=TransactionType.PurchasePayment,
                payment_method=WalletPaymentMethod.Wallet,
                status=TransactionStatus.Completed,
                reference_id=str(po.id),
                created_by=current_user.id
            )
            db.add(db_debit)

            # Credit vendor wallet
            vendor_wallet.balance += total_cost
            db_credit = WalletTransaction(
                wallet_id=po.vendor_id,
                amount=total_cost,
                type=TransactionType.SaleReceipt,
                payment_method=WalletPaymentMethod.Wallet,
                status=TransactionStatus.Completed,
                reference_id=str(po.id),
                created_by=current_user.id
            )
            db.add(db_credit)

            # Reduce vendor outstanding payable
            vendor_res = await db.execute(select(Vendor).where(Vendor.id == po.vendor_id))
            vendor = vendor_res.scalars().first()
            if vendor:
                vendor.outstanding_payable = max(0.0, (vendor.outstanding_payable or 0.0) - total_cost)

            po.payment_status = PaymentStatus.Paid

    from datetime import datetime
    po.confirmed_at = datetime.utcnow()
    po.status = PurchaseOrderStatus.Confirmed

    await log_action(
        db=db,
        user=current_user,
        module="Purchase",
        record_type="PurchaseOrder",
        record_id=po.id,
        action="Confirm",
        field_changed="status",
        old_val="Draft",
        new_val="Confirmed"
    )
    await db.commit()
    await db.refresh(po, ["lines"])
    return po

@router.post("/lines/{line_id}/receive", response_model=PurchaseOrderResponse, dependencies=[Depends(write_checker)])
async def receive_purchase_order_line(
    line_id: UUID,
    receive_in: PurchaseOrderLineReceive,
    current_user: User = Depends(write_checker),
    db: AsyncSession = Depends(get_db)
):
    line_res = await db.execute(
        select(PurchaseOrderLine)
        .where(PurchaseOrderLine.id == line_id)
    )
    line = line_res.scalars().first()
    if not line:
        raise HTTPException(status_code=404, detail="Purchase Order Line not found")

    po_res = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == line.purchase_order_id)
    )
    po = po_res.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    if po.status not in [PurchaseOrderStatus.Confirmed, PurchaseOrderStatus.PartiallyReceived]:
        raise HTTPException(status_code=400, detail="Purchase Order must be Confirmed or PartiallyReceived to receive goods")

    remaining = line.quantity_ordered - line.quantity_received
    if receive_in.quantity_received > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive {receive_in.quantity_received}; only {remaining} remaining on order."
        )

    old_qty_received = line.quantity_received
    line.quantity_received += receive_in.quantity_received

    prod_res = await db.execute(
        select(Product).where(Product.id == line.product_id)
    )
    product = prod_res.scalars().first()
    if product:
        product.on_hand_qty += receive_in.quantity_received

        ledger_entry = StockLedgerEntry(
            product_id=line.product_id,
            change_qty=receive_in.quantity_received,
            reason=LedgerReason.PurchaseReceipt,
            reference_type=ReferenceType.PurchaseOrder,
            reference_id=po.id,
            resulting_on_hand_qty=product.on_hand_qty
        )
        db.add(ledger_entry)

    all_lines_res = await db.execute(
        select(PurchaseOrderLine).where(PurchaseOrderLine.purchase_order_id == po.id)
    )
    all_lines = all_lines_res.scalars().all()

    fully_received = True
    any_received = False
    for l in all_lines:
        current_received = line.quantity_received if l.id == line.id else l.quantity_received
        if current_received < l.quantity_ordered:
            fully_received = False
        if current_received > 0:
            any_received = True

    if fully_received:
        po.status = PurchaseOrderStatus.FullyReceived
    elif any_received:
        po.status = PurchaseOrderStatus.PartiallyReceived

    await log_action(
        db=db,
        user=current_user,
        module="Purchase",
        record_type="PurchaseOrder",
        record_id=po.id,
        action="Receive",
        field_changed="quantity_received",
        old_val=str(old_qty_received),
        new_val=str(line.quantity_received)
    )
    await db.commit()
    await db.refresh(po, ["lines"])
    return po

@router.post("/{po_id}/cancel", response_model=PurchaseOrderResponse, dependencies=[Depends(write_checker)])
async def cancel_purchase_order(
    po_id: UUID,
    current_user: User = Depends(write_checker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    if po.status in [PurchaseOrderStatus.FullyReceived, PurchaseOrderStatus.Cancelled]:
        raise HTTPException(status_code=400, detail="Cannot cancel a fully received or already cancelled purchase order")

    # ── Wallet refund on cancel if payment was already made ───────────────────
    if po.payment_method == PaymentMethod.Wallet and po.payment_status == PaymentStatus.Paid:
        total_cost = sum(line.quantity_ordered * line.unit_cost for line in po.lines)
        if total_cost > 0:
            from app.api.v1.wallets import get_or_create_wallet, STORE_WALLET_ID
            from app.models.pg_models import (
                WalletTransaction, TransactionType,
                TransactionStatus, PaymentMethod as WalletPaymentMethod
            )

            store_wallet = await get_or_create_wallet(STORE_WALLET_ID, db)
            vendor_wallet = await get_or_create_wallet(po.vendor_id, db)

            # Refund store wallet
            store_wallet.balance += total_cost
            db_refund = WalletTransaction(
                wallet_id=STORE_WALLET_ID,
                amount=total_cost,
                type=TransactionType.Refund,
                payment_method=WalletPaymentMethod.Wallet,
                status=TransactionStatus.Completed,
                reference_id=str(po.id),
                created_by=current_user.id
            )
            db.add(db_refund)

            # Debit vendor wallet back
            vendor_wallet.balance = max(0.0, vendor_wallet.balance - total_cost)
            db_vendor_debit = WalletTransaction(
                wallet_id=po.vendor_id,
                amount=total_cost,
                type=TransactionType.Refund,
                payment_method=WalletPaymentMethod.Wallet,
                status=TransactionStatus.Completed,
                reference_id=str(po.id),
                created_by=current_user.id
            )
            db.add(db_vendor_debit)

            # Restore vendor outstanding payable
            vendor_res = await db.execute(select(Vendor).where(Vendor.id == po.vendor_id))
            vendor = vendor_res.scalars().first()
            if vendor:
                vendor.outstanding_payable = (vendor.outstanding_payable or 0.0) + total_cost

            po.payment_status = PaymentStatus.Unpaid

    old_status = po.status.value if hasattr(po.status, 'value') else str(po.status)
    po.status = PurchaseOrderStatus.Cancelled
    await log_action(
        db=db,
        user=current_user,
        module="Purchase",
        record_type="PurchaseOrder",
        record_id=po.id,
        action="Cancel",
        field_changed="status",
        old_val=old_status,
        new_val="Cancelled"
    )
    await db.commit()
    await db.refresh(po, ["lines"])
    return po
