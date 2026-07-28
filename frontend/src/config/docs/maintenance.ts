import type { ModuleDoc } from './index'

export const maintenanceDocs: ModuleDoc = {
  title: 'Maintenance',
  icon: 'ti-tool',
  color: '#F97316',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Maintenance module handles repair and upkeep requests for properties. Tenants or staff can submit requests, which are then tracked through to resolution.',
        'It ensures no maintenance issue is overlooked, with clear assignment, priority levels, and status tracking from submission to completion.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Request Title', desc: 'A brief summary of the maintenance issue (e.g., "Leaking faucet in kitchen").' },
        { term: 'Property / Unit', desc: 'The property and specific unit where the issue exists.' },
        { term: 'Requested By', desc: 'The person who submitted the request — either a tenant or a staff member.' },
        { term: 'Priority', desc: 'Urgency level: Low, Medium, High, or Emergency. Determines response time expectations.' },
        { term: 'Status', desc: 'Current state: Open, Assigned, In Progress, Resolved, or Closed.' },
        { term: 'Assigned To', desc: 'The staff member or vendor responsible for completing the work.' },
        { term: 'Description', desc: 'Detailed explanation of the issue, including location, symptoms, and any relevant context.' },
        { term: 'Cost', desc: 'The cost of repairs (parts, labor, etc.). Tracked for financial reporting.' },
        { term: 'Attachments', desc: 'Photos or documents showing the issue or repair work completed.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Submitting a Request: Click "New Request." Select the property/unit, enter a title, description, and priority level.',
        'Assigning a Technician: As an admin, open the request and use the "Assign" button to select a staff member or vendor.',
        'Updating Status: The assigned person updates the status as work progresses (In Progress → Resolved).',
        'Closing a Request: After the tenant or admin confirms the issue is fixed, mark it as "Closed."',
        'Adding Costs: When closing or editing, enter the total cost for financial tracking.',
        'Searching / Filtering: Filter by status, priority, property, or assigned person. Use the search bar for keywords.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Properties: All requests are linked to a property/unit. Maintenance history is visible from the property detail page.',
        'Tenants: Tenants can submit requests directly, and their contact info is available for follow-up.',
        'Finance: Maintenance costs are recorded and appear in financial reports as operational expenses.',
        'HR: Maintenance staff are managed in the HR module and can be assigned to requests.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Can a tenant submit a request themselves?', desc: 'Yes, if they have access to the system. Otherwise, staff can submit on their behalf.' },
        { term: 'What priority should I use?', desc: 'Use "Emergency" for issues posing safety risks (gas leak, electrical fault). "High" for significant discomfort (no AC in summer). "Medium"/"Low" for cosmetic or minor issues.' },
        { term: 'Can I track recurring maintenance?', desc: 'Yes. Create recurring requests using the schedule/reminder feature if available, or manually create regular entries.' },
        { term: 'How do I handle costs across multiple requests?', desc: 'Each request has its own cost field. For bulk work (e.g., a vendor servicing multiple units), you can itemize within one request or create separate requests.' },
      ],
    },
  ],
}
