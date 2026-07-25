# Report Module — How to Add a New Report Type

## Architecture

```
report_types → mapper functions → ReportData → Jinja2 template → HTML / PDF / XLSX
```

Adding a new report requires **one mapper function** and **zero new CSS/layout code**.

---

## Step 1: Create a Mapper Function

Open `backend/app/services/report_mappers.py` and add a function decorated with `@register_report`:

```python
@register_report("my_new_report")
def my_new_report(db: Session, payload: dict) -> Optional[ReportData]:
    entity_id = payload.get("entity_id")
    filters = payload.get("filters", {})

    # Query your data using SQLAlchemy
    records = db.query(MyModel).filter(...).all()

    # Build ledger rows
    rows = []
    for r in records:
        rows.append(ReportLedgerRow(
            cells=[str(r.field1), str(r.field2), _fmt(r.amount)],
            status=_status_dots(r.status),
            is_milestone=r.is_milestone,
        ))

    return ReportData(
        letterhead=ReportLetterhead(
            title="My New Report",
            subtitle="Optional subtitle",
            reference_no="REF-123",
            date=_date(datetime.now(timezone.utc)),
            status="Active",  # drives the seal/stamp text
        ),
        info_grid=ReportInfoGrid(
            left_column=[
                ReportInfoRow(label="Field", value="Value"),
            ],
            right_column=[
                ReportInfoRow(label="Field 2", value="Value 2"),
            ],
        ),
        financial_strip=[
            ReportFinancialStripCell(label="Total", value=_fmt(total)),
            ReportFinancialStripCell(label="Outstanding", value=_fmt(outstanding), inverted=True),
        ],
        ledger=ReportLedgerSection(
            columns=[
                ReportLedgerColumn(key="field1", label="Field 1", align="left"),
                ReportLedgerColumn(key="amount", label="Amount", align="right", format="currency"),
            ],
            rows=rows,
            totals_row=ReportLedgerRow(
                cells=["", "TOTAL", _fmt(grand_total)],
                is_total=True,
            ),
        ),
        terms=ReportTerms(text="Your disclaimer text here."),
        signature=ReportSignatureRow(
            customer_name="Customer Name",
            authorized_name="Authorized Signatory",
        ),
    )
```

## Step 2: Access the Report

The report is immediately available at:

| Format   | Endpoint                                    |
|----------|---------------------------------------------|
| HTML     | `POST /reports/download/html`               |
| PDF      | `POST /reports/download/pdf`                |
| XLSX     | `POST /reports/download/xlsx`               |

with payload:
```json
{
  "report_type": "my_new_report",
  "entity_id": 42,
  "output_format": "html"
}
```

## Step 3: Frontend

Use the `ReportDialog` component:

```tsx
import ReportDialog from "../components/reports/ReportDialog";

<ReportDialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  reportType="my_new_report"
  entityId={recordId}
  title="Generate My Report"
/>
```

## Available Helper Functions

| Function   | Purpose                                   |
|------------|-------------------------------------------|
| `_fmt(n)`  | Format number as `1,234,567.00`           |
| `_date(d)` | Format date as `DD/MM/YYYY`               |
| `_status_dots(s)` | Map status string → `paid`/`partial`/`pending` |

## Template Sections

The master template at `backend/app/templates/reports/master_report.html` renders:

1. **Letterhead** — monogram + company name + tagline | title + ref + date
2. **Seal/Stamp** — SVG ring with status text (if `show_seal` is true per report type)
3. **Info Grid** — 2-column label/value pairs
4. **Financial Strip** — up to 5 cells, last can be inverted (black bg)
5. **Ledger Table** — repeating headers, milestone rows, dot-glyph statuses, totals
6. **Terms** — small gray text
7. **Signature** — 3-column: Customer / Authorized / Company Stamp
8. **Footer** — page number + report identity (auto on every page)
