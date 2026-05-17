# Frontend RBAC Integration Guide

## Setup

### 1. Wrap App with PermissionProvider

```tsx
// src/main.tsx or src/App.tsx
import { PermissionProvider } from './contexts/PermissionContext';

function App() {
  return (
    <PermissionProvider>
      <Router>
        {/* Your routes */}
      </Router>
    </PermissionProvider>
  );
}
```

### 2. Update Login Flow

```tsx
// src/pages/Login.tsx
import { usePermissions } from '../contexts/PermissionContext';

function Login() {
  const { refreshPermissions } = usePermissions();
  
  const handleLogin = async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const { access_token } = await response.json();
      localStorage.setItem('token', access_token);
      
      // Fetch permissions immediately after login
      await refreshPermissions();
      
      navigate('/dashboard');
    }
  };
  
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(email, password);
    }}>
      {/* Login form */}
    </form>
  );
}
```

---

## Usage Examples

### 1. Protect Entire Routes

```tsx
// src/App.tsx
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      {/* Protect HR module */}
      <Route
        path="/hr/*"
        element={
          <ProtectedRoute permission="hr.view" redirectTo="/unauthorized">
            <HRModule />
          </ProtectedRoute>
        }
      />
      
      {/* Protect Finance module */}
      <Route
        path="/finance/*"
        element={
          <ProtectedRoute permission="finance.view" redirectTo="/unauthorized">
            <FinanceModule />
          </ProtectedRoute>
        }
      />
      
      {/* Dashboard - needs any module access */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute
            anyPermissions={["hr.view", "finance.view", "crm.view"]}
            redirectTo="/login"
          >
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

### 2. Conditional UI Elements

```tsx
// src/pages/HR.tsx
import { PermissionGate } from '../components/ProtectedRoute';
import { useHasPermission } from '../contexts/PermissionContext';

