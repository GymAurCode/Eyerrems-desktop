import type { ModuleDoc } from './index'

export const communicationDocs: ModuleDoc = {
  title: 'Communication (Email & WhatsApp)',
  icon: 'ti-mail',
  color: '#3B82F6',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Communication module integrates email and WhatsApp messaging directly into the application, allowing you to reach tenants, clients, and vendors without switching to external tools.',
        'It maintains a history of all communications linked to their respective records (tenant, client, deal, property), providing a complete conversation audit trail.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Email', desc: 'Send and receive emails within the app. Emails are linked to contacts and records.' },
        { term: 'WhatsApp', desc: 'Send WhatsApp messages to contacts whose phone numbers are registered on WhatsApp.' },
        { term: 'Conversation Thread', desc: 'A grouped view of all messages exchanged with a particular contact.' },
        { term: 'Template', desc: 'Pre-written message templates for common scenarios (e.g., rent reminder, welcome message).' },
        { term: 'Attachment', desc: 'Files (PDF, images) that can be sent alongside emails or WhatsApp messages.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Sending an Email: Go to Communication > Email. Click "Compose." Select the recipient from contacts, write the subject and body, and send.',
        'Sending a WhatsApp Message: Go to Communication > WhatsApp. Select a contact, type your message, and click Send.',
        'Using a Template: When composing, click "Insert Template." Choose the appropriate template and customize as needed.',
        'Viewing History: Open any tenant or client record and scroll to the Communication section to see all past emails and messages.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'CRM: Send emails or WhatsApp messages directly from lead, client, or deal records.',
        'Tenants: Communicate with tenants about rent, maintenance, or lease renewals.',
        'Reminders: Automated reminders can be sent via email or WhatsApp if configured.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Do I need an email server configured?', desc: 'Yes. An email server (SMTP) must be configured in settings for outgoing emails. Incoming email may require IMAP/POP3 setup.' },
        { term: 'WhatsApp is not working. What should I check?', desc: 'Ensure the recipient\'s phone number includes the country code and is registered on WhatsApp. Check your WhatsApp API configuration in settings.' },
        { term: 'Can I send bulk messages?', desc: 'Yes. You can select multiple contacts and send a broadcast message via email or WhatsApp.' },
      ],
    },
  ],
}
