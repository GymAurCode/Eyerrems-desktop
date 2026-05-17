"""Construction Module — Pydantic Schemas"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

VALID_PROJECT_STATUSES  = {"planning", "active", "on_hold", "completed", "cancelled"}
VALID_PHASE_STATUSES    = {"pending", "in_progress", "completed"}
VALID_CONTRACT_TYPES    = {"fixed", "hourly", "per_unit", "lump_sum"}
VALID_PROCUREMENT_STATUSES = {"requested", "approved", "ordered", "received", "cancelled"}
VALID_EXPENSE_TYPES     = {"material", "labor", "equipment", "procurement", "misc"}
VALID_DOC_TYPES         = {"blueprint", "contract", "permit", "report", "photo", "other"}


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name:         str            = Field(..., min_length=1, max_length=255)
    location:     str            = Field(..., min_length=1, max_length=500)
    description:  Optional[str] = None
    start_date:   date
    end_date:     Optional[date] = None
    status:       str            = Field(default="planning")
    total_budget: Decimal        = Field(default=Decimal("0"), ge=0)
    # Town hierarchy links (optional)
    town_id:      Optional[int]  = None
    block_id:     Optional[int]  = None

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in VALID_PROJECT_STATUSES:
            raise ValueError(f"status must be one of {VALID_PROJECT_STATUSES}")
        return v


class ProjectUpdate(BaseModel):
    name:         Optional[str]     = Field(None, min_length=1, max_length=255)
    location:     Optional[str]     = None
    description:  Optional[str]     = None
    start_date:   Optional[date]    = None
    end_date:     Optional[date]    = None
    status:       Optional[str]     = None
    total_budget: Optional[Decimal] = Field(None, ge=0)
    town_id:      Optional[int]     = None
    block_id:     Optional[int]     = None

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        if v and v not in VALID_PROJECT_STATUSES:
            raise ValueError(f"status must be one of {VALID_PROJECT_STATUSES}")
        return v


class ProjectResponse(BaseModel):
    id:           int
    name:         str
    location:     str
    description:  Optional[str]
    start_date:   date
    end_date:     Optional[date]
    status:       str
    total_budget: Decimal
    town_id:      Optional[int] = None
    block_id:     Optional[int] = None
    created_by:   int
    created_at:   datetime
    updated_at:   datetime

    class Config:
        from_attributes = True


class ProjectSummary(ProjectResponse):
    actual_cost:         Decimal = Decimal("0")
    progress_percentage: float   = 0.0
    phase_count:         int     = 0
    contractor_count:    int     = 0


# ── Phase ─────────────────────────────────────────────────────────────────────

class PhaseCreate(BaseModel):
    project_id:  int
    name:        str            = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_date:  date
    end_date:    Optional[date] = None
    status:      str            = Field(default="pending")
    order_index: int            = Field(default=0, ge=0)

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in VALID_PHASE_STATUSES:
            raise ValueError(f"status must be one of {VALID_PHASE_STATUSES}")
        return v


class PhaseUpdate(BaseModel):
    name:        Optional[str]  = None
    description: Optional[str]  = None
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    status:      Optional[str]  = None
    order_index: Optional[int]  = None


class PhaseResponse(BaseModel):
    id:          int
    project_id:  int
    name:        str
    description: Optional[str]
    start_date:  date
    end_date:    Optional[date]
    status:      str
    order_index: int
    created_at:  datetime

    class Config:
        from_attributes = True


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetCreate(BaseModel):
    project_id:     int
    material_cost:  Decimal = Field(default=Decimal("0"), ge=0)
    labor_cost:     Decimal = Field(default=Decimal("0"), ge=0)
    equipment_cost: Decimal = Field(default=Decimal("0"), ge=0)
    misc_cost:      Decimal = Field(default=Decimal("0"), ge=0)


class BudgetUpdate(BaseModel):
    material_cost:  Optional[Decimal] = Field(None, ge=0)
    labor_cost:     Optional[Decimal] = Field(None, ge=0)
    equipment_cost: Optional[Decimal] = Field(None, ge=0)
    misc_cost:      Optional[Decimal] = Field(None, ge=0)


class BudgetResponse(BaseModel):
    id:             int
    project_id:     int
    material_cost:  Decimal
    labor_cost:     Decimal
    equipment_cost: Decimal
    misc_cost:      Decimal
    total_cost:     Decimal
    created_at:     datetime
    updated_at:     datetime

    class Config:
        from_attributes = True


# ── Contractor ────────────────────────────────────────────────────────────────

class ContractorCreate(BaseModel):
    name:           str            = Field(..., min_length=1, max_length=255)
    phone:          Optional[str]  = None
    email:          Optional[str]  = None
    company:        Optional[str]  = None
    contract_type:  str
    rate:           Decimal        = Field(default=Decimal("0"), ge=0)
    specialization: Optional[str]  = None
    notes:          Optional[str]  = None

    @field_validator("contract_type")
    @classmethod
    def _ctype(cls, v: str) -> str:
        if v not in VALID_CONTRACT_TYPES:
            raise ValueError(f"contract_type must be one of {VALID_CONTRACT_TYPES}")
        return v


class ContractorUpdate(BaseModel):
    name:           Optional[str]     = None
    phone:          Optional[str]     = None
    email:          Optional[str]     = None
    company:        Optional[str]     = None
    contract_type:  Optional[str]     = None
    rate:           Optional[Decimal] = Field(None, ge=0)
    specialization: Optional[str]     = None
    is_active:      Optional[bool]    = None
    notes:          Optional[str]     = None


class ContractorResponse(BaseModel):
    id:             int
    name:           str
    phone:          Optional[str]
    email:          Optional[str]
    company:        Optional[str]
    contract_type:  str
    rate:           Decimal
    specialization: Optional[str]
    is_active:      bool
    notes:          Optional[str]
    created_at:     datetime

    class Config:
        from_attributes = True


class ProjectContractorCreate(BaseModel):
    project_id:     int
    contractor_id:  int
    role:           Optional[str]     = None
    start_date:     Optional[date]    = None
    end_date:       Optional[date]    = None
    contract_value: Optional[Decimal] = Field(None, ge=0)
    status:         str               = Field(default="active")


class ProjectContractorResponse(BaseModel):
    id:             int
    project_id:     int
    contractor_id:  int
    role:           Optional[str]
    start_date:     Optional[date]
    end_date:       Optional[date]
    contract_value: Optional[Decimal]
    status:         str
    created_at:     datetime
    contractor:     ContractorResponse

    class Config:
        from_attributes = True


# ── Procurement ───────────────────────────────────────────────────────────────

class ProcurementCreate(BaseModel):
    project_id:  int
    item_name:   str            = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    quantity:    Decimal        = Field(default=Decimal("1"), gt=0)
    unit:        Optional[str]  = None
    unit_cost:   Decimal        = Field(default=Decimal("0"), ge=0)
    vendor:      Optional[str]  = None
    notes:       Optional[str]  = None


class ProcurementUpdate(BaseModel):
    item_name:   Optional[str]     = None
    description: Optional[str]     = None
    quantity:    Optional[Decimal] = Field(None, gt=0)
    unit:        Optional[str]     = None
    unit_cost:   Optional[Decimal] = Field(None, ge=0)
    vendor:      Optional[str]     = None
    notes:       Optional[str]     = None


class ProcurementStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in VALID_PROCUREMENT_STATUSES:
            raise ValueError(f"status must be one of {VALID_PROCUREMENT_STATUSES}")
        return v


class ProcurementResponse(BaseModel):
    id:           int
    project_id:   int
    item_name:    str
    description:  Optional[str]
    quantity:     Decimal
    unit:         Optional[str]
    unit_cost:    Decimal
    cost:         Decimal
    vendor:       Optional[str]
    status:       str
    requested_by: Optional[int]
    approved_by:  Optional[int]
    requested_at: datetime
    approved_at:  Optional[datetime]
    received_at:  Optional[datetime]
    notes:        Optional[str]

    class Config:
        from_attributes = True


# ── Daily Progress ────────────────────────────────────────────────────────────

class DailyProgressCreate(BaseModel):
    project_id:          int
    phase_id:            Optional[int]  = None
    date:                date
    work_done:           str            = Field(..., min_length=1)
    progress_percentage: float          = Field(..., ge=0, le=100)
    workers_count:       Optional[int]  = Field(None, ge=0)
    weather:             Optional[str]  = None
    issues:              Optional[str]  = None


class DailyProgressUpdate(BaseModel):
    work_done:           Optional[str]   = None
    progress_percentage: Optional[float] = Field(None, ge=0, le=100)
    workers_count:       Optional[int]   = None
    weather:             Optional[str]   = None
    issues:              Optional[str]   = None
    phase_id:            Optional[int]   = None


class DailyProgressResponse(BaseModel):
    id:                  int
    project_id:          int
    phase_id:            Optional[int]
    date:                date
    work_done:           str
    progress_percentage: float
    workers_count:       Optional[int]
    weather:             Optional[str]
    issues:              Optional[str]
    reported_by:         Optional[int]
    created_at:          datetime

    class Config:
        from_attributes = True


# ── Expense ───────────────────────────────────────────────────────────────────

class ConstructionExpenseCreate(BaseModel):
    project_id:   int
    amount:       Decimal        = Field(..., gt=0)
    expense_type: str
    description:  str            = Field(..., min_length=1, max_length=500)
    reference_id: Optional[str]  = None
    date:         date
    # optional finance integration
    account_id:   Optional[int]  = None
    paid_from:    Optional[str]  = None   # cash | bank

    @field_validator("expense_type")
    @classmethod
    def _etype(cls, v: str) -> str:
        if v not in VALID_EXPENSE_TYPES:
            raise ValueError(f"expense_type must be one of {VALID_EXPENSE_TYPES}")
        return v


class ConstructionExpenseResponse(BaseModel):
    id:           int
    project_id:   int
    expense_id:   Optional[int]
    amount:       Decimal
    expense_type: str
    description:  str
    reference_id: Optional[str]
    date:         date
    created_at:   datetime

    class Config:
        from_attributes = True


# ── Document ──────────────────────────────────────────────────────────────────

class DocumentResponse(BaseModel):
    id:          int
    project_id:  int
    name:        str
    file_url:    str
    doc_type:    str
    file_size:   Optional[int]
    uploaded_by: Optional[int]
    created_at:  datetime

    class Config:
        from_attributes = True


# ── Report ────────────────────────────────────────────────────────────────────

class BudgetVsActual(BaseModel):
    project_id:           int
    project_name:         str
    total_budget:         Decimal
    budgeted_material:    Decimal
    budgeted_labor:       Decimal
    budgeted_equipment:   Decimal
    budgeted_misc:        Decimal
    actual_material:      Decimal
    actual_labor:         Decimal
    actual_equipment:     Decimal
    actual_misc:          Decimal
    actual_total:         Decimal
    variance:             Decimal
    variance_pct:         float
    latest_progress:      float
    procurement_total:    Decimal
    procurement_received: Decimal


class ProjectReportResponse(BaseModel):
    project:          ProjectResponse
    budget:           Optional[BudgetResponse]
    budget_vs_actual: BudgetVsActual
    phases:           list[PhaseResponse]
    contractors:      list[ProjectContractorResponse]
    recent_progress:  list[DailyProgressResponse]
    procurement_summary: dict
    expense_by_type:  dict
