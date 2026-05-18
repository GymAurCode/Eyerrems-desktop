# DataTable Migration Guide

This guide helps you migrate existing tables to the new DataTable Container system.

## Migration Checklist

### Phase 1: Preparation
- [ ] Identify all tables in the application
- [ ] Categorize tables by complexity
- [ ] Plan migration order (start with simple tables)

### Phase 2: Core Migration
- [ ] Install and configure DataTable system
- [ ] Migrate high-priority tables first
- [ ] Test each migrated table thoroughly
- [ ] Update related components and pages

### Phase 3: Enhancement
- [ ] Add advanced features (filters, bulk actions)
- [ ] Implement server-side operations where needed
- [ ] Optimize performance for large datasets
- [ ] Update documentation and examples

## Table Identification

### Current Table Patterns to Look For

1. **ERP Tables**
   ```tsx
   <table className="erp-table">
   ```

2. **Custom Tables**
   ```tsx
   <table className="w-full text-sm">
   <table className="w-full text-xs">
   ```

3. **Manual Pagination**
   ```tsx
   // Look for custom pagination components
   <div className="pagination">
   // Or manual page controls
   <button onClick={() => setPage(page + 1)}>
   ```

4. **Manual Search/Filters**
   ```tsx
   // Look for search inputs
   <input placeholder="Search..." onChange={handleSearch}>
   // Or filter dropdowns
   <select onChange={handleFilter}>
   ```

## Step-by-Step Migration

### Step 1: Simple Table Migration

**Before:**
```tsx
function UserList() {
  const [users, setUsers] = useState([]);
  
  return (
    <div className="card-dark">
      <table className="erp-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>
                <span className={`badge ${user.active ? 'active' : 'inactive'}`}>
                  {user.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <button onClick={() => editUser(user)}>Edit</button>
                <button onClick={() => deleteUser(user)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**After:**
```tsx
import { DataTable, TableColumn, TableAction } from '../components/data-table';

