import { useAuthStore } from "../store/auth";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Building2, Users, AlertCircle, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  total_companies: number;
  active_companies: number;
  suspended_companies: number;
  expired_companies: number;
  total_users: number;
  total_disk_usage: number;
}

export default function SuperAdminDashboard() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get<DashboardStats>("/superadmin/dashboard/stats");
      setStats(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Super Admin Console</p>
          <h1 className="mt-3 text-4xl font-semibold">Welcome back{user?.full_name ? `, ${user.full_name}` : ""}</h1>
          <p className="mt-2 text-slate-400">Manage companies, users, and system-wide settings</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200">
            {error}
          </div>
        )}

        {/* Stats Grid */}
        {stats && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5 mb-8">
            <StatCard
              label="Total Companies"
              value={stats.total_companies}
              icon={Building2}
              color="#3b82f6"
              href="/superadmin/companies"
            />
            <StatCard
              label="Active"
              value={stats.active_companies}
              icon={TrendingUp}
              color="#10b981"
              href="/superadmin/companies"
            />
            <StatCard
              label="Suspended"
              value={stats.suspended_companies}
              icon={AlertCircle}
              color="#f59e0b"
              href="/superadmin/companies"
            />
            <StatCard
              label="Expired"
              value={stats.expired_companies}
              icon={Clock}
              color="#ef4444"
              href="/superadmin/companies"
            />
            <StatCard
              label="Disk Usage"
              value={formatBytes(stats.total_disk_usage)}
              icon={Users}
              color="#8b5cf6"
              href="/superadmin/companies"
              isText
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Link
            to="/superadmin/companies"
            className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 hover:border-slate-700 hover:bg-slate-800/95 transition-all cursor-pointer"
          >
            <Building2 size={24} className="mb-4 text-blue-400" />
            <h3 className="text-lg font-semibold mb-2">Manage Companies</h3>
            <p className="text-sm text-slate-400">Create, edit, and manage tenant companies</p>
          </Link>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 cursor-not-allowed opacity-50">
            <Users size={24} className="mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold mb-2">System Users</h3>
            <p className="text-sm text-slate-400">Coming soon</p>
          </div>
        </div>

        {/* Recent Activity Placeholder */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-8">
          <h2 className="text-lg font-semibold mb-6">Recent Activity</h2>
          <div className="text-center text-slate-400 py-8">
            <p>No recent activity yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  color: string;
  href: string;
  isText?: boolean;
}

function StatCard({ label, value, icon: Icon, color, href, isText = false }: StatCardProps) {
  return (
    <Link
      to={href}
      className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 hover:border-slate-700 hover:bg-slate-800/90 transition-all"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${isText ? "text-slate-200" : ""}`} style={!isText ? { color } : undefined}>
            {value}
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: `${color}22`, color }}
        >
          <Icon size={20} />
        </div>
      </div>
    </Link>
  );
}
