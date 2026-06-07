export interface ModuleColorSet {
  name: string
  primary: string
  light: string
  medium: string
  dark: string
  text: string
  accent: string
  rgb: string
  sidebar_bg: string
  sidebar_text: string
}

export const MODULE_COLORS: Record<string, ModuleColorSet> = {
  dashboard: {
    name: 'Dashboard',
    primary: '#6366F1',
    light: '#EEF2FF',
    medium: '#C7D2FE',
    dark: '#4338CA',
    text: '#3730A3',
    accent: '#6366F1',
    rgb: '99,102,241',
    sidebar_bg: '#6366F1',
    sidebar_text: '#FFFFFF',
  },
  properties: {
    name: 'Properties',
    primary: '#10B981',
    light: '#ECFDF5',
    medium: '#A7F3D0',
    dark: '#059669',
    text: '#065F46',
    accent: '#10B981',
    rgb: '16,185,129',
    sidebar_bg: '#10B981',
    sidebar_text: '#FFFFFF',
  },
  towns: {
    name: 'Towns',
    primary: '#F59E0B',
    light: '#FFFBEB',
    medium: '#FDE68A',
    dark: '#D97706',
    text: '#92400E',
    accent: '#F59E0B',
    rgb: '245,158,11',
    sidebar_bg: '#F59E0B',
    sidebar_text: '#FFFFFF',
  },
  crm: {
    name: 'CRM',
    primary: '#8B5CF6',
    light: '#F5F3FF',
    medium: '#DDD6FE',
    dark: '#7C3AED',
    text: '#5B21B6',
    accent: '#8B5CF6',
    rgb: '139,92,246',
    sidebar_bg: '#8B5CF6',
    sidebar_text: '#FFFFFF',
  },
  tenants: {
    name: 'Tenants',
    primary: '#06B6D4',
    light: '#ECFEFF',
    medium: '#A5F3FC',
    dark: '#0891B2',
    text: '#164E63',
    accent: '#06B6D4',
    rgb: '6,182,212',
    sidebar_bg: '#06B6D4',
    sidebar_text: '#FFFFFF',
  },
  maintenance: {
    name: 'Maintenance',
    primary: '#F97316',
    light: '#FFF7ED',
    medium: '#FED7AA',
    dark: '#EA580C',
    text: '#9A3412',
    accent: '#F97316',
    rgb: '249,115,22',
    sidebar_bg: '#F97316',
    sidebar_text: '#FFFFFF',
  },
  construction: {
    name: 'Construction',
    primary: '#EF4444',
    light: '#FEF2F2',
    medium: '#FECACA',
    dark: '#DC2626',
    text: '#991B1B',
    accent: '#EF4444',
    rgb: '239,68,68',
    sidebar_bg: '#EF4444',
    sidebar_text: '#FFFFFF',
  },
  hr: {
    name: 'HR',
    primary: '#EC4899',
    light: '#FDF2F8',
    medium: '#FBCFE8',
    dark: '#DB2777',
    text: '#9D174D',
    accent: '#EC4899',
    rgb: '236,72,153',
    sidebar_bg: '#EC4899',
    sidebar_text: '#FFFFFF',
  },
  finance: {
    name: 'Finance',
    primary: '#14B8A6',
    light: '#F0FDFA',
    medium: '#99F6E4',
    dark: '#0D9488',
    text: '#134E4A',
    accent: '#14B8A6',
    rgb: '20,184,166',
    sidebar_bg: '#14B8A6',
    sidebar_text: '#FFFFFF',
  },
  reports: {
    name: 'Reports',
    primary: '#64748B',
    light: '#F8FAFC',
    medium: '#CBD5E1',
    dark: '#475569',
    text: '#1E293B',
    accent: '#64748B',
    rgb: '100,116,139',
    sidebar_bg: '#64748B',
    sidebar_text: '#FFFFFF',
  },
  ai: {
    name: 'AI Intel',
    primary: '#A855F7',
    light: '#FAF5FF',
    medium: '#E9D5FF',
    dark: '#9333EA',
    text: '#6B21A8',
    accent: '#A855F7',
    rgb: '168,85,247',
    sidebar_bg: '#A855F7',
    sidebar_text: '#FFFFFF',
  },
  communication: {
    name: 'Communication',
    primary: '#3B82F6',
    light: '#EFF6FF',
    medium: '#BFDBFE',
    dark: '#2563EB',
    text: '#1E40AF',
    accent: '#3B82F6',
    rgb: '59,130,246',
    sidebar_bg: '#3B82F6',
    sidebar_text: '#FFFFFF',
  },
  reminders: {
    name: 'Reminders',
    primary: '#F43F5E',
    light: '#FFF1F2',
    medium: '#FECDD3',
    dark: '#E11D48',
    text: '#881337',
    accent: '#F43F5E',
    rgb: '244,63,94',
    sidebar_bg: '#F43F5E',
    sidebar_text: '#FFFFFF',
  },
  admin: {
    name: 'Admin',
    primary: '#1F2937',
    light: '#F9FAFB',
    medium: '#D1D5DB',
    dark: '#111827',
    text: '#111827',
    accent: '#1F2937',
    rgb: '31,41,55',
    sidebar_bg: '#1F2937',
    sidebar_text: '#FFFFFF',
  },
  history: {
    name: 'History',
    primary: '#78716C',
    light: '#FAFAF9',
    medium: '#D6D3D1',
    dark: '#57534E',
    text: '#292524',
    accent: '#78716C',
    rgb: '120,113,108',
    sidebar_bg: '#78716C',
    sidebar_text: '#FFFFFF',
  },
}

