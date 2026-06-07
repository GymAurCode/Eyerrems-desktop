from app.models.company import Company, CompanyFeature
from app.models.audit import AuditLog
from app.models.auth import Permission, Role, User
from app.models.crm import (
    Client, ClientAttachment, Communication, Deal, DealAttachment,
    Dealer, DealerAttachment, Installment, InstallmentPayment, InstallmentPlan, InstallmentType, Lead,
)
from app.models.finance import Account, AuditLog, Commission, Expense, Invoice, Journal, JournalEntry, Payment, SyncLog
from app.models.finance_operations import FinanceOperation
from app.models.property import (
    Amenity, Buyer, Floor, Lease, Location,
    Property, PropertyAttachment, PropertyCategory, PropertyImage,
    PropertySale, Seller, Unit,
)
from app.models.master_options import MasterSettingOption
from app.models.tenant import (
    Maintenance, MaintenanceActivityLog, RentIncrease, RentRecord,
    Tenant, TenantLease, TenantPayment,
)
from app.models.construction import (
    ConstructionProject, ProjectPhase, ProjectBudget,
    Contractor, ProjectContractor, Procurement,
    DailyProgress, ConstructionExpense, ConstructionDocument,
)
from app.models.reminders import (
    Reminder, ReminderAssignment, ReminderTemplate,
    Notification, NotificationLog, ReminderSettings,
)
from app.models.hr import (
    Department, Position, Branch, Employee, SalaryStructure,
    AllowanceType, DeductionType, Attendance, LeaveType, Leave,
    Payroll, LeaveBalance, Holiday
)
from app.models.mail import EmailAccount, EmailThread, Email, EmailAttachment
from app.models.town import Town, Block, Plot, TownUnit, TownTransaction
from app.models.ledger import ClientLedgerEntry, DealerLedgerEntry, PropertyLedgerEntry
from app.models.booking import Booking, BookingLog, BookingAttachment
from app.models.reports import ReportTemplate, SavedReport, ReportSchedule, ReportLog
from app.models.ai_intelligence import (
    AIAnomaly, AIRiskScore, AIAlert, AIDuplicateMatch, AIQuery, AIInsight,
)
from app.models.import_batch import ImportBatch, ImportRowLog
from app.models.attachment import Attachment  # noqa: F401
from app.models.lookup import LookupValue  # noqa: F401
from app.models.rbac import (
    Role, RolePermission, RoleUser, LoginHistory, ActivityLog, AdminNotification,
)
