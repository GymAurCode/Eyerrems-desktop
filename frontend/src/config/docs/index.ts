export interface DocSection {
  heading: string
  items: (string | { term: string; desc: string })[]
}

export interface ModuleDoc {
  title: string
  icon: string
  color: string
  sections: DocSection[]
}

import { dashboardDocs } from './dashboard'
import { propertiesDocs } from './properties'
import { townsDocs } from './towns'
import { crmDocs } from './crm'
import { tenantsDocs } from './tenants'
import { maintenanceDocs } from './maintenance'
import { constructionDocs } from './construction'
import { hrDocs } from './hr'
import { financeDocs } from './finance'
import { reportsDocs } from './reports'
import { spreadsheetDocs } from './spreadsheet'
import { aiDocs } from './ai'
import { communicationDocs } from './communication'
import { remindersDocs } from './reminders'
import { adminDocs } from './admin'
import { recycleBinDocs } from './recycle-bin'
import { backupRestoreDocs } from './backup-restore'
import { historyDocs } from './history'

export const DOCS_MODULES: Record<string, ModuleDoc> = {
  dashboard: dashboardDocs,
  properties: propertiesDocs,
  towns: townsDocs,
  crm: crmDocs,
  tenants: tenantsDocs,
  maintenance: maintenanceDocs,
  construction: constructionDocs,
  hr: hrDocs,
  finance: financeDocs,
  reports: reportsDocs,
  spreadsheet: spreadsheetDocs,
  ai: aiDocs,
  communication: communicationDocs,
  reminders: remindersDocs,
  admin: adminDocs,
  'recycle-bin': recycleBinDocs,
  'backup-restore': backupRestoreDocs,
  history: historyDocs,
}

export const DOCS_MODULE_ORDER: string[] = [
  'dashboard',
  'properties',
  'towns',
  'crm',
  'tenants',
  'maintenance',
  'construction',
  'hr',
  'finance',
  'reports',
  'spreadsheet',
  'ai',
  'communication',
  'reminders',
  'admin',
  'recycle-bin',
  'backup-restore',
  'history',
]
