"""
Seed comprehensive test data for all report types.

Run from backend directory:
    cd backend && python scripts/seed_test_data.py
"""
import sys, os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from datetime import datetime, date, timedelta
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.finance import Payment, Expense, Vendor
from app.models.tenant import TenantLease, RentRecord
from app.models.crm import Deal, InstallmentPlan, Installment, InstallmentPayment
from app.models.property import PropertySale, Buyer, Seller
from app.models.hr import SalaryStructure
from app.models.booking import Booking

engine = create_engine(settings.database_url_fixed)
Session = sessionmaker(bind=engine)
session = Session()

session.execute(text('SET search_path TO "public"'))

# Clean existing seed data (delete in dependency order)
print("Cleaning existing seed data...")
session.execute(text("DELETE FROM salary_structures"))
session.execute(text("DELETE FROM property_sales"))
session.execute(text("DELETE FROM installment_payments"))
session.execute(text("DELETE FROM installments"))
session.execute(text("DELETE FROM installment_plans"))
session.execute(text("DELETE FROM payments"))
session.execute(text("DELETE FROM expenses"))
session.execute(text("DELETE FROM rent_records"))
session.execute(text("DELETE FROM tenant_leases"))
session.execute(text("DELETE FROM vendors"))
session.execute(text("DELETE FROM buyers"))
session.execute(text("DELETE FROM sellers"))
session.commit()

today = date.today()
print("Seeding test data...")

# ============================================================
# 1. VENDORS (for expense references)
# ============================================================
vendor_ids = []
for name in ["ABC Supplies", "XYZ Maintenance", "Tech Solutions"]:
    v = Vendor(
        name=name,
        contact_person=f"Contact {name}",
        phone="0300-1234567",
        email=f"info@{name.lower().replace(' ','')}.com",
        outstanding_amount=Decimal("0.00"),
        is_active=True,
    )
    session.add(v)
    session.flush()
    vendor_ids.append(v.id)
print(f"  Created {len(vendor_ids)} vendors")

# ============================================================
# 2. BUYERS & SELLERS (for property_sales)
# ============================================================
buyer = Buyer(tid="BUY-0001", name="Ahmed Khan", email="ahmed@example.com",
              phone="0300-1112233", address="Lahore")
seller = Seller(tid="SEL-0001", name="Property Owner", email="owner@example.com",
                phone="0300-4445566", address="Sheikhupura")
session.add_all([buyer, seller])
session.flush()
buyer_id, seller_id = buyer.id, seller.id
print(f"  Created buyer id={buyer_id}, seller id={seller_id}")

# ============================================================
# 3. TENANT LEASES (TenantLease → tenant_leases table)
# ============================================================
lease1 = TenantLease(
    tenant_id=3,
    property_id=1,
    unit_id=4,
    rent_amount=Decimal("15000.00"),
    security_deposit=Decimal("30000.00"),
    rent_cycle="monthly",
    due_day=1,
    lease_start=today - timedelta(days=180),
    lease_end=today + timedelta(days=180),
    status="active"
)
session.add(lease1)

lease2 = TenantLease(
    tenant_id=3,
    property_id=1,
    unit_id=2,
    rent_amount=Decimal("2300.00"),
    security_deposit=Decimal("4600.00"),
    rent_cycle="monthly",
    due_day=5,
    lease_start=today - timedelta(days=90),
    lease_end=today + timedelta(days=275),
    status="active"
)
session.add(lease2)
session.flush()
print(f"  Created leases: id={lease1.id}, id={lease2.id}")

# ============================================================
# 4. RENT RECORDS
# ============================================================
for i in range(6):
    due = today.replace(day=1) - timedelta(days=30 * (5 - i))
    if i < 4:
        # paid records
        rr = RentRecord(
            tenant_id=3, lease_id=lease1.id,
            amount_due=Decimal("15000.00"), amount_paid=Decimal("15000.00"),
            due_date=due, paid_date=due + timedelta(days=2),
            status="paid"
        )
    else:
        # pending records
        rr = RentRecord(
            tenant_id=3, lease_id=lease1.id,
            amount_due=Decimal("15000.00"), amount_paid=Decimal("0.00"),
            due_date=due, status="pending"
        )
    session.add(rr)