function UserList() {
  const [users, setUsers] = useState([]);
  
  const columns: TableColumn<User>[] = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    {
      key: 'active',
      label: 'Status',
      render: (value) => (
        <span className={`badge ${value ? 'active' : 'inactive'}`}>
          {value ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];
  
  const rowActions: TableAction<User>[] = [
    {
      key: 'edit',
      label: 'Edit',
      onClick: (user) => editUser(user),
    },
    {
      key: 'delete',
      label: 'Delete',
      variant: 'danger',
      onClick: (user) => deleteUser(user),
    },
  ];
  
  return (
    <DataTable
      title="Users"
      data={users}
      columns={columns}
      rowActions={rowActions}
      searchable={true}
    />
  );
}
```

### Step 2: Complex Table with Pagination

**Before:**
```tsx
function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  
  // Manual pagination logic
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredEmployees.slice(startIndex, endIndex);
  
  return (
    <div>
      {/* Manual search */}
      <input 
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search employees..."
      />
      
      {/* Manual filter */}
      <select value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All Departments</option>
        <option value="engineering">Engineering</option>
        <option value="marketing">Marketing</option>
      </select>
      
      {/* Table */}
      <table className="erp-table">
        {/* ... table content ... */}
      </table>
      
      {/* Manual pagination */}
      <div className="pagination">
        <button 
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span>Page {page} of {Math.ceil(total / pageSize)}</span>
        <button 
          disabled={page >= Math.ceil(total / pageSize)}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

**After:**
```tsx
import { DataTable, TableColumn, TableFilter } from '../components/data-table';

function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  
  const columns: TableColumn<Employee>[] = [
    // Define columns
  ];
  
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
  ];
  
  return (
    <DataTable
      title="Employees"
      data={employees}
      columns={columns}
      filters={filters}
      searchable={true}
      searchPlaceholder="Search employees..."
    />
  );
}
```

### Step 3: Server-Side Table Migration

**Before:**
```tsx
function ServerTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await api.getData({
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      setData(response.data);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, [page, pageSize, sortBy, sortOrder]);
  
  // Manual table rendering...
}
```

**After:**
```tsx
function ServerTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });
  const [sortConfig, setSortConfig] = useState(null);
  
  const fetchData = async (newPagination, newSort) => {
    setLoading(true);
    try {
      const response = await api.getData({
        page: newPagination.page,
        pageSize: newPagination.pageSize,
        sortBy: newSort?.key,
        sortOrder: newSort?.direction,
      });
      setData(response.data);
      setPagination(prev => ({ ...prev, total: response.total }));
    } finally {
      setLoading(false);
    }
  };
  
  const handlePaginationChange = (newPagination) => {
    setPagination(newPagination);
    fetchData(newPagination, sortConfig);
  };
  
  const handleSort = (newSort) => {
    setSortConfig(newSort);
    fetchData(pagination, newSort);
  };
  
  return (
    <DataTable
      data={data}
      columns={columns}
      loading={loading}
      pagination={pagination}
      onPaginationChange={handlePaginationChange}
      sortConfig={sortConfig}
      onSort={handleSort}
    />
  );
}
```

## Module-Specific Migration Examples

### Finance Module Tables

1. **Chart of Accounts** ✅ (See `ChartOfAccountsRefactored.tsx`)
2. **Journal Entries**
3. **Invoices**
4. **Payments**
5. **Trial Balance**

### HR Module Tables

1. **Employees** ✅ (See `examples/EmployeeTable.tsx`)
2. **Attendance Records**
3. **Payroll**
4. **Leave Requests**
5. **Performance Reviews**

### CRM Module Tables

1. **Leads**
2. **Contacts**
3. **Opportunities**
4. **Activities**
5. **Campaigns**

### Property Module Tables

1. **Properties**
2. **Units**
3. **Tenants**
4. **Leases**
5. **Maintenance Requests**

### Inventory Module Tables

1. **Products**
2. **Stock Movements**
3. **Suppliers**
4. **Purchase Orders**
5. **Stock Levels**

## Common Migration Patterns

### 1. Status Badges
```tsx
// Before
<span className={`status-${status}`}>{status}</span>

// After
import { createStatusBadge, STATUS_COLORS } from '../components/data-table';
const StatusBadge = createStatusBadge(STATUS_COLORS);
// In column render:
render: (value) => <StatusBadge status={value} />
```

### 2. Currency Formatting
```tsx
// Before
<td>${amount.toFixed(2)}</td>

// After
import { formatCurrency } from '../components/data-table';
// In column render:
render: (value) => formatCurrency(value)
```

### 3. Date Formatting
```tsx
// Before
<td>{new Date(date).toLocaleDateString()}</td>

// After
import { formatDate } from '../components/data-table';
// In column render:
render: (value) => formatDate(value)
```

### 4. Action Buttons
```tsx
// Before
<td>
  <button onClick={() => edit(row)}>Edit</button>
  <button onClick={() => delete(row)}>Delete</button>
</td>

// After
const rowActions: TableAction<T>[] = [
  {
    key: 'edit',
    label: 'Edit',
    icon: Edit2,
    onClick: (row) => edit(row),
  },
  {
    key: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'danger',
    onClick: (row) => delete(row),
  },
];
```

## Testing Migration

### 1. Visual Testing
- [ ] Table renders correctly
- [ ] Styling matches design system
- [ ] Responsive behavior works
- [ ] Dark/light theme support

### 2. Functional Testing
- [ ] Search works correctly
- [ ] Filters apply properly
- [ ] Sorting functions
- [ ] Pagination works
- [ ] Actions execute correctly
- [ ] Selection works (if enabled)

### 3. Performance Testing
- [ ] Large datasets render smoothly
- [ ] Search is debounced
- [ ] No unnecessary re-renders
- [ ] Memory usage is reasonable

## Rollback Plan

If migration causes issues:

1. **Keep original components** during migration
2. **Use feature flags** to switch between old/new tables
3. **Gradual rollout** - migrate one table at a time
4. **Monitor performance** and user feedback
5. **Quick rollback** capability if needed

## Migration Timeline

### Week 1: Setup and Simple Tables
- [ ] Install DataTable system
- [ ] Migrate 3-5 simple tables
- [ ] Test basic functionality

### Week 2: Complex Tables
- [ ] Migrate tables with pagination
- [ ] Add search and filters
- [ ] Test advanced features

### Week 3: Server-Side Tables
- [ ] Migrate server-side paginated tables
- [ ] Implement server-side sorting/filtering
- [ ] Performance testing

### Week 4: Polish and Optimization
- [ ] Add bulk actions where needed
- [ ] Optimize performance
- [ ] Update documentation
- [ ] Final testing and deployment

## Support and Resources

- **Documentation**: See `README.md` for full API reference
- **Examples**: Check `examples/` directory for complete implementations
- **Common Patterns**: Use utility functions from `utils.ts`
- **Troubleshooting**: Common issues and solutions below

## Common Issues and Solutions

### Issue: Table not rendering
**Solution**: Check that `data` and `columns` props are provided and not empty.

### Issue: Actions not working
**Solution**: Verify action handlers are defined and permissions are correct.

### Issue: Styling looks wrong
**Solution**: Ensure CSS custom properties are defined and theme is applied.

### Issue: Performance problems
**Solution**: Use `virtualized={true}` for large datasets or implement server-side pagination.

### Issue: Search not working
**Solution**: Check that `searchable={true}` is set and `onSearchChange` is handled correctly.

## Next Steps

After migration:
1. **Gather feedback** from users
2. **Monitor performance** metrics
3. **Add advanced features** as needed
4. **Document lessons learned**
5. **Plan future enhancements**