"""Register all import module handlers."""
from app.services.bulk_import.handlers.crm_handlers import get_crm_handlers
from app.services.bulk_import.handlers.property_handlers import get_property_handlers
from app.services.bulk_import.handlers.hr_finance_handlers import get_hr_finance_handlers


def register_all_handlers(registry) -> None:
    for handler in (
        *get_crm_handlers(),
        *get_property_handlers(),
        *get_hr_finance_handlers(),
    ):
        registry.register(handler)
