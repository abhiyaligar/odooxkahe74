from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import uuid
from datetime import datetime

from app.db.session import get_db
from app.models.pg_models import SalesOrder, SalesOrderLine, Product, StockLedgerEntry, LedgerReason, ReferenceType, SalesOrderStatus, User
from app.schemas.sales import SalesOrderCreate, SalesOrderResponse
from app.api.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

@router.post("/", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_sales_order(
    order_in: SalesOrderCreate, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Generate unique order number
    order_number = f"SO-{uuid.uuid4().hex[:8].upper()}"
    
    expected_delivery_date = order_in.expected_delivery_date
    if expected_delivery_date and expected_delivery_date.tzinfo is not None:
        expected_delivery_date = expected_delivery_date.replace(tzinfo=None)
        
    db_order = SalesOrder(
        order_number=order_number,
        customer_id=order_in.customer_id,
        expected_delivery_date=expected_delivery_date,
        created_by=current_user.id
    )
    db.add(db_order)
    await db.flush() # To get the db_order.id
    
    for line in order_in.lines:
        # Fetch product price & check existence
        result = await db.execute(select(Product).where(Product.id == line.product_id))
        product = result.scalars().first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product {line.product_id} not found"
            )
            
        db_line = SalesOrderLine(
            sales_order_id=db_order.id,
            product_id=line.product_id,
            quantity_ordered=line.quantity_ordered,
            unit_price=product.sales_price
        )
        db.add(db_line)
        
    await db.commit()
    
    # Reload the order with preloaded lines relationship for response serialization
    res_result = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.id == db_order.id)
    )
    db_order = res_result.scalars().first()
    return db_order

@router.get("/", response_model=List[SalesOrderResponse])
async def list_sales_orders(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.post("/{order_id}/confirm")
async def confirm_sales_order(order_id: UUID, db: AsyncSession = Depends(get_db)):
    # 1. Fetch order
    result = await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != SalesOrderStatus.Draft:
        raise HTTPException(status_code=400, detail="Only Draft orders can be confirmed")
        
    # 2. Update status
    order.status = SalesOrderStatus.Confirmed
    
    # 3. Reserve stock for each line
    lines_result = await db.execute(select(SalesOrderLine).where(SalesOrderLine.sales_order_id == order.id))
    lines = lines_result.scalars().all()
    
    for line in lines:
        prod_res = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_res.scalars().first()
        if product:
            product.reserved_qty += line.quantity_ordered
            
            # Procurement Automation Trigger would go here if free_to_use_qty < 0
            
    await db.commit()
    return {"message": "Order confirmed and stock reserved."}

@router.post("/{order_id}/deliver")
async def deliver_sales_order(order_id: UUID, db: AsyncSession = Depends(get_db)):
    # 1. Fetch order
    result = await db.execute(select(SalesOrder).where(SalesOrder.id == order_id))
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != SalesOrderStatus.Confirmed:
        raise HTTPException(status_code=400, detail="Only Confirmed orders can be delivered")
        
    # 2. Fetch lines
    lines_result = await db.execute(select(SalesOrderLine).where(SalesOrderLine.sales_order_id == order.id))
    lines = lines_result.scalars().all()
    
    # 3. Validate stock first for all products
    products_to_update = []
    for line in lines:
        prod_res = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_res.scalars().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {line.product_id} not found")
        if product.on_hand_qty < line.quantity_ordered:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product {product.name}. Available: {product.on_hand_qty}, Required: {line.quantity_ordered}"
            )
        products_to_update.append((line, product))
        
    # 4. Update status and delivery time
    order.status = SalesOrderStatus.FullyDelivered
    order.delivered_at = datetime.utcnow()
    
    # 5. Deduct stock and write to ledger
    for line, product in products_to_update:
        line.quantity_delivered = line.quantity_ordered
        product.reserved_qty -= line.quantity_ordered
        product.on_hand_qty -= line.quantity_ordered
        
        # Write Ledger Entry
        ledger = StockLedgerEntry(
            product_id=product.id,
            change_qty=-line.quantity_ordered,
            reason=LedgerReason.SaleDelivery,
            reference_type=ReferenceType.SalesOrder,
            reference_id=order.id,
            resulting_on_hand_qty=product.on_hand_qty,
            created_by=order.created_by
        )
        db.add(ledger)
            
    await db.commit()
    return {"message": "Order delivered and stock ledger updated."}
