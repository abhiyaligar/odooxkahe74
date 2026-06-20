from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from app.db.session import get_db
from app.models.pg_models import User, UserRole, Customer, CustomerCategory
from app.schemas.user import UserCreate, UserResponse, Token
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.dependencies import get_current_user

router = APIRouter()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
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
