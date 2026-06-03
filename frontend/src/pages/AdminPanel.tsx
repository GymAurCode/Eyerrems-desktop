import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ModuleTabs from '../components/ui/ModuleTabs';
import { DataTable } from '../components/data-table';

interface User {
  id: number;
  email: string;
  full_name: string;
  status: string;
  is_approved: boolean;
  roles: string[];
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: Permission[];
}

interface Permission {
  id: number;
  name: string;
  module: string;
  description: string;
}

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions' | 'pending'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data } = await api.get('/auth/users');
        setUsers(data);
      } else if (activeTab === 'pending') {
        const { data } = await api.get('/auth/users/pending');
        setPendingUsers(data);
      } else if (activeTab === 'roles') {
        const { data } = await api.get('/auth/roles');
        setRoles(data);
      } else if (activeTab === 'permissions') {
        const { data } = await api.get('/auth/permissions');
        setPermissions(data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: number, approved: boolean) => {
    try {
      await api.post(`/auth/users/${userId}/approve`, { approved });
      loadData();
    } catch (error) {
      console.error('Failed to approve user:', error);
    }
  };

  const updateRolePermissions = async (roleId: number, permissionIds: number[]) => {
    try {
      await api.patch(`/admin/roles/${roleId}`, { permission_ids: permissionIds });
      loadData();
      alert('Role permissions updated successfully');
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role permissions');
    }
  };

  const togglePermission = (permissionId: number) => {
    if (!selectedRole) return;
    
    const currentIds = selectedRole.permissions.map(p => p.id);
    const newIds = currentIds.includes(permissionId)
      ? currentIds.filter(id => id !== permissionId)
      : [...currentIds, permissionId];
    
    updateRolePermissions(selectedRole.id, newIds);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      {/* Tabs */}
      <ModuleTabs
        tabs={[
          { label: 'Users', value: 'users' },
          { label: 'Pending Approvals', value: 'pending' },
          { label: 'Roles', value: 'roles' },
          { label: 'Permissions', value: 'permissions' },
        ]}
        activeTab={activeTab}
        onChange={(v) => setActiveTab(v as 'users' | 'pending' | 'roles' | 'permissions')}
        moduleColor="#3b82f6"
      />

      {loading && <div>Loading...</div>}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">All Users</h2>
          <DataTable
            data={users}
            columns={[
              { key: "email", label: "Email" },
              { key: "full_name", label: "Name" },
              { key: "status", label: "Status", render: (val) => (
                <span className={`px-2 py-1 rounded text-sm ${
                  val === 'active' ? 'bg-green-100 text-green-800' :
                  val === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>{val}</span>
              )},
              { key: "roles", label: "Roles", render: (val) => val.join(', ') },
              { key: "created_at", label: "Created", render: (val) => new Date(val).toLocaleDateString() },
            ]}
            variant="bordered"
            searchable={false}
            emptyTitle="No users found"
          />
        </div>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === 'pending' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pending User Approvals</h2>
          <DataTable
            data={pendingUsers}
            columns={[
              { key: "email", label: "Email" },
              { key: "full_name", label: "Name" },
              { key: "created_at", label: "Created", render: (val) => new Date(val).toLocaleDateString() },
              { key: "id", label: "Actions", render: (val, row) => (
                <div className="flex gap-2">
                  <button onClick={() => approveUser(val, true)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm">Approve</button>
                  <button onClick={() => approveUser(val, false)}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm">Reject</button>
                </div>
              )},
            ]}
            variant="bordered"
            searchable={false}
            emptyTitle="No pending approvals"
          />
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Roles</h2>
            <div className="space-y-2">
              {roles.map(role => (
                <div
                  key={role.id}
                  onClick={() => setSelectedRole(role)}
                  className={`p-4 border rounded cursor-pointer ${
                    selectedRole?.id === role.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <h3 className="font-bold">{role.name}</h3>
                  <p className="text-sm text-gray-600">{role.description}</p>
                  <p className="text-sm mt-1">{role.permissions.length} permissions</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            {selectedRole ? (
              <>
                <h2 className="text-2xl font-bold mb-4">
                  Permissions for {selectedRole.name}
                </h2>
                <div className="space-y-4">
                  {Object.entries(
                    permissions.reduce((acc, perm) => {
                      if (!acc[perm.module]) acc[perm.module] = [];
                      acc[perm.module].push(perm);
                      return acc;
                    }, {} as Record<string, Permission[]>)
                  ).map(([module, perms]) => (
                    <div key={module} className="border p-4 rounded">
                      <h3 className="font-bold mb-2">{module}</h3>
                      <div className="space-y-1">
                        {perms.map(perm => (
                          <label key={perm.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedRole.permissions.some(p => p.id === perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{perm.name}</span>
                            <span className="text-xs text-muted">- {perm.description}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted">Select a role to manage permissions</p>
            )}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">All Permissions</h2>
          <div className="space-y-4">
            {Object.entries(
              permissions.reduce((acc, perm) => {
                if (!acc[perm.module]) acc[perm.module] = [];
                acc[perm.module].push(perm);
                return acc;
              }, {} as Record<string, Permission[]>)
            ).map(([module, perms]) => (
              <div key={module} className="border p-4 rounded">
                <h3 className="font-bold text-lg mb-2">{module}</h3>
                <DataTable
                  data={perms}
                  columns={[
                    { key: "name", label: "Permission", render: (val) => <span className="font-mono text-sm">{val}</span> },
                    { key: "description", label: "Description", render: (val) => <span className="text-sm">{val}</span> },
                  ]}
                  variant="bordered"
                  searchable={false}
                  emptyTitle="No permissions"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
