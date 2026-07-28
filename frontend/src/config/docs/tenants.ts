import type { ModuleDoc } from './index'

export const tenantsDocs: ModuleDoc = {
  title: 'Tenants',
  icon: 'ti-user-check',
  color: '#06B6D4',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Tenants module manages all individuals or organizations renting your properties. It tracks tenant contact details, lease agreements, rent payments, and communication history.',
        'Every tenant is linked to a specific property unit through a lease, ensuring you always know who is renting what and when their lease expires.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Tenant Name', desc: 'Full name of the tenant (individual or company name for corporate tenants).' },
        { term: 'Contact Information', desc: 'Phone number, email address, and emergency contact details.' },
        { term: 'Lease Agreement', desc: 'The rental contract linking the tenant to a property. Includes start date, end date, rent amount, and terms.' },
        { term: 'Lease Start / End Date', desc: 'The period during which the tenant has the right to occupy the property.' },
        { term: 'Monthly Rent', desc: 'The agreed rent amount per month (or per configured period).' },
        { term: 'Security Deposit', desc: 'An upfront deposit held against damages or unpaid rent.' },
        { term: 'Rent Due Date', desc: 'The day of each month when rent is due (e.g., 1st or 5th).' },
        { term: 'Status', desc: 'Whether the tenant is Active (currently renting), Past Due (overdue on payments), or Former (lease ended).' },
        { term: 'Documents', desc: 'Uploaded lease contracts, ID proofs, and other tenant-related documents.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Adding a Tenant: Go to Tenants, click "Add Tenant." Enter personal details and save. Then create a lease to link them to a property.',
        'Creating a Lease: From the tenant detail page, click "Add Lease." Select the property/unit, set dates, rent amount, and terms.',
        'Recording Rent Payments: Navigate to the tenant\'s lease, click "Record Payment." Enter the amount, date, and payment method.',
        'Editing Tenant Info: Find the tenant, click edit. Update contact details or documents.',
        'Ending a Lease: Open the lease record, set the end date, and mark it as closed. The tenant\'s status becomes "Former."',
        'Searching / Filtering: Search by name, phone, or property. Filter by status (Active, Past Due, Former).',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Properties: Tenants are linked to specific property units via leases.',
        'Finance: Rent payments flow into the Finance module. Overdue payments appear in financial reports.',
        'Maintenance: Tenants can raise maintenance requests for their rented unit.',
        'CRM: If a client in CRM decides to rent rather than buy, they can be converted to a tenant record.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Can a tenant rent multiple properties?', desc: 'Yes. A tenant can have multiple active leases across different properties.' },
        { term: 'What happens when a lease expires?', desc: 'The tenant status changes to "Former." You can renew by creating a new lease or extending the existing one.' },
        { term: 'How do I handle partial rent payments?', desc: 'Record the partial amount. The system will track the remaining balance as overdue.' },
        { term: 'Can I send automated rent reminders?', desc: 'If the Reminders module is configured, you can set up recurring reminders for rent due dates.' },
      ],
    },
  ],
}
