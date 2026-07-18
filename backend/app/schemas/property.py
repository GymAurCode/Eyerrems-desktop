from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel


# ── Property Category ─────────────────────────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str


class CategoryOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


# ── Location ──────────────────────────────────────────────────────────────────
class LocationCreate(BaseModel):
    name: str
    parent_id: int | None = None


class LocationOut(BaseModel):
    id: int
    tid: str
    name: str
    parent_id: int | None
    has_children: bool = False

    class Config:
        from_attributes = True


# ── Amenity ───────────────────────────────────────────────────────────────────
class AmenityCreate(BaseModel):
    name: str


class AmenityOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


# ── Property ──────────────────────────────────────────────────────────────────
class PropertyCreate(BaseModel):
    tid: str | None = None            # user-editable; backend generates if omitted
    name: str | None = None           # defaults to TID
    address: str | None = None
    description: str | None = None
    property_type_option_id: int | None = None
    status: str = "available"
    listing_status: str | None = None
    operational_status: str | None = None
    category_id: int | None = None    # FK to property_categories
    size: str | None = None
    size_unit: str | None = None
    for_sale: bool = False
    sale_price: Decimal | None = None
    # Ownership & Legal
    owner_name: str | None = None
    owner_type: str | None = None
    cnic_ntn: str | None = None
    ownership_pct: Decimal | None = None
    title_deed_number: str | None = None
    registration_date: date | None = None
    mortgage_lien: bool | None = None
    lender_name: str | None = None
    outstanding_amount: Decimal | None = None
    regulatory_authority: str | None = None
    # Pricing
    purchase_price: Decimal | None = None
    current_market_value: Decimal | None = None
    asking_price: Decimal | None = None
    commission_pct: Decimal | None = None
    # COA Linkage
    income_gl_account_id: int | None = None
    expense_gl_account_id: int | None = None
    asset_gl_account_id: int | None = None
    cost_centre: str | None = None
    dealer_id: int | None = None
    year_built: int | None = None
    location_id: int | None = None
    amenity_ids: list[int] = []


class PropertyUpdate(BaseModel):
    tid: str | None = None
    name: str | None = None
    address: str | None = None
    description: str | None = None
    property_type_option_id: int | None = None
    status: str | None = None
    listing_status: str | None = None
    operational_status: str | None = None
    category_id: int | None = None
    size: str | None = None
    size_unit: str | None = None
    for_sale: bool | None = None
    sale_price: Decimal | None = None
    owner_name: str | None = None
    owner_type: str | None = None
    cnic_ntn: str | None = None
    ownership_pct: Decimal | None = None
    title_deed_number: str | None = None
    registration_date: date | None = None
    mortgage_lien: bool | None = None
    lender_name: str | None = None
    outstanding_amount: Decimal | None = None
    regulatory_authority: str | None = None
    purchase_price: Decimal | None = None
    current_market_value: Decimal | None = None
    asking_price: Decimal | None = None
    commission_pct: Decimal | None = None
    income_gl_account_id: int | None = None
    expense_gl_account_id: int | None = None
    asset_gl_account_id: int | None = None
    cost_centre: str | None = None
    dealer_id: int | None = None
    year_built: int | None = None
    location_id: int | None = None
    amenity_ids: list[int] | None = None


class PropertyOut(BaseModel):
    id: int
    tid: str
    name: str
    address: str | None
    description: str | None
    property_type_option_id: int | None
    status: str
    listing_status: str | None = None
    operational_status: str | None = None
    category_id: int | None
    category_name: str | None = None   # resolved from FK for display
    size: str | None
    size_unit: str | None = None
    for_sale: bool
    sale_price: Decimal | None
    owner_name: str | None = None
    owner_type: str | None = None
    cnic_ntn: str | None = None
    ownership_pct: Decimal | None = None
    title_deed_number: str | None = None
    registration_date: date | None = None
    mortgage_lien: bool | None = None
    lender_name: str | None = None
    outstanding_amount: Decimal | None = None
    regulatory_authority: str | None = None
    purchase_price: Decimal | None = None
    current_market_value: Decimal | None = None
    asking_price: Decimal | None = None
    commission_pct: Decimal | None = None
    income_gl_account_id: int | None = None
    income_gl_account_name: str | None = None
    income_gl_account_code: str | None = None
    expense_gl_account_id: int | None = None
    expense_gl_account_name: str | None = None
    expense_gl_account_code: str | None = None
    asset_gl_account_id: int | None = None
    asset_gl_account_name: str | None = None
    asset_gl_account_code: str | None = None
    cost_centre: str | None = None
    dealer_id: int | None
    year_built: int | None
    location_id: int | None
    created_at: datetime
    amenity_ids: list[int] = []

    class Config:
        from_attributes = True


