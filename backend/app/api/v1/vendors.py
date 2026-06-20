from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import Vendor, UserRole
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorResponse
from app.api.dependencies import get_current_user, RoleChecker

router = APIRouter(dependencies=[Depends(get_current_user)])

admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])
edit_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.PurchaseUser])
read_checker = RoleChecker([
    UserRole.SuperAdmin,
    UserRole.StoreAdmin,
    UserRole.PurchaseUser,
    UserRole.InventoryManager,
    UserRole.BusinessOwner
])

@router.post("/", response_model=VendorResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_checker)])
async def create_vendor(vendor_in: VendorCreate, db: AsyncSession = Depends(get_db)):
    db_vendor = Vendor(**vendor_in.model_dump())
    db.add(db_vendor)
    await db.commit()
    await db.refresh(db_vendor)
    return db_vendor

@router.get("/", response_model=List[VendorResponse], dependencies=[Depends(read_checker)])
async def list_vendors(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/raw-materials", response_model=List[VendorResponse], tags=["Vendors - Raw Materials / Finished Goods"], dependencies=[Depends(read_checker)])
async def list_raw_material_vendors(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Vendor)
        .where(Vendor.category.in_(["RawMaterials", "FinishedGoods"]))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/services", response_model=List[VendorResponse], tags=["Vendors - Services / Logistics"], dependencies=[Depends(read_checker)])
async def list_service_vendors(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Vendor)
        .where(Vendor.category.in_(["Logistics", "Services"]))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{vendor_id}", response_model=VendorResponse, dependencies=[Depends(read_checker)])
async def get_vendor(vendor_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.put("/{vendor_id}", response_model=VendorResponse, dependencies=[Depends(edit_checker)])
async def update_vendor(vendor_id: UUID, vendor_in: VendorUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    db_vendor = result.scalars().first()
    if not db_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    update_data = vendor_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_vendor, field, value)

    await db.commit()
    await db.refresh(db_vendor)
    return db_vendor

@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_checker)])
async def delete_vendor(vendor_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalars().first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    await db.delete(vendor)
    await db.commit()
