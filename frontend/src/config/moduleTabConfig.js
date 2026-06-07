export const MODULE_TAB_CONFIG = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    tabs: []
  },
  {
    key: 'properties',
    label: 'Properties',
    icon: 'Building2',
    tabs: [
      'Properties', 'Units', 'Lease', 'Sales', 'Buyers', 'Sellers'
    ]
  },
  {
    key: 'towns',
    label: 'Towns',
    icon: 'MapPin',
    tabs: ['Overview']
  },
  {
    key: 'crm',
    label: 'CRM',
    icon: 'Users',
    tabs: [
      'Dashboard', 'Leads', 'Clients', 'Dealers', 'Deals', 'Bookings',
      'Follow-ups', 'Site Visits', 'Installments', 'Payments'
    ]
  },
  {
    key: 'tenants',
    label: 'Tenants',
    icon: 'Home',
    tabs: ['Profile', 'Payments', 'Documents', 'Leases']
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: 'Wrench',
    tabs: ['Requests', 'History']
  },
  {
    key: 'construction',
    label: 'Construction',
    icon: 'HardHat',
    tabs: ['Dashboard', 'Projects', 'Drawings', 'Batches', 'Reports']
  },
  {
    key: 'hr',
    label: 'HR',
    icon: 'UserCog',
    tabs: ['Employees', 'Attendance', 'Payroll', 'Leaves', 'Documents']
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: 'TrendingUp',
    tabs: ['Overview', 'Invoices', 'Payments', 'Ledger', 'Accounts', 'Expenses', 'Commissions']
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'BarChart',
    tabs: ['Reports', 'Analytics']
  },
  {
    key: 'ai',
    label: 'AI Intel',
    icon: 'Sparkles',
    tabs: ['Assistant', 'Chat']
  },
  {
    key: 'communication',
    label: 'Communication',
    icon: 'MessageSquare',
    tabs: ['Email', 'WhatsApp']
  },
  {
    key: 'reminders',
    label: 'Reminders',
    icon: 'Bell',
    tabs: ['Reminders']
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'Shield',
    tabs: ['Settings']
  },
  {
    key: 'history',
    label: 'History',
    icon: 'Clock',
    tabs: ['Activity']
  },
]

export const READ_ONLY_MODULES = ['reports', 'ai', 'history']

export const NO_DELETE_MODULES = ['reports', 'ai']

export function getModuleConfig(key) {
  return MODULE_TAB_CONFIG.find((m) => m.key === key)
}