# ── Floor ─────────────────────────────────────────────────────────────────────
class FloorCreate(BaseModel):
    property_id: int
    floor_number: int


class FloorOut(BaseModel):
    id: int
    tid: str
    property_id: int
    floor_number: int

    class Config:
        from_attributes = True


# ── Unit ──────────────────────────────────────────────────────────────────────
class UnitCreate(BaseModel):
    floor_id: int
    unit_number: str
    status: str = "available"
    unit_type_option_id: int | None = None
    size: str | None = None
    rent_amount: Decimal | None = None
    sale_price: Decimal | None = None
    # New fields
    unit_type: str | None = None
    area: Decimal | None = None
    area_unit: str | None = None
    furnishing_status: str | None = None
    security_deposit: Decimal | None = None
    notes: str | None = None
    floor_number: int | None = None
    property_id: int | None = None
    current_tenant_name: str | None = None
    lease_end_date: date | None = None


class UnitUpdate(BaseModel):
    status: str | None = None
    size: str | None = None
    rent_amount: Decimal | None = None
    sale_price: Decimal | None = None
    unit_type_option_id: int | None = None
    unit_type: str | None = None
    area: Decimal | None = None
    area_unit: str | None = None
    furnishing_status: str | None = None
    security_deposit: Decimal | None = None
    notes: str | None = None
    floor_number: int | None = None
    property_id: int | None = None
    current_tenant_name: str | None = None
    lease_end_date: date | None = None


class UnitOut(BaseModel):
    id: int
    tid: str
    floor_id: int
    unit_number: str
    status: str
    unit_type_option_id: int | None
    size: str | None
    rent_amount: Decimal | None
    sale_price: Decimal | None
    # New fields
    unit_type: str | None = None
    area: Decimal | None = None
    area_unit: str | None = None
    furnishing_status: str | None = None
    security_deposit: Decimal | None = None
    notes: str | None = None
    floor_number: int | None = None
    property_id: int | None = None
    property_name: str | None = None          # resolved for display
    current_tenant_name: str | None = None
    lease_end_date: date | None = None

    class Config:
        from_attributes = True


# ── Lease ─────────────────────────────────────────────────────────────────────
class LeaseCreate(BaseModel):
    property_id: int | None = None
    unit_id: int
    tenant_name: str | None = None
    tenant_id: int | None = None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    annual_rent: Decimal | None = None
    payment_frequency: str = "monthly"
    first_payment_due_date: date | None = None
    security_deposit: Decimal | None = None
    deposit_status: str | None = "pending"
    notice_period: int | None = 30
    grace_period: int | None = 5
    late_fee_type: str | None = None
    late_fee_value: Decimal | None = None
    payment_method: str | None = "cash"
    pdc_count: int | None = None
    bank_name: str | None = None
    bank_account_details: str | None = None
    auto_renewal: bool | None = False
    renewal_duration_months: int | None = None
    rent_increase_pct: Decimal | None = None
    status: str = "active"
    notes: str | None = None
    pdcs: list["LeasePdcCreate"] = []


class LeaseUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    end_date: date | None = None
    deposit_status: str | None = None


class LeaseOut(BaseModel):
    id: int
    tid: str
    property_id: int | None = None
    unit_id: int
    tenant_name: str | None = None
    tenant_id: int | None = None
    start_date: date
    end_date: date | None = None
    monthly_rent: Decimal
    annual_rent: Decimal | None = None
    payment_frequency: str | None = None
    first_payment_due_date: date | None = None
    security_deposit: Decimal | None = None
    deposit_status: str | None = None
    notice_period: int | None = None
    grace_period: int | None = None
    late_fee_type: str | None = None
    late_fee_value: Decimal | None = None
    payment_method: str | None = None
    pdc_count: int | None = None
    bank_name: str | None = None
    bank_account_details: str | None = None
    auto_renewal: bool | None = None
    renewal_duration_months: int | None = None
    rent_increase_pct: Decimal | None = None
    termination_date: date | None = None
    termination_reason: str | None = None
    renewed_from_lease_id: int | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    # Computed
    property_name: str | None = None
    unit_number: str | None = None
    tenant_ref: str | None = None

    class Config:
        from_attributes = True


# ── Lease Payment ─────────────────────────────────────────────────────────────
class LeasePaymentCreate(BaseModel):
    amount: Decimal
    payment_date: date
    payment_method: str | None = None
    reference_no: str | None = None
    cheque_no: str | None = None
    notes: str | None = None


