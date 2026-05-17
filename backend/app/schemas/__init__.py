from app.schemas.admin import AuditLogResponse, RolePermissionResponse
from app.schemas.auth import LoginRequest, RegisterRequest, AuthToken, UserResponse
from app.schemas.construction import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectSummary,
    PhaseCreate, PhaseUpdate, PhaseResponse,
    BudgetCreate, BudgetUpdate, BudgetResponse,
    ContractorCreate, ContractorUpdate, ContractorResponse,
    ProjectContractorCreate, ProjectContractorResponse,
    ProcurementCreate, ProcurementUpdate, ProcurementResponse, ProcurementStatusUpdate,
    DailyProgressCreate, DailyProgressUpdate, DailyProgressResponse,
    ConstructionExpenseCreate, ConstructionExpenseResponse,
    DocumentResponse,
)
from app.schemas.crm import (
    ClientCreate, ClientOut, ClientUpdate,
    DealerCreate, DealerOut, DealerUpdate,
    LeadCreate, LeadOut, LeadUpdate,
    DealCreate, DealOut, DealUpdate,
    CommunicationCreate, CommunicationOut,
    InstallmentPlanCreate, InstallmentPlanOut,
    InstallmentCreate, InstallmentOut, InstallmentUpdate,
    InstallmentPaymentCreate, InstallmentPaymentOut,
    InstallmentTypeCreate, InstallmentTypeOut,
    ClientAttachmentOut,
    DealerAttachmentOut,
    DealAttachmentOut,
)
from app.schemas.finance import (
    AccountCreate, AccountResponse, AccountTreeNode, AccountUpdate, AccountWithBalance,
    CommissionCreate, CommissionResponse,
    ExpenseCreate, ExpenseResponse,
    InvoiceCreate, InvoiceResponse, InvoiceUpdate,
    JournalCreate, JournalResponse,
    LedgerEntryResponse,
    PaymentCreate, PaymentResponse,
    ProfitLossResponse, ProfitLossRow,
    TrialBalanceResponse, TrialBalanceRow,
    GeneralLedgerResponse,
)
from app.schemas.finance_operations import (
    RevenueCreate, ExpenseOpCreate, RefundCreate,
    TransferCreate, AdjustmentCreate, MergeCreate,
    FinanceOperationResponse,
)
from app.schemas.property import (
    PropertyCreate, PropertyOut, PropertyUpdate,
    CategoryCreate, CategoryOut,
    AmenityCreate, AmenityOut,
    LocationCreate, LocationOut,
    FloorCreate, FloorOut,
    UnitCreate, UnitOut, UnitUpdate,
    PropertyImageOut,
    PropertyAttachmentOut,
    PropertySaleCreate, PropertySaleOut,
    BuyerCreate, BuyerOut,
    SellerCreate, SellerOut,
)
from app.schemas.settings import (
    MasterSettingOptionCreate, MasterSettingOptionResponse, MasterSettingOptionUpdate,
)
from app.schemas.tenant import (
    TenantCreate, TenantOut, TenantUpdate,
    LeaseCreate as TenantLeaseCreate,
    LeaseOut as TenantLeaseOut,
    RentRecordOut,
    PaymentCreate as TenantPaymentCreate,
    PaymentOut as TenantPaymentOut,
    RentIncreaseCreate, RentIncreaseOut,
    MaintenanceCreate, MaintenanceOut,
    TenantAlert, TenantDashboardOut, TenantDetailOut, TenantWizardCreate,
)
from app.schemas.reminders import (
    ReminderCreate, ReminderOut, ReminderUpdate,
    TemplateCreate as ReminderTemplateCreate,
    TemplateOut as ReminderTemplateOut,
    TemplateUpdate as ReminderTemplateUpdate,
    NotificationOut, NotificationLogOut,
    ReminderSettingsUpdate, ReminderSettingsOut,
)
from app.schemas.hr import (
    DepartmentCreate, DepartmentResponse, DepartmentTree, DepartmentUpdate,
    PositionCreate, PositionResponse, PositionUpdate,
    BranchCreate, BranchResponse, BranchUpdate,
    EmployeeCreate, EmployeeResponse, EmployeeDetail, EmployeeUpdate,
    SalaryStructureCreate, SalaryStructureResponse, SalaryStructureUpdate,
    AllowanceTypeCreate, AllowanceTypeResponse,
    DeductionTypeCreate, DeductionTypeResponse,
    AttendanceCreate, AttendanceResponse, AttendanceSummary, AttendanceUpdate,
    LeaveTypeCreate, LeaveTypeResponse,
    LeaveCreate, LeaveResponse, LeaveDetail, LeaveSummary, LeaveUpdate,
    PayrollCreate, PayrollResponse, PayrollDetail, PayrollSummary, PayrollUpdate,
    LeaveBalanceResponse,
    HolidayCreate, HolidayResponse,
    AttendanceReport, PayrollReport, LeaveReport,
)
from app.schemas.booking import (
    BookingCreate, BookingUpdate, BookingOut, BookingListOut,
    BookingStatusUpdate, BookingAssignment, BookingExtension,
    BookingFromDeal, BookingLogOut, BookingAttachmentOut,
    BookingStats, InstallmentPlanCreate, InstallmentPlanOut,
    InstallmentOut, InstallmentPaymentCreate,
)
