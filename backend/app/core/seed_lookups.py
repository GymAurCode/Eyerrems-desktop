"""Seed default lookup values for all dropdown categories."""

SEED_DATA = [
    # ── Property Module ──
    ("property_type", "Apartment", "apartment", 1),
    ("property_type", "Villa", "villa", 2),
    ("property_type", "Office", "office", 3),
    ("property_type", "Shop", "shop", 4),
    ("property_type", "Warehouse", "warehouse", 5),
    ("property_type", "Land", "land", 6),

    ("property_status", "Available", "available", 1, True),
    ("property_status", "Occupied", "occupied", 2),
    ("property_status", "Under Maintenance", "under_maintenance", 3),
    ("property_status", "Reserved", "reserved", 4),

    ("unit_type", "Studio", "studio", 1),
    ("unit_type", "1 Bedroom", "1_bedroom", 2),
    ("unit_type", "2 Bedroom", "2_bedroom", 3),
    ("unit_type", "3 Bedroom", "3_bedroom", 4),
    ("unit_type", "Penthouse", "penthouse", 5),

    ("furnishing_status", "Furnished", "furnished", 1),
    ("furnishing_status", "Semi Furnished", "semi_furnished", 2),
    ("furnishing_status", "Unfurnished", "unfurnished", 3),

    # ── Tenant Module ──
    ("tenant_status", "Active", "active", 1, True),
    ("tenant_status", "Inactive", "inactive", 2),
    ("tenant_status", "Blacklisted", "blacklisted", 3),

    ("id_type", "Passport", "passport", 1),
    ("id_type", "National ID", "national_id", 2),
    ("id_type", "Residence Permit", "residence_permit", 3),
    ("id_type", "Driving License", "driving_license", 4),

    ("nationality", "Pakistani", "pakistani", 1),
    ("nationality", "Indian", "indian", 2),
    ("nationality", "UAE", "uae", 3),
    ("nationality", "Saudi", "saudi", 4),
    ("nationality", "British", "british", 5),
    ("nationality", "American", "american", 6),
    ("nationality", "Canadian", "canadian", 7),
    ("nationality", "Australian", "australian", 8),
    ("nationality", "Chinese", "chinese", 9),
    ("nationality", "Bangladeshi", "bangladeshi", 10),
    ("nationality", "Sri Lankan", "sri_lankan", 11),
    ("nationality", "Nepalese", "nepalese", 12),
    ("nationality", "Afghan", "afghan", 13),
    ("nationality", "Iranian", "iranian", 14),
    ("nationality", "Turkish", "turkish", 15),
    ("nationality", "Other", "other", 99),

    # ── Lease Module ──
    ("lease_type", "Monthly", "monthly", 1),
    ("lease_type", "Quarterly", "quarterly", 2),
    ("lease_type", "Yearly", "yearly", 3),

    ("lease_status", "Active", "active", 1, True),
    ("lease_status", "Expired", "expired", 2),
    ("lease_status", "Terminated", "terminated", 3),
    ("lease_status", "Pending", "pending", 4),

    ("payment_method", "Cash", "cash", 1),
    ("payment_method", "Bank Transfer", "bank_transfer", 2),
    ("payment_method", "Cheque", "cheque", 3),
    ("payment_method", "Online", "online", 4),

    # ── CRM Module ──
    ("lead_status", "New", "new", 1, True),
    ("lead_status", "Contacted", "contacted", 2),
    ("lead_status", "Qualified", "qualified", 3),
    ("lead_status", "Lost", "lost", 4),
    ("lead_status", "Won", "won", 5),

    ("lead_source", "Website", "website", 1),
    ("lead_source", "Referral", "referral", 2),
    ("lead_source", "Social Media", "social_media", 3),
    ("lead_source", "Walk In", "walk_in", 4),
    ("lead_source", "Phone", "phone", 5),
    ("lead_source", "Email", "email", 6),
    ("lead_source", "Other", "other", 99),

    ("priority", "Low", "low", 1),
    ("priority", "Medium", "medium", 2, True),
    ("priority", "High", "high", 3),

    # ── Client / Dealer Status ──
    ("client_status", "Active", "active", 1, True),
    ("client_status", "Inactive", "inactive", 2),
    ("client_status", "Potential", "potential", 3),

    ("dealer_status", "Active", "active", 1, True),
    ("dealer_status", "Inactive", "inactive", 2),

    # ── HR Module ──
    ("employee_status", "Active", "active", 1, True),
    ("employee_status", "On Leave", "on_leave", 2),
    ("employee_status", "Terminated", "terminated", 3),

    ("department", "Management", "management", 1),
    ("department", "Finance", "finance", 2),
    ("department", "Operations", "operations", 3),
    ("department", "Sales", "sales", 4),
    ("department", "IT", "it", 5),
    ("department", "HR", "hr", 6),
    ("department", "Marketing", "marketing", 7),
    ("department", "Administration", "administration", 8),

    ("employment_type", "Full Time", "full_time", 1, True),
    ("employment_type", "Part Time", "part_time", 2),
    ("employment_type", "Contract", "contract", 3),

    # ── Maintenance Module ──
    ("maintenance_category", "Plumbing", "plumbing", 1),
    ("maintenance_category", "Electrical", "electrical", 2),
    ("maintenance_category", "AC / HVAC", "ac_hvac", 3),
    ("maintenance_category", "Carpentry", "carpentry", 4),
    ("maintenance_category", "Painting", "painting", 5),
    ("maintenance_category", "Cleaning", "cleaning", 6),
    ("maintenance_category", "Other", "other", 99),

    ("maintenance_status", "Open", "open", 1, True),
    ("maintenance_status", "In Progress", "in_progress", 2),
    ("maintenance_status", "Resolved", "resolved", 3),
    ("maintenance_status", "Cancelled", "cancelled", 4),

    ("maintenance_priority", "Low", "low", 1),
    ("maintenance_priority", "Medium", "medium", 2, True),
    ("maintenance_priority", "High", "high", 3),
    ("maintenance_priority", "Urgent", "urgent", 4),

    # ── Finance Module ──
    ("expense_category", "Utilities", "utilities", 1),
    ("expense_category", "Repairs", "repairs", 2),
    ("expense_category", "Salaries", "salaries", 3),
    ("expense_category", "Marketing", "marketing", 4),
    ("expense_category", "Insurance", "insurance", 5),
    ("expense_category", "Other", "other", 99),

    ("invoice_status", "Draft", "draft", 1, True),
    ("invoice_status", "Sent", "sent", 2),
    ("invoice_status", "Paid", "paid", 3),
    ("invoice_status", "Overdue", "overdue", 4),
    ("invoice_status", "Cancelled", "cancelled", 5),

    # ── Document Status (attachments) ──
    ("document_status", "Verified", "verified", 1, True),
    ("document_status", "Pending", "pending", 2),
    ("document_status", "Rejected", "rejected", 3),

    # ── Booking Module ──
    ("booking_status", "Pending", "pending", 1, True),
    ("booking_status", "Confirmed", "confirmed", 2),
    ("booking_status", "Cancelled", "cancelled", 3),
    ("booking_status", "Completed", "completed", 4),

    # ── Unit status ──
    ("unit_status", "Available", "available", 1, True),
    ("unit_status", "Sold", "sold", 2),
    ("unit_status", "Rented", "rented", 3),
    ("unit_status", "Reserved", "reserved", 4),
    ("unit_status", "Maintenance", "maintenance", 5),

    # ── Deal status ──
    ("deal_status", "Pending", "pending", 1, True),
    ("deal_status", "Active", "active", 2),
    ("deal_status", "Closed", "closed", 3),
    ("deal_status", "Cancelled", "cancelled", 4),

    # ── Deal payment status
    ("down_payment_status", "Pending", "pending", 1, True),
    ("down_payment_status", "Paid", "paid", 2),

    # ── Commission type
    ("commission_type", "Percentage (%)", "percentage", 1, True),
    ("commission_type", "Fixed Amount", "fixed", 2),

    # ── Client role
    ("client_role", "Buyer", "buyer", 1),
    ("client_role", "Seller", "seller", 2),
    ("client_role", "Investor", "investor", 3),

    # ── Gender
    ("gender", "Male", "male", 1),
    ("gender", "Female", "female", 2),
    ("gender", "Other", "other", 3),

    # ── Payment status
    ("payment_status", "Pending", "pending", 1, True),
    ("payment_status", "Paid", "paid", 2),
    ("payment_status", "Partially Paid", "partially_paid", 3),
    ("payment_status", "Overdue", "overdue", 4),
    ("payment_status", "Cancelled", "cancelled", 5),

    # ── Account type (finance)
    ("account_type", "Asset", "asset", 1),
    ("account_type", "Liability", "liability", 2),
    ("account_type", "Income", "income", 3),
    ("account_type", "Expense", "expense", 4),
    ("account_type", "Equity", "equity", 5),

    # ── Payment method (finance)
    ("payment_method", "Bank Transfer", "bank_transfer", 1),
    ("payment_method", "Cash", "cash", 2),
    ("payment_method", "Cheque", "cheque", 3),
    ("payment_method", "Credit Card", "credit_card", 4),
    ("payment_method", "Online", "online", 5),
]


def seed_lookup_values(db_session) -> int:
    """Insert seed lookup values. Returns count of inserted rows."""
    from sqlalchemy import text
    count = 0
    for row in SEED_DATA:
        category, label, value, sort_order = row[:4]
        is_default = row[4] if len(row) > 4 else False
        sql = text("""
            INSERT INTO lookup_values (category, label, value, sort_order, is_default)
            VALUES (:cat, :label, :val, :ord, :def)
            ON CONFLICT (category, value) DO NOTHING
        """)
        result = db_session.execute(sql, {
            "cat": category,
            "label": label,
            "val": value,
            "ord": sort_order,
            "def": is_default,
        })
        db_session.commit()
        if result.rowcount > 0:
            count += 1
    return count
