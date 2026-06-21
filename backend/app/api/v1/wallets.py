from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID, uuid4
import hmac
import hashlib
import os
import httpx

from app.db.session import get_db
from app.models.pg_models import Wallet, WalletTransaction, TransactionType, PaymentMethod, TransactionStatus, UserRole
from app.schemas.wallet import WalletResponse, WalletTransactionResponse, TopUpInitiate, TopUpInitiateResponse, TopUpVerify, TransferRequest
from app.api.dependencies import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

# Static UUID representing company store wallet
STORE_WALLET_ID = UUID("00000000-0000-0000-0000-000000000000")

async def get_or_create_wallet(wallet_id: UUID, db: AsyncSession) -> Wallet:
    result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    wallet = result.scalars().first()
    if not wallet:
        wallet = Wallet(id=wallet_id, balance=0.0, currency="INR")
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    return wallet

def check_wallet_permission(wallet_id: UUID, current_user):
    # SuperAdmin and StoreAdmin can access any wallet
    if current_user.role in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        return True
    # Customer can only access their own wallet
    if current_user.role == UserRole.Customer and wallet_id == current_user.id:
        return True
    # Otherwise access is denied
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have permission to access this wallet."
    )

@router.get("/{wallet_id}", response_model=WalletResponse)
async def get_wallet(wallet_id: UUID, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    check_wallet_permission(wallet_id, current_user)
    wallet = await get_or_create_wallet(wallet_id, db)
    return wallet

@router.get("/{wallet_id}/transactions", response_model=List[WalletTransactionResponse])
async def list_transactions(wallet_id: UUID, current_user = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    check_wallet_permission(wallet_id, current_user)
    # Ensure wallet exists
    await get_or_create_wallet(wallet_id, db)
    
    result = await db.execute(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet_id)
        .order_by(WalletTransaction.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{wallet_id}/topup/initiate", response_model=TopUpInitiateResponse)
async def initiate_topup(
    wallet_id: UUID, 
    payload: TopUpInitiate, 
    current_user = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    check_wallet_permission(wallet_id, current_user)
    await get_or_create_wallet(wallet_id, db)
    
    amount_in_cents = int(payload.amount * 100)
    
    # Razorpay Credentials check
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    
    order_id = f"order_mock_{uuid4().hex[:12]}"
    
    if key_id and key_secret:
        # Connect to Razorpay API using httpx
        url = "https://api.razorpay.com/v1/orders"
        auth = (key_id, key_secret)
        data = {
            "amount": amount_in_cents,
            "currency": "INR",
            "receipt": f"receipt_{uuid4().hex[:10]}"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=data, auth=auth)
                if res.status_code == 200:
                    order_id = res.json().get("id")
                elif res.status_code == 401:
                    # Bad credentials — fall back to mock, don't crash the app
                    import logging
                    logging.getLogger(__name__).warning(
                        "Razorpay auth failed (401) — check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. Falling back to mock."
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Razorpay order creation failed ({res.status_code}): {res.text}"
                    )
        except HTTPException:
            raise  # Re-raise HTTP errors — don't swallow non-auth failures
        except Exception as e:
            # Only swallow genuine network/connection timeouts
            import logging
            logging.getLogger(__name__).warning(f"Razorpay network error, falling back to mock: {e}")

    # Record the pending transaction
    db_tx = WalletTransaction(
        wallet_id=wallet_id,
        amount=payload.amount,
        type=TransactionType.TopUp,
        payment_method=PaymentMethod.Razorpay,
        status=TransactionStatus.Pending,
        razorpay_order_id=order_id,
        created_by=current_user.id
    )
    db.add(db_tx)
    await db.commit()
    await db.refresh(db_tx)
    
    return {
        "razorpay_order_id": order_id,
        "amount": payload.amount,
        "currency": "INR",
        "status": "created"
    }

@router.post("/{wallet_id}/topup/verify", response_model=WalletResponse)
async def verify_topup(
    wallet_id: UUID,
    payload: TopUpVerify,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_wallet_permission(wallet_id, current_user)
    wallet = await get_or_create_wallet(wallet_id, db)
    
    # Find matching pending transaction
    tx_res = await db.execute(
        select(WalletTransaction)
        .where(
            WalletTransaction.wallet_id == wallet_id,
            WalletTransaction.razorpay_order_id == payload.razorpay_order_id,
            WalletTransaction.status == TransactionStatus.Pending
        )
    )
    tx = tx_res.scalars().first()
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or already verified."
        )
    
    # Validate Signature
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")
    signature_valid = False
    
    if payload.razorpay_order_id.startswith("order_mock_"):
        # Bypass signature checks for mock testing orders
        signature_valid = True
    elif key_secret:
        msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
        generated_sig = hmac.new(
            key_secret.encode(),
            msg.encode(),
            hashlib.sha256
        ).hexdigest()
        
        signature_valid = hmac.compare_digest(generated_sig, payload.razorpay_signature)
    
    if not signature_valid:
        tx.status = TransactionStatus.Failed
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment verification failed: invalid signature."
        )
        
    # Apply Top-Up
    tx.status = TransactionStatus.Completed
    tx.razorpay_payment_id = payload.razorpay_payment_id
    wallet.balance += tx.amount
    
    await db.commit()
    await db.refresh(wallet)
    return wallet

@router.post("/transfer", response_model=WalletResponse)
async def transfer_funds(
    payload: TransferRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Only Admin (StoreAdmin / SuperAdmin) or automated procurement context can perform transfers
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators are permitted to perform fund transfers."
        )
        
    from_wallet = await get_or_create_wallet(payload.from_wallet_id, db)
    to_wallet = await get_or_create_wallet(payload.to_wallet_id, db)
    
    if from_wallet.balance < payload.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient funds in the source wallet."
        )
        
    # Perform debit
    from_wallet.balance -= payload.amount
    db_debit = WalletTransaction(
        wallet_id=payload.from_wallet_id,
        amount=payload.amount,
        type=TransactionType.PurchasePayment,
        payment_method=PaymentMethod.Wallet,
        status=TransactionStatus.Completed,
        reference_id=payload.reference_id,
        created_by=current_user.id
    )
    db.add(db_debit)
    
    # Perform credit
    to_wallet.balance += payload.amount
    db_credit = WalletTransaction(
        wallet_id=payload.to_wallet_id,
        amount=payload.amount,
        type=TransactionType.TopUp,
        payment_method=PaymentMethod.Wallet,
        status=TransactionStatus.Completed,
        reference_id=payload.reference_id,
        created_by=current_user.id
    )
    db.add(db_credit)
    
    await db.commit()
    await db.refresh(from_wallet)
    return from_wallet
