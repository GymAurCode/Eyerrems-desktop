import { useEffect, useState } from 'react';
import { api } from '../lib/api';

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
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 ${activeTab === 'pending' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
        >
          Pending Approvals
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-4 py-2 ${activeTab === 'roles' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
        >
          Roles
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-4 py-2 ${activeTab === 'permissions' ? 'border-b-2 border-blue-500 font-semibold' : ''}`}
        >
          Permissions
        </button>
      </div>

      {loading && <div>Loading...</div>}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">All Users</h2>
          <table className="w-full border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Roles</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-t">
                  <td className="p-2">{user.email}</td>
                  <td className="p-2">{user.full_name}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-sm ${
                      user.status === 'active' ? 'bg-green-100 text-green-800' :
                      user.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="p-2">{user.roles.join(', ')}</td>
                  <td className="p-2">{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending Approvals Tab */}
      {activeTab === 'pending' && (
        <div>
          <h2 className="text-2xl font-bold mb-4">Pending User Approvals</h2>
          {pendingUsers.length === 0 ? (
            <p>No pending approvals</p>
          ) : (
            <table className="w-full border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map(user => (
                  <tr key={user.id} className="border-t">
                    <td className="p-2">{user.email}</td>
                    <td className="p-2">{user.full_name}</td>
                    <td className="p-2">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="p-2">
                      <button
                        onClick={() => approveUser(user.id, true)}
                        className="bg-green-500 text-white px-3 py-1 rounded mr-2"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => approveUser(user.id, false)}
                        className="bg-red-500 text-white px-3 py-1 rounded"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                            <span className="text-xs text-gray-500">- {perm.description}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-500">Select a role to manage permissions</p>
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
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Permission</th>
                      <th className="p-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perms.map(perm => (
                      <tr key={perm.id} className="border-t">
                        <td className="p-2 font-mono text-sm">{perm.name}</td>
                        <td className="p-2 text-sm">{perm.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
