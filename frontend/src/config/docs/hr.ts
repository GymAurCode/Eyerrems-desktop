import type { ModuleDoc } from './index'

export const hrDocs: ModuleDoc = {
  title: 'HR (Human Resources)',
  icon: 'ti-briefcase',
  color: '#EC4899',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The HR module manages your company\'s employees and organizational structure. It stores staff profiles, roles, contact information, and employment details.',
        'HR records are referenced by other modules (Maintenance, Construction, etc.) when assigning tasks or responsibilities to specific staff members.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Employee Name', desc: 'Full legal name of the staff member.' },
        { term: 'Employee ID / Code', desc: 'A unique identifier for the employee (auto-generated or manual).' },
        { term: 'Department', desc: 'The department the employee belongs to (e.g., Sales, Maintenance, Construction, Admin).' },
        { term: 'Job Title / Designation', desc: 'The employee\'s role (e.g., Site Supervisor, Accountant, Property Manager).' },
        { term: 'Contact Info', desc: 'Phone number, email address, and emergency contact.' },
        { term: 'Date of Joining', desc: 'The date the employee started working.' },
        { term: 'Employment Type', desc: 'Full-time, Part-time, Contract, or Intern.' },
        { term: 'Status', desc: 'Active (currently employed) or Inactive (resigned or terminated).' },
        { term: 'Salary / Pay Rate', desc: 'Monthly or hourly pay rate (optional, for payroll tracking).' },
        { term: 'Documents', desc: 'Uploaded CV/resume, contract, ID proof, and certifications.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Adding an Employee: Click "Add Employee." Enter personal details, department, job title, and save.',
        'Editing an Employee: Find the employee in the list, click the edit icon. Update fields as needed.',
        'Deactivating an Employee: Set status to "Inactive" when an employee leaves. Their data is preserved but they are hidden from assignment dropdowns.',
        'Searching / Filtering: Search by name, department, or job title. Filter by status or department.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Maintenance: Employees can be assigned as technicians for maintenance requests.',
        'Construction: Employees serve as site supervisors or project managers on construction projects.',
        'Admin: Employee roles and permissions are managed in the Admin > Users section.',
        'Finance: Salary data may feed into payroll calculations (if integrated).',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Can I assign an employee to multiple roles?', desc: 'Yes. An employee can be assigned as a maintenance technician and a construction supervisor simultaneously.' },
        { term: 'What happens when I deactivate an employee?', desc: 'They are removed from assignment dropdowns but their historical assignments (past maintenance requests, projects) remain intact.' },
        { term: 'Can I delete an employee permanently?', desc: 'It is recommended to deactivate rather than delete to preserve audit trails. Deletion may be restricted based on permissions.' },
      ],
    },
  ],
}
