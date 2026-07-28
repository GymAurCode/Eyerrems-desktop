import type { ModuleDoc } from './index'

export const remindersDocs: ModuleDoc = {
  title: 'Reminders & Notifications',
  icon: 'ti-bell-ringing',
  color: '#F43F5E',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Reminders module helps you stay on top of important dates and tasks. You can create one-time or recurring reminders for rent collection, lease renewals, maintenance schedules, and more.',
        'Reminders can trigger in-app notifications, and optionally send email or WhatsApp alerts to relevant parties.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Reminder Title', desc: 'A short description of what the reminder is for (e.g., "Rent due — Unit 5B").' },
        { term: 'Due Date / Time', desc: 'When the reminder should trigger.' },
        { term: 'Repeat', desc: 'How often the reminder repeats: None (one-time), Daily, Weekly, Monthly, or Yearly.' },
        { term: 'Priority', desc: 'Importance level: Low, Medium, High. Affects how prominently the reminder is displayed.' },
        { term: 'Linked Record', desc: 'The related entity (property, tenant, lease, deal) the reminder is associated with.' },
        { term: 'Notification Method', desc: 'How you are alerted: in-app notification, email, WhatsApp, or all of the above.' },
        { term: 'Status', desc: 'Pending (upcoming), Completed (done), or Missed (past due without completion).' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Creating a Reminder: Click "Add Reminder." Enter a title, set the due date/time, choose repeat frequency, and select the notification method.',
        'Linking to a Record: Use the "Link To" field to associate the reminder with a property, tenant, lease, or other record.',
        'Marking as Complete: When the task is done, click the checkbox next to the reminder to mark it as Completed.',
        'Viewing Missed Reminders: The notification center (bell icon in the top bar) shows missed and upcoming reminders.',
        'Editing / Deleting: Click the edit or delete icon on any reminder to modify or remove it.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Tenants: Create reminders for rent collection, lease expiry, or tenant follow-ups.',
        'Maintenance: Set reminders for scheduled maintenance inspections or recurring service tasks.',
        'CRM: Remind yourself to follow up on leads, deals, or booking expirations.',
        'Communication: If configured, reminders can send automated email or WhatsApp alerts.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'I am not receiving notification alerts. Why?', desc: 'Check your notification settings. Ensure in-app notifications are enabled and your browser/Electron app allows notifications.' },
        { term: 'Can a reminder repeat every 2 weeks?', desc: 'Currently supported frequencies are Daily, Weekly, Monthly, and Yearly. For bi-weekly, create a Monthly reminder set to the 1st and 15th.' },
        { term: 'What happens when a reminder is missed?', desc: 'It moves to the "Missed" section in the notification center. You can mark it as complete or reschedule it.' },
        { term: 'Can other users see my reminders?', desc: 'Reminders are personal by default. Admins may have visibility into all reminders depending on permissions.' },
      ],
    },
  ],
}
