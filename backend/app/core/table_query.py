"""Reusable backend query helper for standardizing table pagination, search, and filtering."""
from datetime import datetime, date, time, timedelta
from typing import Any, List, Tuple
from sqlalchemy import or_, and_, cast, String
from sqlalchemy.orm import Query


def apply_table_filters(
    query: Query,
    model: Any,
    limit: int | None = None,
    offset: int | None = None,
    search: str | None = None,
    search_fields: List[Any] | None = None,
    date_filter: str | None = None,
    date_field: Any | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    property_type: str | None = None,
    property_status: str | None = None,
) -> Tuple[Query, int]:
    """
    Applies standard filtering, searching, and pagination to an SQLAlchemy query.
    Returns a tuple of (filtered_paginated_query, total_count_before_pagination).
    """
    # 1. Property Type and Status Filters
    if property_type and hasattr(model, 'type'):
        query = query.filter(model.type == property_type)
    elif property_type and hasattr(model, 'property_type'):
        # Some schemas might use property_type
        query = query.filter(model.property_type == property_type)

    if property_status and hasattr(model, 'status'):
        query = query.filter(model.status == property_status)

    # 2. Universal Date Range Filters
    if date_field is not None:
        today = date.today()
        start_dt = None
        end_dt = None

        if date_filter == "today":
            start_dt = datetime.combine(today, time.min)
            end_dt = datetime.combine(today, time.max)
        elif date_filter == "week":
            # Past 7 days
            start_dt = datetime.combine(today - timedelta(days=7), time.min)
            end_dt = datetime.combine(today, time.max)
        elif date_filter == "month":
            # Past 30 days
            start_dt = datetime.combine(today - timedelta(days=30), time.min)
            end_dt = datetime.combine(today, time.max)
        elif date_filter == "year":
            # Past 365 days
            start_dt = datetime.combine(today - timedelta(days=365), time.min)
            end_dt = datetime.combine(today, time.max)
        elif date_filter == "custom":
            if start_date:
                start_dt = datetime.combine(start_date, time.min)
            if end_date:
                end_dt = datetime.combine(end_date, time.max)

        if start_dt is not None:
            query = query.filter(date_field >= start_dt)
        if end_dt is not None:
            query = query.filter(date_field <= end_dt)

    # 3. Search query (multi-column)
    if search and search.strip() and search_fields:
        search_val = f"%{search.strip()}%"
        or_conds = []
        for field in search_fields:
            # Cast field to string to allow numeric search
            or_conds.append(cast(field, String).ilike(search_val))
        query = query.filter(or_(*or_conds))

    # 4. Count total matching rows BEFORE pagination
    total_count = query.count()

    # 5. Apply pagination (limit / offset)
    if offset is not None:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)

    return query, total_count
