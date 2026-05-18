# RowActions Integration Guide

## Quick Start

### Option A — QuickRowActions (simplest, 4 standard actions)

```tsx
import { QuickRowActions } from "../components/actions";

// In your table row:
<td>
  <QuickRowActions
    row={employee}
    onView={(r) => navigate(`/hr/employees/${r.id}`)}
    onEdit={(r) => setEditTarget(r)}
    onDelete={async (r) => { await employeesApi.delete(r.id); await reload(); }}
    onPrint={(r) => window.print()}
    editPermission="hr:manage"
    deletePermission="hr:manage"
    canDelete={(r) => r.status !== "Active"}  // optional: hide delete for active employees
  />
</td>
```

---

### Option B — RowActions with full ActionConfig (flexible)

```tsx
import { RowActions } from "../components/actions";
import type { ActionConfig } from "../components/actions";

const getActions = (row: Employee): ActionConfig<Employee>[] => [
  { type: "view",   handler: (r) => openDetail(r) },
  { type: "edit",   handler: (r) => openEdit(r),   permission: "hr:manage" },
  { type: "delete", handler: (r) => deleteRow(r),  permission: "hr:manage" },
  { type: "print",  handler: (r) => printRow(r) },
  // Custom action:
  {
    type: "custom",
    label: "Approve",
    color: "#10b981",
    icon: CheckCircle,
    handler: (r) => approveEmployee(r),
    visible: (r) => r.status === "Pending",
    permission: "hr:approve",
    confirmMessage: "Approve this employee?",
  },
];

// In your table row:
<td>
  <RowActions row={employee} actions={getActions(employee)} compact />
</td>
```

---

### Option C — useRowActions hook (manages state for you)

```tsx
import { RowActions } from "../components/actions";
import { useRowActions } from "../hooks/useRowActions";

function EmployeesTable({ employees, reload }) {
  const [editTarget, setEditTarget] = useState(null);

  const { buildActions } = useRowActions({
    onView:   (r) => navigate(`/hr/employees/${r.id}`),
    onEdit:   (r) => setEditTarget(r),
    onDelete: async (r) => { await employeesApi.delete(r.id); await reload(); },
    onPrint:  (r) => window.print(),
    editPermission:   "hr:manage",
    deletePermission: "hr:manage",
    successMessage: "Employee deleted",
  });

  return (
    <table className="erp-table">
      <tbody>
        {employees.map(emp => (
          <tr key={emp.id}>
            <td>{emp.name}</td>
            <td><RowActions row={emp} actions={buildActions(emp)} compact /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Variants

| Variant | Description | Best for |
|---------|-------------|----------|
| `"icon-buttons"` | Compact icon buttons in a row (default) | Most tables |
| `"icon-only"` | Icons only, no labels, ultra-compact | Very narrow columns |
| `"dropdown"` | Single ⋯ button with floating menu | Mobile / many actions |
| `"text-buttons"` | Icon + text label | Detail pages, wider rows |

```tsx
<RowActions row={row} actions={actions} variant="dropdown" />
<RowActions row={row} actions={actions} variant="icon-only" compact />
<RowActions row={row} actions={actions} variant="text-buttons" />
```

---

## Built-in Action Types

| Type | Icon | Color | Confirm? |
|------|------|-------|----------|
| `view` | Eye | Blue | No |
| `edit` | Pencil | Purple | No |
| `delete` | Trash2 | Red | **Yes** |
| `print` | Printer | Green | No |
| `download` | Download | Green | No |
| `approve` | CheckCircle | Green | **Yes** |
| `reject` | XCircle | Amber | **Yes** |
| `duplicate` | Copy | Gray | No |
| `archive` | Archive | Gray | **Yes** |
| `restore` | RotateCcw | Blue | No |
| `custom` | Zap | Gray | No |

---

## Permission Integration

Actions are automatically hidden if the user lacks the required permission.
Super-admins and Admins always see all actions.

```tsx
{ type: "delete", handler: del, permission: "finance:manage" }
// → hidden for users without finance:manage permission
// → visible for Admin and Super Admin regardless
```

---

## Module Integration Checklist

Copy this pattern for each module:

### Finance (Invoices) ✅ Done
### Properties
```tsx
import { QuickRowActions } from "../../components/actions";
<QuickRowActions
  row={property}
  onView={(r) => navigate(`/property/${r.id}`)}
  onEdit={(r) => setEditTarget(r)}
  onDelete={async (r) => { await propApi.delete(r.id); await reload(); }}
  editPermission="properties:manage"
  deletePermission="properties:manage"
/>
```

### CRM (Leads, Clients, Deals)
```tsx
<QuickRowActions
  row={lead}
  onView={(r) => navigate(`/crm/leads/${r.id}`)}
  onEdit={(r) => setEditTarget(r)}
  onDelete={async (r) => { await crmApi.deleteLead(r.id); await reload(); }}
  editPermission="crm:manage"
  deletePermission="crm:manage"
/>
```

### HR (Employees)
```tsx
<QuickRowActions
  row={employee}
  onView={(r) => navigate(`/hr/employees/${r.id}`)}
  onEdit={(r) => setEditTarget(r)}
  onDelete={async (r) => { await employeesApi.delete(r.id); await reload(); }}
  onPrint={(r) => window.print()}
  editPermission="hr:manage"
  deletePermission="hr:manage"
  canDelete={(r) => r.status !== "Active"}
/>
```

### Tenants
```tsx
<QuickRowActions
  row={tenant}
  onView={(r) => navigate(`/tenants/${r.id}`)}
  onEdit={(r) => setEditTarget(r)}
  onDelete={async (r) => { await tenantApi.delete(r.id); await reload(); }}
  editPermission="tenants:manage"
  deletePermission="tenants:manage"
/>
```

---

## Custom Actions

```tsx
{
  type: "custom",
  label: "Send Email",
  color: "#60a5fa",
  icon: Mail,                          // any Lucide icon
  tooltip: "Send email to this client",
  handler: (r) => openEmailCompose(r),
  visible: (r) => !!r.email,           // only show if email exists
  disabled: (r) => r.status === "inactive",
  permission: "crm:communicate",
}
```

---

## Bulk Actions (Future)

The architecture supports bulk actions. When ready, add a `BulkActions` component
that accepts `selectedRows: T[]` and `actions: ActionConfig<T>[]`.
The `ActionConfig` type is already generic and works for both single and bulk.
