/**
 * HR Management Page
 * Tabs: Dashboard · Employees · Attendance · Leaves · Payroll · Setup
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Users, Calendar, FileText, DollarSign, Settings2, Plus,
  RefreshCw, Search, CheckCircle, XCircle, Clock,
  Building2, MapPin, Briefcase, UserCheck,
  TrendingUp, ArrowDownRight, Printer, Eye,
} from "lucide-react";
import Modal from "../components/Modal";
import { formatCurrency } from "../lib/currency";
import { QuickRowActions, RowActions, ActionsTh, ActionsCell, printRecord } from "../components/actions";
import { DataTable, SmartTable } from "../components/data-table";
import { api } from "../lib/api";
import AttachmentPanel from "../components/attachments/AttachmentPanel";
import AttachmentsButton from "../components/attachments/AttachmentsButton";
import ModuleTabs from "../components/ui/ModuleTabs";
import { MODULE_COLORS } from "../config/moduleColors";
import {
  departmentsApi, positionsApi, branchesApi, employeesApi,
  attendanceApi, leaveTypesApi, leavesApi, payrollApi, holidaysApi,
  type Department, type Position, type Branch, type Employee,
  type Attendance, type LeaveType, type Leave, type LeaveBalance,
  type Payroll, type Holiday, type SalaryStructure, type PayslipData,
} from "../lib/hrApi";
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

function StatCard({ label, value, icon: Icon, iconBg, iconColor, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  iconBg: string; iconColor: string; sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-primary mb-1">{value}</p>
      <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg text-xs text-primary bg-transparent outline-none transition-colors";
const inputStyle = { border: "1px solid var(--border)", background: "var(--input-bg, var(--card-bg))" };

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
        moduleColor={MODULE_COLORS.hr}
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={employees.length} icon={Users} iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" />
        <StatCard label="Active" value={active} icon={UserCheck} iconBg="rgba(16,185,129,0.12)" iconColor="#10b981" />
        <StatCard label="Departments" value={departments.length} icon={Building2} iconBg="rgba(139,92,246,0.12)" iconColor="#8b5cf6" />
        <StatCard label="On Probation" value={onProbation} icon={Clock} iconBg="rgba(245,158,11,0.12)" iconColor="#f59e0b" />
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
  const [emps, setEmps] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const paramsRef = useRef<any>(null);

  const [selected, setSelected]     = useState<Employee | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [salary, setSalary]         = useState<SalaryStructure | null>(null);
  const [err, setErr]               = useState("");

  const [empForm, setEmpForm] = useState<Record<string, any>>({
    employment_type: "Permanent", employment_status: "Active",
    joining_date: new Date().toISOString().split("T")[0],
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
      await employeesApi.create(empForm);
      setShowAdd(false);
      setEmpForm({ employment_type: "Permanent", employment_status: "Active", joining_date: new Date().toISOString().split("T")[0] });
      refreshTable();
      await onRefresh();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
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

      {/* Add Employee */}
      <Modal open={showAdd} title="Add Employee" onClose={() => setShowAdd(false)}>
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
          <Field label="Joining Date *"><input type="date" value={empForm.joining_date ?? ""} onChange={ef("joining_date")} className={inputCls} style={inputStyle} /></Field>
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
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveEmployee} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save Employee"}</button>
        </div>
      </Modal>

      {/* Employee Detail */}
      <Modal open={!!selected} title={selected?.full_name ?? ""} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              {([["Employee ID", selected.employee_id], ["Status", selected.employment_status], ["Type", selected.employment_type],
                ["Department", selected.department?.name ?? "—"], ["Position", selected.position?.title ?? "—"],
                ["Branch", selected.branch?.name ?? "—"], ["Joined", selected.joining_date ? new Date(selected.joining_date).toLocaleDateString() : "—"],
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
          </div>
        )}
      </Modal>

      {/* Salary */}
      <Modal open={showSalary} title={`Salary — ${selected?.full_name ?? ""}`} onClose={() => setShowSalary(false)}>
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
      </Modal>
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
  const [attForm, setAttForm] = useState<Record<string, any>>({
    attendance_date: today, attendance_status: "Present", is_manual_correction: false,
  });

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
    Absent:  dailyReport.filter(r => r.status === "Absent").length,
    Leave:   dailyReport.filter(r => r.status === "Leave").length,
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

      <Modal open={showMark} title="Mark Attendance" onClose={() => setShowMark(false)}>
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
              {["Present","Absent","Half-day","Leave","Holiday"].map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Check In"><input type="datetime-local" value={attForm.check_in_time ?? ""} onChange={af("check_in_time")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Check Out"><input type="datetime-local" value={attForm.check_out_time ?? ""} onChange={af("check_out_time")} className={inputCls} style={inputStyle} /></Field>
          <Field label="Notes"><input value={attForm.notes ?? ""} onChange={af("notes")} className={inputCls} style={inputStyle} /></Field>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setShowMark(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={markAttendance} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Mark"}</button>
        </div>
      </Modal>
    </div>
  );
}

// ── Leaves Tab ────────────────────────────────────────────────────────────────
function LeavesTab({ employees, leaveTypes }: { employees: Employee[]; leaveTypes: LeaveType[] }) {
  const [leaves, setLeaves]           = useState<Leave[]>([]);
  const [loading, setLoading]         = useState(false);
  const [total, setTotal]             = useState(0);
  const paramsRef = useRef<any>(null);

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
      setShowRequest(false);
      refreshTable();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const approve = async (id: number) => {
    setLoading(true);
    try {
      await leavesApi.approve(id);
      refreshTable();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const reject = async () => {
    if (!rejectId || !rejectReason) return;
    setLoading(true);
    try {
      await leavesApi.reject(rejectId, rejectReason);
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

      <Modal open={showRequest} title="Request Leave" onClose={() => setShowRequest(false)}>
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
          <div className="col-span-2">
            <Field label="Reason *">
              <textarea value={leaveForm.reason ?? ""} onChange={lf("reason")} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
            </Field>
          </div>
        </div>
        {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setShowRequest(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={requestLeave} disabled={loading} className="btn-primary px-4 py-2 text-xs">{loading ? "Submitting…" : "Submit Request"}</button>
        </div>
      </Modal>

      <Modal open={!!rejectId} title="Reject Leave" onClose={() => setRejectId(null)}>
        <Field label="Rejection Reason *">
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className={`${inputCls} resize-none`} style={inputStyle} />
        </Field>
        <div className="flex justify-end gap-2 pt-3">
          <button onClick={() => setRejectId(null)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={reject} disabled={loading || !rejectReason} className="px-4 py-2 text-xs rounded-lg" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{loading ? "Rejecting…" : "Reject"}</button>
        </div>
      </Modal>

      <Modal open={showBalance} title="Leave Balance" onClose={() => setShowBalance(false)}>
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
      </Modal>
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
    try { await payrollApi.calculate(calcEmpId, period); setCalcEmpId(null); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const calcAll = async () => {
    setLoading(true);
    try { await payrollApi.calculateAll(period); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const approve = async (id: number) => {
    setLoading(true);
    try { await payrollApi.approve(id); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const postAccounting = async (id: number) => {
    setLoading(true);
    try { await payrollApi.postAccounting(id); refreshTable(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const markPaid = async () => {
    if (!markPaidId) return;
    setLoading(true);
    try { await payrollApi.markPaid(markPaidId, paidForm); setMarkPaidId(null); refreshTable(); }
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
          <StatCard label="Employees" value={summary.total_employees} icon={Users} iconBg="rgba(59,130,246,0.12)" iconColor="#3b82f6" />
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

      <Modal open={calcEmpId !== null} title="Calculate Payroll" onClose={() => setCalcEmpId(null)}>
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
      </Modal>

      <Modal open={!!markPaidId} title="Mark as Paid" onClose={() => setMarkPaidId(null)}>
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
      </Modal>

      <Modal open={!!payslip} title="Payslip" onClose={() => setPayslip(null)}>
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
      </Modal>
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
  type SetupSection = "departments" | "positions" | "branches" | "leaveTypes" | "holidays";
  const [section, setSection] = useState<SetupSection>("departments");
  const [loading, setLoading] = useState(false);

  // ── Department form ──────────────────────────────────────────────────────
  const blankDept = { name: "", code: "", description: "" };
  const [deptForm, setDeptForm] = useState(blankDept);
  const [editDeptId, setEditDeptId] = useState<number | null>(null);
  const [deptModal, setDeptModal] = useState(false);

  const openDept = (d?: Department) => {
    if (d) { setDeptForm({ name: d.name, code: d.code ?? "", description: d.description ?? "" }); setEditDeptId(d.id); }
    else   { setDeptForm(blankDept); setEditDeptId(null); }
    setDeptModal(true);
  };
  const saveDept = async () => {
    setLoading(true);
    try {
      if (editDeptId) await departmentsApi.update(editDeptId, deptForm);
      else            await departmentsApi.create(deptForm);
      setDeptModal(false); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteDept = async (id: number) => {
    if (!confirm("Delete this department?")) return;
    setLoading(true);
    try { await departmentsApi.delete(id); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  // ── Position form ────────────────────────────────────────────────────────
  const blankPos = { title: "", code: "", grade: "", description: "", min_salary: "", max_salary: "" };
  const [posForm, setPosForm] = useState(blankPos);
  const [editPosId, setEditPosId] = useState<number | null>(null);
  const [posModal, setPosModal] = useState(false);

  const openPos = (p?: Position) => {
    if (p) { setPosForm({ title: p.title, code: p.code ?? "", grade: p.grade ?? "", description: p.description ?? "", min_salary: String(p.min_salary ?? ""), max_salary: String(p.max_salary ?? "") }); setEditPosId(p.id); }
    else   { setPosForm(blankPos); setEditPosId(null); }
    setPosModal(true);
  };
  const savePos = async () => {
    setLoading(true);
    try {
      const data = { ...posForm, min_salary: posForm.min_salary ? Number(posForm.min_salary) : undefined, max_salary: posForm.max_salary ? Number(posForm.max_salary) : undefined };
      if (editPosId) await positionsApi.update(editPosId, data);
      else           await positionsApi.create(data);
      setPosModal(false); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  // ── Branch form ──────────────────────────────────────────────────────────
  const blankBranch = { name: "", code: "", address: "", city: "", country: "", phone: "", email: "" };
  const [branchForm, setBranchForm] = useState(blankBranch);
  const [editBranchId, setEditBranchId] = useState<number | null>(null);
  const [branchModal, setBranchModal] = useState(false);

  const openBranch = (b?: Branch) => {
    if (b) { setBranchForm({ name: b.name, code: b.code ?? "", address: b.address ?? "", city: b.city ?? "", country: b.country ?? "", phone: b.phone ?? "", email: b.email ?? "" }); setEditBranchId(b.id); }
    else   { setBranchForm(blankBranch); setEditBranchId(null); }
    setBranchModal(true);
  };
  const saveBranch = async () => {
    setLoading(true);
    try {
      if (editBranchId) await branchesApi.update(editBranchId, branchForm);
      else              await branchesApi.create(branchForm);
      setBranchModal(false); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  // ── Leave Type form ──────────────────────────────────────────────────────
  const blankLT = { name: "", code: "", days_per_year: "15", is_paid: true, requires_approval: true, carry_forward: false, max_carry_forward: "" };
  const [ltForm, setLtForm] = useState(blankLT);
  const [ltModal, setLtModal] = useState(false);

  const openLT = () => { setLtForm(blankLT); setLtModal(true); };
  const saveLT = async () => {
    setLoading(true);
    try {
      await leaveTypesApi.create({ ...ltForm, days_per_year: Number(ltForm.days_per_year), max_carry_forward: ltForm.max_carry_forward ? Number(ltForm.max_carry_forward) : undefined });
      setLtModal(false); onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  // ── Holiday form ─────────────────────────────────────────────────────────
  const blankHol = { name: "", holiday_date: "", description: "", is_recurring: false };
  const [holForm, setHolForm] = useState(blankHol);
  const [holModal, setHolModal] = useState(false);

  const openHol = () => { setHolForm(blankHol); setHolModal(true); };
  const saveHol = async () => {
    setLoading(true);
    try { await holidaysApi.create(holForm); setHolModal(false); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const deleteHol = async (id: number) => {
    if (!confirm("Delete this holiday?")) return;
    setLoading(true);
    try { await holidaysApi.delete(id); onRefresh(); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  const SECTIONS: { id: SetupSection; label: string }[] = [
    { id: "departments", label: "Departments" },
    { id: "positions",   label: "Positions" },
    { id: "branches",    label: "Branches" },
    { id: "leaveTypes",  label: "Leave Types" },
    { id: "holidays",    label: "Holidays" },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-nav */}
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
            style={section === s.id
              ? { background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }
              : { border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Departments ── */}
      {section === "departments" && (
        <DataTable
          title={`Departments (${departments.length})`}
          data={departments}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
            { key: "description", label: "Description", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "Actions", render: (val: any, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => openDept(row)}
                  style={{ color: "#F59E0B", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                  Edit
                </button>
                <button onClick={() => deleteDept(row.id)}
                  style={{ color: "#EF4444", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                  Delete
                </button>
              </div>
            )},
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openDept()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Positions ── */}
      {section === "positions" && (
        <DataTable
          title={`Positions (${positions.length})`}
          data={positions}
          columns={[
            { key: "title", label: "Title", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
            { key: "grade", label: "Grade", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "min_salary", label: "Min Salary", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ? formatCurrency(val) : "—"}</span> },
            { key: "max_salary", label: "Max Salary", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val ? formatCurrency(val) : "—"}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "Actions", render: (val: any, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => openPos(row)}
                  style={{ color: "#F59E0B", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                  Edit
                </button>
              </div>
            )},
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openPos()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Branches ── */}
      {section === "branches" && (
        <DataTable
          title={`Branches (${branches.length})`}
          data={branches}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
            { key: "city", label: "City", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "country", label: "Country", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "phone", label: "Phone", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "actions", label: "Actions", render: (val: any, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => openBranch(row)}
                  style={{ color: "#F59E0B", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                  Edit
                </button>
              </div>
            )},
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={() => openBranch()} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Leave Types ── */}
      {section === "leaveTypes" && (
        <DataTable
          title={`Leave Types (${leaveTypes.length})`}
          data={leaveTypes}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "code", label: "Code", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
            { key: "days_per_year", label: "Days/Year", align: "center" },
            { key: "is_paid", label: "Paid", align: "center", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
            { key: "carry_forward", label: "Carry Forward", align: "center", render: (val: any, row: any) => row.carry_forward ? `Yes${row.max_carry_forward ? ` (max ${row.max_carry_forward})` : ""}` : "No" },
            { key: "is_active", label: "Status", render: (val: boolean) => <StatusBadge status={val ? "Active" : "Inactive"} /> },
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={openLT} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Holidays ── */}
      {section === "holidays" && (
        <DataTable
          title={`Holidays (${holidays.length})`}
          data={holidays}
          columns={[
            { key: "name", label: "Name", render: (val: any) => <span className="font-medium text-primary">{val}</span> },
            { key: "holiday_date", label: "Date", render: (val: any) => <span style={{ color: "var(--text-secondary)" }}>{val}</span> },
            { key: "description", label: "Description", render: (val: any) => <span style={{ color: "var(--text-muted)" }}>{val ?? "—"}</span> },
            { key: "is_recurring", label: "Recurring", align: "center", render: (val: boolean) => val ? "Yes" : "No" },
            { key: "actions", label: "Actions", render: (val: any, row: any) => (
              <div className="flex gap-1">
                <button onClick={() => deleteHol(row.id)}
                  style={{ color: "#EF4444", background: "transparent", border: "none", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 11 }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.1)"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}>
                  Delete
                </button>
              </div>
            )},
          ]}
          sortable={false}
          searchable={false}
          customToolbar={
            <button onClick={openHol} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus size={13} /> Add</button>
          }
        />
      )}

      {/* ── Department Modal ── */}
      <Modal open={deptModal} title={editDeptId ? "Edit Department" : "Add Department"} onClose={() => setDeptModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><input value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Finance" /></Field>
            <Field label="Code *"><input value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. FIN" /></Field>
          </div>
          <Field label="Description"><input value={deptForm.description} onChange={e => setDeptForm(f => ({ ...f, description: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setDeptModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveDept} disabled={loading || !deptForm.name || !deptForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </Modal>

      {/* ── Position Modal ── */}
      <Modal open={posModal} title={editPosId ? "Edit Position" : "Add Position"} onClose={() => setPosModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title *"><input value={posForm.title} onChange={e => setPosForm(f => ({ ...f, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Senior Developer" /></Field>
            <Field label="Code *"><input value={posForm.code} onChange={e => setPosForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. SD" /></Field>
            <Field label="Grade"><input value={posForm.grade} onChange={e => setPosForm(f => ({ ...f, grade: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. L3" /></Field>
            <Field label="Min Salary"><input type="number" value={posForm.min_salary} onChange={e => setPosForm(f => ({ ...f, min_salary: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Max Salary"><input type="number" value={posForm.max_salary} onChange={e => setPosForm(f => ({ ...f, max_salary: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
          </div>
          <Field label="Description"><input value={posForm.description} onChange={e => setPosForm(f => ({ ...f, description: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setPosModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={savePos} disabled={loading || !posForm.title || !posForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </Modal>

      {/* ── Branch Modal ── */}
      <Modal open={branchModal} title={editBranchId ? "Edit Branch" : "Add Branch"} onClose={() => setBranchModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><input value={branchForm.name} onChange={e => setBranchForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Head Office" /></Field>
            <Field label="Code *"><input value={branchForm.code} onChange={e => setBranchForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. HO" /></Field>
            <Field label="City"><input value={branchForm.city} onChange={e => setBranchForm(f => ({ ...f, city: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Country"><input value={branchForm.country} onChange={e => setBranchForm(f => ({ ...f, country: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Phone"><input value={branchForm.phone} onChange={e => setBranchForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Email"><input type="email" value={branchForm.email} onChange={e => setBranchForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
          </div>
          <Field label="Address"><input value={branchForm.address} onChange={e => setBranchForm(f => ({ ...f, address: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setBranchModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveBranch} disabled={loading || !branchForm.name || !branchForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </Modal>

      {/* ── Leave Type Modal ── */}
      <Modal open={ltModal} title="Add Leave Type" onClose={() => setLtModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><input value={ltForm.name} onChange={e => setLtForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Annual Leave" /></Field>
            <Field label="Code *"><input value={ltForm.code} onChange={e => setLtForm(f => ({ ...f, code: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. AL" /></Field>
            <Field label="Days Per Year *"><input type="number" value={ltForm.days_per_year} onChange={e => setLtForm(f => ({ ...f, days_per_year: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
            <Field label="Max Carry Forward"><input type="number" value={ltForm.max_carry_forward} onChange={e => setLtForm(f => ({ ...f, max_carry_forward: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
          </div>
          <div className="flex gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.is_paid} onChange={e => setLtForm(f => ({ ...f, is_paid: e.target.checked }))} />
              Paid Leave
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.requires_approval} onChange={e => setLtForm(f => ({ ...f, requires_approval: e.target.checked }))} />
              Requires Approval
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={ltForm.carry_forward} onChange={e => setLtForm(f => ({ ...f, carry_forward: e.target.checked }))} />
              Carry Forward
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setLtModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveLT} disabled={loading || !ltForm.name || !ltForm.code} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </Modal>

      {/* ── Holiday Modal ── */}
      <Modal open={holModal} title="Add Holiday" onClose={() => setHolModal(false)}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><input value={holForm.name} onChange={e => setHolForm(f => ({ ...f, name: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. New Year" /></Field>
            <Field label="Date *"><input type="date" value={holForm.holiday_date} onChange={e => setHolForm(f => ({ ...f, holiday_date: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
          </div>
          <Field label="Description"><input value={holForm.description} onChange={e => setHolForm(f => ({ ...f, description: e.target.value }))} className={inputCls} style={inputStyle} /></Field>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={holForm.is_recurring} onChange={e => setHolForm(f => ({ ...f, is_recurring: e.target.checked }))} />
            Recurring every year
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setHolModal(false)} className="px-4 py-2 text-xs rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>Cancel</button>
          <button onClick={saveHol} disabled={loading || !holForm.name || !holForm.holiday_date} className="btn-primary px-4 py-2 text-xs">{loading ? "Saving…" : "Save"}</button>
        </div>
      </Modal>
    </div>
  );
}