for i in range(3):
    due = today.replace(day=5) - timedelta(days=30 * (2 - i))
    if i < 2:
        rr = RentRecord(
            tenant_id=3, lease_id=lease2.id,
            amount_due=Decimal("2300.00"), amount_paid=Decimal("2300.00"),
            due_date=due, paid_date=due + timedelta(days=1),
            status="paid"
        )
    else:
        rr = RentRecord(
            tenant_id=3, lease_id=lease2.id,
            amount_due=Decimal("2300.00"), amount_paid=Decimal("0.00"),
            due_date=due, status="pending"
        )
    session.add(rr)

session.flush()
print("  Created rent records")

# ============================================================
# 5. INSTALLMENT PLANS (for existing deals)
# ============================================================
# Deal 1: client=1, property=1, unit=2 → booking=1
plan1 = InstallmentPlan(
    booking_id=1, deal_id=1,
    total_amount=Decimal("12000.00"),
    down_payment=Decimal("2000.00"),
    remaining_amount=Decimal("10000.00"),
    down_payment_status="paid",
    total_count=10, frequency="monthly", amount_per=Decimal("1000.00")
)
session.add(plan1)

plan2 = InstallmentPlan(
    deal_id=2,
    total_amount=Decimal("12000.00"),
    down_payment=Decimal("2000.00"),
    remaining_amount=Decimal("10000.00"),
    down_payment_status="paid",
    total_count=5, frequency="quarterly", amount_per=Decimal("2000.00")
)
session.add(plan2)

plan3 = InstallmentPlan(
    deal_id=3,
    total_amount=Decimal("12000.00"),
    down_payment=Decimal("2000.00"),
    remaining_amount=Decimal("10000.00"),
    down_payment_status="pending",
    total_count=10, frequency="monthly", amount_per=Decimal("1000.00")
)
session.add(plan3)
session.flush()
print("  Created installment plans")

# ============================================================
# 6. INSTALLMENTS & PAYMENTS
# ============================================================
for pi, plan in enumerate([plan1, plan2], start=1):
    num_installments = 5 if pi == 1 else 2
    for i in range(num_installments):
        inst = Installment(
            plan_id=plan.id,
            due_date=(today.replace(day=1) + timedelta(days=30 * (i + 1))),
            amount=Decimal("1000.00") if pi == 1 else Decimal("2000.00"),
            paid_amount=Decimal("0.00"),
            type="custom",
            status="pending"
        )
        if i < 3:  # pay first 3 installments
            inst.paid_amount = inst.amount
            inst.status = "paid"
            ip = InstallmentPayment(
                installment=inst,
                method="cash",
                amount=inst.amount,
                date=datetime.combine(inst.due_date - timedelta(days=2), datetime.min.time()),
                reference_number=f"PAY-INS-{pi}-{i+1}"
            )
            session.add(ip)
        session.add(inst)

session.flush()
print("  Created installments and payments")

# ============================================================
# 7. GENERIC PAYMENTS (for daily collection, due payment reports)
# ============================================================
payment_types = [
    {"source": "booking", "source_id": 1, "amount": Decimal("30000.00"), "party_type": "client", "party_id": 1, "method": "cash"},
    {"source": "rent", "source_id": lease1.id, "amount": Decimal("15000.00"), "party_type": "tenant", "party_id": 3, "method": "bank_transfer"},
    {"source": "installment", "source_id": 1, "amount": Decimal("1000.00"), "party_type": "client", "party_id": 1, "method": "cash"},
    {"source": "booking", "source_id": 1, "amount": Decimal("5000.00"), "party_type": "client", "party_id": 1, "method": "cheque"},
]
for i, pt in enumerate(payment_types):
    p = Payment(
        payment_number=f"PAY-{i+1:04d}",
        receipt_number=f"RCT-{i+1:04d}",
        status="completed",
        payment_type="against_invoice",
        method=pt["method"],
        amount=pt["amount"],
        date=datetime.now() - timedelta(days=30 * (len(payment_types) - i)),
        reference_number=f"REF-{i+1:04d}",
        party_type=pt["party_type"],
        party_id=pt["party_id"],
        party_name="Umer Mughal" if pt["party_type"] == "client" else "Umer Mughal (Tenant)",
        party_phone="+923189467063",
        source=pt["source"],
        source_id=pt["source_id"],
        posted_to_finance=True,
    )
    session.add(p)

session.flush()
print("  Created payments")

