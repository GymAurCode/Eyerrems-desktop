"""
PDF Generator — Enterprise-grade PDF export for reports.
Uses reportlab for professional table-based PDF output.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.services.reports.report_engine import ReportColumn, ReportMeta, ReportResult, ReportSummary


def _parse_num(value, sym: str = "") -> float:
    """Parse a value that may be a raw float or a pre-formatted currency string."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    # Strip currency symbols and commas from pre-formatted strings like "₨ 1,250,000.00"
    cleaned = str(value).replace(",", "").replace(sym, "").replace("$", "").replace("₨", "").strip()
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def generate_pdf_report(result: ReportResult) -> bytes:
    """
    Generate PDF from ReportResult using reportlab.
    """
    return _generate_pdf_reportlab(result)


def _generate_pdf_reportlab(result: ReportResult) -> bytes:
    """Generate PDF using reportlab. Produces a clean, professional table-based PDF."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph,
        Spacer, HRFlowable,
    )
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

    meta = result.meta
    columns = [col for col in result.columns if col.visible]
    sym = meta.currency_symbol  # Dynamic currency symbol
    pagesize = landscape(A4) if len(columns) > 6 else A4
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf,
        pagesize=pagesize,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()
    DARK_BLUE = colors.HexColor("#1e3a5f")
    MID_BLUE = colors.HexColor("#2e5090")
    LIGHT_BLUE = colors.HexColor("#ebf5fb")
    HEADER_BG = colors.HexColor("#1e3a5f")
    ROW_ALT = colors.HexColor("#f5f7fa")
    BORDER = colors.HexColor("#d0d7e3")

    title_style = ParagraphStyle(
        "ReportTitle", parent=styles["Heading1"],
        fontSize=14, textColor=DARK_BLUE, alignment=TA_CENTER, spaceAfter=2,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle", parent=styles["Normal"],
        fontSize=9, textColor=MID_BLUE, alignment=TA_CENTER, spaceAfter=2,
    )
    meta_style = ParagraphStyle(
        "ReportMeta", parent=styles["Normal"],
        fontSize=7, textColor=colors.HexColor("#888888"), alignment=TA_CENTER, spaceAfter=4,
    )
    cell_style = ParagraphStyle(
        "Cell", parent=styles["Normal"], fontSize=7.5, leading=10,
    )

    story = []

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(Paragraph(meta.company_name or "Real Estate Management System", title_style))
    story.append(Paragraph(meta.title, subtitle_style))
    if meta.subtitle:
        story.append(Paragraph(meta.subtitle, subtitle_style))
    story.append(Paragraph(
        f"Generated: {meta.generated_at.strftime('%Y-%m-%d %H:%M')}  |  By: {meta.generated_by}  |  Records: {meta.total_records}",
        meta_style,
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=DARK_BLUE, spaceAfter=6))

    # ── Summary cards (as a simple table) ────────────────────────────────────
    if result.summary:
        summary_data = [[]]
        for card in result.summary[:4]:
            val = card.value
            if card.format == "currency":
                try:
                    val = f"{sym} {float(val):,.2f}"
                except (TypeError, ValueError):
                    val = str(val)
            elif card.format == "percentage":
                try:
                    val = f"{float(val):.1f}%"
                except (TypeError, ValueError):
                    val = str(val)
            else:
                val = str(val)

            cell_content = Paragraph(
                f'<font size="7" color="#666666">{card.label}</font><br/>'
                f'<font size="11" color="#1e3a5f"><b>{val}</b></font>',
                ParagraphStyle("SummaryCell", alignment=TA_CENTER, leading=14),
            )
            summary_data[0].append(cell_content)

        col_count = len(summary_data[0])
        if col_count:
            page_w = (pagesize[0] - 24 * mm)
            col_w = page_w / col_count
            summary_table = Table(summary_data, colWidths=[col_w] * col_count, rowHeights=[28 * mm])
            summary_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BLUE),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 6 * mm))

    # ── Data table ────────────────────────────────────────────────────────────
    if columns and result.rows:
        page_w = pagesize[0] - 24 * mm

        # Calculate column widths proportionally
        col_widths = []
        for col in columns:
            if col.width and col.width.endswith("%"):
                try:
                    pct = float(col.width.rstrip("%")) / 100
                    col_widths.append(page_w * pct)
                except ValueError:
                    col_widths.append(page_w / len(columns))
            else:
                col_widths.append(page_w / len(columns))

        # Normalize widths to fit page
        total_w = sum(col_widths)
        if total_w > 0:
            col_widths = [w * page_w / total_w for w in col_widths]

        # Header row
        header_row = []
        for col in columns:
            align = TA_RIGHT if col.align == "right" else TA_CENTER if col.align == "center" else TA_LEFT
            header_row.append(Paragraph(
                f'<font color="white"><b>{col.label}</b></font>',
                ParagraphStyle("TH", fontSize=7.5, alignment=align, leading=10),
            ))

        table_data = [header_row]

        # Data rows
        for row in result.rows:
            data_row = []
            for col in columns:
                value = row.get(col.key, "")
                if value is None or value == "":
                    value = "—"
                align = TA_RIGHT if col.align == "right" else TA_CENTER if col.align == "center" else TA_LEFT

                if col.data_type == "currency":
                    if isinstance(value, (int, float)):
                        display = f"{sym} {float(value):,.2f}"
                    else:
                        display = str(value)  # Already formatted
                    data_row.append(Paragraph(
                        display[:80],
                        ParagraphStyle("TD", fontSize=7.5, alignment=TA_RIGHT, leading=10),
                    ))
                else:
                    data_row.append(Paragraph(
                        str(value)[:80],
                        ParagraphStyle("TD", fontSize=7.5, alignment=align, leading=10),
                    ))
            table_data.append(data_row)

        # Totals row
        has_totals = any(col.data_type in ("currency", "number") for col in columns)
        if has_totals:
            totals_row = []
            for idx, col in enumerate(columns):
                if idx == 0:
                    totals_row.append(Paragraph(
                        "<b>TOTAL</b>",
                        ParagraphStyle("TF", fontSize=7.5, leading=10),
                    ))
                elif col.data_type in ("currency", "number"):
                    try:
                        total = sum(
                            _parse_num(row.get(col.key, 0), sym)
                            for row in result.rows
                        )
                        fmt = f"{sym} {total:,.2f}" if col.data_type == "currency" else f"{total:,.2f}"
                        totals_row.append(Paragraph(
                            f"<b>{fmt}</b>",
                            ParagraphStyle("TF", fontSize=7.5, alignment=TA_RIGHT, leading=10),
                        ))
                    except (TypeError, ValueError):
                        totals_row.append(Paragraph("", cell_style))
                else:
                    totals_row.append(Paragraph("", cell_style))
            table_data.append(totals_row)

        data_table = Table(table_data, colWidths=col_widths, repeatRows=1)

        # Build alternating row styles
        row_styles = [
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 7.5),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, ROW_ALT]),
            ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]

        # Totals row styling
        if has_totals:
            data_table.setStyle(TableStyle(row_styles + [
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#e8f0fe")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]))
        else:
            data_table.setStyle(TableStyle(row_styles))

        story.append(data_table)
    else:
        story.append(Paragraph("No data available for the selected filters.", meta_style))

    # ── Footer ────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Paragraph(
        f"{meta.company_name or 'REMS'}  |  {meta.title}  |  Confidential",
        meta_style,
    ))

    doc.build(story)
    buf.seek(0)
    return buf.read()
