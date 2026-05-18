"""Bulk import engine package."""
from app.services.bulk_import.registry import import_registry
from app.services.bulk_import.handlers import register_all_handlers

register_all_handlers(import_registry)
