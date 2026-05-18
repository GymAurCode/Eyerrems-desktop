# DataTable Container System

A professional, reusable data table container system for the enterprise REMS application. This system provides a consistent, feature-rich table experience across all modules.

## Features

### ✅ Professional Container Layout
- Boxed/card layout with consistent styling
- Dark/light theme support
- Responsive design
- Proper shadows and borders

### ✅ Integrated Search & Filters
- Global search with debounced input
- Dynamic filter system per module
- Multiple filter types (text, select, date, number, boolean)
- Active filter indicators
- Clear filters functionality

### ✅ Advanced Pagination
- Professional pagination controls
- Rows per page selector (10, 20, 50, 100)
- Page jump functionality
- Item count display
- First/last page navigation

### ✅ Sorting & Selection
- Column-based sorting with visual indicators
- Multi-row selection with checkboxes
- Select all/clear all functionality
- Bulk actions for selected rows

### ✅ Actions System
- Row-level actions (edit, delete, custom)
- Bulk actions for multiple rows
- Toolbar actions (add, import, export)
- Permission-based action visibility

### ✅ Professional UX
- Loading states with skeletons
- Empty states with helpful messaging
- Error handling and display
- Hover effects and transitions
- Sticky headers option

### ✅ Performance Optimized
- Memoized components
- Efficient re-rendering
- Client-side and server-side pagination support
- Debounced search input

## Quick Start

```tsx
import { DataTable, TableColumn } from '../components/data-table';

interface User {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

const columns: TableColumn<User>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
];

function UserTable() {
  const [users, setUsers] = useState<User[]>([]);
  
  return (
    <DataTable
      title="Users"
      data={users}
      columns={columns}
      searchable={true}
      selectable={true}
    />
  );
}
```

## Column Configuration

```tsx
const columns: TableColumn<Employee>[] = [
  {
    key: 'name',
    label: 'Employee Name',
    sortable: true,
    width: 200,
    render: (value, row) => (
      <div className="flex items-center gap-2">
        <Avatar src={row.avatar} />
        <span className="font-medium">{value}</span>
      </div>
    ),
  },
  {
    key: 'salary',
    label: 'Salary',
    align: 'right',
    render: (value) => formatCurrency(value),
  },
];
```

## Filters Configuration

```tsx
const filters: TableFilter[] = [
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: [
      { label: 'Engineering', value: 'engineering' },
      { label: 'Marketing', value: 'marketing' },
    ],
  },
  {
    key: 'hire_date',
    label: 'Hire Date',
    type: 'daterange',
  },
  {
    key: 'active',
    label: 'Active Status',
    type: 'boolean',
  },
];
```

## Actions Configuration

```tsx
const rowActions: TableAction<Employee>[] = [
  {
    key: 'edit',
    label: 'Edit',
    icon: Edit2,
    variant: 'secondary',
    onClick: (employee) => editEmployee(employee),
    permission: 'hr:manage',
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'danger',
    onClick: (employee) => deleteEmployee(employee),
    disabled: (employee) => employee.status === 'active',
  },
];

const bulkActions: BulkAction<Employee>[] = [
  {
    key: 'activate',
    label: 'Activate Selected',
    variant: 'success',
    onClick: (employees) => activateEmployees(employees),
  },
];

const toolbarActions: TableToolbarAction[] = [
  {
    key: 'add',
    label: 'Add Employee',
    icon: Plus,
    variant: 'primary',
    onClick: () => openAddDialog(),
  },
];
```

## Advanced Usage

### Controlled vs Uncontrolled

The DataTable supports both controlled and uncontrolled modes:

```tsx
// Uncontrolled (DataTable manages state internally)
<DataTable data={data} columns={columns} />

// Controlled (You manage state externally)
<DataTable
  data={data}
  columns={columns}
  sortConfig={sortConfig}
  onSort={setSortConfig}
  pagination={pagination}
  onPaginationChange={setPagination}
  filterValues={filters}
  onFilterChange={setFilters}
  searchValue={search}
  onSearchChange={setSearch}
/>
```

### Server-Side Operations

