ROLE_TEMPLATES = {
    "accountant": {
        "name": "Accountant",
        "description": "Access to Finance module only",
        "permissions": [
            {"module":"finance","tab":"invoices",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"finance","tab":"payments",
             "can_view":True,"can_add":True,"can_edit":False,"can_delete":False},
            {"module":"finance","tab":"expenses",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"finance","tab":"reports",
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
            {"module":"reports","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
        ]
    },
    "sales_agent": {
        "name": "Sales Agent",
        "description": "CRM access + Property viewing",
        "permissions": [
            {"module":"crm","tab":"leads",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"crm","tab":"clients",
             "can_view":True,"can_add":True,"can_edit":False,"can_delete":False},
            {"module":"crm","tab":"deals",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"crm","tab":"bookings",
             "can_view":True,"can_add":True,"can_edit":False,"can_delete":False},
            {"module":"crm","tab":"follow_ups",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"crm","tab":"site_visits",
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"properties","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
        ]
    },
    "hr_manager": {
        "name": "HR Manager",
        "description": "Full HR module access",
        "permissions": [
            {"module":"hr","tab":None,
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
        ]
    },
    "property_manager": {
        "name": "Property Manager",
        "description": "Full Properties + Tenants + Maintenance",
        "permissions": [
            {"module":"properties","tab":None,
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"tenants","tab":None,
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
            {"module":"maintenance","tab":None,
             "can_view":True,"can_add":True,"can_edit":True,"can_delete":False},
        ]
    },
    "viewer": {
        "name": "Viewer (Read Only)",
        "description": "View access to all modules, no changes",
        "permissions": [
            {"module":"properties","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
            {"module":"crm","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
            {"module":"finance","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
            {"module":"hr","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
            {"module":"reports","tab":None,
             "can_view":True,"can_add":False,"can_edit":False,"can_delete":False},
        ]
    }
}
