"""
PDF Invoice Generator using ReportLab.
Generates a professional PDF invoice and returns raw bytes.
"""
import io
from datetime import datetime
from typing import List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph,
    Spacer, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT


# ─── Colour palette ────────────────────────────────────────────────────────────
BRAND_DARK   = colors.HexColor("#1e1e2e")
BRAND_ACCENT = colors.HexColor("#6366f1")
BRAND_LIGHT  = colors.HexColor("#f4f4f5")
GREY_MID     = colors.HexColor("#71717a")
GREY_LIGHT   = colors.HexColor("#e4e4e7")
WHITE        = colors.white
SUCCESS      = colors.HexColor("#22c55e")
DANGER       = colors.HexColor("#ef4444")


def build_invoice_pdf(
    invoice_number: str,
    invoice_type: str,            # "SalesInvoice" | "PurchaseInvoice"
    reference_number: str,        # SO-XXXX or PO-XXXX
    party_name: str,
    party_email: str | None,
    lines: List[Dict[str, Any]],  # [{name, qty, unit_price, total}]
    total_amount: float,
    currency: str = "INR",
    notes: str | None = None,
    issued_at: datetime | None = None,
) -> bytes:
    """Return PDF bytes for the invoice."""

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header band ────────────────────────────────────────────────────────────
    header_data = [[
        Paragraph(
            f"<font color='#{BRAND_ACCENT.hexval()[2:]}' size='18'><b>AUTOCRAFERP</b></font>"
            f"<br/><font size='8' color='#71717a'>Tax Invoice / Receipt</font>",
            ParagraphStyle("hdr", fontName="Helvetica", fontSize=8)
        ),
        Paragraph(
            f"<b>{invoice_type.replace('Invoice', ' Invoice')}</b><br/>"
            f"<font size='20' color='#{BRAND_ACCENT.hexval()[2:]}'>{invoice_number}</font>",
            ParagraphStyle("inv", fontName="Helvetica-Bold", fontSize=9, alignment=TA_RIGHT)
        ),
    ]]
    hdr_table = Table(header_data, colWidths=["60%", "40%"])
    hdr_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("TEXTCOLOR",  (0, 0), (-1, -1), WHITE),
        ("PADDING",    (0, 0), (-1, -1), 14),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hdr_table)
    story.append(Spacer(1, 6 * mm))

    # ── Meta row (Reference / Party / Date) ────────────────────────────────────
    issued = (issued_at or datetime.utcnow()).strftime("%d %b %Y")
    meta_data = [
        ["Reference Order", reference_number],
        ["Bill To / Party",  party_name],
        ["Email",            party_email or "—"],
        ["Issue Date",       issued],
        ["Currency",         currency],
    ]
    meta_table = Table(meta_data, colWidths=["35%", "65%"])
    meta_table.setStyle(TableStyle([
        ("FONTNAME",   (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("TEXTCOLOR",  (0, 0), (0, -1), GREY_MID),
        ("TEXTCOLOR",  (1, 0), (1, -1), BRAND_DARK),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, BRAND_LIGHT]),
        ("PADDING",    (0, 0), (-1, -1), 6),
        ("GRID",       (0, 0), (-1, -1), 0.3, GREY_LIGHT),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8 * mm))

    # ── Line items table ────────────────────────────────────────────────────────
    sym = "Rs." if currency == "INR" else currency
    line_header = [["#", "Item / Product", "Qty", f"Unit Price ({sym})", f"Total ({sym})"]]
    line_rows = []
    for i, line in enumerate(lines, 1):
        line_rows.append([
            str(i),
            line.get("name", "—"),
            str(line.get("qty", 0)),
            f"{float(line.get('unit_price', 0)):,.2f}",
            f"{float(line.get('total', 0)):,.2f}",
        ])

    items_table = Table(
        line_header + line_rows,
        colWidths=["6%", "44%", "10%", "20%", "20%"]
    )
    items_table.setStyle(TableStyle([
        # Header row
        ("BACKGROUND",  (0, 0), (-1, 0), BRAND_ACCENT),
        ("TEXTCOLOR",   (0, 0), (-1, 0), WHITE),
        ("FONTNAME",    (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 8),
        ("PADDING",     (0, 0), (-1, -1), 7),
        ("ALIGN",       (0, 0), (-1, -1), "CENTER"),
        ("ALIGN",       (1, 1), (1, -1), "LEFT"),
        ("ALIGN",       (3, 1), (4, -1), "RIGHT"),
        # Alternating rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, BRAND_LIGHT]),
        ("GRID",        (0, 0), (-1, -1), 0.3, GREY_LIGHT),
        ("LINEBELOW",   (0, 0), (-1, 0), 1, BRAND_ACCENT),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 6 * mm))

    # ── Total band ─────────────────────────────────────────────────────────────
    total_data = [[
        "",
        Paragraph(
            f"<b>TOTAL AMOUNT</b>",
            ParagraphStyle("tot_lbl", fontName="Helvetica-Bold", fontSize=10, textColor=WHITE)
        ),
        Paragraph(
            f"<b>{sym} {total_amount:,.2f}</b>",
            ParagraphStyle("tot_val", fontName="Helvetica-Bold", fontSize=13,
                           textColor=WHITE, alignment=TA_RIGHT)
        ),
    ]]
    total_table = Table(total_data, colWidths=["50%", "25%", "25%"])
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BRAND_DARK),
        ("PADDING",    (0, 0), (-1, -1), 10),
        ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(total_table)

    # ── Notes ──────────────────────────────────────────────────────────────────
    if notes:
        story.append(Spacer(1, 6 * mm))
        story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_LIGHT))
        story.append(Spacer(1, 3 * mm))
        story.append(Paragraph(
            f"<font size='8' color='#71717a'><b>Notes:</b> {notes}</font>",
            styles["Normal"]
        ))

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 10 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GREY_LIGHT))
    story.append(Spacer(1, 3 * mm))
    story.append(Paragraph(
        "<font size='7' color='#71717a'>This is a computer-generated invoice and does not require a physical signature. "
        "AutoCrafERP — All rights reserved.</font>",
        ParagraphStyle("footer", alignment=TA_CENTER, fontName="Helvetica", fontSize=7)
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
