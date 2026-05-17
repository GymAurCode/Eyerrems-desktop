"""
Property Reports — Inventory, availability, sales, pricing reports.

Reports:
  1. Inventory Report
  2. Available Units Report
  3. Sold Units Report
  4. Floor Wise Report
  5. Category Wise Report
  6. Property Status Report
  7. Price Analysis Report
"""
from __future__ import annotations

from typing import Any, Dict, List

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.property import Floor, Property, PropertyCategory, Unit
from app.services.reports.report_engine import (
    BaseReportService, ReportColumn, ReportFilter, ReportResult, ReportSummary,
)


# ── Inventory Report ──────────────────────────────────────────────────────────

class InventoryReportService(BaseReportService):
    """Complete property inventory with units."""

    REPORT_KEY = "inventory_report"
    REPORT_NAME = "Property Inventory Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Unit, Floor, Property)
            .join(Floor, Unit.floor_id == Floor.id)
            .join(Property, Floor.property_id == Property.id)
        )

        # Apply filters
        if filters.property_id:
            query = query.filter(Property.id == filters.property_id)
        if filters.status:
            query = query.filter(Unit.status == filters.status)
        if filters.search:
            query = query.filter(
                or_(
                    Property.name.ilike(f"%{filters.search}%"),
                    Unit.unit_number.ilike(f"%{filters.search}%"),
                )
            )

        # Count total
        total_count = query.count()

        # Apply sorting
        if filters.sort_by == "property":
            query = query.order_by(Property.name.asc() if filters.sort_order == "asc" else Property.name.desc())
        elif filters.sort_by == "price":
            query = query.order_by(Unit.sale_price.asc() if filters.sort_order == "asc" else Unit.sale_price.desc())
        else:
            query = query.order_by(Property.id.asc(), Floor.floor_number.asc(), Unit.unit_number.asc())

        # Apply pagination
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        for unit, floor, prop in results:
            rows.append({
                "property": prop.name,
                "floor": f"Floor {floor.floor_number}",
                "unit_number": unit.unit_number,
                "size": unit.size or "N/A",
                "sale_price": self._format_currency(unit.sale_price),
                "rent_amount": self._format_currency(unit.rent_amount),
                "status": unit.status.upper(),
            })

        columns = [
            ReportColumn(key="property", label="Property", width="20%"),
            ReportColumn(key="floor", label="Floor", width="12%"),
            ReportColumn(key="unit_number", label="Unit #", width="12%"),
            ReportColumn(key="size", label="Size", width="12%"),
            ReportColumn(key="sale_price", label="Sale Price", data_type="currency", align="right", width="15%"),
            ReportColumn(key="rent_amount", label="Rent", data_type="currency", align="right", width="15%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="14%"),
        ]

        # Status breakdown
        status_counts = (
            self.db.query(Unit.status, func.count(Unit.id))
            .join(Floor, Unit.floor_id == Floor.id)
            .join(Property, Floor.property_id == Property.id)
            .group_by(Unit.status)
            .all()
        )

        summary = [
            ReportSummary(label="Total Units", value=total_count, format="number", color="blue"),
        ]
        for status, count in status_counts:
            color = "green" if status == "available" else "red" if status == "sold" else "yellow"
            summary.append(
                ReportSummary(label=status.title(), value=count, format="number", color=color)
            )

        meta = self._make_meta(
            title="Property Inventory Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Available Units Report ────────────────────────────────────────────────────

class AvailableUnitsReportService(BaseReportService):
    """Report of all available units for sale/rent."""

    REPORT_KEY = "available_units"
    REPORT_NAME = "Available Units Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(Unit, Floor, Property)
            .join(Floor, Unit.floor_id == Floor.id)
            .join(Property, Floor.property_id == Property.id)
            .filter(Unit.status == "available")
        )

        # Apply filters
        if filters.property_id:
            query = query.filter(Property.id == filters.property_id)
        if filters.amount_min:
            query = query.filter(Unit.sale_price >= filters.amount_min)
        if filters.amount_max:
            query = query.filter(Unit.sale_price <= filters.amount_max)

        # Count total
        total_count = query.count()

        # Apply sorting
        if filters.sort_by == "price":
            query = query.order_by(Unit.sale_price.asc() if filters.sort_order == "asc" else Unit.sale_price.desc())
        else:
            query = query.order_by(Property.name.asc(), Floor.floor_number.asc(), Unit.unit_number.asc())

        # Apply pagination
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_value = 0.0

        for unit, floor, prop in results:
            price = self._safe_float(unit.sale_price)
            total_value += price

            rows.append({
                "property": prop.name,
                "address": prop.address or "N/A",
                "floor": f"Floor {floor.floor_number}",
                "unit_number": unit.unit_number,
                "size": unit.size or "N/A",
                "sale_price": self._format_currency(price),
                "rent_amount": self._format_currency(unit.rent_amount),
            })

        columns = [
            ReportColumn(key="property", label="Property", width="18%"),
            ReportColumn(key="address", label="Address", width="20%"),
            ReportColumn(key="floor", label="Floor", width="10%"),
            ReportColumn(key="unit_number", label="Unit #", width="10%"),
            ReportColumn(key="size", label="Size", width="10%"),
            ReportColumn(key="sale_price", label="Sale Price", data_type="currency", align="right", width="16%"),
            ReportColumn(key="rent_amount", label="Rent", data_type="currency", align="right", width="16%"),
        ]

        summary = [
            ReportSummary(label="Available Units", value=total_count, format="number", color="green"),
            ReportSummary(label="Total Value", value=total_value, format="currency", color="blue"),
        ]

        meta = self._make_meta(
            title="Available Units Report",
            filters=filters,
            total_records=total_count,
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Floor Wise Report ─────────────────────────────────────────────────────────

class FloorWiseReportService(BaseReportService):
    """Floor-wise unit distribution and status."""

    REPORT_KEY = "floor_wise_report"
    REPORT_NAME = "Floor Wise Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "summary"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(
                Property.name.label("property_name"),
                Floor.floor_number,
                func.count(Unit.id).label("total_units"),
                func.sum(func.case((Unit.status == "available", 1), else_=0)).label("available"),
                func.sum(func.case((Unit.status == "sold", 1), else_=0)).label("sold"),
                func.sum(func.case((Unit.status == "booked", 1), else_=0)).label("booked"),
                func.sum(func.case((Unit.status == "reserved", 1), else_=0)).label("reserved"),
            )
            .join(Floor, Unit.floor_id == Floor.id)
            .join(Property, Floor.property_id == Property.id)
            .group_by(Property.name, Floor.floor_number)
            .order_by(Property.name.asc(), Floor.floor_number.asc())
        )

        # Apply filters
        if filters.property_id:
            query = query.filter(Property.id == filters.property_id)

        results = query.all()

        rows = []
        for row in results:
            rows.append({
                "property": row.property_name,
                "floor": f"Floor {row.floor_number}",
                "total_units": row.total_units,
                "available": row.available or 0,
                "sold": row.sold or 0,
                "booked": row.booked or 0,
                "reserved": row.reserved or 0,
            })

        columns = [
            ReportColumn(key="property", label="Property", width="25%"),
            ReportColumn(key="floor", label="Floor", width="15%"),
            ReportColumn(key="total_units", label="Total", data_type="number", align="center", width="10%"),
            ReportColumn(key="available", label="Available", data_type="number", align="center", width="12%"),
            ReportColumn(key="sold", label="Sold", data_type="number", align="center", width="12%"),
            ReportColumn(key="booked", label="Booked", data_type="number", align="center", width="13%"),
            ReportColumn(key="reserved", label="Reserved", data_type="number", align="center", width="13%"),
        ]

        total_units = sum(row["total_units"] for row in rows)
        total_available = sum(row["available"] for row in rows)
        total_sold = sum(row["sold"] for row in rows)

        summary = [
            ReportSummary(label="Total Units", value=total_units, format="number", color="blue"),
            ReportSummary(label="Available", value=total_available, format="number", color="green"),
            ReportSummary(label="Sold", value=total_sold, format="number", color="red"),
        ]

        meta = self._make_meta(
            title="Floor Wise Report",
            filters=filters,
            total_records=len(rows),
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )


