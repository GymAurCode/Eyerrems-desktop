"""
Booking Form / Client Profile PDF Generator — Enterprise-grade real estate booking form.

Sections:
  1. Header (company, title, booking info)
  2. Applicant Information
  3. Joint Applicant (if exists)
  4. Nominee Information
  5. Property Information
  6. Payment Plan Summary
  7. Terms & Conditions
  8. Signatures
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List


def _fmt(value, sym: str = "₨") -> str:
    """Format numeric value as currency string with symbol."""
    try:
        v = float(str(value).replace(",", "").replace("$", "").replace("₨", "").strip()) if value else 0.0
        return f"{sym} {v:,.2f}"
    except (TypeError, ValueError):
        return f"{sym} 0.00"


def generate_booking_form_pdf(data: Dict[str, Any]) -> bytes:
    """Generate a professional Booking Form PDF from structured data dict."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
    )

    # ── Palette ───────────────────────────────────────────────────────────────
    DARK_BLUE  = colors.HexColor("#1e3a5f")
    MID_BLUE   = colors.HexColor("#2e5090")
    ACCENT     = colors.HexColor("#3b82f6")
    LIGHT_BLUE = colors.HexColor("#dbeafe")
    PALE_BLUE  = colors.HexColor("#f0f7ff")
    ALT_ROW    = colors.HexColor("#f5f7fa")
    BORDER     = colors.HexColor("#d0d7e3")
    GREEN      = colors.HexColor("#059669")
    RED        = colors.HexColor("#dc2626")
    GOLD       = colors.HexColor("#d97706")
    GRAY       = colors.HexColor("#6b7280")
    DARK       = colors.HexColor("#111827")
    WHITE      = colors.white

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=15 * mm,
    )
    PAGE_W = A4[0] - 30 * mm

    styles = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    S = {
        "company":  ps("co",  fontSize=16, textColor=WHITE,      fontName="Helvetica-Bold", alignment=TA_CENTER, leading=20),
        "title":    ps("ti",  fontSize=11, textColor=LIGHT_BLUE, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14),
        "subtitle": ps("su",  fontSize=8,  textColor=LIGHT_BLUE, alignment=TA_CENTER, leading=10),
        "section":  ps("se",  fontSize=9,  textColor=DARK_BLUE,  fontName="Helvetica-Bold", leading=12),
        "label":    ps("la",  fontSize=7,  textColor=GRAY,       leading=9),
        "value":    ps("va",  fontSize=8.5, textColor=DARK,      fontName="Helvetica-Bold", leading=11),
        "body":     ps("bo",  fontSize=8,  textColor=DARK,       leading=11, alignment=TA_JUSTIFY),
        "small":    ps("sm",  fontSize=7,  textColor=GRAY,       leading=9),
        "footer":   ps("fo",  fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "sig":      ps("sig", fontSize=8,  textColor=DARK,       alignment=TA_CENTER, leading=10),
        "sig_l":    ps("sil", fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "card_lbl": ps("cla", fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "card_val": ps("cva", fontSize=11, textColor=DARK_BLUE,  fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14),
        "terms_h":  ps("th2", fontSize=8,  textColor=DARK_BLUE,  fontName="Helvetica-Bold", leading=11),
        "terms_b":  ps("tb",  fontSize=7.5, textColor=DARK,      leading=10, alignment=TA_JUSTIFY),
    }

    story = []

    # ── Extract data ──────────────────────────────────────────────────────────
    meta         = data.get("meta", {})
    booking_info = data.get("booking_info", {})
    applicant    = data.get("applicant", {})
    joint        = data.get("joint_applicant", {})
    nominee      = data.get("nominee", {})
    prop         = data.get("property", {})
    plan         = data.get("payment_plan", {})
    terms        = data.get("terms_conditions", [])
    company_name = meta.get("company_name", "Real Estate Management System")
    booking_id   = booking_info.get("booking_id", "")
    report_id    = meta.get("report_id", "")
    generated_at = meta.get("generated_at", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    sym          = meta.get("currency_symbol", "₨")  # Dynamic currency symbol

    # ── HEADER ────────────────────────────────────────────────────────────────
    hdr = Table([[Paragraph(company_name, S["company"])]], colWidths=[PAGE_W])
    hdr.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DARK_BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(hdr)

    sub = Table([
        [Paragraph("PROPERTY BOOKING FORM", S["title"])],
        [Paragraph(
            f"Booking No: <b>{booking_id}</b> &nbsp;|&nbsp; "
            f"Date: <b>{generated_at}</b> &nbsp;|&nbsp; Ref: <b>{report_id}</b>",
            S["subtitle"],
        )],
    ], colWidths=[PAGE_W])
    sub.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), MID_BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(sub)
    story.append(Spacer(1, 4 * mm))

    # ── Helpers ───────────────────────────────────────────────────────────────
    def sec_hdr(title: str):
        t = Table([[Paragraph(f"  {title}", S["section"])]], colWidths=[PAGE_W])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), PALE_BLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
            ("LINEBELOW",     (0, 0), (-1, -1), 1, ACCENT),
        ]))
        return t

    def info_grid(fields: List[tuple], cols: int = 3) -> Table:
        col_w = PAGE_W / cols
        rows_data = []
        row = []
        for lbl, val in fields:
            cell = Table([
                [Paragraph(lbl, S["label"])],
                [Paragraph(str(val) if val else "—", S["value"])],
            ], colWidths=[col_w - 8])
            cell.setStyle(TableStyle([
                ("TOPPADDING",    (0, 0), (-1, -1), 1),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ]))
            row.append(cell)
            if len(row) == cols:
                rows_data.append(row)
                row = []
        if row:
            while len(row) < cols:
                row.append(Paragraph("", S["label"]))
            rows_data.append(row)

        t = Table(rows_data, colWidths=[col_w] * cols)
        t.setStyle(TableStyle([
            ("TOPPADDING",     (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 5),
            ("LEFTPADDING",    (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [WHITE, ALT_ROW]),
            ("GRID",           (0, 0), (-1, -1), 0.3, BORDER),
        ]))
        return t

    # ── SECTION 1: BOOKING INFO ───────────────────────────────────────────────
    story.append(sec_hdr("BOOKING INFORMATION"))
    story.append(info_grid([
        ("Booking Date",   booking_info.get("booking_date")),
        ("Booking Number", booking_info.get("booking_id")),
        ("Tracking ID",    booking_info.get("tracking_id")),
        ("Booking Status", booking_info.get("status")),
        ("Expiry Date",    booking_info.get("expiry_date")),
        ("Booking Amount", booking_info.get("booking_amount")),
    ], cols=3))
    story.append(Spacer(1, 3 * mm))

    # ── SECTION 2: APPLICANT INFORMATION ─────────────────────────────────────
    story.append(sec_hdr("APPLICANT INFORMATION"))
    story.append(info_grid([
        ("Full Name",   applicant.get("name")),
        ("CNIC",        applicant.get("cnic")),
        ("Date of Birth", applicant.get("dob")),
        ("Passport No.", applicant.get("passport")),
        ("Occupation",  applicant.get("occupation")),
        ("Phone",       applicant.get("phone")),
        ("WhatsApp",    applicant.get("whatsapp")),
        ("Email",       applicant.get("email")),
        ("Address",     applicant.get("address")),
        ("Country",     applicant.get("country", "Pakistan")),
        ("Client ID",   applicant.get("client_id")),
        ("Status",      applicant.get("status")),
    ], cols=3))
    story.append(Spacer(1, 3 * mm))

    # ── SECTION 3: JOINT APPLICANT (conditional) ──────────────────────────────
    has_joint = any(v for v in joint.values() if v)
    if has_joint:
        story.append(sec_hdr("JOINT APPLICANT"))
        story.append(info_grid([
            ("Full Name",  joint.get("name")),
            ("CNIC",       joint.get("cnic")),
            ("Relation",   joint.get("relation")),
            ("Contact",    joint.get("contact")),
            ("Email",      joint.get("email")),
            ("Address",    joint.get("address")),
        ], cols=3))
        story.append(Spacer(1, 3 * mm))

    # ── SECTION 4: NOMINEE INFORMATION ───────────────────────────────────────
    story.append(sec_hdr("NOMINEE INFORMATION"))
    story.append(info_grid([
        ("Nominee Name", nominee.get("name")),
        ("Relation",     nominee.get("relation")),
        ("CNIC",         nominee.get("cnic")),
        ("Contact",      nominee.get("contact")),
    ], cols=4))
    story.append(Spacer(1, 3 * mm))

    # ── SECTION 5: PROPERTY INFORMATION ──────────────────────────────────────
    story.append(sec_hdr("PROPERTY INFORMATION"))
    story.append(info_grid([
        ("Project",        prop.get("project_name")),
        ("Unit Number",    prop.get("unit_number")),
        ("Floor",          prop.get("floor")),
        ("Property Type",  prop.get("property_type")),
        ("Category",       prop.get("category")),
        ("Size / Area",    prop.get("size")),
        ("Rate Per Sqft",  prop.get("rate_per_sqft")),
        ("Total Price",    prop.get("gross_price")),
        ("Discount",       prop.get("discount")),
        ("Net Price",      prop.get("net_price")),
        ("Deal Valid Till",prop.get("deal_valid_till")),
        ("Unit Status",    prop.get("unit_status")),
    ], cols=3))
    story.append(Spacer(1, 3 * mm))

    # ── SECTION 6: PAYMENT PLAN SUMMARY ──────────────────────────────────────
    story.append(sec_hdr("PAYMENT PLAN SUMMARY"))
    story.append(Spacer(1, 2 * mm))

    def card(lbl: str, val: str, val_color=DARK_BLUE) -> Table:
        cw = (PAGE_W / 4) - 2
        t = Table([
            [Paragraph(lbl, S["card_lbl"])],
            [Paragraph(val or "—", ps("cv2", fontSize=10, textColor=val_color,
                                       fontName="Helvetica-Bold", alignment=TA_CENTER, leading=13))],
        ], colWidths=[cw])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), PALE_BLUE),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ]))
        return t

    def cards_row(items):
        row = [card(lbl, val, col) for lbl, val, col in items]
        t = Table([row], colWidths=[(PAGE_W / 4)] * 4)
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING",   (0, 0), (-1, -1), 1),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 1),
        ]))
        return t

    story.append(cards_row([
        ("Down Payment",       plan.get("down_payment", "—"),       GREEN),
        ("Installments Count", str(plan.get("total_count", "—")),   DARK_BLUE),
        ("Last Installment",   plan.get("last_installment", "—"),   GOLD),
        ("Processing Charges", plan.get("processing_fee", "—"),     MID_BLUE),
    ]))
    story.append(Spacer(1, 2 * mm))
    story.append(cards_row([
        ("Plan Start Date",    plan.get("start_date", "—"),         DARK_BLUE),
        ("Frequency",          plan.get("frequency", "—"),          MID_BLUE),
        ("Total Payable",      plan.get("total_amount", "—"),       DARK_BLUE),
        ("Outstanding",        plan.get("outstanding", "—"),        RED),
    ]))
    story.append(Spacer(1, 4 * mm))

    # ── SECTION 7: TERMS & CONDITIONS ────────────────────────────────────────
    story.append(sec_hdr("TERMS & CONDITIONS"))
    story.append(Spacer(1, 2 * mm))

    if terms:
        for i, term in enumerate(terms, 1):
            if isinstance(term, dict):
                heading = term.get("heading", "")
                points  = term.get("points", [])
                if heading:
                    story.append(Paragraph(f"{i}. {heading}", S["terms_h"]))
                for pt in points:
                    story.append(Paragraph(f"   • {pt}", S["terms_b"]))
                story.append(Spacer(1, 1 * mm))
            else:
                story.append(Paragraph(f"{i}. {term}", S["terms_b"]))
    else:
        default_terms = [
            "The booking is subject to availability and management approval.",
            "The booking amount is non-refundable in case of cancellation by the applicant.",
            "All payments must be made via crossed cheque or bank transfer in favor of the company.",
            "The company reserves the right to cancel the booking in case of non-payment.",
            "Possession will be handed over only after full payment of all dues.",
            "Any dispute shall be resolved as per the laws of Pakistan.",
            "The applicant confirms that all information provided is accurate and complete.",
            "The company is not responsible for any delay due to force majeure events.",
        ]
        for i, term in enumerate(default_terms, 1):
            story.append(Paragraph(f"{i}. {term}", S["terms_b"]))

    story.append(Spacer(1, 5 * mm))

    # ── SECTION 8: SIGNATURES ─────────────────────────────────────────────────
    story.append(sec_hdr("SIGNATURES"))
    story.append(Spacer(1, 2 * mm))

    def sig_block(title: str, sub: str) -> Table:
        t = Table([
            [Paragraph(title, S["sig"])],
            [Spacer(1, 10 * mm)],
            [Paragraph("________________________", S["sig"])],
            [Paragraph(sub, S["sig_l"])],
        ], colWidths=[(PAGE_W / 4) - 16])
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ]))
        return t

    sig_t = Table([[
        sig_block("Applicant Signature", "Name & Date"),
        sig_block("Applicant Thumb",     "Left Thumb Impression"),
        sig_block("Booking Officer",     "Name & Designation"),
        sig_block("Manager Approval",    "Name, Designation & Stamp"),
    ]], colWidths=[(PAGE_W / 4)] * 4)
    sig_t.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, BORDER),
        ("BACKGROUND",    (0, 0), (-1, -1), PALE_BLUE),
    ]))
    story.append(sig_t)
    story.append(Spacer(1, 4 * mm))

    # Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 1 * mm))
    story.append(Paragraph(
        f"{company_name}  |  Property Booking Form  |  {booking_id}  |  Confidential  |  {generated_at}",
        S["footer"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
