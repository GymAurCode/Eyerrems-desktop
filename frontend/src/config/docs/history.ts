import type { ModuleDoc } from './index'

export const historyDocs: ModuleDoc = {
  title: 'Activity / History',
  icon: 'ti-history',
  color: '#78716C',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Activity / History module provides a chronological log of all actions performed in the system. Every create, update, delete, and status change is recorded with who performed it and when.',
        'Use this module to audit changes, track user activity, investigate issues, and maintain compliance records.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Action', desc: 'What was done (Created, Updated, Deleted, Status Changed, etc.).' },
        { term: 'Module / Record Type', desc: 'Which module the action occurred in (e.g., Property, Tenant, Deal).' },
        { term: 'Record Name / ID', desc: 'The specific record that was affected.' },
        { term: 'Performed By', desc: 'The user who performed the action.' },
        { term: 'Timestamp', desc: 'The exact date and time the action occurred.' },
        { term: 'Details / Changes', desc: 'Additional information about what changed (e.g., "Status changed from Available to Sold").' },
        { term: 'IP Address', desc: 'The IP address from which the action was performed (for security auditing).' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Viewing Activity: Go to History or Recent Activity. A list of recent actions is displayed by default.',
        'Filtering: Use module, user, date range, and action type filters to narrow down the log.',
        'Searching: Search by record name, user name, or keywords in the details.',
        'Exporting: Export the activity log as PDF or Excel for external audit purposes.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'The Activity log receives data from all modules. Every action in Properties, CRM, Tenants, Finance, etc., is recorded here.',
        'Admin > Activity Log shows the same data for administrative review.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'How far back does the activity log go?', desc: 'By default, the log retains 90 days of activity. This can be configured in Admin settings.' },
        { term: 'Can I delete entries from the activity log?', desc: 'No. The activity log is append-only to maintain a tamper-proof audit trail.' },
        { term: 'What is the difference between History and Recent Activity?', desc: 'Recent Activity shows the latest actions with a more compact view. History provides full filtering and search capabilities.' },
        { term: 'Does the log record views/reads or only modifications?', desc: 'Only modifications (create, update, delete, status change) are logged. Viewing a record is not recorded.' },
      ],
    },
  ],
}
