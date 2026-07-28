import type { ModuleDoc } from './index'

export const adminDocs: ModuleDoc = {
  title: 'Admin',
  icon: 'ti-settings',
  color: '#1F2937',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Admin module is the control center for your system configuration. From here, you manage users, roles, permissions, and system-wide settings.',
        'Only users with administrative privileges can access this module. Changes made here affect how all other users experience the system.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Users', desc: 'Individual accounts that can log into the system. Each user has a role that determines their permissions.' },
        { term: 'Roles', desc: 'A named set of permissions (e.g., Admin, Manager, Agent, Viewer). Roles make it easy to assign consistent permissions to groups of users.' },
        { term: 'Permissions', desc: 'Granular access rights that control what a user can view, create, edit, or delete in each module.' },
        { term: 'Company Settings', desc: 'Global configuration options including company name, logo, default currency, and feature toggles.' },
        { term: 'Feature Flags', desc: 'Toggle specific modules or features on/off for your company. A disabled feature is hidden from all users.' },
        { term: 'Activity Log', desc: 'A record of all significant actions taken in the system, useful for auditing and troubleshooting.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Adding a User: Go to Admin > Users, click "Add User." Enter name, email, and assign a role. The user will receive login instructions.',
        'Creating a Role: Go to Admin > Roles, click "Add Role." Name the role and select the permissions to grant. Save to create.',
        'Editing Permissions: Open a role, toggle permissions on/off for each module. Changes take effect immediately.',
        'Viewing Activity Log: Go to Admin > Activity Log to see a chronological list of system actions with user and timestamp.',
        'Configuring Settings: Go to Admin > Settings to update company info, default currency, and enable/disable feature flags.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Every module is affected by Admin settings — feature flags enable/disable entire modules, and permissions control access within them.',
        'The Activity Log records actions from all modules, making it the central audit trail.',
        'Advance Options (accessible from the top bar) contains additional advanced administrative features.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'I accidentally removed my own admin permissions. What do I do?', desc: 'Contact another admin or the super admin to restore your permissions. If you are the only admin, you may need backend / database assistance.' },
        { term: 'Why can\'t a user see a module?', desc: 'Check two things: (1) the feature flag for that module is enabled in Settings, and (2) the user\'s role has the required permission.' },
        { term: 'Can I export the activity log?', desc: 'Yes. The activity log can be exported as PDF or Excel for external auditing.' },
        { term: 'What is the difference between Admin and Super Admin?', desc: 'Admins manage their own company\'s settings and users. Super Admins manage all companies and have access to the Super Admin panel at /superadmin.' },
      ],
    },
    {
      heading: 'Tips / Best Practices',
      items: [
        'Use roles instead of assigning permissions to individual users — it is much easier to manage.',
        'Regularly review the activity log to spot unusual behavior or unauthorized access attempts.',
        'Before disabling a feature flag, notify affected users to avoid confusion.',
      ],
    },
  ],
}
