from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter()

def compute_free_qty(product: Product) -> ProductResponse:
    prod_dict = {c.name: getattr(product, c.name) for c in product.__table__.columns}
    prod_dict["free_to_use_qty"] = prod_dict["on_hand_qty"] - prod_dict["reserved_qty"]
    return ProductResponse(**prod_dict)

@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(product_in: ProductCreate, db: AsyncSession = Depends(get_db)):
    if product_in.procurement_type == "Purchase" and not product_in.vendor_id:
        raise HTTPException(status_code=400, detail="Vendor ID is required for Purchase procurement")
    if product_in.procurement_type == "Manufacturing" and not product_in.bom_id:
        raise HTTPException(status_code=400, detail="BoM ID is required for Manufacturing procurement")
        
    db_product = Product(**product_in.model_dump())
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return compute_free_qty(db_product)

@router.get("/", response_model=List[ProductResponse])
async def list_products(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).offset(skip).limit(limit))
    products = result.scalars().all()
    return [compute_free_qty(p) for p in products]

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(product_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return compute_free_qty(product)

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(product_id: UUID, product_in: ProductUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    db_product = result.scalars().first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    update_data = product_in.model_dump(exclude_unset=True)
    
    # Check logical constraints if procurement type changes
    proc_type = update_data.get("procurement_type", db_product.procurement_type)
    v_id = update_data.get("vendor_id", db_product.vendor_id)
    b_id = update_data.get("bom_id", db_product.bom_id)
    
    if proc_type == "Purchase" and not v_id:
        raise HTTPException(status_code=400, detail="Vendor ID is required for Purchase procurement")
    if proc_type == "Manufacturing" and not b_id:
        raise HTTPException(status_code=400, detail="BoM ID is required for Manufacturing procurement")

    for field, value in update_data.items():
        setattr(db_product, field, value)

    await db.commit()
    await db.refresh(db_product)
    return compute_free_qty(db_product)

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    # In a real ERP we would check for active Orders before deleting or soft-delete instead.
    # We will do a hard delete for now.
    await db.delete(product)
    await db.commit()
