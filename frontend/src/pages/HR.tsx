/**
 * HR Management Page
 * Tabs: Dashboard · Employees · Attendance · Leaves · Payroll · Setup
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Calendar, FileText, DollarSign, Settings2, Plus,
  RefreshCw, Search, CheckCircle, XCircle, Clock,
  Building2, MapPin, Briefcase, UserCheck,
  TrendingUp, ArrowDownRight, Printer, Eye, Edit2, Trash2,
} from "lucide-react";
import AppDialog from "../components/ui/AppDialog";
import { formatCurrency } from "../lib/currency";
import { QuickRowActions, RowActions, ActionsTh, ActionsCell, printRecord, ConfirmDialog } from "../components/actions";
import { DataTable, SmartTable } from "../components/data-table";
import { api } from "../lib/api";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import AttachmentsButton from "../components/attachments/AttachmentsButton";
import StatCard from "../components/ui/StatCard";
import FileUpload from "../components/ui/FileUpload";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import {
  departmentsApi, positionsApi, branchesApi, employeesApi,
  attendanceApi, leaveTypesApi, leavesApi, payrollApi, holidaysApi,
  type Department, type Position, type Branch, type Employee,
  type Attendance, type LeaveType, type Leave, type LeaveBalance,
  type Payroll, type Holiday, type SalaryStructure, type PayslipData,
} from "../lib/hrApi";
import { useNotifStore } from "../store/notifications";
import { useLookup } from "../hooks/useLookup";

type Tab = "dashboard" | "employees" | "attendance" | "leaves" | "payroll" | "setup";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",  label: "Dashboard",  icon: TrendingUp },
  { id: "employees",  label: "Employees",  icon: Users },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "leaves",     label: "Leaves",     icon: FileText },
  { id: "payroll",    label: "Payroll",    icon: DollarSign },
  { id: "setup",      label: "Setup",      icon: Settings2 },
];

const TAB_ITEMS = TABS.map((t) => ({ label: t.label, value: t.id, icon: t.icon }));

// ── Shared helpers ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    Active:       ["rgba(16,185,129,0.15)",  "#10b981"],
    Inactive:     ["rgba(148,163,184,0.1)",  "#94a3b8"],
    Resigned:     ["rgba(239,68,68,0.15)",   "#ef4444"],
    Terminated:   ["rgba(239,68,68,0.15)",   "#ef4444"],
    Present:      ["rgba(16,185,129,0.15)",  "#10b981"],
    Absent:       ["rgba(239,68,68,0.15)",   "#ef4444"],
    Leave:        ["rgba(59,130,246,0.15)",  "#3b82f6"],
    "Half-day":   ["rgba(245,158,11,0.15)",  "#f59e0b"],
    Holiday:      ["rgba(139,92,246,0.15)",  "#8b5cf6"],
    Pending:      ["rgba(245,158,11,0.15)",  "#f59e0b"],
    Approved:     ["rgba(16,185,129,0.15)",  "#10b981"],
    Rejected:     ["rgba(239,68,68,0.15)",   "#ef4444"],
    Cancelled:    ["rgba(148,163,184,0.1)",  "#94a3b8"],
    Draft:        ["rgba(148,163,184,0.1)",  "#94a3b8"],
    Calculated:   ["rgba(59,130,246,0.15)",  "#3b82f6"],
    Posted:       ["rgba(139,92,246,0.15)",  "#8b5cf6"],
    Paid:         ["rgba(16,185,129,0.15)",  "#10b981"],
    "Not Marked": ["rgba(245,158,11,0.1)",   "#f59e0b"],
  };
  const [bg, color] = map[status] ?? ["rgba(148,163,184,0.1)", "#94a3b8"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: bg, color }}>{status}</span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const redStar = (k: number) => <span key={k} style={{ color: "#EF4444", fontSize: "13px", lineHeight: 1 }} aria-hidden="true">*</span>;
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label.split('*').flatMap((part, i) => i === 0 ? [part] : [redStar(i), part])}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg text-xs text-primary bg-transparent select-dark outline-none transition-colors";
const inputStyle = { border: "1px solid var(--border)", background: "var(--dialog-input-bg)" };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function HRPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions,   setPositions]   = useState<Position[]>([]);
  const [branches,    setBranches]    = useState<Branch[]>([]);
  const [leaveTypes,  setLeaveTypes]  = useState<LeaveType[]>([]);
  const [holidays,    setHolidays]    = useState<Holiday[]>([]);

  const loadMaster = useCallback(async () => {
    const [emps, depts, pos, brs, lts, hols] = await Promise.allSettled([
      employeesApi.list(), departmentsApi.list(), positionsApi.list(),
      branchesApi.list(), leaveTypesApi.list(),
      holidaysApi.list(new Date().getFullYear()),
    ]);
    if (emps.status  === "fulfilled") setEmployees(emps.value);
    if (depts.status === "fulfilled") setDepartments(depts.value);
    if (pos.status   === "fulfilled") setPositions(pos.value);
    if (brs.status   === "fulfilled") setBranches(brs.value);
    if (lts.status   === "fulfilled") setLeaveTypes(lts.value);
    if (hols.status  === "fulfilled") setHolidays(hols.value);
  }, []);

  useEffect(() => { loadMaster(); }, [loadMaster]);

  return (
    <div className="p-6 space-y-5 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Human Resources</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {employees.length} employees · {departments.length} departments
          </p>
        </div>
        <button onClick={loadMaster}
          className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors"
          style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <ModuleTabs
        tabs={TAB_ITEMS}
        activeTab={tab}
        onChange={(v) => setTab(v as Tab)}
        moduleColor={MODULE_COLORS.hr.primary}
      />

      <div>
        {tab === "dashboard"  && <DashboardTab employees={employees} departments={departments} />}
        {tab === "employees"  && <EmployeesTab employees={employees} departments={departments} positions={positions} branches={branches} onRefresh={loadMaster} />}
        {tab === "attendance" && <AttendanceTab employees={employees} departments={departments} />}
        {tab === "leaves"     && <LeavesTab employees={employees} leaveTypes={leaveTypes} />}
        {tab === "payroll"    && <PayrollTab employees={employees} departments={departments} />}
        {tab === "setup"      && <SetupTab departments={departments} positions={positions} branches={branches} leaveTypes={leaveTypes} holidays={holidays} onRefresh={loadMaster} />}
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
function DashboardTab({ employees, departments }: { employees: Employee[]; departments: Department[] }) {
  const active      = employees.filter(e => e.employment_status === "Active").length;
  const onProbation = employees.filter(e => e.employment_type === "Probation").length;
  const byDept = departments.map(d => ({
    name: d.name,
    count: employees.filter(e => e.department_id === d.id).length,
  })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);

  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);
  const [payrollStatus, setPayrollStatus] = useState<any>(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    api.get("/hr/attendance/report/daily", { params: { date: today } }).then(({ data }) => {
      const rows = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      setTodayAtt({
        total: rows.length,
        present: rows.filter((r: any) => r.status === "Present").length,
        late: rows.filter((r: any) => r.status === "Late").length,
        absent: rows.filter((r: any) => r.status === "Absent").length,
        onLeave: rows.filter((r: any) => r.status === "On Leave" || r.status === "Leave").length,
      });
    }).catch(() => {});

    leavesApi.list({ status: "Pending" }).then(data => {
      setPendingLeaves(Array.isArray(data) ? data : []);
    }).catch(() => {});

    api.get("/hr/holidays").then(({ data }) => {
      const hols = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      const todayObj = new Date();
      const upcoming = hols.filter((h: any) => new Date(h.holiday_date) >= todayObj).slice(0, 5);
      setUpcomingHolidays(upcoming);
    }).catch(() => {});

    const cp = new Date().toISOString().slice(0, 7);
    payrollApi.summary(cp).then(setPayrollStatus).catch(() => {});
  }, [today]);

  const onLeaveToday = employees.filter(e =>
    pendingLeaves.some(l => l.employee_id === e.id && l.status === "Approved" &&
      new Date(l.start_date) <= new Date(today) && new Date(l.end_date) >= new Date(today))
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={String(employees.length)} icon={Users} iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" />
        <StatCard label="Active" value={String(active)} icon={UserCheck} iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" />
        <StatCard label="Departments" value={String(departments.length)} icon={Building2} iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" />
        <StatCard label="On Probation" value={String(onProbation)} icon={Clock} iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" />
      </div>

      {todayAtt && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="detail-container p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted">Present Today</p><p className="text-xl font-bold text-primary mt-1">{todayAtt.present}</p></div>
            <StatusBadge status="Present" />
          </div>
          <div className="detail-container p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted">Late Today</p><p className="text-xl font-bold text-primary mt-1">{todayAtt.late}</p></div>
            <StatusBadge status="Late" />
          </div>
          <div className="detail-container p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted">Absent Today</p><p className="text-xl font-bold text-primary mt-1">{todayAtt.absent}</p></div>
            <StatusBadge status="Absent" />
          </div>
          <div className="detail-container p-4 flex items-center justify-between">
            <div><p className="text-xs text-muted">On Leave Today</p><p className="text-xl font-bold text-primary mt-1">{todayAtt.onLeave}</p></div>
            <StatusBadge status="On Leave" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Pending Leave Approvals</p>
            <div className="space-y-2">
              {pendingLeaves.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted">No pending approvals</p>
              ) : (
                pendingLeaves.slice(0, 5).map(l => {
                  const emp = employees.find(e => e.id === l.employee_id);
                  return (
                    <div key={l.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(245,158,11,0.08)" }}>
                      <div>
                        <p className="text-xs font-medium text-primary">{emp?.full_name ?? "—"}</p>
                        <p className="text-[10px] text-muted">{l.total_days} day(s) · {new Date(l.start_date).toLocaleDateString()}</p>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>Pending</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Upcoming Holidays</p>
            <div className="space-y-2">
              {upcomingHolidays.length === 0 ? (
                <p className="text-xs text-center py-4 text-muted">No upcoming holidays</p>
              ) : (
                upcomingHolidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "rgba(139,92,246,0.08)" }}>
                    <div>
                      <p className="text-xs font-medium text-primary">{h.name}</p>
                      <p className="text-[10px] text-muted">{new Date(h.holiday_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</p>
                    </div>
                    {h.is_recurring && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}>Annual</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Payroll Status</p>
            <div className="space-y-2">
              {payrollStatus ? (
                Object.entries(payrollStatus.status_counts ?? {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between p-2 rounded-lg" style={{ background: "var(--bg-surface)" }}>
                    <span className="text-xs text-primary">{status}</span>
                    <span className="text-sm font-bold" style={{ color: status === "Paid" ? "#10b981" : status === "Approved" ? "#3b82f6" : status === "Calculated" ? "#f59e0b" : "#94a3b8" }}>{String(count)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-center py-4 text-muted">No payroll data for current month</p>
              )}
              <p className="text-[10px] text-muted pt-1">Period: {new Date().toISOString().slice(0, 7)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Headcount by Department</p>
            <div className="space-y-2.5">
              {byDept.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No data</p>}
              {byDept.map(({ name, count }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs w-32 truncate" style={{ color: "var(--text-secondary)" }}>{name}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${(count / employees.length) * 100}%`, background: "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                  </div>
                  <span className="text-xs font-semibold text-primary w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="detail-container">
          <div className="detail-section">
            <p className="detail-section-title">Employment Status</p>
            <div className="space-y-3">
              {[
                { label: "Active",    count: active,                                                    color: "#10b981", bg: "rgba(16,185,129,0.12)" },
                { label: "Inactive",  count: employees.filter(e => e.employment_status === "Inactive").length,  color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
                { label: "Probation", count: onProbation,                                               color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className="flex items-center justify-between p-3 rounded-xl" style={{ background: bg, border: `1px solid ${color}22` }}>
                  <span className="text-xs font-medium" style={{ color }}>{label}</span>
                  <span className="text-lg font-bold" style={{ color }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <DataTable
        title="Recent Employees"
        data={employees.slice(0, 8)}
        columns={[
          { key: "employee_id", label: "ID", render: (val: any) => <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{val}</span> },
          { key: "full_name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
          { key: "department", label: "Department", render: (val: any, row: any) => <span style={{ color: "var(--text-secondary)" }}>{row.department?.name ?? "—"}</span> },
          { key: "employment_type", label: "Type", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
          { key: "employment_status", label: "Status", render: (val: string) => <StatusBadge status={val} /> },
          { key: "joining_date", label: "Joined", render: (val: string) => <span style={{ color: "var(--text-secondary)" }}>{val ? new Date(val).toLocaleDateString() : "—"}</span> },
        ]}
        sortable={false}
        searchable={false}
      />
    </div>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────
function EmployeesTab({ employees, departments, positions, branches, onRefresh }: {
  employees: Employee[]; departments: Department[]; positions: Position[];
  branches: Branch[]; onRefresh: () => void;
}) {
  const { options: EMPLOYMENT_TYPE_OPTS } = useLookup('employment_type');
  const { options: EMPLOYEE_STATUS_OPTS } = useLookup('employee_status');
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [emps, setEmps] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const paramsRef = useRef<any>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  useEffect(() => {
    api.get("/hr/shift-templates").then(({ data }) => {
      setShiftTemplates(Array.isArray(data) ? data : data?.items ?? data?.data ?? []);
    }).catch(() => {});
  }, []);

  const [selected, setSelected]       = useState<Employee | null>(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showSalary, setShowSalary]   = useState(false);
  const [salary, setSalary]           = useState<SalaryStructure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [err, setErr]                 = useState("");

  const [empForm, setEmpForm] = useState<Record<string, any>>({
    employment_type: "Permanent", employment_status: "Active",
    joining_date: new Date().toISOString().split("T")[0],
    shift_template_id: "",
    exit_date: "",
  });
  const [salForm, setSalForm] = useState<Record<string, any>>({
    basic_salary: 0, house_rent_allowance: 0, conveyance_allowance: 0,
    medical_allowance: 0, special_allowance: 0, other_allowances: 0,
    provident_fund: 0, professional_tax: 0, income_tax: 0, other_deductions: 0,
    overtime_hourly_rate: 0, effective_from: new Date().toISOString().split("T")[0],
  });

  const fetchEmployees = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const res = await api.get<Employee[]>("/hr/employees", {
        params: {
          limit: params.pageSize,
          offset: (params.page - 1) * params.pageSize,
          search: params.search || undefined,
          department_id: params.propertyType ? Number(params.propertyType) : undefined,
          status: params.status || undefined,
        }
      });
      setEmps(res.data);
      const totalCount = Number(res.headers["x-total-count"] || res.headers["X-Total-Count"] || 0);
      setTotal(totalCount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchEmployees(paramsRef.current);
    }
  };

  const openEmployee = async (emp: Employee) => {
    const detail = await employeesApi.get(emp.id).catch(() => emp);
    setSelected(detail);
    try { const s = await employeesApi.getSalary(emp.id); setSalary(s); } catch { setSalary(null); }
  };

  const saveEmployee = async () => {
    setErr(""); setLoading(true);
    try {
      if (editingEmployee) {
        await employeesApi.update(editingEmployee.id, empForm);
        pushToast({ title: "Success", message: "Employee updated", type: "success" });
      } else {
        await employeesApi.create(empForm);
        pushToast({ title: "Success", message: "Employee created", type: "success" });
      }
      setShowAdd(false);
      setEditingEmployee(null);
      setEmpForm({ employment_type: "Permanent", employment_status: "Active", joining_date: new Date().toISOString().split("T")[0], shift_template_id: "", exit_date: "" });
      refreshTable();
      await onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const openEditEmployee = (emp: Employee) => {
    setEmpForm({
      first_name: emp.first_name ?? "",
      last_name: emp.last_name ?? "",
      work_email: emp.work_email ?? "",
      personal_phone: emp.personal_phone ?? "",
      department_id: String(emp.department_id ?? ""),
      position_id: String(emp.position_id ?? ""),
      branch_id: String(emp.branch_id ?? ""),
      shift_template_id: String(emp.shift_template_id ?? ""),
      joining_date: emp.joining_date ?? "",
      exit_date: emp.exit_date ?? "",
      employment_type: emp.employment_type ?? "Permanent",
      employment_status: emp.employment_status ?? "Active",
    });
    setEditingEmployee(emp);
    setShowAdd(true);
    setErr("");
  };

  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    try {
      await employeesApi.delete(deleteTarget.id);
      pushToast({ title: "Success", message: "Employee deleted", type: "success" });
      setDeleteTarget(null);
      refreshTable();
      await onRefresh();
    } catch (e: any) {
      setErr(e.message);
      setDeleteTarget(null);
    }
  };

  const saveSalary = async () => {
    if (!selected) return;
    setErr(""); setLoading(true);
    try {
      if (salary) await employeesApi.updateSalary(selected.id, salForm);
      else await employeesApi.createSalary(selected.id, salForm);
      const s = await employeesApi.getSalary(selected.id);
      setSalary(s); setShowSalary(false);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const ef = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmpForm(p => ({ ...p, [key]: e.target.value }));
  const sf = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSalForm(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }));

  const columns = [
    { key: "employee_id", label: "ID", sortable: true, className: "font-mono text-xs text-muted" },
    { key: "full_name", label: "Name", className: "font-medium text-primary" },
    { key: "department", label: "Department", render: (val: any, row: Employee) => row.department?.name || "—" },
    { key: "position", label: "Position", render: (val: any, row: Employee) => row.position?.title || "—" },
    { key: "employment_type", label: "Type" },
    { key: "employment_status", label: "Status", render: (val: string) => <StatusBadge status={val} /> },
    { key: "joining_date", label: "Joined", render: (val: string) => val ? new Date(val).toLocaleDateString() : "—" },
  ];

  const rowActions = [
    {
      key: "view",
      label: "View",
      icon: Eye,
      onClick: (row: Employee) => openEmployee(row)
    },
    {
      key: "edit",
      label: "Edit",
      icon: Edit2,
      onClick: (row: Employee) => openEditEmployee(row)
    },
    {
      key: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: (row: Employee) => setDeleteTarget(row)
    },
    {
      key: "print",
      label: "Print",
      icon: Printer,
      onClick: (row: Employee) => printRecord(`Employee ${row.employee_id}`, [
        { label: "Name", value: row.full_name },
        { label: "Department", value: row.department?.name ?? "—" },
        { label: "Position", value: row.position?.title ?? "—" },
        { label: "Status", value: row.employment_status },
      ])
    }
  ];

  return (
    <div className="space-y-4">
      <SmartTable
        storageKey="rems_hr_employees"
        data={emps}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchEmployees}
        showTypeFilter={true}
        typeOptions={departments.map(d => ({ label: d.name, value: String(d.id) }))}
        showStatusFilter={true}
        statusOptions={["Active", "Inactive", "Resigned", "Terminated"].map(s => ({ label: s, value: s }))}
        showDateFilter={false}
        toolbarActions={
          <button onClick={() => { setShowAdd(true); setErr(""); }}
            className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
            <Plus size={13} /> Add Employee
          </button>
        }
      />

      {/* Add / Edit Employee */}
      <AppDialog isOpen={showAdd} title={editingEmployee ? "Edit Employee" : "Add Employee"} onClose={() => { setShowAdd(false); setEditingEmployee(null); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First Name *"><input value={empForm.first_name ?? ""} onChange={ef("first_name")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Last Name *"><input value={empForm.last_name ?? ""} onChange={ef("last_name")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Work Email"><input type="email" value={empForm.work_email ?? ""} onChange={ef("work_email")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Personal Phone"><input value={empForm.personal_phone ?? ""} onChange={ef("personal_phone")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Department">
            <select value={empForm.department_id ?? ""} onChange={ef("department_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Position">
            <select value={empForm.position_id ?? ""} onChange={ef("position_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Branch">
            <select value={empForm.branch_id ?? ""} onChange={ef("branch_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Shift Template">
            <select value={empForm.shift_template_id ?? ""} onChange={ef("shift_template_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {shiftTemplates.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
            </select>
          </Field>
          <Field label="Joining Date *"><input type="date" value={empForm.joining_date ?? ""} onChange={ef("joining_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Exit Date"><input type="date" value={empForm.exit_date ?? ""} onChange={ef("exit_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Employment Type">
            <select value={empForm.employment_type ?? "Permanent"} onChange={ef("employment_type")} className={inputCls} style={inputStyle}>
              {EMPLOYMENT_TYPE_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={empForm.employment_status ?? "Active"} onChange={ef("employment_status")} className={inputCls} style={inputStyle}>
              {EMPLOYEE_STATUS_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <AttachmentsButton module="employee" />
          <button onClick={() => { setShowAdd(false); setEditingEmployee(null); }} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveEmployee} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : editingEmployee ? "Update Employee" : "Save Employee"}</button>
        </div>
      </AppDialog>

      {/* Employee Detail */}
      <AppDialog isOpen={!!selected} title={selected?.full_name ?? ""} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {([["Employee ID", selected.employee_id], ["Status", selected.employment_status], ["Type", selected.employment_type],
                ["Department", selected.department?.name ?? "—"], ["Position", selected.position?.title ?? "—"],
                ["Branch", selected.branch?.name ?? "—"], ["Shift", selected.shift_template?.shift_name ?? "—"],
                ["Joined", selected.joining_date ? new Date(selected.joining_date).toLocaleDateString() : "—"],
                ["Exit Date", selected.exit_date ? new Date(selected.exit_date).toLocaleDateString() : "—"],
                ["Work Email", selected.work_email ?? "—"]] as [string,string][]).map(([k, v]) => (
                <div key={k}><p style={{ color: "var(--text-muted)" }}>{k}</p><p className="font-medium text-primary mt-0.5">{v}</p></div>
              ))}
            </div>
            {salary ? (
              <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
                <p className="text-xs font-semibold text-primary">Salary Structure</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><p style={{ color: "var(--text-muted)" }}>Basic</p><p className="font-semibold text-primary">{formatCurrency(salary.basic_salary)}</p></div>
                  <div><p style={{ color: "var(--text-muted)" }}>Gross</p><p className="font-semibold text-emerald-400">{formatCurrency(salary.gross_salary)}</p></div>
                  <div><p style={{ color: "var(--text-muted)" }}>Net</p><p className="font-semibold text-blue-400">{formatCurrency(salary.net_salary)}</p></div>
                </div>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No salary structure defined.</p>
            )}
            <button onClick={() => {
              if (salary) setSalForm({ basic_salary: salary.basic_salary, house_rent_allowance: salary.house_rent_allowance, conveyance_allowance: salary.conveyance_allowance, medical_allowance: salary.medical_allowance, special_allowance: salary.special_allowance, other_allowances: salary.other_allowances, provident_fund: salary.provident_fund, professional_tax: salary.professional_tax, income_tax: salary.income_tax, other_deductions: salary.other_deductions, overtime_hourly_rate: salary.overtime_hourly_rate, effective_from: salary.effective_from });
              setShowSalary(true);
            }} className="btn-primary px-3 py-1.5 text-xs">{salary ? "Edit Salary" : "Set Salary"}</button>
          <div className="pt-2 border-t border-theme/50">
            <AttachmentPanel module="employee" recordId={selected.id} title="Documents" />
          </div>
          <div className="pt-2 border-t border-theme/50">
            <FileUpload module="hr" recordType="employee" recordId={String(selected.id)} documentTypes={["CNIC", "Contract", "Degree", "Experience Letter", "Other"]} />
          </div>
          </div>
        )}
      </AppDialog>

      {/* Salary */}
      <AppDialog isOpen={showSalary} title={`Salary — ${selected?.full_name ?? ""}`} onClose={() => setShowSalary(false)}>
        <div className="grid grid-cols-2 gap-3">
          {(["basic_salary","house_rent_allowance","conveyance_allowance","medical_allowance","special_allowance","other_allowances","provident_fund","professional_tax","income_tax","other_deductions","overtime_hourly_rate"] as const).map(key => (
            <Field key={key} label={key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}>
              <input type="number" min="0" step="0.01" value={salForm[key] ?? 0} onChange={sf(key)} className={inputCls} style={inputStyle} />
            </Field>
          ))}
          <Field label="Effective From *"><input type="date" value={salForm.effective_from ?? ""} onChange={e => setSalForm(p => ({ ...p, effective_from: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setShowSalary(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveSalary} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save Salary"}</button>
        </div>
      </AppDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.full_name ?? ""}`}
        message={`Remove employee "${deleteTarget?.full_name}" (${deleteTarget?.employee_id})? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => void handleDeleteEmployee()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────────────────
function AttendanceTab({ employees, departments }: { employees: Employee[]; departments: Department[] }) {
  const today = new Date().toISOString().split("T")[0];
  const [reportDate, setReportDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState("");
  const [dailyReport, setDailyReport] = useState<any[]>([]);
  const [showMark, setShowMark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [attForm, setAttForm] = useState<Record<string, any>>({
    attendance_date: today, attendance_status: "Present", is_manual_correction: false,
  });

  useEffect(() => {
    api.get("/hr/shift-templates").then(({ data }) => {
      setShiftTemplates(Array.isArray(data) ? data : data?.items ?? data?.data ?? []);
    }).catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    try {
      const data = await attendanceApi.dailyReport(reportDate, deptFilter ? Number(deptFilter) : undefined);
      setDailyReport(data);
    } catch { setDailyReport([]); }
  }, [reportDate, deptFilter]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const markAttendance = async () => {
    setErr(""); setLoading(true);
    try { await attendanceApi.mark(attForm); setShowMark(false); await loadReport(); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const af = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setAttForm(p => ({ ...p, [key]: e.target.value }));

  const counts = {
    Present: dailyReport.filter(r => r.status === "Present").length,
    Late: dailyReport.filter(r => r.status === "Late").length,
    "Half Day": dailyReport.filter(r => r.status === "Half Day").length,
    Absent:  dailyReport.filter(r => r.status === "Absent").length,
    "On Leave": dailyReport.filter(r => r.status === "On Leave").length,
    Holiday: dailyReport.filter(r => r.status === "Holiday").length,
    "Weekly Off": dailyReport.filter(r => r.status === "Weekly Off").length,
    "Not Marked": dailyReport.filter(r => r.status === "Not Marked").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className={`${inputCls} w-40`} style={inputStyle} />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className={`${inputCls} w-40`} style={inputStyle}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={loadReport} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><RefreshCw size={13} /></button>
        </div>
        <button onClick={() => { setShowMark(true); setErr(""); }} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Plus size={13} /> Mark Attendance</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className="detail-container p-4 flex items-center justify-between">
            <div><p className="text-xs" style={{ color: "var(--text-muted)" }}>{status}</p><p className="text-xl font-bold text-primary mt-1">{count}</p></div>
            <StatusBadge status={status} />
          </div>
        ))}
      </div>

      <DataTable
        title={`Daily Attendance — ${new Date(reportDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`}
        data={dailyReport}
        columns={[
          { key: "employee_code", label: "ID", render: (val: any) => <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>{val}</span> },
          { key: "full_name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
          { key: "department", label: "Department", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
          { key: "status", label: "Status", render: (val: string) => <StatusBadge status={val} /> },
          { key: "check_in", label: "Check In", render: (val: string) => <span style={{ color: "var(--text-secondary)" }}>{val ? new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span> },
          { key: "check_out", label: "Check Out", render: (val: string) => <span style={{ color: "var(--text-secondary)" }}>{val ? new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span> },
          { key: "total_hours", label: "Hours", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
          { key: "overtime_hours", label: "OT", render: (val: number) => <span style={{ color: val > 0 ? "#10b981" : "var(--text-secondary)" }}>{val ?? "—"}</span> },
          { key: "late_minutes", label: "Late (min)", render: (val: number) => <span style={{ color: val > 0 ? "#f59e0b" : "var(--text-secondary)" }}>{val ?? "—"}</span> },
        ]}
        sortable={false}
        searchable={false}
      />

      <AppDialog isOpen={showMark} title="Mark Attendance" onClose={() => setShowMark(false)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee *">
            <select value={attForm.employee_id ?? ""} onChange={af("employee_id")} className={inputCls} style={inputStyle}>
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </Field>
          <Field label="Date *"><input type="date" value={attForm.attendance_date ?? today} onChange={af("attendance_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Status">
            <select value={attForm.attendance_status ?? "Present"} onChange={af("attendance_status")} className={inputCls} style={inputStyle}>
              {["Present","Late","Half Day","Absent","On Leave","Holiday","Weekly Off"].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Shift Template">
            <select value={attForm.shift_template_id ?? ""} onChange={af("shift_template_id")} className={inputCls} style={inputStyle}>
              <option value="">Default</option>
              {shiftTemplates.map(s => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
            </select>
          </Field>
          <Field label="Check In"><input type="datetime-local" value={attForm.check_in_time ?? ""} onChange={af("check_in_time")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Check Out"><input type="datetime-local" value={attForm.check_out_time ?? ""} onChange={af("check_out_time")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Is Manual Correction">
            <select value={attForm.is_manual_correction ? "true" : "false"} onChange={e => setAttForm(p => ({ ...p, is_manual_correction: e.target.value === "true" }))} className={inputCls} style={inputStyle}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
          {attForm.is_manual_correction && <div className="col-span-2"><Field label="Correction Reason *"><input value={attForm.correction_reason ?? ""} onChange={af("correction_reason")} className={inputCls} style={inputStyle} placeholder="Required for audit trail" /></Field></div>}
          <Field label="Notes"><input value={attForm.notes ?? ""} onChange={af("notes")} className={inputCls} style={inputStyle} /></Field>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setShowMark(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={markAttendance} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Mark"}</button>
        </div>
      </AppDialog>
    </div>
  );
}

// ── Leaves Tab ────────────────────────────────────────────────────────────────
function LeavesTab({ employees, leaveTypes }: { employees: Employee[]; leaveTypes: LeaveType[] }) {
  const [leaves, setLeaves]           = useState<Leave[]>([]);
  const [loading, setLoading]         = useState(false);
  const [total, setTotal]             = useState(0);
  const paramsRef = useRef<any>(null);
  const pushToast = useNotifStore((s) => s.pushToast);

  const [showRequest, setShowRequest] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [balances, setBalances]       = useState<LeaveBalance[]>([]);
  const [rejectId, setRejectId]       = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [err, setErr]                 = useState("");
  const [leaveForm, setLeaveForm]     = useState<Record<string, any>>({
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    total_days: 1,
  });

  const fetchLeaves = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const statusFilter = params.status || undefined;
      const empFilter = params.propertyType ? Number(params.propertyType) : undefined;
      
      const data = await leavesApi.list({
        status: statusFilter,
        employee_id: empFilter
      });
      
      const searchTerm = params.search?.toLowerCase() || "";
      const filteredData = data.filter(l => {
        const emp = employees.find(e => e.id === l.employee_id);
        const lt  = leaveTypes.find(t => t.id === l.leave_type_id);
        const empName = emp?.full_name?.toLowerCase() || "";
        const leaveTypeName = lt?.name?.toLowerCase() || "";
        const reasonText = l.reason?.toLowerCase() || "";
        
        return !searchTerm || 
               empName.includes(searchTerm) || 
               leaveTypeName.includes(searchTerm) || 
               reasonText.includes(searchTerm);
      });

      const startIndex = (params.page - 1) * params.pageSize;
      const endIndex = startIndex + params.pageSize;
      
      setLeaves(filteredData.slice(startIndex, endIndex));
      setTotal(filteredData.length);
    } catch {
      setLeaves([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchLeaves(paramsRef.current);
    }
  };

  const lf = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setLeaveForm(p => ({ ...p, [key]: e.target.value }));

  const requestLeave = async () => {
    setErr(""); setLoading(true);
    try {
      await leavesApi.request(leaveForm);
      pushToast({ title: "Success", message: "Leave request submitted", type: "success" });
      setShowRequest(false);
      refreshTable();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const approve = async (id: number) => {
    setLoading(true);
    try {
      await leavesApi.approve(id);
      pushToast({ title: "Success", message: "Leave approved", type: "success" });
      refreshTable();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const reject = async () => {
    if (!rejectId || !rejectReason) return;
    setLoading(true);
    try {
      await leavesApi.reject(rejectId, rejectReason);
      pushToast({ title: "Success", message: "Leave rejected", type: "success" });
      setRejectId(null);
      setRejectReason("");
      refreshTable();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const viewBalance = async (empId: number) => {
    try { const b = await leavesApi.balance(empId); setBalances(b); setShowBalance(true); }
    catch { setBalances([]); setShowBalance(true); }
  };

  const columns = [
    {
      key: "employee_id",
      label: "Employee",
      render: (val: any, row: Leave) => {
        const emp = employees.find(e => e.id === row.employee_id);
        return emp?.full_name ?? `#${row.employee_id}`;
      },
      className: "font-medium text-primary"
    },
    {
      key: "leave_type_id",
      label: "Type",
      render: (val: any, row: Leave) => {
        const lt = leaveTypes.find(t => t.id === row.leave_type_id);
        return lt?.name ?? "—";
      },
      className: "text-secondary"
    },
    {
      key: "start_date",
      label: "From",
      render: (val: string) => new Date(val).toLocaleDateString(),
      className: "text-secondary"
    },
    {
      key: "end_date",
      label: "To",
      render: (val: string) => new Date(val).toLocaleDateString(),
      className: "text-secondary"
    },
    {
      key: "total_days",
      label: "Days",
      className: "font-semibold text-primary"
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => <StatusBadge status={val} />
    },
    {
      key: "reason",
      label: "Reason",
      className: "max-w-xs truncate text-secondary"
    }
  ];

  const rowActions = [
    {
      key: "approve",
      label: "Approve",
      icon: CheckCircle,
      variant: "success" as const,
      hidden: (row: Leave) => row.status !== "Pending",
      onClick: (row: Leave) => approve(row.id),
    },
    {
      key: "reject",
      label: "Reject",
      icon: XCircle,
      variant: "danger" as const,
      hidden: (row: Leave) => row.status !== "Pending",
      onClick: (row: Leave) => setRejectId(row.id),
    },
    {
      key: "balance",
      label: "Balance",
      icon: Eye,
      onClick: (row: Leave) => viewBalance(row.employee_id),
    }
  ];

  return (
    <div className="space-y-4">
      <SmartTable
        storageKey="rems_hr_leaves"
        data={leaves}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchLeaves}
        showTypeFilter={true}
        typeOptions={employees.map(e => ({ label: e.full_name, value: String(e.id) }))}
        showStatusFilter={true}
        statusOptions={["Pending", "Approved", "Rejected", "Cancelled"].map(s => ({ label: s, value: s }))}
        showDateFilter={false}
        toolbarActions={
          <button onClick={() => { setShowRequest(true); setErr(""); }} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs">
            <Plus size={13} /> Request Leave
          </button>
        }
      />

      <AppDialog isOpen={showRequest} title="Request Leave" onClose={() => setShowRequest(false)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Employee *">
            <select value={leaveForm.employee_id ?? ""} onChange={lf("employee_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </Field>
          <Field label="Leave Type *">
            <select value={leaveForm.leave_type_id ?? ""} onChange={lf("leave_type_id")} className={inputCls} style={inputStyle}>
              <option value="">Select…</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Start Date *"><input type="date" value={leaveForm.start_date ?? ""} onChange={lf("start_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="End Date *"><input type="date" value={leaveForm.end_date ?? ""} onChange={lf("end_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Half Day">
            <select value={leaveForm.is_half_day ? "true" : "false"} onChange={e => setLeaveForm(p => ({ ...p, is_half_day: e.target.value === "true" }))} className={inputCls} style={inputStyle}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Reason *">
              <textarea value={leaveForm.reason ?? ""} onChange={lf("reason")} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
            </Field>
          </div>
          {(() => {
            const selectedLT = leaveTypes.find(t => t.id === Number(leaveForm.leave_type_id));
            return selectedLT?.requires_document ? (
              <div className="col-span-2">
                <Field label="Attachment (Medical Certificate / Document)">
                  <input type="file" onChange={e => setLeaveForm(p => ({ ...p, medical_certificate: e.target.files?.[0]?.name || "" }))} className={inputCls} style={inputStyle} />
                </Field>
              </div>
            ) : null;
          })()}
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setShowRequest(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={requestLeave} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Submitting…" : "Submit Request"}</button>
        </div>
      </AppDialog>

      <AppDialog isOpen={!!rejectId} title="Reject Leave" onClose={() => setRejectId(null)}>
        <Field label="Rejection Reason *">
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
        </Field>
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setRejectId(null)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={reject} disabled={loading || !rejectReason} className="px-4 py-2 text-xs rounded-lg" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{loading ? "Rejecting…" : "Reject"}</button>
        </div>
      </AppDialog>

      <AppDialog isOpen={showBalance} title="Leave Balance" onClose={() => setShowBalance(false)}>
        <div className="space-y-2">
          {balances.length === 0 && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No balance data</p>}
          {balances.map(b => (
            <div key={b.leave_type_id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: "var(--hover-bg-sm)", border: "1px solid var(--border)" }}>
              <div>
                <p className="text-xs font-medium text-primary">{b.leave_type_name}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Used: {b.used} / Earned: {b.earned}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold" style={{ color: b.closing_balance > 0 ? "#10b981" : "#ef4444" }}>{b.closing_balance}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>days left</p>
              </div>
            </div>
          ))}
        </div>
      </AppDialog>
    </div>
  );
}

// ── Payroll Tab ───────────────────────────────────────────────────────────────
function PayrollTab({ employees, departments }: { employees: Employee[]; departments: Department[] }) {
  const { options: PAYMENT_METHOD_OPTS } = useLookup('payment_method');
  const currentPeriod = new Date().toISOString().slice(0, 7);
  const [period, setPeriod]       = useState(currentPeriod);
  const [payrolls, setPayrolls]   = useState<Payroll[]>([]);
  const [total, setTotal]         = useState(0);
  const [summary, setSummary]     = useState<any>(null);
  const [payslip, setPayslip]     = useState<PayslipData | null>(null);
  const [calcEmpId, setCalcEmpId] = useState<number | null>(null);
  const [markPaidId, setMarkPaidId] = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);
  const paramsRef = useRef<any>(null);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [paidForm, setPaidForm]   = useState({
    payment_date: new Date().toISOString().split("T")[0],
    payment_method: "Bank Transfer", transaction_reference: "", bank_account: "",
  });

  const fetchPayroll = async (params: any) => {
    paramsRef.current = params;
    setLoading(true);
    try {
      const data = await payrollApi.list({
        payroll_period: period,
        status: params.status || undefined
      });
      
      const searchTerm = params.search?.toLowerCase() || "";
      const filteredData = data.filter(p => {
        const emp = employees.find(e => e.id === p.employee_id);
        const empName = emp?.full_name?.toLowerCase() || "";
        return !searchTerm || empName.includes(searchTerm);
      });

      const startIndex = (params.page - 1) * params.pageSize;
      const endIndex = startIndex + params.pageSize;
      
      setPayrolls(filteredData.slice(startIndex, endIndex));
      setTotal(filteredData.length);
    } catch {
      setPayrolls([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const refreshTable = () => {
    if (paramsRef.current) {
      fetchPayroll(paramsRef.current);
    }
    payrollApi.summary(period).then(setSummary).catch(() => setSummary(null));
  };

  useEffect(() => {
    refreshTable();
  }, [period]);

  const calcSingle = async () => {
    if (!calcEmpId || calcEmpId === -1) return;
    setLoading(true);
    try { await payrollApi.calculate(calcEmpId, period); pushToast({ title: "Success", message: "Payroll calculated", type: "success" }); setCalcEmpId(null); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const calcAll = async () => {
    setLoading(true);
    try { await payrollApi.calculateAll(period); pushToast({ title: "Success", message: "All payrolls calculated", type: "success" }); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const approve = async (id: number) => {
    setLoading(true);
    try { await payrollApi.approve(id); pushToast({ title: "Success", message: "Payroll approved", type: "success" }); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const postAccounting = async (id: number) => {
    setLoading(true);
    try { await payrollApi.postAccounting(id); pushToast({ title: "Success", message: "Payroll posted to accounting", type: "success" }); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const markPaid = async () => {
    if (!markPaidId) return;
    setLoading(true);
    try { await payrollApi.markPaid(markPaidId, paidForm); pushToast({ title: "Success", message: "Payroll marked as paid", type: "success" }); setMarkPaidId(null); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const viewPayslip = async (id: number) => {
    try { const d = await payrollApi.payslip(id); setPayslip(d); }
    catch (e: any) { alert(e.message); }
  };

  const pf = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setPaidForm(p => ({ ...p, [key]: e.target.value }));

  const columns = [
    {
      key: "employee_id",
      label: "Employee",
      render: (val: any, row: Payroll) => {
        const emp = employees.find(e => e.id === row.employee_id);
        return emp?.full_name ?? `#${row.employee_id}`;
      },
      className: "font-medium text-primary"
    },
    {
      key: "basic_salary",
      label: "Basic",
      render: (val: number) => formatCurrency(val),
      className: "text-right text-secondary"
    },
    {
      key: "gross_salary",
      label: "Gross",
      render: (val: number) => formatCurrency(val),
      className: "text-right font-semibold text-emerald-400"
    },
    {
      key: "total_deductions",
      label: "Deductions",
      render: (val: number) => formatCurrency(val),
      className: "text-right text-red-400"
    },
    {
      key: "net_salary",
      label: "Net",
      render: (val: number) => formatCurrency(val),
      className: "text-right font-bold text-primary"
    },
    {
      key: "overtime_hours",
      label: "OT Hrs",
      render: (val: number) => Number(val || 0).toFixed(1),
      className: "text-secondary"
    },
    {
      key: "late_days",
      label: "Late",
      className: "text-secondary"
    },
    {
      key: "status",
      label: "Status",
      render: (val: string) => <StatusBadge status={val} />
    }
  ];

  const rowActions = [
    {
      key: "approve",
      label: "Approve",
      icon: CheckCircle,
      variant: "success" as const,
      hidden: (row: Payroll) => row.status !== "Calculated",
      onClick: (row: Payroll) => approve(row.id),
    },
    {
      key: "post",
      label: "Post",
      icon: FileText,
      variant: "primary" as const,
      hidden: (row: Payroll) => row.status !== "Approved" || !!row.journal_id,
      onClick: (row: Payroll) => postAccounting(row.id),
    },
    {
      key: "pay",
      label: "Pay",
      icon: DollarSign,
      variant: "warning" as const,
      hidden: (row: Payroll) => row.status !== "Approved",
      onClick: (row: Payroll) => setMarkPaidId(row.id),
    },
    {
      key: "payslip",
      label: "Payslip",
      icon: Printer,
      onClick: (row: Payroll) => viewPayslip(row.id),
    }
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 animate-fadeIn">
          <StatCard label="Employees" value={String(summary.total_employees)} icon={Users} iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" />
          <StatCard label="Total Gross" value={formatCurrency(summary.total_gross_salary)} icon={TrendingUp} iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" />
          <StatCard label="Total Deductions" value={formatCurrency(summary.total_deductions)} icon={ArrowDownRight} iconBg="rgba(239,68,68,0.12)" iconColor="#ef4444" />
          <StatCard label="Total Net" value={formatCurrency(summary.total_net_salary)} icon={DollarSign} iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" />
        </div>
      )}

      <SmartTable
        storageKey="rems_hr_payroll"
        data={payrolls}
        columns={columns}
        rowActions={rowActions}
        loading={loading}
        total={total}
        onParamsChange={fetchPayroll}
        showTypeFilter={false}
        showStatusFilter={true}
        statusOptions={["Calculated", "Approved", "Paid"].map(s => ({ label: s, value: s }))}
        showDateFilter={false}
        toolbarActions={
          <div className="flex gap-2 items-center">
            <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className={`${inputCls} w-40`} style={inputStyle} />
            <button onClick={refreshTable} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><RefreshCw size={13} /></button>
            <button onClick={() => setCalcEmpId(-1)} className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}><Plus size={13} /> Single</button>
            <button onClick={calcAll} disabled={loading} className="btn-primary flex items-center gap-1.5 px-3 py-2 text-xs"><Users size={13} /> {loading ? "Processing…" : "Calculate All"}</button>
          </div>
        }
      />

      <AppDialog isOpen={calcEmpId !== null} title="Calculate Payroll" onClose={() => setCalcEmpId(null)}>
        <Field label="Employee *">
          <select value={calcEmpId === -1 ? "" : (calcEmpId ?? "")} onChange={e => setCalcEmpId(Number(e.target.value))} className={inputCls} style={inputStyle}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </Field>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Period: <strong className="text-primary">{period}</strong></p>
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setCalcEmpId(null)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={calcSingle} disabled={loading || !calcEmpId || calcEmpId === -1} className="btn-primary px-4 py-2 text-xs">{loading ? "Calculating…" : "Calculate"}</button>
        </div>
      </AppDialog>

      <AppDialog isOpen={!!markPaidId} title="Mark as Paid" onClose={() => setMarkPaidId(null)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment Date *"><input type="date" value={paidForm.payment_date} onChange={pf("payment_date")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Payment Method *">
            <select value={paidForm.payment_method} onChange={pf("payment_method")} className={inputCls} style={inputStyle}>
              {PAYMENT_METHOD_OPTS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>
          <Field label="Transaction Reference"><input value={paidForm.transaction_reference} onChange={pf("transaction_reference")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Bank Account"><input value={paidForm.bank_account} onChange={pf("bank_account")} className={inputCls} style={inputStyle} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setMarkPaidId(null)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={markPaid} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Processing…" : "Mark Paid"}</button>
        </div>
      </AppDialog>

      <AppDialog isOpen={!!payslip} title="Payslip" onClose={() => setPayslip(null)}>
        {payslip && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
              <p className="font-bold text-primary text-sm">{payslip.employee.name}</p>
              <p style={{ color: "var(--text-muted)" }}>{payslip.employee.id} · {payslip.employee.department} · {payslip.employee.position}</p>
              <p style={{ color: "var(--text-muted)" }}>Period: {payslip.payroll.period} · Status: {payslip.payroll.status}</p>
            </div>
            <div>
              <p className="font-semibold text-primary mb-2">Earnings</p>
              <div className="space-y-1">
                {Object.entries(payslip.earnings).filter(([k]) => k !== "total_earnings").map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>{k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
                    <span className="font-medium text-primary">{formatCurrency(Number(v))}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-emerald-400">Total Earnings</span>
                  <span className="text-emerald-400">{formatCurrency(payslip.earnings.total_earnings)}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="font-semibold text-primary mb-2">Deductions</p>
              <div className="space-y-1">
                {Object.entries(payslip.deductions).filter(([k]) => k !== "total_deductions").map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span style={{ color: "var(--text-secondary)" }}>{k.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
                    <span className="font-medium text-red-400">{formatCurrency(Number(v))}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 font-bold" style={{ borderTop: "1px solid var(--border)" }}>
                  <span className="text-red-400">Total Deductions</span>
                  <span className="text-red-400">{formatCurrency(payslip.deductions.total_deductions)}</span>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <p style={{ color: "var(--text-muted)" }}>Net Salary</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(payslip.summary.net_salary)}</p>
            </div>
          </div>
        )}
      </AppDialog>
    </div>
  );
}
// ── Setup Tab ─────────────────────────────────────────────────────────────────
function SetupTab({
  departments, positions, branches, leaveTypes, holidays, onRefresh,
}: {
  departments: Department[]; positions: Position[]; branches: Branch[];
  leaveTypes: LeaveType[]; holidays: Holiday[]; onRefresh: () => void;
}) {
  type SetupSection = "branches" | "departments" | "positions" | "leaveTypes" | "holidays" | "shiftTemplates";
  const [section, setSection] = useState<SetupSection>("departments");
  const [loading, setLoading] = useState(false);
  const pushToast = useNotifStore((s) => s.pushToast);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; item: any } | null>(null);

  // ── Shift Templates ──────────────────────────────────────────────────────
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const blankShift = { shift_name: "", start_time: "", end_time: "", break_duration: 0, grace_period_minutes: 0, half_day_threshold_hours: 0, full_day_required_hours: 0, weekly_off_days: "", is_flexible: false, is_active: true };
  const [shiftForm, setShiftForm] = useState(blankShift);
  const [editShiftId, setEditShiftId] = useState<number | null>(null);
  const [shiftModal, setShiftModal] = useState(false);

  const loadShiftTemplates = async () => {
    try {
      const { data } = await api.get("/hr/shift-templates");
      setShiftTemplates(Array.isArray(data) ? data : data.items ?? data.data ?? []);
    } catch { setShiftTemplates([]); }
  };
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const { type, item } = deleteTarget;
    setLoading(true);
    try {
      if (type === "shiftTemplate") {
        await api.delete(`/hr/shift-templates/${item.id}`);
        await loadShiftTemplates();
      } else if (type === "branch") {
        await branchesApi.delete(item.id);
        await onRefresh();
      } else if (type === "department") {
        await departmentsApi.delete(item.id);
        await onRefresh();
      } else if (type === "position") {
        await api.delete(`/hr/positions/${item.id}`);
        await onRefresh();
      } else if (type === "leaveType") {
        await api.delete(`/hr/leave-types/${item.id}`);
        await onRefresh();
      } else if (type === "holiday") {
        await holidaysApi.delete(item.id);
        await onRefresh();
      }
      pushToast({ title: "Success", message: `${type === "shiftTemplate" ? "Shift template" : type} deleted successfully`, type: "success" });
    } catch (e: any) {
      pushToast({ title: "Error", message: e?.response?.data?.detail || e?.message || "Delete failed", type: "error" });
    } finally {
      setLoading(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, pushToast, loadShiftTemplates, onRefresh]);
  useEffect(() => { loadShiftTemplates(); }, []);

  const openShift = (s?: any) => {
    if (s) {
      setShiftForm({
        shift_name: s.shift_name ?? "", start_time: s.start_time ?? "", end_time: s.end_time ?? "",
        break_duration: s.break_duration ?? 0, grace_period_minutes: s.grace_period_minutes ?? 0,
        half_day_threshold_hours: s.half_day_threshold_hours ?? 0, full_day_required_hours: s.full_day_required_hours ?? 0,
        weekly_off_days: s.weekly_off_days ?? "", is_flexible: s.is_flexible ?? false, is_active: s.is_active ?? true,
      });
      setEditShiftId(s.id);
    } else { setShiftForm(blankShift); setEditShiftId(null); }
    setShiftModal(true);
  };
  const saveShift = async () => {
    setLoading(true);
    try {
      if (editShiftId) { await api.patch(`/hr/shift-templates/${editShiftId}`, shiftForm); pushToast({ title: "Success", message: "Shift template updated", type: "success" }); }
      else { await api.post("/hr/shift-templates", shiftForm); pushToast({ title: "Success", message: "Shift template created", type: "success" }); }
      setShiftModal(false); await loadShiftTemplates();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteShift = (id: number) => {
    setDeleteTarget({ type: "shiftTemplate", item: { id } });
  };

  // ── Branches ─────────────────────────────────────────────────────────────
  const blankBranch = { name: "", code: "", address: "", city: "", contact_person: "", phone: "", timezone: "", is_active: true };
  const [branchForm, setBranchForm] = useState(blankBranch);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [branchModal, setBranchModal] = useState(false);

  const openBranch = (b?: any) => {
    if (b) {
      setBranchForm({ name: b.name ?? "", code: b.code ?? "", address: b.address ?? "", city: b.city ?? "", contact_person: b.contact_person ?? "", phone: b.phone ?? "", timezone: b.timezone ?? "", is_active: b.is_active ?? true });
      setEditBranchId(b.id);
    } else { setBranchForm(blankBranch); setEditBranchId(null); }
    setBranchModal(true);
  };
  const saveBranch = async () => {
    setLoading(true);
    try {
      if (editBranchId) { await branchesApi.update(editBranchId, branchForm); pushToast({ title: "Success", message: "Branch updated", type: "success" }); }
      else { await branchesApi.create(branchForm); pushToast({ title: "Success", message: "Branch created", type: "success" }); }
      setBranchModal(false); await onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteBranch = (id: number) => {
    setDeleteTarget({ type: "branch", item: { id } });
  };

  // ── Departments ──────────────────────────────────────────────────────────
  const blankDept = { name: "", code: "", parent_id: "", branch_id: "", is_active: true };
  const [deptForm, setDeptForm] = useState(blankDept);
  const [editDeptId, setEditDeptId] = useState<number | null>(null);
  const [deptModal, setDeptModal] = useState(false);

  const openDept = (d?: any) => {
    if (d) {
      setDeptForm({ name: d.name ?? "", code: d.code ?? "", parent_id: String(d.parent_id ?? ""), branch_id: String(d.branch_id ?? ""), is_active: d.is_active ?? true });
      setEditDeptId(d.id);
    } else { setDeptForm(blankDept); setEditDeptId(null); }
    setDeptModal(true);
  };
  const saveDept = async () => {
    setLoading(true);
    try {
      const payload = { ...deptForm, parent_id: deptForm.parent_id ? Number(deptForm.parent_id) : undefined, branch_id: deptForm.branch_id ? Number(deptForm.branch_id) : undefined };
      if (editDeptId) { await departmentsApi.update(editDeptId, payload); pushToast({ title: "Success", message: "Department updated", type: "success" }); }
      else { await departmentsApi.create(payload); pushToast({ title: "Success", message: "Department created", type: "success" }); }
      setDeptModal(false); await onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteDept = (id: number) => {
    setDeleteTarget({ type: "department", item: { id } });
  };

  // ── Positions ────────────────────────────────────────────────────────────
  const blankPos = { title: "", code: "", grade: "", description: "", is_active: true };
  const [posForm, setPosForm] = useState(blankPos);
  const [editPosId, setEditPosId] = useState<number | null>(null);
  const [posModal, setPosModal] = useState(false);

  const openPos = (p?: any) => {
    if (p) {
      setPosForm({ title: p.title ?? "", code: p.code ?? "", grade: p.grade ?? "", description: p.description ?? "", is_active: p.is_active ?? true });
      setEditPosId(p.id);
    } else { setPosForm(blankPos); setEditPosId(null); }
    setPosModal(true);
  };
  const savePos = async () => {
    setLoading(true);
    try {
      const payload = { ...posForm };
      if (editPosId) { await positionsApi.update(editPosId, payload); pushToast({ title: "Success", message: "Position updated", type: "success" }); }
      else { await positionsApi.create(payload); pushToast({ title: "Success", message: "Position created", type: "success" }); }
      setPosModal(false); await onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deletePos = (id: number) => {
    setDeleteTarget({ type: "position", item: { id } });
  };

  // ── Leave Types ──────────────────────────────────────────────────────────
  const blankLT = { name: "", code: "", days_per_year: 15, is_paid: true, carry_forward: false, max_carry_forward: 0, requires_document: false, applicable_after_probation: false, is_active: true };
  const [ltForm, setLtForm] = useState(blankLT);
  const [editLtId, setEditLtId] = useState<number | null>(null);
  const [ltModal, setLtModal] = useState(false);

  const openLT = (lt?: any) => {
    if (lt) {
      setLtForm({ name: lt.name ?? "", code: lt.code ?? "", days_per_year: lt.days_per_year ?? 15, is_paid: lt.is_paid ?? true, carry_forward: lt.carry_forward ?? false, max_carry_forward: lt.max_carry_forward ?? 0, requires_document: lt.requires_document ?? false, applicable_after_probation: lt.applicable_after_probation ?? false, is_active: lt.is_active ?? true });
      setEditLtId(lt.id);
    } else { setLtForm(blankLT); setEditLtId(null); }
    setLtModal(true);
  };
  const saveLT = async () => {
    setLoading(true);
    try {
      const payload = { ...ltForm, days_per_year: Number(ltForm.days_per_year), max_carry_forward: Number(ltForm.max_carry_forward) };
      if (editLtId) { await api.patch(`/hr/leave-types/${editLtId}`, payload); pushToast({ title: "Success", message: "Leave type updated", type: "success" }); }
      else { await leaveTypesApi.create(payload); pushToast({ title: "Success", message: "Leave type created", type: "success" }); }
      setLtModal(false); await onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteLT = (id: number) => {
    setDeleteTarget({ type: "leaveType", item: { id } });
  };

  // ── Holidays ─────────────────────────────────────────────────────────────
  const blankHol = { name: "", holiday_date: "", is_recurring: false, branch_id: "", is_active: true };
  const [holForm, setHolForm] = useState(blankHol);
  const [editHolId, setEditHolId] = useState<number | null>(null);
  const [holModal, setHolModal] = useState(false);

  const openHol = (h?: any) => {
    if (h) {
      setHolForm({ name: h.name ?? "", holiday_date: h.holiday_date ?? "", is_recurring: h.is_recurring ?? false, branch_id: String(h.branch_id ?? ""), is_active: h.is_active ?? true });
      setEditHolId(h.id);
    } else { setHolForm(blankHol); setEditHolId(null); }
    setHolModal(true);
  };
  const saveHol = async () => {
    setLoading(true);
    try {
      const payload = { ...holForm, branch_id: holForm.branch_id ? Number(holForm.branch_id) : undefined };
      if (editHolId) { await api.patch(`/hr/holidays/${editHolId}`, payload); pushToast({ title: "Success", message: "Holiday updated", type: "success" }); }
      else { await holidaysApi.create(payload); pushToast({ title: "Success", message: "Holiday created", type: "success" }); }
      setHolModal(false); await onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteHol = (id: number) => {
    setDeleteTarget({ type: "holiday", item: { id } });
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const btnEdit = { color: "#F59E0B", background: "transparent", border: "none", width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  const btnDel  = { color: "#EF4444", background: "transparent", border: "none", width: 28, height: 28, borderRadius: 6, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
  const ActionsCell = ({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) => (
    <div className="flex gap-1">
      <button onClick={onEdit} style={btnEdit}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)"}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
        <Edit2 size={13} />
      </button>
      <button onClick={onDelete} style={btnDel}
        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"}
        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
        <Trash2 size={13} />
      </button>
    </div>
  );
  const SETUP_SECTIONS = [
    { value: "branches",       label: "Branches",       icon: Building2  },
    { value: "departments",    label: "Departments",    icon: Building2  },
    { value: "positions",      label: "Positions",      icon: Briefcase  },
    { value: "leaveTypes",     label: "Leave Types",    icon: FileText   },
    { value: "holidays",       label: "Holidays",       icon: Calendar   },
    { value: "shiftTemplates", label: "Shift Templates", icon: Clock     },
  ];
  const parentDept = (id: any) => departments.find(d => d.id === id)?.name ?? "—";
  const branchName = (id: any) => branches.find(b => b.id === id)?.name ?? "—";
  const deptName   = (id: any) => departments.find(d => d.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <ModuleTabs
        tabs={SETUP_SECTIONS}
        activeTab={section}
        onChange={(v) => setSection(v as SetupSection)}
        moduleColor={MODULE_COLORS.hr.primary}
      />

      {/* ── Branches ──────────────────────────────────────────────────────── */}
      {section === "branches" && (
        <DataTable
          title={`Branches (${branches.length})`}
          data={branches}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "city", label: "City", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "phone", label: "Phone", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openBranch(row)} onDelete={() => deleteBranch(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openBranch()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Departments ───────────────────────────────────────────────────── */}
      {section === "departments" && (
        <DataTable
          title={`Departments (${departments.length})`}
          data={departments}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "parent_id", label: "Parent", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{parentDept(val)}</span> },
            { key: "branch_id", label: "Branch", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{branchName(val)}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openDept(row)} onDelete={() => deleteDept(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openDept()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Positions ─────────────────────────────────────────────────────── */}
      {section === "positions" && (
        <DataTable
          title={`Positions (${positions.length})`}
          data={positions}
          columns={[
            { key: "title", label: "Title", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "grade", label: "Grade", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openPos(row)} onDelete={() => deletePos(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openPos()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Leave Types ───────────────────────────────────────────────────── */}
      {section === "leaveTypes" && (
        <DataTable
          title={`Leave Types (${leaveTypes.length})`}
          data={leaveTypes}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "days_per_year", label: "Days/Year", align: "center" as const, render: (val: any) => <span className="font-semibold text-primary">{val}</span> },
            { key: "is_paid", label: "Paid", align: "center" as const, render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "carry_forward", label: "Carry Fwd", align: "center" as const, render: (val: any, row: any) => row.carry_forward ? (row.max_carry_forward ? `Yes (max ${row.max_carry_forward})` : "Yes") : "No" },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openLT(row)} onDelete={() => deleteLT(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openLT()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Holidays ──────────────────────────────────────────────────────── */}
      {section === "holidays" && (
        <DataTable
          title={`Holidays (${holidays.length})`}
          data={holidays}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "holiday_date", label: "Date", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ? new Date(val).toLocaleDateString() : "—"}</span> },
            { key: "is_recurring", label: "Recurring", align: "center" as const, render: (val: boolean) => val ? <span style={{ color: "#10b981" }}>Yes</span> : <span style={{ color: "var(--text-muted)" }}>No</span> },
            { key: "branch_id", label: "Branch", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{branchName(val)}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openHol(row)} onDelete={() => deleteHol(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openHol()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Shift Templates ───────────────────────────────────────────────── */}
      {section === "shiftTemplates" && (
        <DataTable
          title={`Shift Templates (${shiftTemplates.length})`}
          data={shiftTemplates}
          columns={[
            { key: "shift_name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "start_time", label: "Start", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "end_time", label: "End", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ?? "—"}</span> },
            { key: "break_duration", label: "Break (min)", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? 0}</span> },
            { key: "is_flexible", label: "Flexible", align: "center" as const, render: (val: boolean) => val ? <span style={{ color: "#10b981" }}>Yes</span> : <span style={{ color: "var(--text-muted)" }}>No</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "", render: (val: any, row: any) => <ActionsCell onEdit={() => openShift(row)} onDelete={() => deleteShift(row.id)} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openShift()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Branch Dialog ─────────────────────────────────────────────────── */}
      <AppDialog isOpen={branchModal} title={editBranchId ? "Edit Branch" : "Add Branch"} onClose={() => setBranchModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Branch Name *"><input value={branchForm.name} onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Head Office" /></Field>
            <Field label="Branch Code *"><input value={branchForm.code} onChange={e => setBranchForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. HO" /></Field>
            <Field label="City"><input value={branchForm.city} onChange={e => setBranchForm(f => ({ ...f, city: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Phone"><input value={branchForm.phone} onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Contact Person"><input value={branchForm.contact_person} onChange={e => setBranchForm(f => ({ ...f, contact_person: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Timezone"><input value={branchForm.timezone} onChange={e => setBranchForm(f => ({ ...f, timezone: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Asia/Karachi" /></Field>
          </div>
          <Field label="Address"><textarea value={branchForm.address} onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={branchForm.is_active} onChange={e => setBranchForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setBranchModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveBranch} disabled={loading || !branchForm.name || !branchForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* ── Department Dialog ─────────────────────────────────────────────── */}
      <AppDialog isOpen={deptModal} title={editDeptId ? "Edit Department" : "Add Department"} onClose={() => setDeptModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department Name *"><input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Finance" /></Field>
            <Field label="Department Code *"><input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. FIN" /></Field>
            <Field label="Parent Department">
              <select value={deptForm.parent_id} onChange={e => setDeptForm(f => ({ ...f, parent_id: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">None</option>
                {departments.filter(d => d.id !== editDeptId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Branch">
              <select value={deptForm.branch_id} onChange={e => setDeptForm(f => ({ ...f, branch_id: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">Select…</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={deptForm.is_active} onChange={e => setDeptForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setDeptModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveDept} disabled={loading || !deptForm.name || !deptForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* ── Position Dialog ───────────────────────────────────────────────── */}
      <AppDialog isOpen={posModal} title={editPosId ? "Edit Position" : "Add Position"} onClose={() => setPosModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Position Title *"><input value={posForm.title} onChange={e => setPosForm(f => ({ ...f, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Senior Developer" /></Field>
            <Field label="Code *"><input value={posForm.code} onChange={e => setPosForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. SR_DEV" /></Field>
            <Field label="Grade">
              <select value={posForm.grade} onChange={e => setPosForm(f => ({ ...f, grade: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">Select…</option>
                <option value="Junior">Junior</option>
                <option value="Senior">Senior</option>
                <option value="Manager">Manager</option>
                <option value="Executive">Executive</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea value={posForm.description} onChange={e => setPosForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${inputCls} resize-none`} style={inputStyle} /></Field>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={posForm.is_active} onChange={e => setPosForm(f => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setPosModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={savePos} disabled={loading || !posForm.title || !posForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* ── Leave Type Dialog ─────────────────────────────────────────────── */}
      <AppDialog isOpen={ltModal} title={editLtId ? "Edit Leave Type" : "Add Leave Type"} onClose={() => setLtModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Leave Type Name *"><input value={ltForm.name} onChange={e => setLtForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Annual Leave" /></Field>
            <Field label="Code *"><input value={ltForm.code} onChange={e => setLtForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. AL" /></Field>
            <Field label="Days Per Year *"><input type="number" min="0" value={ltForm.days_per_year} onChange={e => setLtForm(f => ({ ...f, days_per_year: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Max Carry Forward"><input type="number" min="0" value={ltForm.max_carry_forward} onChange={e => setLtForm(f => ({ ...f, max_carry_forward: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
          </div>
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.is_paid} onChange={e => setLtForm(f => ({ ...f, is_paid: e.target.checked }))} />
              Paid Leave
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.carry_forward} onChange={e => setLtForm(f => ({ ...f, carry_forward: e.target.checked }))} />
              Carry Forward
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.requires_document} onChange={e => setLtForm(f => ({ ...f, requires_document: e.target.checked }))} />
              Requires Document
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.applicable_after_probation} onChange={e => setLtForm(f => ({ ...f, applicable_after_probation: e.target.checked }))} />
              After Probation
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.is_active} onChange={e => setLtForm(f => ({ ...f, is_active: e.target.checked }))} />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setLtModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveLT} disabled={loading || !ltForm.name || !ltForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* ── Holiday Dialog ────────────────────────────────────────────────── */}
      <AppDialog isOpen={holModal} title={editHolId ? "Edit Holiday" : "Add Holiday"} onClose={() => setHolModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Holiday Name *"><input value={holForm.name} onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. New Year" /></Field>
            <Field label="Holiday Date *"><input type="date" value={holForm.holiday_date} onChange={e => setHolForm(f => ({ ...f, holiday_date: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Branch">
              <select value={holForm.branch_id} onChange={e => setHolForm(f => ({ ...f, branch_id: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={holForm.is_recurring} onChange={e => setHolForm(f => ({ ...f, is_recurring: e.target.checked }))} />
              Recurring every year
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={holForm.is_active} onChange={e => setHolForm(f => ({ ...f, is_active: e.target.checked }))} />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setHolModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveHol} disabled={loading || !holForm.name || !holForm.holiday_date} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* ── Shift Template Dialog ─────────────────────────────────────────── */}
      <AppDialog isOpen={shiftModal} title={editShiftId ? "Edit Shift Template" : "Add Shift Template"} onClose={() => setShiftModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shift Name *"><input value={shiftForm.shift_name} onChange={e => setShiftForm(f => ({ ...f, shift_name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Morning Shift" /></Field>
            <Field label="Start Time *"><input type="time" value={shiftForm.start_time} onChange={e => setShiftForm(f => ({ ...f, start_time: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="End Time *"><input type="time" value={shiftForm.end_time} onChange={e => setShiftForm(f => ({ ...f, end_time: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Break Duration (min)"><input type="number" min="0" value={shiftForm.break_duration} onChange={e => setShiftForm(f => ({ ...f, break_duration: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Grace Period (min)"><input type="number" min="0" value={shiftForm.grace_period_minutes} onChange={e => setShiftForm(f => ({ ...f, grace_period_minutes: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Half-Day Threshold (hrs)"><input type="number" min="0" step="0.5" value={shiftForm.half_day_threshold_hours} onChange={e => setShiftForm(f => ({ ...f, half_day_threshold_hours: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Full-Day Required (hrs)"><input type="number" min="0" step="0.5" value={shiftForm.full_day_required_hours} onChange={e => setShiftForm(f => ({ ...f, full_day_required_hours: Number(e.target.value) }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Weekly Off Days"><input value={shiftForm.weekly_off_days} onChange={e => setShiftForm(f => ({ ...f, weekly_off_days: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Sat,Sun" /></Field>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={shiftForm.is_flexible} onChange={e => setShiftForm(f => ({ ...f, is_flexible: e.target.checked }))} />
              Flexible Shift
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={shiftForm.is_active} onChange={e => setShiftForm(f => ({ ...f, is_active: e.target.checked }))} />
              Active
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setShiftModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveShift} disabled={loading || !shiftForm.shift_name || !shiftForm.start_time || !shiftForm.end_time} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </AppDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.type === "shiftTemplate" ? "shift template" : deleteTarget?.type || "item"}`}
        message={`Are you sure you want to delete this ${deleteTarget?.type === "shiftTemplate" ? "shift template" : deleteTarget?.type || "item"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
