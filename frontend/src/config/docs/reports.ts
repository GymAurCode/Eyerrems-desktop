import type { ModuleDoc } from './index'

export const reportsDocs: ModuleDoc = {
  title: 'Reports',
  icon: 'ti-file',
  color: '#78716C',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Reports module lets you generate, view, and export detailed reports across all modules. It provides pre-built report templates for common business needs.',
        'Reports can be filtered by date range, module, and other parameters, then exported as PDF or Excel for sharing with stakeholders.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Report Type', desc: 'The category of report — e.g., Property Summary, Tenant List, Financial Statement, Maintenance Log.' },
        { term: 'Module Filter', desc: 'Select which module\'s data the report should cover (Properties, Tenants, Finance, etc.).' },
        { term: 'Date Range', desc: 'The time period the report covers. Custom ranges can be specified.' },
        { term: 'Filters', desc: 'Additional criteria to narrow down report data (e.g., by status, town, or property type).' },
        { term: 'Export', desc: 'Download the report as PDF or Excel file for external use.' },
        { term: 'Print', desc: 'Send the report directly to a printer.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Generating a Report: Go to Reports, select the module or report type from the list.',
        'Setting Filters: Choose date range, status, or other relevant filters. Click "Generate" or "Run Report."',
        'Viewing the Report: The report renders on screen. Scroll through the data and charts.',
        'Exporting: Click the Export button and choose PDF or Excel format. The file downloads automatically.',
        'Printing: Click the Print button to open your browser\'s print dialog.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Reports pulls data from all modules: Properties, Tenants, CRM, Finance, Construction, Maintenance, HR, etc.',
        'Financial reports use data from the Finance module ledger.',
        'Property reports use data from the Properties and Towns modules.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Why is my report empty?', desc: 'Check your filters. A narrow date range or restrictive module filter may exclude all data. Widen the filters and try again.' },
        { term: 'Can I save a report for later use?', desc: 'Pre-built report templates are always available. Custom filters may need to be re-applied each time.' },
        { term: 'What formats can I export to?', desc: 'PDF for presentation-ready documents and Excel for data analysis.' },
        { term: 'Can I schedule automatic report generation?', desc: 'This feature may be available in the Reminders or Advance Options section depending on your configuration.' },
      ],
    },
  ],
}