class LeasePaymentOut(BaseModel):
    id: int
    tid: str
    lease_id: int
    amount: Decimal
    payment_date: date
    payment_method: str | None = None
    reference_no: str | None = None
    cheque_no: str | None = None
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Lease PDC ─────────────────────────────────────────────────────────────────
class LeasePdcCreate(BaseModel):
    cheque_no: str
    amount: Decimal
    due_date: date


class LeasePdcOut(BaseModel):
    id: int
    lease_id: int
    cheque_no: str
    amount: Decimal
    due_date: date
    status: str

    class Config:
        from_attributes = True


# ── Lease Document ────────────────────────────────────────────────────────────
class LeaseDocumentOut(BaseModel):
    id: int
    lease_id: int
    file_path: str
    filename: str
    document_type: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Lease Detail ──────────────────────────────────────────────────────────────
class LeaseDetail(LeaseOut):
    payments: list[LeasePaymentOut] = []
    pdcs: list[LeasePdcOut] = []
    documents: list[LeaseDocumentOut] = []


# ── Lease Renew / Terminate ───────────────────────────────────────────────────
class LeaseRenewCreate(BaseModel):
    new_start_date: date
    new_end_date: date
    monthly_rent: Decimal
    payment_frequency: str = "monthly"
    security_deposit: Decimal | None = None
    deposit_status: str | None = "pending"
    notice_period: int | None = 30
    notes: str | None = None


class LeaseTerminateCreate(BaseModel):
    termination_date: date
    reason: str  # tenant_request | non_payment | breach | mutual_agreement | other
    notes: str | None = None


# ── Contact (unified buyer/seller) ────────────────────────────────────────────
class ContactCreate(BaseModel):
    # Section A
    name: str
    role: str = "buyer"
    contact_type: str = "individual"
    cnic: str | None = None
    date_of_birth: date | None = None
    nationality: str | None = None
    profession: str | None = None
    company_name: str | None = None
    ntn: str | None = None
    company_reg_no: str | None = None
    authorized_person: str | None = None
    # Section B
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    secondary_phone: str | None = None
    address: str | None = None
    city: str | None = None
    # Section C
    tax_ntn: str | None = None
    source_of_funds: str | None = None
    annual_income_range: str | None = None
    bank_name: str | None = None
    bank_account_no: str | None = None
    kyc_status: str = "pending"
    # Section E
    internal_notes: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    contact_type: str | None = None
    cnic: str | None = None
    date_of_birth: date | None = None
    nationality: str | None = None
    profession: str | None = None
    company_name: str | None = None
    ntn: str | None = None
    company_reg_no: str | None = None
    authorized_person: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    secondary_phone: str | None = None
    address: str | None = None
    city: str | None = None
    tax_ntn: str | None = None
    source_of_funds: str | None = None
    annual_income_range: str | None = None
    bank_name: str | None = None
    bank_account_no: str | None = None
    kyc_status: str | None = None
    internal_notes: str | None = None
    archived: bool | None = None


class ContactDocumentOut(BaseModel):
    id: int
    contact_id: int
    document_type: str
    file_path: str
    filename: str
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ContactInteractionCreate(BaseModel):
    type: str  # call | email | meeting | note
    notes: str | None = None
    interaction_date: date


class ContactInteractionOut(BaseModel):
    id: int
    contact_id: int
    type: str
    notes: str | None = None
    interaction_date: date
    created_at: datetime

    class Config:
        from_attributes = True


class ContactOut(BaseModel):
    id: int
    tid: str
    name: str
    role: str
    contact_type: str
    cnic: str | None = None
    date_of_birth: date | None = None
    nationality: str | None = None
    profession: str | None = None
    company_name: str | None = None
    ntn: str | None = None
    company_reg_no: str | None = None
    authorized_person: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp: str | None = None
    secondary_phone: str | None = None
    address: str | None = None
    city: str | None = None
    tax_ntn: str | None = None
    source_of_funds: str | None = None
    annual_income_range: str | None = None
    bank_name: str | None = None
    bank_account_no: str | None = None
    kyc_status: str
    internal_notes: str | None = None
    archived: bool = False
    created_at: datetime
    # Computed
    sale_count: int = 0
    purchase_count: int = 0
    total_transaction_value: float = 0

    class Config:
        from_attributes = True


class ContactDetail(ContactOut):
    documents: list[ContactDocumentOut] = []
    interactions: list[ContactInteractionOut] = []


class ContactDocumentUpload(BaseModel):
    document_type: str
    status: str = "pending"


# ── Buyer (legacy) ────────────────────────────────────────────────────────────
class BuyerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class BuyerOut(BaseModel):
    id: int
    tid: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Seller ────────────────────────────────────────────────────────────────────
class SellerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    notes: str | None = None


class SellerOut(BaseModel):
    id: int
    tid: str
    name: str
    email: str | None
    phone: str | None
    address: str | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Property Sale ─────────────────────────────────────────────────────────────
class PropertySaleCreate(BaseModel):
    property_id: int | None = None
    unit_id: int | None = None
    buyer_id: int
    seller_id: int
    sale_price: Decimal
    # Section B
    token_amount: Decimal | None = None
    token_date: date | None = None
    payment_type: str | None = None             # full_cash | mortgage | instalment | mixed
    bank_name: str | None = None
    loan_amount: Decimal | None = None
    approval_date: date | None = None
    commission_pct: Decimal | None = None
    commission_amount: Decimal | None = None
    commission_paid_to: str | None = None
    stamp_duty: Decimal | None = None
    registration_fee: Decimal | None = None
    # Section C
    agreement_date: date | None = None
    sale_date: date | None = None               # fallback
    transfer_date: date | None = None
    transfer_deed_number: str | None = None
    sale_stage: str = "enquiry"
    status: str | None = None
    cancellation_reason: str | None = None
    notes: str | None = None
    # Instalments
    instalments: list["SaleInstalmentCreate"] = []


class SaleInstalmentCreate(BaseModel):
    milestone_name: str
    due_date: date
    amount: Decimal
    status: str = "pending"


class SaleInstalmentOut(BaseModel):
    id: int
    sale_id: int
    milestone_name: str
    due_date: date
    amount: Decimal
    status: str

    class Config:
        from_attributes = True


class SaleStageHistoryOut(BaseModel):
    id: int
    sale_id: int
    from_stage: str | None = None
    to_stage: str
    changed_by: str | None = None
    timestamp: datetime

    class Config:
        from_attributes = True


class SaleDocumentOut(BaseModel):
    id: int
    sale_id: int
    file_path: str
    filename: str
    document_type: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SalePaymentCreate(BaseModel):
    instalment_id: int | None = None
    amount: Decimal
    payment_date: date
    reference_no: str | None = None


class SalePaymentOut(BaseModel):
    id: int
    sale_id: int
    instalment_id: int | None = None
    amount: Decimal
    payment_date: date
    reference_no: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class SaleStageUpdate(BaseModel):
    stage: str
    changed_by: str | None = None


class PropertySaleOut(BaseModel):
    id: int
    tid: str
    property_id: int | None
    unit_id: int | None
    buyer_id: int
    seller_id: int
    sale_price: Decimal
    # Section B
    token_amount: Decimal | None = None
    token_date: date | None = None
    payment_type: str | None = None
    bank_name: str | None = None
    loan_amount: Decimal | None = None
    approval_date: date | None = None
    commission_pct: Decimal | None = None
    commission_amount: Decimal | None = None
    commission_paid_to: str | None = None
    stamp_duty: Decimal | None = None
    registration_fee: Decimal | None = None
    # Section C
    agreement_date: date | None = None
    sale_date: date | None = None
    transfer_date: date | None = None
    transfer_deed_number: str | None = None
    sale_stage: str | None = None
    status: str | None = None
    cancellation_reason: str | None = None
    notes: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class PropertySaleDetail(PropertySaleOut):
    instalments: list[SaleInstalmentOut] = []
    stage_history: list[SaleStageHistoryOut] = []
    documents: list[SaleDocumentOut] = []
    payments: list[SalePaymentOut] = []


# ── Image / Attachment ────────────────────────────────────────────────────────
class PropertyImageOut(BaseModel):
    id: int
    property_id: int
    file_path: str
    sort_order: int

    class Config:
        from_attributes = True


class PropertyAttachmentOut(BaseModel):
    id: int
    property_id: int
    file_path: str
    filename: str
    document_type: str | None = None
    document_name: str | None = None
    expiry_date: date | None = None
    notes: str | None = None
    uploaded_by: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Attachment meta update ────────────────────────────────────────────────────
class AttachmentMetaUpdate(BaseModel):
    document_type: str | None = None
    document_name: str | None = None
    expiry_date: date | None = None
    notes: str | None = None


# ── Detail (full property with nested data) ───────────────────────────────────
class UnitInFloor(UnitOut):
    pass


class FloorWithUnits(FloorOut):
    units: list[UnitInFloor] = []

    class Config:
        from_attributes = True


class PropertyDetail(PropertyOut):
    floors: list[FloorWithUnits] = []
    images: list[PropertyImageOut] = []
    attachments: list[PropertyAttachmentOut] = []

    class Config:
        from_attributes = True