export const MODULE_KEY_BY_PATH: Record<string, string> = {
  '/': 'dashboard',
  '/property': 'properties',
  '/towns': 'towns',
  '/crm': 'crm',
  '/tenants': 'tenants',
  '/maintenance': 'maintenance',
  '/construction': 'construction',
  '/hr': 'hr',
  '/finance': 'finance',
  '/reports': 'reports',
  '/ai': 'ai',
  '/communication': 'communication',
  '/reminders': 'reminders',
  '/admin': 'admin',
  '/admin-panel': 'admin',
  '/history': 'history',
}

export function getModuleFromPath(pathname: string): string {
  const path = pathname.toLowerCase()
  if (path.startsWith('/property')) return 'properties'
  if (path.startsWith('/towns')) return 'towns'
  if (path.startsWith('/crm')) return 'crm'
  if (path.startsWith('/tenant')) return 'tenants'
  if (path.startsWith('/maintenance')) return 'maintenance'
  if (path.startsWith('/construction')) return 'construction'
  if (path.startsWith('/hr')) return 'hr'
  if (path.startsWith('/finance')) return 'finance'
  if (path.startsWith('/report')) return 'reports'
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/ai')) return 'ai'
  if (path.startsWith('/communication')) return 'communication'
  if (path.startsWith('/reminder')) return 'reminders'
  if (path.startsWith('/mail')) return 'communication'
  if (path.startsWith('/ledger')) return 'finance'
  if (path.startsWith('/history')) return 'history'
  if (path.startsWith('/advance')) return 'admin'
  return 'dashboard'
}

export function getModuleColors(moduleKey: string): ModuleColorSet {
  return MODULE_COLORS[moduleKey] || MODULE_COLORS.dashboard
}

// Legacy flat map — returns primary hex string for each module key
// Used by older code that expects MODULE_COLORS.xxx to be a string
export const MODULE_COLOR_PRIMARY: Record<string, string> = {
  dashboard:     MODULE_COLORS.dashboard.primary,
  property:      MODULE_COLORS.properties.primary,
  properties:    MODULE_COLORS.properties.primary,
  towns:         MODULE_COLORS.towns.primary,
  crm:           MODULE_COLORS.crm.primary,
  tenants:       MODULE_COLORS.tenants.primary,
  maintenance:   MODULE_COLORS.maintenance.primary,
  construction:  MODULE_COLORS.construction.primary,
  hr:            MODULE_COLORS.hr.primary,
  finance:       MODULE_COLORS.finance.primary,
  reports:       MODULE_COLORS.reports.primary,
  ai:            MODULE_COLORS.ai.primary,
  communication: MODULE_COLORS.communication.primary,
  reminders:     MODULE_COLORS.reminders.primary,
  admin:         MODULE_COLORS.admin.primary,
  history:       MODULE_COLORS.history.primary,
}
