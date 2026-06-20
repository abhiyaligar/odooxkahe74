from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import BoM, BoMLine, BoMOperation, Product, ProductType, ManufacturingOrder, ManufacturingOrderStatus, User, UserRole
from app.schemas.recipe import RecipeCreate, RecipeUpdate, RecipeResponse
from app.api.dependencies import get_current_user, RoleChecker

router = APIRouter(dependencies=[Depends(get_current_user)])

# Write actions require SuperAdmin or StoreAdmin roles
admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])

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

@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_checker)])
async def create_recipe(recipe_in: RecipeCreate, db: AsyncSession = Depends(get_db)):
    # 1. Verify parent product exists
    prod_res = await db.execute(select(Product).where(Product.id == recipe_in.product_id))
    product = prod_res.scalars().first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent Product {recipe_in.product_id} not found"
        )
        
    # 2. Assert parent product is FinishedGood
    if product.type != ProductType.FinishedGood:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipe parent product must be of type FinishedGood"
        )
        
    # 3. Verify lines
    for line in recipe_in.lines:
        if line.component_product_id == recipe_in.product_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A Recipe cannot contain the parent product as a component"
            )
            
        comp_res = await db.execute(select(Product).where(Product.id == line.component_product_id))
        component = comp_res.scalars().first()
        if not component:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Component Product {line.component_product_id} not found"
            )
            
        # Check circular dependency
        if await check_circular_dependency(db, recipe_in.product_id, line.component_product_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Circular dependency detected: Product {line.component_product_id} recursively depends on {recipe_in.product_id}"
            )
            
    # 4. Create BoM (Recipe)
    db_bom = BoM(
        product_id=recipe_in.product_id,
        name=recipe_in.name,
        version=recipe_in.version
    )
    db.add(db_bom)
    await db.flush() # Get db_bom.id
    
    # 5. Create BoMLines
    for line in recipe_in.lines:
        db_line = BoMLine(
            bom_id=db_bom.id,
            component_product_id=line.component_product_id,
            quantity_required=line.quantity_required
        )
        db.add(db_line)
        
    # 6. Create BoMOperations
    for op in recipe_in.operations:
        db_op = BoMOperation(
            bom_id=db_bom.id,
            operation_name=op.operation_name,
            sequence=op.sequence,
            duration_minutes=op.duration_minutes,
            work_center_id=op.work_center_id
        )
        db.add(db_op)
        
    await db.commit()
    
    # Reload with preloaded lines and operations
    res = await db.execute(
        select(BoM)
        .options(selectinload(BoM.lines), selectinload(BoM.operations))
        .where(BoM.id == db_bom.id)
    )
    return res.scalars().first()

@router.get("/", response_model=List[RecipeResponse])
async def list_recipes(product_id: UUID | None = None, skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    query = select(BoM).options(selectinload(BoM.lines), selectinload(BoM.operations))
    if product_id:
        query = query.where(BoM.product_id == product_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BoM).options(selectinload(BoM.lines), selectinload(BoM.operations)).where(BoM.id == recipe_id)
    )
    bom = result.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return bom

@router.put("/{recipe_id}", response_model=RecipeResponse, dependencies=[Depends(admin_checker)])
async def update_recipe(recipe_id: UUID, recipe_in: RecipeUpdate, db: AsyncSession = Depends(get_db)):
    # 1. Fetch BoM
    result = await db.execute(
        select(BoM)
        .options(selectinload(BoM.lines), selectinload(BoM.operations))
        .where(BoM.id == recipe_id)
    )
    db_bom = result.scalars().first()
    if not db_bom:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    # 2. Update metadata
    if recipe_in.name is not None:
        db_bom.name = recipe_in.name
    if recipe_in.version is not None:
        db_bom.version = recipe_in.version
        
    # 3. Update lines if provided
    if recipe_in.lines is not None:
        # First, perform validation
        for line in recipe_in.lines:
            if line.component_product_id == db_bom.product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A Recipe cannot contain the parent product as a component"
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
        for line in recipe_in.lines:
            db_line = BoMLine(
                bom_id=db_bom.id,
                component_product_id=line.component_product_id,
                quantity_required=line.quantity_required
            )
            db_bom.lines.append(db_line)
            
    # 4. Update operations if provided
    if recipe_in.operations is not None:
        db_bom.operations.clear()
        for op in recipe_in.operations:
            db_op = BoMOperation(
                bom_id=db_bom.id,
                operation_name=op.operation_name,
                sequence=op.sequence,
                duration_minutes=op.duration_minutes,
                work_center_id=op.work_center_id
            )
            db_bom.operations.append(db_op)
            
    await db.commit()
    
    # Reload with preloaded lines and operations
    res = await db.execute(
        select(BoM)
        .options(selectinload(BoM.lines), selectinload(BoM.operations))
        .where(BoM.id == db_bom.id)
    )
    return res.scalars().first()

@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_checker)])
async def delete_recipe(recipe_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BoM).where(BoM.id == recipe_id))
    bom = result.scalars().first()
    if not bom:
        raise HTTPException(status_code=404, detail="Recipe not found")
        
    # Check if referenced by active Manufacturing Orders
    mo_check = await db.execute(
        select(ManufacturingOrder).where(
            ManufacturingOrder.bom_id == recipe_id,
            ManufacturingOrder.status.in_([ManufacturingOrderStatus.Draft, ManufacturingOrderStatus.InProgress])
        )
    )
    active_mo = mo_check.scalars().first()
    if active_mo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Recipe because it is referenced by active Manufacturing Order {active_mo.order_number}"
        )
        
    await db.delete(bom)
    await db.commit()