function HRPage() {
  const canCreate = useHasPermission('hr.create');
  const canDelete = useHasPermission('hr.delete');
  
  return (
    <div>
      <h1>HR Management</h1>
      
      {/* Show button only if user can create */}
      <PermissionGate permission="hr.create">
        <button onClick={handleAddEmployee}>
          Add Employee
        </button>
      </PermissionGate>
      
      {/* Employee list */}
      <table>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id}>
              <td>{emp.name}</td>
              <td>
                {/* Show edit button if can update */}
                <PermissionGate permission="hr.update">
                  <button onClick={() => handleEdit(emp.id)}>Edit</button>
                </PermissionGate>
                
                {/* Show delete button if can delete */}
                <PermissionGate permission="hr.delete">
                  <button onClick={() => handleDelete(emp.id)}>Delete</button>
                </PermissionGate>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 3. Dashboard Cards

```tsx
// src/pages/Dashboard.tsx
import { PermissionGate } from '../components/ProtectedRoute';

function Dashboard() {
  return (
    <div className="grid grid-cols-3 gap-4">
      <PermissionGate permission="hr.view">
        <DashboardCard
          title="HR"
          icon={<UsersIcon />}
          link="/hr"
          stats={{ employees: 150, onLeave: 5 }}
        />
      </PermissionGate>
      
      <PermissionGate permission="finance.view">
        <DashboardCard
          title="Finance"
          icon={<DollarIcon />}
          link="/finance"
          stats={{ revenue: '$1.2M', expenses: '$800K' }}
        />
      </PermissionGate>
      
      <PermissionGate permission="crm.view">
        <DashboardCard
          title="CRM"
          icon={<ContactsIcon />}
          link="/crm"
          stats={{ leads: 45, deals: 12 }}
        />
      </PermissionGate>
      
      <PermissionGate permission="property.view">
        <DashboardCard
          title="Properties"
          icon={<BuildingIcon />}
          link="/properties"
          stats={{ total: 25, available: 8 }}
        />
      </PermissionGate>
      
      <PermissionGate permission="tenant.view">
        <DashboardCard
          title="Tenants"
          icon={<HomeIcon />}
          link="/tenants"
          stats={{ active: 18, pending: 3 }}
        />
      </PermissionGate>
      
      <PermissionGate permission="construction.view">
        <DashboardCard
          title="Construction"
          icon={<HammerIcon />}
          link="/construction"
          stats={{ projects: 5, inProgress: 3 }}
        />
      </PermissionGate>
    </div>
  );
}
```

### 4. Navigation Menu

```tsx
// src/components/Sidebar.tsx
import { PermissionGate } from './ProtectedRoute';
import { usePermissions } from '../contexts/PermissionContext';

function Sidebar() {
  const { hasAnyPermission } = usePermissions();
  
  // Only show sidebar if user has access to any module
  if (!hasAnyPermission('hr.view', 'finance.view', 'crm.view', 'property.view')) {
    return null;
  }
  
  return (
    <nav className="sidebar">
      <PermissionGate permission="hr.view">
        <NavLink to="/hr">
          <UsersIcon /> HR
        </NavLink>
      </PermissionGate>
      
      <PermissionGate permission="finance.view">
        <NavLink to="/finance">
          <DollarIcon /> Finance
        </NavLink>
      </PermissionGate>
      
      <PermissionGate permission="crm.view">
        <NavLink to="/crm">
          <ContactsIcon /> CRM
        </NavLink>
      </PermissionGate>
      
      <PermissionGate permission="property.view">
        <NavLink to="/properties">
          <BuildingIcon /> Properties
        </NavLink>
      </PermissionGate>
      
      <PermissionGate permission="tenant.view">
        <NavLink to="/tenants">
          <HomeIcon /> Tenants
        </NavLink>
      </PermissionGate>
      
      <PermissionGate permission="construction.view">
        <NavLink to="/construction">
          <HammerIcon /> Construction
        </NavLink>
      </PermissionGate>
      
      {/* Admin section */}
      <PermissionGate anyPermissions={["user.view", "role.view", "audit.view"]}>
        <div className="admin-section">
          <h3>Administration</h3>
          
          <PermissionGate permission="user.view">
            <NavLink to="/admin/users">Users</NavLink>
          </PermissionGate>
          
          <PermissionGate permission="role.view">
            <NavLink to="/admin/roles">Roles</NavLink>
          </PermissionGate>
          
          <PermissionGate permission="audit.view">
            <NavLink to="/admin/audit">Audit Logs</NavLink>
          </PermissionGate>
        </div>
      </PermissionGate>
    </nav>
  );
}
```

### 5. Form Actions

```tsx
// src/pages/EmployeeDetail.tsx
import { useHasPermission, useHasAllPermissions } from '../contexts/PermissionContext';

function EmployeeDetail({ employeeId }: { employeeId: number }) {
  const canUpdate = useHasPermission('hr.update');
  const canDelete = useHasPermission('hr.delete');
  const canFullyManage = useHasAllPermissions('hr.update', 'hr.delete', 'hr.manage');
  
  return (
    <div>
      <h1>Employee Details</h1>
      
      {/* Form fields - readonly if can't update */}
      <form>
        <input
          type="text"
          value={employee.name}
          disabled={!canUpdate}
          onChange={handleChange}
        />
        
        {canUpdate && (
          <button type="submit">Save Changes</button>
        )}
      </form>
      
      {/* Danger zone - only for full managers */}
      {canFullyManage && (
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <button onClick={handleTerminate} className="btn-danger">
            Terminate Employee
          </button>
        </div>
      )}
      
      {canDelete && (
        <button onClick={handleDelete} className="btn-danger">
          Delete Record
        </button>
      )}
    </div>
  );
}
```

### 6. Admin Panel - User Approval

```tsx
// src/pages/admin/UserApproval.tsx
import { useHasPermission } from '../../contexts/PermissionContext';

function UserApproval() {
  const canApprove = useHasPermission('user.approve');
  const [pendingUsers, setPendingUsers] = useState([]);
  
  useEffect(() => {
    if (canApprove) {
      fetchPendingUsers();
    }
  }, [canApprove]);
  
  const handleApprove = async (userId: number) => {
    const token = localStorage.getItem('token');
    await fetch(`${API_URL}/auth/users/${userId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ approved: true }),
    });
    
    fetchPendingUsers(); // Refresh list
  };
  
  if (!canApprove) {
    return <div>You don't have permission to approve users.</div>;
  }
  
  return (
    <div>
      <h1>Pending User Approvals</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Registered</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pendingUsers.map(user => (
            <tr key={user.id}>
              <td>{user.full_name}</td>
              <td>{user.email}</td>
              <td>{new Date(user.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => handleApprove(user.id)}>
                  Approve
                </button>
                <button onClick={() => handleReject(user.id)}>
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 7. Role Management

```tsx
// src/pages/admin/RoleManagement.tsx
import { RequirePermission } from '../../components/ProtectedRoute';

function RoleManagement() {
  return (
    <RequirePermission permission="role.view">
      <div>
        <h1>Role Management</h1>
        
        <PermissionGate permission="role.create">
          <button onClick={handleCreateRole}>Create New Role</button>
        </PermissionGate>
        
        <table>
          <thead>
            <tr>
              <th>Role Name</th>
              <th>Permissions</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id}>
                <td>{role.name}</td>
                <td>{role.permissions.length} permissions</td>
                <td>
                  <PermissionGate permission="role.update">
                    <button onClick={() => handleEdit(role.id)}>Edit</button>
                  </PermissionGate>
                  
                  <PermissionGate permission="role.delete">
                    <button onClick={() => handleDelete(role.id)}>Delete</button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RequirePermission>
  );
}
```

---

## Advanced Patterns

### 1. Permission-Based Routing

```tsx
// src/routes/index.tsx
import { usePermissions } from '../contexts/PermissionContext';

function AppRoutes() {
  const { hasPermission, loading } = usePermissions();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      
      {/* Dynamically add routes based on permissions */}
      {hasPermission('hr.view') && (
        <Route path="/hr/*" element={<HRModule />} />
      )}
      
      {hasPermission('finance.view') && (
        <Route path="/finance/*" element={<FinanceModule />} />
      )}
      
      {hasPermission('crm.view') && (
        <Route path="/crm/*" element={<CRMModule />} />
      )}
      
      {/* Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

### 2. Permission-Based Component Rendering

```tsx
// src/components/ActionButton.tsx
interface ActionButtonProps {
  action: 'create' | 'update' | 'delete';
  module: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ActionButton({ action, module, onClick, children }: ActionButtonProps) {
  const permission = `${module}.${action}`;
  
  return (
    <PermissionGate permission={permission}>
      <button onClick={onClick} className={`btn-${action}`}>
        {children}
      </button>
    </PermissionGate>
  );
}

// Usage
<ActionButton action="create" module="hr" onClick={handleCreate}>
  Add Employee
</ActionButton>
```

### 3. Bulk Permission Check

```tsx
// src/hooks/useModuleAccess.ts
import { usePermissions } from '../contexts/PermissionContext';

export function useModuleAccess(module: string) {
  const { hasPermission } = usePermissions();
  
  return {
    canView: hasPermission(`${module}.view`),
    canCreate: hasPermission(`${module}.create`),
    canUpdate: hasPermission(`${module}.update`),
    canDelete: hasPermission(`${module}.delete`),
    canManage: hasPermission(`${module}.manage`),
  };
}

// Usage
function HRPage() {
  const { canView, canCreate, canUpdate, canDelete } = useModuleAccess('hr');
  
  if (!canView) {
    return <AccessDenied />;
  }
  
  return (
    <div>
      {canCreate && <button>Add</button>}
      {canUpdate && <button>Edit</button>}
      {canDelete && <button>Delete</button>}
    </div>
  );
}
```

---

## Best Practices

### 1. Always Check Backend
Frontend permission checks are for UX only. Always validate on backend.

### 2. Cache Permissions
Permissions are cached in localStorage and refreshed on login.

### 3. Handle Loading States
Always handle the loading state from `usePermissions()`.

### 4. Refresh on Role Change
If admin changes user roles, call `refreshPermissions()`:

```tsx
const { refreshPermissions } = usePermissions();

// After admin updates user roles
await updateUserRoles(userId, roleIds);
await refreshPermissions(); // Refresh current user's permissions
```

### 5. Logout Cleanup
Clear permissions on logout:

```tsx
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('permissions');
  navigate('/login');
}
```

---

## Testing

```tsx
// src/__tests__/PermissionGate.test.tsx
import { render, screen } from '@testing-library/react';
import { PermissionProvider } from '../contexts/PermissionContext';
import { PermissionGate } from '../components/ProtectedRoute';

// Mock permissions
jest.mock('../contexts/PermissionContext', () => ({
  ...jest.requireActual('../contexts/PermissionContext'),
  usePermissions: () => ({
    permissions: ['hr.view', 'hr.create'],
    hasPermission: (p: string) => ['hr.view', 'hr.create'].includes(p),
    loading: false,
  }),
}));

test('shows content when permission granted', () => {
  render(
    <PermissionGate permission="hr.view">
      <div>HR Content</div>
    </PermissionGate>
  );
  
  expect(screen.getByText('HR Content')).toBeInTheDocument();
});

test('hides content when permission denied', () => {
  render(
    <PermissionGate permission="hr.delete">
      <div>Delete Button</div>
    </PermissionGate>
  );
  
  expect(screen.queryByText('Delete Button')).not.toBeInTheDocument();
});
```

---

## Complete Example

See `src/pages/Dashboard.tsx` and `src/pages/HR.tsx` for complete working examples.
