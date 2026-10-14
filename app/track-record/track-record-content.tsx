"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Search, Plus, Pencil, Trash2, Download, Upload, ChevronUp, ChevronDown,
  X, Check, AlertTriangle, BarChart3, MapPin, Ship, Cpu, Calendar,
  DollarSign, Users, Filter, ChevronsUpDown, ArrowLeft, Eye,
  ChevronLeft, ChevronRight, Layers, Sparkles, CheckSquare, Maximize2, Minimize2,
  Radio, Activity, Sun, Moon, SlidersHorizontal, PauseCircle, Clock, CheckCircle2,
  Lock, Unlock,
} from "lucide-react"
import type { TrackRecordDB, PersonnelDB } from "@/lib/supabase"
import {
  createTrackRecord,
  updateTrackRecord,
  deleteTrackRecord,
  deleteTrackRecords,
} from "@/actions/track-record-actions"
import { FLEET_DEFS } from "@/lib/rov-assignments-shared"
import { Button } from "@/components/ui/button"
import StatsDetailModal, { type StatsModalType } from "./stats-detail-modal"
import AnalyticsChartsPanel, { type ThemeMode } from "./analytics-charts-panel"
import { getRecordDurationStatus, getEffectiveDays } from "@/lib/track-record-calc"
import { ProjectInterruptionModal } from "@/components/project-interruption-modal"
import { recordAuditLog } from "@/lib/audit-logs"
import {
  type ProjectInterruption,
  type RecordInterruptionsMap,
  getInterruptionsForRecord,
  DEFAULT_INTERRUPTIONS,
} from "@/lib/project-interruptions-shared"
import { type ROVPersonnelAssignment } from "@/lib/rov-assignments-shared"
import { saveROVAssignmentsAction } from "@/actions/rov-assignment-actions"
import { saveProjectInterruptionsAction } from "@/actions/interruption-actions"
import { verifyRevenuePassword, getSavedRevenueUnlocked, setSavedRevenueUnlocked } from "@/lib/revenue-security"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type SortKey = keyof TrackRecordDB
type SortDir = "asc" | "desc"

