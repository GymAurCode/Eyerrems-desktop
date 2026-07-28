import { useEffect, useState, useCallback } from "react"
import {
  Star, TrendingUp, Calendar, CheckCircle, XCircle,
  Clock, AlertTriangle, Plus, FileText, Download,
  User, Briefcase, MapPin, Percent, Award,
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { employeesApi, tasksApi, performanceApi } from "../../lib/hrApi"
import SearchableSelect, { SearchableOption } from "../../components/ui/SearchableSelect"
import AppDialog from "../../components/ui/AppDialog"
import { useNotifStore } from "../../store/notifications"
import { uploadsUrl } from "../../lib/config"

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6"]
const CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"]

function formatDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function StarRating({ score }: { score: number }) {
  const stars = Math.round(score / 20)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} fill={i < stars ? "#f6ce3a" : "none"} color={i < stars ? "#f6ce3a" : "var(--text-muted)"} />
      ))}
    </div>
  )
}

export default function PerformanceTab() {
  const pushToast = useNotifStore((s) => s.pushToast)
  const [employees, setEmployees] = useState<any[]>([])
  const [empOptions, setEmpOptions] = useState<SearchableOption[]>([])
  const [selectedEmpId, setSelectedEmpId] = useState("")
  const [perf, setPerf] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"overview" | "tasks" | "charts" | "reviews">("overview")

  // Task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDesc, setTaskDesc] = useState("")
  const [taskDeadline, setTaskDeadline] = useState("")
  const [taskPriority, setTaskPriority] = useState("medium")
  const [taskSaving, setTaskSaving] = useState(false)

  // Review modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [manualScore, setManualScore] = useState("")
  const [reviewRemarks, setReviewRemarks] = useState("")
  const [reviewSaving, setReviewSaving] = useState(false)

  // Mark task modal
  const [markTaskId, setMarkTaskId] = useState<number | null>(null)
  const [markStatus, setMarkStatus] = useState("completed")
  const [markRemark, setMarkRemark] = useState("")

  // Load employees on mount
  useEffect(() => {
    employeesApi.list({ limit: 500 }).then((emps) => {
      setEmployees(emps)
      setEmpOptions(
        emps.map((e: any) => ({
          value: String(e.id),
          label: e.full_name || `${e.first_name || ""} ${e.last_name || ""}`,
          sublabel: e.department?.name || e.position?.title || undefined,
        }))
      )
    })
  }, [])

  const loadPerformance = useCallback(async (empId: string) => {
    if (!empId) return
    setLoading(true)
    try {
      const data = await performanceApi.getEmployeePerformance(Number(empId))
      setPerf(data)
    } catch { setPerf(null) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadPerformance(selectedEmpId) }, [selectedEmpId, loadPerformance])

  const selectedEmployee = employees.find((e) => String(e.id) === selectedEmpId)

  const assignTask = async () => {
    if (!taskTitle.trim() || !selectedEmpId) return
    setTaskSaving(true)
    try {
      await tasksApi.create({
        employee_id: Number(selectedEmpId),
        title: taskTitle,
        description: taskDesc,
        deadline: taskDeadline || null,
        priority: taskPriority,
      })
      setTaskTitle(""); setTaskDesc(""); setTaskDeadline(""); setTaskPriority("medium")
      setTaskModalOpen(false)
      pushToast({ title: "Task assigned", type: "success" })
      await loadPerformance(selectedEmpId)
    } catch { pushToast({ title: "Failed to assign task", type: "error" }) } finally { setTaskSaving(false) }
  }

  const markTask = async () => {
    if (!markTaskId) return
    try {
      await tasksApi.update(markTaskId, { status: markStatus, remark: markRemark })
      setMarkTaskId(null); setMarkRemark("")
      pushToast({ title: `Task marked as ${markStatus}`, type: "success" })
      await loadPerformance(selectedEmpId)
    } catch { pushToast({ title: "Failed to update task", type: "error" }) }
  }

  const saveReview = async () => {
    if (!selectedEmpId) return
    setReviewSaving(true)
    try {
      await performanceApi.createReview({
        employee_id: Number(selectedEmpId),
        manual_score: Number(manualScore) || 0,
        remarks: reviewRemarks,
        period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
        period_end: new Date().toISOString().slice(0, 10),
      })
      setManualScore(""); setReviewRemarks(""); setReviewModalOpen(false)
      pushToast({ title: "Review saved", type: "success" })
      await loadPerformance(selectedEmpId)
    } catch { pushToast({ title: "Failed to save review", type: "error" }) } finally { setReviewSaving(false) }
  }

  const exportPdf = async () => {
    if (!selectedEmpId || !perf) return
    try {
      const reportData = await performanceApi.reportData(
        Number(selectedEmpId),
        new Date(new Date().getFullYear() - 1, 0, 1).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      )
      const { default: jsPDF } = await import("jspdf")
      await import("jspdf-autotable")
      const doc = new jsPDF("p", "mm", "a4")
      const pageW = doc.internal.pageSize.getWidth()
      let y = 20

      doc.setFontSize(18)
      doc.text("Employee Performance Report", pageW / 2, y, { align: "center" })
      y += 10
      doc.setFontSize(10)
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW / 2, y, { align: "center" })
      y += 12

      const emp = reportData.employee
      doc.setFontSize(14)
      doc.text("Profile Summary", 14, y)
      y += 8
      doc.setFontSize(10)
      const profileLines = [
        `Name: ${emp.name}`,
        `ID: ${emp.employee_id || "—"}`,
        `Department: ${emp.department || "—"}`,
        `Designation: ${emp.designation || "—"}`,
        `Status: ${emp.employment_status || "—"}`,
        `Joined: ${emp.joining_date || "—"}`,
        `Email: ${emp.work_email || "—"}`,
        `Phone: ${emp.work_phone || "—"}`,
      ]
      profileLines.forEach((line) => {
        doc.text(line, 14, y); y += 6
      })
      y += 6
      doc.text(`Overall Rating: ${perf.overall_score}/100`, 14, y)
      y += 10

      // Tasks table
      if (reportData.tasks?.length) {
        doc.setFontSize(14)
        doc.text("Task History", 14, y); y += 8
        doc.setFontSize(8)
        ;(doc as any).autoTable({
          startY: y,
          head: [["Title", "Status", "Priority", "Deadline", "Completed"]],
          body: reportData.tasks.map((t: any) => [t.title, t.status, t.priority, t.deadline || "—", t.completed_date || "—"]),
          theme: "grid",
          headStyles: { fillColor: [99, 102, 241] },
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Attendance summary
      if (reportData.attendance) {
        doc.setFontSize(14)
        doc.text("Attendance Summary", 14, y); y += 8
        doc.setFontSize(10)
        const att = reportData.attendance
        doc.text(`Total Days: ${att.total_days} | Present: ${att.present} | Absent: ${att.absent} | Late: ${att.late} | Half-Day: ${att.half_day} | On Leave: ${att.on_leave}`, 14, y)
        y += 10
      }

      // Leave summary
      if (reportData.leaves?.length) {
        doc.setFontSize(14)
        doc.text("Leave History", 14, y); y += 8
        doc.setFontSize(8)
        ;(doc as any).autoTable({
          startY: y,
          head: [["Type", "From", "To", "Days", "Status"]],
          body: reportData.leaves.map((l: any) => [l.type, l.start_date, l.end_date, l.total_days, l.status]),
          theme: "grid",
          headStyles: { fillColor: [99, 102, 241] },
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Payroll summary
      if (reportData.payroll?.length) {
        doc.setFontSize(14)
        doc.text("Payroll History", 14, y); y += 8
        doc.setFontSize(8)
        ;(doc as any).autoTable({
          startY: y,
          head: [["Period", "Gross", "Deductions", "Net", "Status"]],
          body: reportData.payroll.map((p: any) => [p.period, p.gross, p.deductions, p.net, p.status]),
          theme: "grid",
          headStyles: { fillColor: [99, 102, 241] },
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      // Reviews
      if (reportData.reviews?.length) {
        doc.setFontSize(14)
        doc.text("Performance Reviews", 14, y); y += 8
        doc.setFontSize(8)
        ;(doc as any).autoTable({
          startY: y,
          head: [["Period", "Task Score", "Att. Score", "Manual", "Overall", "Remarks"]],
          body: reportData.reviews.map((r: any) => [
            `${r.period_start || "—"} to ${r.period_end || "—"}`,
            r.task_score, r.attendance_score, r.manual_score, r.overall_rating, r.remarks || "—",
          ]),
          theme: "grid",
          headStyles: { fillColor: [99, 102, 241] },
        })
      }

      doc.save(`performance_${emp.name?.replace(/\s+/g, "_") || "employee"}.pdf`)
    } catch { pushToast({ title: "Failed to generate PDF", type: "error" }) }
  }

  if (!selectedEmpId) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Employee Performance</h2>
        </div>
        <div className="max-w-md">
          <label className="block text-xs text-muted mb-1.5">Select an Employee</label>
          <SearchableSelect
            options={empOptions}
            value={selectedEmpId}
            onChange={setSelectedEmpId}
            placeholder="Search employee…"
          />
        </div>
        <div className="py-16 text-center">
          <User size={40} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p style={{ color: "var(--text-muted)" }}>Select an employee above to view their performance dashboard.</p>
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )

  const taskStats = perf?.task_stats || {}
  const tasks = perf?.tasks || []
  const reviewHistory = perf?.review_history || []

  return (
    <div className="p-6 space-y-6">
      {/* Selector row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[250px] max-w-sm">
          <label className="block text-xs text-muted mb-1.5">Select Employee</label>
          <SearchableSelect options={empOptions} value={selectedEmpId} onChange={setSelectedEmpId} placeholder="Search employee…" />
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setReviewModalOpen(true)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Star size={13} /> Add Review
          </button>
          <button type="button" onClick={exportPdf} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
            <Download size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* Profile Header */}
      {perf && (
        <div className="rounded-xl p-5" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
          <div className="flex items-start gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: "var(--bg-surface2)" }}>
              {perf.employee_name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{perf.employee_name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{
                  background: perf.employment_status === "active" ? "rgba(16,185,129,0.15)" : perf.employment_status === "on_leave" ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)",
                  color: perf.employment_status === "active" ? "#10b981" : perf.employment_status === "on_leave" ? "#f59e0b" : "#ef4444",
                }}>
                  {perf.employment_status || "active"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 flex-wrap text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="flex items-center gap-1"><Briefcase size={12} /> {perf.designation || "—"}</span>
                <span className="flex items-center gap-1"><Building size={12} /> {perf.department || "—"}</span>
                <span className="flex items-center gap-1"><Calendar size={12} /> Joined {perf.joining_date ? formatDate(perf.joining_date) : "—"}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-2xl font-bold" style={{ color: perf.overall_score >= 80 ? "#10b981" : perf.overall_score >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {perf.overall_score || 0}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>/ 100</span>
              </div>
              <StarRating score={perf.overall_score || 0} />
              <div className="mt-1 flex items-center gap-1 justify-end text-xs" style={{ color: "var(--text-muted)" }}>
                <Award size={12} style={{ color: "#f6ce3a" }} />
                <span>#{perf.rank_in_dept} of {perf.total_in_dept} in {perf.department || "Dept"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {perf && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-[10px] uppercase tracking-wider text-muted">Task Completion</p>
            <p className="text-xl font-bold mt-1" style={{ color: taskStats.completion_rate >= 80 ? "#10b981" : "#f59e0b" }}>{taskStats.completion_rate || 0}%</p>
            <p className="text-[10px] text-muted">{taskStats.completed}/{taskStats.total} tasks done</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-[10px] uppercase tracking-wider text-muted">Attendance Rate</p>
            <p className="text-xl font-bold mt-1" style={{ color: (perf.attendance_rate || 0) >= 90 ? "#10b981" : "#f59e0b" }}>{perf.attendance_rate || 0}%</p>
            <p className="text-[10px] text-muted">Last 90 days</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-[10px] uppercase tracking-wider text-muted">Pending Tasks</p>
            <p className="text-xl font-bold mt-1" style={{ color: taskStats.pending > 0 ? "#f59e0b" : "#10b981" }}>{taskStats.pending || 0}</p>
            <p className="text-[10px] text-muted">{taskStats.overdue > 0 ? `${taskStats.overdue} overdue` : "All on track"}</p>
          </div>
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-[10px] uppercase tracking-wider text-muted">Reviews</p>
            <p className="text-xl font-bold mt-1" style={{ color: "var(--text-primary)" }}>{reviewHistory.length}</p>
            <p className="text-[10px] text-muted">Performance reviews</p>
          </div>
        </div>
      )}

      {/* Tabs inside Performance */}
      <div className="flex items-center gap-1 border-b pb-1" style={{ borderColor: "var(--border)" }}>
        {(["overview", "tasks", "charts", "reviews"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-4 py-2 text-xs font-medium rounded-t-lg transition-colors capitalize"
            style={{
              color: tab === t ? "var(--text-primary)" : "var(--text-muted)",
              borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
            }}>
            {t === "overview" ? "Overview" : t === "tasks" ? `Tasks (${taskStats.total || 0})` : t === "charts" ? "Charts" : `Reviews (${reviewHistory.length})`}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Task completion: <strong>{taskStats.completion_rate || 0}%</strong> ({taskStats.completed}/{taskStats.total})</p>
            <button type="button" onClick={() => setTaskModalOpen(true)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg" style={{ border: "1px solid rgba(99,102,241,0.25)", color: "#6366f1" }}>
              <Plus size={13} /> Assign Task
            </button>
          </div>

          {(!perf?.tasks || perf.tasks.length === 0) ? (
            <div className="py-12 text-center">
              <CheckCircle size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tasks assigned yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {perf.tasks.map((task: any) => {
                const statusColor = task.status === "completed" ? "#10b981" : task.status === "overdue" || task.status === "not_fulfilled" ? "#ef4444" : task.status === "in_progress" ? "#3b82f6" : "#f59e0b"
                const priorityColor = task.priority === "high" || task.priority === "critical" ? "#ef4444" : task.priority === "medium" ? "#f59e0b" : "#6b7280"
                return (
                  <div key={task.id} className="rounded-xl p-4 flex items-start justify-between gap-3" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{task.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${priorityColor}18`, color: priorityColor }}>
                          {task.priority}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${statusColor}18`, color: statusColor }}>
                          {task.status?.replace(/_/g, " ")}
                        </span>
                      </div>
                      {task.description && <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {task.deadline && <span>Due: {formatDate(task.deadline)}</span>}
                        {task.assigned_date && <span>Assigned: {formatDate(task.assigned_date)}</span>}
                      </div>
                    </div>
                    {task.status !== "completed" && task.status !== "not_fulfilled" && (
                      <button type="button" onClick={() => { setMarkTaskId(task.id); setMarkStatus("completed") }}
                        className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg shrink-0"
                        style={{ border: "1px solid rgba(16,185,129,0.25)", color: "#10b981" }}>
                        <CheckCircle size={12} /> Mark
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === "overview" && perf && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Task completion trend */}
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Monthly Task Trend</p>
            {perf.task_monthly_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={perf.task_monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="assigned" stroke="#f59e0b" strokeWidth={2} dot={false} name="Assigned" />
                  <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} dot={false} name="Completed" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-center py-8 text-muted">No task data yet</p>}
          </div>

          {/* Attendance pie */}
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Attendance Distribution</p>
            {perf.attendance_breakdown ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={[
                    { name: "Present", value: perf.attendance_breakdown.present || 0 },
                    { name: "Absent", value: perf.attendance_breakdown.absent || 0 },
                    { name: "Late", value: perf.attendance_breakdown.late || 0 },
                    { name: "Leave", value: perf.attendance_breakdown.on_leave || 0 },
                  ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                    {PIE_COLORS.slice(0, 4).map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-xs text-muted">No attendance data yet</p>
              </div>
            )}
          </div>

          {/* Rating history */}
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Rating History</p>
            {reviewHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={reviewHistory.map((r: any) => ({ date: r.review_date?.slice(0, 10) || r.created_at?.slice(0, 10) || "—", rating: r.overall_rating || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="rating" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Rating" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-center py-8 text-muted">No reviews yet</p>}
          </div>

          {/* Leave balance placeholder */}
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Score Breakdown</p>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "var(--text-secondary)" }}>Task Completion (40%)</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{taskStats.completion_rate || 0}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--bg-surface2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${taskStats.completion_rate || 0}%`, background: "#6366f1" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "var(--text-secondary)" }}>Attendance (30%)</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{perf.attendance_rate || 0}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--bg-surface2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${perf.attendance_rate || 0}%`, background: "#10b981" }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span style={{ color: "var(--text-secondary)" }}>Manual Score (30%)</span>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{perf.current_review?.manual_score || 0}%</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: "var(--bg-surface2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${perf.current_review?.manual_score || 0}%`, background: "#f59e0b" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "charts" && perf && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Monthly Task Trend</p>
            {perf.task_monthly_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={perf.task_monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="assigned" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Assigned" />
                  <Bar dataKey="completed" fill="#10b981" radius={[3, 3, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-center py-12 text-muted">No task data yet</p>}
          </div>

          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Rating History</p>
            {reviewHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={reviewHistory.map((r: any) => ({ date: r.review_date?.slice(0, 10) || r.created_at?.slice(0, 10) || "—", rating: r.overall_rating || 0 }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="rating" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Rating" />
                </LineChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-center py-12 text-muted">No reviews yet</p>}
          </div>

          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Score Components</p>
            {perf.task_monthly_trend?.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={perf.task_monthly_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="completed" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} name="Completed" />
                  <Bar dataKey="assigned" stackId="a" fill="#f59e0b" radius={[3, 3, 0, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-center py-12 text-muted">No task data yet</p>}
          </div>

          <div className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
            <p className="text-xs font-medium mb-3" style={{ color: "var(--text-primary)" }}>Task Status Distribution</p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={[
                  { name: "Completed", value: taskStats.completed || 0 },
                  { name: "Pending", value: taskStats.pending || 0 },
                  { name: "In Progress", value: taskStats.in_progress || 0 },
                  { name: "Overdue", value: taskStats.overdue || 0 },
                  { name: "Not Fulfilled", value: taskStats.not_fulfilled || 0 },
                ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {(taskStats.completed > 0 ? PIE_COLORS : CHART_COLORS).map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="space-y-3">
          {reviewHistory.length === 0 ? (
            <div className="py-12 text-center">
              <FileText size={28} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No performance reviews yet. Click "Add Review" to create the first one.</p>
            </div>
          ) : (
            reviewHistory.map((r: any, i: number) => (
              <div key={r.id || i} className="rounded-xl p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-surface)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        Review {r.review_date ? formatDate(r.review_date) : `#${i + 1}`}
                      </p>
                      {r.period_start && r.period_end && (
                        <span className="text-[10px] text-muted">({formatDate(r.period_start)} — {formatDate(r.period_end)})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span>Task: <strong>{r.task_score || 0}%</strong></span>
                      <span>Attendance: <strong>{r.attendance_score || 0}%</strong></span>
                      <span>Manual: <strong>{r.manual_score || 0}%</strong></span>
                      <span>Overall: <strong style={{ color: (r.overall_rating || 0) >= 80 ? "#10b981" : "#f59e0b" }}>{r.overall_rating || 0}%</strong></span>
                    </div>
                    {r.remarks && <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>"{r.remarks}"</p>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Assign Task Modal ── */}
      <AppDialog isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} title={`Assign Task — ${perf?.employee_name || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Task Title *</label>
            <input className="input-dark w-full px-3 py-2 text-sm" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Complete site visit report" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Description</label>
            <textarea className="input-dark w-full px-3 py-2 text-sm" rows={3} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Details about the task…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1">Deadline</label>
              <input type="date" className="input-dark w-full px-3 py-2 text-sm" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Priority</label>
              <select className="input-dark w-full px-3 py-2 text-sm" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setTaskModalOpen(false)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button type="button" onClick={assignTask} disabled={taskSaving || !taskTitle.trim()} className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white" style={{ background: taskSaving ? "#6b7280" : "#6366f1" }}>
              {taskSaving ? "Assigning…" : "Assign Task"}
            </button>
          </div>
        </div>
      </AppDialog>

      {/* ── Mark Task Modal ── */}
      <AppDialog isOpen={!!markTaskId} onClose={() => setMarkTaskId(null)} title="Update Task Status">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select className="input-dark w-full px-3 py-2 text-sm" value={markStatus} onChange={(e) => setMarkStatus(e.target.value)}>
              <option value="completed">Completed / Fulfilled</option>
              <option value="not_fulfilled">Not Fulfilled</option>
              <option value="in_progress">In Progress</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Remark (optional)</label>
            <textarea className="input-dark w-full px-3 py-2 text-sm" rows={3} value={markRemark} onChange={(e) => setMarkRemark(e.target.value)} placeholder="Reason or note about this status…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setMarkTaskId(null)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button type="button" onClick={markTask} className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white" style={{ background: "#6366f1" }}>Update</button>
          </div>
        </div>
      </AppDialog>

      {/* ── Add Review Modal ── */}
      <AppDialog isOpen={reviewModalOpen} onClose={() => setReviewModalOpen(false)} title={`Add Performance Review — ${perf?.employee_name || ""}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1">Manual Score (0–100)</label>
            <input type="number" min="0" max="100" className="input-dark w-full px-3 py-2 text-sm" value={manualScore} onChange={(e) => setManualScore(e.target.value)} placeholder="e.g. 85" />
            <p className="text-[10px] text-muted mt-1">This score contributes 30% to the overall rating. The rest is auto-calculated from tasks (40%) and attendance (30%).</p>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Review Remarks</label>
            <textarea className="input-dark w-full px-3 py-2 text-sm" rows={4} value={reviewRemarks} onChange={(e) => setReviewRemarks(e.target.value)} placeholder="Appraisal notes, feedback, achievements this period…" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setReviewModalOpen(false)} className="flex-1 py-2.5 text-sm rounded-xl" style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button type="button" onClick={saveReview} disabled={reviewSaving} className="flex-1 py-2.5 text-sm rounded-xl font-medium text-white" style={{ background: reviewSaving ? "#6b7280" : "#6366f1" }}>
              {reviewSaving ? "Saving…" : "Save Review"}
            </button>
          </div>
        </div>
      </AppDialog>
    </div>
  )
}

function Building({ size }: { size: number }) {
  return <Briefcase size={size} />
}
