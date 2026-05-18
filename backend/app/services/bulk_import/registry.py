"""Central registry of import module handlers."""
from app.services.bulk_import.types import ImportModuleHandler


class ImportRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, ImportModuleHandler] = {}

    def register(self, handler: ImportModuleHandler) -> None:
        self._handlers[handler.key] = handler

    def get(self, key: str) -> ImportModuleHandler | None:
        return self._handlers.get(key)

    def list_modules(self) -> list[ImportModuleHandler]:
        return sorted(self._handlers.values(), key=lambda h: (h.category, h.label))

    def module_dict(self, handler: ImportModuleHandler) -> dict:
        return {
            "key": handler.key,
            "label": handler.label,
            "description": handler.description,
            "category": handler.category,
            "permission": handler.permission,
            "columns": [
                {
                    "key": c.key,
                    "label": c.label,
                    "required": c.required,
                    "sample": c.sample,
                    "hint": c.hint,
                    "enum_values": c.enum_values,
                }
                for c in handler.columns
            ],
        }


import_registry = ImportRegistry()
