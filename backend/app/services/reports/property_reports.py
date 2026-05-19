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


# ── Town Inventory Report ──────────────────────────────────────────────────────

class TownInventoryReportService(BaseReportService):
    """Overall inventory report for society towns."""

    REPORT_KEY = "town_inventory"
    REPORT_NAME = "Town Inventory Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        from app.models.town import TownUnit
        start = self._start_timer()

        query = (
            self.db.query(TownUnit)
            .options(joinedload(TownUnit.town), joinedload(TownUnit.block))
        )

        if filters.town_id:
            query = query.filter(TownUnit.town_id == filters.town_id)
        if filters.status:
            query = query.filter(TownUnit.status == filters.status.lower())
        if filters.search:
            s = f"%{filters.search}%"
            query = query.filter(
                or_(
                    TownUnit.unit_number.ilike(s),
                    TownUnit.title.ilike(s)
                )
            )

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        for u in results:
            rows.append({
                "town": u.town.name if u.town else "N/A",
                "block": u.block.name if u.block else "N/A",
                "unit_number": u.unit_number,
                "unit_type": u.unit_type.title(),
                "size": u.size_label or "N/A",
                "total_price": self._format_currency(u.total_price),
                "status": u.status.upper(),
            })

        columns = [
            ReportColumn(key="town", label="Town / Society", width="20%"),
            ReportColumn(key="block", label="Block / Sector", width="15%"),
            ReportColumn(key="unit_number", label="Unit / Plot #", width="15%"),
            ReportColumn(key="unit_type", label="Type", width="15%"),
            ReportColumn(key="size", label="Size", width="10%"),
            ReportColumn(key="total_price", label="Total Price", data_type="currency", align="right", width="15%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="10%"),
        ]

        # Status breakdowns
        status_counts = (
            self.db.query(TownUnit.status, func.count(TownUnit.id))
            .group_by(TownUnit.status)
            .all()
        )

        summary = [
            ReportSummary(label="Total Units", value=total_count, format="number", color="blue"),
        ]
        for status, count in status_counts:
            color = "green" if status == "available" else "red" if status in ("sold", "booked") else "yellow"
            summary.append(
                ReportSummary(label=status.title(), value=count, format="number", color=color)
            )

        meta = self._make_meta(
            title="Town Inventory Report",
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


# ── Block Wise Inventory ──────────────────────────────────────────────────────

class BlockInventoryReportService(BaseReportService):
    """Block-wise statistics and unit counts."""

    REPORT_KEY = "block_inventory"
    REPORT_NAME = "Block Wise Inventory Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "summary"

    def generate(self, filters: ReportFilter) -> ReportResult:
        from app.models.town import Town, Block, TownUnit
        start = self._start_timer()

        query = (
            self.db.query(
                Town.name.label("town_name"),
                Block.name.label("block_name"),
                func.count(TownUnit.id).label("total_units"),
                func.sum(func.case((TownUnit.status == "available", 1), else_=0)).label("available"),
                func.sum(func.case((TownUnit.status == "sold", 1), else_=0)).label("sold"),
                func.sum(func.case((TownUnit.status == "booked", 1), else_=0)).label("booked"),
                func.sum(func.case((TownUnit.status == "reserved", 1), else_=0)).label("reserved"),
            )
            .join(Block, TownUnit.block_id == Block.id)
            .join(Town, TownUnit.town_id == Town.id)
            .group_by(Town.name, Block.name)
            .order_by(Town.name.asc(), Block.name.asc())
        )

        if filters.town_id:
            query = query.filter(Town.id == filters.town_id)

        results = query.all()

        rows = []
        for r in results:
            rows.append({
                "town": r.town_name,
                "block": r.block_name,
                "total_units": r.total_units,
                "available": r.available or 0,
                "sold": r.sold or 0,
                "booked": r.booked or 0,
                "reserved": r.reserved or 0,
            })

        columns = [
            ReportColumn(key="town", label="Town / Society", width="25%"),
            ReportColumn(key="block", label="Block Name", width="20%"),
            ReportColumn(key="total_units", label="Total Units", data_type="number", align="center", width="11%"),
            ReportColumn(key="available", label="Available", data_type="number", align="center", width="11%"),
            ReportColumn(key="sold", label="Sold", data_type="number", align="center", width="11%"),
            ReportColumn(key="booked", label="Booked", data_type="number", align="center", width="11%"),
            ReportColumn(key="reserved", label="Reserved", data_type="number", align="center", width="11%"),
        ]

        total_units = sum(r["total_units"] for r in rows)
        total_available = sum(r["available"] for r in rows)
        total_sold = sum(r["sold"] for r in rows)

        summary = [
            ReportSummary(label="Total Society Units", value=total_units, format="number", color="blue"),
            ReportSummary(label="Total Available", value=total_available, format="number", color="green"),
            ReportSummary(label="Total Sold", value=total_sold, format="number", color="red"),
        ]

        meta = self._make_meta(
            title="Block Wise Inventory Report",
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


# ── Unit Status Report ────────────────────────────────────────────────────────

class UnitStatusReportService(BaseReportService):
    """Listing unit status, owner, buyer, and financial progress."""

    REPORT_KEY = "unit_status"
    REPORT_NAME = "Unit Status & Financial Report"
    REPORT_CATEGORY = "Property"
    REPORT_TYPE = "tabular"

    def generate(self, filters: ReportFilter) -> ReportResult:
        from app.models.town import TownUnit
        start = self._start_timer()

        query = (
            self.db.query(TownUnit)
            .options(joinedload(TownUnit.town), joinedload(TownUnit.block))
        )

        if filters.town_id:
            query = query.filter(TownUnit.town_id == filters.town_id)
        if filters.status:
            query = query.filter(TownUnit.status == filters.status.lower())

        total_count = query.count()
        query = self._apply_pagination(query, filters)
        results = query.all()

        rows = []
        total_financial_received = 0.0
        total_financial_remaining = 0.0

        for u in results:
            received = self._safe_float(u.received_amount)
            remaining = self._safe_float(u.remaining_balance or 0)
            total_financial_received += received
            total_financial_remaining += remaining

            rows.append({
                "unit_number": u.unit_number,
                "block": u.block.name if u.block else "N/A",
                "client": u.owner_name or u.buyer_name or "N/A",
                "phone": u.owner_phone or u.buyer_phone or "N/A",
                "total_price": self._format_currency(u.total_price),
                "received_amount": self._format_currency(u.received_amount),
                "remaining_balance": self._format_currency(u.remaining_balance or 0),
                "status": u.status.upper(),
            })

        columns = [
            ReportColumn(key="unit_number", label="Unit / Plot #", width="12%"),
            ReportColumn(key="block", label="Block / Phase", width="13%"),
            ReportColumn(key="client", label="Client / Owner", width="15%"),
            ReportColumn(key="phone", label="Contact Phone", width="12%"),
            ReportColumn(key="total_price", label="Total Price", data_type="currency", align="right", width="13%"),
            ReportColumn(key="received_amount", label="Received", data_type="currency", align="right", width="12%"),
            ReportColumn(key="remaining_balance", label="Remaining Balance", data_type="currency", align="right", width="13%"),
            ReportColumn(key="status", label="Status", data_type="badge", align="center", width="10%"),
        ]

        summary = [
            ReportSummary(label="Total Checked Units", value=total_count, format="number", color="blue"),
            ReportSummary(label="Total Received", value=total_financial_received, format="currency", color="green"),
            ReportSummary(label="Total Outstanding", value=total_financial_remaining, format="currency", color="red"),
        ]

        meta = self._make_meta(
            title="Unit Status & Financial Report",
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
