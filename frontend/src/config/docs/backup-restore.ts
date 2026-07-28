import type { ModuleDoc } from './index'

export const backupRestoreDocs: ModuleDoc = {
  title: 'Backup & Restore',
  icon: 'ti-shield',
  color: '#059669',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Backup & Restore module lets you create secure backups of your entire system data and restore from previous backups when needed.',
        'Regular backups protect your business data against hardware failure, data corruption, or accidental mass deletion.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Backup', desc: 'A complete snapshot of your database at a point in time. Backups include all modules, settings, and user data.' },
        { term: 'Restore', desc: 'Replacing the current database with data from a previous backup. This overwrites all existing data.' },
        { term: 'Backup Date', desc: 'The timestamp when the backup was created.' },
        { term: 'Backup Size', desc: 'The file size of the backup (e.g., 15 MB, 120 MB).' },
        { term: 'Automatic Backup', desc: 'Backups that are scheduled to run automatically (daily/weekly). Requires configuration in settings.' },
        { term: 'Manual Backup', desc: 'A one-time backup initiated by the user on demand.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Creating a Backup: Go to Backup & Restore, click "Create Backup." The system takes a snapshot and displays it in the backup list.',
        'Scheduling Automatic Backups: Go to Settings, configure the backup frequency (Daily/Weekly) and retention count.',
        'Restoring from a Backup: Select a backup from the list, click "Restore." Read the warning carefully — this replaces all current data. Confirm to proceed.',
        'Downloading a Backup: Click the download icon next to a backup to save it to your local machine for off-site storage.',
        'Deleting Old Backups: Select outdated backups and click "Delete" to free up storage space.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'All modules are included in every backup. A restore affects the entire system.',
        'Recycle Bin: Backed-up data can be restored even after permanent deletion from the Recycle Bin.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'How long does a backup take?', desc: 'Depends on your database size. Small databases (under 100 MB) typically take a few seconds. Larger databases may take a minute or more.' },
        { term: 'Will restoring a backup affect currently logged-in users?', desc: 'Yes. All users will be logged out when a restore is performed, and any data changes since the backup will be lost.' },
        { term: 'How many backups should I keep?', desc: 'We recommend keeping at least 7 daily backups or 4 weekly backups. Adjust based on your data change frequency and storage capacity.' },
        { term: 'Can I restore a single module instead of the whole database?', desc: 'The current version restores the entire database. Module-level restore is not yet supported.' },
      ],
    },
    {
      heading: 'Tips / Best Practices',
      items: [
        'Schedule automatic backups during low-usage hours (e.g., 2:00 AM) to minimize disruption.',
        'Download a backup to external storage before performing major system changes or updates.',
        'Test your backup restore process periodically to ensure backups are valid.',
      ],
    },
  ],
}
