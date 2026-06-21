"""Invoice API — generate, list, and download invoices for Sales & Purchase Orders."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID
import uuid as uuid_mod
from datetime import datetime

from app.db.session import get_db
from app.models.pg_models import (
    Invoice, InvoiceType, InvoiceStatus,
    SalesOrder, SalesOrderLine, Product, Customer,
    PurchaseOrder, PurchaseOrderLine, Vendor,
    User, UserRole
)
from app.api.dependencies import get_current_user
from app.services.invoice_pdf import build_invoice_pdf
from app.services.invoice_gcs import upload_invoice_to_gcs

router = APIRouter(dependencies=[Depends(get_current_user)])


# ─── Schemas (inline for simplicity) ─────────────────────────────────────────
from pydantic import BaseModel

class InvoiceOut(BaseModel):
    id: UUID
    invoice_number: str
    type: str
    status: str
    reference_id: str
    reference_number: str
    party_name: str
    party_email: Optional[str]
    total_amount: float
    currency: str
    gcs_url: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _check_admin(current_user: User):
    if current_user.role not in [UserRole.SuperAdmin, UserRole.StoreAdmin,
                                   UserRole.SalesUser, UserRole.PurchaseUser,
                                   UserRole.BusinessOwner]:
        raise HTTPException(status_code=403, detail="Insufficient permissions to manage invoices.")


# ─── List all invoices ────────────────────────────────────────────────────────
@router.get("/", response_model=List[InvoiceOut])
async def list_invoices(
    invoice_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_admin(current_user)
    q = select(Invoice).order_by(Invoice.created_at.desc())
    if invoice_type:
        q = q.where(Invoice.type == invoice_type)
    result = await db.execute(q)
    return result.scalars().all()


# ─── Generate Sales Order Invoice ─────────────────────────────────────────────
@router.post("/sales-orders/{so_id}/generate", response_model=InvoiceOut)
async def generate_sales_invoice(
    so_id: UUID,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_admin(current_user)

    # Fetch Sales Order with lines
    so_res = await db.execute(
        select(SalesOrder)
        .options(selectinload(SalesOrder.lines))
        .where(SalesOrder.id == so_id)
    )
    so = so_res.scalars().first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales Order not found")
    if so.status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot generate invoice for a cancelled order")

    # Fetch customer
    cust_res = await db.execute(select(Customer).where(Customer.id == so.customer_id))
    customer = cust_res.scalars().first()
    party_name  = customer.name  if customer else "Unknown Customer"
    party_email = customer.email if customer else None

    # Fetch product names for lines
    pdf_lines = []
    total = 0.0
    for line in so.lines:
        prod_res = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_res.scalars().first()
        line_total = line.quantity_ordered * line.unit_price
        total += line_total
        pdf_lines.append({
            "name": product.name if product else str(line.product_id),
            "qty": line.quantity_ordered,
            "unit_price": line.unit_price,
            "total": line_total,
        })

    # Check for existing invoice for this SO
    existing_res = await db.execute(
        select(Invoice).where(
            Invoice.reference_id == str(so_id),
            Invoice.type == InvoiceType.SalesInvoice,
        )
    )
    existing = existing_res.scalars().first()
    inv_number = existing.invoice_number if existing else f"SI-{uuid_mod.uuid4().hex[:8].upper()}"

    # Build PDF
    pdf_bytes = build_invoice_pdf(
        invoice_number=inv_number,
        invoice_type="SalesInvoice",
        reference_number=so.order_number,
        party_name=party_name,
        party_email=party_email,
        lines=pdf_lines,
        total_amount=total,
        notes=notes,
        issued_at=so.created_at,
    )

    # Upload to GCS
    gcs_url, blob_name = await upload_invoice_to_gcs(pdf_bytes, inv_number)

    if existing:
        existing.gcs_url  = gcs_url
        existing.gcs_blob = blob_name
        existing.status   = InvoiceStatus.Issued
        if notes:
            existing.notes = notes
        await db.commit()
        await db.refresh(existing)
        return existing

    db_invoice = Invoice(
        invoice_number  = inv_number,
        type            = InvoiceType.SalesInvoice,
        status          = InvoiceStatus.Issued,
        reference_id    = str(so_id),
        reference_number= so.order_number,
        party_name      = party_name,
        party_email     = party_email,
        total_amount    = total,
        gcs_url         = gcs_url,
        gcs_blob        = blob_name,
        notes           = notes,
        created_by      = current_user.id,
    )
    db.add(db_invoice)
    await db.commit()
    await db.refresh(db_invoice)
    return db_invoice


# ─── Generate Purchase Order Invoice ─────────────────────────────────────────
@router.post("/purchase-orders/{po_id}/generate", response_model=InvoiceOut)
async def generate_purchase_invoice(
    po_id: UUID,
    notes: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_admin(current_user)

    po_res = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    po = po_res.scalars().first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    if po.status == "Cancelled":
        raise HTTPException(status_code=400, detail="Cannot generate invoice for a cancelled order")

    # Fetch vendor
    vendor_res = await db.execute(select(Vendor).where(Vendor.id == po.vendor_id))
    vendor = vendor_res.scalars().first()
    party_name  = vendor.name  if vendor else "Unknown Vendor"
    party_email = vendor.email if vendor else None

    # Build lines
    pdf_lines = []
    total = 0.0
    for line in po.lines:
        prod_res = await db.execute(select(Product).where(Product.id == line.product_id))
        product = prod_res.scalars().first()
        line_total = line.quantity_ordered * line.unit_cost
        total += line_total
        pdf_lines.append({
            "name": product.name if product else str(line.product_id),
            "qty": line.quantity_ordered,
            "unit_price": line.unit_cost,
            "total": line_total,
        })

    existing_res = await db.execute(
        select(Invoice).where(
            Invoice.reference_id == str(po_id),
            Invoice.type == InvoiceType.PurchaseInvoice,
        )
    )
    existing = existing_res.scalars().first()
    inv_number = existing.invoice_number if existing else f"PI-{uuid_mod.uuid4().hex[:8].upper()}"

    pdf_bytes = build_invoice_pdf(
        invoice_number=inv_number,
        invoice_type="PurchaseInvoice",
        reference_number=po.order_number,
        party_name=party_name,
        party_email=party_email,
        lines=pdf_lines,
        total_amount=total,
        notes=notes,
        issued_at=po.created_at,
    )

    gcs_url, blob_name = await upload_invoice_to_gcs(pdf_bytes, inv_number)

    if existing:
        existing.gcs_url  = gcs_url
        existing.gcs_blob = blob_name
        existing.status   = InvoiceStatus.Issued
        if notes:
            existing.notes = notes
        await db.commit()
        await db.refresh(existing)
        return existing

    db_invoice = Invoice(
        invoice_number  = inv_number,
        type            = InvoiceType.PurchaseInvoice,
        status          = InvoiceStatus.Issued,
        reference_id    = str(po_id),
        reference_number= po.order_number,
        party_name      = party_name,
        party_email     = party_email,
        total_amount    = total,
        gcs_url         = gcs_url,
        gcs_blob        = blob_name,
        notes           = notes,
        created_by      = current_user.id,
    )
    db.add(db_invoice)
    await db.commit()
    await db.refresh(db_invoice)
    return db_invoice


# ─── Download (stream raw PDF) ────────────────────────────────────────────────
@router.get("/{invoice_id}/download")
async def download_invoice(
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_admin(current_user)
    inv_res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = inv_res.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if not invoice.gcs_url:
        raise HTTPException(status_code=404, detail="Invoice PDF not yet generated")

    # Redirect to GCS URL (simplest — browser handles the download)
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=invoice.gcs_url)


# ─── Get single invoice ───────────────────────────────────────────────────────
@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _check_admin(current_user)
    inv_res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = inv_res.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice
