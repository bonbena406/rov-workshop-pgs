"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import Image from "next/image"
import { 
  Activity, 
  Calendar, 
  Users, 
  UserPlus, 
  Trash2, 
  Check, 
  ExternalLink, 
  Shield, 
  Clock, 
  Ship, 
  MapPin, 
  FileText, 
  Plus, 
  Edit3, 
  X,
  AlertCircle,
  Maximize2,
  Minimize2,
  Radio,
  SlidersHorizontal,
  ChevronRight,
  GripHorizontal,
  Info,
  Move,
  RotateCcw,
  Table as TableIcon,
  LayoutList,
  FileSpreadsheet,
  Download,
} from "lucide-react"
import * as XLSX from "xlsx"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  FLEET_DEFS, 
  ROV_OFFSHORE_ROLES, 
  type ROVFleetDef, 
  type ROVPersonnelAssignment, 
  type ROVOffshoreRole,
  isAssignmentActiveOnDate 
} from "@/lib/rov-assignments-shared"
import type { TrackRecordDB, PersonnelDB } from "@/lib/supabase"
import { getAvatarUrl } from "@/lib/supabase"
import { saveROVAssignmentsAction } from "@/actions/rov-assignment-actions"
import { recordAuditLog } from "@/lib/audit-logs"
import { 
  DEFAULT_ROV_STATUSES, 
  ROV_STATUS_PRESETS, 
  type ROVStatusItem, 
  type ROVStatusMap 
} from "@/lib/rov-statuses-shared"
import { getROVStatusesAction, updateROVStatusAction } from "@/actions/rov-status-actions"

interface ROVFleetSectionProps {
  allPersonnel: PersonnelDB[]
  trackRecords: TrackRecordDB[]
  assignments: ROVPersonnelAssignment[]
  onAssignmentsChange: (updated: ROVPersonnelAssignment[]) => void
  isAdmin: boolean
  onRequireAdmin: () => void
  selectedDate: string
  onDateChange: (newDate: string) => void
}

