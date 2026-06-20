from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import BoM, BoMLine, Product, ProductType, ManufacturingOrder, ManufacturingOrderStatus, User, UserRole
from app.schemas.bom import BoMCreate, BoMUpdate, BoMResponse
from app.api.dependencies import get_current_user, RoleChecker

router = APIRouter(dependencies=[Depends(get_current_user)])

admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])
read_checker = RoleChecker([
    UserRole.SuperAdmin,
    UserRole.StoreAdmin,
    UserRole.ManufacturingUser,
    UserRole.BusinessOwner
])

async def check_circular_dependency(
    db: AsyncSession, 
    parent_product_id: UUID, 
    current_component_id: UUID, 
    visited: set = None
) -> bool:
    if visited is None:
        visited = set()

    if current_component_id == parent_product_id:
        return True

    if current_component_id in visited:
        return False
        
    visited.add(current_component_id)

    result = await db.execute(
        select(BoM).where(BoM.product_id == current_component_id)
    )
    boms = result.scalars().all()

    for bom in boms:
        lines_res = await db.execute(
            select(BoMLine).where(BoMLine.bom_id == bom.id)
        )
        sub_lines = lines_res.scalars().all()
        
        for line in sub_lines:
            if await check_circular_dependency(db, parent_product_id, line.component_product_id, visited.copy()):
                return True

    return False

@router.post("/", response_model=BoMResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_checker)])
async def create_bom(bom_in: BoMCreate, db: AsyncSession = Depends(get_db)):
    # 1. Verify parent product exists
    prod_res = await db.execute(select(Product).where(Product.id == bom_in.product_id))
    product = prod_res.scalars().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent Product {bom_in.product_id} not found"
        )
        
    # 2. Assert parent product is FinishedGood
    if product.type != ProductType.FinishedGood:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="BoM parent product must be of type FinishedGood"
        )
        
    # 3. Verify lines
    for line in bom_in.lines:
        if line.component_product_id == bom_in.product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A BoM cannot contain the parent product as a component"
            )
            
        comp_res = await db.execute(select(Product).where(Product.id == line.component_product_id))
        component = comp_res.scalars().first()
        if not component:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Component Product {line.component_product_id} not found"
            )
            
        # Check circular dependency
        if await check_circular_dependency(db, bom_in.product_id, line.component_product_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Circular dependency detected: Product {line.component_product_id} recursively depends on {bom_in.product_id}"
            )
            
    # 4. Create BoM
    db_bom = BoM(
        product_id=bom_in.product_id,
        name=bom_in.name,
        version=bom_in.version
    )
    db.add(db_bom)
    await db.flush() # Get db_bom.id
    
    # 5. Create BoMLines
    for line in bom_in.lines:
        db_line = BoMLine(
            bom_id=db_bom.id,
            component_product_id=line.component_product_id,
            quantity_required=line.quantity_required
        )
        db.add(db_line)
        
    await db.commit()
    
    # Reload with preloaded lines
    res = await db.execute(
        select(BoM)
        .options(selectinload(BoM.lines))
        .where(BoM.id == db_bom.id)
    )
    return res.scalars().first()

@router.get("/", response_model=List[BoMResponse], dependencies=[Depends(read_checker)])
async def list_boms(product_id: UUID | None = None, skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(BoM).options(selectinload(BoM.lines))
    if product_id:
        query = query.where(BoM.product_id == product_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{bom_id}", response_model=BoMResponse, dependencies=[Depends(read_checker)])
async def get_bom(bom_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BoM).options(selectinload(BoM.lines)).where(BoM.id == bom_id)
    )
    bom = result.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="BoM not found")
    return bom

@router.put("/{bom_id}", response_model=BoMResponse, dependencies=[Depends(admin_checker)])
async def update_bom(bom_id: UUID, bom_in: BoMUpdate, db: AsyncSession = Depends(get_db)):
    # 1. Fetch BoM
    result = await db.execute(
        select(BoM).options(selectinload(BoM.lines)).where(BoM.id == bom_id)
    )
    db_bom = result.scalars().first()
    if not db_bom:
        raise HTTPException(status_code=404, detail="BoM not found")
        
    # 2. Update metadata
    if bom_in.name is not None:
        db_bom.name = bom_in.name
    if bom_in.version is not None:
        db_bom.version = bom_in.version
        
    # 3. Update lines if provided
    if bom_in.lines is not None:
        # First, perform validation
        for line in bom_in.lines:
            if line.component_product_id == db_bom.product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A BoM cannot contain the parent product as a component"
                )
                
            comp_res = await db.execute(select(Product).where(Product.id == line.component_product_id))
            component = comp_res.scalars().first()
            if not component:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Component Product {line.component_product_id} not found"
                )
                
            # Check circular dependency
            if await check_circular_dependency(db, db_bom.product_id, line.component_product_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Circular dependency detected: Product {line.component_product_id} recursively depends on {db_bom.product_id}"
                )
                
        # Clear existing lines (cascade orphan delete will handle the DB delete)
        db_bom.lines.clear()
        
        # Add new lines
        for line in bom_in.lines:
            db_line = BoMLine(
                bom_id=db_bom.id,
                component_product_id=line.component_product_id,
                quantity_required=line.quantity_required
            )
            db_bom.lines.append(db_line)
            
    await db.commit()
    
    # Reload with preloaded lines
    res = await db.execute(
        select(BoM)
        .options(selectinload(BoM.lines))
        .where(BoM.id == db_bom.id)
    )
    return res.scalars().first()

@router.delete("/{bom_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_checker)])
async def delete_bom(bom_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BoM).where(BoM.id == bom_id))
    bom = result.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="BoM not found")
        
    # Check if referenced by active Manufacturing Orders
    mo_check = await db.execute(
        select(ManufacturingOrder).where(
            ManufacturingOrder.bom_id == bom_id,
            ManufacturingOrder.status.in_([ManufacturingOrderStatus.Draft, ManufacturingOrderStatus.InProgress])
        )
    )
    active_mo = mo_check.scalars().first()
    if active_mo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete BoM because it is referenced by active Manufacturing Order {active_mo.order_number}"
        )
        
    await db.delete(bom)
    await db.commit()
