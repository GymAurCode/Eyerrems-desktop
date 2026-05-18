"""HR, tenant, finance, and transaction import handlers."""
from datetime import datetime

from app.core.tid import next_tid
from app.models.finance import Account
from app.models.hr import Department, Employee, Position
from app.models.tenant import Tenant
from app.models.town import TownUnit, TownTransaction, TRANSACTION_TYPES, PAYMENT_METHODS
from app.services.bulk_import.types import ColumnDef, ImportContext, ImportModuleHandler, RowImportResult, RowValidationResult
from app.services.bulk_import.handlers.base import base_validate
from app.services.bulk_import import validator as v


EMPLOYEE_COLUMNS = [
    ColumnDef("employee_id", "Employee ID", sample="EMP-0001", hint="Leave blank to auto-generate"),
    ColumnDef("first_name", "First Name", required=True, sample="Ali"),
    ColumnDef("last_name", "Last Name", required=True, sample="Hassan"),
    ColumnDef("role", "Role / Position", sample="Sales Executive"),
    ColumnDef("department", "Department", sample="Sales"),
    ColumnDef("phone", "Phone", sample="+923001112233"),
    ColumnDef("work_email", "Work Email", sample="ali@company.com"),
    ColumnDef("salary", "Salary", sample="75000"),
    ColumnDef("joining_date", "Joining Date", sample="2024-01-15", hint="YYYY-MM-DD"),
    ColumnDef("employment_status", "Status", sample="Active", enum_values=["Active", "Inactive", "Resigned", "Terminated"]),
]

TENANT_COLUMNS = [
    ColumnDef("name", "Name", required=True, sample="John Doe"),
    ColumnDef("phone", "Phone", required=True, sample="+923009998877"),
    ColumnDef("email", "Email", sample="john@example.com"),
    ColumnDef("cnic", "CNIC", sample="12345-1234567-1"),
    ColumnDef("family_size", "Family Size", sample="4"),
    ColumnDef("notes", "Notes", sample="Long-term tenant"),
]

ACCOUNT_COLUMNS = [
    ColumnDef("code", "Account Code", required=True, sample="1100"),
    ColumnDef("name", "Account Name", required=True, sample="Cash in Hand"),
    ColumnDef("account_type", "Account Type", required=True, sample="Asset",
               enum_values=["Asset", "Liability", "Income", "Expense", "Equity"]),
    ColumnDef("parent_code", "Parent Code", sample="1000", hint="Optional parent account code"),
    ColumnDef("description", "Description", sample="Main cash account"),
]

TRANSACTION_COLUMNS = [
    ColumnDef("unit_tid", "Unit TID", required=True, sample="TUN-0001"),
    ColumnDef("transaction_type", "Type", required=True, sample="installment", enum_values=sorted(TRANSACTION_TYPES)),
    ColumnDef("amount", "Amount", required=True, sample="50000"),
    ColumnDef("payment_method", "Payment Method", sample="bank", enum_values=sorted(PAYMENT_METHODS)),
    ColumnDef("reference_no", "Reference No", sample="CHQ-12345"),
    ColumnDef("description", "Description", sample="Monthly installment"),
    ColumnDef("payer_name", "Payer Name", sample="Ahmed Khan"),
]


def validate_employee(row, ctx, row_number: int) -> RowValidationResult:
    extra = [v.validate_email(v.opt_str(row, "work_email"), "work_email")]
    dup = v.opt_str(row, "employee_id") or v.opt_str(row, "work_email") or None
    return base_validate(row, ctx, row_number, [("first_name", "First Name"), ("last_name", "Last Name")], dup, extra)


