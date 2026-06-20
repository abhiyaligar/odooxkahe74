from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import Product, UserRole, User, StockLedgerEntry, LedgerReason
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, StockLedgerEntryResponse
from app.api.dependencies import get_current_user, RoleChecker
from app.services.audit import log_action

router = APIRouter(dependencies=[Depends(get_current_user)])
admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])

def compute_free_qty(product: Product) -> ProductResponse:
    prod_dict = {c.name: getattr(product, c.name) for c in product.__table__.columns}
    prod_dict["free_to_use_qty"] = prod_dict["on_hand_qty"] - prod_dict["reserved_qty"]
    return ProductResponse(**prod_dict)

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_checker)])
async def create_product(product_in: ProductCreate, current_user: User = Depends(admin_checker), db: AsyncSession = Depends(get_db)):
    if product_in.procurement_type == "Purchase" and not product_in.vendor_id:
        raise HTTPException(status_code=400, detail="Vendor ID is required for Purchase procurement")
    if product_in.procurement_type == "Manufacturing" and not product_in.bom_id:
        raise HTTPException(status_code=400, detail="BoM ID is required for Manufacturing procurement")
        
    product_data = product_in.model_dump()
    if product_data.get("procurement_type") == "Purchase":
        product_data["bom_id"] = None
    elif product_data.get("procurement_type") == "Manufacturing":
        product_data["vendor_id"] = None
    else:
        product_data["bom_id"] = None
        product_data["vendor_id"] = None

    db_product = Product(**product_data)
    db.add(db_product)
    await db.flush()
    await log_action(
        db=db,
        user=current_user,
        module="Inventory",
        record_type="Product",
        record_id=db_product.id,
        action="Create",
        field_changed="name",
        old_val=None,
        new_val=db_product.name
    )
    await db.commit()
    await db.refresh(db_product)
    return compute_free_qty(db_product)

@router.get("/", response_model=List[ProductResponse])
async def list_products(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).offset(skip).limit(limit))
    products = result.scalars().all()
    return [compute_free_qty(p) for p in products]

@router.get("/finished-goods", response_model=List[ProductResponse], tags=["Products - Finished Goods"])
async def list_finished_goods(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .where(Product.type == "FinishedGood")
        .offset(skip)
        .limit(limit)
    )
    products = result.scalars().all()
    return [compute_free_qty(p) for p in products]

@router.get("/components", response_model=List[ProductResponse], tags=["Products - Components"])
async def list_components(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .where(Product.type == "Component")
        .offset(skip)
        .limit(limit)
    )
    products = result.scalars().all()
    return [compute_free_qty(p) for p in products]

@router.get("/stock-ledger", response_model=List[StockLedgerEntryResponse])
async def get_all_stock_ledger_entries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(
        StockLedgerEntry.id,
        StockLedgerEntry.product_id,
        StockLedgerEntry.change_qty,
        StockLedgerEntry.reason,
        StockLedgerEntry.reference_type,
        StockLedgerEntry.reference_id,
        StockLedgerEntry.resulting_on_hand_qty,
        StockLedgerEntry.created_at,
        StockLedgerEntry.created_by,
        Product.name.label("product_name")
    ).join(Product, StockLedgerEntry.product_id == Product.id).order_by(StockLedgerEntry.created_at.desc())
    
    result = await db.execute(query)
    return result.mappings().all()

@router.get("/stock-movement-trend")
async def get_stock_movement_trend(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from datetime import datetime, timedelta
    from collections import defaultdict

    # 1. Get current totals
    prod_res = await db.execute(select(Product.on_hand_qty, Product.reserved_qty))
    products_list = prod_res.all()
    
    current_on_hand = sum(p[0] for p in products_list) or 0.0
    current_reserved = sum(p[1] for p in products_list) or 0.0

    # 2. Fetch ledger entries in the last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    ledger_res = await db.execute(
        select(StockLedgerEntry.change_qty, StockLedgerEntry.created_at, StockLedgerEntry.reason)
        .where(StockLedgerEntry.created_at >= seven_days_ago)
        .order_by(StockLedgerEntry.created_at.desc())
    )
    entries = ledger_res.all()

    # 3. Reconstruct day-by-day backwards
    days_data = []
    
    running_on_hand = current_on_hand
    running_reserved = current_reserved

    # Group changes by YYYY-MM-DD
    on_hand_changes = defaultdict(float)
    reserved_changes = defaultdict(float)

    for change_qty, created_at, reason in entries:
        date_str = created_at.strftime("%Y-%m-%d")
        on_hand_changes[date_str] += change_qty
        if reason in [LedgerReason.SaleDelivery, LedgerReason.ManufacturingConsume]:
            reserved_changes[date_str] += change_qty

    # Walk backwards 7 days
    today_dt = datetime.utcnow()
    for i in range(7):
        day_dt = today_dt - timedelta(days=i)
        day_label = day_dt.strftime("%b %d")
        date_key = day_dt.strftime("%Y-%m-%d")

        days_data.append({
            "day": day_label,
            "onHand": round(max(0.0, running_on_hand), 2),
            "reserved": round(max(0.0, running_reserved), 2)
        })

        # Roll back on_hand
        day_change = on_hand_changes.get(date_key, 0.0)
        running_on_hand -= day_change

        # Roll back reserved
        day_res_change = reserved_changes.get(date_key, 0.0)
        running_reserved -= day_res_change

    # Reverse to return chronologically
    days_data.reverse()
    return days_data

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return compute_free_qty(product)

@router.put("/{product_id}", response_model=ProductResponse, dependencies=[Depends(admin_checker)])
async def update_product(product_id: UUID, product_in: ProductUpdate, current_user: User = Depends(admin_checker), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    update_data = product_in.model_dump(exclude_unset=True)
    
    # Check logical constraints if procurement type changes
    proc_type = update_data.get("procurement_type", db_product.procurement_type)
    v_id = update_data.get("vendor_id", db_product.vendor_id)
    b_id = update_data.get("bom_id", db_product.bom_id)
    
    if proc_type == "Purchase":
        if not v_id:
            raise HTTPException(status_code=400, detail="Vendor ID is required for Purchase procurement")
        update_data["bom_id"] = None
    elif proc_type == "Manufacturing":
        if not b_id:
            raise HTTPException(status_code=400, detail="BoM ID is required for Manufacturing procurement")
        update_data["vendor_id"] = None
    else:
        update_data["bom_id"] = None
        update_data["vendor_id"] = None

    for field, value in update_data.items():
        setattr(db_product, field, value)

    await log_action(
        db=db,
        user=current_user,
        module="Inventory",
        record_type="Product",
        record_id=db_product.id,
        action="Update",
        field_changed="details",
        old_val=None,
        new_val="Product updated"
    )
    await db.commit()
    await db.refresh(db_product)
    return compute_free_qty(db_product)

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_checker)])
async def delete_product(product_id: UUID, current_user: User = Depends(admin_checker), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    await log_action(
        db=db,
        user=current_user,
        module="Inventory",
        record_type="Product",
        record_id=product.id,
        action="Delete",
        field_changed="name",
        old_val=product.name,
        new_val=None
    )
    await db.delete(product)
    await db.commit()
