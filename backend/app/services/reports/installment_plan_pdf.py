"""
Installment Plan PDF Generator — Enterprise-grade financial booking report.

Sections:
  1. Header (company name, report title, booking number, date)
  2. Customer Details (grid layout)
  3. Property Details (grid layout)
  4. Plan Summary Cards
  5. Installment Table (professional with alternating rows, totals)
  6. Declaration / Agreement / Signatures
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


def generate_installment_plan_pdf(data: Dict[str, Any]) -> bytes:
    """Generate a professional Installment Plan PDF from structured data dict."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT, TA_JUSTIFY
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
    )

    # ── Palette ───────────────────────────────────────────────────────────────
    DARK_BLUE   = colors.HexColor("#1e3a5f")
    MID_BLUE    = colors.HexColor("#2e5090")
    ACCENT      = colors.HexColor("#3b82f6")
    LIGHT_BLUE  = colors.HexColor("#dbeafe")
    PALE_BLUE   = colors.HexColor("#f0f7ff")
    ALT_ROW     = colors.HexColor("#f5f7fa")
    BORDER      = colors.HexColor("#d0d7e3")
    GREEN       = colors.HexColor("#059669")
    RED         = colors.HexColor("#dc2626")
    GOLD        = colors.HexColor("#d97706")
    GRAY        = colors.HexColor("#6b7280")
    DARK        = colors.HexColor("#111827")
    WHITE       = colors.white

    buf = io.BytesIO()
    PAGE_W_MM = A4[0] / mm - 30  # usable mm width
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15 * mm, rightMargin=15 * mm,
        topMargin=12 * mm, bottomMargin=15 * mm,
    )
    PAGE_W = A4[0] - 30 * mm

    styles = getSampleStyleSheet()

    def ps(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    # ── Styles ────────────────────────────────────────────────────────────────
    S = {
        "company":    ps("co",  fontSize=16, textColor=WHITE,      fontName="Helvetica-Bold", alignment=TA_CENTER, leading=20),
        "title":      ps("ti",  fontSize=11, textColor=LIGHT_BLUE, fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14),
        "subtitle":   ps("su",  fontSize=8,  textColor=LIGHT_BLUE, alignment=TA_CENTER, leading=10),
        "section":    ps("se",  fontSize=9,  textColor=DARK_BLUE,  fontName="Helvetica-Bold", leading=12),
        "label":      ps("la",  fontSize=7,  textColor=GRAY,       leading=9),
        "value":      ps("va",  fontSize=8.5, textColor=DARK,      fontName="Helvetica-Bold", leading=11),
        "body":       ps("bo",  fontSize=8,  textColor=DARK,       leading=11, alignment=TA_JUSTIFY),
        "small":      ps("sm",  fontSize=7,  textColor=GRAY,       leading=9),
        "footer":     ps("fo",  fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "th":         ps("th",  fontSize=8,  textColor=WHITE,      fontName="Helvetica-Bold", alignment=TA_CENTER, leading=10),
        "td":         ps("td",  fontSize=8,  textColor=DARK,       leading=10),
        "td_r":       ps("tdr", fontSize=8,  textColor=DARK,       alignment=TA_RIGHT, leading=10),
        "td_c":       ps("tdc", fontSize=8,  textColor=DARK,       alignment=TA_CENTER, leading=10),
        "tot":        ps("tot", fontSize=8.5, textColor=DARK_BLUE, fontName="Helvetica-Bold", alignment=TA_RIGHT, leading=11),
        "tot_l":      ps("tol", fontSize=8.5, textColor=DARK_BLUE, fontName="Helvetica-Bold", leading=11),
        "sig":        ps("sig", fontSize=8,  textColor=DARK,       alignment=TA_CENTER, leading=10),
        "sig_l":      ps("sil", fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "card_lbl":   ps("cla", fontSize=7,  textColor=GRAY,       alignment=TA_CENTER, leading=9),
        "card_val":   ps("cva", fontSize=11, textColor=DARK_BLUE,  fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14),
    }

    story = []

    # ── Extract data ──────────────────────────────────────────────────────────
    meta          = data.get("meta", {})
    customer      = data.get("customer", {})
    prop          = data.get("property", {})
    plan          = data.get("plan", {})
    inst_rows     = data.get("installment_rows", [])
    company_name  = meta.get("company_name", "Real Estate Management System")
    booking_id    = meta.get("booking_id", "")
    report_id     = meta.get("report_id", "")
    generated_at  = meta.get("generated_at", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    sym           = meta.get("currency_symbol", "₨")  # Dynamic currency symbol

    # ── HEADER ────────────────────────────────────────────────────────────────
    hdr = Table(
        [[Paragraph(company_name, S["company"])]],
        colWidths=[PAGE_W],
    )
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DARK_BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(hdr)

    sub = Table([
        [Paragraph("INSTALLMENT PLAN REPORT", S["title"])],
        [Paragraph(
            f"Booking No: <b>{booking_id}</b> &nbsp;|&nbsp; "
            f"Date: <b>{generated_at}</b> &nbsp;|&nbsp; Ref: <b>{report_id}</b>",
            S["subtitle"],
        )],
    ], colWidths=[PAGE_W])
    sub.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MID_BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 12),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 12),
    ]))
    story.append(sub)
    story.append(Spacer(1, 4 * mm))

    # ── Helper: section header ────────────────────────────────────────────────
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

    # ── Helper: info grid ─────────────────────────────────────────────────────
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

    # ── CUSTOMER DETAILS ──────────────────────────────────────────────────────
    story.append(sec_hdr("CUSTOMER DETAILS"))
    story.append(info_grid([
        ("Customer Name",    customer.get("name")),
        ("Father / Husband", customer.get("father_name")),
        ("CNIC",             customer.get("cnic")),
        ("Phone",            customer.get("phone")),
        ("WhatsApp",         customer.get("whatsapp")),
        ("Email",            customer.get("email")),
        ("Address",          customer.get("address")),
        ("Country",          customer.get("country", "Pakistan")),
        ("Registration No.", customer.get("registration_no")),
        ("Booking Date",     customer.get("booking_date")),
        ("Status",           customer.get("status")),
        ("Client ID",        customer.get("client_id")),
    ], cols=3))
    story.append(Spacer(1, 3 * mm))

    # ── PROPERTY DETAILS ──────────────────────────────────────────────────────
    story.append(sec_hdr("PROPERTY DETAILS"))
    story.append(info_grid([
        ("Project Name",       prop.get("project_name")),
        ("Unit Number",        prop.get("unit_number")),
        ("Floor",              prop.get("floor")),
        ("Property Type",      prop.get("property_type")),
        ("Category",           prop.get("category")),
        ("Area / Size",        prop.get("size")),
        ("Rate Per Sqft",      prop.get("rate_per_sqft")),
        ("Gross Price",        prop.get("gross_price")),
        ("Discount",           prop.get("discount")),
        ("Net Price",          prop.get("net_price")),
        ("Processing Fee",     prop.get("processing_fee")),
        ("Possession Charges", prop.get("possession_charges")),
    ], cols=3))
    story.append(Spacer(1, 3 * mm))

    # ── PLAN SUMMARY CARDS ────────────────────────────────────────────────────
    story.append(sec_hdr("PAYMENT PLAN SUMMARY"))
    story.append(Spacer(1, 2 * mm))

    def card(lbl: str, val: str, val_color=DARK_BLUE) -> Table:
        cw = (PAGE_W / 4) - 2
        t = Table([
            [Paragraph(lbl, S["card_lbl"])],
            [Paragraph(val or "—", ps("cv", fontSize=11, textColor=val_color,
                                       fontName="Helvetica-Bold", alignment=TA_CENTER, leading=14))],
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
        ("Down Payment",       plan.get("down_payment", "—"),   GREEN),
        ("Total Installments", str(plan.get("total_count", "—")), DARK_BLUE),
        ("Monthly Installment",plan.get("amount_per", "—"),     MID_BLUE),
        ("Total Payable",      plan.get("total_amount", "—"),   DARK_BLUE),
    ]))
    story.append(Spacer(1, 2 * mm))
    story.append(cards_row([
        ("Half Yearly",        plan.get("half_yearly", "—"),    MID_BLUE),
        ("Last Payment",       plan.get("last_payment", "—"),   GOLD),
        ("Outstanding",        plan.get("outstanding", "—"),    RED),
        ("Frequency",          plan.get("frequency", "—"),      DARK_BLUE),
    ]))
    story.append(Spacer(1, 4 * mm))

    # ── INSTALLMENT TABLE ─────────────────────────────────────────────────────
    story.append(sec_hdr("INSTALLMENT SCHEDULE"))
    story.append(Spacer(1, 2 * mm))

    if inst_rows:
        cw = [
            PAGE_W * 0.05,  # Sr#
            PAGE_W * 0.20,  # Description
            PAGE_W * 0.07,  # Inst#
            PAGE_W * 0.11,  # Due Date
            PAGE_W * 0.13,  # Gross
            PAGE_W * 0.09,  # Discount
            PAGE_W * 0.13,  # Net
            PAGE_W * 0.13,  # Outstanding
            PAGE_W * 0.09,  # Status
        ]
        tdata = [[
            Paragraph("Sr#",         S["th"]),
            Paragraph("Description", S["th"]),
            Paragraph("Inst#",       S["th"]),
            Paragraph("Due Date",    S["th"]),
            Paragraph("Gross Amt",   S["th"]),
            Paragraph("Discount",    S["th"]),
            Paragraph("Net Amount",  S["th"]),
            Paragraph("Outstanding", S["th"]),
            Paragraph("Status",      S["th"]),
        ]]

        tot_gross = tot_disc = tot_net = tot_out = 0.0

        for r in inst_rows:
            gross = float(r.get("gross_amount", 0) or 0)
            disc  = float(r.get("discount", 0) or 0)
            net   = float(r.get("net_amount", 0) or 0)
            out   = float(r.get("outstanding", 0) or 0)
            tot_gross += gross; tot_disc += disc; tot_net += net; tot_out += out

            st = str(r.get("status", "")).upper()
            st_color = GREEN if st == "PAID" else (RED if st == "OVERDUE" else GOLD)

            tdata.append([
                Paragraph(str(r.get("sr_no", "")),       S["td_c"]),
                Paragraph(str(r.get("description", "")), S["td"]),
                Paragraph(str(r.get("inst_no", "")),     S["td_c"]),
                Paragraph(str(r.get("due_date", "")),    S["td_c"]),
                Paragraph(_fmt(gross, sym),              S["td_r"]),
                Paragraph(_fmt(disc, sym),               S["td_r"]),
                Paragraph(_fmt(net, sym),                S["td_r"]),
                Paragraph(_fmt(out, sym),                S["td_r"]),
                Paragraph(st, ps("st", fontSize=7, textColor=st_color,
                                  fontName="Helvetica-Bold", alignment=TA_CENTER, leading=9)),
            ])

        tdata.append([
            Paragraph("", S["td"]),
            Paragraph("TOTAL", S["tot_l"]),
            Paragraph("", S["td"]),
            Paragraph("", S["td"]),
            Paragraph(_fmt(tot_gross, sym), S["tot"]),
            Paragraph(_fmt(tot_disc, sym),  S["tot"]),
            Paragraph(_fmt(tot_net, sym),   S["tot"]),
            Paragraph(_fmt(tot_out, sym),   S["tot"]),
            Paragraph("", S["td"]),
        ])

        inst_t = Table(tdata, colWidths=cw, repeatRows=1)
        inst_t.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0),  (-1, 0),  DARK_BLUE),
            ("TEXTCOLOR",      (0, 0),  (-1, 0),  WHITE),
            ("ROWBACKGROUNDS", (0, 1),  (-1, -2), [WHITE, ALT_ROW]),
            ("BACKGROUND",     (0, -1), (-1, -1), LIGHT_BLUE),
            ("FONTNAME",       (0, -1), (-1, -1), "Helvetica-Bold"),
            ("GRID",           (0, 0),  (-1, -1), 0.4, BORDER),
            ("VALIGN",         (0, 0),  (-1, -1), "MIDDLE"),
            ("TOPPADDING",     (0, 0),  (-1, -1), 3),
            ("BOTTOMPADDING",  (0, 0),  (-1, -1), 3),
            ("LEFTPADDING",    (0, 0),  (-1, -1), 4),
            ("RIGHTPADDING",   (0, 0),  (-1, -1), 4),
        ]))
        story.append(inst_t)
    else:
        story.append(Paragraph("No installment data available.", S["small"]))

    story.append(Spacer(1, 5 * mm))

    # ── DECLARATION & SIGNATURES ──────────────────────────────────────────────
    story.append(sec_hdr("DECLARATION & AGREEMENT"))
    story.append(Spacer(1, 2 * mm))
    story.append(Paragraph(
        "I/We hereby declare that the above information is correct and I/We agree to abide by the "
        "terms and conditions of the payment plan as outlined above. I/We understand that failure to "
        "make payments on the due dates may result in late payment charges and/or cancellation of the "
        "booking as per the company's cancellation policy. All payments must be made via crossed cheque "
        "or bank transfer in favor of the company. Cash payments are subject to management approval.",
        S["body"],
    ))
    story.append(Spacer(1, 2 * mm))
    for term in [
        "1. Payments must be made on or before the due date mentioned in the schedule above.",
        "2. A grace period of 7 days is allowed; after which late payment surcharge will be applicable.",
        "3. Bounced cheques will attract a penalty as per company policy.",
        "4. The company reserves the right to cancel the booking in case of default.",
        "5. All disputes shall be subject to the jurisdiction of local courts.",
    ]:
        story.append(Paragraph(term, S["small"]))
    story.append(Spacer(1, 5 * mm))

    # Signatures
    sig_cw = PAGE_W / 3

    def sig_block(title: str, sub: str) -> Table:
        t = Table([
            [Paragraph(title, S["sig"])],
            [Spacer(1, 10 * mm)],
            [Paragraph("________________________", S["sig"])],
            [Paragraph(sub, S["sig_l"])],
        ], colWidths=[sig_cw - 16])
        t.setStyle(TableStyle([
            ("TOPPADDING",    (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ]))
        return t

    sig_t = Table([[
        sig_block("Applicant Signature",  "Name & Date"),
        sig_block("Applicant Thumb",      "Left Thumb Impression"),
        sig_block("Authorized Officer",   "Name, Designation & Stamp"),
    ]], colWidths=[sig_cw] * 3)
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
        f"{company_name}  |  Installment Plan Report  |  {booking_id}  |  Confidential  |  {generated_at}",
        S["footer"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