```tsx
function ServerSideTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const handlePaginationChange = async (newPagination) => {
    setLoading(true);
    const result = await fetchData(newPagination);
    setData(result.data);
    setPagination(result.pagination);
    setLoading(false);
  };

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={loading}
      pagination={pagination}
      onPaginationChange={handlePaginationChange}
    />
  );
}
```

### Custom Renderers

```tsx
<DataTable
  data={data}
  columns={columns}
  customToolbar={
    <div className="flex gap-2">
      <CustomButton />
      <CustomDropdown />
    </div>
  }
  customFooter={
    <div className="p-4 text-center text-sm text-gray-500">
      Custom footer content
    </div>
  }
/>
```

## Utility Functions

The system includes helpful utility functions:

```tsx
import { 
  formatCurrency, 
  formatDate, 
  createStatusBadge, 
  exportToCSV,
  createCommonColumns 
} from '../components/data-table';

// Format currency
const price = formatCurrency(1234.56); // "$1,234.56"

// Create status badges
const StatusBadge = createStatusBadge(STATUS_COLORS);

// Export data
exportToCSV(data, columns, 'employees.csv');

// Use common column definitions
const commonColumns = createCommonColumns<Employee>();
const columns = [
  commonColumns.id,
  commonColumns.name,
  commonColumns.status,
  // ... custom columns
];
```

## Migration Guide

### Step 1: Identify Tables to Migrate

Look for these patterns in your existing code:
- `<table className="erp-table">`
- `<table className="w-full text-sm">`
- Custom pagination implementations
- Manual search/filter implementations

### Step 2: Extract Data and Columns

```tsx
// Before
<table className="erp-table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    {users.map(user => (
      <tr key={user.id}>
        <td>{user.name}</td>
        <td>{user.email}</td>
        <td>{user.status}</td>
      </tr>
    ))}
  </tbody>
</table>

// After
const columns: TableColumn<User>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status' },
];

<DataTable data={users} columns={columns} />
```

### Step 3: Migrate Actions

```tsx
// Before
<td>
  <button onClick={() => editUser(user)}>Edit</button>
  <button onClick={() => deleteUser(user)}>Delete</button>
</td>

// After
const rowActions: TableAction<User>[] = [
  {
    key: 'edit',
    label: 'Edit',
    icon: Edit2,
    onClick: (user) => editUser(user),
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'danger',
    onClick: (user) => deleteUser(user),
  },
];
```

### Step 4: Add Search and Filters

```tsx
const filters: TableFilter[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Inactive', value: 'inactive' },
    ],
  },
];

<DataTable
  data={users}
  columns={columns}
  rowActions={rowActions}
  filters={filters}
  searchable={true}
/>
```

## Examples

See the `examples/` directory for complete implementations:
- `EmployeeTable.tsx` - HR module example
- `ChartOfAccountsRefactored.tsx` - Finance module example

## Best Practices

1. **Use TypeScript**: Define proper interfaces for your data
2. **Memoize expensive renders**: Use `useMemo` for complex column renders
3. **Handle permissions**: Use the `permission` prop on actions
4. **Provide meaningful empty states**: Customize empty state messages
5. **Use common columns**: Leverage `createCommonColumns()` for consistency
6. **Handle loading states**: Always show loading indicators
7. **Implement error boundaries**: Handle and display errors gracefully

## Styling

The DataTable uses CSS custom properties for theming:

```css
:root {
  --bg-surface: #161b22;
  --border: rgba(255,255,255,0.09);
  --text-primary: #eaeaea;
  --text-muted: #5a6478;
  --hover-bg: rgba(255,255,255,0.06);
}
```

All components automatically adapt to light/dark themes using these variables.

## Performance Considerations

- Use `virtualized={true}` for tables with 1000+ rows
- Implement server-side pagination for large datasets
- Debounce search inputs (built-in)
- Memoize column render functions
- Use `getRowId` for stable row identification

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

When adding new features:
1. Update TypeScript interfaces
2. Add examples to the examples directory
3. Update this README
4. Test with both light and dark themes
5. Ensure responsive behavior works