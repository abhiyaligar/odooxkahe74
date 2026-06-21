from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from typing import List, Optional
import random

from uuid import UUID
from app.db.session import get_db
from app.models.pg_models import User, UserRole, Customer, CustomerCategory, VerificationCode, VerificationType
from app.schemas.user import (
    UserCreate, UserResponse, Token, UserPagedResponse, UserUpdate,
    ForgotPasswordRequest, ResetPasswordRequest, SendVerificationCodeRequest, VerifyEmailCodeRequest
)
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.dependencies import get_current_user
from app.services.gcs import upload_avatar_to_gcs
from app.services.email import send_verification_email, send_password_reset_email

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
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.UserAdmin]:
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
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.UserAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrator roles are permitted to create users."
        )

    if current_user.role == UserRole.StoreAdmin and user_in.role == UserRole.SuperAdmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="StoreAdmins are not permitted to create SuperAdmin profiles."
        )
    if current_user.role == UserRole.UserAdmin and user_in.role in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="UserAdmins are not permitted to create SuperAdmin or StoreAdmin profiles."
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

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user_by_admin(
    user_id: UUID,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.UserAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrator roles are permitted to modify users."
        )

    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Access control: SuperAdmin can edit anyone.
    # StoreAdmin can edit anyone except SuperAdmin.
    # UserAdmin can edit anyone except SuperAdmin and StoreAdmin.
    if db_user.role == UserRole.SuperAdmin and current_user.role != UserRole.SuperAdmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins are permitted to modify SuperAdmin profiles."
        )
    if db_user.role == UserRole.StoreAdmin and current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins or StoreAdmins are permitted to modify StoreAdmin profiles."
        )

    # Validate role update promotions
    if user_update.role is not None and user_update.role != db_user.role:
        if user_update.role == UserRole.SuperAdmin and current_user.role != UserRole.SuperAdmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SuperAdmins can promote users to SuperAdmin."
            )
        if user_update.role == UserRole.StoreAdmin and current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only SuperAdmins or StoreAdmins can promote users to StoreAdmin."
            )

    # Perform user record updates
    if user_update.name is not None:
        db_user.name = user_update.name
    if user_update.email is not None:
        if user_update.email != db_user.email:
            dup_res = await db.execute(select(User).where(User.email == user_update.email))
            if dup_res.scalars().first():
                raise HTTPException(status_code=400, detail="Email already registered")
            db_user.email = user_update.email
    if user_update.role is not None:
        db_user.role = user_update.role
    if user_update.is_active is not None:
        db_user.is_active = user_update.is_active

    # Handle customer profiles mapping
    if db_user.role == UserRole.Customer or user_update.phone is not None or user_update.address is not None:
        cust_res = await db.execute(select(Customer).where(Customer.id == db_user.id))
        db_customer = cust_res.scalars().first()
        if db_user.role == UserRole.Customer:
            if not db_customer:
                db_customer = Customer(
                    id=db_user.id,
                    name=db_user.name,
                    email=db_user.email,
                    category=CustomerCategory.Retail
                )
                db.add(db_customer)
            if user_update.phone is not None:
                db_customer.phone = user_update.phone
            if user_update.address is not None:
                db_customer.address = user_update.address
            if user_update.name is not None:
                db_customer.name = user_update.name
            if user_update.email is not None:
                db_customer.email = user_update.email
        elif db_customer:
            await db.delete(db_customer)

    from app.services.audit import log_action
    await log_action(
        db=db,
        user=current_user,
        module="Auth",
        record_type="User",
        record_id=db_user.id,
        action="Update",
        field_changed="multiple",
        old_val=None,
        new_val="Modified by admin"
    )

    await db.commit()
    await db.refresh(db_user)

    if db_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == db_user.id))
        db_user.customer_profile = cust_res.scalars().first()

    return db_user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_admin(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin, UserRole.UserAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrator roles are permitted to delete users."
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=400,
            detail="Administrators cannot delete their own profile."
        )

    result = await db.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if db_user.role == UserRole.SuperAdmin and current_user.role != UserRole.SuperAdmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins are permitted to delete SuperAdmin profiles."
        )
    if db_user.role == UserRole.StoreAdmin and current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SuperAdmins or StoreAdmins are permitted to delete StoreAdmin profiles."
        )

    from app.services.audit import log_action
    await log_action(
        db=db,
        user=current_user,
        module="Auth",
        record_type="User",
        record_id=db_user.id,
        action="Delete",
        field_changed="all",
        old_val=db_user.email,
        new_val=None
    )

    if db_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == db_user.id))
        db_customer = cust_res.scalars().first()
        if db_customer:
            await db.delete(db_customer)

    await db.delete(db_user)
    await db.commit()
    return None

