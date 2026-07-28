import type { ModuleDoc } from './index'

export const dashboardDocs: ModuleDoc = {
  title: 'Dashboard',
  icon: 'ti-layout-dashboard',
  color: '#6366F1',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Dashboard is the first screen you see after logging in. It provides a high-level summary of your entire real estate business at a glance.',
        'Key metrics, recent activity, pending tasks, and quick-access charts are displayed here so you can monitor performance without navigating to individual modules.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Total Properties', desc: 'The total number of property records in the system, including all types (plots, buildings, apartments, etc.).' },
        { term: 'Occupancy Rate', desc: 'Percentage of units that are currently rented or occupied versus total available units.' },
        { term: 'Pending Maintenance', desc: 'Count of open maintenance requests that have not yet been resolved.' },
        { term: 'Active Tenants', desc: 'Number of tenants currently under an active lease agreement.' },
        { term: 'Monthly Revenue / Collections', desc: 'Total rent or payment amounts collected or due for the current month.' },
        { term: 'Recent Activity Feed', desc: 'A chronological list of the latest actions performed in the system (adds, edits, deletions).' },
        { term: 'Quick Stats Cards', desc: 'Small cards showing numeric summaries — clickable to navigate to the relevant module.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Log in with your credentials. The Dashboard loads automatically as the default landing page.',
        'Review the metric cards at the top to get a snapshot of your business health.',
        'Click on any metric card to navigate directly to the corresponding module for more detail.',
        'Scroll down to view the Recent Activity feed. Each entry shows who performed what action and when.',
        'Use the chart widgets (if configured) to visualize trends in revenue, occupancy, or maintenance over time.',
        'Click the refresh button or reload the page to pull the latest data.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'The Dashboard aggregates data from every other module: Properties, Tenants, Maintenance, Finance, CRM, and Construction.',
        'Clicking a metric card navigates you to the relevant module (e.g., clicking "Pending Maintenance" opens the Maintenance page).',
        'The Recent Activity feed pulls logs from all modules, giving you a cross-module audit trail.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Why are my dashboard numbers stale?', desc: 'Dashboard data refreshes when you load the page. Try reloading (F5) if you believe numbers should have updated.' },
        { term: 'Can I customize what appears on my Dashboard?', desc: 'The default Dashboard shows all available widgets. Customization may be available in future updates.' },
        { term: 'Why do I see zeros for some metrics?', desc: 'If you have not yet entered data in a particular module, the related metric will show zero. Start adding properties, tenants, etc., to populate the Dashboard.' },
        { term: 'Who can see the Dashboard?', desc: 'Any logged-in user with the "dashboard.view" permission can see the Dashboard. Role-based access applies.' },
      ],
    },
  ],
}