def import_employee(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    eid = v.opt_str(row, "employee_id")
    existing = db.query(Employee).filter(Employee.employee_id == eid).first() if eid else None
    if not existing:
        email = v.opt_str(row, "work_email")
        if email:
            existing = db.query(Employee).filter(Employee.work_email == email).first()

    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "employee", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Employee exists")
        existing.first_name = v.opt_str(row, "first_name") or existing.first_name
        existing.last_name = v.opt_str(row, "last_name") or existing.last_name
        db.flush()
        return RowImportResult(True, "updated", "Updated", "employee", existing.id)

    dept_id = pos_id = None
    dname = v.opt_str(row, "department")
    if dname:
        dept = db.query(Department).filter(Department.name.ilike(dname)).first()
        if dept:
            dept_id = dept.id
    pname = v.opt_str(row, "role")
    if pname:
        pos = db.query(Position).filter(Position.title.ilike(pname)).first()
        if pos:
            pos_id = pos.id

    fn, ln = v.opt_str(row, "first_name") or "", v.opt_str(row, "last_name") or ""
    emp = Employee(
        employee_id=eid or next_tid(db, Employee, "EMP"),
        first_name=fn, last_name=ln, full_name=f"{fn} {ln}".strip(),
        department_id=dept_id, position_id=pos_id,
        work_phone=v.opt_str(row, "phone"), work_email=v.opt_str(row, "work_email"),
        employment_status=v.opt_str(row, "employment_status") or "Active",
        joining_date=datetime.utcnow().date(),
        created_by=ctx.user_id,
    )
    db.add(emp)
    db.flush()
    return RowImportResult(True, "created", "Employee created", "employee", emp.id)


def validate_tenant(row, ctx, row_number: int) -> RowValidationResult:
    extra = [v.validate_phone(v.opt_str(row, "phone"), required=True), v.validate_email(v.opt_str(row, "email"))]
    return base_validate(row, ctx, row_number, [("name", "Name"), ("phone", "Phone")],
                         v.opt_str(row, "phone"), extra)


def import_tenant(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    phone = v.opt_str(row, "phone") or ""
    existing = db.query(Tenant).filter(Tenant.phone == phone).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "tenant", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Tenant exists")
        existing.name = v.opt_str(row, "name") or existing.name
        db.flush()
        return RowImportResult(True, "updated", "Updated", "tenant", existing.id)

    fs, _ = v.parse_int(v.opt_str(row, "family_size"), "family_size")
    tenant = Tenant(
        tenant_id=next_tid(db, Tenant, "TEN"),
        name=v.opt_str(row, "name") or "",
        phone=phone,
        email=v.opt_str(row, "email"),
        cnic=v.opt_str(row, "cnic"),
        family_size=fs,
        notes=v.opt_str(row, "notes"),
    )
    db.add(tenant)
    db.flush()
    return RowImportResult(True, "created", "Tenant created", "tenant", tenant.id)


def validate_account(row, ctx, row_number: int) -> RowValidationResult:
    extra = [v.validate_enum(v.opt_str(row, "account_type") or "", {
        "Asset", "Liability", "Income", "Expense", "Equity",
    }, "account_type")]
    return base_validate(row, ctx, row_number, [("code", "Code"), ("name", "Name"), ("account_type", "Account Type")],
                         v.opt_str(row, "code"), extra)


def import_account(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    code = v.opt_str(row, "code") or ""
    existing = db.query(Account).filter(Account.code == code).first()
    if existing:
        if ctx.duplicate_mode == "skip":
            return RowImportResult(True, "skipped", "Skipped", "account", existing.id)
        if ctx.duplicate_mode == "create_only":
            return RowImportResult(False, "skipped", "Account exists")
        existing.name = v.opt_str(row, "name") or existing.name
        db.flush()
        return RowImportResult(True, "updated", "Updated", "account", existing.id)

    parent_id = None
    pcode = v.opt_str(row, "parent_code")
    if pcode:
        parent = db.query(Account).filter(Account.code == pcode).first()
        if parent:
            parent_id = parent.id

    acc = Account(
        code=code,
        name=v.opt_str(row, "name") or "",
        account_type=v.opt_str(row, "account_type") or "Asset",
        parent_id=parent_id,
        description=v.opt_str(row, "description"),
    )
    db.add(acc)
    db.flush()
    return RowImportResult(True, "created", "Account created", "account", acc.id)


def validate_transaction(row, ctx, row_number: int) -> RowValidationResult:
    extra = [
        v.validate_enum(v.opt_str(row, "transaction_type") or "", TRANSACTION_TYPES, "transaction_type"),
    ]
    amt, err = v.parse_decimal(v.opt_str(row, "amount"), "amount", required=True)
    if err:
        extra.append(err)
    utid = v.opt_str(row, "unit_tid")
    if utid and not ctx.db.query(TownUnit).filter(TownUnit.tid == utid).first():
        extra.append(f"Unit '{utid}' not found")
    return base_validate(row, ctx, row_number, [
        ("unit_tid", "Unit TID"), ("transaction_type", "Type"), ("amount", "Amount"),
    ], f"{utid}:{v.opt_str(row, 'reference_no')}", extra)


def import_transaction(row, ctx: ImportContext) -> RowImportResult:
    db = ctx.db
    unit = db.query(TownUnit).filter(TownUnit.tid == v.opt_str(row, "unit_tid")).first()
    if not unit:
        return RowImportResult(False, "failed", "Unit not found")
    amount, err = v.parse_decimal(v.opt_str(row, "amount"), "amount", required=True)
    if err:
        return RowImportResult(False, "failed", err)

    txn = TownTransaction(
        tid=next_tid(db, TownTransaction, "TTX"),
        town_unit_id=unit.id,
        town_id=unit.town_id,
        block_id=unit.block_id,
        transaction_type=v.opt_str(row, "transaction_type") or "installment",
        amount=amount,
        payment_method=v.opt_str(row, "payment_method"),
        reference_no=v.opt_str(row, "reference_no"),
        description=v.opt_str(row, "description"),
        payer_name=v.opt_str(row, "payer_name"),
        company_id=ctx.company_id,
        created_by=ctx.user_id,
    )
    db.add(txn)
    db.flush()
    # Finance journal linking can be extended here via JournalService
    return RowImportResult(True, "created", "Transaction created", "town_transaction", txn.id)


def get_hr_finance_handlers() -> list[ImportModuleHandler]:
    return [
        ImportModuleHandler("employees", "Employees", "Import HR employees", "HR", "hr:manage",
                            EMPLOYEE_COLUMNS, validate_employee, import_employee,
                            lambda r: v.opt_str(r, "employee_id") or v.opt_str(r, "work_email")),
        ImportModuleHandler("tenants", "Tenants", "Import tenants", "Tenants", None,
                            TENANT_COLUMNS, validate_tenant, import_tenant, lambda r: v.opt_str(r, "phone")),
        ImportModuleHandler("accounts", "Accounts", "Import chart of accounts", "Finance", "finance:manage",
                            ACCOUNT_COLUMNS, validate_account, import_account, lambda r: v.opt_str(r, "code")),
        ImportModuleHandler("transactions", "Transactions", "Import town unit transactions", "Finance", "finance:manage",
                            TRANSACTION_COLUMNS, validate_transaction, import_transaction,
                            lambda r: f"{v.opt_str(r,'unit_tid')}:{v.opt_str(r,'reference_no')}"),
    ]