interface TrackRecordContentProps {
  initialRecords: TrackRecordDB[]
  initialInterruptions?: RecordInterruptionsMap
  initialAssignments?: ROVPersonnelAssignment[]
  initialPersonnel?: PersonnelDB[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (d?: string | null) => {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch { return d }
}

const fmtUSD = (v?: number | null) => {
  if (v == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

const fmtDepth = (min?: number | null, max?: number | null) => {
  if (min == null && max == null) return "—"
  if (min != null && max != null) return `${min}–${max} msw`
  return `${min ?? max} msw`
}

// Download file CSV (dùng thư viện thuần JS không cần xlsx package)
function exportToCSV(records: TrackRecordDB[], isRevenueUnlocked: boolean = false) {
  const headers = [
    "No", "Client", "Contract", "Project Task", "Start Date", "End Date",
    "Duration (days)", "Contact Person", "Contact Phone", "Project SOW", "Location",
    "Cost (USD)", "Depth Min (msw)", "Depth Max (msw)", "ROV System", "Vessel/Rig", "Class", "Notes",
  ]
  const rows = records.map((r) => {
    const durStatus = getRecordDurationStatus(r)
    let endDateStr = r.end_date ? fmtDate(r.end_date) : ""
    if (durStatus.isOngoing) {
      endDateStr = `Đang thực hiện (Chưa kết thúc - tính đến ${durStatus.todayFormatted})`
    } else if (durStatus.isFutureEnd) {
      endDateStr = `${fmtDate(r.end_date)} (Dự kiến)`
    }

    return [
      r.no ?? "", r.client ?? "", r.contract ?? "", r.project_task ?? "",
      r.start_date ? fmtDate(r.start_date) : "",
      endDateStr,
      durStatus.effectiveDays ?? "", r.client_contact_person ?? "",
      r.client_contact_phone ?? "", r.project_sow ?? "", r.location ?? "",
      isRevenueUnlocked ? (r.total_project_cost_usd ?? "") : "[Bảo mật]", r.water_depth_min_msw ?? "",
      r.water_depth_max_msw ?? "", r.rov_system ?? "", r.vessel_rig ?? "",
      r.class ?? "", r.notes ?? "",
    ]
  })

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const BOM = "\uFEFF"
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `ROV_Track_Record_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty form state
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FORM: Omit<TrackRecordDB, "id" | "duration_days" | "created_at" | "updated_at"> = {
  no: undefined,
  client: "",
  contract: "",
  project_task: "",
  start_date: "",
  end_date: "",
  client_contact_person: "",
  client_contact_phone: "",
  project_sow: "",
  location: "",
  total_project_cost_usd: undefined,
  water_depth_min_msw: undefined,
  water_depth_max_msw: undefined,
  rov_system: "",
  vessel_rig: "",
  class: "",
  notes: "",
  created_by: "",
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────
function RecordFormModal({
  record,
  onClose,
  onSaved,
  isAdmin,
}: {
  record: TrackRecordDB | null
  onClose: () => void
  onSaved: (r: TrackRecordDB) => void
  isAdmin: boolean
}) {
  const isEdit = record !== null
  const [form, setForm] = useState<typeof EMPTY_FORM>(
    isEdit
      ? {
          no: record.no,
          client: record.client ?? "",
          contract: record.contract ?? "",
          project_task: record.project_task ?? "",
          start_date: record.start_date?.slice(0, 10) ?? "",
          end_date: record.end_date?.slice(0, 10) ?? "",
          client_contact_person: record.client_contact_person ?? "",
          client_contact_phone: record.client_contact_phone ?? "",
          project_sow: record.project_sow ?? "",
          location: record.location ?? "",
          total_project_cost_usd: record.total_project_cost_usd ?? undefined,
          water_depth_min_msw: record.water_depth_min_msw ?? undefined,
          water_depth_max_msw: record.water_depth_max_msw ?? undefined,
          rov_system: record.rov_system ?? "",
          vessel_rig: record.vessel_rig ?? "",
          class: record.class ?? "",
          notes: record.notes ?? "",
          created_by: record.created_by ?? "",
        }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof EMPTY_FORM, value: string | number | undefined) =>
    setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      no: form.no ? Number(form.no) : null,
      total_project_cost_usd: form.total_project_cost_usd ? Number(form.total_project_cost_usd) : null,
      water_depth_min_msw: form.water_depth_min_msw ? Number(form.water_depth_min_msw) : null,
      water_depth_max_msw: form.water_depth_max_msw ? Number(form.water_depth_max_msw) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }

    let result
    if (isEdit && record) {
      result = await updateTrackRecord(record.id, payload)
    } else {
      result = await createTrackRecord(payload as any)
    }

    if (!result.success) {
      setError(result.error ?? "Có lỗi xảy ra!")
      setSaving(false)
      return
    }

    recordAuditLog({
      action_type: isEdit ? "UPDATE_TRACK_RECORD" : "CREATE_TRACK_RECORD",
      target_name: `Dự án No.${payload.no ?? (record?.no || "")}: ${payload.project_name || "Dự án ROV"}`,
      summary: `${isEdit ? "Cập nhật" : "Thêm mới"} dự án ${payload.project_name || ""} (${payload.rov_system || ""})`,
      details: payload,
    })

    onSaved({ id: record?.id ?? Date.now(), ...payload } as TrackRecordDB)
    setSaving(false)
  }

  const field = (
    label: string,
    key: keyof typeof EMPTY_FORM,
    opts?: { type?: string; placeholder?: string; textarea?: boolean; cols?: number }
  ) => (
    <div className={`flex flex-col gap-1 ${opts?.cols === 2 ? "col-span-2" : ""}`}>
      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      {opts?.textarea ? (
        <textarea
          value={(form[key] as string) ?? ""}
          onChange={(e) => set(key, e.target.value)}
          placeholder={opts.placeholder}
          rows={2}
          disabled={!isAdmin}
          className="rounded-lg bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:border-cyan-400 disabled:opacity-50"
        />
      ) : (
        <input
          type={opts?.type ?? "text"}
          value={(form[key] as string | number) ?? ""}
          onChange={(e) => set(key, opts?.type === "number" ? e.target.value : e.target.value)}
          placeholder={opts?.placeholder}
          disabled={!isAdmin}
          className="rounded-lg bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
        />
      )}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900/80 to-cyan-900/80 backdrop-blur-md border-b border-slate-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40">
              {isEdit ? <Pencil className="w-5 h-5 text-cyan-300" /> : <Plus className="w-5 h-5 text-cyan-300" />}
            </div>
            <div>
              <h2 className="font-bold text-white text-base">{isEdit ? "Chỉnh sửa dự án" : "Thêm dự án mới"}</h2>
              <p className="text-xs text-cyan-300/70">Track Record – ROV Workshop PTSC G&S</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic info */}
          <div>
            <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5" /> Thông tin cơ bản
            </p>
            <div className="grid grid-cols-2 gap-4">
              {field("No.", "no", { type: "number", placeholder: "319" })}
              {field("Client", "client", { placeholder: "MVOT, PVEP, ENI..." })}
              {field("Contract No.", "contract", { placeholder: "MVOT/FSO-SER/139/2026", cols: 2 })}
              {field("Project Task", "project_task", { placeholder: "Mô tả công việc...", textarea: true, cols: 2 })}
              {field("Class", "class", { placeholder: "A, B, C..." })}
              {field("Location", "location", { placeholder: "PM3-CAA, Cuu Long..." })}
            </div>
          </div>

          {/* Dates */}
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Thời gian
            </p>
            <div className="grid grid-cols-2 gap-4">
              {field("Start Date", "start_date", { type: "date" })}
              {field("End Date", "end_date", { type: "date" })}
            </div>
            {form.start_date && form.end_date && (
              <p className="mt-2 text-xs text-cyan-300/70">
                ⏱ Thời gian: {Math.max(0, Math.round((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1)} ngày
              </p>
            )}
          </div>

          {/* Technical */}
          <div>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> Kỹ thuật & Thiết bị
            </p>
            <div className="grid grid-cols-2 gap-4">
              {field("ROV System", "rov_system", { placeholder: "ROV Quasar MKII-30..." })}
              {field("Vessel / Rig", "vessel_rig", { placeholder: "PTSC Thai Binh..." })}
              {field("Water Depth Min (msw)", "water_depth_min_msw", { type: "number", placeholder: "0" })}
              {field("Water Depth Max (msw)", "water_depth_max_msw", { type: "number", placeholder: "500" })}
            </div>
          </div>

          {/* Finance & Contact */}
          <div>
            <p className="text-xs font-bold text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Tài chính & Liên hệ
            </p>
            <div className="grid grid-cols-2 gap-4">
              {field("Total Cost (USD)", "total_project_cost_usd", { type: "number", placeholder: "0" })}
              {field("Created By", "created_by", { placeholder: "Tên người nhập..." })}
              {field("Client Contact Person", "client_contact_person", { placeholder: "Tên người liên hệ..." })}
              {field("Contact Phone", "client_contact_phone", { placeholder: "Số điện thoại..." })}
            </div>
          </div>

          {/* Project SOW & Notes */}
          <div>
            <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Filter className="w-3.5 h-3.5" /> Chi tiết bổ sung
            </p>
            <div className="grid grid-cols-1 gap-4">
              {field("Project SOW (Scope of Work)", "project_sow", { textarea: true, placeholder: "Mô tả phạm vi công việc..." })}
              {field("Notes", "notes", { textarea: true, placeholder: "Ghi chú thêm..." })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {isAdmin ? (
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:opacity-90 active:scale-95 transition disabled:opacity-60"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {isEdit ? "Lưu thay đổi" : "Thêm dự án"}
              </button>
              <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 transition">
                Hủy
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-amber-400/80 p-3 bg-amber-900/20 rounded-lg border border-amber-600/30">
              ⚠️ Bạn đang ở chế độ chỉ xem. Cần quyền Admin để thêm/sửa dữ liệu.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function StatsPanel({
  records,
  onCardClick,
  theme = "dark",
  minYear = 2005,
  interruptionsMap,
  isRevenueUnlocked = false,
  onRequireRevenueUnlock,
}: {
  records: TrackRecordDB[]
  onCardClick: (type: StatsModalType) => void
  theme?: ThemeMode
  minYear?: number | string
  interruptionsMap?: RecordInterruptionsMap
  isRevenueUnlocked?: boolean
  onRequireRevenueUnlock?: () => void
}) {
  const totalCost = records.reduce((s, r) => s + (r.total_project_cost_usd ?? 0), 0)
  const totalDays = records.reduce((s, r) => s + getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r)), 0)
  const validDurationCount = records.filter(r => getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r)) > 0).length
  const avgDays = validDurationCount > 0 ? Math.round(totalDays / validDurationCount) : 0
  const clients = new Set(records.map(r => r.client).filter(Boolean)).size
  const locations = new Set(records.map(r => r.location).filter(Boolean)).size
  const vessels = new Set(records.map(r => r.vessel_rig).filter(Boolean)).size

  const isLight = theme === "light"
  const isNeutral = theme === "neutral"
  const currentYear = new Date().getFullYear()

  const handleItemClick = (type: StatsModalType) => {
    if (type === "revenue" && !isRevenueUnlocked) {
      if (onRequireRevenueUnlock) {
        onRequireRevenueUnlock()
        return
      }
    }
    onCardClick(type)
  }

  const stats: {
    type: StatsModalType
    label: string
    value: string | number
    sub?: string
    icon: any
    color: string
    accent: string
    lightBg: string
    lightIcon: string
    neutralBg: string
    neutralIcon: string
  }[] = [
    {
      type: "projects",
      label: "Tổng dự án",
      value: records.length,
      sub: `${minYear} - ${currentYear}`,
      icon: Layers,
      color: "from-blue-600 to-cyan-500",
      accent: "text-cyan-300",
      lightBg: "bg-blue-50/60 border-blue-200/80 hover:border-blue-400 text-blue-900",
      lightIcon: "text-blue-600 bg-blue-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-blue-400 bg-blue-950/60",
    },
    {
      type: "revenue",
      label: "Tổng doanh thu",
      value: isRevenueUnlocked ? fmtUSD(totalCost) : "••••••••",
      sub: isRevenueUnlocked ? "Toàn bộ HĐ" : "🔒 Bấm mở khóa",
      icon: DollarSign,
      color: "from-emerald-600 to-teal-400",
      accent: "text-emerald-300",
      lightBg: "bg-emerald-50/60 border-emerald-200/80 hover:border-emerald-400 text-emerald-900",
      lightIcon: "text-emerald-700 bg-emerald-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-emerald-400 bg-emerald-950/60",
    },
    {
      type: "duration",
      label: "Tổng thời gian",
      value: `${totalDays.toLocaleString("en-US")} ngày`,
      sub: `TB: ${avgDays} ngày/DA`,
      icon: Calendar,
      color: "from-amber-600 to-yellow-400",
      accent: "text-amber-300",
      lightBg: "bg-amber-50/60 border-amber-200/80 hover:border-amber-400 text-amber-900",
      lightIcon: "text-amber-700 bg-amber-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-amber-400 bg-amber-950/60",
    },
    {
      type: "clients",
      label: "Số khách hàng",
      value: clients,
      sub: "Chủ đầu tư / Tàu",
      icon: Users,
      color: "from-violet-600 to-purple-400",
      accent: "text-violet-300",
      lightBg: "bg-purple-50/60 border-purple-200/80 hover:border-purple-400 text-purple-900",
      lightIcon: "text-purple-700 bg-purple-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-purple-400 bg-purple-950/60",
    },
    {
      type: "locations",
      label: "Địa điểm / Mỏ",
      value: locations,
      sub: "Khu vực khảo sát",
      icon: MapPin,
      color: "from-rose-600 to-pink-400",
      accent: "text-rose-300",
      lightBg: "bg-rose-50/60 border-rose-200/80 hover:border-rose-400 text-rose-900",
      lightIcon: "text-rose-700 bg-rose-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-rose-400 bg-rose-950/60",
    },
    {
      type: "vessels",
      label: "Tàu / Giàn khoan",
      value: vessels,
      sub: "Phương tiện offshore",
      icon: Ship,
      color: "from-indigo-600 to-blue-400",
      accent: "text-indigo-300",
      lightBg: "bg-indigo-50/60 border-indigo-200/80 hover:border-indigo-400 text-indigo-900",
      lightIcon: "text-indigo-700 bg-indigo-100",
      neutralBg: "bg-[#232732] border-neutral-700/80 hover:border-neutral-500 text-neutral-100",
      neutralIcon: "text-indigo-400 bg-indigo-950/60",
    },
  ]

  if (isLight) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleItemClick(s.type)}
            className="relative text-left rounded-xl p-3 bg-white border border-slate-300 hover:border-blue-600 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 group cursor-pointer overflow-hidden flex flex-col justify-between"
            title={`Bấm để xem chi tiết thống kê: ${s.label}`}
          >
            <div className="flex items-center justify-between mb-1.5 relative z-10">
              <div className={`p-1.5 rounded-lg ${s.lightIcon}`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-slate-950 font-extrabold bg-slate-200/90 border border-slate-300/80 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                {s.sub}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-base sm:text-lg font-black text-slate-950 leading-tight font-mono tracking-tight group-hover:text-blue-700 transition truncate">
                {s.value}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-slate-950 font-extrabold tracking-tight truncate">{s.label}</p>
                <span className="text-[10px] text-blue-700 font-extrabold opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  Chi tiết ↗
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  if (isNeutral) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => handleItemClick(s.type)}
            className="relative text-left rounded-xl p-3 bg-[#232732] border border-neutral-700/80 hover:border-neutral-500 shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 group cursor-pointer overflow-hidden flex flex-col justify-between"
            title={`Bấm để xem chi tiết thống kê: ${s.label}`}
          >
            <div className="flex items-center justify-between mb-1.5 relative z-10">
              <div className={`p-1.5 rounded-lg ${s.neutralIcon}`}>
                <s.icon className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] text-neutral-400 font-medium bg-neutral-800/90 px-1.5 py-0.5 rounded truncate max-w-[90px]">
                {s.sub}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-base sm:text-lg font-black text-neutral-100 leading-tight font-mono tracking-tight group-hover:text-amber-300 transition truncate">
                {s.value}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[11px] text-neutral-300 font-semibold truncate">{s.label}</p>
                <span className="text-[10px] text-amber-400 font-medium opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                  Chi tiết ↗
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
      {stats.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => handleItemClick(s.type)}
          className={`relative text-left rounded-xl px-3 py-2 bg-gradient-to-br ${s.color} bg-opacity-15 hover:bg-opacity-30 border border-white/10 hover:border-white/35 shadow-md hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 group cursor-pointer overflow-hidden flex flex-col justify-between`}
          title={`Bấm để xem chi tiết thống kê: ${s.label}`}
        >
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-white/30 to-transparent group-hover:opacity-20 transition" />
          <div className="flex items-center justify-between mb-0.5 relative z-10">
            <s.icon className="w-3.5 h-3.5 text-white/70 group-hover:text-white transition" />
            <span className="text-[9px] text-white/60 font-medium group-hover:text-white/90 truncate max-w-[85px]">
              {s.sub}
            </span>
          </div>
          <div className="relative z-10">
            <p className="text-sm sm:text-base font-extrabold text-white leading-tight font-mono tracking-tight group-hover:text-cyan-100 transition truncate">
              {s.value}
            </p>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-[10px] text-white/70 font-medium truncate">{s.label}</p>
              <span className="text-[9px] text-white/50 group-hover:text-cyan-300 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Chi tiết ↗
              </span>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CONTENT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function TrackRecordContent({
  initialRecords,
  initialInterruptions,
  initialAssignments,
  initialPersonnel,
}: TrackRecordContentProps) {
  const router = useRouter()

  // Auth admin
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminPwd, setAdminPwd] = useState("")
  const [showAdminInput, setShowAdminInput] = useState(false)
  const [adminError, setAdminError] = useState("")

  // Auth revenue (Dùng chung mật khẩu cho toàn bộ các mục doanh thu)
  const [isRevenueUnlocked, setIsRevenueUnlocked] = useState(false)
  const [showRevenueModal, setShowRevenueModal] = useState(false)
  const [revenuePwd, setRevenuePwd] = useState("")
  const [revenueError, setRevenueError] = useState("")
  const effectiveRevenueUnlocked = isAdmin || isRevenueUnlocked

  // Khôi phục trạng thái mở khóa doanh thu trong session
  useEffect(() => {
    if (getSavedRevenueUnlocked()) {
      setIsRevenueUnlocked(true)
    }
  }, [])

  const handleUnlockRevenueSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (verifyRevenuePassword(revenuePwd)) {
      setIsRevenueUnlocked(true)
      setSavedRevenueUnlocked(true)
      setShowRevenueModal(false)
      setRevenuePwd("")
      setRevenueError("")
    } else {
      setRevenueError("Mật khẩu không đúng! Vui lòng nhập đúng mật khẩu Admin hoặc mật khẩu phân quyền.")
    }
  }

  const handleLockRevenue = () => {
    setIsRevenueUnlocked(false)
    setSavedRevenueUnlocked(false)
    if (isAdmin) {
      setIsAdmin(false)
      setAdminPwd("")
    }
  }

  // Records state
  const [records, setRecords] = useState<TrackRecordDB[]>(initialRecords)

  // Map lưu trữ các đợt tạm ngưng của từng dự án
  const [interruptionsMap, setInterruptionsMap] = useState<RecordInterruptionsMap>(() => {
    return initialInterruptions && Object.keys(initialInterruptions).length > 0
      ? initialInterruptions
      : DEFAULT_INTERRUPTIONS
  })

  // Modal quản lý đợt tạm ngưng cho 1 dự án
  const [interruptionModalRecord, setInterruptionModalRecord] = useState<TrackRecordDB | null>(null)

  // User-selected baseline start year for statistics (Default: 2005 as requested)
  const [statsStartYear, setStatsStartYear] = useState<string>("2005")

  // Theme mode: dark, light, neutral (persisted in localStorage)
  const [theme, setTheme] = useState<ThemeMode>("dark")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem("rov_track_record_theme") as ThemeMode
      if (saved === "light" || saved === "neutral" || saved === "dark") {
        setTheme(saved)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (mounted) {
      try {
        localStorage.setItem("rov_track_record_theme", theme)
      } catch {}
    }
  }, [theme, mounted])

  const isLight = theme === "light"
  const isNeutral = theme === "neutral"

  // Danh sách các năm có trong cơ sở dữ liệu để đưa vào dropdown chọn mốc thống kê
  const availableStartYears = useMemo(() => {
    const yearsSet = new Set<number>()
    records.forEach((r) => {
      if (r.start_date) {
        const y = new Date(r.start_date).getFullYear()
        if (!isNaN(y) && y >= 1990) yearsSet.add(y)
      }
    })
    yearsSet.add(2005)
    return Array.from(yearsSet).sort((a, b) => a - b)
  }, [records])

  // Earliest year in the track record dataset for dynamic subtitle
  const minYear = useMemo(() => {
    const years = records
      .map(r => r.start_date ? new Date(r.start_date).getFullYear() : null)
      .filter((y): y is number => y !== null && !isNaN(y) && y >= 1990)
    return years.length > 0 ? Math.min(...years) : 2005
  }, [records])

  // Lưu cấu hình các đợt tạm ngưng
  const handleSaveInterruptions = async (recordKey: string, updated: ProjectInterruption[]) => {
    const newMap: RecordInterruptionsMap = {
      ...interruptionsMap,
      [recordKey]: updated,
    }
    const rec = records.find(r => String(r.id) === recordKey || String(r.no) === recordKey)
    if (rec) {
      if (rec.id != null) newMap[String(rec.id)] = updated
      if (rec.no != null) newMap[String(rec.no)] = updated
    }
    setInterruptionsMap(newMap)
    const res = await saveProjectInterruptionsAction(newMap)
    if (!res.success) {
      alert("Lỗi lưu đợt tạm ngưng: " + res.error)
    }
  }

  // Danh sách phân công nhân sự ROV
  const [assignments, setAssignments] = useState<ROVPersonnelAssignment[]>(initialAssignments || [])

  // Lưu phân công nhân sự và đồng bộ
  const handleSaveAssignments = async (newAssignments: ROVPersonnelAssignment[]) => {
    setAssignments(newAssignments)
    await saveROVAssignmentsAction(newAssignments)
  }

  // Cập nhật thông tin dự án (số HĐ, ghi chú, bàn giao công việc...) và đồng bộ
  const handleUpdateRecord = (updatedRecord: TrackRecordDB) => {
    setRecords(prev => prev.map(r => r.id === updatedRecord.id ? { ...r, ...updatedRecord } : r))
  }

  // Filters
  const [search, setSearch] = useState("")
  const [filterClient, setFilterClient] = useState("")
  const [filterLocation, setFilterLocation] = useState("")
  const [filterROVs, setFilterROVs] = useState<string[]>([])
  const [filterYear, setFilterYear] = useState("")

  // ROV multi-select dropdown popover state & dynamic sizing
  const [isROVDropdownOpen, setIsROVDropdownOpen] = useState(false)
  const [rovSearchQuery, setRovSearchQuery] = useState("")
  const [popoverSize, setPopoverSize] = useState<{ width: number; height: number }>({
    width: 440,
    height: 500,
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDraggingSize, setIsDraggingSize] = useState(false)
  const startDragRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null)
  const rovDropdownRef = useRef<HTMLDivElement>(null)

  // Mouse & Touch drag-to-resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingSize(true)
    startDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: popoverSize.width,
      startH: popoverSize.height,
    }
  }

  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation()
    if (!e.touches[0]) return
    setIsDraggingSize(true)
    startDragRef.current = {
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY,
      startW: popoverSize.width,
      startH: popoverSize.height,
    }
  }

  useEffect(() => {
    if (!isDraggingSize) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!startDragRef.current) return
      const deltaX = e.clientX - startDragRef.current.startX
      const deltaY = e.clientY - startDragRef.current.startY
      const maxW = Math.max(340, window.innerWidth - 32)
      const maxH = Math.max(360, window.innerHeight - 80)
      const nextW = Math.max(340, Math.min(maxW, startDragRef.current.startW + deltaX))
      const nextH = Math.max(360, Math.min(maxH, startDragRef.current.startH + deltaY))
      setPopoverSize({ width: Math.round(nextW), height: Math.round(nextH) })
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!startDragRef.current || !e.touches[0]) return
      const deltaX = e.touches[0].clientX - startDragRef.current.startX
      const deltaY = e.touches[0].clientY - startDragRef.current.startY
      const maxW = Math.max(340, window.innerWidth - 32)
      const maxH = Math.max(360, window.innerHeight - 80)
      const nextW = Math.max(340, Math.min(maxW, startDragRef.current.startW + deltaX))
      const nextH = Math.max(360, Math.min(maxH, startDragRef.current.startH + deltaY))
      setPopoverSize({ width: Math.round(nextW), height: Math.round(nextH) })
    }

    const handleMouseUp = () => {
      setIsDraggingSize(false)
      startDragRef.current = null
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleMouseUp)
    }
  }, [isDraggingSize])

  const toggleExpandPopover = () => {
    if (isExpanded) {
      setIsExpanded(false)
      setPopoverSize({ width: 440, height: 500 })
    } else {
      setIsExpanded(true)
      const targetW = Math.min(680, window.innerWidth - 40)
      const targetH = Math.min(680, window.innerHeight - 100)
      setPopoverSize({ width: targetW, height: targetH })
    }
  }

  // Close ROV dropdown when clicking outside (not when resizing)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDraggingSize) return
      if (rovDropdownRef.current && !rovDropdownRef.current.contains(e.target as Node)) {
        setIsROVDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isDraggingSize])

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("no")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Modal
  const [editRecord, setEditRecord] = useState<TrackRecordDB | null | "new">(null)

  // View mode
  const [viewRecord, setViewRecord] = useState<TrackRecordDB | null>(null)

  // Stats detail modal
  const [activeStatsModal, setActiveStatsModal] = useState<StatsModalType>(null)

  // Import ref
  const importRef = useRef<HTMLInputElement>(null)

  // ── Unique filter values ──────────────────────────────────
  const allClients = useMemo(() => [...new Set(records.map(r => r.client).filter(Boolean))].sort() as string[], [records])
  const allLocations = useMemo(() => [...new Set(records.map(r => r.location).filter(Boolean))].sort() as string[], [records])
  const allROVs = useMemo(() => [...new Set(records.map(r => r.rov_system).filter(Boolean))].sort() as string[], [records])
  const allYears = useMemo(() => {
    const years = records.map(r => r.start_date ? new Date(r.start_date).getFullYear() : null).filter(Boolean)
    return [...new Set(years)].sort((a, b) => (b as number) - (a as number)) as number[]
  }, [records])

  // Count projects for each ROV system
  const rovCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    records.forEach(r => {
      if (r.rov_system) {
        counts[r.rov_system] = (counts[r.rov_system] || 0) + 1
      }
    })
    return counts
  }, [records])

  // Split ROVs: 4 ROV chính + các thiết bị kèm theo (Quasar, Compact 07, 954, 911), theo sau là các thiết bị khác
  const { pinnedROVs, core4ROVs, otherROVs } = useMemo(() => {
    // 4 ROV chính chủ lực
    const core4 = [
      "ROV Quasar MKII-30",
      "ROV Quasar Compact 07",
      "ROV Panther Plus 954",
      "ROV Panther Plus 911",
    ].filter(r => allROVs.includes(r))

    // Nhận diện các ROV chính và các biến thể kèm thiết bị (như ROV Quasar & Diving, 07 & Diving, 954 & Diving...)
    const isMainOrAttached = (name: string) => {
      const s = name.toLowerCase()
      return s.includes("quasar") || s.includes("954") || s.includes("911")
    }

    // Các thiết bị kèm theo / tổ hợp của ROV chính
    const attached = allROVs.filter(r => isMainOrAttached(r) && !core4.includes(r))

    // Danh sách toàn bộ ROV chính + thiết bị kèm theo (4 ROV chính đứng đầu)
    const allMain = [...core4, ...attached]
    const others = allROVs.filter(r => !allMain.includes(r))

    return { pinnedROVs: allMain, core4ROVs: core4, otherROVs: others }
  }, [allROVs])

  // Filtered ROVs by search inside dropdown
  const filteredPinnedROVs = useMemo(() => {
    if (!rovSearchQuery) return pinnedROVs
    const q = rovSearchQuery.toLowerCase()
    return pinnedROVs.filter(r => r.toLowerCase().includes(q))
  }, [pinnedROVs, rovSearchQuery])

  const filteredOtherROVs = useMemo(() => {
    if (!rovSearchQuery) return otherROVs
    const q = rovSearchQuery.toLowerCase()
    return otherROVs.filter(r => r.toLowerCase().includes(q))
  }, [otherROVs, rovSearchQuery])

  const toggleROV = (rov: string) => {
    setFilterROVs(prev => {
      const exists = prev.includes(rov)
      return exists ? prev.filter(r => r !== rov) : [...prev, rov]
    })
    setPage(1)
  }

  // ── 04 ROV FLEET LIVE STATUS (DƯỚI ĐÁY MÀN HÌNH) ────────────────
  const getTodayStr = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }

  const [statusDate, setStatusDate] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  })
  const [hoveredFleetROV, setHoveredFleetROV] = useState<string | null>(null)
  const [isFleetDockMinimized, setIsFleetDockMinimized] = useState(false)

  const fleetStatusList = useMemo(() => {
    return FLEET_DEFS.map(def => {
      // Tìm toàn bộ dự án của ROV này (bao gồm cả cấu hình đơn & tổ hợp kèm thiết bị)
      const fleetRecords = records.filter(r => r.rov_system && def.matcher(r.rov_system))

      // Kiểm tra dự án nào đang làm việc trong statusDate (start_date <= statusDate <= end_date)
      const activeProjects = fleetRecords.filter(r => {
        if (!r.start_date) return false
        const s = r.start_date.slice(0, 10)
        if (r.end_date) {
          const e = r.end_date.slice(0, 10)
          return statusDate >= s && statusDate <= e
        }
        // Nếu không có ngày kết thúc (dự án dài hạn / đang tiếp diễn từ ngày bắt đầu)
        return statusDate >= s
      })

      // Sắp xếp giảm dần theo ngày bắt đầu để tìm dự án gần nhất
      const sortedByDate = [...fleetRecords].sort((a, b) => {
        const da = a.start_date ? new Date(a.start_date).getTime() : 0
        const db = b.start_date ? new Date(b.start_date).getTime() : 0
        return db - da
      })

      const isActive = activeProjects.length > 0
      const currentProject = activeProjects[0] || null
      const latestProject = sortedByDate[0] || null

      return {
        ...def,
        isActive,
        activeProjects,
        currentProject,
        latestProject,
        totalProjects: fleetRecords.length,
      }
    })
  }, [records, statusDate])

  // ── Filter + sort ─────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const statsStartYearNum = statsStartYear ? parseInt(statsStartYear, 10) : null

    return records.filter((r) => {
      // 1. Mốc thời gian thống kê từ năm ... tới hiện tại
      if (statsStartYearNum) {
        if (r.start_date) {
          const y = new Date(r.start_date).getFullYear()
          if (!isNaN(y) && y < statsStartYearNum) {
            if (r.end_date) {
              const endY = new Date(r.end_date).getFullYear()
              if (isNaN(endY) || endY < statsStartYearNum) return false
            } else {
              // Dự án đang diễn ra tới nay
            }
          }
        }
      }

      if (q && !`${r.client} ${r.contract} ${r.project_task} ${r.location} ${r.rov_system} ${r.vessel_rig}`.toLowerCase().includes(q)) return false
      if (filterClient && r.client !== filterClient) return false
      if (filterLocation && r.location !== filterLocation) return false
      if (filterROVs.length > 0) {
        if (!r.rov_system) return false
        const match = filterROVs.some(sel => {
          if (r.rov_system === sel) return true
          // If record has combination of ROVs (contains &, /, ,, +, or 'and')
          if (/[&/,\+]|\band\b/i.test(r.rov_system!)) {
            return r.rov_system!.toLowerCase().includes(sel.toLowerCase())
          }
          return false
        })
        if (!match) return false
      }
      if (filterYear && r.start_date && new Date(r.start_date).getFullYear() !== Number(filterYear)) return false
      return true
    })
  }, [records, search, filterClient, filterLocation, filterROVs, filterYear, statsStartYear])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === "duration_days") {
        const ad = getEffectiveDays(a, undefined, getInterruptionsForRecord(interruptionsMap, a))
        const bd = getEffectiveDays(b, undefined, getInterruptionsForRecord(interruptionsMap, b))
        return sortDir === "asc" ? ad - bd : bd - ad
      }
      const av = a[sortKey] ?? ""
      const bv = b[sortKey] ?? ""
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, interruptionsMap])

  // ── Pagination ────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("asc") }
  }

  // ── Selection ─────────────────────────────────────────────
  const toggleAll = () => {
    if (selected.size === paginated.length) setSelected(new Set())
    else setSelected(new Set(paginated.map(r => r.id)))
  }
  const toggleOne = (id: number) => {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  // ── CRUD handlers ─────────────────────────────────────────
  const handleSaved = useCallback((saved: TrackRecordDB) => {
    setRecords(prev => {
      const idx = prev.findIndex(r => r.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setEditRecord(null)
    router.refresh()
  }, [router])

  const handleDelete = async (id: number) => {
    if (!isAdmin) return
    if (!confirm("Xác nhận xóa dự án này?")) return
    const targetRec = records.find(r => r.id === id)
    const res = await deleteTrackRecord(id)
    if (res.success) {
      recordAuditLog({
        action_type: "DELETE_TRACK_RECORD",
        target_name: `Dự án No.${targetRec?.no ?? id}: ${targetRec?.project_name ?? "Dự án ROV"}`,
        summary: `Xóa dự án ${targetRec?.project_name ?? ""} (ID: ${id})`,
        details: targetRec,
      })
      setRecords(prev => prev.filter(r => r.id !== id))
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } else alert("Lỗi: " + res.error)
  }

  const handleDeleteSelected = async () => {
    if (!isAdmin || selected.size === 0) return
    if (!confirm(`Xác nhận xóa ${selected.size} dự án đã chọn?`)) return
    const ids = [...selected]
    const res = await deleteTrackRecords(ids)
    if (res.success) {
      recordAuditLog({
        action_type: "DELETE_TRACK_RECORD",
        target_name: `${ids.length} dự án Track Record`,
        summary: `Xóa hàng loạt ${ids.length} dự án Track Record`,
        details: { deletedIds: ids },
      })
      setRecords(prev => prev.filter(r => !ids.includes(r.id)))
      setSelected(new Set())
    } else alert("Lỗi: " + res.error)
  }

  // ── Admin login ───────────────────────────────────────────
  const handleAdminLogin = () => {
    if (verifyRevenuePassword(adminPwd)) {
      setIsAdmin(true)
      setIsRevenueUnlocked(true)
      setSavedRevenueUnlocked(true)
      setShowAdminInput(false)
      setAdminPwd("")
      setAdminError("")
    } else {
      setAdminError("Mật khẩu không đúng!")
    }
  }

  // ── Import CSV ────────────────────────────────────────────
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Placeholder – sẽ phát triển sau với parse CSV
    alert("Tính năng import CSV sẽ được phát triển trong phiên bản tiếp theo.")
    if (importRef.current) importRef.current.value = ""
  }

  // ── Sort icon ─────────────────────────────────────────────
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30" />
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />
  }

  const thClass = isLight
    ? "px-3 py-2.5 text-left text-[11px] font-black text-slate-950 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-blue-700 select-none"
    : isNeutral
    ? "px-3 py-2.5 text-left text-[11px] font-semibold text-neutral-300 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-amber-300 select-none"
    : "px-3 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-cyan-300 select-none"

  const tdClass = isLight
    ? "px-3 py-2.5 text-sm font-semibold text-slate-950 align-top"
    : isNeutral
    ? "px-3 py-2.5 text-sm text-neutral-200 align-top"
    : "px-3 py-2.5 text-sm text-slate-200 align-top"

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isLight
        ? "bg-slate-100 text-slate-900"
        : isNeutral
        ? "bg-[#181a20] text-neutral-100"
        : "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white"
    }`}>
      {/* ── TOP HEADER ────────────────────────────────────────── */}
      <div className={`sticky top-0 z-50 backdrop-blur-md px-4 py-3 flex items-center gap-3 sm:gap-4 transition-colors duration-200 ${
        isLight
          ? "bg-white/95 border-b border-slate-200 shadow-xs"
          : isNeutral
          ? "bg-[#1e222a]/95 border-b border-neutral-700/80 shadow-md"
          : "bg-slate-950/90 border-b border-slate-800"
      }`}>
        <button
          onClick={() => router.push("/")}
          className={`p-2 rounded-xl border transition ${
            isLight
              ? "border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-950"
              : isNeutral
              ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
              : "border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          title="Về trang chủ"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${
            isLight
              ? "bg-amber-50 border-amber-300 text-amber-600 shadow-xs"
              : isNeutral
              ? "bg-amber-950/40 border-amber-600/30 text-amber-400"
              : "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400"
          }`}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`text-base font-black leading-tight ${isLight ? "text-slate-950" : "text-white"}`}>
                Track Record – ROV Workshop
              </h1>
              {/* Dòng chữ nhỏ bên cạnh tiêu đề: Cho phép chọn năm thống kê dạng dropbox (mặc định 2005) */}
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs transition-colors ${
                isLight
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : isNeutral
                  ? "bg-amber-950/50 border-amber-600/50 text-amber-300"
                  : "bg-amber-500/15 border-amber-500/40 text-amber-300"
              }`}>
                <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>Thời gian thống kê từ năm</span>
                <select
                  value={statsStartYear}
                  onChange={(e) => {
                    setStatsStartYear(e.target.value)
                    setPage(1)
                  }}
                  className={`font-black underline decoration-amber-500 decoration-2 px-1.5 py-0.5 rounded cursor-pointer focus:outline-none transition-colors text-xs font-mono ${
                    isLight
                      ? "bg-white border border-amber-300 text-amber-950 shadow-2xs hover:bg-amber-100/60"
                      : isNeutral
                      ? "bg-[#252833] border border-amber-500/40 text-amber-300 hover:bg-[#2d3240]"
                      : "bg-slate-900 border border-amber-400/50 text-amber-300 hover:bg-slate-800"
                  }`}
                  title="Bấm để chọn mốc năm bắt đầu thống kê"
                >
                  <option value="">Tất cả các năm (Từ đầu)</option>
                  {availableStartYears.map((y) => (
                    <option key={y} value={y} className={isLight ? "text-slate-900 bg-white" : "bg-slate-900 text-white"}>
                      {y}
                    </option>
                  ))}
                </select>
                <span>tới hiện tại</span>
              </span>
            </div>
            <p className={`text-[11px] ${isLight ? "text-slate-800 font-bold" : "text-slate-400"}`}>
              PTSC G&S | {filtered.length} dự án {statsStartYear ? `(giai đoạn ${statsStartYear} – hiện tại)` : "(toàn bộ các năm)"}
            </p>
          </div>
        </div>

        <div className="flex-1" />

        {/* ── Nút đổi màu nền: Sáng / Tối / Trung tính ── */}
        <div className={`flex items-center p-1 rounded-xl border text-xs font-semibold shadow-2xs transition-colors ${
          isLight
            ? "bg-slate-100 border-slate-300"
            : isNeutral
            ? "bg-[#181a20] border-neutral-700"
            : "bg-slate-900/90 border-slate-700/80"
        }`}>
          <button
            type="button"
            onClick={() => setTheme("dark")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-bold select-none ${
              theme === "dark"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/40"
                : isLight
                ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                : "text-neutral-400 hover:text-white hover:bg-neutral-800"
            }`}
            title="Chế độ Tối (Deep Ocean Navy)"
          >
            <Moon className="w-3.5 h-3.5 text-cyan-300" />
            <span className="hidden sm:inline">Tối</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("light")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-bold select-none ${
              theme === "light"
                ? "bg-white text-blue-900 font-extrabold shadow-md border border-slate-300"
                : isNeutral
                ? "text-neutral-400 hover:text-white hover:bg-neutral-800"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Chế độ Sáng (Modern Clean Light)"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Sáng</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme("neutral")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-bold select-none ${
              theme === "neutral"
                ? "bg-neutral-700 text-white shadow-md border border-neutral-600"
                : isLight
                ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Chế độ Trung tính (Warm Charcoal Graphite)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Trung tính</span>
          </button>
        </div>

        {/* ── Nút phân quyền Doanh thu: Đã ẩn (Mở khóa) / Đang hiện (Khóa lại) ── */}
        {effectiveRevenueUnlocked ? (
          <button
            type="button"
            onClick={handleLockRevenue}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs select-none cursor-pointer ${
              isLight
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                : isNeutral
                ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300 hover:bg-emerald-900/50"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25"
            }`}
            title="Doanh thu đang mở khóa hiển thị. Bấm để khóa lại."
          >
            <Unlock className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Doanh thu:</span>
            <span>Đang hiện</span>
            <span className="text-[10px] font-normal underline opacity-80">(Khóa)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowRevenueModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs select-none cursor-pointer ${
              isLight
                ? "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                : isNeutral
                ? "bg-amber-950/40 border-amber-600/50 text-amber-300 hover:bg-amber-900/50"
                : "bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25"
            }`}
            title="Số liệu doanh thu đang ẩn. Bấm để nhập mật khẩu phân quyền mở khóa."
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Doanh thu:</span>
            <span>Đã ẩn</span>
            <span className="text-[10px] font-normal underline opacity-80">(Mở khóa)</span>
          </button>
        )}

        {/* Admin toggle */}
        {!isAdmin ? (
          showAdminInput ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={adminPwd}
                onChange={e => { setAdminPwd(e.target.value); setAdminError("") }}
                onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                placeholder="Mật khẩu admin"
                autoFocus
                className={`w-36 rounded-lg text-xs font-medium px-3 py-1.5 focus:outline-none ${
                  isLight
                    ? "bg-white border border-slate-300 text-slate-950 focus:border-blue-500"
                    : isNeutral
                    ? "bg-[#222530] border border-neutral-700 text-white focus:border-amber-500"
                    : "bg-slate-800 border border-slate-600 text-white focus:border-cyan-400"
                }`}
              />
              {adminError && <span className="text-xs font-semibold text-red-500">{adminError}</span>}
              <button onClick={handleAdminLogin} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold hover:bg-cyan-500 transition">OK</button>
              <button onClick={() => { setShowAdminInput(false); setAdminError("") }} className={`p-1.5 rounded-lg ${isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"}`}>
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdminInput(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                isLight
                  ? "border-slate-300 text-slate-900 hover:bg-slate-200 hover:text-slate-950 shadow-2xs"
                  : isNeutral
                  ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  : "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              🔒 Admin Login
            </button>
          )
        ) : (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold">
              <Check className="w-3.5 h-3.5" /> Admin Mode
            </span>
            <button
              onClick={() => { setIsAdmin(false); setAdminPwd("") }}
              className={`p-1.5 rounded-lg transition ${
                isLight ? "text-slate-700 hover:text-slate-950 hover:bg-slate-200" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
              title="Đăng xuất Admin"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(filtered, effectiveRevenueUnlocked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
              isLight
                ? "border-slate-300 text-slate-900 hover:bg-slate-200 hover:text-slate-950 shadow-2xs"
                : isNeutral
                ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                : "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
            title="Xuất CSV"
          >
            <Download className="w-3.5 h-3.5" /> Xuất CSV
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => importRef.current?.click()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                  isLight
                    ? "border-slate-300 text-slate-900 hover:bg-slate-200 hover:text-slate-950 shadow-2xs"
                    : isNeutral
                    ? "border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white"
                    : "border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
                title="Import CSV"
              >
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
              <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />

              <button
                onClick={() => setEditRecord("new")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:opacity-90 transition shadow-lg"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm dự án
              </button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 pb-36">
        {/* Stats */}
        <StatsPanel
          records={filtered}
          onCardClick={setActiveStatsModal}
          theme={theme}
          minYear={statsStartYear || minYear}
          interruptionsMap={interruptionsMap}
          isRevenueUnlocked={effectiveRevenueUnlocked}
          onRequireRevenueUnlock={() => setShowRevenueModal(true)}
        />

        {/* ── ANALYTICS CHARTS & COMPARISON PANEL ─────────────────── */}
        <AnalyticsChartsPanel
          records={filtered}
          theme={theme}
          isAdmin={isAdmin}
          isRevenueUnlocked={effectiveRevenueUnlocked}
          onUnlockRevenue={() => {
            setIsRevenueUnlocked(true)
            setSavedRevenueUnlocked(true)
          }}
          onRequireAdmin={() => setShowRevenueModal(true)}
          onAdminLogin={() => {
            setIsAdmin(true)
            setIsRevenueUnlocked(true)
            setSavedRevenueUnlocked(true)
          }}
          interruptionsMap={interruptionsMap}
          onSaveInterruptions={handleSaveInterruptions}
          onUpdateRecord={handleUpdateRecord}
          assignments={assignments}
          onSaveAssignments={handleSaveAssignments}
          allPersonnel={initialPersonnel || []}
        />

        {/* ── FILTERS ────────────────────────────────────────────── */}
        <div className="mb-4 flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? "text-slate-600 font-bold" : isNeutral ? "text-neutral-400" : "text-slate-400"}`} />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Tìm kiếm dự án, khách hàng, hợp đồng..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm font-medium focus:outline-none transition ${
                isLight
                  ? "bg-white border-slate-300 text-slate-950 placeholder-slate-500 focus:border-blue-500 shadow-2xs font-semibold"
                  : isNeutral
                  ? "bg-[#20222a] border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-amber-500 shadow-md"
                  : "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400"
              }`}
            />
          </div>

          {/* Client filter */}
          <select
            value={filterClient}
            onChange={e => { setFilterClient(e.target.value); setPage(1) }}
            className={`rounded-xl border text-sm px-3 py-2.5 focus:outline-none transition font-semibold ${
              isLight
                ? "bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-2xs font-bold"
                : isNeutral
                ? "bg-[#20222a] border-neutral-700 text-neutral-100 focus:border-amber-500 shadow-md"
                : "bg-slate-800 border-slate-700 text-white focus:border-cyan-400"
            }`}
          >
            <option value="">Tất cả Client</option>
            {allClients.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Location filter */}
          <select
            value={filterLocation}
            onChange={e => { setFilterLocation(e.target.value); setPage(1) }}
            className={`rounded-xl border text-sm px-3 py-2.5 focus:outline-none transition font-semibold ${
              isLight
                ? "bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-2xs font-bold"
                : isNeutral
                ? "bg-[#20222a] border-neutral-700 text-neutral-100 focus:border-amber-500 shadow-md"
                : "bg-slate-800 border-slate-700 text-white focus:border-cyan-400"
            }`}
          >
            <option value="">Tất cả Location</option>
            {allLocations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          {/* ROV Multi-Select Filter with 4 Pinned ROVs */}
          <div className="relative" ref={rovDropdownRef}>
            <button
              type="button"
              onClick={() => setIsROVDropdownOpen(prev => !prev)}
              className={`flex items-center justify-between gap-2.5 rounded-xl border text-sm px-3 py-2.5 min-w-[200px] transition select-none ${
                filterROVs.length > 0
                  ? isLight
                    ? "bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-xs"
                    : isNeutral
                    ? "bg-[#2a2e3a] border-amber-500 text-amber-200 shadow-md"
                    : "bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-md shadow-cyan-950/50"
                  : isLight
                  ? "bg-white border-slate-300 text-slate-950 font-bold hover:border-slate-400 hover:text-black shadow-2xs"
                  : isNeutral
                  ? "bg-[#20222a] border-neutral-700 text-neutral-200 hover:border-neutral-600 hover:text-white shadow-md"
                  : "bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Cpu className={`w-4 h-4 flex-shrink-0 ${filterROVs.length > 0 ? (isLight ? "text-blue-600" : isNeutral ? "text-amber-400" : "text-cyan-400") : "text-slate-400"}`} />
                <span className="truncate">
                  {filterROVs.length === 0
                    ? "Tất cả ROV"
                    : filterROVs.length === 1
                    ? filterROVs[0]
                    : `ROV (${filterROVs.length} đã chọn)`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {filterROVs.length > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setFilterROVs([])
                      setPage(1)
                    }}
                    className={`p-0.5 rounded-full transition ${isLight ? "hover:bg-blue-200 text-blue-600" : isNeutral ? "hover:bg-neutral-700 text-amber-400" : "hover:bg-cyan-900/80 text-cyan-400 hover:text-white"}`}
                    title="Bỏ chọn tất cả"
                  >
                    <X className="w-3.5 h-3.5" />
                  </span>
                )}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isROVDropdownOpen ? `rotate-180 ${isLight ? "text-blue-600" : isNeutral ? "text-amber-400" : "text-cyan-400"}` : "text-slate-400"}`} />
              </div>
            </button>

            {/* Dropdown Popover */}
            {isROVDropdownOpen && (
              <div
                style={{
                  width: popoverSize.width,
                  height: popoverSize.height,
                  maxWidth: "calc(100vw - 32px)",
                  maxHeight: "calc(100vh - 90px)",
                }}
                className={`absolute left-0 top-full mt-2 z-[100] rounded-2xl shadow-2xl p-3 flex flex-col animate-in fade-in zoom-in-95 ${
                  isLight
                    ? "bg-white border border-slate-300 text-slate-800"
                    : isNeutral
                    ? "bg-[#20222a] border border-neutral-700 text-neutral-200"
                    : "bg-slate-900/95 backdrop-blur-xl border border-slate-700 text-slate-200"
                } ${isDraggingSize ? "" : "transition-[width,height] duration-200 ease-out"}`}
              >
                {/* Search inside ROVs */}
                <div className="relative mb-2.5 flex-shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={rovSearchQuery}
                    onChange={(e) => setRovSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm thiết bị ROV..."
                    className={`w-full pl-8 pr-7 py-1.5 rounded-lg text-xs focus:outline-none ${
                      isLight
                        ? "bg-slate-100 border border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500"
                        : isNeutral
                        ? "bg-[#2a2e3a] border border-neutral-700 text-white placeholder-neutral-500 focus:border-amber-500"
                        : "bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400"
                    }`}
                  />
                  {rovSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRovSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2.5 px-1 text-[11px] flex-shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterROVs(core4ROVs)
                        setPage(1)
                      }}
                      className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center gap-1 font-medium"
                      title="Chọn 4 ROV chủ lực (Quasar MKII-30, Compact 07, 954, 911)"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" /> 4 ROV chính
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterROVs(pinnedROVs)
                        setPage(1)
                      }}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition flex items-center gap-1 font-medium"
                      title="Chọn tất cả ROV chính và các thiết bị kèm theo (Diving, Triton...)"
                    >
                      <Cpu className="w-3 h-3 text-cyan-400" /> Kèm thiết bị ({pinnedROVs.length})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFilterROVs([...allROVs])
                        setPage(1)
                      }}
                      className="text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                      Tất cả
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFilterROVs([])
                        setPage(1)
                      }}
                      className="text-slate-400 hover:text-red-400 font-medium"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                {/* Scrollable List with Checkboxes (stretches with window height) */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1 text-xs select-none custom-scrollbar">
                  {/* 1) PINNED ROVS: 4 Core ROVs + Attached Equipment Systems */}
                  {filteredPinnedROVs.length > 0 && (
                    <div className="mb-2">
                      <div className="px-2 py-1 text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> ROV Chính & Thiết bị kèm theo ({filteredPinnedROVs.length})
                        </span>
                        <span className="text-amber-500/70 font-normal">PTSC G&S</span>
                      </div>
                      <div className="space-y-1 mt-1">
                        {filteredPinnedROVs.map(r => {
                          const isChecked = filterROVs.includes(r)
                          const isCore = core4ROVs.includes(r)
                          return (
                            <label
                              key={r}
                              className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer border transition ${
                                isChecked
                                  ? isCore
                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                                    : "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                                  : isCore
                                  ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700/60 text-slate-200 hover:border-slate-600"
                                  : "bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/40 text-slate-300 hover:border-slate-600"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleROV(r)}
                                  className={`w-4 h-4 rounded border-slate-600 bg-slate-900 cursor-pointer ${
                                    isCore ? "text-amber-500 focus:ring-amber-400" : "text-cyan-500 focus:ring-cyan-400"
                                  }`}
                                />
                                <span className={`truncate text-xs ${isCore ? "font-semibold text-white" : "text-slate-200"}`}>
                                  {r}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {isCore ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                                    Chủ lực
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium">
                                    + Thiết bị kèm
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-900/80 text-slate-400 border border-slate-700 min-w-[24px] text-center">
                                  {rovCounts[r] || 0}
                                </span>
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Divider */}
                  {filteredOtherROVs.length > 0 && filteredPinnedROVs.length > 0 && (
                    <div className="border-t border-slate-800 my-2" />
                  )}

                  {/* 2) OTHER ROVS */}
                  {filteredOtherROVs.length > 0 && (
                    <div>
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Các thiết bị khác</span>
                        <span className="text-slate-500 font-normal">{filteredOtherROVs.length}</span>
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {filteredOtherROVs.map(r => {
                          const isChecked = filterROVs.includes(r)
                          return (
                            <label
                              key={r}
                              className={`flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                                isChecked
                                  ? "bg-cyan-950/50 text-cyan-200"
                                  : "hover:bg-slate-800/60 text-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleROV(r)}
                                  className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-400 cursor-pointer"
                                />
                                <span className="truncate text-xs">{r}</span>
                              </div>
                              <span className="text-[10px] text-slate-500 flex-shrink-0">
                                {rovCounts[r] || 0}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {filteredPinnedROVs.length === 0 && filteredOtherROVs.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-500">
                      Không tìm thấy thiết bị nào
                    </div>
                  )}
                </div>

