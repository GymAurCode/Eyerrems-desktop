import type { ModuleDoc } from './index'

export const propertiesDocs: ModuleDoc = {
  title: 'Properties',
  icon: 'ti-building',
  color: '#10B981',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Properties module is the central repository for all real estate assets. You can add, edit, search, and manage every property your company owns or manages.',
        'Properties can be of different types (plots, apartments, commercial units, buildings, etc.) and can be organized by town, location, and status.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Property Name / Title', desc: 'A descriptive name for the property (e.g., "Sunrise Apartments Block A").' },
        { term: 'Property Type', desc: 'The category of property — Plot, Apartment, Commercial, Building, Villa, etc.' },
        { term: 'Status', desc: 'Current condition: Available, Sold, Rented, Under Construction, Blocked, or Pending Approval.' },
        { term: 'Location / Address', desc: 'Physical address including street, city, town, and region.' },
        { term: 'Town', desc: 'The town or municipality the property belongs to. Linked to the Towns module.' },
        { term: 'Price / Rent Amount', desc: 'Sale price or monthly rental amount for the property.' },
        { term: 'Size / Area', desc: 'Total area in square feet, square meters, or other configured unit.' },
        { term: 'Bedrooms / Bathrooms', desc: 'Number of bedrooms and bathrooms (for residential units).' },
        { term: 'Owner / Landlord', desc: 'The person or entity that owns the property (if different from your company).' },
        { term: 'Description', desc: 'Free-text notes about the property, features, furnishings, or condition.' },
        { term: 'Attachments', desc: 'Uploaded documents, images, floor plans, and deeds associated with the property.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Adding a Property: Click the "Add Property" button. Fill in required fields (name, type, town, status). Save to create the record.',
        'Editing a Property: Find the property in the list, click the edit/pencil icon. Update fields and save.',
        'Deleting a Property: Locate the property, open the actions menu, and select "Delete." Confirm the action. Deleted items may go to the Recycle Bin first.',
        'Searching / Filtering: Use the search bar to find by name or address. Use filter dropdowns to narrow by type, status, or town.',
        'Viewing Details: Click on a property row to open the detailed view showing all fields, attachments, linked tenants, and construction projects.',
        'Bulk Import: Use the Import Center to add many properties at once from a spreadsheet (CSV/XLSX).',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Towns: Each property is assigned to a town managed in the Towns module.',
        'Tenants: Properties with rental units can have one or more tenants linked via leases.',
        'Construction: Construction projects are linked to properties. Completing a construction project can update the property status from "Under Construction" to "Available."',
        'CRM: Deals and bookings reference specific properties. A booking holds a property for a client.',
        'Finance: Property values and transactions (purchase, sale, rental income) are tracked in the Finance module.',
        'Maintenance: Maintenance requests can be raised against specific properties or units.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Can I assign one property to multiple tenants?', desc: 'Yes, if the property has multiple units. Each unit can have its own lease and tenant.' },
        { term: 'What happens when I delete a property?', desc: 'It is moved to the Recycle Bin. An admin can permanently delete or restore it within a retention period.' },
        { term: 'How do I change a property from "Under Construction" to "Available"?', desc: 'You can update the status manually in the edit form, or it may update automatically when a linked construction project is completed (depending on configuration).' },
        { term: 'Why can\'t I see the property I just added?', desc: 'Check your active filters. Clear all filters to see all properties, or use the search bar.' },
      ],
    },
  ],
}
