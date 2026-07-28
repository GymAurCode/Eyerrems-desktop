import type { ModuleDoc } from './index'

export const townsDocs: ModuleDoc = {
  title: 'Towns',
  icon: 'ti-map-pin',
  color: '#F59E0B',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Towns module lets you manage the geographic areas where your properties are located. It acts as a location catalog that properties reference.',
        'Organizing properties by town makes it easier to filter reports, run location-based searches, and understand your market presence.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Town Name', desc: 'The official name of the town or municipality.' },
        { term: 'Region / District', desc: 'The larger administrative region the town belongs to (optional).' },
        { term: 'Description', desc: 'Notes about the town, such as demographics, development status, or market notes.' },
        { term: 'Status', desc: 'Whether the town is Active or Inactive. Inactive towns are hidden from property dropdowns.' },
        { term: 'Property Count', desc: 'Automatically computed number of properties linked to this town.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Adding a Town: Click "Add Town," enter the name and region, and save.',
        'Editing a Town: Click the edit icon next to a town. Update fields and save.',
        'Deleting a Town: Only possible if no properties are linked to the town. Otherwise, set the town to Inactive instead.',
        'Searching: Use the search bar to find towns by name or region.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Properties: Every property is assigned to a town. Deleting or deactivating a town affects property dropdowns.',
        'Reports: Town-level filters are available in Reports to analyze property distribution by location.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Can I delete a town that has properties?', desc: 'No. You must first reassign or delete the linked properties, or set the town to Inactive.' },
        { term: 'What is the difference between Active and Inactive?', desc: 'Active towns appear in property dropdowns and filters. Inactive towns are hidden but their data is preserved.' },
        { term: 'Can I bulk import towns?', desc: 'Yes, use the Import Center with a properly formatted CSV or XLSX file.' },
      ],
    },
  ],
}
