from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID

from app.db.session import get_db
from app.models.pg_models import Customer, UserRole
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.api.dependencies import get_current_user, RoleChecker

router = APIRouter(dependencies=[Depends(get_current_user)])

admin_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin])
read_checker = RoleChecker([UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.SalesUser])

@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(admin_checker)])
async def create_customer(customer_in: CustomerCreate, db: AsyncSession = Depends(get_db)):
    db_customer = Customer(**customer_in.model_dump())
    db.add(db_customer)
    await db.commit()
    await db.refresh(db_customer)
    return db_customer

@router.get("/", response_model=List[CustomerResponse], dependencies=[Depends(read_checker)])
async def list_customers(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/retail", response_model=List[CustomerResponse], tags=["Customers - Retail"], dependencies=[Depends(read_checker)])
async def list_retail_customers(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer)
        .where(Customer.category == "Retail")
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/wholesale", response_model=List[CustomerResponse], tags=["Customers - Wholesale / Corporate"], dependencies=[Depends(read_checker)])
async def list_wholesale_customers(skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Customer)
        .where(Customer.category.in_(["Wholesale", "Corporate", "Distributor"]))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()

@router.get("/{customer_id}", response_model=CustomerResponse, dependencies=[Depends(read_checker)])
async def get_customer(customer_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer

@router.put("/{customer_id}", response_model=CustomerResponse, dependencies=[Depends(admin_checker)])
async def update_customer(customer_id: UUID, customer_in: CustomerUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    db_customer = result.scalars().first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    update_data = customer_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_customer, field, value)

    await db.commit()
    await db.refresh(db_customer)
    return db_customer

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_checker)])
async def delete_customer(customer_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await db.delete(customer)
    await db.commit()
