/**
 * Employee Table Example
 * Shows how to use DataTable for HR module
 */

import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Edit2, Trash2, UserPlus, Download, Upload } from 'lucide-react';
import { DataTable, TableColumn, TableFilter, TableAction, BulkAction, TableToolbarAction, createCommonColumns, STATUS_COLORS, createStatusBadge } from '../index';

// Mock employee data type
interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  salary: number;
  hire_date: string;
  manager_name?: string;
  location: string;
}

// Mock data
const mockEmployees: Employee[] = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john.doe@company.com',
    phone: '+1-555-0101',
    department: 'Engineering',
    position: 'Senior Developer',
    employment_type: 'full_time',
    status: 'active',
    salary: 95000,
    hire_date: '2022-03-15',
    manager_name: 'Jane Smith',
    location: 'New York',
  },
  {
    id: 2,
    name: 'Sarah Wilson',
    email: 'sarah.wilson@company.com',
    phone: '+1-555-0102',
    department: 'Marketing',
    position: 'Marketing Manager',
    employment_type: 'full_time',
    status: 'active',
    salary: 75000,
    hire_date: '2021-08-22',
    manager_name: 'Mike Johnson',
    location: 'Los Angeles',
  },
  {
    id: 3,
    name: 'Mike Chen',
    email: 'mike.chen@company.com',
    phone: '+1-555-0103',
    department: 'Engineering',
    position: 'Junior Developer',
    employment_type: 'full_time',
    status: 'on_leave',
    salary: 65000,
    hire_date: '2023-01-10',
    manager_name: 'Jane Smith',
    location: 'San Francisco',
  },
  // Add more mock data as needed
];

const StatusBadge = createStatusBadge({
  ...STATUS_COLORS,
  on_leave: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  terminated: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
});

export default function EmployeeTable() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]);

  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setEmployees(mockEmployees);
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Get common columns and customize them
  const commonColumns = createCommonColumns<Employee>();

  // Define table columns
  const columns: TableColumn<Employee>[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={16} className="text-white" />
          </div>
          <div>
            <div className="font-medium text-primary">{value}</div>
            <div className="text-xs text-muted">{row.position}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Contact',
      render: (value, row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <Mail size={12} className="text-muted" />
            <span className="text-blue-400">{value}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone size={12} className="text-muted" />
            <span className="text-secondary">{row.phone}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'department',
      label: 'Department',
      width: 120,
      render: (value, row) => (
        <div>
          <div className="text-sm font-medium text-primary">{value}</div>
          <div className="text-xs text-muted">{row.location}</div>
        </div>
      ),
    },
    {
      key: 'employment_type',
      label: 'Type',
      width: 100,
      align: 'center',
      render: (value) => (
        <span className="text-xs px-2 py-1 rounded-full bg-tertiary text-secondary capitalize">
          {value.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 100,
      align: 'center',
      render: (value) => <StatusBadge status={value} />,
    },
    {
      key: 'salary',
      label: 'Salary',
      width: 120,
      align: 'right',
      render: (value) => (
        <span className="font-mono text-sm font-medium text-green-400">
          ${value.toLocaleString()}
        </span>
      ),
    },
    {
      ...commonColumns.date,
      key: 'hire_date',
      label: 'Hire Date',
      width: 120,
    },
  ];

  // Define filters
  const filters: TableFilter[] = [
    {
      key: 'department',
      label: 'Department',
      type: 'select',
      options: [
        { label: 'Engineering', value: 'Engineering' },
        { label: 'Marketing', value: 'Marketing' },
        { label: 'Sales', value: 'Sales' },
        { label: 'HR', value: 'HR' },
        { label: 'Finance', value: 'Finance' },
      ],
    },
    {
      key: 'employment_type',
      label: 'Employment Type',
      type: 'select',
      options: [
        { label: 'Full Time', value: 'full_time' },
        { label: 'Part Time', value: 'part_time' },
        { label: 'Contract', value: 'contract' },
        { label: 'Intern', value: 'intern' },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'On Leave', value: 'on_leave' },
        { label: 'Terminated', value: 'terminated' },
      ],
    },
    {
      key: 'location',
      label: 'Location',
      type: 'select',
      options: [
        { label: 'New York', value: 'New York' },
        { label: 'Los Angeles', value: 'Los Angeles' },
        { label: 'San Francisco', value: 'San Francisco' },
        { label: 'Chicago', value: 'Chicago' },
      ],
    },
  ];

  // Define row actions
  const rowActions: TableAction<Employee>[] = [
    {
      key: 'edit',
      label: 'Edit Employee',
      icon: Edit2,
      variant: 'secondary',
      onClick: (employee) => {
        console.log('Edit employee:', employee);
        // Handle edit action
      },
      permission: 'hr:manage',
    },
    {
      key: 'delete',
      label: 'Delete Employee',
      icon: Trash2,
      variant: 'danger',
      onClick: (employee) => {
        console.log('Delete employee:', employee);
        // Handle delete action
      },
      disabled: (employee) => employee.status === 'active',
      permission: 'hr:manage',
    },
  ];

  // Define bulk actions
  const bulkActions: BulkAction<Employee>[] = [
    {
      key: 'activate',
      label: 'Activate Selected',
      variant: 'success',
      onClick: (employees) => {
        console.log('Activate employees:', employees);
        // Handle bulk activate
      },
      disabled: (employees) => employees.every(emp => emp.status === 'active'),
      permission: 'hr:manage',
    },
    {
      key: 'deactivate',
      label: 'Deactivate Selected',
      variant: 'warning',
      onClick: (employees) => {
        console.log('Deactivate employees:', employees);
        // Handle bulk deactivate
      },
      disabled: (employees) => employees.every(emp => emp.status !== 'active'),
      permission: 'hr:manage',
    },
    {
      key: 'export',
      label: 'Export Selected',
      icon: Download,
      variant: 'secondary',
      onClick: (employees) => {
        console.log('Export employees:', employees);
        // Handle export
      },
    },
  ];

  // Define toolbar actions
  const toolbarActions: TableToolbarAction[] = [
    {
      key: 'add',
      label: 'Add Employee',
      icon: UserPlus,
      variant: 'primary',
      onClick: () => {
        console.log('Add new employee');
        // Handle add employee
      },
      permission: 'hr:manage',
    },
    {
      key: 'import',
      label: 'Import',
      icon: Upload,
      variant: 'secondary',
      onClick: () => {
        console.log('Import employees');
        // Handle import
      },
      permission: 'hr:manage',
    },
    {
      key: 'export',
      label: 'Export All',
      icon: Download,
      variant: 'secondary',
      onClick: () => {
        console.log('Export all employees');
        // Handle export all
      },
    },
  ];

  return (
    <div className="p-6">
      <DataTable
        title="Employees"
        subtitle="Manage your organization's workforce"
        data={employees}
        columns={columns}
        loading={loading}
        
        // Selection
        selectable={true}
        selectedRows={selectedEmployees}
        onSelectionChange={setSelectedEmployees}
        
        // Search and filters
        searchable={true}
        searchPlaceholder="Search employees by name, email, or department..."
        filters={filters}
        
        // Actions
        rowActions={rowActions}
        bulkActions={bulkActions}
        toolbarActions={toolbarActions}
        
        // Styling
        striped={true}
        hoverable={true}
        stickyHeader={true}
        
        // Empty state
        emptyTitle="No employees found"
        emptyDescription="Add your first employee to get started with HR management."
        emptyIcon={User}
        
        // Row interaction
        onRowClick={(employee) => {
          console.log('View employee details:', employee);
          // Navigate to employee detail page
        }}
      />
    </div>
  );
}