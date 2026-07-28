import type { ModuleDoc } from './index'

export const recycleBinDocs: ModuleDoc = {
  title: 'Recycle Bin',
  icon: 'ti-trash',
  color: '#6B7280',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Recycle Bin temporarily stores deleted records from all modules, acting as a safety net against accidental data loss.',
        'Records in the Recycle Bin can be restored to their original location or permanently deleted after a retention period.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Deleted Records', desc: 'Items that were deleted from any module. Each entry shows the original module, record name, deletion date, and who deleted it.' },
        { term: 'Restore', desc: 'Returning a deleted record to its original module with all its data intact.' },
        { term: 'Permanent Delete', desc: 'Removing a record from the Recycle Bin entirely. This action cannot be undone.' },
        { term: 'Retention Period', desc: 'The number of days a record stays in the Recycle Bin before automatic permanent deletion.' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Viewing Deleted Records: Go to Recycle Bin. All deleted records are listed with their source module, name, and deletion date.',
        'Restoring a Record: Click the "Restore" button next to a record. It is returned to its original module.',
        'Bulk Restore: Select multiple records using checkboxes and click "Restore Selected."',
        'Permanent Deletion: Click "Delete Forever" to permanently remove a record. Confirm the action.',
        'Emptying the Recycle Bin: Use "Empty All" to permanently delete all records in the bin (use with caution).',
        'Searching / Filtering: Filter by source module or search by record name to find specific deleted items.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'All modules send deleted records to the Recycle Bin. Restoring returns the record to its original module.',
        'Permanent deletion from Recycle Bin is irreversible — backed up data may still be available via Backup & Restore.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'How long do records stay in the Recycle Bin?', desc: 'The default retention period is 30 days. This can be configured in Admin settings.' },
        { term: 'Can I restore a record that was permanently deleted?', desc: 'No. Permanent deletion removes the record from the database. Restore from a backup if available.' },
        { term: 'Why can\'t I find a deleted record?', desc: 'It may have been automatically purged after the retention period, or you may have filtered by the wrong module.' },
      ],
    },
  ],
}
