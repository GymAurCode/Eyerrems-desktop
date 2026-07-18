"""Construction Module — Complete Pydantic Schemas for ERP Construction Management"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator

VALID_PROJECT_STATUSES = {"planning", "active", "on_hold", "completed", "cancelled"}
VALID_PHASE_STATUSES = {"pending", "in_progress", "completed", "delayed"}
VALID_CONTRACT_TYPES = {"fixed", "hourly", "per_unit", "lump_sum"}
VALID_PROCUREMENT_STATUSES = {"requested", "approved", "ordered", "received", "cancelled"}
VALID_EXPENSE_TYPES = {"material", "labor", "equipment", "machinery", "contractor", "utility", "transport", "permit", "govt", "misc"}
VALID_DOC_TYPES = {"blueprint", "contract", "permit", "report", "photo", "other", "legal", "engineering", "architecture", "structural", "electrical", "plumbing", "inspection", "certificate", "video"}
VALID_RESOURCE_TYPES = {"human", "equipment", "material"}
VALID_RESOURCE_AVAILABILITY = {"available", "allocated", "under_maintenance", "reserved", "unavailable"}
VALID_BUDGET_STATUSES = {"draft", "submitted", "approved", "locked"}
VALID_TASK_PRIORITIES = {"low", "medium", "high", "critical"}
VALID_TASK_STATUSES = {"pending", "in_progress", "completed", "delayed", "paused"}
VALID_INSPECTION_RESULTS = {"pending", "passed", "failed", "rework_required"}
VALID_SAFETY_TYPES = {"safety_meeting", "incident", "near_miss", "accident", "violation", "ppe_compliance"}
VALID_MILESTONE_TYPES = {"planning", "budget", "procurement", "execution", "inspection", "completion"}
VALID_MILESTONE_STATUSES = {"upcoming", "in_progress", "completed", "delayed"}
VALID_PHASES = {"planning", "budget_approval", "resource_planning", "procurement", "execution", "finance", "quality_inspection", "documents", "reporting", "completion", "completed"}


# ═══════════════════════════════════════════════════════════════════════════
# PROJECT
# ═══════════════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    name:         str            = Field(..., min_length=1, max_length=255)
    project_code: Optional[str]  = None
    location:     str            = Field(..., min_length=1, max_length=500)
    description:  Optional[str]  = None
    start_date:   date
    expected_end: Optional[date] = None
    status:       str            = Field(default="planning")
    total_budget: Decimal        = Field(default=Decimal("0"), ge=0)
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
    project_code: Optional[str]     = None
    location:     Optional[str]     = None
    description:  Optional[str]     = None
    start_date:   Optional[date]    = None
    expected_end: Optional[date]    = None
    actual_end:   Optional[date]    = None
    status:       Optional[str]     = None
    current_phase: Optional[str]    = None
    total_budget: Optional[Decimal] = Field(None, ge=0)
    town_id:      Optional[int]     = None
    block_id:     Optional[int]     = None

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        if v and v not in VALID_PROJECT_STATUSES:
            raise ValueError(f"status must be one of {VALID_PROJECT_STATUSES}")
        return v

    @field_validator("current_phase")
    @classmethod
    def _phase(cls, v):
        if v and v not in VALID_PHASES:
            raise ValueError(f"current_phase must be one of {VALID_PHASES}")
        return v


class ProjectResponse(BaseModel):
    id:            int
    name:          str
    project_code:  Optional[str]
    location:      str
    description:   Optional[str]
    start_date:    date
    expected_end:  Optional[date]
    actual_end:    Optional[date]
    status:        str
    current_phase: str
    total_budget:  Decimal
    town_id:       Optional[int]
    block_id:      Optional[int]
    created_by:    int
    created_at:    datetime
    updated_at:    datetime

    class Config:
        from_attributes = True


class ProjectSummary(ProjectResponse):
    actual_cost:         Decimal = Decimal("0")
    progress_percentage: float   = 0.0
    phase_count:         int     = 0
    contractor_count:    int     = 0
    task_count:          int     = 0
    completed_tasks:     int     = 0
    delayed_tasks:       int     = 0
    active_workers:      int     = 0


# ═══════════════════════════════════════════════════════════════════════════
# PHASE
# ═══════════════════════════════════════════════════════════════════════════

class PhaseCreate(BaseModel):
    project_id:  int
    name:        str            = Field(..., min_length=1, max_length=255)
    description: Optional[str]  = None
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
    progress_pct: Optional[float] = None


class PhaseResponse(BaseModel):
    id:           int
    project_id:   int
    name:         str
    description:  Optional[str]
    start_date:   date
    end_date:     Optional[date]
    status:       str
    order_index:  int
    progress_pct: float = 0.0
    created_at:   datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# TASK
# ═══════════════════════════════════════════════════════════════════════════

class TaskCreate(BaseModel):
    project_id:          int
    phase_id:            int
    task_number:         Optional[str] = None
    name:                str            = Field(..., min_length=1, max_length=255)
    description:         Optional[str]  = None
    priority:            str            = Field(default="medium")
    status:              str            = Field(default="pending")
    estimated_cost:      Optional[Decimal] = None
    estimated_duration:  Optional[int]  = None
    start_date:          Optional[date] = None
    end_date:            Optional[date] = None
    assigned_engineer_id: Optional[int] = None
    assigned_supervisor_id: Optional[int] = None
    risk_level:          Optional[str]  = None
    remarks:             Optional[str]  = None

    @field_validator("priority")
    @classmethod
    def _prio(cls, v):
        if v not in VALID_TASK_PRIORITIES:
            raise ValueError(f"priority must be one of {VALID_TASK_PRIORITIES}")
        return v

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        if v not in VALID_TASK_STATUSES:
            raise ValueError(f"status must be one of {VALID_TASK_STATUSES}")
        return v


class TaskUpdate(BaseModel):
    name:                Optional[str]      = None
    description:         Optional[str]      = None
    priority:            Optional[str]      = None
    status:              Optional[str]      = None
    estimated_cost:      Optional[Decimal]  = None
    estimated_duration:  Optional[int]      = None
    start_date:          Optional[date]     = None
    end_date:            Optional[date]     = None
    actual_start_date:   Optional[date]     = None
    actual_end_date:     Optional[date]     = None
    assigned_engineer_id: Optional[int]     = None
    assigned_supervisor_id: Optional[int]   = None
    risk_level:          Optional[str]      = None
    remarks:             Optional[str]      = None
    progress_pct:        Optional[float]    = None
    is_delayed:          Optional[bool]     = None
    delay_reason:        Optional[str]      = None
    phase_id:            Optional[int]      = None


class TaskResponse(BaseModel):
    id:                  int
    project_id:          int
    phase_id:            int
    task_number:         Optional[str]
    name:                str
    description:         Optional[str]
    priority:            str
    status:              str
    estimated_cost:      Optional[Decimal]
    estimated_duration:  Optional[int]
    start_date:          Optional[date]
    end_date:            Optional[date]
    actual_start_date:   Optional[date]
    actual_end_date:     Optional[date]
    assigned_engineer_id: Optional[int]
    assigned_supervisor_id: Optional[int]
    risk_level:          Optional[str]
    remarks:             Optional[str]
    progress_pct:        float
    is_delayed:          bool
    delay_reason:        Optional[str]
    created_at:          datetime
    updated_at:          datetime

    class Config:
        from_attributes = True


class TaskDetailResponse(TaskResponse):
    phase_name: Optional[str] = None
    dependencies: list = []


class TaskDependencyCreate(BaseModel):
    task_id:            int
    depends_on_task_id: int
    dependency_type:    str = Field(default="finish_to_start")


class TaskDependencyResponse(BaseModel):
    id:                int
    task_id:           int
    depends_on_task_id: int
    dependency_type:   str

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# BUDGET
# ═══════════════════════════════════════════════════════════════════════════

class BudgetCreate(BaseModel):
    project_id:      int
    material_cost:   Decimal = Field(default=Decimal("0"), ge=0)
    labor_cost:      Decimal = Field(default=Decimal("0"), ge=0)
    equipment_cost:  Decimal = Field(default=Decimal("0"), ge=0)
    machinery_cost:  Decimal = Field(default=Decimal("0"), ge=0)
    contractor_cost: Decimal = Field(default=Decimal("0"), ge=0)
    utility_cost:    Decimal = Field(default=Decimal("0"), ge=0)
    transport_cost:  Decimal = Field(default=Decimal("0"), ge=0)
    permit_fees:     Decimal = Field(default=Decimal("0"), ge=0)
    govt_charges:    Decimal = Field(default=Decimal("0"), ge=0)
    misc_cost:       Decimal = Field(default=Decimal("0"), ge=0)


class BudgetUpdate(BaseModel):
    material_cost:   Optional[Decimal] = Field(None, ge=0)
    labor_cost:      Optional[Decimal] = Field(None, ge=0)
    equipment_cost:  Optional[Decimal] = Field(None, ge=0)
    machinery_cost:  Optional[Decimal] = Field(None, ge=0)
    contractor_cost: Optional[Decimal] = Field(None, ge=0)
    utility_cost:    Optional[Decimal] = Field(None, ge=0)
    transport_cost:  Optional[Decimal] = Field(None, ge=0)
    permit_fees:     Optional[Decimal] = Field(None, ge=0)
    govt_charges:    Optional[Decimal] = Field(None, ge=0)
    misc_cost:       Optional[Decimal] = Field(None, ge=0)


class BudgetResponse(BaseModel):
    id:              int
    project_id:      int
    status:          str
    material_cost:   Decimal
    labor_cost:      Decimal
    equipment_cost:  Decimal
    machinery_cost:  Decimal
    contractor_cost: Decimal
    utility_cost:    Decimal
    transport_cost:  Decimal
    permit_fees:     Decimal
    govt_charges:    Decimal
    misc_cost:       Decimal
    total_cost:      Decimal
    approved_by:     Optional[int]
    approved_at:     Optional[datetime]
    created_at:      datetime
    updated_at:      datetime

    class Config:
        from_attributes = True


class BudgetStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _status(cls, v):
        if v not in VALID_BUDGET_STATUSES:
            raise ValueError(f"status must be one of {VALID_BUDGET_STATUSES}")
        return v


# ═══════════════════════════════════════════════════════════════════════════
# RESOURCES
# ═══════════════════════════════════════════════════════════════════════════

class ResourceItemCreate(BaseModel):
    type:           str
    name:           str            = Field(..., min_length=1, max_length=255)
    code:           Optional[str]  = None
    description:    Optional[str]  = None
    unit:           Optional[str]  = None
    unit_cost:      Optional[Decimal] = None
    category:       Optional[str]  = None
    availability:   str            = Field(default="available")
    min_stock_level: Optional[Decimal] = None
    current_stock:  Optional[Decimal] = None
    reorder_point:  Optional[Decimal] = None

    @field_validator("type")
    @classmethod
    def _type(cls, v):
        if v not in VALID_RESOURCE_TYPES:
            raise ValueError(f"type must be one of {VALID_RESOURCE_TYPES}")
        return v

    @field_validator("availability")
    @classmethod
    def _avail(cls, v):
        if v not in VALID_RESOURCE_AVAILABILITY:
            raise ValueError(f"availability must be one of {VALID_RESOURCE_AVAILABILITY}")
        return v


class ResourceItemUpdate(BaseModel):
    name:           Optional[str]     = None
    description:    Optional[str]     = None
    unit:           Optional[str]     = None
    unit_cost:      Optional[Decimal] = None
    category:       Optional[str]     = None
    availability:   Optional[str]     = None
    min_stock_level: Optional[Decimal] = None
    current_stock:  Optional[Decimal] = None
    reorder_point:  Optional[Decimal] = None


class ResourceItemResponse(BaseModel):
    id:              int
    type:            str
    name:            str
    code:            Optional[str]
    description:     Optional[str]
    unit:            Optional[str]
    unit_cost:       Optional[Decimal]
    category:        Optional[str]
    availability:    str
    min_stock_level: Optional[Decimal]
    current_stock:   Optional[Decimal]
    reorder_point:   Optional[Decimal]
    is_active:       bool
    created_at:      datetime

    class Config:
        from_attributes = True


class ResourceAllocationCreate(BaseModel):
    project_id:  int
    resource_id: int
    task_id:     Optional[int] = None
    quantity:    Decimal = Field(default=Decimal("1"), gt=0)
    start_date:  Optional[date] = None
    end_date:    Optional[date] = None
    notes:       Optional[str] = None


class ResourceAllocationResponse(BaseModel):
    id:         int
    project_id: int
    resource_id: int
    task_id:    Optional[int]
    quantity:   Decimal
    start_date: Optional[date]
    end_date:   Optional[date]
    status:     str
    notes:      Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# CONTRACTOR
# ═══════════════════════════════════════════════════════════════════════════

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


# ═══════════════════════════════════════════════════════════════════════════
# PROCUREMENT (Legacy)
# ═══════════════════════════════════════════════════════════════════════════

class ProcurementCreate(BaseModel):
    project_id:  int
    item_name:   str            = Field(..., min_length=1, max_length=255)
    description: Optional[str]  = None
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


# ═══════════════════════════════════════════════════════════════════════════
# PURCHASE REQUEST / ORDER
# ═══════════════════════════════════════════════════════════════════════════

class PurchaseRequestCreate(BaseModel):
    project_id:  int
    title:       str = Field(..., min_length=1)
    description: Optional[str] = None
    notes:       Optional[str] = None


class PurchaseRequestItemCreate(BaseModel):
    material_id:   Optional[int] = None
    name:          str
    quantity:      Decimal
    unit:          Optional[str] = None
    estimated_cost: Optional[Decimal] = None
    total_cost:    Optional[Decimal] = None


class PurchaseRequestResponse(BaseModel):
    id:           int
    project_id:   int
    pr_number:    Optional[str]
    title:        str
    description:  Optional[str]
    status:       str
    requested_by: Optional[int]
    approved_by:  Optional[int]
    requested_at: datetime
    approved_at:  Optional[datetime]
    notes:        Optional[str]
    total_amount: Optional[Decimal]
    created_at:   datetime

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    project_id:      int
    request_id:      Optional[int] = None
    vendor_id:       Optional[int] = None
    vendor_name:     Optional[str] = None
    title:           str = Field(..., min_length=1)
    order_date:      Optional[date] = None
    delivery_date:   Optional[date] = None
    delivery_address: Optional[str] = None
    terms:           Optional[str] = None
    notes:           Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    id:              int
    project_id:      int
    po_number:       Optional[str]
    request_id:      Optional[int]
    vendor_id:       Optional[int]
    vendor_name:     Optional[str]
    title:           str
    status:          str
    order_date:      Optional[date]
    delivery_date:   Optional[date]
    delivery_address: Optional[str]
    subtotal:        Optional[Decimal]
    tax_amount:      Optional[Decimal]
    total_amount:    Optional[Decimal]
    notes:           Optional[str]
    created_by:      Optional[int]
    created_at:      datetime

    class Config:
        from_attributes = True


class VendorCreate(BaseModel):
    name:             str = Field(..., min_length=1)
    contact_person:   Optional[str] = None
    phone:            Optional[str] = None
    email:            Optional[str] = None
    address:          Optional[str] = None
    payment_terms:    Optional[str] = None
    notes:            Optional[str] = None


class VendorResponse(BaseModel):
    id:               int
    name:             str
    contact_person:   Optional[str]
    phone:            Optional[str]
    email:            Optional[str]
    address:          Optional[str]
    payment_terms:    Optional[str]
    performance_rating: Optional[int]
    is_active:        bool
    notes:            Optional[str]
    created_at:       datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# GOODS RECEIPT NOTE
# ═══════════════════════════════════════════════════════════════════════════

class GoodsReceiptCreate(BaseModel):
    project_id:    int
    po_id:         Optional[int] = None
    received_date: date
    vendor_name:   Optional[str] = None
    notes:         Optional[str] = None


class GRNItemCreate(BaseModel):
    material_id: Optional[int] = None
    name:        str
    quantity:    Decimal
    unit:        Optional[str] = None
    unit_price:  Optional[Decimal] = None
    condition:   Optional[str] = None


class GoodsReceiptResponse(BaseModel):
    id:             int
    project_id:     int
    grn_number:     Optional[str]
    po_id:          Optional[int]
    received_date:  date
    received_by:    Optional[int]
    vendor_name:    Optional[str]
    notes:          Optional[str]
    status:         str
    created_at:     datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# DAILY PROGRESS
# ═══════════════════════════════════════════════════════════════════════════

class DailyProgressCreate(BaseModel):
    project_id:          int
    phase_id:            Optional[int]  = None
    task_id:             Optional[int]  = None
    date:                date
    work_done:           str            = Field(..., min_length=1)
    progress_percentage: float          = Field(..., ge=0, le=100)
    workers_count:       Optional[int]  = Field(None, ge=0)
    weather:             Optional[str]  = None
    issues:              Optional[str]  = None
    accidents:           Optional[str]  = None
    delay_reasons:       Optional[str]  = None
    site_notes:          Optional[str]  = None


class DailyProgressUpdate(BaseModel):
    work_done:           Optional[str]   = None
    progress_percentage: Optional[float] = Field(None, ge=0, le=100)
    workers_count:       Optional[int]   = None
    weather:             Optional[str]   = None
    issues:              Optional[str]   = None
    accidents:           Optional[str]   = None
    delay_reasons:       Optional[str]   = None
    site_notes:          Optional[str]   = None
    phase_id:            Optional[int]   = None
    task_id:             Optional[int]   = None


class DailyProgressResponse(BaseModel):
    id:                  int
    project_id:          int
    phase_id:            Optional[int]
    task_id:             Optional[int]
    date:                date
    work_done:           str
    progress_percentage: float
    workers_count:       Optional[int]
    weather:             Optional[str]
    issues:              Optional[str]
    accidents:           Optional[str]
    delay_reasons:       Optional[str]
    site_notes:          Optional[str]
    reported_by:         Optional[int]
    created_at:          datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# EXPENSE
# ═══════════════════════════════════════════════════════════════════════════

class ConstructionExpenseCreate(BaseModel):
    project_id:   int
    amount:       Decimal        = Field(..., gt=0)
    expense_type: str
    description:  str            = Field(..., min_length=1, max_length=500)
    reference_id: Optional[str]  = None
    date:         date
    account_id:   Optional[int]  = None
    paid_from:    Optional[str]  = None

    @field_validator("expense_type")
    @classmethod
    def _etype(cls, v: str) -> str:
        if v not in VALID_EXPENSE_TYPES:
            raise ValueError(f"expense_type must be one of {VALID_EXPENSE_TYPES}")
        return v


class ConstructionExpenseUpdate(BaseModel):
    amount:       Optional[Decimal]  = None
    expense_type: Optional[str]      = None
    description:  Optional[str]      = None
    reference_id: Optional[str]      = None
    date:         Optional[date]     = None


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


# ═══════════════════════════════════════════════════════════════════════════
# QUALITY INSPECTION
# ═══════════════════════════════════════════════════════════════════════════

class QualityInspectionCreate(BaseModel):
    project_id:      int
    phase_id:        Optional[int] = None
    task_id:         Optional[int] = None
    inspection_type: str
    inspector_name:  Optional[str] = None
    inspection_date: date
    checklist:       Optional[str] = None
    remarks:         Optional[str] = None


class QualityInspectionUpdate(BaseModel):
    result:          Optional[str] = None
    remarks:         Optional[str] = None
    status:          Optional[str] = None
    inspector_name:  Optional[str] = None
    checklist:       Optional[str] = None

    @field_validator("result")
    @classmethod
    def _result(cls, v):
        if v and v not in VALID_INSPECTION_RESULTS:
            raise ValueError(f"result must be one of {VALID_INSPECTION_RESULTS}")
        return v


class QualityInspectionResponse(BaseModel):
    id:              int
    project_id:      int
    phase_id:        Optional[int]
    task_id:         Optional[int]
    inspection_type: str
    inspector_name:  Optional[str]
    inspector_id:    Optional[int]
    inspection_date: date
    checklist:       Optional[str]
    result:          str
    remarks:         Optional[str]
    photos:          Optional[str]
    status:          str
    created_at:      datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# SAFETY
# ═══════════════════════════════════════════════════════════════════════════

class SafetyIncidentCreate(BaseModel):
    project_id:      int
    incident_type:   str
    title:           str            = Field(..., min_length=1)
    description:     Optional[str]  = None
    incident_date:   date
    severity:        Optional[str]  = None
    location:        Optional[str]  = None
    affected_persons: Optional[int] = None
    corrective_action: Optional[str] = None

    @field_validator("incident_type")
    @classmethod
    def _type(cls, v):
        if v not in VALID_SAFETY_TYPES:
            raise ValueError(f"incident_type must be one of {VALID_SAFETY_TYPES}")
        return v


class SafetyIncidentUpdate(BaseModel):
    title:            Optional[str]  = None
    description:      Optional[str]  = None
    severity:         Optional[str]  = None
    corrective_action: Optional[str] = None
    status:           Optional[str]  = None


class SafetyIncidentResponse(BaseModel):
    id:              int
    project_id:      int
    incident_type:   str
    title:           str
    description:     Optional[str]
    incident_date:   date
    severity:        Optional[str]
    reported_by:     Optional[int]
    location:        Optional[str]
    affected_persons: Optional[int]
    corrective_action: Optional[str]
    status:          str
    closed_at:       Optional[datetime]
    created_at:      datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# DOCUMENT
# ═══════════════════════════════════════════════════════════════════════════

class DocumentResponse(BaseModel):
    id:          int
    project_id:  int
    folder:      Optional[str]
    name:        str
    file_url:    str
    doc_type:    str
    file_size:   Optional[int]
    version:     int
    tags:        Optional[str]
    uploaded_by: Optional[int]
    created_at:  datetime

    class Config:
        from_attributes = True


class DocumentFolder(BaseModel):
    name: str
    path: str


# ═══════════════════════════════════════════════════════════════════════════
# MILESTONE
# ═══════════════════════════════════════════════════════════════════════════

class MilestoneCreate(BaseModel):
    project_id:    int
    name:          str
    description:   Optional[str] = None
    milestone_type: str
    target_date:   Optional[date] = None
    order_index:   int = Field(default=0, ge=0)

    @field_validator("milestone_type")
    @classmethod
    def _type(cls, v):
        if v not in VALID_MILESTONE_TYPES:
            raise ValueError(f"milestone_type must be one of {VALID_MILESTONE_TYPES}")
        return v


class MilestoneUpdate(BaseModel):
    name:          Optional[str] = None
    description:   Optional[str] = None
    status:        Optional[str] = None
    target_date:   Optional[date] = None
    completed_date: Optional[date] = None


class MilestoneResponse(BaseModel):
    id:             int
    project_id:     int
    name:           str
    description:    Optional[str]
    milestone_type: str
    target_date:    Optional[date]
    completed_date: Optional[date]
    status:         str
    order_index:    int
    created_at:     datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# NOTIFICATION
# ═══════════════════════════════════════════════════════════════════════════

class NotificationResponse(BaseModel):
    id:               int
    project_id:       int
    user_id:          Optional[int]
    title:            str
    message:          Optional[str]
    notification_type: str
    reference_type:   Optional[str]
    reference_id:     Optional[int]
    is_read:          bool
    created_at:       datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# REPORT / DASHBOARD
# ═══════════════════════════════════════════════════════════════════════════

class BudgetVsActual(BaseModel):
    project_id:           int
    project_name:         str
    total_budget:         Decimal
    budgeted_material:    Decimal
    budgeted_labor:       Decimal
    budgeted_equipment:   Decimal
    budgeted_machinery:   Decimal = Decimal("0")
    budgeted_contractor:  Decimal = Decimal("0")
    budgeted_utility:     Decimal = Decimal("0")
    budgeted_transport:   Decimal = Decimal("0")
    budgeted_permit:      Decimal = Decimal("0")
    budgeted_govt:        Decimal = Decimal("0")
    budgeted_misc:        Decimal
    actual_material:      Decimal
    actual_labor:         Decimal
    actual_equipment:     Decimal
    actual_machinery:     Decimal = Decimal("0")
    actual_contractor:    Decimal = Decimal("0")
    actual_utility:       Decimal = Decimal("0")
    actual_transport:     Decimal = Decimal("0")
    actual_permit:        Decimal = Decimal("0")
    actual_govt:          Decimal = Decimal("0")
    actual_misc:          Decimal
    actual_total:         Decimal
    variance:             Decimal
    variance_pct:         float
    latest_progress:      float
    procurement_total:    Decimal
    procurement_received: Decimal


class DashboardStatsResponse(BaseModel):
    total_projects:        int = 0
    active_projects:      int = 0
    completed_projects:    int = 0
    delayed_projects:      int = 0
    total_budget:          float = 0
    total_expenses:        float = 0
    remaining_budget:      float = 0
    workers_on_site:       int = 0
    equipment_active:      int = 0
    purchase_orders_pending: int = 0
    invoices_pending:      int = 0
    quality_failures:      int = 0
    safety_incidents:      int = 0
    avg_progress_pct:      float = 0
    budget_used_pct:       float = 0
    budget_remaining_pct:  float = 0


class ProjectReportResponse(BaseModel):
    project:          ProjectResponse
    budget:           Optional[BudgetResponse]
    budget_vs_actual: BudgetVsActual
    phases:           list[PhaseResponse]
    tasks:            list[TaskResponse] = []
    contractors:      list[ProjectContractorResponse]
    recent_progress:  list[DailyProgressResponse]
    procurement_summary: dict
    expense_by_type:  dict
    inspections:      list = []
    safety_items:     list = []
    milestones:       list = []


# ═══════════════════════════════════════════════════════════════════════════
# VENDOR PAYMENT
# ═══════════════════════════════════════════════════════════════════════════

class VendorPaymentCreate(BaseModel):
    project_id:    int
    vendor_id:     Optional[int] = None
    vendor_name:   Optional[str] = None
    amount:        Decimal = Field(..., gt=0)
    payment_date:  date
    payment_method: Optional[str] = None
    reference:     Optional[str] = None
    notes:         Optional[str] = None


class VendorPaymentResponse(BaseModel):
    id:            int
    project_id:    int
    vendor_id:     Optional[int]
    vendor_name:   Optional[str]
    amount:        Decimal
    payment_date:  date
    payment_method: Optional[str]
    reference:     Optional[str]
    notes:         Optional[str]
    status:        str
    created_at:    datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# PROPERTY INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════

class ProjectCompletionCheck(BaseModel):
    tasks_completed:     bool = False
    inspections_passed:  bool = False
    no_pending_orders:   bool = False
    no_pending_payments: bool = False
    no_quality_issues:   bool = False
    no_safety_issues:    bool = False
    docs_uploaded:       bool = False
    completion_approved: bool = False
    all_checks_passed:   bool = False
    total_checks:        int = 8
    passed_checks:       int = 0


class PropertyConversionRequest(BaseModel):
    project_id:     int
    property_name:  Optional[str] = None
    property_type:  Optional[str] = None
    num_buildings:  int = Field(default=1, ge=1)
    floors_per_building: int = Field(default=1, ge=1)
    units_per_floor: int = Field(default=1, ge=1)
    unit_type:      Optional[str] = None
    price_per_unit: Optional[Decimal] = None
