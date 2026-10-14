"use client"

import React, { useState, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart,
} from "recharts"
import {
  TrendingUp, TrendingDown, Calendar, BarChart3, LineChart as LineChartIcon,
  Table as TableIcon, ArrowUpRight, ArrowDownRight, Layers, DollarSign,
  Clock, Sparkles, ChevronDown, ChevronUp, Lock, Unlock, Percent,
  Cpu, Activity, Check, X, ShieldAlert, FileSpreadsheet, Download,
  Briefcase, MapPin, Ship, Info, PauseCircle, Maximize2, Minimize2,
  Pencil, Trash2, Plus, Users, FileText, Pin, PinOff, Save, RotateCcw,
  UserCheck, CheckCircle2, AlertCircle, ExternalLink, Anchor,
} from "lucide-react"
import * as XLSX from "xlsx"
import type { TrackRecordDB, PersonnelDB } from "@/lib/supabase"
import { FLEET_DEFS, ROV_OFFSHORE_ROLES, type ROVPersonnelAssignment } from "@/lib/rov-assignments-shared"
import { getDaysInMonthForRecord, getRecordDurationStatus, getEffectiveDays } from "@/lib/track-record-calc"
import {
  type RecordInterruptionsMap,
  type ProjectInterruption,
  getInterruptionsForRecord,
} from "@/lib/project-interruptions-shared"
import { updateTrackRecord } from "@/actions/track-record-actions"
import { saveProjectInterruptionsAction } from "@/actions/interruption-actions"
import { saveROVAssignmentsAction } from "@/actions/rov-assignment-actions"

export type ThemeMode = "dark" | "light" | "neutral"

export type ChartMetric =
  | "days"         // Số ngày vận hành (Ngày) - MẶC ĐỊNH
  | "projects"     // Số lượng dự án (Dự án)
  | "revenue"      // Doanh thu (USD) - Cần đăng nhập Admin
  | "rov_fleet"    // Phân bổ theo 04 Thiết bị ROV (Ngày)

export type VisualType = "bar" | "line" | "area"

// Chuẩn so sánh: "ytd" = Lũy kế cùng kỳ (chuẩn 1:1 theo các tháng đã qua), "full" = So với cả năm trước (12 tháng)
export type CompareScope = "ytd" | "full"

interface AnalyticsChartsPanelProps {
  records: TrackRecordDB[]
  theme?: ThemeMode
  isAdmin?: boolean
  isRevenueUnlocked?: boolean
  onUnlockRevenue?: () => void
  onRequireAdmin?: () => void
  onAdminLogin?: () => void
  interruptionsMap?: RecordInterruptionsMap
  onSaveInterruptions?: (recordKey: string, updated: ProjectInterruption[]) => Promise<void>
  onUpdateRecord?: (updatedRecord: TrackRecordDB) => void
  assignments?: ROVPersonnelAssignment[]
  onSaveAssignments?: (newAssignments: ROVPersonnelAssignment[]) => Promise<void>
  allPersonnel?: PersonnelDB[]
}

import { verifyRevenuePassword, setSavedRevenueUnlocked } from "@/lib/revenue-security"