@router.put("/me", response_model=UserResponse)
async def update_me(
    name: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if name is not None:
        current_user.name = name
        if current_user.role == UserRole.Customer:
            cust_res = await db.execute(select(Customer).where(Customer.id == current_user.id))
            db_customer = cust_res.scalars().first()
            if db_customer:
                db_customer.name = name

    if avatar is not None:
        try:
            avatar_url = await upload_avatar_to_gcs(avatar)
            current_user.avatar_url = avatar_url
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to upload avatar to GCS: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload profile image: {str(e)}"
            )

    await db.commit()
    await db.refresh(current_user)

    if current_user.role == UserRole.Customer:
        cust_res = await db.execute(select(Customer).where(Customer.id == current_user.id))
        current_user.customer_profile = cust_res.scalars().first()

    return current_user


# ── Email Verification and Password Reset Endpoints ─────────────────────────

@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        return {"message": "If the email is registered, a password reset code has been sent."}

    # Generate 6-digit OTP
    code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    db_code = VerificationCode(
        email=user.email,
        code=code,
        type=VerificationType.PasswordReset,
        expires_at=expires_at
    )
    db.add(db_code)
    await db.commit()

    await send_password_reset_email(email=user.email, name=user.name, code=code)

    return {"message": "If the email is registered, a password reset code has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    # Find matching valid code
    result = await db.execute(
        select(VerificationCode)
        .where(
            VerificationCode.email == req.email,
            VerificationCode.code == req.code,
            VerificationCode.type == VerificationType.PasswordReset,
            VerificationCode.is_used == False,
            VerificationCode.expires_at > datetime.utcnow()
        )
    )
    db_code = result.scalars().first()
    if not db_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code."
        )

    # Reset password
    user_res = await db.execute(select(User).where(User.email == req.email))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = get_password_hash(req.new_password)
    db_code.is_used = True
    await db.commit()

    return {"message": "Password has been reset successfully."}


@router.post("/send-verification-code", status_code=status.HTTP_200_OK)
async def send_email_verification_code(req: SendVerificationCodeRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    db_code = VerificationCode(
        email=user.email,
        code=code,
        type=VerificationType.EmailVerification,
        expires_at=expires_at
    )
    db.add(db_code)
    await db.commit()

    await send_verification_email(email=user.email, name=user.name, code=code)
    return {"message": "Verification code has been sent to your email."}


@router.post("/verify-email-code", status_code=status.HTTP_200_OK)
async def verify_email_code(req: VerifyEmailCodeRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(VerificationCode)
        .where(
            VerificationCode.email == req.email,
            VerificationCode.code == req.code,
            VerificationCode.type == VerificationType.EmailVerification,
            VerificationCode.is_used == False,
            VerificationCode.expires_at > datetime.utcnow()
        )
    )
    db_code = result.scalars().first()
    if not db_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code."
        )

    # Set user email as verified
    user_res = await db.execute(select(User).where(User.email == req.email))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_email_verified = True
    db_code.is_used = True
    await db.commit()

    return {"message": "Email address verified successfully."}

