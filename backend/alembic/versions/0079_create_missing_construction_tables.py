"""Create missing construction sub-tables not created by prior migrations.

Creates:
  con_resource_types, con_units, con_resource_items, con_vendors,
  construction_tasks, construction_task_dependencies, construction_task_materials,
  con_resource_allocations, con_resource_usage_logs,
  con_purchase_requests, con_purchase_request_items,
  con_purchase_orders, con_purchase_order_items,
  con_goods_receipt_notes, con_grn_items,
  con_vendor_payments,
  con_quality_inspections, con_inspection_checklist_items,
  con_safety_incidents,
  con_project_milestones, con_notifications

Revision ID: 0079
Revises: 0076
Create Date: 2026-07-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "0079"
down_revision: Union[str, None] = "0076"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    # ── Lookup / Reference Tables ──────────────────────────────────────────
    if not _table_exists("con_resource_types"):
        op.create_table(
            "con_resource_types",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(100), unique=True, nullable=False),
            sa.Column("category", sa.String(30), nullable=False),
        )

    if not _table_exists("con_units"):
        op.create_table(
            "con_units",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(50), unique=True, nullable=False),
        )

    # ── Resources ─────────────────────────────────────────────────────────
    if not _table_exists("con_resource_items"):
        op.create_table(
            "con_resource_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("type", sa.String(30), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("code", sa.String(50), nullable=True),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("unit", sa.String(30), nullable=True),
            sa.Column("unit_cost", sa.Numeric(12, 2), nullable=True),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column("availability", sa.String(30), nullable=False, server_default=sa.text("'available'")),
            sa.Column("min_stock_level", sa.Numeric(12, 2), nullable=True),
            sa.Column("current_stock", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")),
            sa.Column("reorder_point", sa.Numeric(12, 2), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Vendors ────────────────────────────────────────────────────────────
    if not _table_exists("con_vendors"):
        op.create_table(
            "con_vendors",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("contact_person", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(50), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("payment_terms", sa.String(255), nullable=True),
            sa.Column("performance_rating", sa.Integer(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Tasks ─────────────────────────────────────────────────────────────
    if not _table_exists("construction_tasks"):
        op.create_table(
            "construction_tasks",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("phase_id", sa.Integer(), sa.ForeignKey("construction_phases.id"), nullable=False, index=True),
            sa.Column("task_number", sa.String(50), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("priority", sa.String(20), nullable=False, server_default=sa.text("'medium'")),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("estimated_cost", sa.Numeric(14, 2), nullable=True),
            sa.Column("estimated_duration", sa.Integer(), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("actual_start_date", sa.Date(), nullable=True),
            sa.Column("actual_end_date", sa.Date(), nullable=True),
            sa.Column("assigned_engineer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("assigned_supervisor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("risk_level", sa.String(20), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("progress_pct", sa.Float(), nullable=False, server_default=sa.text("0")),
            sa.Column("is_delayed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("delay_reason", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("construction_task_dependencies"):
        op.create_table(
            "construction_task_dependencies",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("task_id", sa.Integer(), sa.ForeignKey("construction_tasks.id"), nullable=False, index=True),
            sa.Column("depends_on_task_id", sa.Integer(), sa.ForeignKey("construction_tasks.id"), nullable=False),
            sa.Column("dependency_type", sa.String(20), nullable=False, server_default=sa.text("'finish_to_start'")),
        )

    if not _table_exists("construction_task_materials"):
        op.create_table(
            "construction_task_materials",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("task_id", sa.Integer(), sa.ForeignKey("construction_tasks.id"), nullable=False, index=True),
            sa.Column("material_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit", sa.String(30), nullable=True),
        )

    # ── Resource Allocations ──────────────────────────────────────────────
    if not _table_exists("con_resource_allocations"):
        op.create_table(
            "con_resource_allocations",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("resource_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=False),
            sa.Column("task_id", sa.Integer(), sa.ForeignKey("construction_tasks.id"), nullable=True),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False, server_default=sa.text("1")),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'allocated'")),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("con_resource_usage_logs"):
        op.create_table(
            "con_resource_usage_logs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False),
            sa.Column("resource_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=False),
            sa.Column("date", sa.Date(), nullable=False),
            sa.Column("quantity_used", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0")),
            sa.Column("quantity_consumed", sa.Numeric(12, 2), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Procurement / Purchasing ──────────────────────────────────────────
    if not _table_exists("con_purchase_requests"):
        op.create_table(
            "con_purchase_requests",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("pr_number", sa.String(50), unique=True, nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'draft'")),
            sa.Column("requested_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("approved_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("requested_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("approved_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("total_amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("con_purchase_request_items"):
        op.create_table(
            "con_purchase_request_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("request_id", sa.Integer(), sa.ForeignKey("con_purchase_requests.id"), nullable=False),
            sa.Column("material_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit", sa.String(30), nullable=True),
            sa.Column("estimated_cost", sa.Numeric(12, 2), nullable=True),
            sa.Column("total_cost", sa.Numeric(14, 2), nullable=True),
        )

    if not _table_exists("con_purchase_orders"):
        op.create_table(
            "con_purchase_orders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("po_number", sa.String(50), unique=True, nullable=True),
            sa.Column("request_id", sa.Integer(), sa.ForeignKey("con_purchase_requests.id"), nullable=True),
            sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("con_vendors.id"), nullable=True),
            sa.Column("vendor_name", sa.String(255), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'draft'")),
            sa.Column("order_date", sa.Date(), nullable=True),
            sa.Column("delivery_date", sa.Date(), nullable=True),
            sa.Column("delivery_address", sa.Text(), nullable=True),
            sa.Column("terms", sa.Text(), nullable=True),
            sa.Column("subtotal", sa.Numeric(14, 2), nullable=True),
            sa.Column("tax_amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("total_amount", sa.Numeric(14, 2), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("con_purchase_order_items"):
        op.create_table(
            "con_purchase_order_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("con_purchase_orders.id"), nullable=False),
            sa.Column("material_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit", sa.String(30), nullable=True),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=True),
            sa.Column("total_price", sa.Numeric(14, 2), nullable=True),
            sa.Column("received_qty", sa.Numeric(12, 2), nullable=True, server_default=sa.text("0")),
        )

    if not _table_exists("con_goods_receipt_notes"):
        op.create_table(
            "con_goods_receipt_notes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("grn_number", sa.String(50), unique=True, nullable=True),
            sa.Column("po_id", sa.Integer(), sa.ForeignKey("con_purchase_orders.id"), nullable=True),
            sa.Column("received_date", sa.Date(), nullable=False),
            sa.Column("received_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("vendor_name", sa.String(255), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'received'")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("con_grn_items"):
        op.create_table(
            "con_grn_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("grn_id", sa.Integer(), sa.ForeignKey("con_goods_receipt_notes.id"), nullable=False),
            sa.Column("material_id", sa.Integer(), sa.ForeignKey("con_resource_items.id"), nullable=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("quantity", sa.Numeric(12, 2), nullable=False),
            sa.Column("unit", sa.String(30), nullable=True),
            sa.Column("unit_price", sa.Numeric(12, 2), nullable=True),
            sa.Column("total_price", sa.Numeric(14, 2), nullable=True),
            sa.Column("condition", sa.String(50), nullable=True),
        )

    # ── Vendor Payments ───────────────────────────────────────────────────
    if not _table_exists("con_vendor_payments"):
        op.create_table(
            "con_vendor_payments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False),
            sa.Column("vendor_id", sa.Integer(), sa.ForeignKey("con_vendors.id"), nullable=True),
            sa.Column("vendor_name", sa.String(255), nullable=True),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("payment_date", sa.Date(), nullable=False),
            sa.Column("payment_method", sa.String(30), nullable=True),
            sa.Column("reference", sa.String(100), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Quality Inspection ────────────────────────────────────────────────
    if not _table_exists("con_quality_inspections"):
        op.create_table(
            "con_quality_inspections",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("phase_id", sa.Integer(), sa.ForeignKey("construction_phases.id"), nullable=True),
            sa.Column("task_id", sa.Integer(), sa.ForeignKey("construction_tasks.id"), nullable=True),
            sa.Column("inspection_type", sa.String(100), nullable=False),
            sa.Column("inspector_name", sa.String(255), nullable=True),
            sa.Column("inspector_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("inspection_date", sa.Date(), nullable=False),
            sa.Column("checklist", sa.Text(), nullable=True),
            sa.Column("result", sa.String(30), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("photos", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    if not _table_exists("con_inspection_checklist_items"):
        op.create_table(
            "con_inspection_checklist_items",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("inspection_id", sa.Integer(), sa.ForeignKey("con_quality_inspections.id"), nullable=False),
            sa.Column("item_name", sa.String(255), nullable=False),
            sa.Column("is_checked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("remarks", sa.Text(), nullable=True),
        )

    # ── Safety ────────────────────────────────────────────────────────────
    if not _table_exists("con_safety_incidents"):
        op.create_table(
            "con_safety_incidents",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("incident_type", sa.String(50), nullable=False),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("incident_date", sa.Date(), nullable=False),
            sa.Column("severity", sa.String(20), nullable=True),
            sa.Column("reported_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("location", sa.String(255), nullable=True),
            sa.Column("affected_persons", sa.Integer(), nullable=True),
            sa.Column("corrective_action", sa.Text(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'open'")),
            sa.Column("closed_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Milestones ────────────────────────────────────────────────────────
    if not _table_exists("con_project_milestones"):
        op.create_table(
            "con_project_milestones",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("milestone_type", sa.String(50), nullable=False),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("completed_date", sa.Date(), nullable=True),
            sa.Column("status", sa.String(30), nullable=False, server_default=sa.text("'upcoming'")),
            sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )

    # ── Notifications ─────────────────────────────────────────────────────
    if not _table_exists("con_notifications"):
        op.create_table(
            "con_notifications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("project_id", sa.Integer(), sa.ForeignKey("construction_projects.id"), nullable=False, index=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("title", sa.String(255), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("notification_type", sa.String(50), nullable=False),
            sa.Column("reference_type", sa.String(50), nullable=True),
            sa.Column("reference_id", sa.Integer(), nullable=True),
            sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    tables = [
        "con_notifications",
        "con_project_milestones",
        "con_safety_incidents",
        "con_inspection_checklist_items",
        "con_quality_inspections",
        "con_vendor_payments",
        "con_grn_items",
        "con_goods_receipt_notes",
        "con_purchase_order_items",
        "con_purchase_orders",
        "con_purchase_request_items",
        "con_purchase_requests",
        "con_resource_usage_logs",
        "con_resource_allocations",
        "construction_task_materials",
        "construction_task_dependencies",
        "construction_tasks",
        "con_vendors",
        "con_resource_items",
        "con_units",
        "con_resource_types",
    ]
    for tbl in tables:
        if _table_exists(tbl):
            op.drop_table(tbl)