const fmtUSD = (v?: number | null) => {
  if (v == null) return "$0"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

const fmtKMB = (v: number) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`
  return `$${v}`
}

const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
]

const daysInMonth = (monthIdx: number, year: number) => {
  return new Date(year, monthIdx + 1, 0).getDate()
}

export default function AnalyticsChartsPanel({
  records,
  theme = "dark",
  isAdmin = false,
  isRevenueUnlocked = false,
  onUnlockRevenue,
  onRequireAdmin,
  onAdminLogin,
  interruptionsMap,
  onSaveInterruptions,
  onUpdateRecord,
  assignments = [],
  onSaveAssignments,
  allPersonnel = [],
}: AnalyticsChartsPanelProps) {
  const [isOpen, setIsOpen] = useState(true)
  const isLight = theme === "light"
  const isNeutral = theme === "neutral"

  // 1. Chỉ số biểu đồ (Mặc định: "days" - Số ngày vận hành theo yêu cầu người dùng)
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("days")
  const [visualType, setVisualType] = useState<VisualType>("bar")

  // Quản lý quyền Admin nội bộ (nếu người dùng đăng nhập trực tiếp từ panel)
  const [localAdmin, setLocalAdmin] = useState(false)
  const [localUnlocked, setLocalUnlocked] = useState(false)
  const effectiveAdmin = isAdmin || localAdmin
  const effectiveRevenueUnlocked = effectiveAdmin || isRevenueUnlocked || localUnlocked

  // Modal yêu cầu mật khẩu khi bấm vào Doanh thu hoặc Sửa dự án
  const [showAdminPrompt, setShowAdminPrompt] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [adminError, setAdminError] = useState("")
  const [adminPromptReason, setAdminPromptReason] = useState<"revenue" | "edit">("revenue")
  const [pendingEditProj, setPendingEditProj] = useState<any>(null)

  // Danh sách các năm có trong dữ liệu
  const availableYears = useMemo(() => {
    const set = new Set<number>()
    records.forEach(r => {
      if (r.start_date) {
        const y = new Date(r.start_date).getFullYear()
        if (!isNaN(y)) set.add(y)
      }
    })
    return Array.from(set).sort((a, b) => b - a)
  }, [records])

  // Năm phân tích (selectedYear) & Năm so sánh cùng kỳ (compareYear)
  const defaultYear = availableYears[0] || 2026
  const defaultCompare = availableYears[1] || defaultYear - 1

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)
  const [compareYear, setCompareYear] = useState<number>(defaultCompare)
  const [chartTab, setChartTab] = useState<"monthly" | "cumulative" | "rov_matrix" | "table">("rov_matrix")
  // Chế độ xem bảng: "matrix" = Ma trận 4 ROV x 12 Tháng, "timeline" = Theo 12 Tháng dọc, "compare" = So sánh 2 năm
  const [rovViewMode, setRovViewMode] = useState<"matrix" | "timeline" | "compare">("matrix")
  // Tháng báo cáo để tính lũy kế (mặc định tháng hiện tại: Tháng 10)
  const [reportMonth, setReportMonth] = useState<number>(10)
  // Chuẩn so sánh: "ytd" = Lũy kế cùng kỳ (chuẩn 1:1 theo các tháng đã qua), "full" = So với cả năm trước (12 tháng)
  const [compareScope, setCompareScope] = useState<CompareScope>("ytd")

  // State quản lý thông tin popup chi tiết khi di chuột vào từng tháng của thiết bị ROV
  interface ROVMonthProjectDetail {
    id: number
    no?: number | null
    projectName: string
    projectTask?: string | null
    projectSow?: string | null
    client: string
    contract?: string | null
    notes?: string | null
    location?: string | null
    vesselRig?: string | null
    waterDepth?: string | null
    fullStart?: string | null
    fullEnd?: string | null
    monthStartDay: number
    monthEndDay: number
    monthStartDateStr: string
    monthEndDateStr: string
    activeDaysInMonth: number
    pausedDaysInMonth: number
    interruptions: ProjectInterruption[]
    personnel: ROVPersonnelAssignment[]
    allRovPersonnel: ROVPersonnelAssignment[]
    rawRecord: TrackRecordDB
  }

  interface ROVMonthHoverData {
    rov: {
      id: string
      name: string
      shortName: string
      code: string
      badgeCol: string
      dotCol: string
      textCol: string
      themeColor: string
    }
    month: number
    monthName: string
    year: number
    daysInM: number
    activeDays: number
    utilPct: number
    projects: ROVMonthProjectDetail[]
    hasOverlap: boolean
    overlapDays: number
    rect: {
      left: number
      top: number
      right: number
      bottom: number
      width: number
      height: number
    }
  }

  const [hoverData, setHoverData] = useState<ROVMonthHoverData | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const leaveTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const isHoveringPopupRef = React.useRef(false)

  // State chỉnh sửa dự án dành cho Admin
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [editContract, setEditContract] = useState("")
  const [editProjectTask, setEditProjectTask] = useState("")
  const [editProjectSow, setEditProjectSow] = useState("")
  const [editNotes, setEditNotes] = useState("")
  const [editClient, setEditClient] = useState("")
  const [editVesselRig, setEditVesselRig] = useState("")
  const [editLocation, setEditLocation] = useState("")
  const [editInterruptions, setEditInterruptions] = useState<ProjectInterruption[]>([])
  const [newInterruptionStart, setNewInterruptionStart] = useState("")
  const [newInterruptionEnd, setNewInterruptionEnd] = useState("")
  const [newInterruptionReason, setNewInterruptionReason] = useState("Thời tiết biển xấu / Sóng to gió lớn")
  const [newInterruptionCustomReason, setNewInterruptionCustomReason] = useState("")
  const [newInterruptionNote, setNewInterruptionNote] = useState("")

  // State quản lý nhân sự của dự án
  const [editAssignments, setEditAssignments] = useState<ROVPersonnelAssignment[]>([])
  const [newPersonId, setNewPersonId] = useState<number | "">("")
  const [newPersonRole, setNewPersonRole] = useState<string>("ROV Pilot technician")
  const [newPersonStart, setNewPersonStart] = useState("")
  const [newPersonEnd, setNewPersonEnd] = useState("")
  const [newPersonNote, setNewPersonNote] = useState("")

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("")

  const formatDayVN = (day: number, month: number, year: number) => {
    const dd = String(day).padStart(2, "0")
    const mm = String(month).padStart(2, "0")
    return `${dd}/${mm}/${year}`
  }

  const formatDateVN = (dateStr?: string | null) => {
    if (!dateStr) return "—"
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    const dd = String(d.getDate()).padStart(2, "0")
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  const getOffshoreRoleBadge = (role?: string | null) => {
    if (!role) return "bg-slate-500/20 text-slate-300 border-slate-500/40"
    const r = role.toLowerCase()
    if (r.includes("manager") || r.includes("superintendent")) {
      return "bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/20"
    }
    if (r.includes("supervisor")) {
      return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 ring-1 ring-cyan-500/20"
    }
    if (r.includes("submersible") || r.includes("pilot technician") || r.includes("representative")) {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/20"
    }
    if (r.includes("junior") || r.includes("assistant")) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/20"
    }
    return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 ring-1 ring-indigo-500/20"
  }

  // Hàm trích xuất chi tiết các dự án tham gia trong tháng của từng thiết bị ROV
  const getROVMonthDetail = (
    rov: {
      id: string
      name: string
      shortName: string
      code: string
      badgeCol: string
      dotCol: string
      textCol: string
      themeColor: string
    },
    monthIdx: number,
    year: number
  ): ROVMonthHoverData => {
    const daysInM = daysInMonth(monthIdx, year)
    const mStart = new Date(year, monthIdx, 1)
    const mEnd = new Date(year, monthIdx, daysInM)
    const now = new Date()

    const matchedProjects: ROVMonthProjectDetail[] = []
    const monthlyActiveDaySet = new Set<number>()
    let sumIndividualActiveDays = 0

    records.forEach(r => {
      if (!r.start_date) return
      const sys = (r.rov_system || "").toLowerCase()
      let belongs = false
      if (rov.id === "quasar-30") belongs = /quasar.*(?:mkii|ii)?[- ]*30/i.test(sys)
      else if (rov.id === "compact-07") belongs = /compact.*07|quasar.*07/i.test(sys)
      else if (rov.id === "panther-954") belongs = /954/.test(sys)
      else if (rov.id === "panther-911") belongs = /911/.test(sys)
      else belongs = !/quasar.*(?:mkii|ii)?[- ]*30/i.test(sys) && !/compact.*07|quasar.*07/i.test(sys) && !/954/.test(sys) && !/911/.test(sys)

      if (!belongs) return

      const start = new Date(r.start_date)
      if (isNaN(start.getTime())) return
      const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())

      let eDate: Date
      if (r.end_date) {
        const end = new Date(r.end_date)
        if (isNaN(end.getTime())) return
        eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
      } else {
        if (year < now.getFullYear()) {
          eDate = new Date(year, 11, 31)
        } else {
          eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      }

      if (eDate < mStart || sDate > mEnd) return

      const oStart = sDate > mStart ? sDate : mStart
      const oEnd = eDate < mEnd ? eDate : mEnd

      const intList = getInterruptionsForRecord(interruptionsMap, r)
      const projActiveDays = new Set<number>()
      const projPausedDays = new Set<number>()

      for (let d = oStart.getDate(); d <= oEnd.getDate(); d++) {
        const curDate = new Date(year, monthIdx, d)
        const isPaused = intList.some(it => {
          if (!it.startDate || !it.endDate) return false
          const iStart = new Date(it.startDate)
          const iEnd = new Date(it.endDate)
          if (isNaN(iStart.getTime()) || isNaN(iEnd.getTime())) return false
          const isD = new Date(iStart.getFullYear(), iStart.getMonth(), iStart.getDate())
          const ieD = new Date(iEnd.getFullYear(), iEnd.getMonth(), iEnd.getDate())
          return curDate >= isD && curDate <= ieD
        })

        if (isPaused) {
          projPausedDays.add(d)
        } else {
          projActiveDays.add(d)
          monthlyActiveDaySet.add(d)
        }
      }

      sumIndividualActiveDays += projActiveDays.size

      const monthInts = intList.filter(it => {
        if (!it.startDate || !it.endDate) return false
        const iStart = new Date(it.startDate)
        const iEnd = new Date(it.endDate)
        return iEnd >= mStart && iStart <= mEnd
      })

      // Lọc nhân sự của thiết bị ROV này
      const mStartStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-01`
      const mEndStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(daysInM).padStart(2, "0")}`

      const matchedPersonnel = (assignments || []).filter(a => {
        if (a.rovId !== rov.id) return false
        const aStart = a.startDate ? a.startDate.slice(0, 10) : ""
        const aEnd = a.endDate ? a.endDate.slice(0, 10) : "9999-12-31"
        return aStart <= mEndStr && aEnd >= mStartStr
      })

      const allRovPersonnel = (assignments || []).filter(a => a.rovId === rov.id)

      let depthStr: string | null = null
      if (r.water_depth_min_msw != null && r.water_depth_max_msw != null) {
        depthStr = `${r.water_depth_min_msw}–${r.water_depth_max_msw} msw`
      } else if (r.water_depth_min_msw != null || r.water_depth_max_msw != null) {
        depthStr = `${r.water_depth_min_msw ?? r.water_depth_max_msw} msw`
      }

      matchedProjects.push({
        id: r.id,
        no: r.no,
        projectName: r.project_task || r.project_sow || "Dự án ROV",
        projectTask: r.project_task,
        projectSow: r.project_sow,
        client: r.client || "PTSC G&S",
        contract: r.contract,
        notes: r.notes,
        location: r.location,
        vesselRig: r.vessel_rig,
        waterDepth: depthStr,
        fullStart: r.start_date,
        fullEnd: r.end_date,
        monthStartDay: oStart.getDate(),
        monthEndDay: oEnd.getDate(),
        monthStartDateStr: formatDayVN(oStart.getDate(), monthIdx + 1, year),
        monthEndDateStr: formatDayVN(oEnd.getDate(), monthIdx + 1, year),
        activeDaysInMonth: projActiveDays.size,
        pausedDaysInMonth: projPausedDays.size,
        interruptions: intList,
        personnel: matchedPersonnel,
        allRovPersonnel: allRovPersonnel,
        rawRecord: r,
      })
    })

    const finalActiveDays = Math.min(daysInM, monthlyActiveDaySet.size)
    const overlapDays = Math.max(0, sumIndividualActiveDays - finalActiveDays)

    return {
      rov: {
        id: rov.id,
        name: rov.name,
        shortName: rov.shortName,
        code: rov.code,
        badgeCol: rov.badgeCol,
        dotCol: rov.dotCol,
        textCol: rov.textCol,
        themeColor: rov.themeColor,
      },
      month: monthIdx + 1,
      monthName: MONTH_NAMES[monthIdx],
      year,
      daysInM,
      activeDays: finalActiveDays,
      utilPct: Number(((finalActiveDays / daysInM) * 100).toFixed(1)),
      projects: matchedProjects,
      hasOverlap: overlapDays > 0,
      overlapDays,
      rect: { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 },
    }
  }

  const handleCellHover = (
    rov: any,
    monthIdx: number,
    year: number,
    e: React.MouseEvent<HTMLElement>,
    forcePin: boolean = false
  ) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    // Nếu popup đang được ghim hoặc mở rộng và không phải click trực tiếp thì không tự đổi
    if ((isPinned || isExpanded) && !forcePin) return

    const rect = e.currentTarget.getBoundingClientRect()
    const detail = getROVMonthDetail(rov, monthIdx, year)
    detail.rect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }
    setHoverData(detail)
    if (forcePin) {
      setIsPinned(true)
    }
  }

  const handleCellLeave = () => {
    if (isPinned || isExpanded || editingProjectId != null) return
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      if (!isHoveringPopupRef.current && !isPinned && !isExpanded && editingProjectId == null) {
        setHoverData(null)
      }
    }, 280)
  }

  const handleClosePopup = () => {
    setHoverData(null)
    setIsPinned(false)
    setIsExpanded(false)
    setEditingProjectId(null)
    setSaveSuccessMsg("")
  }

  const handleTogglePin = () => {
    setIsPinned(prev => !prev)
  }

  const handleToggleExpand = () => {
    setIsExpanded(prev => {
      const next = !prev
      if (next) setIsPinned(true)
      return next
    })
  }

  // Khởi động chế độ sửa dự án
  const handleStartEdit = (proj: ROVMonthProjectDetail) => {
    if (!effectiveAdmin) {
      setAdminPromptReason("edit")
      setPendingEditProj(proj)
      setShowAdminPrompt(true)
      return
    }
    setIsPinned(true)
    setEditingProjectId(proj.id)
    setEditContract(proj.contract || "")
    setEditProjectTask(proj.projectTask || "")
    setEditProjectSow(proj.projectSow || "")
    setEditNotes(proj.notes || "")
    setEditClient(proj.client || "")
    setEditVesselRig(proj.vesselRig || "")
    setEditLocation(proj.location || "")
    setEditInterruptions(proj.interruptions || [])
    setEditAssignments((assignments || []).filter(a => a.rovId === hoverData?.rov.id))

    if (hoverData) {
      const ym = `${hoverData.year}-${String(hoverData.month).padStart(2, "0")}`
      setNewInterruptionStart(`${ym}-05`)
      setNewInterruptionEnd(`${ym}-10`)
      setNewPersonStart(`${ym}-01`)
    }
    setSaveSuccessMsg("")
  }

  const handleAddInterruption = () => {
    if (!newInterruptionStart || !newInterruptionEnd) {
      alert("Vui lòng chọn ngày bắt đầu và kết thúc tạm ngưng")
      return
    }
    const s = new Date(newInterruptionStart)
    const e = new Date(newInterruptionEnd)
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) {
      alert("Ngày kết thúc tạm ngưng phải lớn hơn hoặc bằng ngày bắt đầu")
      return
    }
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
    const reasonText = newInterruptionReason === "Khác (Nhập vào ghi chú)"
      ? (newInterruptionCustomReason || "Tạm ngưng khác")
      : newInterruptionReason

    const newIt: ProjectInterruption = {
      id: `int_${Date.now()}`,
      recordId: editingProjectId || (hoverData?.projects[0]?.id ?? 0),
      recordNo: hoverData?.projects.find(p => p.id === editingProjectId)?.no ?? undefined,
      startDate: newInterruptionStart,
      endDate: newInterruptionEnd,
      days,
      reason: reasonText,
      note: newInterruptionNote || undefined,
      createdAt: new Date().toISOString(),
    }

    setEditInterruptions(prev => [...prev, newIt])
    setNewInterruptionNote("")
    setNewInterruptionCustomReason("")
  }

  const handleRemoveInterruption = (id: string) => {
    setEditInterruptions(prev => prev.filter(it => it.id !== id))
  }

  const handleAddPersonnelAssignment = () => {
    if (!newPersonId || !hoverData) {
      alert("Vui lòng chọn nhân sự")
      return
    }
    const person = (allPersonnel || []).find(p => p.id === Number(newPersonId))
    if (!person) return

    const newAsgn: ROVPersonnelAssignment = {
      id: `asgn_${Date.now()}`,
      rovId: hoverData.rov.id,
      rovName: hoverData.rov.shortName,
      personnelId: person.id,
      personnelName: person.ho_va_ten,
      role: newPersonRole,
      startDate: newPersonStart || `${hoverData.year}-${String(hoverData.month).padStart(2, "0")}-01`,
      endDate: newPersonEnd || null,
      note: newPersonNote || undefined,
      createdAt: new Date().toISOString(),
    }

    setEditAssignments(prev => [...prev, newAsgn])
    setNewPersonId("")
    setNewPersonNote("")
  }

  const handleRemoveAssignment = (id: string) => {
    setEditAssignments(prev => prev.filter(a => a.id !== id))
  }

  // Lưu và tự động đồng bộ toàn bộ Track Record
  const handleSaveAndSync = async (proj: ROVMonthProjectDetail) => {
    setIsSaving(true)
    try {
      // 1. Lưu các đợt tạm ngưng
      const recKey = String(proj.rawRecord.id)
      if (onSaveInterruptions) {
        await onSaveInterruptions(recKey, editInterruptions)
      } else {
        const newMap: RecordInterruptionsMap = {
          ...interruptionsMap,
          [recKey]: editInterruptions,
          [String(proj.rawRecord.no)]: editInterruptions,
        }
        await saveProjectInterruptionsAction(newMap)
      }

      // 2. Lưu thông tin dự án (số HĐ, notes, vessel, location...)
      const updatedRecord: TrackRecordDB = {
        ...proj.rawRecord,
        contract: editContract,
        notes: editNotes,
        project_task: editProjectTask,
        project_sow: editProjectSow,
        client: editClient,
        vessel_rig: editVesselRig,
        location: editLocation,
      }

      await updateTrackRecord(proj.rawRecord.id, {
        contract: editContract,
        notes: editNotes,
        project_task: editProjectTask,
        project_sow: editProjectSow,
        client: editClient,
        vessel_rig: editVesselRig,
        location: editLocation,
      })

      if (onUpdateRecord) {
        onUpdateRecord(updatedRecord)
      }

      // 3. Lưu phân công nhân sự
      if (onSaveAssignments) {
        const otherROVsAssignments = (assignments || []).filter(a => a.rovId !== hoverData?.rov.id)
        const mergedAssignments = [...otherROVsAssignments, ...editAssignments]
        await onSaveAssignments(mergedAssignments)
      }

      // 4. Cập nhật lại hoverData ngay lập tức để người dùng thấy số liệu mới
      if (hoverData) {
        const refreshedDetail = getROVMonthDetail(hoverData.rov, hoverData.month - 1, hoverData.year)
        refreshedDetail.rect = hoverData.rect
        setHoverData(refreshedDetail)
      }

      setSaveSuccessMsg("Đã lưu và đồng bộ toàn bộ dữ liệu Track Record thành công!")
      setTimeout(() => {
        setEditingProjectId(null)
        setSaveSuccessMsg("")
      }, 1200)
    } catch (err: any) {
      alert("Lỗi khi lưu dữ liệu: " + (err?.message || err))
    } finally {
      setIsSaving(false)
    }
  }

  const getPopupStyle = (cellRect: { left: number; top: number; bottom: number; width: number }): React.CSSProperties => {
    if (typeof window === "undefined") return { display: "none" }
    const winW = window.innerWidth
    const winH = window.innerHeight
    const tooltipW = 490

    // Căn giữa ngang so với ô đang trỏ chuột, khống chế không tràn màn hình
    let left = cellRect.left + cellRect.width / 2 - tooltipW / 2
    if (left < 16) left = 16
    if (left + tooltipW > winW - 16) left = winW - tooltipW - 16

    // Căn vị trí dọc: ưu tiên hiển thị phía dưới nếu còn đủ >= 360px, ngược lại hiển thị phía trên
    const spaceAbove = cellRect.top
    const spaceBelow = winH - cellRect.bottom

    if (spaceBelow >= 360) {
      const maxH = Math.min(580, Math.max(260, spaceBelow - 20))
      return {
        position: "fixed",
        left: `${left}px`,
        top: `${cellRect.bottom + 8}px`,
        maxHeight: `${maxH}px`,
        width: `${tooltipW}px`,
        maxWidth: "94vw",
        zIndex: 99999,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
      }
    } else {
      const maxH = Math.min(580, Math.max(260, spaceAbove - 20))
      return {
        position: "fixed",
        left: `${left}px`,
        bottom: `${winH - cellRect.top + 8}px`,
        maxHeight: `${maxH}px`,
        width: `${tooltipW}px`,
        maxWidth: "94vw",
        zIndex: 99999,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
      }
    }
  }

  // Xử lý khi người dùng chọn metric từ dropdown
  const handleMetricChange = (metric: ChartMetric) => {
    if (metric === "revenue" && !effectiveRevenueUnlocked) {
      // Yêu cầu quyền admin hoặc phân quyền trước khi hiện doanh thu
      setAdminPromptReason("revenue")
      setShowAdminPrompt(true)
      return
    }
    setSelectedMetric(metric)
  }

  const handleAdminSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (verifyRevenuePassword(adminPassword)) {
      setLocalAdmin(true)
      setLocalUnlocked(true)
      setSavedRevenueUnlocked(true)
      setShowAdminPrompt(false)
      setAdminPassword("")
      setAdminError("")
      if (onUnlockRevenue) onUnlockRevenue()
      if (onAdminLogin) onAdminLogin()
      if (onRequireAdmin) onRequireAdmin()

      if (adminPromptReason === "revenue") {
        setSelectedMetric("revenue")
      } else if (adminPromptReason === "edit" && pendingEditProj) {
        setIsPinned(true)
        setEditingProjectId(pendingEditProj.id)
        setEditContract(pendingEditProj.contract || "")
        setEditProjectTask(pendingEditProj.projectTask || "")
        setEditProjectSow(pendingEditProj.projectSow || "")
        setEditNotes(pendingEditProj.notes || "")
        setEditClient(pendingEditProj.client || "")
        setEditVesselRig(pendingEditProj.vesselRig || "")
        setEditLocation(pendingEditProj.location || "")
        setEditInterruptions(pendingEditProj.interruptions || [])
        setEditAssignments((assignments || []).filter(a => a.rovId === hoverData?.rov.id))

        if (hoverData) {
          const ym = `${hoverData.year}-${String(hoverData.month).padStart(2, "0")}`
          setNewInterruptionStart(`${ym}-05`)
          setNewInterruptionEnd(`${ym}-10`)
          setNewPersonStart(`${ym}-01`)
        }
        setPendingEditProj(null)
      }
    } else {
      setAdminError("Mật khẩu không đúng! Vui lòng nhập mật khẩu Admin hoặc mật khẩu phân quyền.")
    }
  }

  // Tính toán dữ liệu 12 tháng cho Năm A (selectedYear) và Năm B (compareYear)
  const comparisonData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      name: `T${i + 1}`,
      fullName: MONTH_NAMES[i],
      daysInMonthA: daysInMonth(i, selectedYear),
      daysInMonthB: daysInMonth(i, compareYear),
      // Năm A
      revA: 0,
      countA: 0,
      daysA: 0,
      // 4 ROV breakdown Năm A
      quasar30DaysA: 0,
      compact07DaysA: 0,
      panther954DaysA: 0,
      panther911DaysA: 0,
      otherDaysA: 0,
      // Năm B
      revB: 0,
      countB: 0,
      daysB: 0,
      // 4 ROV breakdown Năm B
      quasar30DaysB: 0,
      compact07DaysB: 0,
      panther954DaysB: 0,
      panther911DaysB: 0,
      otherDaysB: 0,
      // Lũy kế
      cumRevA: 0,
      cumRevB: 0,
      cumCountA: 0,
      cumCountB: 0,
      cumDaysA: 0,
      cumDaysB: 0,
      // Tỷ lệ 365 ngày
      rate365A: 0,
      rate365B: 0,
      cumRate365A: 0,
      cumRate365B: 0,
      // Công suất trong tháng (% days / daysInMonth)
      monthUtilA: 0,
      monthUtilB: 0,
    }))

    // Sử dụng Set để lưu các ngày lịch duy nhất (1..daysInMonth) mà từng thiết bị ROV thực tế hoạt động.
    // Cách tiếp cận này đảm bảo TUYỆT ĐỐI:
    // 1. Một thiết bị làm full tháng không bao giờ vượt quá số ngày của tháng đó (T6 tối đa 30, T2 tối đa 28/29...).
    // 2. Nếu 1 thiết bị có nhiều dự án gối đầu/overlap (ví dụ Quasar 07 ngày 14/06 giao thoa 2 dự án), ngày đó chỉ tính 1 ngày làm việc.
    // 3. Khấu trừ chính xác các ngày tạm ngưng (standby/maintenance) của từng dự án.
    const activeDaysA = Array.from({ length: 12 }, () => ({
      q30: new Set<number>(),
      c07: new Set<number>(),
      p954: new Set<number>(),
      p911: new Set<number>(),
      other: new Set<number>(),
    }))

    const activeDaysB = Array.from({ length: 12 }, () => ({
      q30: new Set<number>(),
      c07: new Set<number>(),
      p954: new Set<number>(),
      p911: new Set<number>(),
      other: new Set<number>(),
    }))

    records.forEach(r => {
      if (!r.start_date) return
      const d = new Date(r.start_date)
      if (isNaN(d.getTime())) return
      const y = d.getFullYear()
      const startM = d.getMonth()

      const cost = r.total_project_cost_usd || 0
      const rovSystem = (r.rov_system || "").toLowerCase()

      const isQuasar30 = /quasar.*(?:mkii|ii)?[- ]*30/i.test(rovSystem)
      const isCompact07 = /compact.*07|quasar.*07/i.test(rovSystem)
      const isPanther954 = /954/.test(rovSystem)
      const isPanther911 = /911/.test(rovSystem)
      const isOther = !isQuasar30 && !isCompact07 && !isPanther954 && !isPanther911

      // Doanh thu và số lượng dự án ghi nhận vào tháng bắt đầu dự án
      if (startM >= 0 && startM <= 11) {
        if (y === selectedYear) {
          months[startM].revA += cost
          months[startM].countA += 1
        } else if (y === compareYear) {
          months[startM].revB += cost
          months[startM].countB += 1
        }
      }

      // Hàm xác định các ngày lịch làm việc thực tế trong năm mục tiêu
      const populateActiveDaysForYear = (
        targetYear: number,
        activeTarget: typeof activeDaysA
      ) => {
        const start = new Date(r.start_date!)
        if (isNaN(start.getTime())) return
        const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())

        let eDate: Date
        if (r.end_date) {
          const end = new Date(r.end_date)
          if (isNaN(end.getTime())) return
          eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
        } else {
          // Dự án chưa kết thúc:
          const now = new Date()
          if (targetYear < now.getFullYear()) {
            eDate = new Date(targetYear, 11, 31)
          } else {
            eDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        }

        if (sDate > eDate) return

        const intList = getInterruptionsForRecord(interruptionsMap, r)

        for (let m = 0; m < 12; m++) {
          const daysInM = daysInMonth(m, targetYear)
          const mStart = new Date(targetYear, m, 1)
          const mEnd = new Date(targetYear, m, daysInM)

          if (eDate < mStart || sDate > mEnd) continue

          const oStart = sDate > mStart ? sDate : mStart
          const oEnd = eDate < mEnd ? eDate : mEnd

          const startDay = oStart.getDate()
          const endDay = oEnd.getDate()

          for (let day = startDay; day <= endDay; day++) {
            const curDate = new Date(targetYear, m, day)
            // Kiểm tra xem ngày này có bị tạm ngưng hay không
            const isPaused = intList.some(it => {
              if (!it.startDate || !it.endDate) return false
              const iStart = new Date(it.startDate)
              const iEnd = new Date(it.endDate)
              if (isNaN(iStart.getTime()) || isNaN(iEnd.getTime())) return false
              const isD = new Date(iStart.getFullYear(), iStart.getMonth(), iStart.getDate())
              const ieD = new Date(iEnd.getFullYear(), iEnd.getMonth(), iEnd.getDate())
              return curDate >= isD && curDate <= ieD
            })

            if (!isPaused) {
              if (isQuasar30) activeTarget[m].q30.add(day)
              if (isCompact07) activeTarget[m].c07.add(day)
              if (isPanther954) activeTarget[m].p954.add(day)
              if (isPanther911) activeTarget[m].p911.add(day)
              if (isOther) activeTarget[m].other.add(day)
            }
          }
        }
      }

      populateActiveDaysForYear(selectedYear, activeDaysA)
      populateActiveDaysForYear(compareYear, activeDaysB)
    })

    // Phân bổ và giới hạn số ngày làm việc không vượt quá số ngày thực tế của từng tháng
    for (let m = 0; m < 12; m++) {
      const q30A = Math.min(months[m].daysInMonthA, activeDaysA[m].q30.size)
      const c07A = Math.min(months[m].daysInMonthA, activeDaysA[m].c07.size)
      const p954A = Math.min(months[m].daysInMonthA, activeDaysA[m].p954.size)
      const p911A = Math.min(months[m].daysInMonthA, activeDaysA[m].p911.size)
      const otherA = Math.min(months[m].daysInMonthA, activeDaysA[m].other.size)

      months[m].quasar30DaysA = q30A
      months[m].compact07DaysA = c07A
      months[m].panther954DaysA = p954A
      months[m].panther911DaysA = p911A
      months[m].otherDaysA = otherA
      months[m].daysA = q30A + c07A + p954A + p911A + otherA

      const q30B = Math.min(months[m].daysInMonthB, activeDaysB[m].q30.size)
      const c07B = Math.min(months[m].daysInMonthB, activeDaysB[m].c07.size)
      const p954B = Math.min(months[m].daysInMonthB, activeDaysB[m].p954.size)
      const p911B = Math.min(months[m].daysInMonthB, activeDaysB[m].p911.size)
      const otherB = Math.min(months[m].daysInMonthB, activeDaysB[m].other.size)

      months[m].quasar30DaysB = q30B
      months[m].compact07DaysB = c07B
      months[m].panther954DaysB = p954B
      months[m].panther911DaysB = p911B
      months[m].otherDaysB = otherB
      months[m].daysB = q30B + c07B + p954B + p911B + otherB
    }

    // Tính lũy kế cộng dồn qua từng tháng
    let runningRevA = 0
    let runningRevB = 0
    let runningCountA = 0
    let runningCountB = 0
    let runningDaysA = 0
    let runningDaysB = 0

    return months.map(m => {
      runningRevA += m.revA
      runningRevB += m.revB
      runningCountA += m.countA
      runningCountB += m.countB
      runningDaysA += m.daysA
      runningDaysB += m.daysB

      // Tỷ lệ 365 ngày
      const rate365A = Number(((m.daysA / 365) * 100).toFixed(2))
      const rate365B = Number(((m.daysB / 365) * 100).toFixed(2))
      const cumRate365A = Number(((runningDaysA / 365) * 100).toFixed(2))
      const cumRate365B = Number(((runningDaysB / 365) * 100).toFixed(2))

      // Công suất trong tháng
      const monthUtilA = Number(((m.daysA / m.daysInMonthA) * 100).toFixed(1))
      const monthUtilB = Number(((m.daysB / m.daysInMonthB) * 100).toFixed(1))

      // Chênh lệch doanh thu
      const diffMonthlyRev = m.revA - m.revB
      const monthlyGrowthPct = m.revB > 0 ? ((diffMonthlyRev / m.revB) * 100) : (m.revA > 0 ? 100 : 0)
      const diffCumRev = runningRevA - runningRevB
      const cumGrowthPct = runningRevB > 0 ? ((diffCumRev / runningRevB) * 100) : (runningRevA > 0 ? 100 : 0)

      // Chênh lệch số ngày
      const diffMonthlyDays = m.daysA - m.daysB
      const daysGrowthPct = m.daysB > 0 ? ((diffMonthlyDays / m.daysB) * 100) : (m.daysA > 0 ? 100 : 0)
      const diffCumDays = runningDaysA - runningDaysB

      // Chênh lệch tỷ lệ 365
      const diffRate365 = Number((rate365A - rate365B).toFixed(2))
      const diffCumRate365 = Number((cumRate365A - cumRate365B).toFixed(2))

      // Chênh lệch số dự án
      const diffCount = m.countA - m.countB

      return {
        ...m,
        cumRevA: runningRevA,
        cumRevB: runningRevB,
        cumCountA: runningCountA,
        cumCountB: runningCountB,
        cumDaysA: runningDaysA,
        cumDaysB: runningDaysB,
        rate365A,
        rate365B,
        cumRate365A,
        cumRate365B,
        monthUtilA,
        monthUtilB,
        diffMonthlyRev,
        monthlyGrowthPct,
        diffCumRev,
        cumGrowthPct,
        diffMonthlyDays,
        daysGrowthPct,
        diffCumDays,
        diffRate365,
        diffCumRate365,
        diffCount,
      }
    })
  }, [records, selectedYear, compareYear])

  // Xác định số tháng đã diễn ra của năm hiện tại
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonthNum = now.getMonth() + 1 // 1-12 (hiện tại tháng 10)

  const isSelectedCurrent = selectedYear === currentYear
  const isCompareCurrent = compareYear === currentYear
  const hasOngoingYear = isSelectedCurrent || isCompareCurrent

  // Số tháng áp dụng cho Lũy kế cùng kỳ (YTD: ví dụ Tháng 1 đến Tháng 10 = 10 tháng)
  const ytdMonthCount = hasOngoingYear ? Math.min(12, currentMonthNum) : 12

  // 1. TỔNG KẾT LŨY KẾ CÙNG KỲ (YTD - Tháng 1 đến Tháng ytdMonthCount: CHUẨN 1:1)
  const summaryA_YTD = useMemo(() => {
    const slice = comparisonData.slice(0, ytdMonthCount)
    const rev = slice.reduce((s, m) => s + m.revA, 0)
    const count = slice.reduce((s, m) => s + m.countA, 0)
    const days = slice.reduce((s, m) => s + m.daysA, 0)
    const rate365 = Number(((days / 365) * 100).toFixed(1))
    const quasar30Days = slice.reduce((s, m) => s + m.quasar30DaysA, 0)
    const compact07Days = slice.reduce((s, m) => s + m.compact07DaysA, 0)
    const panther954Days = slice.reduce((s, m) => s + m.panther954DaysA, 0)
    const panther911Days = slice.reduce((s, m) => s + m.panther911DaysA, 0)
    return {
      rev, count, days, rate365,
      quasar30Days, compact07Days, panther954Days, panther911Days,
    }
  }, [comparisonData, ytdMonthCount])

  const summaryB_YTD = useMemo(() => {
    const slice = comparisonData.slice(0, ytdMonthCount)
    const rev = slice.reduce((s, m) => s + m.revB, 0)
    const count = slice.reduce((s, m) => s + m.countB, 0)
    const days = slice.reduce((s, m) => s + m.daysB, 0)
    const rate365 = Number(((days / 365) * 100).toFixed(1))
    const quasar30Days = slice.reduce((s, m) => s + m.quasar30DaysB, 0)
    const compact07Days = slice.reduce((s, m) => s + m.compact07DaysB, 0)
    const panther954Days = slice.reduce((s, m) => s + m.panther954DaysB, 0)
    const panther911Days = slice.reduce((s, m) => s + m.panther911DaysB, 0)
    return {
      rev, count, days, rate365,
      quasar30Days, compact07Days, panther954Days, panther911Days,
    }
  }, [comparisonData, ytdMonthCount])

  // 2. TỔNG KẾT TOÀN BỘ CẢ NĂM (FULL YEAR - 12 Tháng)
  const summaryA_Full = useMemo(() => {
    const rev = comparisonData.reduce((s, m) => s + m.revA, 0)
    const count = comparisonData.reduce((s, m) => s + m.countA, 0)
    const days = comparisonData.reduce((s, m) => s + m.daysA, 0)
    const rate365 = Number(((days / 365) * 100).toFixed(1))
    const quasar30Days = comparisonData.reduce((s, m) => s + m.quasar30DaysA, 0)
    const compact07Days = comparisonData.reduce((s, m) => s + m.compact07DaysA, 0)
    const panther954Days = comparisonData.reduce((s, m) => s + m.panther954DaysA, 0)
    const panther911Days = comparisonData.reduce((s, m) => s + m.panther911DaysA, 0)
    return {
      rev, count, days, rate365,
      quasar30Days, compact07Days, panther954Days, panther911Days,
    }
  }, [comparisonData])

  const summaryB_Full = useMemo(() => {
    const rev = comparisonData.reduce((s, m) => s + m.revB, 0)
    const count = comparisonData.reduce((s, m) => s + m.countB, 0)
    const days = comparisonData.reduce((s, m) => s + m.daysB, 0)
    const rate365 = Number(((days / 365) * 100).toFixed(1))
    const quasar30Days = comparisonData.reduce((s, m) => s + m.quasar30DaysB, 0)
    const compact07Days = comparisonData.reduce((s, m) => s + m.compact07DaysB, 0)
    const panther954Days = comparisonData.reduce((s, m) => s + m.panther954DaysB, 0)
    const panther911Days = comparisonData.reduce((s, m) => s + m.panther911DaysB, 0)
    return {
      rev, count, days, rate365,
      quasar30Days, compact07Days, panther954Days, panther911Days,
    }
  }, [comparisonData])

  // Chế độ so sánh hiện tại:
  // "ytd" = Lũy kế cùng kỳ (Tháng 1 -> Tháng ytdMonthCount: Chuẩn 1:1)
  // "full" = So với Toàn bộ 12 tháng năm trước (Full Year benchmark)
  const isYtdMode = compareScope === "ytd" && hasOngoingYear

  const summaryA = isYtdMode ? summaryA_YTD : summaryA_Full
  const summaryB = isYtdMode ? summaryB_YTD : summaryB_Full

  // Chênh lệch theo chuẩn đang chọn
  const totalRevDiff = summaryA.rev - summaryB.rev
  const totalRevGrowthPct = summaryB.rev > 0 ? (totalRevDiff / summaryB.rev) * 100 : (summaryA.rev > 0 ? 100 : 0)
  const totalDaysDiff = summaryA.days - summaryB.days
  const totalDaysGrowthPct = summaryB.days > 0 ? (totalDaysDiff / summaryB.days) * 100 : (summaryA.days > 0 ? 100 : 0)
  const totalCountDiff = summaryA.count - summaryB.count

  // Tỷ lệ % hoàn thành so với CẢ NĂM trước
  const fullYearDaysPct = summaryB_Full.days > 0 ? Number(((summaryA_Full.days / summaryB_Full.days) * 100).toFixed(1)) : 0
  const fullYearCountPct = summaryB_Full.count > 0 ? Number(((summaryA_Full.count / summaryB_Full.count) * 100).toFixed(1)) : 0
  const fullYearRevPct = summaryB_Full.rev > 0 ? Number(((summaryA_Full.rev / summaryB_Full.rev) * 100).toFixed(1)) : 0

  // ── DỮ LIỆU MA TRẬN 12 THÁNG CHO TỪNG ROV & LŨY KẾ ────────────
  const rovMatrixData = useMemo(() => {
    const baseROVs = [
      {
        id: "quasar-30",
        name: "ROV Quasar MKII-30",
        shortName: "Quasar II - 30",
        code: "MKII-30",
        themeColor: "cyan",
        textCol: isLight ? "text-cyan-800" : "text-cyan-400",
        badgeCol: isLight ? "bg-cyan-100 text-cyan-900 border-cyan-300" : "bg-cyan-950/80 text-cyan-300 border-cyan-500/50",
        borderCol: "border-cyan-500/40",
        dotCol: "bg-cyan-400",
        getDaysA: (m: typeof comparisonData[0]) => m.quasar30DaysA,
        getDaysB: (m: typeof comparisonData[0]) => m.quasar30DaysB,
      },
      {
        id: "compact-07",
        name: "ROV Quasar Compact 07",
        shortName: "Compact 07",
        code: "07",
        themeColor: "emerald",
        textCol: isLight ? "text-emerald-800" : "text-emerald-400",
        badgeCol: isLight ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-emerald-950/80 text-emerald-300 border-emerald-500/50",
        borderCol: "border-emerald-500/40",
        dotCol: "bg-emerald-400",
        getDaysA: (m: typeof comparisonData[0]) => m.compact07DaysA,
        getDaysB: (m: typeof comparisonData[0]) => m.compact07DaysB,
      },
      {
        id: "panther-954",
        name: "ROV Panther Plus 954",
        shortName: "Panther Plus 954",
        code: "954",
        themeColor: "amber",
        textCol: isLight ? "text-amber-800" : "text-amber-400",
        badgeCol: isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-950/80 text-amber-300 border-amber-500/50",
        borderCol: "border-amber-500/40",
        dotCol: "bg-amber-400",
        getDaysA: (m: typeof comparisonData[0]) => m.panther954DaysA,
        getDaysB: (m: typeof comparisonData[0]) => m.panther954DaysB,
      },
      {
        id: "panther-911",
        name: "ROV Panther Plus 911",
        shortName: "Panther Plus 911",
        code: "911",
        themeColor: "rose",
        textCol: isLight ? "text-rose-800" : "text-rose-400",
        badgeCol: isLight ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-rose-950/80 text-rose-300 border-rose-500/50",
        borderCol: "border-rose-500/40",
        dotCol: "bg-rose-400",
        getDaysA: (m: typeof comparisonData[0]) => m.panther911DaysA,
        getDaysB: (m: typeof comparisonData[0]) => m.panther911DaysB,
      },
    ]

    const hasOtherDaysA = comparisonData.some(m => {
      const sum4 = m.quasar30DaysA + m.compact07DaysA + m.panther954DaysA + m.panther911DaysA
      return m.daysA > sum4
    })
    const hasOtherDaysB = comparisonData.some(m => {
      const sum4 = m.quasar30DaysB + m.compact07DaysB + m.panther954DaysB + m.panther911DaysB
      return m.daysB > sum4
    })

    const allROVs = [...baseROVs]
    if (hasOtherDaysA || hasOtherDaysB) {
      allROVs.push({
        id: "other-systems",
        name: "Hệ thống ROV khác / Thiết bị khác",
        shortName: "ROV khác",
        code: "Khác",
        themeColor: "slate",
        textCol: isLight ? "text-slate-700" : "text-slate-400",
        badgeCol: isLight ? "bg-slate-200 text-slate-800 border-slate-300" : "bg-slate-800 text-slate-300 border-slate-700",
        borderCol: "border-slate-500/40",
        dotCol: "bg-slate-400",
        getDaysA: (m: typeof comparisonData[0]) => Math.max(0, m.daysA - (m.quasar30DaysA + m.compact07DaysA + m.panther954DaysA + m.panther911DaysA)),
        getDaysB: (m: typeof comparisonData[0]) => Math.max(0, m.daysB - (m.quasar30DaysB + m.compact07DaysB + m.panther954DaysB + m.panther911DaysB)),
      })
    }

    const rows = allROVs.map((rov, idx) => {
      const monthsA = comparisonData.map(m => rov.getDaysA(m))
      const monthsB = comparisonData.map(m => rov.getDaysB(m))
      const ytdA = monthsA.slice(0, reportMonth).reduce((acc, v) => acc + v, 0)
      const ytdB = monthsB.slice(0, reportMonth).reduce((acc, v) => acc + v, 0)
      const fullA = monthsA.reduce((acc, v) => acc + v, 0)
      const fullB = monthsB.reduce((acc, v) => acc + v, 0)

      return {
        ...rov,
        stt: idx + 1,
        monthsA,
        monthsB,
        ytdA,
        ytdB,
        fullA,
        fullB,
      }
    })

    const totalMonthsA = comparisonData.map(m => m.daysA)
    const totalMonthsB = comparisonData.map(m => m.daysB)
    const totalYtdA = totalMonthsA.slice(0, reportMonth).reduce((acc, v) => acc + v, 0)
    const totalYtdB = totalMonthsB.slice(0, reportMonth).reduce((acc, v) => acc + v, 0)
    const totalFullA = totalMonthsA.reduce((acc, v) => acc + v, 0)
    const totalFullB = totalMonthsB.reduce((acc, v) => acc + v, 0)

    const rowsWithShare = rows.map(r => ({
      ...r,
      shareYtdPctA: totalYtdA > 0 ? Number(((r.ytdA / totalYtdA) * 100).toFixed(1)) : 0,
      shareFullPctA: totalFullA > 0 ? Number(((r.fullA / totalFullA) * 100).toFixed(1)) : 0,
    }))

    return {
      rows: rowsWithShare,
      totalMonthsA,
      totalMonthsB,
      totalYtdA,
      totalYtdB,
      totalFullA,
      totalFullB,
    }
  }, [comparisonData, reportMonth, isLight])

  // Xuất file Excel (.xlsx) cho Ma trận 4 ROV x 12 Tháng
  const handleExportROVExcel = () => {
    try {
      const wb = XLSX.utils.book_new()

      const wsData: any[][] = [
        [`BÁO CÁO THỐNG KÊ CHI TIẾT SỐ NGÀY VẬN HÀNH THEO THIẾT BỊ ROV - NĂM ${selectedYear}`],
        [`Đơn vị: Xưởng Thiết bị ROV - PTSC G&S | Kỳ báo cáo: Tháng 1 đến Tháng ${reportMonth}/${selectedYear}`],
        [`Ngày xuất: ${new Date().toLocaleDateString("vi-VN")} | So sánh cùng kỳ: Năm ${compareYear}`],
        [],
        [
          "STT",
          "Thiết bị ROV",
          "Mã thiết bị",
          "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
          "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
          `Lũy kế Báo cáo (T1 - T${reportMonth})`,
          "Tổng Cả năm (12T)",
          "Tỷ trọng Lũy kế (%)"
        ]
      ]

      rovMatrixData.rows.forEach(r => {
        wsData.push([
          r.stt,
          r.name,
          r.code,
          ...r.monthsA,
          r.ytdA,
          r.fullA,
          `${r.shareYtdPctA}%`
        ])
      })

      // Dòng Tổng cộng Năm A
      wsData.push([
        "",
        `TỔNG CỘNG TOÀN ĐỘI ROV (NĂM ${selectedYear})`,
        "PTSC G&S",
        ...rovMatrixData.totalMonthsA,
        rovMatrixData.totalYtdA,
        rovMatrixData.totalFullA,
        "100%"
      ])

      // Dòng Cùng kỳ Năm B
      wsData.push([])
      wsData.push([
        "",
        `CÙNG KỲ NĂM ${compareYear} (T1 - T${reportMonth})`,
        `Năm ${compareYear}`,
        ...rovMatrixData.totalMonthsB,
        rovMatrixData.totalYtdB,
        rovMatrixData.totalFullB,
        ""
      ])

      // Dòng Chênh lệch (+/-)
      wsData.push([
        "",
        `CHÊNH LỆCH (+/- NGÀY SO VỚI NĂM ${compareYear})`,
        "Chênh lệch",
        ...rovMatrixData.totalMonthsA.map((v, i) => v - rovMatrixData.totalMonthsB[i]),
        rovMatrixData.totalYtdA - rovMatrixData.totalYtdB,
        rovMatrixData.totalFullA - rovMatrixData.totalFullB,
        ""
      ])

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      ws["!cols"] = [
        { wch: 6 },
        { wch: 28 },
        { wch: 12 },
        { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
        { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
        { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
        { wch: 24 },
        { wch: 20 },
        { wch: 18 }
      ]

      XLSX.utils.book_append_sheet(wb, ws, `ROV_${selectedYear}`)
      XLSX.writeFile(wb, `Bao_Cao_Ngay_Van_Hanh_ROV_${selectedYear}_T1_T${reportMonth}.xlsx`)
    } catch (err) {
      console.error("Lỗi xuất Excel:", err)
    }
  }

  // Xuất file CSV (UTF-8 BOM)
  const handleExportROVCSV = () => {
    try {
      const csvHeaders = [
        "STT",
        "Thiết bị ROV",
        "Mã thiết bị",
        "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
        `Lũy kế Báo cáo (T1-T${reportMonth})`,
        "Tổng Cả năm (12T)",
        "Tỷ trọng (%)"
      ]

      const csvRows = rovMatrixData.rows.map(r => [
        r.stt,
        `"${r.name}"`,
        `"${r.code}"`,
        ...r.monthsA,
        r.ytdA,
        r.fullA,
        `"${r.shareYtdPctA}%"`
      ])

      csvRows.push([
        "",
        `"TỔNG CỘNG TOÀN ĐỘI (${selectedYear})"`,
        `"PTSC G&S"`,
        ...rovMatrixData.totalMonthsA,
        rovMatrixData.totalYtdA,
        rovMatrixData.totalFullA,
        `"100%"`
      ])

      const csvContent = "\uFEFF" + [csvHeaders.join(","), ...csvRows.map(row => row.join(","))].join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Bao_Cao_Ngay_Van_Hanh_ROV_${selectedYear}_T1_T${reportMonth}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Lỗi xuất CSV:", err)
    }
  }

  // Tiêu đề & huy hiệu động theo chỉ số đang chọn
  const metricInfo = useMemo(() => {
    const compareLabel = isYtdMode ? `(Cùng kỳ T1–T${ytdMonthCount})` : `(Cả năm 12T)`
    switch (selectedMetric) {
      case "days":
        return {
          title: "Biểu đồ Phân tích Số Ngày Vận hành",
          badge: "Số ngày vận hành (Mặc định)",
          unit: "ngày",
          desc: isYtdMode
            ? `Tổng số ngày vận hành thực tế ngoài biển từ Tháng 1 đến Tháng ${ytdMonthCount} năm ${selectedYear} so với cùng kỳ năm ${compareYear}`
            : `Tổng số ngày vận hành thực tế năm ${selectedYear} so với toàn bộ cả năm ${compareYear} (12 tháng)`,
          keyA: "daysA",
          keyB: "daysB",
          cumKeyA: "cumDaysA",
          cumKeyB: "cumDaysB",
          nameA: `Số ngày Năm ${selectedYear}`,
          nameB: `Số ngày Năm ${compareYear} ${compareLabel}`,
          formatter: (v: number) => `${v} ngày`,
        }
      case "revenue":
        return {
          title: "Biểu đồ Phân tích Doanh thu & Tiến độ",
          badge: "Doanh thu (Doanh nghiệp · Admin)",
          unit: "USD",
          desc: isYtdMode
            ? `Doanh thu hợp đồng phát sinh từ Tháng 1 đến Tháng ${ytdMonthCount} năm ${selectedYear} so với cùng kỳ năm ${compareYear}`
            : `Doanh thu hợp đồng phát sinh năm ${selectedYear} so với toàn bộ cả năm ${compareYear} (12 tháng)`,
          keyA: "revA",
          keyB: "revB",
          cumKeyA: "cumRevA",
          cumKeyB: "cumRevB",
          nameA: `Doanh thu Năm ${selectedYear}`,
          nameB: `Doanh thu Năm ${compareYear} ${compareLabel}`,
          formatter: (v: number) => fmtUSD(v),
        }
      case "projects":
        return {
          title: "Biểu đồ Phân tích Số Lượng Dự án",
          badge: "Số lượng dự án (Project Count)",
          unit: "DA",
          desc: isYtdMode
            ? `Số lượng dự án triển khai từ Tháng 1 đến Tháng ${ytdMonthCount} năm ${selectedYear} so với cùng kỳ năm ${compareYear}`
            : `Số lượng dự án triển khai năm ${selectedYear} so với toàn bộ cả năm ${compareYear} (12 tháng)`,
          keyA: "countA",
          keyB: "countB",
          cumKeyA: "cumCountA",
          cumKeyB: "cumCountB",
          nameA: `Số dự án Năm ${selectedYear}`,
          nameB: `Số dự án Năm ${compareYear} ${compareLabel}`,
          formatter: (v: number) => `${v} DA`,
        }
      case "rov_fleet":
        return {
          title: "Biểu đồ Ngày Vận hành 04 Thiết bị ROV Chủ lực",
          badge: "Phân bổ 04 Thiết bị ROV",
          unit: "ngày",
          desc: `Phân bổ số ngày vận hành theo từng hệ thống ROV trong năm ${selectedYear}`,
          keyA: "daysA",
          keyB: "daysB",
          cumKeyA: "cumDaysA",
          cumKeyB: "cumDaysB",
          nameA: `ROV Năm ${selectedYear}`,
          nameB: `ROV Năm ${compareYear} ${compareLabel}`,
          formatter: (v: number) => `${v} ngày`,
        }
    }
  }, [selectedMetric, selectedYear, compareYear, isYtdMode, ytdMonthCount])

  return (
    <div className={`mb-6 rounded-2xl border shadow-xl overflow-hidden backdrop-blur-xl transition-colors duration-200 ${
      isLight
        ? "bg-white border-slate-300 text-slate-900 shadow-md"
        : isNeutral
        ? "bg-[#1e222a] border-neutral-700 text-neutral-100 shadow-xl"
        : "bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/90 border-slate-700/80 text-white shadow-2xl"
    }`}>
      {/* ── HEADER BAR ────────────────────────────────────────── */}
      <div className={`px-4 sm:px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 ${
        isLight
          ? "bg-slate-100/95 border-slate-300"
          : isNeutral
          ? "bg-[#181a20] border-neutral-700"
          : "bg-gradient-to-r from-cyan-950/60 via-blue-950/40 to-slate-900/80 border-slate-800"
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl border flex-shrink-0 ${
            isLight
              ? "bg-blue-100 border-blue-300 text-blue-800 shadow-2xs"
              : isNeutral
              ? "bg-cyan-950/40 border-cyan-700/50 text-cyan-300"
              : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
          }`}>
            <BarChart3 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className={`text-sm sm:text-base font-extrabold flex items-center gap-2 flex-wrap ${
              isLight ? "text-slate-950" : isNeutral ? "text-neutral-100" : "text-white"
            }`}>
              <span>{metricInfo.title}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                isLight
                  ? "bg-blue-50 text-blue-900 border-blue-300 shadow-2xs"
                  : isNeutral
                  ? "bg-cyan-950/60 text-cyan-300 border-cyan-700/60"
                  : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
              }`}>
                {metricInfo.badge}
              </span>
            </h3>
            <p className={`text-[11px] font-semibold mt-0.5 truncate ${isLight ? "text-slate-700" : "text-slate-400"}`}>
              {metricInfo.desc}
            </p>
          </div>
        </div>

        {/* ── CONTROLS & DROPDOWNS ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. DANH SÁCH SỔ XUỐNG CHỌN CHỈ SỐ BIỂU ĐỒ (YÊU CẦU NGƯỜI DÙNG) */}
          <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1 text-xs shadow-2xs ${
            isLight
              ? "bg-white border-slate-300 text-slate-900"
              : isNeutral
              ? "bg-[#282d38] border-neutral-600 text-neutral-100"
              : "bg-slate-800/90 border-slate-700 text-slate-200"
          }`}>
            <span className={`text-[11px] font-bold ${isLight ? "text-slate-800" : "text-slate-400"}`}>
              Chỉ số:
            </span>
            <select
              value={selectedMetric}
              onChange={(e) => handleMetricChange(e.target.value as ChartMetric)}
              className={`bg-transparent font-extrabold text-xs focus:outline-none cursor-pointer ${
                isLight ? "text-blue-900" : "text-cyan-300"
              }`}
            >
              <option value="days" className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
                📅 Số ngày vận hành (Ngày) (Mặc định)
              </option>
              <option value="projects" className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
                📁 Số lượng dự án (DA)
              </option>
              <option value="revenue" className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
                💰 Doanh thu (USD) {!effectiveRevenueUnlocked ? "🔒 Cần phân quyền" : "✓"}
              </option>
              <option value="rov_fleet" className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
                ⚓ 04 Thiết bị ROV (Fleet Days)
              </option>
            </select>
          </div>

          {/* 2. CHỌN NĂM PHÂN TÍCH */}
          <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1 text-xs shadow-2xs ${
            isLight
              ? "bg-white border-slate-300 text-slate-900"
              : isNeutral
              ? "bg-[#282d38] border-neutral-600 text-neutral-100"
              : "bg-slate-800/90 border-slate-700 text-slate-200"
          }`}>
            <span className={`text-[11px] font-bold ${isLight ? "text-slate-800" : "text-slate-400"}`}>Năm:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`bg-transparent font-extrabold focus:outline-none cursor-pointer ${
                isLight ? "text-blue-900" : "text-cyan-300"
              }`}
            >
              {availableYears.map(y => (
                <option key={y} value={y} className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>Năm {y}</option>
              ))}
            </select>
          </div>

          {/* 3. CHỌN NĂM CÙNG KỲ */}
          <div className={`flex items-center gap-1.5 border rounded-xl px-2.5 py-1 text-xs shadow-2xs ${
            isLight
              ? "bg-white border-slate-300 text-slate-900"
              : isNeutral
              ? "bg-[#282d38] border-neutral-600 text-neutral-100"
              : "bg-slate-800/90 border-slate-700 text-slate-200"
          }`}>
            <span className={`text-[11px] font-bold ${isLight ? "text-slate-800" : "text-slate-400"}`}>Cùng kỳ:</span>
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className={`bg-transparent font-extrabold focus:outline-none cursor-pointer ${
                isLight ? "text-amber-900" : "text-amber-300"
              }`}
            >
              {availableYears.filter(y => y !== selectedYear).map(y => (
                <option key={y} value={y} className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>Năm {y}</option>
              ))}
            </select>
          </div>

          {/* 4. TOGGLE THU GỌN / MỞ RỘNG */}
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className={`p-1.5 rounded-xl border transition shadow-2xs ${
              isLight
                ? "border-slate-300 bg-white text-slate-800 hover:text-slate-950 hover:bg-slate-100"
                : isNeutral
                ? "border-neutral-600 bg-[#282d38] text-neutral-300 hover:text-white hover:bg-[#323946]"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
            }`}
            title={isOpen ? "Thu gọn biểu đồ" : "Mở rộng biểu đồ"}
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── MODAL ĐĂNG NHẬP ADMIN ĐỂ XEM DOANH THU HOẶC SỬA DỰ ÁN ──────────────── */}
      {showAdminPrompt && (
        typeof document !== "undefined" ? createPortal(
          <div className="fixed inset-0 z-[100005] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in">
            <div className={`w-full max-w-sm rounded-2xl p-5 shadow-2xl border text-center animate-in zoom-in-95 duration-150 ${
              isLight
                ? "bg-white border-slate-300 text-slate-900"
                : "bg-slate-900 border-slate-700 text-white shadow-black/80"
            }`}>
              <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold">
                {adminPromptReason === "edit"
                  ? "Xác thực Quyền Quản trị viên (Admin)"
                  : "Xác thực Quyền xem Doanh thu"}
              </h4>
              <p className={`text-xs mt-1 leading-relaxed ${isLight ? "text-slate-700 font-medium" : "text-slate-400"}`}>
                {adminPromptReason === "edit"
                  ? "Bạn cần quyền Admin để chỉnh sửa thông tin dự án, số hợp đồng, đợt tạm ngưng và điều động nhân sự ROV."
                  : "Số liệu Doanh thu được phân quyền bảo mật. Vui lòng nhập mật khẩu Admin hoặc mật khẩu được phân quyền để mở khóa biểu đồ và bảng dữ liệu doanh thu."}
              </p>

              <form onSubmit={handleAdminSubmit} className="mt-4 space-y-3">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => { setAdminPassword(e.target.value); setAdminError("") }}
                  placeholder="Nhập mật khẩu (Admin / Phân quyền)..."
                  autoFocus
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none ${
                    isLight
                      ? "bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500 focus:border-blue-500"
                      : "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400"
                  }`}
                />
                {adminError && <p className="text-xs text-rose-600 font-bold">{adminError}</p>}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowAdminPrompt(false); setAdminPassword(""); setAdminError(""); setPendingEditProj(null) }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                      isLight ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition"
                  >
                    {adminPromptReason === "edit" ? "Xác nhận & Mở chế độ Sửa" : "Mở khóa Doanh thu"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        ) : null
      )}

      {isOpen && (
        <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
          {/* ── BỘ CHỌN CHUẨN SO SÁNH: CÙNG KỲ (YTD) VS CẢ NĂM (FULL YEAR) ── */}
          <div className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 text-xs ${
            isLight
              ? "bg-slate-50 border-slate-300 text-slate-800 shadow-2xs"
              : isNeutral
              ? "bg-[#252a35] border-neutral-700 text-neutral-200"
              : "bg-slate-800/60 border-slate-700 text-slate-300"
          }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-bold flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Chuẩn so sánh:
              </span>
              <div className={`inline-flex p-0.5 rounded-lg border ${
                isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700"
              }`}>
                <button
                  type="button"
                  onClick={() => setCompareScope("ytd")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    compareScope === "ytd"
                      ? isLight
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-blue-600 text-white shadow-xs"
                      : isLight
                      ? "text-slate-700 hover:text-slate-950 hover:bg-slate-50"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={`So sánh cùng kỳ: Đúng ${ytdMonthCount} tháng (T1-T${ytdMonthCount}) của cả 2 năm`}
                >
                  <span>🎯 Lũy kế cùng kỳ (YTD: T1–T{ytdMonthCount})</span>
                  {hasOngoingYear && (
                    <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                      compareScope === "ytd"
                        ? "bg-blue-800 text-blue-100"
                        : isLight
                        ? "bg-blue-100 text-blue-800"
                        : "bg-blue-950 text-blue-300"
                    }`}>
                      Chuẩn 1:1
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setCompareScope("full")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    compareScope === "full"
                      ? isLight
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-amber-600 text-white shadow-xs"
                      : isLight
                      ? "text-slate-700 hover:text-slate-950 hover:bg-slate-50"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={`So sánh với toàn bộ 12 tháng năm ${compareYear} (${summaryB_Full.days} ngày)`}
                >
                  <span>📅 So với Cả năm trước (12 Tháng)</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${
                    compareScope === "full"
                      ? "bg-amber-800 text-amber-100"
                      : isLight
                      ? "bg-amber-100 text-amber-800"
                      : "bg-amber-950 text-amber-300"
                  }`}>
                    Tiến độ
                  </span>
                </button>
              </div>
            </div>

            <div className={`text-[11px] font-semibold italic flex items-center gap-1 ${
              isLight ? "text-slate-700" : "text-slate-400"
            }`}>
              {isYtdMode ? (
                <span className={isLight ? "text-blue-900" : "text-cyan-300"}>
                  ✓ Đã đồng bộ chuẩn: So sánh đúng <b>{ytdMonthCount} tháng</b> (Tháng 1 → Tháng {ytdMonthCount}) của cả hai năm {selectedYear} và {compareYear}.
                </span>
              ) : (
                <span className={isLight ? "text-amber-900" : "text-amber-300"}>
                  ℹ Đang so sánh tiến độ năm {selectedYear} (tới nay) với <b>toàn bộ 12 tháng</b> năm {compareYear} ({summaryB_Full.days} ngày).
                </span>
              )}
            </div>
          </div>

          {/* ── QUICK KPI COMPARISON ROW (THÍCH ỨNG THEO CHUẨN SO SÁNH) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* CARD 1: TỔNG SỐ NGÀY VẬN HÀNH (MẶC ĐỊNH) */}
            <div className={`p-3 rounded-xl border text-xs ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-900 shadow-2xs"
                : isNeutral
                ? "bg-[#252a35] border-neutral-700 text-neutral-100"
                : "bg-slate-800/50 border-slate-700/60"
            }`}>
              <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                <span>{isYtdMode ? `Ngày VH (T1–T${ytdMonthCount})` : `Ngày vận hành ${selectedYear}`}</span>
                <span className={`font-mono ${isLight ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                  {isYtdMode ? `CK: ${summaryB.days} ngày` : `Cả năm ${compareYear}: ${summaryB_Full.days}d`}
                </span>
              </div>
              <p className={`text-base sm:text-lg font-black font-mono ${isLight ? "text-amber-900" : "text-amber-300"}`}>
                {summaryA.days.toLocaleString("en-US")} <span className="text-xs font-semibold">ngày</span>
              </p>
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-bold flex-wrap ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                {isYtdMode ? (
                  <>
                    <span>Chênh lệch:</span>
                    <b className={totalDaysDiff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                      {totalDaysDiff >= 0 ? `+${totalDaysDiff}` : totalDaysDiff} ngày ({totalDaysGrowthPct >= 0 ? `+${totalDaysGrowthPct.toFixed(1)}%` : `${totalDaysGrowthPct.toFixed(1)}%`})
                    </b>
                  </>
                ) : (
                  <span className={isLight ? "text-amber-900" : "text-amber-300"}>
                    Đạt <b>{fullYearDaysPct}%</b> cả năm {compareYear} ({totalDaysDiff >= 0 ? `+${totalDaysDiff}` : totalDaysDiff}d)
                  </span>
                )}
              </div>
            </div>

            {/* CARD 2: SỐ LƯỢNG DỰ ÁN */}
            <div className={`p-3 rounded-xl border text-xs ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-900 shadow-2xs"
                : isNeutral
                ? "bg-[#252a35] border-neutral-700 text-neutral-100"
                : "bg-slate-800/50 border-slate-700/60"
            }`}>
              <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                <span>{isYtdMode ? `Số dự án (T1–T${ytdMonthCount})` : `Số dự án ${selectedYear}`}</span>
                <span className={`font-mono ${isLight ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                  {isYtdMode ? `CK: ${summaryB.count} DA` : `Cả năm ${compareYear}: ${summaryB_Full.count} DA`}
                </span>
              </div>
              <p className={`text-base sm:text-lg font-black ${isLight ? "text-blue-900" : "text-cyan-300"}`}>
                {summaryA.count} <span className="text-xs font-semibold">dự án</span>
              </p>
              <div className={`flex items-center gap-1 mt-1 text-[11px] font-bold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                {isYtdMode ? (
                  <>
                    <span>Chênh lệch:</span>
                    <b className={totalCountDiff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                      {totalCountDiff >= 0 ? `+${totalCountDiff}` : totalCountDiff} DA
                    </b>
                  </>
                ) : (
                  <span className={totalCountDiff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-amber-900" : "text-amber-300")}>
                    {totalCountDiff >= 0 ? `Vượt cả năm trước: +${totalCountDiff} DA` : `Đạt ${fullYearCountPct}% cả năm ${compareYear}`}
                  </span>
                )}
              </div>
            </div>

            {/* CARD 3: THỜI GIAN TRUNG BÌNH / DỰ ÁN */}
            {(() => {
              const avgA = summaryA.count ? Math.round(summaryA.days / summaryA.count) : 0
              const avgB = isYtdMode
                ? (summaryB.count ? Math.round(summaryB.days / summaryB.count) : 0)
                : (summaryB_Full.count ? Math.round(summaryB_Full.days / summaryB_Full.count) : 0)
              const diffAvg = avgA - avgB

              return (
                <div className={`p-3 rounded-xl border text-xs ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900 shadow-2xs"
                    : isNeutral
                    ? "bg-[#252a35] border-neutral-700 text-neutral-100"
                    : "bg-slate-800/50 border-slate-700/60"
                }`}>
                  <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                    <span>Thời gian TB / Dự án</span>
                    <span className={`font-mono ${isLight ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                      {isYtdMode ? `CK: ${avgB}d` : `Cả năm: ${avgB}d`}
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-black font-mono ${isLight ? "text-purple-900" : "text-purple-300"}`}>
                    {avgA} <span className="text-xs font-semibold">ngày/DA</span>
                  </p>
                  <div className={`flex items-center gap-1 mt-1 text-[11px] font-bold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                    <span>Chênh lệch:</span>
                    <b className={diffAvg >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                      {diffAvg >= 0 ? `+${diffAvg}` : diffAvg} ngày/DA
                    </b>
                  </div>
                </div>
              )
            })()}

            {/* CARD 4: DOANH THU HỢP ĐỒNG (USD) */}
            <div className={`p-3 rounded-xl border text-xs ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-900 shadow-2xs"
                : isNeutral
                ? "bg-[#252a35] border-neutral-700 text-neutral-100"
                : "bg-slate-800/50 border-slate-700/60"
            }`}>
              {effectiveRevenueUnlocked ? (
                <>
                  <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                    <span>{isYtdMode ? `Doanh thu (T1–T${ytdMonthCount})` : `Doanh thu ${selectedYear}`}</span>
                    <span className={`font-mono ${isLight ? "text-slate-700 font-semibold" : "text-slate-400"}`}>
                      {isYtdMode ? `CK: ${fmtKMB(summaryB.rev)}` : `Cả năm: ${fmtKMB(summaryB_Full.rev)}`}
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-black font-mono ${isLight ? "text-emerald-900" : "text-emerald-400"}`}>
                    {fmtUSD(summaryA.rev)}
                  </p>
                  <p className={`text-[10px] font-bold mt-1 ${isLight ? "text-slate-700" : "text-slate-400"}`}>
                    {isYtdMode
                      ? (totalRevDiff >= 0 ? `+${fmtUSD(totalRevDiff)} so với cùng kỳ` : `${fmtUSD(totalRevDiff)} so với cùng kỳ`)
                      : `Đạt ${fullYearRevPct}% cả năm ${compareYear}`}
                  </p>
                </>
              ) : (
                <>
                  <div className={`flex items-center justify-between text-[11px] font-bold mb-1 ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                    <span>Doanh thu {selectedYear}</span>
                    <span className="text-[10px] text-amber-500 font-bold flex items-center gap-0.5">
                      <Lock className="w-3 h-3" /> Bảo mật
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-black font-mono tracking-wider ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                    •••••••• <span className="text-xs font-semibold">USD</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setAdminPromptReason("revenue"); setShowAdminPrompt(true) }}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-bold underline mt-1 flex items-center gap-1 cursor-pointer"
                  >
                    <Lock className="w-3 h-3" /> Nhập mật khẩu mở khóa
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── SUB NAVIGATION TABS & CHART TYPE TOGGLE ─────────────── */}
          <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-2.5 ${
            isLight ? "border-slate-300" : isNeutral ? "border-neutral-700" : "border-slate-800"
          }`}>
            {/* View Mode Tabs */}
            <div className={`flex items-center gap-1.5 p-1 rounded-xl border text-xs shadow-2xs ${
              isLight
                ? "bg-slate-100 border-slate-300 text-slate-800"
                : isNeutral
                ? "bg-[#181a20] border-neutral-700"
                : "bg-slate-900 border-slate-800"
            }`}>
              <button
                type="button"
                onClick={() => setChartTab("monthly")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs select-none ${
                  chartTab === "monthly"
                    ? isLight
                      ? "bg-blue-700 text-white font-extrabold shadow-sm"
                      : "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/40"
                    : isLight
                    ? "text-slate-800 hover:text-slate-950 font-bold hover:bg-slate-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" /> Theo tháng (Monthly)
              </button>
              <button
                type="button"
                onClick={() => setChartTab("cumulative")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs select-none ${
                  chartTab === "cumulative"
                    ? isLight
                      ? "bg-blue-700 text-white font-extrabold shadow-sm"
                      : "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/40"
                    : isLight
                    ? "text-slate-800 hover:text-slate-950 font-bold hover:bg-slate-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" /> Lũy kế năm (YTD)
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTab("rov_matrix")
                  setRovViewMode("matrix")
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs select-none ${
                  chartTab === "rov_matrix"
                    ? isLight
                      ? "bg-blue-700 text-white font-extrabold shadow-sm"
                      : "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/40"
                    : isLight
                    ? "text-slate-800 hover:text-slate-950 font-bold hover:bg-slate-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Bảng 12 Tháng 4 ROV
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTab("table")
                  setRovViewMode("compare")
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition text-xs select-none ${
                  chartTab === "table"
                    ? isLight
                      ? "bg-blue-700 text-white font-extrabold shadow-sm"
                      : "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-900/40"
                    : isLight
                    ? "text-slate-800 hover:text-slate-950 font-bold hover:bg-slate-200"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" /> Bảng so sánh cùng kỳ
              </button>
            </div>

            {/* Chart Type Toggle & Legend */}
            <div className="flex items-center gap-3">
              {chartTab !== "table" && selectedMetric !== "rov_fleet" && (
                <div className={`flex items-center gap-1 p-1 rounded-xl border text-xs shadow-2xs ${
                  isLight
                    ? "bg-slate-100 border-slate-300"
                    : isNeutral
                    ? "bg-[#181a20] border-neutral-700"
                    : "bg-slate-900 border-slate-800"
                }`}>
                  <button
                    type="button"
                    onClick={() => setVisualType("bar")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      visualType === "bar"
                        ? isLight
                          ? "bg-white text-blue-900 shadow-xs border border-slate-300"
                          : "bg-slate-800 text-cyan-300 shadow-xs"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Cột (Bar)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualType("line")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      visualType === "line"
                        ? isLight
                          ? "bg-white text-blue-900 shadow-xs border border-slate-300"
                          : "bg-slate-800 text-cyan-300 shadow-xs"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Đường (Line)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisualType("area")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      visualType === "area"
                        ? isLight
                          ? "bg-white text-blue-900 shadow-xs border border-slate-300"
                          : "bg-slate-800 text-cyan-300 shadow-xs"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Vùng (Area)
                  </button>
                </div>
              )}

              {/* Legend preview */}
              <div className={`hidden md:flex items-center gap-3 text-xs font-bold ${
                isLight ? "text-slate-900" : "text-slate-300"
              }`}>
                {selectedMetric === "rov_fleet" ? (
                  <>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-cyan-500" /> Quasar II-30</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Compact 07</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Panther 954</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-500" /> Panther 911</span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Năm {selectedYear}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded inline-block ${isLight ? "bg-slate-400" : "bg-slate-600"}`} /> Năm {compareYear} (Cùng kỳ)
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 1: BIỂU ĐỒ THEO THÁNG (MONTHLY)
          ═══════════════════════════════════════════════════════════════ */}
          {chartTab === "monthly" && (
            <div className="space-y-2">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {selectedMetric === "rov_fleet" ? (
                    // Phân bổ 04 ROV Stacked Bar
                    <BarChart data={comparisonData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} opacity={0.7} vertical={false} />
                      <XAxis dataKey="name" stroke={isLight ? "#0f172a" : "#94a3b8"} fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis
                        stroke={isLight ? "#0f172a" : "#94a3b8"}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v}d`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            return (
                              <div className={`p-3 rounded-xl border shadow-2xl text-xs space-y-1.5 ${
                                isLight
                                  ? "bg-white border-slate-300 text-slate-900 shadow-xl"
                                  : "bg-slate-900/95 border-slate-700 text-white"
                              }`}>
                                <p className={`font-black border-b pb-1 ${isLight ? "text-slate-950 border-slate-200" : "text-white border-slate-800"}`}>
                                  {data.fullName} – Năm {selectedYear}
                                </p>
                                <div className="space-y-1 pt-0.5">
                                  <p className="flex justify-between gap-4 text-cyan-600 font-bold">
                                    <span>⚓ Quasar MKII-30:</span> <b>{data.quasar30DaysA} ngày</b>
                                  </p>
                                  <p className="flex justify-between gap-4 text-emerald-600 font-bold">
                                    <span>⚓ Compact 07:</span> <b>{data.compact07DaysA} ngày</b>
                                  </p>
                                  <p className="flex justify-between gap-4 text-amber-600 font-bold">
                                    <span>⚓ Panther Plus 954:</span> <b>{data.panther954DaysA} ngày</b>
                                  </p>
                                  <p className="flex justify-between gap-4 text-purple-600 font-bold">
                                    <span>⚓ Panther Plus 911:</span> <b>{data.panther911DaysA} ngày</b>
                                  </p>
                                </div>
                                <div className={`pt-1 border-t flex justify-between font-black ${isLight ? "border-slate-200 text-slate-950" : "border-slate-800 text-white"}`}>
                                  <span>Tổng ngày tháng:</span>
                                  <span>{data.daysA} ngày</span>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", fontWeight: 700 }} />
                      <Bar dataKey="quasar30DaysA" name="Quasar MKII-30" stackId="a" fill="#06b6d4" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="compact07DaysA" name="Quasar Compact 07" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="panther954DaysA" name="Panther Plus 954" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="panther911DaysA" name="Panther Plus 911" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : visualType === "line" ? (
                    // Line Chart
                    <LineChart data={comparisonData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} opacity={0.7} vertical={false} />
                      <XAxis dataKey="name" stroke={isLight ? "#0f172a" : "#94a3b8"} fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis
                        stroke={isLight ? "#0f172a" : "#94a3b8"}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={selectedMetric === "revenue" ? fmtKMB : (v) => `${v}${metricInfo.unit}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            const valA = data[metricInfo.keyA]
                            const valB = data[metricInfo.keyB]
                            return (
                              <div className={`p-3 rounded-xl border shadow-2xl text-xs space-y-1.5 ${
                                isLight ? "bg-white border-slate-300 text-slate-900 shadow-xl" : "bg-slate-900/95 border-slate-700 text-white"
                              }`}>
                                <p className={`font-black border-b pb-1 ${isLight ? "text-slate-950 border-slate-200" : "text-white border-slate-800"}`}>{data.fullName}</p>
                                <div className="flex items-center justify-between gap-4 font-bold text-blue-700">
                                  <span>Năm {selectedYear}:</span>
                                  <span className="font-mono">{metricInfo.formatter(valA)}</span>
                                </div>
                                <div className={`flex items-center justify-between gap-4 font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                  <span>Năm {compareYear} (CK):</span>
                                  <span className="font-mono">{metricInfo.formatter(valB)}</span>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", fontWeight: 700 }} />
                      <Line type="monotone" dataKey={metricInfo.keyA} name={metricInfo.nameA} stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey={metricInfo.keyB} name={metricInfo.nameB} stroke={isLight ? "#64748b" : "#94a3b8"} strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
                    </LineChart>
                  ) : visualType === "area" ? (
                    // Area Chart
                    <AreaChart data={comparisonData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorAreaA" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} opacity={0.7} vertical={false} />
                      <XAxis dataKey="name" stroke={isLight ? "#0f172a" : "#94a3b8"} fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis
                        stroke={isLight ? "#0f172a" : "#94a3b8"}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={selectedMetric === "revenue" ? fmtKMB : (v) => `${v}${metricInfo.unit}`}
                      />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", fontWeight: 700 }} />
                      <Area type="monotone" dataKey={metricInfo.keyA} name={metricInfo.nameA} stroke="#2563eb" strokeWidth={2.5} fill="url(#colorAreaA)" />
                      <Area type="monotone" dataKey={metricInfo.keyB} name={metricInfo.nameB} stroke={isLight ? "#64748b" : "#94a3b8"} strokeWidth={1.5} strokeDasharray="3 3" fill="transparent" />
                    </AreaChart>
                  ) : (
                    // Bar Chart (Mặc định)
                    <BarChart data={comparisonData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} opacity={0.7} vertical={false} />
                      <XAxis dataKey="name" stroke={isLight ? "#0f172a" : "#94a3b8"} fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis
                        stroke={isLight ? "#0f172a" : "#94a3b8"}
                        fontSize={11}
                        fontWeight={600}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={selectedMetric === "revenue" ? fmtKMB : (v) => `${v}${metricInfo.unit}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload
                            const valA = data[metricInfo.keyA]
                            const valB = data[metricInfo.keyB]
                            return (
                              <div className={`p-3 rounded-xl border shadow-2xl text-xs space-y-1.5 ${
                                isLight
                                  ? "bg-white border-slate-300 text-slate-900 shadow-xl"
                                  : "bg-slate-900/95 border-slate-700 text-white"
                              }`}>
                                <p className={`font-black border-b pb-1 ${isLight ? "text-slate-950 border-slate-200" : "text-white border-slate-800"}`}>
                                  {data.fullName}
                                </p>
                                <div className="flex items-center justify-between gap-4 font-bold text-blue-700">
                                  <span>Năm {selectedYear}:</span>
                                  <span className="font-mono">
                                    {metricInfo.formatter(valA)}
                                  </span>
                                </div>
                                <div className={`flex items-center justify-between gap-4 font-semibold ${isLight ? "text-slate-700" : "text-slate-300"}`}>
                                  <span>Năm {compareYear} (CK):</span>
                                  <span className="font-mono">
                                    {metricInfo.formatter(valB)}
                                  </span>
                                </div>
                                <div className={`pt-1 border-t flex items-center justify-between gap-4 font-bold ${
                                  valA - valB >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")
                                }`}>
                                  <span>Chênh lệch:</span>
                                  <span>{valA - valB >= 0 ? `+${metricInfo.formatter(valA - valB)}` : metricInfo.formatter(valA - valB)}</span>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", fontWeight: 700 }} />
                      <Bar dataKey={metricInfo.keyA} name={metricInfo.nameA} fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey={metricInfo.keyB} name={metricInfo.nameB} fill={isLight ? "#94a3b8" : "#64748b"} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              <p className={`text-[11px] text-center font-semibold italic ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                * {metricInfo.desc}.
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 2: BIỂU ĐỒ LŨY KẾ NĂM (YTD CUMULATIVE)
          ═══════════════════════════════════════════════════════════════ */}
          {chartTab === "cumulative" && (
            <div className="space-y-2">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={comparisonData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorCumA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorCumB" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} opacity={0.7} vertical={false} />
                    <XAxis dataKey="name" stroke={isLight ? "#0f172a" : "#94a3b8"} fontSize={11} fontWeight={600} tickLine={false} />
                    <YAxis
                      stroke={isLight ? "#0f172a" : "#94a3b8"}
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={selectedMetric === "revenue" ? fmtKMB : (v) => `${v}${metricInfo.unit}`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload
                          const cumA = data[metricInfo.cumKeyA]
                          const cumB = data[metricInfo.cumKeyB]
                          return (
                            <div className={`p-3 rounded-xl border shadow-2xl text-xs space-y-1.5 ${
                              isLight ? "bg-white border-slate-300 text-slate-900 shadow-xl" : "bg-slate-900/95 border-slate-700 text-white"
                            }`}>
                              <p className={`font-black border-b pb-1 ${isLight ? "text-slate-950 border-slate-200" : "text-white border-slate-800"}`}>
                                Lũy kế đến {data.fullName}
                              </p>
                              <div className="flex items-center justify-between gap-4 font-bold text-blue-700">
                                <span>Lũy kế {selectedYear}:</span>
                                <span className="font-mono">{metricInfo.formatter(cumA)}</span>
                              </div>
                              <div className={`flex items-center justify-between gap-4 font-semibold ${isLight ? "text-purple-800" : "text-purple-300"}`}>
                                <span>Lũy kế {compareYear}:</span>
                                <span className="font-mono">{metricInfo.formatter(cumB)}</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px", fontWeight: 700 }} />
                    <Area
                      type="monotone"
                      dataKey={metricInfo.cumKeyA}
                      name={`Lũy kế Năm ${selectedYear}`}
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorCumA)"
                    />
                    <Area
                      type="monotone"
                      dataKey={metricInfo.cumKeyB}
                      name={`Lũy kế Năm ${compareYear} (Cùng kỳ)`}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorCumB)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className={`text-[11px] text-center font-semibold italic ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                * Đường lũy kế thể hiện tổng tích lũy cộng dồn từ đầu năm (Tháng 1) đến cuối năm.
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAB 3 & 4: BẢNG SỐ NGÀY 12 THÁNG THEO TỪNG ROV & SO SÁNH
          ═══════════════════════════════════════════════════════════════ */}
          {(chartTab === "rov_matrix" || chartTab === "table") && (
            <div className="space-y-3">
              {/* THANH ĐIỀU KHIỂN & XUẤT EXCEL */}
              <div className={`p-2.5 sm:p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2.5 shadow-2xs ${
                isLight ? "bg-slate-100/90 border-slate-300" : isNeutral ? "bg-[#181a20] border-neutral-700" : "bg-slate-900/90 border-slate-800"
              }`}>
                {/* Chế độ xem: Ma trận 4 ROV x 12 Tháng / Theo 12 Tháng / So sánh cùng kỳ */}
                <div className={`flex items-center gap-1 p-1 rounded-lg border text-xs ${
                  isLight ? "bg-white border-slate-300" : "bg-slate-950/70 border-slate-800"
                }`}>
                  <button
                    type="button"
                    onClick={() => { setChartTab("rov_matrix"); setRovViewMode("matrix") }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      (chartTab === "rov_matrix" || chartTab === "table") && rovViewMode === "matrix"
                        ? isLight ? "bg-blue-700 text-white shadow-xs" : "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Ma trận 4 ROV x 12 Tháng
                  </button>

                  <button
                    type="button"
                    onClick={() => { setChartTab("rov_matrix"); setRovViewMode("timeline") }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      (chartTab === "rov_matrix" || chartTab === "table") && rovViewMode === "timeline"
                        ? isLight ? "bg-blue-700 text-white shadow-xs" : "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" /> Theo 12 Tháng
                  </button>

                  <button
                    type="button"
                    onClick={() => { setChartTab("table"); setRovViewMode("compare") }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      chartTab === "table" && rovViewMode === "compare"
                        ? isLight ? "bg-blue-700 text-white shadow-xs" : "bg-cyan-600 text-white shadow-md shadow-cyan-950/50"
                        : isLight ? "text-slate-700 hover:text-slate-950" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" /> So sánh Cùng kỳ ({selectedYear} vs {compareYear})
                  </button>
                </div>

                {/* Chọn Tháng báo cáo lũy kế & Nút Xuất file Excel/CSV */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1 text-xs ${
                    isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-950/80 border-slate-700 text-slate-300"
                  }`}>
                    <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-400">Tháng báo cáo lũy kế:</span>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(Number(e.target.value))}
                      className="bg-transparent font-bold focus:outline-none cursor-pointer text-amber-400 text-xs"
                      title="Chọn tháng kết thúc kỳ báo cáo để tính lũy kế"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m} className={isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
                          Tháng {m} {m === 10 ? "(Hiện tại)" : m === 3 ? "(Hết Q1)" : m === 6 ? "(Hết 6T)" : m === 9 ? "(Hết Q3)" : m === 12 ? "(Cả năm)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Nút Xuất Excel */}
                  <button
                    type="button"
                    onClick={handleExportROVExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer"
                    title="Tải bảng số liệu 12 tháng theo từng ROV dạng file Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Xuất file Excel (.xlsx)
                  </button>

                  {/* Nút Xuất CSV */}
                  <button
                    type="button"
                    onClick={handleExportROVCSV}
                    className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                      isLight
                        ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                    title="Tải tệp CSV (UTF-8 BOM)"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              </div>

              {/* ── BẢNG 1: MA TRẬN 4 ROV X 12 THÁNG (ROV Rows, 12 Month Columns) ── */}
              {rovViewMode === "matrix" && (
                <div className={`rounded-xl border overflow-hidden shadow-2xs ${
                  isLight ? "border-slate-300 bg-white" : isNeutral ? "border-neutral-700 bg-[#181a20]" : "border-slate-800 bg-slate-900/70"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[960px]">
                      <thead className={`border-b ${
                        isLight
                          ? "bg-slate-200 text-slate-950 font-black border-slate-300"
                          : isNeutral
                          ? "bg-[#242833] text-neutral-200 border-neutral-700"
                          : "bg-slate-800/90 text-slate-300 border-slate-800"
                      }`}>
                        <tr>
                          <th className="py-2.5 px-2 text-center font-black w-10">STT</th>
                          <th className="py-2.5 px-3 text-left font-black w-44">Thiết bị ROV</th>
                          <th className="py-2.5 px-2 text-center font-black w-20">Mã</th>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const isWithinReport = m <= reportMonth
                            const isCurrentReport = m === reportMonth
                            return (
                              <th
                                key={m}
                                className={`py-2 px-2 text-center font-black text-[11px] ${
                                  isCurrentReport
                                    ? isLight ? "bg-amber-100 text-amber-950 font-black border-b-2 border-amber-500" : "bg-amber-950/60 text-amber-300 font-black border-b-2 border-amber-400"
                                    : isWithinReport
                                    ? isLight ? "text-blue-900" : "text-cyan-300"
                                    : isLight ? "text-slate-400" : "text-slate-500"
                                }`}
                                title={`Tháng ${m} ${isCurrentReport ? "(Tháng chốt báo cáo)" : ""}`}
                              >
                                T{m}
                              </th>
                            )
                          })}
                          <th className={`py-2.5 px-3 text-right font-black ${
                            isLight ? "bg-blue-100 text-blue-950" : "bg-blue-950/80 text-cyan-300"
                          }`}>
                            🎯 Lũy kế (T1→T{reportMonth})
                          </th>
                          <th className={`py-2.5 px-3 text-right font-black ${
                            isLight ? "bg-slate-100 text-slate-900" : "bg-slate-800/80 text-slate-200"
                          }`}>
                            📅 Cả năm (12T)
                          </th>
                          <th className="py-2.5 px-3 text-right font-black w-24">
                            Tỷ trọng (%)
                          </th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isLight ? "divide-slate-200 text-slate-900" : "divide-slate-800/80"}`}>
                        {rovMatrixData.rows.map((rov) => (
                          <tr
                            key={rov.id}
                            className={`transition ${
                              isLight ? "hover:bg-slate-50 even:bg-slate-50/50" : "hover:bg-slate-800/50 even:bg-slate-950/30"
                            }`}
                          >
                            <td className="py-2.5 px-2 text-center text-slate-400 font-semibold">{rov.stt}</td>
                            <td className="py-2.5 px-3 font-bold">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${rov.dotCol} flex-shrink-0`} />
                                <span className={rov.textCol}>{rov.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rov.badgeCol}`}>
                                {rov.code}
                              </span>
                            </td>
                            {rov.monthsA.map((days, mIdx) => {
                              const isWithin = mIdx + 1 <= reportMonth
                              const isCur = mIdx + 1 === reportMonth
                              return (
                                <td
                                  key={mIdx}
                                  onMouseEnter={(e) => handleCellHover(rov, mIdx, selectedYear, e)}
                                  onMouseLeave={handleCellLeave}
                                  onClick={(e) => handleCellHover(rov, mIdx, selectedYear, e, true)}
                                  className={`py-2 px-2 text-center font-mono cursor-pointer transition-all hover:bg-cyan-500/20 hover:ring-2 hover:ring-cyan-400/60 rounded-md relative ${
                                    isCur
                                      ? isLight ? "bg-amber-50/70" : "bg-amber-950/20"
                                      : ""
                                  }`}
                                  title={`Xem chi tiết dự án Tháng ${mIdx + 1} của ${rov.shortName}`}
                                >
                                  {days > 0 ? (
                                    <span className={`font-bold ${
                                      isWithin
                                        ? isLight ? "text-slate-950" : "text-white"
                                        : isLight ? "text-slate-500" : "text-slate-400"
                                    }`}>
                                      {days}
                                    </span>
                                  ) : (
                                    <span className={isLight ? "text-slate-300" : "text-slate-600"}>-</span>
                                  )}
                                </td>
                              )
                            })}
                            {/* Cột Lũy kế tới Tháng báo cáo */}
                            <td className={`py-2.5 px-3 text-right font-mono font-black ${
                              isLight ? "bg-blue-50/80 text-blue-900" : "bg-blue-950/40 text-cyan-300"
                            }`}>
                              {rov.ytdA} <span className="text-[10px] font-normal opacity-70">ngày</span>
                            </td>
                            {/* Cột Tổng Cả năm 12 tháng */}
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${
                              isLight ? "bg-slate-50 text-slate-800" : "bg-slate-950/40 text-slate-300"
                            }`}>
                              {rov.fullA} <span className="text-[10px] font-normal opacity-70">ngày</span>
                            </td>
                            {/* Cột Tỷ trọng */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-mono font-bold text-xs">{rov.shareYtdPctA}%</span>
                                <div className="w-10 h-1.5 rounded-full bg-slate-700/60 overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full ${rov.dotCol}`}
                                    style={{ width: `${Math.min(100, rov.shareYtdPctA)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* HÀNG 1: TỔNG CỘNG TOÀN ĐỘI ROV (NĂM ĐANG CHỌN) */}
                        <tr className={`font-black border-t-2 ${
                          isLight
                            ? "bg-blue-100 text-slate-950 border-blue-300"
                            : "bg-blue-950/70 text-cyan-200 border-blue-800"
                        }`}>
                          <td className="py-3 px-2 text-center" colSpan={3}>
                            <div className="flex items-center gap-1.5 justify-start pl-2">
                              <span className={isLight ? "text-blue-950 font-black" : "text-cyan-300 font-black"}>
                                🎯 TỔNG CỘNG TOÀN ĐỘI (NĂM {selectedYear})
                              </span>
                            </div>
                          </td>
                          {rovMatrixData.totalMonthsA.map((totalDays, mIdx) => (
                            <td
                              key={mIdx}
                              className={`py-3 px-2 text-center font-mono font-black ${
                                mIdx + 1 === reportMonth
                                  ? isLight ? "bg-amber-200/80 text-amber-950" : "bg-amber-900/60 text-amber-200"
                                  : isLight ? "text-blue-950" : "text-cyan-300"
                              }`}
                            >
                              {totalDays > 0 ? totalDays : "-"}
                            </td>
                          ))}
                          <td className={`py-3 px-3 text-right font-mono font-black text-sm ${
                            isLight ? "bg-blue-200/80 text-blue-950" : "bg-cyan-900/60 text-cyan-200"
                          }`}>
                            {rovMatrixData.totalYtdA} <span className="text-xs font-normal">ngày</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black">
                            {rovMatrixData.totalFullA} <span className="text-xs font-normal">ngày</span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black">100%</td>
                        </tr>

                        {/* HÀNG 2: CÙNG KỲ NĂM TRƯỚC (NĂM COMPARE) */}
                        <tr className={`font-bold border-t ${
                          isLight
                            ? "bg-slate-100 text-slate-800 border-slate-300"
                            : "bg-slate-950/80 text-slate-300 border-slate-800"
                        }`}>
                          <td className="py-2.5 px-2 text-center" colSpan={3}>
                            <div className="flex items-center gap-1.5 justify-start pl-2">
                              <span className={isLight ? "text-slate-800 font-bold" : "text-slate-400 font-bold"}>
                                📅 CÙNG KỲ NĂM {compareYear} (T1 - T{reportMonth})
                              </span>
                            </div>
                          </td>
                          {rovMatrixData.totalMonthsB.map((totalDays, mIdx) => (
                            <td key={mIdx} className="py-2.5 px-2 text-center font-mono font-semibold text-slate-400">
                              {totalDays > 0 ? totalDays : "-"}
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-400">
                            {rovMatrixData.totalYtdB} ngày
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-400">
                            {rovMatrixData.totalFullB} ngày
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">—</td>
                        </tr>

                        {/* HÀNG 3: CHÊNH LỆCH (+/- NGÀY SO VỚI CÙNG KỲ) */}
                        <tr className={`font-bold border-t ${
                          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900/90 border-slate-800"
                        }`}>
                          <td className="py-2.5 px-2 text-center" colSpan={3}>
                            <div className="flex items-center gap-1.5 justify-start pl-2 text-[11px] font-bold">
                              <span>📈 CHÊNH LỆCH (+/- NGÀY)</span>
                            </div>
                          </td>
                          {rovMatrixData.totalMonthsA.map((tA, mIdx) => {
                            const tB = rovMatrixData.totalMonthsB[mIdx]
                            const diff = tA - tB
                            return (
                              <td key={mIdx} className="py-2.5 px-2 text-center font-mono font-bold text-[11px]">
                                {diff !== 0 ? (
                                  <span className={diff > 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                    {diff > 0 ? `+${diff}` : diff}
                                  </span>
                                ) : (
                                  <span className={isLight ? "text-slate-400" : "text-slate-600"}>0</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="py-2.5 px-3 text-right font-mono font-black">
                            {(() => {
                              const diffYtd = rovMatrixData.totalYtdA - rovMatrixData.totalYtdB
                              const pctYtd = rovMatrixData.totalYtdB > 0 ? ((diffYtd / rovMatrixData.totalYtdB) * 100).toFixed(1) : "0"
                              return (
                                <span className={diffYtd >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                  {diffYtd >= 0 ? `+${diffYtd}` : diffYtd} ({Number(pctYtd) >= 0 ? `+${pctYtd}` : pctYtd}%)
                                </span>
                              )
                            })()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold">
                            {(() => {
                              const diffFull = rovMatrixData.totalFullA - rovMatrixData.totalFullB
                              return (
                                <span className={diffFull >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-amber-700" : "text-amber-400")}>
                                  {diffFull >= 0 ? `+${diffFull}` : diffFull}d
                                </span>
                              )
                            })()}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-500 font-mono">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── BẢNG 2: CHI TIẾT THEO 12 THÁNG (Month Rows, 4 ROV Columns) ── */}
              {rovViewMode === "timeline" && (
                <div className={`rounded-xl border overflow-hidden shadow-2xs ${
                  isLight ? "border-slate-300 bg-white" : isNeutral ? "border-neutral-700 bg-[#181a20]" : "border-slate-800 bg-slate-900/70"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className={`border-b ${
                        isLight
                          ? "bg-slate-200 text-slate-950 font-black border-slate-300"
                          : isNeutral
                          ? "bg-[#242833] text-neutral-200 border-neutral-700"
                          : "bg-slate-800/90 text-slate-300 border-slate-800"
                      }`}>
                        <tr>
                          <th className="py-2.5 px-3 text-left font-black">Tháng</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-cyan-900" : "text-cyan-300"}`}>Quasar II-30</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-emerald-900" : "text-emerald-300"}`}>Compact 07</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-amber-900" : "text-amber-300"}`}>Panther 954</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-rose-900" : "text-rose-300"}`}>Panther 911</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-blue-900" : "text-blue-300"}`}>Tổng Tháng ({selectedYear})</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-slate-800" : "text-slate-400"}`}>Cùng kỳ ({compareYear})</th>
                          <th className="py-2.5 px-3 text-right font-black">Chênh lệch</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-blue-950 font-black" : "text-cyan-300"}`}>Lũy kế Tích lũy</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isLight ? "divide-slate-200 text-slate-900" : "divide-slate-800/80"}`}>
                        {comparisonData.map((m) => {
                          const isWithin = m.month <= reportMonth
                          const diff = m.daysA - m.daysB
                          return (
                            <tr
                              key={m.month}
                              className={`transition ${
                                isLight ? "hover:bg-slate-50 even:bg-slate-50/50" : "hover:bg-slate-800/50 even:bg-slate-950/30"
                              }`}
                            >
                              <td className="py-2 px-3 font-bold">
                                {m.fullName}
                                {m.month === reportMonth && (
                                  <span className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                    isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-950 text-amber-300 border-amber-500/50"
                                  }`}>
                                    Kỳ báo cáo
                                  </span>
                                )}
                              </td>
                              <td
                                onMouseEnter={(e) => {
                                  const r30 = rovMatrixData.rows.find(r => r.id === "quasar-30")
                                  if (r30) handleCellHover(r30, m.month - 1, selectedYear, e)
                                }}
                                onMouseLeave={handleCellLeave}
                                onClick={(e) => {
                                  const r30 = rovMatrixData.rows.find(r => r.id === "quasar-30")
                                  if (r30) handleCellHover(r30, m.month - 1, selectedYear, e, true)
                                }}
                                className="py-2 px-3 text-right font-mono font-semibold cursor-pointer hover:bg-cyan-500/20 hover:ring-1 hover:ring-cyan-400/50 rounded"
                              >
                                {m.quasar30DaysA || "-"}
                              </td>
                              <td
                                onMouseEnter={(e) => {
                                  const r07 = rovMatrixData.rows.find(r => r.id === "compact-07")
                                  if (r07) handleCellHover(r07, m.month - 1, selectedYear, e)
                                }}
                                onMouseLeave={handleCellLeave}
                                onClick={(e) => {
                                  const r07 = rovMatrixData.rows.find(r => r.id === "compact-07")
                                  if (r07) handleCellHover(r07, m.month - 1, selectedYear, e, true)
                                }}
                                className="py-2 px-3 text-right font-mono font-semibold cursor-pointer hover:bg-cyan-500/20 hover:ring-1 hover:ring-cyan-400/50 rounded"
                              >
                                {m.compact07DaysA || "-"}
                              </td>
                              <td
                                onMouseEnter={(e) => {
                                  const r954 = rovMatrixData.rows.find(r => r.id === "panther-954")
                                  if (r954) handleCellHover(r954, m.month - 1, selectedYear, e)
                                }}
                                onMouseLeave={handleCellLeave}
                                onClick={(e) => {
                                  const r954 = rovMatrixData.rows.find(r => r.id === "panther-954")
                                  if (r954) handleCellHover(r954, m.month - 1, selectedYear, e, true)
                                }}
                                className="py-2 px-3 text-right font-mono font-semibold cursor-pointer hover:bg-cyan-500/20 hover:ring-1 hover:ring-cyan-400/50 rounded"
                              >
                                {m.panther954DaysA || "-"}
                              </td>
                              <td
                                onMouseEnter={(e) => {
                                  const r911 = rovMatrixData.rows.find(r => r.id === "panther-911")
                                  if (r911) handleCellHover(r911, m.month - 1, selectedYear, e)
                                }}
                                onMouseLeave={handleCellLeave}
                                onClick={(e) => {
                                  const r911 = rovMatrixData.rows.find(r => r.id === "panther-911")
                                  if (r911) handleCellHover(r911, m.month - 1, selectedYear, e, true)
                                }}
                                className="py-2 px-3 text-right font-mono font-semibold cursor-pointer hover:bg-cyan-500/20 hover:ring-1 hover:ring-cyan-400/50 rounded"
                              >
                                {m.panther911DaysA || "-"}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-black ${
                                isLight ? "text-blue-900" : "text-blue-300"
                              }`}>
                                {m.daysA} ngày
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-400">
                                {m.daysB} ngày
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                <span className={diff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                  {diff >= 0 ? `+${diff}` : diff}
                                </span>
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-black ${
                                isWithin
                                  ? isLight ? "text-blue-950 font-black" : "text-cyan-300"
                                  : isLight ? "text-slate-400" : "text-slate-500"
                              }`}>
                                {m.cumDaysA} ngày
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── BẢNG 3: SO SÁNH CÙNG KỲ TỔNG HỢP (COMPARE VIEW) ── */}
              {rovViewMode === "compare" && (
                <div className={`rounded-xl border overflow-hidden shadow-2xs ${
                  isLight ? "border-slate-300 bg-white" : isNeutral ? "border-neutral-700 bg-[#181a20]" : "border-slate-800 bg-slate-900/60"
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className={`border-b ${
                        isLight ? "bg-slate-200 text-slate-950 font-black border-slate-300" : isNeutral ? "bg-[#242833] text-neutral-300 border-neutral-700" : "bg-slate-800/80 text-slate-400 border-slate-800"
                      }`}>
                        <tr>
                          <th className="py-2.5 px-3 text-left font-black">Tháng</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-blue-900" : "text-cyan-300"}`}>Năm {selectedYear}</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-slate-900" : "text-slate-300"}`}>CK {compareYear}</th>
                          <th className="py-2.5 px-3 text-right font-black">Chênh lệch</th>
                          <th className="py-2.5 px-3 text-right font-black">Tăng trưởng</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-amber-900" : "text-amber-300"}`}>Lũy kế {selectedYear}</th>
                          <th className={`py-2.5 px-3 text-right font-black ${isLight ? "text-purple-900" : "text-purple-300"}`}>Lũy kế {compareYear}</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isLight ? "divide-slate-200 font-semibold text-slate-900" : "divide-slate-800"}`}>
                        {comparisonData.map(m => {
                          const row = m as Record<string, any>
                          const valA = Number(row[metricInfo.keyA] || 0)
                          const valB = Number(row[metricInfo.keyB] || 0)
                          const cumA = Number(row[metricInfo.cumKeyA] || 0)
                          const cumB = Number(row[metricInfo.cumKeyB] || 0)
                          const diff = Number((valA - valB).toFixed(2))
                          const growth = valB > 0 ? ((diff / valB) * 100).toFixed(1) : (valA > 0 ? "100" : "0")
                          const isFutureA = isSelectedCurrent && m.month > ytdMonthCount

                          return (
                            <tr key={m.month} className={isLight ? "hover:bg-slate-50 even:bg-slate-50/60" : "hover:bg-slate-800/40"}>
                              <td className={`py-2 px-3 font-bold ${isLight ? "text-slate-950" : "text-white"}`}>
                                {m.fullName}
                                {isFutureA && (
                                  <span className={`ml-1 text-[10px] font-semibold italic ${isLight ? "text-amber-800" : "text-amber-400"}`}>
                                    (chưa tới)
                                  </span>
                                )}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-bold ${isLight ? "text-blue-800" : "text-cyan-300"}`}>
                                {metricInfo.formatter(valA)}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono ${isLight ? "text-slate-800" : "text-slate-400"}`}>
                                {metricInfo.formatter(valB)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold">
                                <span className={diff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                  {diff >= 0 ? `+${metricInfo.formatter(diff)}` : metricInfo.formatter(diff)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right font-bold">
                                <span className={Number(growth) >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                  {Number(growth) >= 0 ? `+${growth}%` : `${growth}%`}
                                </span>
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-bold ${isLight ? "text-amber-900" : "text-amber-300"}`}>
                                {metricInfo.formatter(cumA)}
                              </td>
                              <td className={`py-2 px-3 text-right font-mono font-bold ${isLight ? "text-purple-900" : "text-purple-300"}`}>
                                {metricInfo.formatter(cumB)}
                              </td>
                            </tr>
                          )
                        })}

                        {/* Dòng 1: TỔNG LŨY KẾ CÙNG KỲ */}
                        <tr className={`font-black border-t-2 ${
                          isLight ? "bg-blue-100/90 text-slate-950 border-blue-300" : "bg-blue-950/60 text-cyan-200 border-blue-800"
                        }`}>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={isLight ? "text-blue-950 font-black" : "text-cyan-300 font-black"}>🎯 LŨY KẾ CÙNG KỲ</span>
                              <span className="text-[10px] font-bold opacity-80">(T1 → T{ytdMonthCount})</span>
                            </div>
                          </td>
                          {(() => {
                            const valA = selectedMetric === "revenue" ? summaryA_YTD.rev : selectedMetric === "projects" ? summaryA_YTD.count : summaryA_YTD.days
                            const valB = selectedMetric === "revenue" ? summaryB_YTD.rev : selectedMetric === "projects" ? summaryB_YTD.count : summaryB_YTD.days
                            const diff = Number((valA - valB).toFixed(2))
                            const growth = valB > 0 ? (((valA - valB) / valB) * 100).toFixed(1) : (valA > 0 ? "100" : "0")
                            const unit = selectedMetric === "revenue" ? "$" : selectedMetric === "projects" ? " DA" : "d"

                            return (
                              <>
                                <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-blue-950" : "text-cyan-300"}`}>
                                  {metricInfo.formatter(valA)}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-slate-900" : "text-slate-300"}`}>
                                  {metricInfo.formatter(valB)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black">
                                  <span className={diff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                    {diff >= 0 ? `+${diff}` : diff}{unit}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-black">
                                  <span className={Number(growth) >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-rose-800" : "text-rose-400")}>
                                    {Number(growth) >= 0 ? `+${growth}%` : `${growth}%`}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-amber-950" : "text-amber-300"}`}>
                                  {metricInfo.formatter(valA)}
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-purple-950" : "text-purple-300"}`}>
                                  {metricInfo.formatter(valB)}
                                </td>
                              </>
                            )
                          })()}
                        </tr>

                        {/* Dòng 2: TOÀN BỘ CẢ NĂM */}
                        {hasOngoingYear && (
                          <tr className={`font-black border-t ${
                            isLight ? "bg-amber-100/80 text-slate-950 border-amber-300" : "bg-amber-950/40 text-amber-200 border-amber-800/60"
                          }`}>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={isLight ? "text-amber-950 font-black" : "text-amber-300 font-black"}>📅 TOÀN BỘ CẢ NĂM</span>
                                <span className="text-[10px] font-bold opacity-80">(12 Tháng)</span>
                              </div>
                            </td>
                            {(() => {
                              const valA = selectedMetric === "revenue" ? summaryA_Full.rev : selectedMetric === "projects" ? summaryA_Full.count : summaryA_Full.days
                              const valB = selectedMetric === "revenue" ? summaryB_Full.rev : selectedMetric === "projects" ? summaryB_Full.count : summaryB_Full.days
                              const diff = Number((valA - valB).toFixed(2))
                              const pct = selectedMetric === "revenue" ? fullYearRevPct : selectedMetric === "projects" ? fullYearCountPct : fullYearDaysPct
                              const unit = selectedMetric === "revenue" ? "$" : selectedMetric === "projects" ? " DA" : "d"

                              return (
                                <>
                                  <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-blue-950" : "text-cyan-300"}`}>
                                    {metricInfo.formatter(valA)}
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-slate-900" : "text-slate-300"}`}>
                                    {metricInfo.formatter(valB)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-black">
                                    <span className={diff >= 0 ? (isLight ? "text-emerald-800" : "text-emerald-400") : (isLight ? "text-amber-900" : "text-amber-400")}>
                                      {diff >= 0 ? `+${diff}` : diff}{unit}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                                    <span className={isLight ? "text-amber-950 font-black" : "text-amber-300 font-bold"}>
                                      Đạt {pct}% cả năm
                                    </span>
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-amber-950" : "text-amber-300"}`}>
                                    {metricInfo.formatter(valA)}
                                  </td>
                                  <td className={`py-2.5 px-3 text-right font-mono font-black ${isLight ? "text-purple-950" : "text-purple-300"}`}>
                                    {metricInfo.formatter(valB)}
                                  </td>
                                </>
                              )
                            })()}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TOOLTIP HOVER POPUP & FULLSCREEN MODAL CHO THÁNG CỦA THIẾT BỊ ROV ── */}
      {hoverData && (() => {
        const activeEditProj = hoverData.projects.find(p => p.id === editingProjectId) || hoverData.projects[0]
        const newItDays = (newInterruptionStart && newInterruptionEnd)
          ? Math.max(1, Math.round((new Date(newInterruptionEnd).getTime() - new Date(newInterruptionStart).getTime()) / 86400000) + 1)
          : 0

        const renderPopupInner = (isModal: boolean) => (
          <div className="flex flex-col h-full max-h-full overflow-hidden">
            {/* HEADER */}
            <div className={`flex items-start justify-between gap-3 border-b p-4 flex-shrink-0 ${
              isLight ? "border-slate-200 bg-slate-50/80" : "border-slate-800 bg-slate-900/90"
            }`}>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-3 h-3 rounded-full ${hoverData.rov.dotCol} ring-2 ring-white/30`} />
                  <h4 className={`text-base font-black truncate ${hoverData.rov.textCol}`}>
                    {hoverData.rov.name}
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${hoverData.rov.badgeCol}`}>
                    {hoverData.rov.code}
                  </span>
                  {isPinned && !isModal && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5" /> Đã ghim
                    </span>
                  )}
                </div>
                <div className={`flex items-center gap-2 text-xs font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                  <Calendar className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                  <span className={`font-bold ${isLight ? "text-slate-900" : "text-slate-200"}`}>
                    {hoverData.monthName} / Năm {hoverData.year}
                  </span>
                  <span>•</span>
                  <span>{hoverData.daysInM} ngày lịch</span>
                </div>
              </div>

              {/* CONTROLS & STATS */}
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* SỐ NGÀY & CÔNG SUẤT */}
                <div className="text-right hidden sm:block">
                  <div className={`text-base font-black font-mono ${
                    hoverData.activeDays > 0 ? (isLight ? "text-blue-700" : "text-cyan-400") : "text-slate-400"
                  }`}>
                    {hoverData.activeDays} <span className="text-xs font-normal opacity-80">/ {hoverData.daysInM} ngày</span>
                  </div>
                  <div className={`text-[11px] font-bold ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                    {hoverData.utilPct}% công suất tháng
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="flex items-center gap-1.5">
                  {/* Nút Admin Sửa */}
                  <button
                    onClick={() => {
                      if (editingProjectId != null) {
                        setEditingProjectId(null)
                      } else if (hoverData.projects.length > 0) {
                        handleStartEdit(hoverData.projects[0])
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-sm ${
                      editingProjectId != null
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                        : isLight
                          ? "bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border-cyan-300"
                          : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40"
                    }`}
                    title={editingProjectId != null ? "Hủy chỉnh sửa" : "Admin sửa thông tin & đợt tạm ngưng"}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{editingProjectId != null ? "Thoát sửa" : "Sửa thông tin"}</span>
                  </button>

                  {/* Nút Phóng to / Thu nhỏ */}
                  <button
                    onClick={handleToggleExpand}
                    className={`p-1.5 rounded-xl border text-xs font-bold flex items-center justify-center transition shadow-sm ${
                      isExpanded
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30"
                        : isLight
                          ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                    }`}
                    title={isExpanded ? "Thu nhỏ về Popup" : "Phóng to toàn màn hình"}
                  >
                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  {/* Nút Ghim popup (chỉ hiện khi compact) */}
                  {!isModal && (
                    <button
                      onClick={handleTogglePin}
                      className={`p-1.5 rounded-xl border text-xs font-bold flex items-center justify-center transition shadow-sm ${
                        isPinned
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : isLight
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
                      }`}
                      title={isPinned ? "Bỏ ghim popup" : "Ghim popup cố định"}
                    >
                      {isPinned ? <PinOff className="w-4 h-4 text-amber-400" /> : <Pin className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Nút Đóng */}
                  <button
                    onClick={handleClosePopup}
                    className={`p-1.5 rounded-xl border transition ${
                      isLight
                        ? "border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                        : "border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                    title="Đóng popup"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BANNER THÀNH CÔNG */}
            {saveSuccessMsg && (
              <div className="px-4 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* CONTENT BODY */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3 min-h-0">
              {/* NẾU ĐANG Ở CHẾ ĐỘ SỬA CỦA ADMIN */}
              {editingProjectId != null && activeEditProj ? (
                <div className="space-y-4">
                  {/* Selector nếu có nhiều dự án trong tháng */}
                  {hoverData.projects.length > 1 && (
                    <div className="flex items-center gap-2 pb-2 border-b border-white/10 overflow-x-auto">
                      <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Chọn dự án sửa:</span>
                      {hoverData.projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => handleStartEdit(p)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                            editingProjectId === p.id
                              ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                              : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          #{p.no || p.id} - {p.projectName}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-cyan-400" />
                      <h5 className="font-bold text-sm text-cyan-300">
                        Chỉnh sửa dự án #{activeEditProj.no || activeEditProj.id}
                      </h5>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      (Thông tin lưu sẽ tự động đồng bộ toàn bộ Track Record)
                    </span>
                  </div>

                  {/* FORM 1: THÔNG TIN DỰ ÁN & HỢP ĐỒNG */}
                  <div className={`p-3 rounded-2xl border space-y-3 ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/50 border-slate-700/60"
                  }`}>
                    <div className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Thông tin hợp đồng & địa điểm
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold opacity-75 mb-1">
                          Số hợp đồng (Contract No):
                        </label>
                        <input
                          type="text"
                          value={editContract}
                          onChange={(e) => setEditContract(e.target.value)}
                          placeholder="MVOT/FSO-SER/139/2026..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-mono font-bold ${
                            isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-amber-300"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold opacity-75 mb-1">Khách hàng (Client):</label>
                        <input
                          type="text"
                          value={editClient}
                          onChange={(e) => setEditClient(e.target.value)}
                          placeholder="PTSC G&S, PVEP, ENI..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                            isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold opacity-75 mb-1">Tàu / Giàn (Vessel/Rig):</label>
                        <input
                          type="text"
                          value={editVesselRig}
                          onChange={(e) => setEditVesselRig(e.target.value)}
                          placeholder="Tàu Shujaa 2000, Hakuryu-5..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                            isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                          }`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold opacity-75 mb-1">Tên công việc (Project Task):</label>
                        <input
                          type="text"
                          value={editProjectTask}
                          onChange={(e) => setEditProjectTask(e.target.value)}
                          placeholder="Provision of ROV services..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                            isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold opacity-75 mb-1">Vị trí (Location):</label>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="UAE & KSA, PM3-CAA..."
                          className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                            isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* FORM 2: GHI CHÚ BÀN GIAO & LƯU Ý */}
                  <div className={`p-3 rounded-2xl border space-y-2 ${
                    isLight ? "bg-amber-50/70 border-amber-300" : "bg-amber-950/30 border-amber-600/40"
                  }`}>
                    <div className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Thông tin cần lưu ý & Bàn giao công việc (Notes)
                    </div>
                    <textarea
                      rows={3}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Nhập thông tin bàn giao công việc ca trực, tình trạng thiết bị ROV, các điểm kỹ thuật cần lưu ý ngoài biển..."
                      className={`w-full px-3 py-2 rounded-xl border text-xs leading-relaxed font-medium ${
                        isLight ? "bg-white border-amber-300 text-slate-900" : "bg-slate-900/90 border-amber-600/50 text-amber-200"
                      }`}
                    />
                  </div>

                  {/* FORM 3: QUẢN LÝ CÁC ĐỢT TẠM NGƯNG */}
                  <div className={`p-3 rounded-2xl border space-y-3 ${
                    isLight ? "bg-rose-50/70 border-rose-200" : "bg-rose-950/20 border-rose-800/40"
                  }`}>
                    <div className="text-xs font-black uppercase tracking-wider text-rose-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <PauseCircle className="w-3.5 h-3.5" /> Quản lý các đợt tạm ngưng ({editInterruptions.length} đợt)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-rose-300">
                        Tổng tạm ngưng: {editInterruptions.reduce((sum, it) => sum + (it.days || 0), 0)} ngày
                      </span>
                    </div>

                    {/* Danh sách đợt tạm ngưng hiện tại */}
                    {editInterruptions.length > 0 ? (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {editInterruptions.map((it) => (
                          <div
                            key={it.id}
                            className="p-2 rounded-xl border bg-black/20 border-white/10 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold flex items-center gap-2">
                                <span className="text-rose-400 font-black">{it.days} ngày</span>
                                <span className="opacity-80 font-mono text-[11px]">
                                  ({formatDateVN(it.startDate)} → {formatDateVN(it.endDate)})
                                </span>
                                <span className="text-[11px] px-1.5 py-0.2 rounded bg-white/10 font-medium">
                                  {it.reason}
                                </span>
                              </div>
                              {it.note && (
                                <div className="text-[10px] text-slate-400 italic truncate mt-0.5">
                                  Ghi chú: {it.note}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveInterruption(it.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition"
                              title="Xóa đợt tạm ngưng này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Dự án này hiện chưa có đợt tạm ngưng nào.</p>
                    )}

                    {/* Thêm đợt tạm ngưng mới */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="text-[11px] font-bold text-rose-300">+ Thêm đợt tạm ngưng mới:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">Từ ngày:</label>
                          <input
                            type="date"
                            value={newInterruptionStart}
                            onChange={(e) => setNewInterruptionStart(e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">Đến ngày:</label>
                          <input
                            type="date"
                            value={newInterruptionEnd}
                            onChange={(e) => setNewInterruptionEnd(e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">
                            Lý do tạm ngưng ({newItDays > 0 ? `${newItDays} ngày` : "0 ngày"}):
                          </label>
                          <select
                            value={newInterruptionReason}
                            onChange={(e) => setNewInterruptionReason(e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          >
                            <option value="Thời tiết biển xấu / Sóng to gió lớn">Thời tiết biển xấu / Sóng to gió lớn</option>
                            <option value="Tàu khách hàng lên đốc bảo dưỡng">Tàu khách hàng lên đốc bảo dưỡng</option>
                            <option value="Bảo dưỡng định kỳ hệ thống ROV">Bảo dưỡng định kỳ hệ thống ROV</option>
                            <option value="Sự cố kỹ thuật / Sửa chữa thiết bị">Sự cố kỹ thuật / Sửa chữa thiết bị</option>
                            <option value="Chờ lệnh điều động từ khách hàng">Chờ lệnh điều động từ khách hàng</option>
                            <option value="Chuyển mỏ / Chuyển vị trí giàn khoan">Chuyển mỏ / Chuyển vị trí giàn khoan</option>
                            <option value="Khác (Nhập vào ghi chú)">Khác (Nhập vào ghi chú)</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleAddInterruption}
                            className="w-full px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <Plus className="w-3.5 h-3.5" /> Thêm tạm ngưng
                          </button>
                        </div>
                      </div>
                      {newInterruptionReason === "Khác (Nhập vào ghi chú)" && (
                        <input
                          type="text"
                          value={newInterruptionCustomReason}
                          onChange={(e) => setNewInterruptionCustomReason(e.target.value)}
                          placeholder="Nhập lý do tạm ngưng khác..."
                          className={`w-full px-2.5 py-1 rounded-lg border text-xs ${
                            isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-white"
                          }`}
                        />
                      )}
                      <input
                        type="text"
                        value={newInterruptionNote}
                        onChange={(e) => setNewInterruptionNote(e.target.value)}
                        placeholder="Ghi chú thêm về đợt tạm ngưng (tùy chọn)..."
                        className={`w-full px-2.5 py-1 rounded-lg border text-xs ${
                          isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-white"
                        }`}
                      />
                    </div>
                  </div>

                  {/* FORM 4: QUẢN LÝ NHÂN SỰ DỰ ÁN */}
                  <div className={`p-3 rounded-2xl border space-y-3 ${
                    isLight ? "bg-blue-50/70 border-blue-200" : "bg-blue-950/20 border-blue-800/40"
                  }`}>
                    <div className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Quản lý danh sách nhân sự của thiết bị ({editAssignments.length} nhân sự)
                      </span>
                    </div>

                    {/* Danh sách phân công */}
                    {editAssignments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                        {editAssignments.map(asgn => (
                          <div
                            key={asgn.id}
                            className="p-2 rounded-xl border bg-black/20 border-white/10 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-white truncate">{asgn.personnelName}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${getOffshoreRoleBadge(asgn.role)}`}>
                                  {asgn.role}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                  {formatDateVN(asgn.startDate)} → {asgn.endDate ? formatDateVN(asgn.endDate) : "Đang trực"}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(asgn.id)}
                              className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400 transition flex-shrink-0"
                              title="Xóa phân công này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Chưa có phân công nhân sự nào cho thiết bị này.</p>
                    )}

                    {/* Thêm phân công mới */}
                    <div className="pt-2 border-t border-white/10 space-y-2">
                      <div className="text-[11px] font-bold text-cyan-300">+ Thêm phân công nhân sự:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">Nhân viên:</label>
                          <select
                            value={newPersonId}
                            onChange={(e) => setNewPersonId(e.target.value ? Number(e.target.value) : "")}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          >
                            <option value="">-- Chọn nhân viên --</option>
                            {allPersonnel.map(p => (
                              <option key={p.id} value={p.id}>
                                {p.ho_va_ten} ({p.chuc_vu || "ROV"})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">Chức danh ngoài biển:</label>
                          <select
                            value={newPersonRole}
                            onChange={(e) => setNewPersonRole(e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          >
                            {ROV_OFFSHORE_ROLES.map(role => (
                              <option key={role} value={role}>{role}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] opacity-75 mb-0.5">Bắt đầu đi ca:</label>
                          <input
                            type="date"
                            value={newPersonStart}
                            onChange={(e) => setNewPersonStart(e.target.value)}
                            className={`w-full px-2 py-1 rounded-lg border text-xs ${
                              isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-white"
                            }`}
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={handleAddPersonnelAssignment}
                            className="w-full px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm transition"
                          >
                            <Plus className="w-3.5 h-3.5" /> Gán nhân sự
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BAR LƯU */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditingProjectId(null)}
                      className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveAndSync(activeEditProj)}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-xs shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isSaving ? "Đang lưu & đồng bộ..." : "Lưu và Tự động đồng bộ toàn bộ Track Record"}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* CHẾ ĐỘ XEM CHI TIẾT (VIEW MODE) */
                <div className="space-y-3">
                  {/* SUMMARY CHIPS */}
                  <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                      hoverData.projects.length > 0
                        ? isLight ? "bg-blue-50 text-blue-800 border-blue-200" : "bg-blue-950/70 text-cyan-300 border-cyan-800/50"
                        : isLight ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-slate-800 text-slate-400 border-slate-700"
                    }`}>
                      {hoverData.projects.length > 0 ? `${hoverData.projects.length} dự án tham gia` : "Không có dự án"}
                    </span>

                    {hoverData.hasOverlap && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                        isLight ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                      }`}>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Khử trùng {hoverData.overlapDays} ngày gối đầu
                      </span>
                    )}

                    {hoverData.projects.some(p => p.pausedDaysInMonth > 0) && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                        isLight ? "bg-rose-100 text-rose-900 border-rose-300" : "bg-rose-500/10 text-rose-300 border-rose-500/30"
                      }`}>
                        <PauseCircle className="w-3.5 h-3.5 text-rose-500" />
                        Tạm ngưng {hoverData.projects.reduce((acc, p) => acc + p.pausedDaysInMonth, 0)} ngày trong tháng
                      </span>
                    )}
                  </div>

                  {/* DANH SÁCH DỰ ÁN */}
                  {hoverData.projects.length > 0 ? (
                    <div className={`space-y-3 ${isModal ? "grid grid-cols-1 gap-3 space-y-0" : ""}`}>
                      {hoverData.projects.map((p, pIdx) => (
                        <div
                          key={p.id || pIdx}
                          className={`p-3.5 rounded-2xl border text-xs space-y-2.5 transition ${
                            isLight
                              ? "bg-slate-50 border-slate-200 hover:border-slate-300"
                              : "bg-slate-800/60 border-slate-700/60 hover:border-slate-600"
                          }`}
                        >
                          {/* Header dự án: No + Tên + Badge ngày */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="font-bold flex items-center gap-2 min-w-0">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-black border flex-shrink-0 ${
                                isLight
                                  ? "bg-cyan-100 text-cyan-900 border-cyan-300"
                                  : "bg-cyan-500/20 text-cyan-300 border-cyan-400/30"
                              }`}>
                                #{p.no || p.id}
                              </span>
                              <span className="text-sm font-bold truncate" title={p.projectName}>
                                {p.projectName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`font-mono font-black px-2.5 py-0.5 rounded-lg border text-xs ${
                                isLight
                                  ? "bg-cyan-100 text-cyan-950 border-cyan-300"
                                  : "bg-cyan-950/70 text-cyan-300 border-cyan-800/50"
                              }`}>
                                {p.activeDaysInMonth} ngày trong tháng
                              </span>
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="px-2 py-0.5 rounded border border-cyan-500/30 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500/20 transition flex items-center gap-1"
                                title="Sửa thông tin dự án này"
                              >
                                <Pencil className="w-3 h-3" /> Sửa
                              </button>
                            </div>
                          </div>

                          {/* SỐ HỢP ĐỒNG (Contract No.) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`px-2.5 py-1 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 ${
                              p.contract
                                ? isLight
                                  ? "bg-amber-50 text-amber-900 border-amber-300"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                            }`}>
                              <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                              <span className="opacity-75">Số HĐ:</span>
                              <span>{p.contract || "Chưa cập nhật số HĐ"}</span>
                            </div>

                            {p.waterDepth && (
                              <div className="px-2.5 py-1 rounded-lg border bg-blue-500/10 border-blue-500/30 text-blue-300 text-xs font-bold flex items-center gap-1">
                                <Anchor className="w-3 h-3 text-blue-400" />
                                <span>Độ sâu: {p.waterDepth}</span>
                              </div>
                            )}
                          </div>

                          {/* Khách hàng, Tàu, Vị trí */}
                          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs ${
                            isLight ? "text-slate-600" : "text-slate-300"
                          }`}>
                            <div className="truncate flex items-center gap-1">
                              <span className="opacity-70">Khách hàng:</span>
                              <span className={`font-semibold truncate ${isLight ? "text-slate-900" : "text-white"}`}>
                                {p.client}
                              </span>
                            </div>
                            {p.vesselRig && (
                              <div className="truncate flex items-center gap-1">
                                <Ship className="w-3.5 h-3.5 opacity-60 flex-shrink-0 text-cyan-400" />
                                <span className="truncate">{p.vesselRig}</span>
                              </div>
                            )}
                            {p.location && (
                              <div className="truncate flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 opacity-60 flex-shrink-0 text-amber-400" />
                                <span className="truncate">{p.location}</span>
                              </div>
                            )}
                          </div>

                          {/* Phạm vi công việc SOW nếu có */}
                          {p.projectSow && p.projectSow !== p.projectName && (
                            <div className={`p-2 rounded-xl border text-[11.5px] ${
                              isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-slate-900/40 border-slate-700/40 text-slate-300"
                            }`}>
                              <span className="font-bold opacity-75">SOW: </span>
                              <span>{p.projectSow}</span>
                            </div>
                          )}

                          {/* Thời gian làm việc */}
                          <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
                            isLight ? "border-slate-200" : "border-slate-700/50"
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                                Thời gian trong tháng:
                              </span>
                              <span className={`font-mono font-bold ${isLight ? "text-amber-800" : "text-amber-300"}`}>
                                Từ {p.monthStartDateStr} đến {p.monthEndDateStr}
                              </span>
                            </div>
                            <div className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                              <span>Toàn bộ dự án: </span>
                              <span className="font-mono">
                                {formatDateVN(p.fullStart)} → {p.fullEnd ? formatDateVN(p.fullEnd) : "Đang thực hiện"}
                              </span>
                            </div>
                          </div>

                          {/* THÔNG TIN CẦN LƯU Ý & BÀN GIAO CÔNG VIỆC (NOTES) */}
                          <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                            isLight ? "bg-amber-50/80 border-amber-300 text-amber-950" : "bg-amber-950/40 border-amber-500/30 text-amber-200"
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-400">
                              <FileText className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span>Thông tin cần lưu ý & Bàn giao công việc:</span>
                            </div>
                            <p className="whitespace-pre-line text-[11px] pl-5 opacity-90 leading-relaxed font-medium">
                              {p.notes || "Chưa có thông tin ghi chú bàn giao công việc."}
                            </p>
                          </div>

                          {/* DANH SÁCH NHÂN SỰ CỦA DỰ ÁN */}
                          <div className={`p-2.5 rounded-xl border text-xs space-y-2 ${
                            isLight ? "bg-blue-50/70 border-blue-200" : "bg-slate-800/60 border-slate-700/60"
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 font-bold text-[11.5px] text-cyan-400">
                                <Users className="w-3.5 h-3.5 text-cyan-400" />
                                <span>
                                  Danh sách nhân sự tham gia ({p.personnel.length > 0 ? `${p.personnel.length} nhân sự` : `${p.allRovPersonnel.length} nhân sự thuộc đội`}):
                                </span>
                              </div>
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="text-[10.5px] font-semibold text-cyan-400 hover:text-cyan-300 underline"
                              >
                                + Quản lý nhân sự
                              </button>
                            </div>

                            {(p.personnel.length > 0 ? p.personnel : p.allRovPersonnel).length > 0 ? (
                              <div className={`grid ${isModal ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"} gap-1.5 max-h-52 overflow-y-auto pr-1`}>
                                {(p.personnel.length > 0 ? p.personnel : p.allRovPersonnel).map(asgn => (
                                  <div
                                    key={asgn.id}
                                    className="p-1.5 rounded-lg border bg-black/20 border-white/10 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0">
                                      <div className="font-bold text-xs truncate text-white">{asgn.personnelName}</div>
                                      <div className="text-[10px] text-slate-400 truncate font-mono">
                                        {formatDateVN(asgn.startDate)} → {asgn.endDate ? formatDateVN(asgn.endDate) : "Đang trực"}
                                      </div>
                                    </div>
                                    <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border flex-shrink-0 ${getOffshoreRoleBadge(asgn.role)}`}>
                                      {asgn.role}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">
                                Chưa có danh sách phân công nhân sự offshore cho thiết bị này.
                              </div>
                            )}
                          </div>

                          {/* ĐỢT TẠM NGƯNG NẾU CÓ */}
                          {p.interruptions && p.interruptions.length > 0 && (
                            <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 ${
                              isLight ? "bg-rose-50/80 border-rose-300 text-rose-950" : "bg-rose-950/40 border-rose-600/40 text-rose-200"
                            }`}>
                              <div className="flex items-center gap-1.5 font-bold text-[11px] text-rose-400">
                                <PauseCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                <span>Chi tiết các đợt tạm ngưng ({p.interruptions.length} đợt):</span>
                              </div>
                              <div className="space-y-1 pl-5">
                                {p.interruptions.map(it => (
                                  <div key={it.id} className="text-[11px] leading-relaxed">
                                    <span className="font-black text-rose-400">Tạm ngưng {it.days} ngày</span>
                                    {" "}({formatDateVN(it.startDate)} → {formatDateVN(it.endDate)}): {it.reason || "Bảo dưỡng / Thời tiết"}
                                    {it.note && <span className="opacity-75 italic"> — {it.note}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`p-6 rounded-2xl border text-center space-y-1.5 text-xs ${
                      isLight ? "bg-slate-50 border-slate-200 text-slate-600" : "bg-slate-800/40 border-slate-800 text-slate-400"
                    }`}>
                      <Clock className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                      <p className="font-bold text-sm">Không có dự án nào hoạt động trong tháng này</p>
                      <p className="text-xs opacity-75">Thiết bị sẵn sàng (Standby / Sẵn sàng điều động tại Xưởng)</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FOOTER HINT */}
            {hoverData.hasOverlap && (
              <div className={`p-3 border-t text-xs italic flex items-center gap-2 flex-shrink-0 ${
                isLight ? "border-slate-200 bg-amber-50 text-amber-900" : "border-slate-800 bg-amber-950/20 text-amber-300/90"
              }`}>
                <Info className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span>
                  Đã khử trùng {hoverData.overlapDays} ngày gối đầu chuyển tiếp giữa các dự án để bảo đảm không vượt quá số ngày của tháng.
                </span>
              </div>
            )}
          </div>
        )

        const popupElement = isExpanded ? (
          /* ── CHẾ ĐỘ PHÓNG TO (FULLSCREEN MODAL) ── */
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={(e) => {
              if (e.target === e.currentTarget && editingProjectId == null) {
                handleClosePopup()
              }
            }}
          >
            <div
              className={`relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${
                isLight
                  ? "bg-white border-slate-300 text-slate-900 shadow-slate-900/40"
                  : "bg-slate-900 border-slate-700/80 text-white shadow-black/90"
              }`}
              onMouseEnter={() => {
                isHoveringPopupRef.current = true
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
              }}
              onMouseLeave={() => {
                isHoveringPopupRef.current = false
              }}
            >
              {renderPopupInner(true)}
            </div>
          </div>
        ) : (
          /* ── CHẾ ĐỘ THU NHỎ (POPUP / FLOATING TOOLTIP) ── */
          <div
            style={getPopupStyle(hoverData.rect)}
            className="transition-all duration-150 animate-in fade-in zoom-in-95"
            onMouseEnter={() => {
              isHoveringPopupRef.current = true
              if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
            }}
            onMouseLeave={() => {
              isHoveringPopupRef.current = false
              if (!isPinned && !isExpanded && editingProjectId == null) {
                setHoverData(null)
              }
            }}
          >
            <div className={`rounded-2xl border shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col max-h-full ${
              isLight
                ? "bg-white/98 border-slate-300 text-slate-900 shadow-slate-400/40 ring-1 ring-black/5"
                : "bg-slate-900/98 border-slate-700/80 text-white shadow-black/80 ring-1 ring-white/10"
            }`}>
              {renderPopupInner(false)}
            </div>
          </div>
        )

        return typeof document !== "undefined"
          ? createPortal(popupElement, document.body)
          : popupElement
      })()}
    </div>
  )
}