# ============================================================
# 8. EXPENSES (raw SQL due to DB/model column mismatches)
# ============================================================
now = datetime.now()
expense_data = [
    {"account_id": 29, "expense_type": "maintenance", "amount": 5000.00, "property_id": 1, "vendor_id": vendor_ids[0]},
    {"account_id": 30, "expense_type": "utility", "amount": 3000.00, "property_id": 1, "vendor_id": vendor_ids[1]},
    {"account_id": 32, "expense_type": "miscellaneous", "amount": 2000.00, "property_id": 2, "vendor_id": vendor_ids[2]},
    {"account_id": 33, "expense_type": "marketing", "amount": 15000.00, "vendor_id": vendor_ids[0]},
]
for idx, ed in enumerate(expense_data, start=1):
    session.execute(
        text("""
            INSERT INTO expenses (
                expense_number, expense_date, expense_type, status, currency,
                account_id, paid_from, date, description,
                amount, subtotal, paid_amount, remaining_amount,
                tax_amount, discount_amount, adjustment,
                vendor_id, vendor_name, property_id,
                payment_status, approval_status,
                is_recurring, budget_exceeded, budget_approval_required,
                created_at, updated_at
            ) VALUES (
                :expense_number, :expense_date, :expense_type, 'approved', 'PKR',
                :account_id, 'bank', :expense_date, :description,
                :amount, :amount, :amount, 0,
                0, 0, 0,
                :vendor_id, :vendor_name, :property_id,
                'paid', 'approved',
                false, false, false,
                :created_at, :created_at
            )
        """),
        {
            "expense_number": f"EXP-{idx:04d}",
            "expense_date": now,
            "expense_type": ed["expense_type"],
            "account_id": ed["account_id"],
            "description": f"Test {ed['expense_type']} expense",
            "amount": ed["amount"],
            "vendor_id": ed.get("vendor_id"),
            "vendor_name": f"Vendor {ed.get('vendor_id', '')}",
            "property_id": ed.get("property_id"),
            "created_at": now,
        }
    )

print(f"  Created {len(expense_data)} expenses")

# ============================================================
# 9. PROPERTY SALES
# ============================================================
sale = PropertySale(
    tid="SALE-0001",
    property_id=1,
    unit_id=2,
    buyer_id=buyer_id,
    seller_id=seller_id,
    sale_price=Decimal("2300000.00"),
    token_amount=Decimal("100000.00"),
    token_date=today - timedelta(days=60),
    payment_type="installments",
    sale_date=today - timedelta(days=30),
    agreement_date=today - timedelta(days=25),
    sale_stage="agreement",
    status="active",
)
session.add(sale)
session.flush()
print("  Created property sale")

# ============================================================
# 10. SALARY STRUCTURES
# ============================================================
now_dt = datetime.now()
for emp_id in [1, 2, 3]:
    ss = SalaryStructure(
        employee_id=emp_id,
        basic_salary=Decimal("25000.00"),
        house_rent_allowance=Decimal("10000.00"),
        conveyance_allowance=Decimal("3000.00"),
        medical_allowance=Decimal("5000.00"),
        special_allowance=Decimal("2000.00"),
        other_allowances=Decimal("0.00"),
        provident_fund=Decimal("2500.00"),
        professional_tax=Decimal("200.00"),
        income_tax=Decimal("1500.00"),
        other_deductions=Decimal("0.00"),
        gross_salary=Decimal("45000.00"),
        total_deductions=Decimal("4200.00"),
        net_salary=Decimal("40800.00"),
        overtime_hourly_rate=Decimal("200.00"),
        effective_from=date(today.year, 1, 1),
        is_active=True,
        created_at=now_dt,
        updated_at=now_dt,
    )
    session.add(ss)

session.flush()
print("  Created salary structures")

# ============================================================
# COMMIT
# ============================================================
session.commit()
print("\n=== Seed data committed successfully! ===")
print(f"  Leases: {session.query(TenantLease).count()}")
print(f"  RentRecords: {session.query(RentRecord).count()}")
print(f"  InstallmentPlans: {session.query(InstallmentPlan).count()}")
print(f"  Installments: {session.query(Installment).count()}")
print(f"  InstallmentPayments: {session.query(InstallmentPayment).count()}")
print(f"  Payments: {session.query(Payment).count()}")
print(f"  Expenses: {session.query(Expense).count()}")
print(f"  PropertySales: {session.query(PropertySale).count()}")
print(f"  SalaryStructures: {session.query(SalaryStructure).count()}")
print(f"  Vendors: {session.query(Vendor).count()}")
print(f"  Buyers: {session.query(Buyer).count()}")
print(f"  Sellers: {session.query(Seller).count()}")

session.close()