                {/* Footer summary & Resize controls inside dropdown */}
                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 px-1 relative select-none flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span>Đang chọn: <b className="text-cyan-400">{filterROVs.length}</b>/{allROVs.length}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Nút Kéo to / Thu nhỏ cửa sổ ở góc bên dưới */}
                    <button
                      type="button"
                      onClick={toggleExpandPopover}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500/50 transition text-[11px] font-medium"
                      title={isExpanded ? "Thu nhỏ cửa sổ về kích thước ban đầu" : "Kéo to cửa sổ để xem rộng và nhiều thiết bị hơn"}
                    >
                      {isExpanded ? (
                        <>
                          <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Thu nhỏ</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Kéo to</span>
                        </>
                      )}
                    </button>

                    {/* Nút Đóng */}
                    <button
                      type="button"
                      onClick={() => setIsROVDropdownOpen(false)}
                      className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition"
                    >
                      Đóng
                    </button>

                    {/* Nút kéo tự do bằng chuột/cảm ứng ở góc dưới cùng bên phải */}
                    <div
                      onMouseDown={handleResizeMouseDown}
                      onTouchStart={handleResizeTouchStart}
                      className="cursor-nwse-resize p-1 -mr-1 -mb-1 text-slate-500 hover:text-cyan-400 active:text-cyan-300 transition select-none flex items-end justify-end group touch-none"
                      title="Kéo chuột hoặc ngón tay vào góc này để tự do thay đổi kích thước cửa sổ"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 15L15 21M21 9L9 21" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Year filter */}
          <select
            value={filterYear}
            onChange={e => { setFilterYear(e.target.value); setPage(1) }}
            className={`rounded-xl border text-sm px-3 py-2.5 focus:outline-none transition font-semibold ${
              isLight
                ? "bg-white border-slate-300 text-slate-950 focus:border-blue-500 shadow-2xs font-bold"
                : isNeutral
                ? "bg-[#20222a] border-neutral-700 text-neutral-100 focus:border-amber-500 shadow-md"
                : "bg-slate-800 border-slate-700 text-white focus:border-cyan-400"
            }`}
          >
            <option value="">Tất cả năm</option>
            {allYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Clear filters */}
          {(search || filterClient || filterLocation || filterROVs.length > 0 || filterYear) && (
            <button
              onClick={() => { setSearch(""); setFilterClient(""); setFilterLocation(""); setFilterROVs([]); setFilterYear(""); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-bold transition ${
                isLight
                  ? "border-red-400 text-red-700 bg-red-50 hover:bg-red-100 shadow-2xs"
                  : isNeutral
                  ? "border-red-800/80 text-red-300 bg-red-950/30 hover:bg-red-900/40"
                  : "border-red-700/60 text-red-400 hover:bg-red-900/30"
              }`}
            >
              <X className="w-3.5 h-3.5" /> Xóa filter
            </button>
          )}
        </div>

        {/* Bulk actions */}
        {selected.size > 0 && isAdmin && (
          <div className="mb-3 flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-900/30 border border-amber-600/40">
            <span className="text-sm text-amber-300">Đã chọn {selected.size} dự án</span>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs hover:bg-red-500 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-white">
              Bỏ chọn
            </button>
          </div>
        )}

        {/* ── TABLE ─────────────────────────────────────────────── */}
        <div className={`rounded-2xl border overflow-hidden transition-colors ${
          isLight
            ? "bg-white border-slate-200 shadow-sm"
            : isNeutral
            ? "bg-[#1e222a] border-neutral-700 shadow-xl"
            : "bg-slate-900/60 border-slate-800 shadow-2xl"
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className={`border-b transition-colors ${
                isLight
                  ? "bg-slate-100/90 border-slate-200 text-slate-700"
                  : isNeutral
                  ? "bg-[#252a35] border-neutral-700 text-neutral-300"
                  : "bg-slate-900/80 border-slate-800 text-slate-400 backdrop-blur"
              }`}>
                <tr>
                  {isAdmin && (
                    <th className="px-3 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={selected.size === paginated.length && paginated.length > 0}
                        onChange={toggleAll}
                        className={`rounded cursor-pointer ${
                          isLight
                            ? "border-slate-300 bg-white text-blue-600 focus:ring-blue-500"
                            : "border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                        }`}
                      />
                    </th>
                  )}
                  <th className={thClass} onClick={() => handleSort("no")}>
                    <div className="flex items-center gap-1">No <SortIcon col="no" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("client")}>
                    <div className="flex items-center gap-1">Client <SortIcon col="client" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("project_task")}>
                    <div className="flex items-center gap-1">Project Task <SortIcon col="project_task" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("location")}>
                    <div className="flex items-center gap-1">Location <SortIcon col="location" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("start_date")}>
                    <div className="flex items-center gap-1">Dates <SortIcon col="start_date" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("duration_days")}>
                    <div className="flex items-center gap-1">Days <SortIcon col="duration_days" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("rov_system")}>
                    <div className="flex items-center gap-1">ROV System <SortIcon col="rov_system" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("vessel_rig")}>
                    <div className="flex items-center gap-1">Vessel/Rig <SortIcon col="vessel_rig" /></div>
                  </th>
                  <th className={thClass} onClick={() => handleSort("total_project_cost_usd")}>
                    <div className="flex items-center gap-1">
                      <span>Cost</span>
                      {!effectiveRevenueUnlocked && (
                        <Lock className="w-3 h-3 text-amber-400" />
                      )}
                      <SortIcon col="total_project_cost_usd" />
                    </div>
                  </th>
                  <th className={`px-3 py-2.5 text-center text-[11px] uppercase tracking-wider ${
                    isLight ? "text-slate-950 font-black" : isNeutral ? "text-neutral-400 font-semibold" : "text-slate-400 font-semibold"
                  }`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 11 : 10} className="py-16 text-center">
                      <div className={`flex flex-col items-center gap-3 ${isLight ? "text-slate-500 font-semibold" : "text-slate-500"}`}>
                        <BarChart3 className="w-10 h-10 opacity-30" />
                        <p className={`text-sm ${isLight ? "text-slate-900 font-bold" : "text-slate-400"}`}>Chưa có dữ liệu Track Record</p>
                        {isAdmin && (
                          <button onClick={() => setEditRecord("new")} className={`text-xs font-bold hover:underline ${isLight ? "text-blue-700" : "text-cyan-400"}`}>
                            + Thêm dự án đầu tiên
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                paginated.map((r, idx) => {
                  const recInterruptions = getInterruptionsForRecord(interruptionsMap, r)
                  const durStatus = getRecordDurationStatus(r, undefined, recInterruptions)

                  return (
                    <tr
                      key={r.id}
                      className={`border-t transition group ${
                        durStatus.isOngoing
                          ? isLight
                            ? "border-amber-300 bg-amber-100/90 hover:bg-amber-200/95 border-l-4 border-l-amber-500 shadow-2xs"
                            : isNeutral
                            ? "border-amber-700/60 bg-[#3a3014]/90 hover:bg-[#4a3d19] border-l-4 border-l-amber-400 shadow-md"
                            : "border-amber-600/40 bg-amber-950/45 hover:bg-amber-950/70 border-l-4 border-l-amber-400 shadow-md"
                          : isLight
                          ? `border-slate-200 hover:bg-blue-50/70 ${idx % 2 === 0 ? "bg-slate-50/60" : "bg-white"}`
                          : isNeutral
                          ? `border-neutral-800/80 hover:bg-[#282d38] ${idx % 2 === 0 ? "bg-[#1b1e26]/60" : "bg-transparent"}`
                          : `border-slate-800/60 hover:bg-slate-800/40 ${idx % 2 === 0 ? "bg-slate-900/20" : "bg-transparent"}`
                      }`}
                    >
                      {isAdmin && (
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(r.id)}
                            onChange={() => toggleOne(r.id)}
                            className={`rounded cursor-pointer ${
                              isLight
                                ? "border-slate-400 bg-white text-blue-600 focus:ring-blue-500"
                                : "border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-400"
                            }`}
                          />
                        </td>
                      )}
                      <td className={tdClass}>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                          isLight
                            ? durStatus.isOngoing
                              ? "bg-amber-200 text-amber-950 border border-amber-400"
                              : "bg-slate-200/90 text-slate-950 border border-slate-300"
                            : isNeutral
                            ? "bg-neutral-800 text-neutral-300 border border-neutral-700"
                            : "bg-slate-800 text-cyan-300"
                        }`}>
                          {r.no ?? "—"}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <span className={`font-bold ${isLight ? "text-slate-950 font-black" : "text-white"}`}>{r.client ?? "—"}</span>
                        {r.contract && <p className={`text-[11px] mt-0.5 truncate max-w-[160px] ${isLight ? "text-slate-700 font-bold" : "text-slate-500"}`}>{r.contract}</p>}
                      </td>
                      <td className={`${tdClass} max-w-[250px]`}>
                        <p className={`line-clamp-2 text-sm leading-snug ${isLight ? "text-slate-950 font-semibold" : "text-slate-200"}`}>{r.project_task ?? "—"}</p>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1">
                          <MapPin className={`w-3 h-3 flex-shrink-0 ${isLight ? "text-slate-600" : "text-slate-500"}`} />
                          <span className={`truncate max-w-[120px] ${isLight ? "text-slate-950 font-semibold" : "text-slate-200"}`}>{r.location ?? "—"}</span>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <p className={`text-[12px] ${isLight ? "text-slate-950 font-black" : "text-slate-300"}`}>{fmtDate(r.start_date)}</p>
                        {durStatus.isOngoing ? (
                          <div className="mt-1 flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black border ${
                              isLight
                                ? "bg-amber-200 text-amber-950 border-amber-400"
                                : isNeutral
                                ? "bg-amber-950/60 text-amber-300 border-amber-600/60"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Chưa kết thúc
                            </span>
                          </div>
                        ) : durStatus.isFutureEnd ? (
                          <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                            <span className={`text-[11px] font-bold ${isLight ? "text-slate-900" : "text-slate-400"}`}>→ {fmtDate(r.end_date)}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-black border ${
                              isLight
                                ? "bg-purple-100 text-purple-950 border-purple-300"
                                : isNeutral
                                ? "bg-purple-950/60 text-purple-300 border-purple-800/60"
                                : "bg-purple-950/60 text-purple-300 border-purple-600/50"
                            }`}>
                              Dự kiến
                            </span>
                          </div>
                        ) : (
                          r.end_date && <p className={`text-[11px] ${isLight ? "text-slate-700 font-bold" : "text-slate-500"}`}>→ {fmtDate(r.end_date)}</p>
                        )}
                      </td>
                      <td className={tdClass}>
                        {durStatus.isOngoing ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${
                                isLight
                                  ? "bg-amber-200 text-amber-950 border-amber-400"
                                  : isNeutral
                                  ? "bg-amber-900/60 text-amber-200 border-amber-600/60"
                                  : "bg-amber-500/25 text-amber-300 border-amber-500/40"
                              }`}>
                                {durStatus.effectiveDays}d
                              </span>
                              {durStatus.pauseDays > 0 && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-500/25 text-red-300 border border-red-500/40"
                                  title={`Tổng raw: ${durStatus.rawDays}d - Tạm ngưng ${durStatus.pauseDays}d = ${durStatus.effectiveDays}d thực tế`}
                                >
                                  -{durStatus.pauseDays}d
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-black ${isLight ? "text-amber-950" : "text-amber-400"}`}>
                                (tới nay)
                              </span>
                              <button
                                type="button"
                                onClick={() => setInterruptionModalRecord(r)}
                                className={`text-[10px] font-bold underline cursor-pointer transition ${
                                  durStatus.pauseDays > 0
                                    ? "text-amber-400 hover:text-amber-300"
                                    : "text-slate-400 hover:text-cyan-400 opacity-70 group-hover:opacity-100"
                                }`}
                                title="Bấm để xem/quản lý các đợt tạm ngưng của dự án này"
                              >
                                {durStatus.pauseDays > 0 ? `⏸️ ${durStatus.interruptionCount} đợt nghỉ` : "+ Đợt nghỉ"}
                              </button>
                            </div>
                          </div>
                        ) : durStatus.isFutureEnd ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${
                                isLight
                                  ? "bg-purple-100 text-purple-950 border-purple-300"
                                  : isNeutral
                                  ? "bg-purple-950/50 text-purple-200 border-purple-800/50"
                                  : "bg-purple-900/40 text-purple-300 border-purple-700/50"
                              }`}>
                                {durStatus.effectiveDays}d
                              </span>
                              {durStatus.pauseDays > 0 && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-500/25 text-red-300 border border-red-500/40"
                                  title={`Tổng raw: ${durStatus.rawDays}d - Tạm ngưng ${durStatus.pauseDays}d = ${durStatus.effectiveDays}d thực tế`}
                                >
                                  -{durStatus.pauseDays}d
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[9px] font-black ${isLight ? "text-purple-950" : "text-purple-300"}`}>
                                (Dự kiến)
                              </span>
                              <button
                                type="button"
                                onClick={() => setInterruptionModalRecord(r)}
                                className={`text-[10px] font-bold underline cursor-pointer transition ${
                                  durStatus.pauseDays > 0
                                    ? "text-amber-400 hover:text-amber-300"
                                    : "text-slate-400 hover:text-cyan-400 opacity-70 group-hover:opacity-100"
                                }`}
                                title="Bấm để xem/quản lý các đợt tạm ngưng của dự án này"
                              >
                                {durStatus.pauseDays > 0 ? `⏸️ ${durStatus.interruptionCount} đợt nghỉ` : "+ Đợt nghỉ"}
                              </button>
                            </div>
                          </div>
                        ) : durStatus.effectiveDays != null ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                isLight
                                  ? "bg-blue-100 text-blue-950 border-blue-300"
                                  : isNeutral
                                  ? "bg-blue-950/40 text-blue-300 border-blue-800/50"
                                  : "bg-blue-900/40 text-blue-300 border-blue-700/40"
                              }`}>
                                {durStatus.effectiveDays}d
                              </span>
                              {durStatus.pauseDays > 0 && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[10px] font-black bg-red-500/25 text-red-300 border border-red-500/40"
                                  title={`Tổng raw: ${durStatus.rawDays}d - Tạm ngưng ${durStatus.pauseDays}d = ${durStatus.effectiveDays}d thực tế`}
                                >
                                  -{durStatus.pauseDays}d
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setInterruptionModalRecord(r)}
                              className={`text-[10px] font-bold underline cursor-pointer transition ${
                                durStatus.pauseDays > 0
                                  ? "text-amber-400 hover:text-amber-300"
                                  : "text-slate-400 hover:text-cyan-400 opacity-60 group-hover:opacity-100"
                              }`}
                              title="Bấm để xem/quản lý các đợt tạm ngưng của dự án này"
                            >
                              {durStatus.pauseDays > 0 ? `⏸️ ${durStatus.interruptionCount} đợt nghỉ` : "+ Đợt nghỉ"}
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1">
                          <Cpu className={`w-3 h-3 flex-shrink-0 ${isLight ? "text-slate-600" : "text-slate-500"}`} />
                          <span className={`truncate max-w-[120px] text-[12px] ${isLight ? "text-slate-950 font-semibold" : "text-slate-200"}`}>{r.rov_system ?? "—"}</span>
                        </div>
                      </td>
                      <td className={tdClass}>
                        <div className="flex items-center gap-1">
                          <Ship className={`w-3 h-3 flex-shrink-0 ${isLight ? "text-slate-600" : "text-slate-500"}`} />
                          <span className={`truncate max-w-[120px] text-[12px] ${isLight ? "text-slate-950 font-semibold" : "text-slate-200"}`}>{r.vessel_rig ?? "—"}</span>
                        </div>
                      </td>
                      <td className={tdClass}>
                        {effectiveRevenueUnlocked ? (
                          <span className={`text-[12px] font-mono font-black ${
                            isLight
                              ? "text-emerald-800"
                              : isNeutral
                              ? "text-emerald-400"
                              : "text-emerald-300"
                          }`}>
                            {fmtUSD(r.total_project_cost_usd)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowRevenueModal(true)}
                            className="inline-flex items-center gap-1 font-mono text-[12px] text-slate-400 hover:text-amber-400 hover:underline cursor-pointer group/cost"
                            title="Doanh thu được bảo mật. Bấm để nhập mật khẩu mở khóa"
                          >
                            <span>••••••••</span>
                            <Lock className="w-2.5 h-2.5 opacity-60 group-hover/cost:opacity-100 text-amber-400" />
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className={`flex items-center justify-center gap-1 transition ${
                          recInterruptions.length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}>
                          <button
                            onClick={() => setViewRecord(r)}
                            title="Xem chi tiết"
                            className={`p-1.5 rounded-lg transition ${
                              isLight
                                ? "text-slate-800 hover:text-blue-800 hover:bg-slate-200 font-bold"
                                : "text-slate-400 hover:text-cyan-300 hover:bg-slate-700"
                            }`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setInterruptionModalRecord(r)}
                            title={recInterruptions.length > 0 ? `Quản lý ${recInterruptions.length} đợt tạm ngưng (đã trừ ${durStatus.pauseDays} ngày)` : "Quản lý / thêm đợt tạm ngưng cho dự án"}
                            className={`p-1.5 rounded-lg transition ${
                              recInterruptions.length > 0
                                ? "text-amber-400 hover:text-amber-300 bg-amber-500/15 border border-amber-500/40"
                                : isLight
                                ? "text-slate-800 hover:text-amber-800 hover:bg-slate-200 font-bold"
                                : "text-slate-400 hover:text-amber-300 hover:bg-slate-700"
                            }`}
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setEditRecord(r)}
                                title="Chỉnh sửa"
                                className={`p-1.5 rounded-lg transition ${
                                  isLight
                                    ? "text-slate-800 hover:text-amber-800 hover:bg-slate-200 font-bold"
                                    : "text-slate-400 hover:text-amber-300 hover:bg-slate-700"
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(r.id)}
                                title="Xóa"
                                className={`p-1.5 rounded-lg transition ${
                                  isLight
                                    ? "text-slate-800 hover:text-red-700 hover:bg-slate-200 font-bold"
                                    : "text-slate-400 hover:text-red-400 hover:bg-slate-700"
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            </table>
          </div>

          {/* ── PAGINATION ────────────────────────────────────────── */}
          <div className={`flex items-center justify-between px-4 py-3 border-t transition-colors ${
            isLight
              ? "bg-slate-100/95 border-slate-200 text-slate-900"
              : isNeutral
              ? "bg-[#232732] border-neutral-700 text-neutral-300"
              : "bg-slate-900/60 border-slate-800 text-slate-400"
          }`}>
            <div className="flex items-center gap-3 text-xs">
              <span className={isLight ? "text-slate-950 font-bold" : "text-slate-400"}>
                Hiển thị {Math.min((page - 1) * pageSize + 1, sorted.length)}–{Math.min(page * pageSize, sorted.length)} / {sorted.length}
              </span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className={`rounded-lg px-2 py-1 text-xs border focus:outline-none font-semibold ${
                  isLight
                    ? "bg-white border-slate-300 text-slate-950 font-bold shadow-2xs"
                    : isNeutral
                    ? "bg-[#1e222a] border-neutral-700 text-neutral-200"
                    : "bg-slate-800 border-slate-700 text-slate-300"
                }`}
              >
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / trang</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition ${
                  isLight
                    ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                    : isNeutral
                    ? "text-neutral-400 hover:text-white hover:bg-neutral-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <ChevronLeft className="w-4 h-4" /><ChevronLeft className="w-4 h-4 -ml-2.5" />
              </button>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition ${
                  isLight
                    ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                    : isNeutral
                    ? "text-neutral-400 hover:text-white hover:bg-neutral-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className={`px-3 text-xs font-black ${isLight ? "text-slate-950 font-black" : isNeutral ? "text-neutral-200" : "text-slate-300"}`}>
                {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition ${
                  isLight
                    ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                    : isNeutral
                    ? "text-neutral-400 hover:text-white hover:bg-neutral-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className={`p-1.5 rounded-lg disabled:opacity-30 transition ${
                  isLight
                    ? "text-slate-800 hover:text-slate-950 hover:bg-slate-200"
                    : isNeutral
                    ? "text-neutral-400 hover:text-white hover:bg-neutral-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <ChevronRight className="w-4 h-4" /><ChevronRight className="w-4 h-4 -ml-2.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 04 ROV BOTTOM FLEET LIVE STATUS DOCK ────────────────── */}
      <div className="fixed bottom-3 inset-x-0 z-40 flex flex-col items-center pointer-events-none px-3">
        {isFleetDockMinimized ? (
          <button
            type="button"
            onClick={() => setIsFleetDockMinimized(false)}
            className={`pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs shadow-xl transition active:scale-95 group ${
              isLight
                ? "bg-white/95 border-slate-300 text-slate-800 hover:bg-slate-100 shadow-md"
                : isNeutral
                ? "bg-[#1e222a]/95 border-neutral-700 text-neutral-200 hover:bg-[#252a35] shadow-xl"
                : "bg-slate-900/90 backdrop-blur-md border-cyan-500/40 text-cyan-300 hover:bg-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="font-semibold">04 ROV Chủ lực</span>
            <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition" />
          </button>
        ) : (
          <div className={`pointer-events-auto backdrop-blur-2xl border rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-full transition-colors ${
            isLight
              ? "bg-white/95 border-slate-300 shadow-[0_-4px_30px_rgba(0,0,0,0.12)] text-slate-900"
              : isNeutral
              ? "bg-[#1e222a]/95 border-neutral-700/80 shadow-[0_-4px_35px_rgba(0,0,0,0.6)] text-neutral-100"
              : "bg-slate-950/95 border-slate-700/80 shadow-[0_-4px_35px_rgba(0,0,0,0.7)] text-white"
          }`}>
            {/* Dock Header & Date Selector */}
            <div className={`flex items-center gap-2 pr-2 border-r ${isLight ? "border-slate-200" : isNeutral ? "border-neutral-700" : "border-slate-800"}`}>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className={`text-[11px] font-bold uppercase tracking-wider hidden sm:inline ${isLight ? "text-slate-700 font-extrabold" : "text-slate-300"}`}>
                  Fleet Status
                </span>
              </div>

              {/* Date controller to test any date */}
              <div className={`flex items-center gap-1.5 border rounded-lg px-2 py-1 ${
                isLight
                  ? "bg-slate-100 border-slate-300 text-slate-800"
                  : isNeutral
                  ? "bg-[#252834] border-neutral-700 text-white"
                  : "bg-slate-900 border-slate-800 text-white"
              }`}>
                <Calendar className={`w-3 h-3 ${isLight ? "text-blue-600" : isNeutral ? "text-amber-400" : "text-cyan-400"}`} />
                <input
                  type="date"
                  value={statusDate}
                  onChange={e => e.target.value && setStatusDate(e.target.value)}
                  className={`bg-transparent text-[11px] focus:outline-none cursor-pointer ${isLight ? "text-slate-900 font-semibold" : "text-white"}`}
                  title="Chọn ngày bất kỳ để kiểm tra trạng thái hoạt động của 4 ROV"
                />
                {statusDate !== getTodayStr() && (
                  <button
                    type="button"
                    onClick={() => setStatusDate(getTodayStr())}
                    className={`text-[10px] font-semibold underline pl-1 ${isLight ? "text-blue-600 hover:text-blue-800" : "text-cyan-400 hover:text-cyan-300"}`}
                    title="Về ngày hôm nay"
                  >
                    Hôm nay
                  </button>
                )}
              </div>
            </div>

            {/* 04 ROV Cards */}
            <div className="flex items-center gap-2">
              {fleetStatusList.map(item => {
                const isHovered = hoveredFleetROV === item.id

                return (
                  <div
                    key={item.id}
                    className="relative"
                    onMouseEnter={() => setHoveredFleetROV(item.id)}
                    onMouseLeave={() => setHoveredFleetROV(null)}
                  >
                    {/* The ROV Card Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setFilterROVs(prev => prev.includes(item.name) ? prev.filter(r => r !== item.name) : [item.name])
                        setPage(1)
                      }}
                      className={`relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all duration-300 select-none text-left ${
                        item.isActive
                          ? `bg-gradient-to-r ${item.theme.activeGradient} ${item.theme.activeBorder} text-white ${item.theme.activeShadow} active:scale-95`
                          : isLight
                          ? "bg-slate-100 border-slate-300 text-slate-600 opacity-75 hover:opacity-100 hover:border-slate-400 hover:text-slate-900"
                          : isNeutral
                          ? "bg-[#252834] border-neutral-700 text-neutral-400 opacity-60 hover:opacity-100 hover:border-neutral-600 hover:text-slate-200"
                          : `bg-slate-900/60 border-slate-800 text-slate-400 opacity-45 hover:opacity-90 ${item.theme.inactiveBorderHover} hover:text-slate-200`
                      }`}
                    >
                      {/* Active Status Pulse Indicator */}
                      <div className="flex-shrink-0">
                        {item.isActive ? (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${item.theme.pingDot} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${item.theme.solidDot}`}></span>
                          </span>
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-slate-500"></span>
                        )}
                      </div>

                      {/* Name & Subtitle */}
                      <div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[11px] sm:text-xs font-bold leading-tight ${item.isActive ? "text-white" : "text-slate-300"}`}>
                            {item.shortName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className={`text-[9px] sm:text-[10px] font-medium leading-none ${item.isActive ? `${item.theme.textAccent} font-semibold` : "text-slate-500"}`}>
                            {item.isActive ? "Đang làm việc" : "Tại xưởng"}
                          </span>
                          {item.isActive && item.currentProject?.client && (
                            <span className="text-[9px] text-slate-400 max-w-[70px] truncate hidden sm:inline">
                              · {item.currentProject.client}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Rich Hover Popup Modal */}
                    {isHovered && (
                      <div className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-80 sm:w-96 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 pointer-events-auto ${
                        isLight
                          ? "bg-white border border-slate-300 text-slate-800 shadow-2xl"
                          : isNeutral
                          ? "bg-[#20222a] border border-neutral-700 text-neutral-100 shadow-2xl"
                          : "bg-slate-900/95 backdrop-blur-2xl border border-slate-700 text-white"
                      }`}>
                        {/* Little triangle arrow at bottom */}
                        <div className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${
                          isLight
                            ? "bg-white border-r border-b border-slate-300"
                            : isNeutral
                            ? "bg-[#20222a] border-r border-b border-neutral-700"
                            : "bg-slate-900 border-r border-b border-slate-700"
                        }`} />

                        {item.isActive ? (
                          <div className="space-y-3">
                            {/* Header */}
                            <div className={`flex items-center justify-between pb-2 border-b ${isLight ? "border-slate-200" : isNeutral ? "border-neutral-700" : "border-slate-800"}`}>
                              <div>
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  Đang triển khai dự án
                                </span>
                                <h3 className={`text-sm font-bold mt-0.5 ${isLight ? "text-slate-900" : "text-white"}`}>{item.name}</h3>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 font-semibold flex items-center gap-1">
                                <Activity className="w-3 h-3 animate-pulse text-emerald-500" /> ON DUTY
                              </span>
                            </div>

                            {/* Current Active Project Info */}
                            {item.currentProject && (
                              <div className="space-y-2 text-xs">
                                <div>
                                  <p className={`text-[10px] uppercase font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>Khách hàng / Hợp đồng</p>
                                  <p className={`font-semibold ${isLight ? "text-slate-900" : "text-white"}`}>
                                    {item.currentProject.client}
                                    {item.currentProject.contract && (
                                      <span className={isLight ? "text-slate-500 font-normal" : "text-slate-400 font-normal"}> · {item.currentProject.contract}</span>
                                    )}
                                  </p>
                                </div>

                                <div>
                                  <p className={`text-[10px] uppercase font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>Công việc (Project Task)</p>
                                  <p className={`line-clamp-2 ${isLight ? "text-slate-700 font-medium" : "text-slate-200"}`}>{item.currentProject.project_task || "—"}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                                  <div>
                                    <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Thời gian triển khai</p>
                                    <p className={`font-medium ${isLight ? "text-emerald-700" : "text-emerald-300"}`}>
                                      {fmtDate(item.currentProject.start_date)} → {item.currentProject.end_date ? fmtDate(item.currentProject.end_date) : "Đang tiếp diễn"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className={`text-[10px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Địa điểm / Tàu giàn</p>
                                    <p className={`truncate ${isLight ? "text-slate-800 font-medium" : "text-slate-200"}`}>
                                      {item.currentProject.location || "—"} {item.currentProject.vessel_rig ? `(${item.currentProject.vessel_rig})` : ""}
                                    </p>
                                  </div>
                                </div>

                                {item.currentProject.rov_system && item.currentProject.rov_system !== item.name && (
                                  <div className={`p-2 rounded-xl text-[11px] ${
                                    isLight
                                      ? "bg-blue-50 border border-blue-200"
                                      : isNeutral
                                      ? "bg-[#282d38] border border-neutral-700"
                                      : "bg-cyan-950/50 border border-cyan-800/40"
                                  }`}>
                                    <span className={`text-[10px] font-bold uppercase block mb-0.5 ${isLight ? "text-blue-700" : "text-cyan-400"}`}>
                                      Cấu hình ROV & Thiết bị kèm theo:
                                    </span>
                                    <span className={`font-medium ${isLight ? "text-blue-900" : "text-cyan-200"}`}>{item.currentProject.rov_system}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Footer links */}
                            <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${isLight ? "border-slate-200" : isNeutral ? "border-neutral-700" : "border-slate-800"}`}>
                              <span className={isLight ? "text-slate-500" : "text-slate-400"}>
                                Tổng lịch sử: <b className={isLight ? "text-slate-900" : "text-white"}>{item.totalProjects}</b> dự án
                              </span>
                              <div className="flex items-center gap-3">
                                {item.currentProject && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setViewRecord(item.currentProject)
                                    }}
                                    className={`font-medium underline flex items-center gap-1 ${isLight ? "text-blue-600 hover:text-blue-800" : "text-cyan-400 hover:text-cyan-300"}`}
                                  >
                                    Xem chi tiết <Eye className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Header */}
                            <div className={`flex items-center justify-between pb-2 border-b ${isLight ? "border-slate-200" : isNeutral ? "border-neutral-700" : "border-slate-800"}`}>
                              <div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                                  Sẵn sàng tại xưởng
                                </span>
                                <h3 className={`text-sm font-bold mt-0.5 ${isLight ? "text-slate-900" : "text-white"}`}>{item.name}</h3>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${isLight ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                                STANDBY
                              </span>
                            </div>

                            <div className={`p-2.5 rounded-xl text-xs ${
                              isLight
                                ? "bg-slate-100 border border-slate-200 text-slate-700"
                                : isNeutral
                                ? "bg-[#282d38] border border-neutral-700 text-neutral-200"
                                : "bg-slate-800/50 border border-slate-700/50 text-slate-300"
                            }`}>
                              Không có lịch hoạt động vào ngày <b className={isLight ? "text-slate-900" : "text-white"}>{fmtDate(statusDate)}</b>. Thiết bị sẵn sàng phục vụ tại ROV Workshop PTSC G&S.
                            </div>

                            {item.latestProject && (
                              <div className="space-y-1.5 text-xs">
                                <p className={`text-[10px] uppercase font-medium ${isLight ? "text-slate-500" : "text-slate-400"}`}>Dự án gần nhất đã thực hiện</p>
                                <p className={`font-semibold ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                                  {item.latestProject.client} · <span className={`font-normal ${isLight ? "text-slate-600" : "text-slate-400"}`}>{item.latestProject.project_task?.slice(0, 50)}...</span>
                                </p>
                                <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  Thời gian: {fmtDate(item.latestProject.start_date)} → {item.latestProject.end_date ? fmtDate(item.latestProject.end_date) : "—"}
                                </p>
                              </div>
                            )}

                            <div className={`pt-2 border-t flex items-center justify-between text-[11px] ${isLight ? "border-slate-200" : isNeutral ? "border-neutral-700" : "border-slate-800"}`}>
                              <span className={isLight ? "text-slate-500" : "text-slate-400"}>
                                Tổng lịch sử: <b className={isLight ? "text-slate-900" : "text-white"}>{item.totalProjects}</b> dự án
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setFilterROVs([item.name])
                                  setPage(1)
                                }}
                                className={`font-medium underline ${isLight ? "text-blue-600 hover:text-blue-800" : "text-cyan-400 hover:text-cyan-300"}`}
                              >
                                Lọc dự án ROV này
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Minimize button */}
            <button
              type="button"
              onClick={() => setIsFleetDockMinimized(true)}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
              title="Thu nhỏ thanh trạng thái ROV"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── VIEW DETAIL MODAL ─────────────────────────────────── */}
      {viewRecord && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setViewRecord(null)} />
          <div className={`relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
            isLight
              ? "bg-white border border-slate-300"
              : isNeutral
              ? "bg-[#1e222a] border border-neutral-700"
              : "bg-slate-900 border border-slate-700"
          }`}>
            <div className={`sticky top-0 z-20 flex items-center justify-between px-6 py-4 border-b rounded-t-2xl ${
              isLight
                ? "bg-slate-100 border-slate-300"
                : isNeutral
                ? "bg-[#252a35] border-neutral-700"
                : "bg-gradient-to-r from-slate-900 to-blue-950 border-slate-700"
            }`}>
              <div>
                <h2 className={`font-bold ${isLight ? "text-slate-900" : "text-white"}`}>{viewRecord.client ?? "—"}</h2>
                <p className={`text-xs ${isLight ? "text-slate-500 font-medium" : "text-slate-400"}`}>{viewRecord.contract ?? ""}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button onClick={() => { setViewRecord(null); setEditRecord(viewRecord) }}
                    className="p-2 rounded-xl border border-amber-600/40 text-amber-400 hover:bg-amber-900/30 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setViewRecord(null)}
                  className={`p-2 rounded-xl transition ${
                    isLight ? "hover:bg-slate-200 text-slate-500 hover:text-slate-900" : "hover:bg-slate-700 text-slate-400 hover:text-white"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              {(() => {
                const viewInterruptions = getInterruptionsForRecord(interruptionsMap, viewRecord)
                const dur = getRecordDurationStatus(viewRecord, undefined, viewInterruptions)
                let endDisplay = fmtDate(viewRecord.end_date)
                if (dur.isOngoing) {
                  endDisplay = `Đang thực hiện (Chưa kết thúc)`
                } else if (dur.isFutureEnd) {
                  endDisplay = `${fmtDate(viewRecord.end_date)} (Dự kiến)`
                }

                let durDisplay = "—"
                if (dur.isOngoing) {
                  durDisplay = dur.pauseDays > 0
                    ? `${dur.effectiveDays} ngày thực tế (Tổng: ${dur.rawDays}d - Trừ ${dur.pauseDays}d nghỉ / ${dur.interruptionCount} đợt)`
                    : `${dur.effectiveDays} ngày (Đang thực hiện - tính đến ${dur.todayFormatted})`
                } else if (dur.isFutureEnd) {
                  durDisplay = dur.pauseDays > 0
                    ? `${dur.effectiveDays} ngày thực tế (Dự kiến tổng: ${dur.rawDays}d - Trừ ${dur.pauseDays}d nghỉ)`
                    : `${dur.effectiveDays} ngày (Dự kiến)`
                } else if (dur.effectiveDays != null) {
                  durDisplay = dur.pauseDays > 0
                    ? `${dur.effectiveDays} ngày thực tế (Tổng: ${dur.rawDays}d - Trừ ${dur.pauseDays}d nghỉ)`
                    : `${dur.effectiveDays} ngày`
                }

                const pauseSummary = viewInterruptions.length > 0
                  ? viewInterruptions.map((it, i) => `Đợt ${i + 1}: ${fmtDate(it.startDate)} → ${fmtDate(it.endDate)} (${it.days} ngày)${it.reason ? ` - ${it.reason}` : ""}`).join("; ")
                  : null

                return [
                  ["Project Task", viewRecord.project_task, 2],
                  ["No.", viewRecord.no, 1],
                  ["Class", viewRecord.class, 1],
                  ["Start Date", fmtDate(viewRecord.start_date), 1],
                  ["End Date", endDisplay, 1],
                  ["Duration", durDisplay, 1],
                  ["Giai đoạn tạm ngưng / nghỉ", pauseSummary || "Chạy liên tục (không có đợt tạm ngưng)", 2],
                  ["Location", viewRecord.location, 1],
                  ["ROV System", viewRecord.rov_system, 1],
                  ["Vessel / Rig", viewRecord.vessel_rig, 1],
                  ["Water Depth", fmtDepth(viewRecord.water_depth_min_msw, viewRecord.water_depth_max_msw), 1],
                  ["Cost (USD)", effectiveRevenueUnlocked ? fmtUSD(viewRecord.total_project_cost_usd) : "•••••••• (🔒 Cần mật khẩu)", 1],
                  ["Contact Person", viewRecord.client_contact_person, 1],
                  ["Contact Phone", viewRecord.client_contact_phone, 1],
                  ["Project SOW", viewRecord.project_sow, 2],
                  ["Notes", viewRecord.notes, 2],
                ]
              })().map(([label, value, span]) => (
                value ? (
                  <div key={label as string} className={span === 2 ? "col-span-2" : ""}>
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label as string}</p>
                    <p className={`text-sm ${isLight ? "text-slate-800 font-medium" : "text-slate-200"}`}>{value as string}</p>
                  </div>
                ) : null
              ))}
            </div>

            <div className={`px-6 py-4 border-t flex items-center justify-between flex-wrap gap-2 ${
              isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"
            }`}>
              <span className="text-xs text-slate-400">
                {getInterruptionsForRecord(interruptionsMap, viewRecord).length > 0
                  ? `Đã cấu hình ${getInterruptionsForRecord(interruptionsMap, viewRecord).length} đợt tạm ngưng.`
                  : "Có thể bổ sung các đợt tạm ngưng (chờ thời tiết, bảo dưỡng, nghỉ giữa phase...)."}
              </span>
              <Button
                size="sm"
                onClick={() => setInterruptionModalRecord(viewRecord)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow"
              >
                <PauseCircle className="w-3.5 h-3.5 mr-1" /> Quản lý đợt tạm ngưng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ────────────────────────────────────────── */}
      {editRecord !== null && (
        <RecordFormModal
          record={editRecord === "new" ? null : editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={handleSaved}
          isAdmin={isAdmin}
        />
      )}

      {/* ── STATS DETAIL MODAL ─────────────────────────────────── */}
      <StatsDetailModal
        type={activeStatsModal}
        onClose={() => setActiveStatsModal(null)}
        records={filtered}
        theme={theme}
        interruptionsMap={interruptionsMap}
        isRevenueUnlocked={effectiveRevenueUnlocked}
        onUnlockRevenue={() => {
          setIsRevenueUnlocked(true)
          setSavedRevenueUnlocked(true)
        }}
        onRequireRevenueUnlock={() => setShowRevenueModal(true)}
      />

      {/* ── MODAL NHẬP MẬT KHẨU MỞ KHÓA DOANH THU ─────────────────── */}
      {showRevenueModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
          <div className={`w-full max-w-sm rounded-2xl p-6 shadow-2xl border text-center relative ${
            isLight
              ? "bg-white border-slate-300 text-slate-900 shadow-2xl"
              : isNeutral
              ? "bg-[#1e222a] border-neutral-700 text-neutral-100 shadow-2xl"
              : "bg-slate-900 border-slate-700 text-white shadow-2xl"
          }`}>
            <button
              type="button"
              onClick={() => { setShowRevenueModal(false); setRevenuePwd(""); setRevenueError("") }}
              className={`absolute top-4 right-4 p-1.5 rounded-lg transition cursor-pointer ${
                isLight ? "text-slate-500 hover:text-slate-800 hover:bg-slate-100" : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-md shadow-amber-950/20">
              <Lock className="w-7 h-7" />
            </div>

            <h3 className="text-base font-bold">Xác thực Quyền xem Doanh thu</h3>
            <p className={`text-xs mt-1.5 leading-relaxed ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>
              Số liệu Doanh thu được phân quyền bảo mật nội bộ. Dùng chung một mật khẩu Admin hoặc mật khẩu phân quyền để mở khóa toàn bộ nội dung doanh thu.
            </p>

            <form onSubmit={handleUnlockRevenueSubmit} className="mt-5 space-y-3">
              <input
                type="password"
                value={revenuePwd}
                onChange={(e) => {
                  setRevenuePwd(e.target.value)
                  setRevenueError("")
                }}
                placeholder="Nhập mật khẩu (Admin / Phân quyền)..."
                autoFocus
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none transition font-medium ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white"
                    : isNeutral
                    ? "bg-[#282d38] border-neutral-600 text-white placeholder-neutral-500 focus:border-amber-400"
                    : "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400"
                }`}
              />

              {revenueError && (
                <p className="text-xs text-rose-500 font-bold">{revenueError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowRevenueModal(false); setRevenuePwd(""); setRevenueError("") }}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Mở khóa Doanh thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PROJECT INTERRUPTION MODAL ──────────────────────────── */}
      {interruptionModalRecord && (
        <ProjectInterruptionModal
          isOpen={!!interruptionModalRecord}
          onClose={() => setInterruptionModalRecord(null)}
          record={interruptionModalRecord}
          initialInterruptions={getInterruptionsForRecord(interruptionsMap, interruptionModalRecord)}
          onSave={handleSaveInterruptions}
          theme={theme}
        />
      )}
    </div>
  )
}