function fmtDate(d?: string | null): string {
  if (!d) return "—"
  const parts = d.slice(0, 10).split("-")
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function getTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function ROVFleetSection({
  allPersonnel,
  trackRecords,
  assignments,
  onAssignmentsChange,
  isAdmin,
  onRequireAdmin,
  selectedDate,
  onDateChange,
}: ROVFleetSectionProps) {
  const [selectedROV, setSelectedROV] = useState<ROVFleetDef | null>(null)
  const [hoveredROVId, setHoveredROVId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // ── MODAL SIZING, POSITIONING & DRAG/RESIZE CONTROLS ────────
  const [modalMode, setModalMode] = useState<"normal" | "wide" | "fullscreen">("normal")
  const [customWidth, setCustomWidth] = useState<number | null>(null)
  const [customHeight, setCustomHeight] = useState<number | null>(null)
  const [modalPos, setModalPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDraggingModal, setIsDraggingModal] = useState(false)
  const isResizingRef = useRef(false)
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const startWidthRef = useRef(980)
  const startHeightRef = useRef(720)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number }>({
    mouseX: 0,
    mouseY: 0,
    posX: 0,
    posY: 0,
  })

  // ── CHẾ ĐỘ XEM NHÂN SỰ (BẢNG TỔNG HỢP TOÀN BỘ VS THẺ PHÂN CA) ─
  const [personnelViewMode, setPersonnelViewMode] = useState<"table" | "cards">("table")
  const [personnelSearch, setPersonnelSearch] = useState("")

  // ── TRẠNG THÁI HOẠT ĐỘNG THIẾT BỊ (EQUIPMENT OPERATIONAL STATUS) ─
  const [rovStatuses, setRovStatuses] = useState<ROVStatusMap>(DEFAULT_ROV_STATUSES)
  const [isEditingStatus, setIsEditingStatus] = useState(false)
  const [editStatusCategory, setEditStatusCategory] = useState<ROVStatusItem["statusCategory"]>("standby_vessel")
  const [editStatusLabel, setEditStatusLabel] = useState<string>("Standby do tàu khách hàng lên đốc")
  const [editStatusDetail, setEditStatusDetail] = useState<string>("")
  const [isSavingStatus, setIsSavingStatus] = useState(false)

  // Load status từ server action khi mount
  useEffect(() => {
    getROVStatusesAction()
      .then((res) => {
        if (res && Object.keys(res).length > 0) {
          setRovStatuses((prev) => ({ ...prev, ...res }))
        }
      })
      .catch((err) => console.error("Lỗi lấy trạng thái ROV:", err))
  }, [])

  // Bắt đầu kéo rê để co giãn kích thước modal (Corner Resize)
  const handleStartResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizingRef.current = true
    startXRef.current = e.clientX
    startYRef.current = e.clientY
    const baseW = customWidth || (modalMode === "wide" ? 1260 : 980)
    const baseH = customHeight || Math.min(window.innerHeight * 0.9, 740)
    startWidthRef.current = baseW
    startHeightRef.current = baseH

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const deltaX = (moveEvent.clientX - startXRef.current) * 1.5
      const deltaY = moveEvent.clientY - startYRef.current
      const newWidth = Math.min(Math.max(620, startWidthRef.current + deltaX), window.innerWidth - 32)
      const newHeight = Math.min(Math.max(450, startHeightRef.current + deltaY), window.innerHeight - 32)
      setCustomWidth(newWidth)
      setCustomHeight(newHeight)
    }

    const onMouseUp = () => {
      isResizingRef.current = false
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  // Kéo di chuyển cửa sổ popup (Move / Drag modal by header)
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Không kích hoạt kéo nếu bấm vào input, button, select, link, v.v.
    if (target.closest("button, input, select, a, textarea, [data-no-drag]")) return
    if (modalMode === "fullscreen") return

    setIsDraggingModal(true)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: modalPos.x,
      posY: modalPos.y,
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY
      setModalPos({
        x: dragStartRef.current.posX + deltaX,
        y: dragStartRef.current.posY + deltaY,
      })
    }

    const onMouseUp = () => {
      setIsDraggingModal(false)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
  }

  // Reset vị trí modal về chính giữa màn hình
  const handleResetModalPosition = () => {
    setModalPos({ x: 0, y: 0 })
    showNotification("Đã đưa cửa sổ về vị trí giữa màn hình")
  }

  // Form thêm nhân sự
  const [newPersonnelId, setNewPersonnelId] = useState<number | "">("")
  const [newRole, setNewRole] = useState<ROVOffshoreRole>("ROV Supervisor")
  const [newStartDate, setNewStartDate] = useState<string>("")
  const [newEndDate, setNewEndDate] = useState<string>("")
  const [newNote, setNewNote] = useState<string>("")
  const [formError, setFormError] = useState<string>("")

  // Tính toán trạng thái 4 ROV dựa trên ngày đang chọn (selectedDate)
  const fleetStatusList = useMemo(() => {
    return FLEET_DEFS.map((def) => {
      const fleetRecords = trackRecords.filter((r) => r.rov_system && def.matcher(r.rov_system))

      const activeProjects = fleetRecords.filter((r) => {
        if (!r.start_date) return false
        const s = r.start_date.slice(0, 10)
        if (r.end_date) {
          const e = r.end_date.slice(0, 10)
          return selectedDate >= s && selectedDate <= e
        }
        return selectedDate >= s
      })

      const sortedByDate = [...fleetRecords].sort((a, b) => {
        const da = a.start_date ? new Date(a.start_date).getTime() : 0
        const db = b.start_date ? new Date(b.start_date).getTime() : 0
        return db - da
      })

      const isActive = activeProjects.length > 0
      const currentProject = activeProjects[0] || null
      const latestProject = sortedByDate[0] || null

      const activePersonnel = assignments.filter(
        (asgn) => asgn.rovId === def.id && isAssignmentActiveOnDate(asgn, selectedDate)
      )

      return {
        ...def,
        isActive,
        activeProjects,
        currentProject,
        latestProject,
        totalProjects: fleetRecords.length,
        activePersonnel,
      }
    })
  }, [trackRecords, assignments, selectedDate])

  const showNotification = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Mở modal quản lý ROV
  const handleOpenROVModal = (rovDef: ROVFleetDef) => {
    setSelectedROV(rovDef)
    setModalPos({ x: 0, y: 0 })
    setPersonnelSearch("")
    setFormError("")
    setIsEditingStatus(false)
    
    // Tìm project đang chạy của ROV này để set ngày mặc định
    const currentROVData = fleetStatusList.find((f) => f.id === rovDef.id)
    const pStart = currentROVData?.currentProject?.start_date?.slice(0, 10) || selectedDate
    const pEnd = currentROVData?.currentProject?.end_date?.slice(0, 10) || ""
    
    setNewStartDate(pStart)
    setNewEndDate(pEnd)
    setNewPersonnelId("")
    setNewRole("ROV Supervisor")
    setNewNote("")

    // Nạp trạng thái hoạt động hiện tại vào form edit
    const curStatus = rovStatuses[rovDef.id] || DEFAULT_ROV_STATUSES[rovDef.id]
    if (curStatus) {
      setEditStatusCategory(curStatus.statusCategory)
      setEditStatusLabel(curStatus.statusLabel)
      setEditStatusDetail(curStatus.detailText)
    } else {
      setEditStatusCategory("standby_vessel")
      setEditStatusLabel("Standby do tàu khách hàng lên đốc")
      setEditStatusDetail(`ROV ${rovDef.code} standby do tàu của khách hàng lên đốc`)
    }
  }

  // Chọn trạng thái mẫu nhanh
  const handleSelectStatusPreset = (presetCat: ROVStatusItem["statusCategory"]) => {
    setEditStatusCategory(presetCat)
    const preset = ROV_STATUS_PRESETS.find((p) => p.category === presetCat)
    if (preset) {
      setEditStatusLabel(preset.label)
      if (preset.templateText && selectedROV) {
        setEditStatusDetail(preset.templateText.replace("{code}", selectedROV.code))
      } else if (presetCat === "custom") {
        setEditStatusDetail("")
      }
    }
  }

  // Lưu trạng thái hoạt động thiết bị
  const handleSaveStatus = async () => {
    if (!selectedROV) return
    setIsSavingStatus(true)
    const newStatusItem: ROVStatusItem = {
      rovId: selectedROV.id,
      statusCategory: editStatusCategory,
      statusLabel: editStatusLabel.trim() || "Hoạt động",
      detailText: editStatusDetail.trim() || `ROV ${selectedROV.code} sẵn sàng hoạt động`,
      updatedAt: new Date().toISOString(),
    }

    const res = await updateROVStatusAction(selectedROV.id, newStatusItem)
    setIsSavingStatus(false)
    if (res.success && res.statuses) {
      setRovStatuses(res.statuses)
      setIsEditingStatus(false)
      showNotification(`✓ Đã cập nhật trạng thái hoạt động của ${selectedROV.name}!`)
    } else {
      setRovStatuses((prev) => ({ ...prev, [selectedROV.id]: newStatusItem }))
      setIsEditingStatus(false)
      showNotification(`✓ Đã lưu trạng thái trên giao diện!`)
    }
  }

  // Thêm nhân sự vào ROV
  const handleAddPersonnel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      onRequireAdmin()
      return
    }

    if (!newPersonnelId) {
      setFormError("Vui lòng chọn nhân sự từ danh sách!")
      return
    }

    if (!newStartDate) {
      setFormError("Vui lòng chọn ngày bắt đầu thực hiện!")
      return
    }

    const person = allPersonnel.find((p) => p.id === Number(newPersonnelId))
    if (!person) {
      setFormError("Không tìm thấy thông tin nhân sự đã chọn!")
      return
    }

    if (!selectedROV) return

    const isDuplicate = assignments.some(
      (a) => a.rovId === selectedROV.id && a.personnelId === person.id && a.startDate === newStartDate
    )
    if (isDuplicate) {
      setFormError(`Nhân sự ${person.ho_va_ten} đã được phân công vào ROV này cùng ngày bắt đầu!`)
      return
    }

    const newAssignment: ROVPersonnelAssignment = {
      id: `asgn_${Date.now()}`,
      rovId: selectedROV.id,
      rovName: selectedROV.shortName,
      personnelId: person.id,
      personnelName: person.ho_va_ten,
      role: newRole,
      startDate: newStartDate,
      endDate: newEndDate || null,
      note: newNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    const updated = [...assignments, newAssignment]
    onAssignmentsChange(updated)
    setFormError("")
    setNewPersonnelId("")
    setNewNote("")

    setIsSaving(true)
    const res = await saveROVAssignmentsAction(updated)
    setIsSaving(false)
    if (res.success) {
      recordAuditLog({
        action_type: "UPDATE_ROV_ASSIGNMENT",
        target_name: selectedROV.shortName,
        summary: `Phân công nhân sự: ${person.ho_va_ten} (${newRole}) vào ${selectedROV.name}`,
        details: newAssignment,
      })
      showNotification(`✓ Đã thêm ${person.ho_va_ten} (${newRole}) vào ${selectedROV.shortName}!`)
    } else {
      showNotification("Đã cập nhật trên giao diện hiện tại.")
    }
  }

  // Xóa nhân sự khỏi ROV
  const handleDeleteAssignment = async (assignmentId: string, pName: string) => {
    if (!isAdmin) {
      onRequireAdmin()
      return
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa nhân sự ${pName} khỏi thiết bị này?`)) {
      return
    }

    const updated = assignments.filter((a) => a.id !== assignmentId)
    onAssignmentsChange(updated)

    setIsSaving(true)
    const res = await saveROVAssignmentsAction(updated)
    setIsSaving(false)
    if (res.success) {
      recordAuditLog({
        action_type: "DELETE_ROV_ASSIGNMENT",
        target_name: selectedROV?.shortName || "ROV",
        summary: `Xóa phân công nhân sự: ${pName} khỏi ${selectedROV?.name || "thiết bị"}`,
        details: { assignmentId, personnelName: pName },
      })
      showNotification(`✓ Đã xóa phân công của ${pName}!`)
    }
  }

  // Cập nhật thông tin ngày/chức danh nhân sự trực tiếp
  const handleUpdateAssignmentField = async (
    assignmentId: string, 
    field: "role" | "startDate" | "endDate" | "note", 
    value: string
  ) => {
    if (!isAdmin) {
      onRequireAdmin()
      return
    }

    const updated = assignments.map((a) => {
      if (a.id === assignmentId) {
        return {
          ...a,
          [field]: field === "endDate" && !value ? null : value,
        }
      }
      return a
    })

    onAssignmentsChange(updated)
    const res = await saveROVAssignmentsAction(updated)
    if (res.success) {
      showNotification("✓ Đã lưu thay đổi thông tin ca nhân sự!")
    }
  }

  // Dữ liệu của ROV đang được xem trong modal
  const activeROVModalData = useMemo(() => {
    if (!selectedROV) return null
    return fleetStatusList.find((f) => f.id === selectedROV.id) || null
  }, [selectedROV, fleetStatusList])

  // Trạng thái hoạt động của ROV đang chọn
  const currentROVStatus = useMemo<ROVStatusItem>(() => {
    if (!selectedROV) {
      return {
        rovId: "",
        statusCategory: "operating",
        statusLabel: "Hoạt động",
        detailText: "",
      }
    }
    return rovStatuses[selectedROV.id] || DEFAULT_ROV_STATUSES[selectedROV.id] || {
      rovId: selectedROV.id,
      statusCategory: "operating",
      statusLabel: "Hoạt động",
      detailText: `ROV ${selectedROV.code} sẵn sàng hoạt động`,
    }
  }, [selectedROV, rovStatuses])

  const currentStatusPreset = useMemo(() => {
    return ROV_STATUS_PRESETS.find((p) => p.category === currentROVStatus.statusCategory)
  }, [currentROVStatus])

  // Danh sách toàn bộ nhân sự được phân công cho ROV đang chọn
  const currentROVAssignments = useMemo(() => {
    if (!selectedROV) return []
    return assignments.filter((a) => a.rovId === selectedROV.id)
  }, [selectedROV, assignments])

  // Lọc danh sách nhân sự theo ô tìm kiếm
  const filteredROVAssignments = useMemo(() => {
    if (!personnelSearch.trim()) return currentROVAssignments
    const q = personnelSearch.toLowerCase().trim()
    return currentROVAssignments.filter((asgn) => {
      const person = allPersonnel.find((p) => p.id === asgn.personnelId)
      return (
        asgn.personnelName.toLowerCase().includes(q) ||
        asgn.role.toLowerCase().includes(q) ||
        (asgn.note && asgn.note.toLowerCase().includes(q)) ||
        (person?.chuc_vu && person.chuc_vu.toLowerCase().includes(q)) ||
        (person?.to_phong && person.to_phong.toLowerCase().includes(q))
      )
    })
  }, [currentROVAssignments, personnelSearch, allPersonnel])

  // Xuất file Excel danh sách nhân sự ROV
  const handleExportPersonnelExcel = () => {
    if (!selectedROV) return
    if (currentROVAssignments.length === 0) {
      showNotification("Không có dữ liệu nhân sự để xuất file.")
      return
    }

    const rows = currentROVAssignments.map((asgn, idx) => {
      const person = allPersonnel.find((p) => p.id === asgn.personnelId)
      const isActive = isAssignmentActiveOnDate(asgn, selectedDate)
      return {
        "STT": idx + 1,
        "Họ và tên": asgn.personnelName,
        "Chức vụ xưởng": person?.chuc_vu || "—",
        "Tổ / Phòng": person?.to_phong || "—",
        "Chức danh dự án": asgn.role,
        "Từ ngày (Bắt đầu)": asgn.startDate ? fmtDate(asgn.startDate) : "—",
        "Đến ngày (Kết thúc)": asgn.endDate ? fmtDate(asgn.endDate) : "Đang tiếp diễn",
        "Trạng thái tại ngày xem": isActive ? "ĐANG LÀM VIỆC" : "NGOÀI CA",
        "Ghi chú ca": asgn.note || "—",
        "Thiết bị ROV": selectedROV.name,
        "Mã thiết bị": selectedROV.code,
        "Ngày kiểm tra": fmtDate(selectedDate),
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    ws["!cols"] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 12 },
      { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "NhanSu_ROV")
    XLSX.writeFile(wb, `Danh_sach_nhan_su_${selectedROV.code}_${selectedDate}.xlsx`)
    showNotification(`✓ Đã xuất file Excel nhân sự ${selectedROV.shortName}!`)
  }

  // Xuất file CSV
  const handleExportPersonnelCSV = () => {
    if (!selectedROV) return
    if (currentROVAssignments.length === 0) {
      showNotification("Không có dữ liệu nhân sự để xuất file.")
      return
    }

    const headers = [
      "STT",
      "Họ và tên",
      "Chức vụ xưởng",
      "Tổ/Phòng",
      "Chức danh dự án",
      "Từ ngày",
      "Đến ngày",
      "Trạng thái tại ngày xem",
      "Ghi chú ca",
      "Thiết bị ROV",
    ]

    const rows = currentROVAssignments.map((asgn, idx) => {
      const person = allPersonnel.find((p) => p.id === asgn.personnelId)
      const isActive = isAssignmentActiveOnDate(asgn, selectedDate)
      return [
        idx + 1,
        `"${asgn.personnelName}"`,
        `"${person?.chuc_vu || "—"}"`,
        `"${person?.to_phong || "—"}"`,
        `"${asgn.role}"`,
        `"${asgn.startDate ? fmtDate(asgn.startDate) : "—"}"`,
        `"${asgn.endDate ? fmtDate(asgn.endDate) : "Tiếp diễn"}"`,
        `"${isActive ? "Đang làm việc" : "Ngoài ca"}"`,
        `"${asgn.note || "—"}"`,
        `"${selectedROV.name}"`,
      ].join(",")
    })

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Danh_sach_nhan_su_${selectedROV.code}_${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showNotification(`✓ Đã xuất file CSV nhân sự ${selectedROV.shortName}!`)
  }

  return (
    <div className="w-full mt-1.5 sm:mt-2 mb-1 sm:mb-1.5 pb-2">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className="px-4 py-2 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20 flex items-center gap-2">
            <Check className="w-4 h-4" />
            {toastMsg}
          </div>
        </div>
      )}

      {/* ── 04 NÚT THIẾT BỊ ROV (TỐI ƯU DESKTOP & MOBILE, CÓ TRẠNG THÁI HOẠT ĐỘNG VÀ DÒNG CHỮ CHẠY) ── */}
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {fleetStatusList.map((item) => {
            const isHovered = hoveredROVId === item.id
            const activePersonnelCount = item.activePersonnel.length
            const theme = item.theme
            const statusItem = rovStatuses[item.id] || DEFAULT_ROV_STATUSES[item.id]
            const preset = ROV_STATUS_PRESETS.find((p) => p.category === statusItem?.statusCategory)
            const isTextLong = statusItem?.detailText && statusItem.detailText.length > 28

            return (
              <div
                key={item.id}
                className="relative"
                onMouseEnter={() => setHoveredROVId(item.id)}
                onMouseLeave={() => setHoveredROVId(null)}
              >
                {/* ROV Button Pill */}
                <button
                  type="button"
                  onClick={() => handleOpenROVModal(item)}
                  className={`w-full relative flex flex-col justify-between gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border transition-all duration-300 select-none text-left cursor-pointer group shadow-sm hover:scale-[1.01] sm:hover:scale-[1.02] active:scale-95 ${
                    item.isActive
                      ? `bg-slate-900/95 ${theme.activeBorder} text-white ${theme.activeShadow}`
                      : `bg-slate-900/80 border-slate-700/80 text-slate-400 ${theme.inactiveBorderHover} hover:text-slate-200 hover:border-slate-500`
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                      {/* Active Status Pulse Indicator */}
                      <div className="flex-shrink-0">
                        {item.isActive ? (
                          <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${theme.pingDot} opacity-75`}></span>
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 ${theme.solidDot}`}></span>
                          </span>
                        ) : (
                          <span className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-slate-500"></span>
                        )}
                      </div>

                      {/* Name & Subtitle */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs sm:text-xs md:text-sm font-bold tracking-tight truncate ${item.isActive ? "text-white" : "text-slate-300"}`}>
                            {item.shortName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[10px] sm:text-[10px] md:text-[11px] truncate">
                          <span className={`font-semibold ${item.isActive ? theme.textAccent : "text-slate-400"}`}>
                            {item.isActive ? "Đang làm việc" : "Tại xưởng"}
                          </span>
                          {item.isActive && item.currentProject?.client && (
                            <span className="text-slate-400 truncate font-medium">
                              - {item.currentProject.client}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Badge số nhân sự đang làm việc trên ROV này */}
                    <div className="flex-shrink-0 flex items-center gap-0.5 sm:gap-1">
                      {activePersonnelCount > 0 ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full ${theme.badgeActive} text-[9px] sm:text-[10px] font-bold transition`}>
                          <Users className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${theme.badgeIcon}`} />
                          {activePersonnelCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[8px] sm:text-[9px] text-slate-400">
                          <Users className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                          0
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ── DÒNG HIỂN THỊ TRẠNG THÁI THIẾT BỊ (CHỮ CHẠY MARQUEE NẾU DÀI) ── */}
                  {statusItem && (
                    <div className="w-full pt-1.5 border-t border-slate-800/80 flex items-center gap-1.5 overflow-hidden">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${preset?.dotColor || "bg-amber-400"} animate-pulse`} />
                      <div className="overflow-hidden relative w-full text-[10px]">
                        {isTextLong ? (
                          <div className="animate-rov-marquee text-amber-300 font-medium whitespace-nowrap">
                            📢 {statusItem.detailText} &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp; 📢 {statusItem.detailText}
                          </div>
                        ) : (
                          <span className="text-amber-300/90 font-medium truncate block">
                            {statusItem.detailText || statusItem.statusLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </button>

                {/* Hover Preview Tooltip */}
                {isHovered && !selectedROV && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 sm:w-80 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 bg-slate-900 border border-slate-700 text-white pointer-events-none">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs font-bold">
                      <span className={`${theme.textAccent} flex items-center gap-1`}>
                        <Activity className="w-3 h-3" /> {item.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">Nhấp để xem chi tiết</span>
                    </div>

                    {statusItem?.detailText && (
                      <div className="mt-1.5 p-1.5 rounded-lg bg-amber-950/40 border border-amber-600/30 text-[10px] text-amber-300 flex items-center gap-1.5">
                        <Radio className="w-3 h-3 flex-shrink-0 animate-pulse text-amber-400" />
                        <span className="font-semibold">{statusItem.detailText}</span>
                      </div>
                    )}

                    {item.isActive && item.currentProject ? (
                      <div className="mt-2 space-y-1 text-[11px] text-slate-300">
                        <p><b className="text-white">Dự án:</b> {item.currentProject.client} ({item.currentProject.contract || "—"})</p>
                        <p className="line-clamp-1"><b className="text-white">Công việc:</b> {item.currentProject.project_task || "—"}</p>
                        <p><b className="text-white">Tàu/Giàn:</b> {item.currentProject.vessel_rig || item.currentProject.location || "—"}</p>
                        <p><b className="text-white">Thời gian:</b> {fmtDate(item.currentProject.start_date)} → {item.currentProject.end_date ? fmtDate(item.currentProject.end_date) : "Tiếp diễn"}</p>
                        
                        <div className="pt-1.5 mt-1 border-t border-slate-800">
                          <p className={`text-[10px] font-bold ${theme.textAccent} uppercase`}>
                            Nhân sự đang thực hiện ({activePersonnelCount}):
                          </p>
                          {activePersonnelCount > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {item.activePersonnel.slice(0, 3).map((ap) => (
                                <span key={ap.id} className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-200">
                                  {ap.personnelName} ({ap.role})
                                </span>
                              ))}
                              {activePersonnelCount > 3 && (
                                <span className="text-[10px] text-slate-400">+{activePersonnelCount - 3} người khác</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 italic">Chưa phân công nhân sự trên hệ thống</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">
                        ROV đang Standby tại xưởng vào ngày {fmtDate(selectedDate)}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── DETAIL & PERSONNEL ASSIGNMENT MODAL ────────────────── */}
      {selectedROV && (
        <Dialog open={!!selectedROV} onOpenChange={(open) => !open && setSelectedROV(null)}>
          <DialogContent 
            style={{
              width:
                modalMode === "fullscreen"
                  ? "100vw"
                  : customWidth
                  ? `${customWidth}px`
                  : modalMode === "wide"
                  ? "1260px"
                  : "980px",
              height:
                modalMode === "fullscreen"
                  ? "100vh"
                  : customHeight
                  ? `${customHeight}px`
                  : undefined,
              maxHeight: modalMode === "fullscreen" ? "100vh" : "94vh",
              maxWidth: modalMode === "fullscreen" ? "100vw" : "98vw",
              transform:
                modalMode === "fullscreen"
                  ? "none"
                  : `translate(calc(-50% + ${modalPos.x}px), calc(-50% + ${modalPos.y}px))`,
            }}
            className={`!max-w-none !p-0 !gap-0 bg-slate-900 border border-slate-700 text-white shadow-2xl flex flex-col overflow-hidden transition-all duration-100 ${
              modalMode === "fullscreen"
                ? "!fixed !inset-0 !top-0 !left-0 !rounded-none !z-50"
                : "rounded-2xl"
            }`}
          >
            {/* ── DRAGGABLE HEADER (DI CHUYỂN POPUP BẰNG CÁCH KÉO THANH TIÊU ĐỀ) ── */}
            <div
              onMouseDown={handleHeaderMouseDown}
              className={`flex-shrink-0 border-b border-slate-800 bg-slate-950/95 px-4 sm:px-6 py-3 select-none flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                modalMode === "fullscreen" ? "" : isDraggingModal ? "cursor-grabbing" : "cursor-grab"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {modalMode !== "fullscreen" && (
                  <div
                    className="p-1.5 rounded-lg bg-slate-800/80 text-slate-400 hover:text-cyan-400 transition"
                    title="Bấm giữ và kéo thanh tiêu đề này để di chuyển cửa sổ bất kỳ đâu trên màn hình"
                  >
                    <Move className="w-3.5 h-3.5" />
                  </div>
                )}
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <span className={selectedROV.theme.textAccent}>{selectedROV.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                      Mã: {selectedROV.code}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-xs text-slate-400 mt-0.5">
                    Thông tin thiết bị ROV, trạng thái hoạt động và danh sách nhân sự thực hiện
                  </DialogDescription>
                </div>
              </div>

              {/* Header Right Controls */}
              <div className="flex flex-wrap items-center gap-2 pr-8" data-no-drag>
                {/* Reset vị trí về giữa nếu đã bị di chuyển */}
                {(modalPos.x !== 0 || modalPos.y !== 0) && modalMode !== "fullscreen" && (
                  <button
                    type="button"
                    onClick={handleResetModalPosition}
                    className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-lg transition"
                    title="Đưa cửa sổ về vị trí chính giữa màn hình"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Về giữa</span>
                  </button>
                )}

                {/* Chọn ngày kiểm tra */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs">
                  <Calendar className={`w-3 h-3 ${selectedROV.theme.textAccent}`} />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && onDateChange(e.target.value)}
                    className="bg-transparent text-[11px] font-semibold text-white focus:outline-none cursor-pointer"
                    title="Chọn ngày để kiểm tra ca làm việc"
                  />
                  {selectedDate !== getTodayStr() && (
                    <button
                      type="button"
                      onClick={() => onDateChange(getTodayStr())}
                      className={`text-[10px] font-semibold ${selectedROV.theme.textAccent} hover:underline`}
                    >
                      Hôm nay
                    </button>
                  )}
                </div>

                {/* Trạng thái hoạt động badge */}
                {activeROVModalData?.isActive ? (
                  <span className={`px-2.5 py-1 rounded-full text-[11px] ${selectedROV.theme.bgAccent} ${selectedROV.theme.textAccent} border ${selectedROV.theme.borderAccent} font-bold flex items-center gap-1.5`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedROV.theme.solidDot} animate-pulse`} />
                    ĐANG LÀM VIỆC
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] bg-slate-800 text-slate-400 border border-slate-700 font-semibold">
                    TẠI XƯỞNG
                  </span>
                )}

                {/* ── BỘ ĐIỀU KHIỂN KÍCH THƯỚC CỬA SỔ (THU HẸP / MỞ RỘNG / TOÀN MÀN HÌNH) ── */}
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 ml-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWidth(null)
                      setCustomHeight(null)
                      setModalMode("normal")
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                      modalMode === "normal" && !customWidth
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                    title="Kích thước tiêu chuẩn (980px)"
                  >
                    Chuẩn
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWidth(null)
                      setCustomHeight(null)
                      setModalMode("wide")
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                      modalMode === "wide"
                        ? "bg-blue-600 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                    title="Mở rộng cửa sổ (1260px)"
                  >
                    Rộng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomWidth(null)
                      setCustomHeight(null)
                      setModalMode(modalMode === "fullscreen" ? "normal" : "fullscreen")
                    }}
                    className={`p-1 rounded text-slate-300 hover:text-white transition flex items-center gap-1 text-[10px] ${
                      modalMode === "fullscreen"
                        ? "bg-emerald-600 text-white px-2"
                        : "hover:bg-slate-800 px-1.5"
                    }`}
                    title={modalMode === "fullscreen" ? "Thu nhỏ về cửa sổ thông thường" : "Mở rộng toàn màn hình"}
                  >
                    {modalMode === "fullscreen" ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Thu nhỏ</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Toàn màn hình</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ── NỘI DUNG CUỘN TRONG (SCROLLABLE BODY - CHỐNG BỊ CHE MẤT PHẦN CUỐI) ── */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* ── 1. Ô TRẠNG THÁI HOẠT ĐỘNG CỦA THIẾT BỊ (CÓ DÒNG CHỮ CHẠY KHI DÀI) ── */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-2.5 text-xs shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Radio className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                    <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                      Trạng thái hoạt động thiết bị:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${currentStatusPreset?.badgeColor || "bg-amber-500/20 text-amber-300 border-amber-500/40"}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${currentStatusPreset?.dotColor || "bg-amber-400"} animate-ping`} />
                      {currentROVStatus.statusLabel || "Đang hoạt động"}
                    </span>
                  </div>

                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingStatus(!isEditingStatus)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-slate-900 border border-slate-700 hover:border-cyan-500/50 px-2.5 py-1 rounded-lg transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      {isEditingStatus ? "Đóng form" : "✏️ Cập nhật trạng thái"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onRequireAdmin}
                      className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300"
                      title="Đăng nhập Quản trị để thay đổi trạng thái"
                    >
                      <Shield className="w-3 h-3 text-cyan-400" /> Cần quyền Quản trị để đổi
                    </button>
                  )}
                </div>

                {/* View Mode: Text tĩnh hoặc Dòng chữ chạy (Marquee) */}
                {!isEditingStatus ? (
                  <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex items-center gap-2">
                    <div className="flex-shrink-0 text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                      <Ship className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Chi tiết:</span>
                    </div>

                    {currentROVStatus.detailText && currentROVStatus.detailText.length > 32 ? (
                      <div className="overflow-hidden relative flex-1 w-full" title={currentROVStatus.detailText}>
                        <div className="animate-rov-marquee text-amber-300 font-semibold text-xs tracking-wide">
                          📢 {currentROVStatus.detailText} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 📢 {currentROVStatus.detailText}
                        </div>
                      </div>
                    ) : (
                      <p className="text-amber-200 font-semibold text-xs flex-1">
                        {currentROVStatus.detailText || "Thiết bị sẵn sàng thực hiện nhiệm vụ"}
                      </p>
                    )}
                  </div>
                ) : (
                  /* Form cập nhật trạng thái hoạt động của thiết bị */
                  <div className="p-3 bg-slate-900/95 border border-slate-700/80 rounded-xl space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-400">
                          Chọn trạng thái mẫu nhanh:
                        </label>
                        <select
                          value={editStatusCategory}
                          onChange={(e) => handleSelectStatusPreset(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                        >
                          {ROV_STATUS_PRESETS.map((p) => (
                            <option key={p.category} value={p.category} className="bg-slate-900 text-white">
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold uppercase text-slate-400">
                          Nhãn ngắn hiển thị trên huy hiệu:
                        </label>
                        <Input
                          value={editStatusLabel}
                          onChange={(e) => setEditStatusLabel(e.target.value)}
                          placeholder="Ví dụ: Standby do tàu lên đốc"
                          className="bg-slate-950 border-slate-700 text-white text-xs h-8"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase text-slate-400">
                        Chi tiết trạng thái hoạt động (sẽ thành dòng chữ chạy nếu dài):
                      </label>
                      <textarea
                        value={editStatusDetail}
                        onChange={(e) => setEditStatusDetail(e.target.value)}
                        placeholder="Ví dụ: ROV 954 standby do tàu của khách hàng lên đốc..."
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-700 text-amber-200 rounded-lg p-2 text-xs focus:outline-none focus:border-cyan-400 font-medium"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingStatus(false)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-7 px-3"
                      >
                        Hủy
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isSavingStatus}
                        onClick={handleSaveStatus}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-4 font-semibold"
                      >
                        {isSavingStatus ? "Đang lưu..." : "✓ Lưu trạng thái"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── 2. THÔNG TIN DỰ ÁN ĐANG TRIỂN KHAI CỦA ROV ── */}
              {activeROVModalData?.currentProject ? (
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Thông tin Dự án ROV đang thực hiện
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Hợp đồng: <b className="text-white">{activeROVModalData.currentProject.contract || "—"}</b>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Khách hàng / Đối tác:</p>
                      <p className="text-sm font-bold text-white mt-0.5">{activeROVModalData.currentProject.client}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Thời gian dự án thiết bị:</p>
                      <p className="text-xs font-semibold text-emerald-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(activeROVModalData.currentProject.start_date)} → {activeROVModalData.currentProject.end_date ? fmtDate(activeROVModalData.currentProject.end_date) : "Đang tiếp diễn"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Công việc (Project Task):</p>
                      <p className="text-slate-200 mt-0.5 line-clamp-2">{activeROVModalData.currentProject.project_task || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Địa điểm / Tàu giàn:</p>
                      <p className="text-slate-200 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        {activeROVModalData.currentProject.location || "—"} {activeROVModalData.currentProject.vessel_rig ? `(${activeROVModalData.currentProject.vessel_rig})` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Hiện không có dự án đang hoạt động vào ngày {fmtDate(selectedDate)}. Thiết bị sẵn sàng phục vụ tại ROV Workshop PTSC G&S.
                </div>
              )}

              {/* ── 3. DANH SÁCH NHÂN SỰ ĐANG THỰC HIỆN THEO THIẾT BỊ NÀY ── */}
              <div className="space-y-3 pt-1">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                      Danh sách nhân sự thiết bị ({currentROVAssignments.length})
                    </h3>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                      {activeROVModalData?.activePersonnel.length || 0} đang trong ca ngày {fmtDate(selectedDate)}
                    </span>
                  </div>

                  {/* Toolbar: Chế độ xem (Bảng / Thẻ), Tìm kiếm, Xuất Excel/CSV */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Switcher Bảng / Thẻ */}
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs shadow-inner">
                      <button
                        type="button"
                        onClick={() => setPersonnelViewMode("table")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                          personnelViewMode === "table"
                            ? "bg-cyan-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Xem toàn bộ danh sách dưới dạng bảng số liệu đầy đủ (Tất cả người dùng)"
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        <span>Bảng tổng hợp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPersonnelViewMode("cards")}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                          personnelViewMode === "cards"
                            ? "bg-cyan-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-white"
                        }`}
                        title="Xem dạng danh sách thẻ phân ca"
                      >
                        <LayoutList className="w-3.5 h-3.5" />
                        <span>Thẻ ca</span>
                      </button>
                    </div>

                    {/* Ô tìm kiếm nhanh */}
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhân sự..."
                      value={personnelSearch}
                      onChange={(e) => setPersonnelSearch(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
                    />

                    {/* Nút Xuất Excel */}
                    <button
                      type="button"
                      onClick={handleExportPersonnelExcel}
                      className="flex items-center gap-1 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg transition"
                      title="Xuất bảng nhân sự thiết bị này ra file Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Xuất Excel</span>
                    </button>

                    {/* Nút Xuất CSV */}
                    <button
                      type="button"
                      onClick={handleExportPersonnelCSV}
                      className="flex items-center gap-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-2 py-1 rounded-lg transition"
                      title="Tải tệp CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {filteredROVAssignments.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40 text-slate-400 text-xs">
                    {personnelSearch
                      ? `Không tìm thấy nhân sự phù hợp với "${personnelSearch}".`
                      : `Chưa có nhân sự nào được phân công cho thiết bị ${selectedROV.name}.`}
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isAdmin ? "Vui lòng chọn nhân sự ở biểu mẫu bên dưới để phân công." : "Đăng nhập quyền Quản trị để bổ sung nhân sự."}
                    </p>
                  </div>
                ) : personnelViewMode === "table" ? (
                  /* ── CHẾ ĐỘ XEM BẢNG TỔNG HỢP TOÀN BỘ (CHO TẤT CẢ NGƯỜI DÙNG) ── */
                  <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/60 shadow-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse min-w-[760px]">
                        <thead>
                          <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                            <th className="py-2.5 px-3 w-12 text-center">STT</th>
                            <th className="py-2.5 px-3">Nhân sự</th>
                            <th className="py-2.5 px-3">Chức vụ xưởng</th>
                            <th className="py-2.5 px-3">Chức danh ngoài biển</th>
                            <th className="py-2.5 px-3">Thời gian ca</th>
                            <th className="py-2.5 px-3 text-center">Trạng thái ca</th>
                            <th className="py-2.5 px-3">Ghi chú</th>
                            {isAdmin && <th className="py-2.5 px-3 text-center w-16">Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {filteredROVAssignments.map((asgn, idx) => {
                            const person = allPersonnel.find((p) => p.id === asgn.personnelId)
                            const isCurrentlyActive = isAssignmentActiveOnDate(asgn, selectedDate)

                            return (
                              <tr
                                key={asgn.id}
                                className={`transition hover:bg-slate-800/40 ${
                                  isCurrentlyActive ? "bg-emerald-950/15" : ""
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                  {idx + 1}
                                </td>

                                {/* Nhân sự: Avatar + Họ tên + Tổ phòng */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700 flex-shrink-0 bg-slate-800">
                                      <Image
                                        src={getAvatarUrl(person?.avatar_url) || "/placeholder.svg"}
                                        alt={asgn.personnelName}
                                        width={32}
                                        height={32}
                                        className="object-cover w-full h-full"
                                        unoptimized={!!person?.avatar_url}
                                      />
                                    </div>
                                    <div>
                                      <span className="font-bold text-white block text-xs">
                                        {asgn.personnelName}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block">
                                        {person?.to_phong || "ROV Workshop"}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Chức vụ xưởng */}
                                <td className="py-2.5 px-3 text-slate-300 font-medium">
                                  {person?.chuc_vu || "—"}
                                </td>

                                {/* Chức danh ngoài biển */}
                                <td className="py-2.5 px-3">
                                  {isAdmin ? (
                                    <select
                                      value={asgn.role}
                                      onChange={(e) => handleUpdateAssignmentField(asgn.id, "role", e.target.value)}
                                      className="bg-slate-900 border border-slate-700 text-white text-[11px] font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-400"
                                      title="Thay đổi chức danh ngoài biển"
                                    >
                                      {ROV_OFFSHORE_ROLES.map((r) => (
                                        <option key={r} value={r} className="bg-slate-900 text-white">
                                          {r}
                                        </option>
                                      ))}
                                      {asgn.role && !ROV_OFFSHORE_ROLES.includes(asgn.role as any) && (
                                        <option value={asgn.role}>{asgn.role}</option>
                                      )}
                                    </select>
                                  ) : (
                                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold text-[11px]">
                                      {asgn.role}
                                    </span>
                                  )}
                                </td>

                                {/* Thời gian ca */}
                                <td className="py-2.5 px-3">
                                  {isAdmin ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="date"
                                        value={asgn.startDate}
                                        onChange={(e) => handleUpdateAssignmentField(asgn.id, "startDate", e.target.value)}
                                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-cyan-400"
                                        title="Ngày bắt đầu ca"
                                      />
                                      <span className="text-slate-500">→</span>
                                      <input
                                        type="date"
                                        value={asgn.endDate || ""}
                                        onChange={(e) => handleUpdateAssignmentField(asgn.id, "endDate", e.target.value)}
                                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-200 focus:outline-none focus:border-cyan-400"
                                        title="Ngày kết thúc ca (bỏ trống nếu tiếp diễn)"
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-slate-400 inline" />
                                      {fmtDate(asgn.startDate)} → {asgn.endDate ? fmtDate(asgn.endDate) : "Tiếp diễn"}
                                    </span>
                                  )}
                                </td>

                                {/* Trạng thái ca */}
                                <td className="py-2.5 px-3 text-center">
                                  {isCurrentlyActive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      Đang làm việc
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-400 font-medium">
                                      Ngoài ca
                                    </span>
                                  )}
                                </td>

                                {/* Ghi chú */}
                                <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                                  {isAdmin ? (
                                    <input
                                      type="text"
                                      defaultValue={asgn.note || ""}
                                      placeholder="Ghi chú..."
                                      onBlur={(e) => {
                                        if (e.target.value !== (asgn.note || "")) {
                                          handleUpdateAssignmentField(asgn.id, "note", e.target.value)
                                        }
                                      }}
                                      className="bg-transparent hover:bg-slate-900 focus:bg-slate-900 border border-transparent hover:border-slate-700 focus:border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-slate-200 w-full"
                                    />
                                  ) : (
                                    <span>{asgn.note || "—"}</span>
                                  )}
                                </td>

                                {/* Thao tác xóa cho Admin */}
                                {isAdmin && (
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAssignment(asgn.id, asgn.personnelName)}
                                      className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                                      title="Xóa nhân sự khỏi thiết bị ROV này"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 inline" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* ── CHẾ ĐỘ XEM THẺ PHÂN CA (CARDS VIEW) ── */
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredROVAssignments.map((asgn) => {
                      const person = allPersonnel.find((p) => p.id === asgn.personnelId)
                      const isCurrentlyActive = isAssignmentActiveOnDate(asgn, selectedDate)

                      return (
                        <div
                          key={asgn.id}
                          className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border transition ${
                            isCurrentlyActive
                              ? "bg-slate-950/90 border-emerald-500/50 shadow-sm"
                              : "bg-slate-950/40 border-slate-800 opacity-80"
                          }`}
                        >
                          {/* Person info */}
                          <div className="flex items-center gap-2.5 min-w-[200px]">
                            <div className="w-9 h-9 rounded-full overflow-hidden border border-slate-700 flex-shrink-0 bg-slate-800">
                              <Image
                                src={getAvatarUrl(person?.avatar_url) || "/placeholder.svg"}
                                alt={asgn.personnelName}
                                width={36}
                                height={36}
                                className="object-cover w-full h-full"
                                unoptimized={!!person?.avatar_url}
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">{asgn.personnelName}</span>
                                {isCurrentlyActive && (
                                  <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40">
                                    Đang làm việc
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block">
                                Chức vụ xưởng: {person?.chuc_vu || "—"}
                              </span>
                            </div>
                          </div>

                          {/* Role selector & Date display/edit */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            {/* Chức danh ngoài biển */}
                            {isAdmin ? (
                              <select
                                value={asgn.role}
                                onChange={(e) => handleUpdateAssignmentField(asgn.id, "role", e.target.value)}
                                className="bg-slate-800 border border-slate-700 text-white text-[11px] font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-400"
                                title="Thay đổi chức danh ngoài biển"
                              >
                                {ROV_OFFSHORE_ROLES.map((r) => (
                                  <option key={r} value={r} className="bg-slate-900 text-white">
                                    {r}
                                  </option>
                                ))}
                                {asgn.role && !ROV_OFFSHORE_ROLES.includes(asgn.role as any) && (
                                  <option value={asgn.role}>{asgn.role}</option>
                                )}
                              </select>
                            ) : (
                              <span className="px-2 py-0.5 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-semibold text-[11px]">
                                {asgn.role}
                              </span>
                            )}

                            {/* Ngày bắt đầu - Ngày kết thúc (có thể sửa đổi nếu đổi ca) */}
                            <div className="flex items-center gap-1 text-[11px] bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {isAdmin ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="date"
                                    value={asgn.startDate}
                                    onChange={(e) => handleUpdateAssignmentField(asgn.id, "startDate", e.target.value)}
                                    className="bg-transparent text-[10px] text-slate-200 focus:outline-none"
                                    title="Ngày bắt đầu ca làm việc của nhân sự"
                                  />
                                  <span className="text-slate-500">→</span>
                                  <input
                                    type="date"
                                    value={asgn.endDate || ""}
                                    onChange={(e) => handleUpdateAssignmentField(asgn.id, "endDate", e.target.value)}
                                    className="bg-transparent text-[10px] text-slate-200 focus:outline-none"
                                    title="Ngày kết thúc ca làm việc của nhân sự (bỏ trống nếu tiếp diễn)"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-300">
                                  {fmtDate(asgn.startDate)} → {asgn.endDate ? fmtDate(asgn.endDate) : "Tiếp diễn"}
                                </span>
                              )}
                            </div>

                            {/* Ghi chú ca */}
                            {asgn.note && (
                              <span className="text-[10px] text-slate-400 italic hidden md:inline">
                                ({asgn.note})
                              </span>
                            )}

                            {/* Nút xóa nhân sự (dành cho Admin) */}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAssignment(asgn.id, asgn.personnelName)}
                                className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                                title="Xóa nhân sự khỏi thiết bị ROV này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* ── 4. FORM THÊM NHÂN SỰ VÀO THIẾT BỊ ROV (DÀNH CHO ADMIN) ── */}
              <div className="pt-3 border-t border-slate-800">
                {!isAdmin ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      Cần quyền Quản trị hệ thống để thêm hoặc sửa nhân sự thực hiện dự án.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={onRequireAdmin}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3"
                    >
                      Đăng nhập Quản trị
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleAddPersonnel} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5" /> Thêm nhân sự vào thiết bị {selectedROV.shortName}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Ngày làm việc mặc định trùng với dự án, có thể sửa nếu đổi ca
                      </span>
                    </div>

                    {formError && (
                      <p className="text-xs text-red-400 font-semibold">{formError}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {/* Chọn nhân sự từ sơ đồ phía trên */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">
                          Chọn nhân sự <span className="text-red-400">*</span>:
                        </label>
                        <select
                          value={newPersonnelId}
                          onChange={(e) => {
                            setNewPersonnelId(e.target.value ? Number(e.target.value) : "")
                            setFormError("")
                          }}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                          required
                        >
                          <option value="">-- Chọn nhân sự từ sơ đồ --</option>
                          {allPersonnel.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.ho_va_ten} ({p.chuc_vu || p.to_phong || "Nhân viên"})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* ── CHỌN CHỨC DANH ĐÃ ĐƯỢC TÁCH DÒNG RIÊNG BIỆT ── */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">
                          Chức danh thực hiện dự án <span className="text-red-400">*</span>:
                        </label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as ROVOffshoreRole)}
                          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
                          required
                        >
                          {ROV_OFFSHORE_ROLES.map((role) => (
                            <option key={role} value={role} className="bg-slate-900 text-white py-1">
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Ghi chú ca */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">
                          Ghi chú ca / đợt đổi ca:
                        </label>
                        <Input
                          placeholder="Ví dụ: Ca ngày, Ca 14 ngày..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                        />
                      </div>

                      {/* Ngày bắt đầu */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">
                          Từ ngày (bắt đầu ca) <span className="text-red-400">*</span>:
                        </label>
                        <Input
                          type="date"
                          value={newStartDate}
                          onChange={(e) => setNewStartDate(e.target.value)}
                          className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                          required
                        />
                      </div>

                      {/* Ngày kết thúc */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-semibold text-slate-400">
                          Tới ngày (kết thúc ca):
                        </label>
                        <Input
                          type="date"
                          value={newEndDate}
                          onChange={(e) => setNewEndDate(e.target.value)}
                          className="bg-slate-900 border-slate-700 text-white text-xs h-8"
                          placeholder="Bỏ trống nếu đang tiếp diễn"
                        />
                      </div>

                      {/* Nút submit */}
                      <div className="flex items-end">
                        <Button
                          type="submit"
                          disabled={isSaving}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-8"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Thêm vào {selectedROV.shortName}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* ── TAY KÉO CO GIÃN ĐỘ RỘNG & ĐỘ CAO CỬA SỔ (CORNER DRAG RESIZE HANDLE) ── */}
            {modalMode !== "fullscreen" && (
              <div
                onMouseDown={handleStartResize}
                className="absolute bottom-1 right-1 p-1.5 cursor-nwse-resize text-slate-500 hover:text-cyan-400 select-none group z-30"
                title="Bấm và kéo góc này để thu hẹp hoặc mở rộng chiều rộng & chiều cao cửa sổ tùy ý"
              >
                <GripHorizontal className="w-4 h-4 opacity-70 group-hover:opacity-100 rotate-[-45deg]" />
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
