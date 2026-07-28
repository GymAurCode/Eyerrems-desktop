import type { ModuleDoc } from './index'

export const financeDocs: ModuleDoc = {
  title: 'Finance',
  icon: 'ti-currency-dollar',
  color: '#14B8A6',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Finance module provides a comprehensive view of your company\'s financial transactions, including income (rent, sales) and expenses (maintenance, construction costs).',
        'It includes a ledger for detailed transaction tracking and integrates with CRM deals, tenant payments, and project budgets for end-to-end financial visibility.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Transaction', desc: 'A single financial entry representing money in (credit) or money out (debit).' },
        { term: 'Ledger', desc: 'A chronological record of all financial transactions. Think of it as a detailed bank statement for your business.' },
        { term: 'Account', desc: 'A category for grouping transactions, such as "Rent Income," "Maintenance Expense," "Construction Budget."' },
        { term: 'Credit / Debit', desc: 'Credit = money received (positive). Debit = money spent (negative).' },
        { term: 'Transaction Date', desc: 'The date the transaction occurred.' },
        { term: 'Reference / Description', desc: 'A note explaining what the transaction is for (e.g., "January rent — Unit 3A").' },
        { term: 'Linked Entity', desc: 'The related record — e.g., a tenant lease, a CRM deal, or a construction project.' },
        { term: 'Balance', desc: 'Running total after each transaction, showing your current financial position.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Recording an Income Transaction: Go to Finance, click "Add Transaction." Select the account (e.g., Rent Income), enter amount as credit, add description, and link to the relevant lease or deal if applicable.',
        'Recording an Expense: Follow the same steps but enter the amount as a debit. Link to maintenance request or construction project as needed.',
        'Viewing the Ledger: Go to the Ledger tab to see all transactions in date order. Use filters to view by date range, account, or linked entity.',
        'Searching / Filtering: Use the search bar for keywords. Filter by date range, account type, or transaction type (credit/debit).',
        'Exporting Data: Use the export button to download the ledger as PDF or Excel for external reporting.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Tenants: Rent payments from tenants appear as credit transactions linked to the lease.',
        'CRM: Deal payments (down payments, installments) from CRM deals appear as credit transactions.',
        'Construction: Project costs appear as debit transactions linked to the construction project.',
        'Maintenance: Repair costs appear as debit transactions linked to the maintenance request.',
        'Reports: Financial data is used in Profit & Loss, Balance Sheet, and custom financial reports.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Why is a transaction not appearing in the ledger?', desc: 'Check your date range filter. The default view may only show recent transactions. Clear filters to see all records.' },
        { term: 'Can I edit a transaction after it is recorded?', desc: 'Yes. Find the transaction in the ledger and click edit. Be careful — changing past transactions affects balances and reports.' },
        { term: 'How do I handle refunds or cancellations?', desc: 'Record a reversing transaction (opposite credit/debit) with a reference to the original transaction.' },
        { term: 'Can I link one transaction to multiple entities?', desc: 'Each transaction links to one primary entity. Split the amount across multiple transactions if needed.' },
      ],
    },
    {
      heading: 'Tips / Best Practices',
      items: [
        'Record transactions as they happen, not at the end of the month — this keeps your ledger accurate and reports meaningful.',
        'Always link transactions to the relevant entity (lease, deal, project) for full audit trail visibility.',
        'Use descriptive references — "Rent from John Doe for Jan 2025" is much more useful than "Rent payment."',
      ],
    },
  ],
}
