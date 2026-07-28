import type { ModuleDoc } from './index'

export const spreadsheetDocs: ModuleDoc = {
  title: 'Spreadsheet',
  icon: 'ti-table',
  color: '#008080',
  sections: [
    {
      heading: 'Overview',
      items: [
        'The Spreadsheet module provides a powerful spreadsheet interface within the app, similar to Excel or Google Sheets. It allows you to create, edit, and manage data in tabular format.',
        'Use it for custom data tracking, bulk data entry, calculations, and analysis without leaving the application.',
      ],
    },
    {
      heading: 'Key Concepts / Fields',
      items: [
        { term: 'Workbook', desc: 'A file/container that holds one or more spreadsheets.' },
        { term: 'Worksheet / Sheet', desc: 'An individual grid within a workbook, composed of rows and columns.' },
        { term: 'Cell', desc: 'The intersection of a row and column. Each cell can contain text, numbers, or formulas.' },
        { term: 'Formula', desc: 'A mathematical expression that calculates a value (e.g., SUM, AVERAGE). Powered by HyperFormula engine.' },
        { term: 'Row / Column', desc: 'Rows run horizontally (numbered), columns run vertically (lettered).' },
      ],
    },
    {
      heading: 'Step-by-Step Usage',
      items: [
        'Creating a Spreadsheet: Go to Spreadsheet, click "New Workbook." A blank grid opens.',
        'Editing Cells: Click on a cell and type. Press Enter to confirm or Escape to cancel.',
        'Using Formulas: Type = followed by a formula (e.g., =SUM(A1:A10)). Press Enter to calculate.',
        'Importing Data: Use the Import function to load CSV or XLSX files into the spreadsheet.',
        'Exporting Data: Use Export to download the sheet as CSV, XLSX, or PDF.',
        'Saving: Spreadsheets auto-save as you work. Manual save is also available.',
      ],
    },
    {
      heading: 'Relationships to Other Modules',
      items: [
        'Import Center: The Product Spreadsheet is a specialized spreadsheet for managing inventory/product data.',
        'Reports: Spreadsheet data can be used alongside Reports for custom analysis.',
      ],
    },
    {
      heading: 'Common Issues / FAQs',
      items: [
        { term: 'Does the spreadsheet support all Excel formulas?', desc: 'Most common formulas are supported via the HyperFormula engine. Complex or very new Excel functions may not be available.' },
        { term: 'Can I collaborate with others in real-time?', desc: 'The current version supports single-user editing. Multi-user collaboration may be added in future updates.' },
        { term: 'How do I undo a change?', desc: 'Use Ctrl+Z (Windows) or Cmd+Z (Mac) to undo recent changes.' },
      ],
    },
  ],
}
