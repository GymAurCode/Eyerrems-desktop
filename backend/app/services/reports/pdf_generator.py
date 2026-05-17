"""
PDF Generator — Enterprise-grade PDF export for reports.

Uses xhtml2pdf (already in requirements) for HTML-to-PDF conversion.
This approach gives us full CSS control for professional styling.

Falls back to a simple text-based PDF if xhtml2pdf is unavailable.
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


def _build_html_report(result: ReportResult) -> str:
    """Build HTML string for the report — styled for PDF output."""
    meta = result.meta
    columns = [col for col in result.columns if col.visible]
    sym = meta.currency_symbol  # Dynamic currency symbol (₨ or $)

    # ── CSS ──────────────────────────────────────────────────────────────────
    css = """
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 9pt;
        color: #1a1a1a;
        line-height: 1.4;
    }
    .report-header {
        text-align: center;
        border-bottom: 2px solid #1e3a5f;
        padding-bottom: 8px;
        margin-bottom: 12px;
    }
    .company-name {
        font-size: 14pt;
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 2px;
    }
    .report-title {
        font-size: 12pt;
        font-weight: bold;
        color: #2e5090;
        margin-bottom: 2px;
    }
    .report-subtitle {
        font-size: 9pt;
        color: #555;
        margin-bottom: 4px;
    }
    .report-meta {
        font-size: 7.5pt;
        color: #888;
        margin-top: 4px;
    }
    .filters-row {
        font-size: 7pt;
        color: #999;
        font-style: italic;
        margin-top: 2px;
    }
    .summary-section {
        margin-bottom: 12px;
    }
    .summary-title {
        font-size: 9pt;
        font-weight: bold;
        color: #1e3a5f;
        margin-bottom: 6px;
    }
    .summary-cards {
        display: table;
        width: 100%;
        border-collapse: collapse;
    }
    .summary-card {
        display: table-cell;
        border: 1px solid #d0d7e3;
        padding: 6px 8px;
        background: #ebf5fb;
        vertical-align: top;
        width: 25%;
    }
    .summary-card-label {
        font-size: 7pt;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
    }
    .summary-card-value {
        font-size: 12pt;
        font-weight: bold;
        color: #1e3a5f;
    }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
        font-size: 8pt;
    }
    .data-table thead tr {
        background-color: #1e3a5f;
        color: white;
    }
    .data-table thead th {
        padding: 5px 6px;
        text-align: left;
        font-weight: bold;
        font-size: 7.5pt;
        border: 1px solid #1e3a5f;
        white-space: nowrap;
    }
    .data-table thead th.right { text-align: right; }
    .data-table thead th.center { text-align: center; }
    .data-table tbody tr:nth-child(even) {
        background-color: #f5f7fa;
    }
    .data-table tbody tr:nth-child(odd) {
        background-color: #ffffff;
    }
    .data-table tbody td {
        padding: 4px 6px;
        border: 1px solid #d0d7e3;
        vertical-align: middle;
    }
    .data-table tbody td.right { text-align: right; }
    .data-table tbody td.center { text-align: center; }
    .data-table tfoot tr {
        background-color: #e8f0fe;
        font-weight: bold;
    }
    .data-table tfoot td {
        padding: 5px 6px;
        border: 1px solid #b0c4de;
    }
    .data-table tfoot td.right { text-align: right; }
    .badge {
        display: inline-block;
        padding: 1px 5px;
        border-radius: 10px;
        font-size: 7pt;
        font-weight: bold;
        background: #e5e7eb;
        color: #374151;
    }
    .no-data {
        text-align: center;
        padding: 20px;
        color: #999;
        font-style: italic;
    }
    .report-footer {
        margin-top: 16px;
        padding-top: 8px;
        border-top: 1px solid #d0d7e3;
        font-size: 7pt;
        color: #999;
        text-align: center;
    }
    """

    # ── Header ────────────────────────────────────────────────────────────────
    filters_text = ""
    if meta.filters_applied:
        filters_text = " | ".join([f"{k}: {v}" for k, v in meta.filters_applied.items()])

    header_html = f"""
    <div class="report-header">
        <div class="company-name">{meta.company_name or 'Real Estate Management System'}</div>
        <div class="report-title">{meta.title}</div>
        {'<div class="report-subtitle">' + meta.subtitle + '</div>' if meta.subtitle else ''}
        <div class="report-meta">
            Generated: {meta.generated_at.strftime('%Y-%m-%d %H:%M')} &nbsp;|&nbsp;
            By: {meta.generated_by}
            {' &nbsp;|&nbsp; Report ID: ' + meta.report_id if meta.report_id else ''}
        </div>
        {'<div class="filters-row">Filters: ' + filters_text + '</div>' if filters_text else ''}
    </div>
    """

    # ── Summary Cards ─────────────────────────────────────────────────────────
    summary_html = ""
    if result.summary:
        cards_html = ""
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

            cards_html += f"""
            <td class="summary-card">
                <div class="summary-card-label">{card.label}</div>
                <div class="summary-card-value">{val}</div>
                {'<div style="font-size:7pt;color:#888;">' + card.sub_label + '</div>' if card.sub_label else ''}
            </td>
            """

        summary_html = f"""
        <div class="summary-section">
            <div class="summary-title">Summary</div>
            <table class="summary-cards"><tr>{cards_html}</tr></table>
        </div>
        """

    # ── Table ─────────────────────────────────────────────────────────────────
    if not columns or not result.rows:
        table_html = '<div class="no-data">No data available for the selected filters.</div>'
    else:
        # Header row
        header_cells = ""
        for col in columns:
            align_class = "right" if col.align == "right" else "center" if col.align == "center" else ""
            header_cells += f'<th class="{align_class}">{col.label}</th>'

        # Data rows
        body_rows = ""
        for row in result.rows:
            cells = ""
            for col in columns:
                value = row.get(col.key, "")
                if value is None or value == "":
                    value = "—"
                align_class = "right" if col.align == "right" else "center" if col.align == "center" else ""

                if col.data_type == "badge":
                    cells += f'<td class="{align_class}"><span class="badge">{value}</span></td>'
                elif col.data_type == "currency":
                    # Handle both raw floats and pre-formatted strings
                    if isinstance(value, (int, float)):
                        cells += f'<td class="right">{sym} {float(value):,.2f}</td>'
                    else:
                        # Already formatted (e.g. "₨ 1,250,000.00") — display as-is
                        cells += f'<td class="right">{value}</td>'
                elif col.data_type == "number" and isinstance(value, (int, float)):
                    cells += f'<td class="right">{float(value):,.2f}</td>'
                else:
                    cells += f'<td class="{align_class}">{str(value)[:80]}</td>'
            body_rows += f"<tr>{cells}</tr>"

        # Totals row
        totals_row = ""
        has_totals = any(col.data_type in ("currency", "number") for col in columns)
        if has_totals and result.rows:
            total_cells = ""
            for idx, col in enumerate(columns):
                if idx == 0:
                    total_cells += '<td style="font-weight:bold;">TOTAL</td>'
                elif col.data_type in ("currency", "number"):
                    try:
                        total = sum(
                            _parse_num(row.get(col.key, 0), sym)
                            for row in result.rows
                        )
                        if col.data_type == "currency":
                            total_cells += f'<td class="right">{sym} {total:,.2f}</td>'
                        else:
                            total_cells += f'<td class="right">{total:,.2f}</td>'
                    except (TypeError, ValueError):
                        total_cells += "<td></td>"
                else:
                    total_cells += "<td></td>"
            totals_row = f"<tfoot><tr>{total_cells}</tr></tfoot>"

        table_html = f"""
        <table class="data-table">
            <thead><tr>{header_cells}</tr></thead>
            <tbody>{body_rows}</tbody>
            {totals_row}
        </table>
        """

    # ── Footer ────────────────────────────────────────────────────────────────
    footer_html = f"""
    <div class="report-footer">
        {meta.company_name or 'REMS'} &nbsp;|&nbsp;
        {meta.title} &nbsp;|&nbsp;
        {meta.total_records} records &nbsp;|&nbsp;
        Confidential
    </div>
    """

    # ── Full HTML ─────────────────────────────────────────────────────────────
    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>{css}</style>
</head>
<body>
    {header_html}
    {summary_html}
    {table_html}
    {footer_html}
</body>
</html>"""


