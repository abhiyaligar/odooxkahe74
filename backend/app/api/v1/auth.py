from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from typing import List, Optional

from app.db.session import get_db
from app.models.pg_models import User, UserRole, Customer, CustomerCategory
from app.schemas.user import UserCreate, UserResponse, Token, UserPagedResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.dependencies import get_current_user
from app.services.gcs import upload_avatar_to_gcs

router = APIRouter()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: UserRole = Form(UserRole.SalesUser),
    phone: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    avatar_url = None
    if avatar:
        try:
            avatar_url = await upload_avatar_to_gcs(avatar)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed GCS avatar upload: {e}")
            if isinstance(e, ValueError):
                pass
            else:
                raise HTTPException(status_code=500, detail=f"Failed to upload profile image: {str(e)}")

    hashed_password = get_password_hash(password)
    db_user = User(
        name=name,
        email=email,
        password_hash=hashed_password,
        role=role,
        avatar_url=avatar_url
    )
    db.add(db_user)
    await db.flush()
    
    if role == UserRole.Customer:
        db_customer = Customer(
            id=db_user.id,
            name=name,
            email=email,
            phone=phone,
            address=address,
            category=CustomerCategory.Retail
        )
        db.add(db_customer)
        
    await db.commit()
    await db.refresh(db_user)
    
    if db_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == db_user.id))
        db_user.customer_profile = cust_res.scalars().first()
        
    return db_user

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == current_user.id))
        current_user.customer_profile = cust_res.scalars().first()
    return current_user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users", response_model=UserPagedResponse)
async def list_users(
    skip: Optional[int] = None,
    limit: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrator roles can query user profiles list."
        )
    base_query = select(User)
    total_res = await db.execute(select(func.count()).select_from(base_query.subquery()))
    total_count = total_res.scalar() or 0

    query = base_query.order_by(User.name)
    if skip is not None:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()
    return {
        "total_count": total_count,
        "users": users
    }

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user_by_admin(
    user_in: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrator roles are permitted to create users."
        )

    if current_user.role == UserRole.StoreAdmin and user_in.role == UserRole.SuperAdmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="StoreAdmins are not permitted to create SuperAdmin profiles."
        )

    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_password,
        role=user_in.role
    )
    db.add(db_user)
    await db.flush()
    
    if user_in.role == UserRole.Customer:
        db_customer = Customer(
            id=db_user.id,
            name=user_in.name,
            email=user_in.email,
            phone=user_in.phone,
            address=user_in.address,
            category=CustomerCategory.Retail
        )
        db.add(db_customer)
        
    from app.services.audit import log_action
    await log_action(
        db=db,
        user=current_user,
        module="Auth",
        record_type="User",
        record_id=db_user.id,
        action="Create",
        field_changed="role",
        old_val=None,
        new_val=db_user.role.value if hasattr(db_user.role, 'value') else str(db_user.role)
    )
    
    await db.commit()
    await db.refresh(db_user)
    
    if db_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == db_user.id))
        db_user.customer_profile = cust_res.scalars().first()
        
    return db_user