# ── Category Wise Report ──────────────────────────────────────────────────────

class CategoryWiseReportService(BaseReportService):
    """Property distribution by category."""

    REPORT_KEY = "category_wise_report"
    REPORT_NAME = "Category Wise Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "summary"

    def generate(self, filters: ReportFilter) -> ReportResult:
        start = self._start_timer()

        query = (
            self.db.query(
                PropertyCategory.name.label("category"),
                func.count(Property.id).label("total_properties"),
                func.sum(func.case((Property.status == "available", 1), else_=0)).label("available"),
                func.sum(func.case((Property.status == "sold", 1), else_=0)).label("sold"),
                func.sum(func.case((Property.for_sale == True, 1), else_=0)).label("for_sale"),
            )
            .outerjoin(Property, Property.category_id == PropertyCategory.id)
            .group_by(PropertyCategory.name)
            .order_by(PropertyCategory.name.asc())
        )

        results = query.all()

        rows = []
        for row in results:
            rows.append({
                "category": row.category,
                "total": row.total_properties or 0,
                "available": row.available or 0,
                "sold": row.sold or 0,
                "for_sale": row.for_sale or 0,
            })

        columns = [
            ReportColumn(key="category", label="Category", width="30%"),
            ReportColumn(key="total", label="Total", data_type="number", align="center", width="17%"),
            ReportColumn(key="available", label="Available", data_type="number", align="center", width="18%"),
            ReportColumn(key="sold", label="Sold", data_type="number", align="center", width="17%"),
            ReportColumn(key="for_sale", label="For Sale", data_type="number", align="center", width="18%"),
        ]

        total_properties = sum(row["total"] for row in rows)

        summary = [
            ReportSummary(label="Total Properties", value=total_properties, format="number", color="blue"),
            ReportSummary(label="Categories", value=len(rows), format="number", color="purple"),
        ]

        meta = self._make_meta(
            title="Category Wise Report",
            filters=filters,
            total_records=len(rows),
        )

        return ReportResult(
            meta=meta,
            columns=columns,
            rows=rows,
            summary=summary,
            generation_time_ms=self._elapsed_ms(start),
        )