def generate_pdf_report(result: ReportResult) -> bytes:
    """
    Generate PDF from ReportResult.
    Tries xhtml2pdf first (HTML-to-PDF, best quality).
    Falls back to reportlab if xhtml2pdf is not installed.
    """
    try:
        from xhtml2pdf import pisa
        return _generate_pdf_xhtml2pdf(result, pisa)
    except ImportError:
        pass

    # Fallback: use reportlab (always available)
    try:
        return _generate_pdf_reportlab(result)
    except ImportError:
        raise RuntimeError(
            "No PDF library available. Install xhtml2pdf: pip install xhtml2pdf"
        )


def _generate_pdf_xhtml2pdf(result: ReportResult, pisa) -> bytes:
    """Generate PDF using xhtml2pdf (HTML-based, best styling)."""
    html_content = _build_html_report(result)
    pdf_buffer = io.BytesIO()

    pisa_status = pisa.CreatePDF(
        src=html_content,
        dest=pdf_buffer,
        encoding="utf-8",
    )

    if pisa_status.err:
        raise RuntimeError(f"PDF generation failed: {pisa_status.err}")

    pdf_buffer.seek(0)
    return pdf_buffer.read()


def _generate_pdf_reportlab(result: ReportResult) -> bytes:
    """
    Generate PDF using reportlab as a fallback.
    Produces a clean, professional table-based PDF.
    """
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
