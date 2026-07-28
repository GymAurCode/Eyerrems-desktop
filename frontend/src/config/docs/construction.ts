import type { ModuleDoc } from './index'

export const constructionDocs: ModuleDoc = {
  title: 'Construction',
  icon: 'ti-building-skyscraper',
  color: '#EF4444',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Construction module manages building or renovation projects from start to finish. It tracks every phase of construction, including planning, approvals, costs, materials, contractors, and timelines.',
        'Each construction project is linked to a property record, meaning the system bridges the gap between "land/planned unit" and "completed, rentable asset."',
        'This module is designed for real estate developers, project managers, and site supervisors who need a single source of truth for all construction activity.',
      ],
    },
    {
      heading: 'All Properties / Fields Explained',
      items: [
        { term: 'Project Name', desc: 'A recognizable name for the construction project (e.g., "Tower A — 12th Floor Finishing").' },
        { term: 'Project Code / Reference', desc: 'A unique alphanumeric identifier generated automatically or entered manually for internal tracking.' },
        { term: 'Linked Property', desc: 'The property record this project belongs to. A project can be linked to one property (building/plot), and within that, optionally to a specific unit.' },
        { term: 'Linked Unit', desc: 'Optional. If the project is for a specific apartment or office within a multi-unit property, select the unit here.' },
        { term: 'Status', desc: 'The overall project status — see the lifecycle section below for all statuses and transitions.' },
        { term: 'Stage / Phase', desc: 'A sub-status indicating the current construction phase (e.g., Foundation, Framing, Roofing, Finishing, Handover). Stages are sequential.' },
        { term: 'Start Date', desc: 'The planned or actual date construction began.' },
        { term: 'Expected End Date', desc: 'The target completion date set during planning.' },
        { term: 'Actual End Date', desc: 'The date construction was actually completed. Used to measure delays.' },
        { term: 'Budget (Estimated Cost)', desc: 'The total estimated cost for the project, set during the planning phase.' },
        { term: 'Actual Cost', desc: 'The running total of money spent so far. Updated as expenses are added.' },
        { term: 'Cost Breakdown', desc: 'Detailed cost categories: materials, labor, permits, equipment, contingency, etc. Each can have estimated and actual amounts.' },
        { term: 'Contractor / Vendor', desc: 'The external company or individual hired to execute the work. Linked from a contractors list or entered manually.' },
        { term: 'Site Supervisor / Project Manager', desc: 'The internal staff member responsible for overseeing the project. Linked from the HR module.' },
        { term: 'Attachments / Documents', desc: 'Blueprints, permits, inspection reports, progress photos, and contracts uploaded to the project record.' },
        { term: 'Approvals', desc: 'A record of required approvals (municipal permits, engineering sign-offs, safety inspections) with status (Pending, Approved, Rejected) and date.' },
        { term: 'Progress Percentage', desc: 'A calculated or manually entered percentage of completion (0–100%). May auto-calculate based on completed stages.' },
        { term: 'Notes / Remarks', desc: 'Free-text field for internal communication about the project — issues, decisions, change orders.' },
        { term: 'Priority', desc: 'Indicates importance: Low, Medium, High, or Critical. Affects dashboard visibility.' },
      ],
    },
    {
      heading: 'Full Lifecycle / Workflow',
      items: [
        { term: '1. Planned', desc: 'The project is proposed but not yet approved. Budget is estimated, high-level timeline is set. No work has started.' },
        { term: '2. Approved', desc: 'Management has approved the project. Budget is confirmed, contractor bidding may begin.' },
        { term: '3. In Progress', desc: 'Construction is actively underway. The Stage/Phase field tracks which construction phase is current. Costs are being incurred and recorded. Progress % updates as stages complete.' },
        { term: '4. On Hold', desc: 'Work has been paused due to weather, funding delays, permit issues, or other reasons. The project can resume to In Progress later.' },
        { term: '5. Completed', desc: 'All construction work is finished. Final inspections are done. The system may optionally update the linked property status to "Available."' },
        { term: '6. Cancelled', desc: 'The project was terminated before completion. No further costs should be booked against it.' },
        { term: 'Stage Progression', desc: 'Within In Progress status, stages typically flow: Foundation → Framing → Roofing → Electrical/Plumbing → Finishing → Landscaping → Handover. You can customize these stages per project.' },
      ],
    },
    {
      heading: 'How Construction Connects to Property Records',
      items: [
        'Each construction project is linked to exactly one property record in the Properties module. This link is mandatory.',
        'If the project is for a specific unit within a multi-unit property, the Link Unit field is also set. Otherwise, the project applies to the entire property.',
        'When a project reaches "Completed" status, the system can automatically update the linked property\'s status from "Under Construction" to "Available" (configurable in settings).',
        'Property details (address, town, size) are inherited from the linked property record and displayed on the construction dashboard for context.',
        'If multiple construction projects exist for the same property (e.g., phased development), each project is tracked independently but all link back to the same property record.',
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Creating a Project: Go to Construction > Projects, click "New Project." Select the linked property, enter the project name, budget, and planned dates. Set status to "Planned."',
        'Adding Cost Breakdown: Open the project, go to the Costs tab. Add line items for materials, labor, permits, etc. Enter estimated and actual amounts.',
        'Assigning a Contractor: In the project details, use the Contractor field to select from your vendor list or type a name.',
        'Linking Documents: Use the Attachments section to upload blueprints, permits, and progress photos. Each attachment can have a description and category.',
        'Updating Progress: As work completes, update the Stage/Phase field and the Progress Percentage. This is reflected on the Construction Dashboard.',
        'Recording Approvals: Navigate to the Approvals tab. Add each required approval with its status and date. Upload the approval document.',
        'Marking as Complete: When all work is done, set status to "Completed" and enter the Actual End Date. Confirm whether to update the linked property status.',
        'Searching / Filtering: Search by project name, code, or linked property. Filter by status, stage, priority, or assigned supervisor.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Properties: Each project links to one property (and optionally one unit). Completion may update property status.',
        'HR: The site supervisor / project manager is a staff record from the HR module.',
        'Finance: All project costs flow into financial reports. Budget vs. actual comparisons are available.',
        'Reports: Construction-specific reports show project progress, cost variance, and timeline adherence.',
        'CRM: If a property under construction is booked by a client, the CRM booking references the property, and the construction timeline affects the handover date.',
      ],
    },
    {
      heading: 'Confusion Points',
      items: [
        { term: 'Status vs. Stage — what is the difference?', desc: 'Status is the project-level lifecycle (Planned → Approved → In Progress → Completed). Stage is the construction-specific phase within In Progress (Foundation, Framing, etc.). Think of Status as "where we are in the project lifecycle" and Stage as "what physical work is being done."' },
        { term: 'When do I use "On Hold" vs. "Cancelled"?', desc: 'Use "On Hold" when the project is temporarily paused and expected to resume. Use "Cancelled" when the project is terminated permanently and will never resume.' },
        { term: 'Estimated Cost vs. Actual Cost', desc: 'Estimated Cost is the budget set during planning. Actual Cost is the sum of all money spent. The difference shows cost variance. Always update Actual Cost as expenses occur, not just at the end.' },
        { term: 'Does completing a construction project automatically change the property status?', desc: 'This is optional and configurable. If enabled in settings, marking a project as "Completed" will update the linked property\'s status to "Available." If disabled, you must update it manually.' },
        { term: 'Can one property have multiple construction projects?', desc: 'Yes. For example, a large building might have separate projects for structural work, interior finishing, and landscaping. Each project links to the same property but is tracked independently.' },
      ],
    },
    {
      heading: 'Tips / Best Practices',
      items: [
        'Always link every construction project to the correct property record — this ensures accurate reporting and automated status updates.',
        'Update cost breakdowns weekly, not just at the end. This gives you real-time budget vs. actual visibility.',
        'Upload permits and approvals as soon as they are received. The Approvals tab serves as your compliance audit trail.',
        'Use the Notes/Remarks field to document decisions and change orders — this prevents disputes later.',
        'Set realistic Expected End Dates based on contractor input, then track variance to improve future estimates.',
      ],
    },
  ],
}
