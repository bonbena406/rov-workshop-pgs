"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { getAvatarUrl, type PersonnelDB, type TrackRecordDB } from "@/lib/supabase"
import { CornerRadialMenu } from "@/components/corner-radial-menu"
import CertificateListModal from "@/components/certificate-list-modal"
import BirthdayModal from "@/components/birthday-modal"
import { siteConfig } from "@/lib/config"
import { type ChartLayoutData } from "@/lib/chart-layout"
import { saveChartLayoutAction } from "@/actions/chart-layout"
import { recordAuditLog } from "@/lib/audit-logs"
import { ROVFleetSection } from "@/components/rov-fleet-section"
import { PersonnelROVModal } from "@/components/personnel-rov-modal"
import { 
  type ROVPersonnelAssignment, 
  type ActivePersonnelAssignmentInfo,
  ROV_PERSONNEL_BADGE_THEMES,
  FLEET_DEFS, 
  isAssignmentActiveOnDate 
} from "@/lib/rov-assignments-shared"
import { 
  Move, 
  Sparkles, 
  Check, 
  RotateCcw, 
  X, 
  GripVertical, 
  ChevronLeft, 
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Columns,
  Lock,
  Shield,
  Briefcase,
  Calendar,
  FileText,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const today = new Date()

interface HomeContentProps {
  initialPersonnel: PersonnelDB[]
  initialByTeam: Record<string, PersonnelDB[]>
  initialChartLayout?: ChartLayoutData | null
  initialTrackRecords?: TrackRecordDB[]
  initialROVAssignments?: ROVPersonnelAssignment[]
}

type DropLocation =
  | { area: "row1"; index?: number }
  | { area: "row2"; index?: number }
  | { area: "team"; teamName: string; section: "phutrach" | "regular"; index?: number }

const isLeader = (p: PersonnelDB): boolean => {
  const capBac = p.cap_bac?.toLowerCase() || ""
  const chucVu = p.chuc_vu?.toLowerCase() || ""
  return (
    capBac.includes("phụ trách") ||
    capBac.includes("tổ trưởng") ||
    capBac.includes("tổ phó") ||
    capBac.includes("leader") ||
    capBac.includes("incharge") ||
    capBac.includes("in charge") ||
    chucVu.includes("phụ trách") ||
    chucVu.includes("tổ trưởng") ||
    chucVu.includes("tổ phó") ||
    chucVu.includes("leader") ||
    chucVu.includes("incharge") ||
    chucVu.includes("in charge")
  )
}

const parseDate = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0
  const parts = dateStr.split("/")
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    return new Date(year, month, day).getTime()
  }
  return 0
}

function computeDefaultLayout(
  allPersonnel: PersonnelDB[],
  byTeam: Record<string, PersonnelDB[]>
): ChartLayoutData {
  const acting = allPersonnel.find((p) => {
    const cv = p.chuc_vu?.toLowerCase() || ""
    const cb = p.cap_bac?.toLowerCase() || ""
    return (
      (cv.includes("acting") && cv.includes("manager")) ||
      (cb.includes("phụ trách") && cb.includes("xưởng"))
    )
  })

  const deputies = allPersonnel
    .filter((p) => {
      const cv = p.chuc_vu?.toLowerCase() || ""
      const cb = p.cap_bac?.toLowerCase() || ""
      return (
        p.id !== acting?.id &&
        (cv.includes("deputy") ||
          cb.includes("xưởng phó") ||
          (cv.includes("xưởng phó") && !cv.includes("phụ trách")))
      )
    })
    .sort((a, b) => {
      const deputyOrder = siteConfig.deputyOrder
      if (deputyOrder && deputyOrder.length > 0) {
        const indexA = deputyOrder.findIndex((name) => a.ho_va_ten?.toLowerCase() === name.toLowerCase())
        const indexB = deputyOrder.findIndex((name) => b.ho_va_ten?.toLowerCase() === name.toLowerCase())
        if (indexA !== -1 && indexB !== -1) return indexA - indexB
        if (indexA !== -1) return -1
        if (indexB !== -1) return 1
      }
      const expA = parseDate(a.kinh_nghiem)
      const expB = parseDate(b.kinh_nghiem)
      if (expA !== expB) return expA - expB
      return a.id - b.id
    })

  const row1Ids = acting ? [acting.id] : []
  const row2Ids = deputies.map((p) => p.id)
  const topIds = new Set([...row1Ids, ...row2Ids])

  const teamsLayout: ChartLayoutData["teams"] = {}

  Object.keys(byTeam).forEach((teamName) => {
    if (teamName === "Khác") return
    const teamMembers = (byTeam[teamName] || []).filter((p) => !topIds.has(p.id))
    const isTongHop = teamName.toLowerCase().includes("tổng hợp") || teamName.toLowerCase().includes("udktcn")

    const leaders = teamMembers
      .filter(isLeader)
      .sort((a, b) => {
        // Luôn ưu tiên Tổ trưởng (Team Leader) lên đầu
        const isLeaderA = a.chuc_vu?.toLowerCase().includes("team leader") || a.cap_bac?.toLowerCase().includes("tổ trưởng")
        const isLeaderB = b.chuc_vu?.toLowerCase().includes("team leader") || b.cap_bac?.toLowerCase().includes("tổ trưởng")
        if (isLeaderA && !isLeaderB) return -1
        if (!isLeaderA && isLeaderB) return 1

        const expA = parseDate(a.kinh_nghiem)
        const expB = parseDate(b.kinh_nghiem)
        if (expA !== expB) return expA - expB
        return a.id - b.id
      })

    const nonLeaders = teamMembers.filter((p) => !isLeader(p))
    let regulars: PersonnelDB[] = []

    if (isTongHop) {
      const janitors = nonLeaders
        .filter(
          (p) =>
            p.chuc_vu?.toLowerCase().includes("janitor") ||
            p.cap_bac?.toLowerCase().includes("tạp vụ"),
        )
        .sort((a, b) => {
          const expA = parseDate(a.kinh_nghiem)
          const expB = parseDate(b.kinh_nghiem)
          if (expA !== expB) return expA - expB
          return a.id - b.id
        })

      const nonJanitors = nonLeaders
        .filter(
          (p) =>
            !p.chuc_vu?.toLowerCase().includes("janitor") &&
            !p.cap_bac?.toLowerCase().includes("tạp vụ"),
        )
        .sort((a, b) => {
          const expA = parseDate(a.kinh_nghiem)
          const expB = parseDate(b.kinh_nghiem)
          if (expA !== expB) return expA - expB
          return a.id - b.id
        })

      regulars = [...nonJanitors, ...janitors]
    } else {
      regulars = nonLeaders.sort((a, b) => {
        const expA = parseDate(a.kinh_nghiem)
        const expB = parseDate(b.kinh_nghiem)
        if (expA !== expB) return expA - expB
        return a.id - b.id
      })
    }

    teamsLayout[teamName] = {
      phutrachIds: leaders.map((p) => p.id),
      regularIds: regulars.map((p) => p.id),
    }
  })

  return {
    row1Ids,
    row2Ids,
    teamColumns: {
      "Tổ VHBD ROV": 7,
      "Tổ Tổng hợp": 2,
    },
    teams: teamsLayout,
  }
}

function reconcileLayout(
  layout: ChartLayoutData,
  allPersonnel: PersonnelDB[],
  byTeam: Record<string, PersonnelDB[]>
): ChartLayoutData {
  const allIds = new Set(allPersonnel.map((p) => p.id))
  const defaultLayout = computeDefaultLayout(allPersonnel, byTeam)

  // 1. Reconcile row1Ids
  let row1 = layout.row1Ids
  if (row1 === undefined) {
    if (layout.actingManagerId) {
      row1 = [layout.actingManagerId]
    } else {
      row1 = defaultLayout.row1Ids || []
    }
  }
  const validRow1 = (row1 || []).filter((id) => allIds.has(id))

  // 2. Reconcile row2Ids
  let row2 = layout.row2Ids
  if (row2 === undefined) {
    if (layout.deputyOrder) {
      row2 = layout.deputyOrder
    } else {
      row2 = defaultLayout.row2Ids || []
    }
  }
  const row1Set = new Set(validRow1)
  const validRow2 = (row2 || []).filter((id) => allIds.has(id) && !row1Set.has(id))
  const topSet = new Set([...validRow1, ...validRow2])

  // 3. Team Columns
  const teamColumns: Record<string, number> = {
    "Tổ VHBD ROV": 7,
    "Tổ Tổng hợp": 2,
    ...(layout.teamColumns || {}),
  }

  // 4. Teams
  const reconciledTeams: ChartLayoutData["teams"] = {}
  const teamNames = Object.keys(byTeam).filter((t) => t !== "Khác")

  teamNames.forEach((teamName) => {
    const existingTeam = layout.teams?.[teamName]
    const defaultTeam = defaultLayout.teams?.[teamName] || { phutrachIds: [], regularIds: [] }

    if (!existingTeam) {
      reconciledTeams[teamName] = defaultTeam
      return
    }

    const teamMemberIds = new Set((byTeam[teamName] || []).map((p) => p.id))
    const validPhutrach = (existingTeam.phutrachIds || []).filter((id) => allIds.has(id) && !topSet.has(id))
    const validRegular = (existingTeam.regularIds || []).filter((id) => allIds.has(id) && !topSet.has(id))
    const trackedIds = new Set([...topSet, ...validPhutrach, ...validRegular])

    defaultTeam.phutrachIds.forEach((id) => {
      if (!trackedIds.has(id) && teamMemberIds.has(id)) {
        validPhutrach.push(id)
        trackedIds.add(id)
      }
    })
    defaultTeam.regularIds.forEach((id) => {
      if (!trackedIds.has(id) && teamMemberIds.has(id)) {
        validRegular.push(id)
        trackedIds.add(id)
      }
    })

    reconciledTeams[teamName] = {
      phutrachIds: validPhutrach,
      regularIds: validRegular,
    }
  })

  return {
    row1Ids: validRow1,
    row2Ids: validRow2,
    teamColumns,
    teams: reconciledTeams,
  }
}

export default function HomeContent({ 
  initialPersonnel, 
  initialByTeam, 
  initialChartLayout,
  initialTrackRecords,
  initialROVAssignments,
}: HomeContentProps) {
  const allPersonnel = initialPersonnel
  const byTeam = initialByTeam
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [showBirthdayModal, setShowBirthdayModal] = useState(false)
  const [selectedPersonnelROV, setSelectedPersonnelROV] = useState<{
    person: PersonnelDB
    info: ActivePersonnelAssignmentInfo
  } | null>(null)

  // ROV Fleet and Assignments state
  const [assignments, setAssignments] = useState<ROVPersonnelAssignment[]>(initialROVAssignments || [])
  const [trackRecords] = useState<TrackRecordDB[]>(initialTrackRecords || [])
  const [selectedROVDate, setSelectedROVDate] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  })

  // Map nhân sự đang thực hiện dự án theo thiết bị ROV
  const activeAssignmentsMap = useMemo(() => {
    const map = new Map<number, ActivePersonnelAssignmentInfo>()
    assignments.forEach((asgn) => {
      if (isAssignmentActiveOnDate(asgn, selectedROVDate)) {
        const rovDef = FLEET_DEFS.find((f) => f.id === asgn.rovId)
        const fleetRecords = rovDef
          ? trackRecords.filter((r) => r.rov_system && rovDef.matcher(r.rov_system))
          : []
        const activeProject = fleetRecords.find((r) => {
          if (!r.start_date) return false
          const s = r.start_date.slice(0, 10)
          if (r.end_date) {
            const e = r.end_date.slice(0, 10)
            return selectedROVDate >= s && selectedROVDate <= e
          }
          return selectedROVDate >= s
        })
        map.set(asgn.personnelId, {
          assignment: asgn,
          rovDef,
          currentProject: activeProject || null,
          projectName: activeProject?.client || undefined,
        })
      }
    })
    return map
  }, [assignments, selectedROVDate, trackRecords])

  // Layout & Drag-and-drop state
  const [layout, setLayout] = useState<ChartLayoutData>(() => {
    const base = initialChartLayout || computeDefaultLayout(allPersonnel, byTeam)
    return reconcileLayout(base, allPersonnel, byTeam)
  })

  const [isReorderMode, setIsReorderMode] = useState(false)
  
  // Admin authentication state
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false)
  const [adminInputPassword, setAdminInputPassword] = useState("")
  const [adminLoginError, setAdminLoginError] = useState("")

  // Desktop Auto-Fit Screen state: tự động co dãn vừa mọi kích thước màn hình desktop
  const [scale, setScale] = useState<number>(1)
  const [isDesktop, setIsDesktop] = useState<boolean>(false)
  const [isAutoFit, setIsAutoFit] = useState<boolean>(true)
  const dashboardRootRef = useRef<HTMLDivElement>(null)
  const dashboardContentRef = useRef<HTMLDivElement>(null)

  const recalculateAutoFit = useCallback(() => {
    if (typeof window === "undefined") return
    const width = window.innerWidth
    const height = window.innerHeight
    const desktop = width >= 1024
    setIsDesktop(desktop)

    if (!desktop || !isAutoFit || !dashboardContentRef.current) {
      setScale(1)
      return
    }

    const contentEl = dashboardContentRef.current
    const prevTransform = contentEl.style.transform
    contentEl.style.transform = "none"
    const contentH = contentEl.scrollHeight || contentEl.offsetHeight
    contentEl.style.transform = prevTransform

    const DESKTOP_CANVAS_WIDTH = 1600
    // Khoảng trống khả dụng trong viewport (trừ lề an toàn 16px trên dưới, 24px hai bên)
    const availH = height - 16
    const availW = width - 24

    if (contentH > 0) {
      const scaleH = availH / contentH
      const scaleW = availW / DESKTOP_CANVAS_WIDTH
      const fitScale = Math.min(scaleH, scaleW, 1)
      const clampedScale = Math.max(0.4, Math.min(1, Number(fitScale.toFixed(3))))
      setScale(clampedScale)
    }
  }, [isAutoFit])

  useEffect(() => {
    recalculateAutoFit()
    const timer = setTimeout(recalculateAutoFit, 80)

    const handleResize = () => {
      recalculateAutoFit()
    }
    window.addEventListener("resize", handleResize)

    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined" && dashboardContentRef.current) {
      ro = new ResizeObserver(() => {
        recalculateAutoFit()
      })
      ro.observe(dashboardContentRef.current)
    }

    return () => {
      clearTimeout(timer)
      window.removeEventListener("resize", handleResize)
      ro?.disconnect()
    }
  }, [recalculateAutoFit, layout, allPersonnel, byTeam, assignments])

  useEffect(() => {
    const checkAuth = () => {
      if (typeof window !== "undefined") {
        const auth = sessionStorage.getItem("rov_admin_auth") === "true"
        setIsAdmin(auth)
      }
    }
    checkAuth()
    window.addEventListener("admin-auth-changed", checkAuth)
    return () => window.removeEventListener("admin-auth-changed", checkAuth)
  }, [])

  // Synchronous ref for drag data guarantees 0-latency tracking
  const dragDataRef = useRef<{ id: number; from: DropLocation } | null>(null)
  const [draggingPersonId, setDraggingPersonId] = useState<number | null>(null)
  const [dropTargetCardId, setDropTargetCardId] = useState<number | null>(null)
  const [dropTargetContainer, setDropTargetContainer] = useState<string | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "info" } | null>(null)

  const showToast = useCallback((text: string, type: "success" | "info" = "success") => {
    setToastMsg({ text, type })
    setTimeout(() => {
      setToastMsg((curr) => (curr?.text === text ? null : curr))
    }, 3000)
  }, [])

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const validPasswords = ["edit123", "ROV@1234"]
    if (process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      validPasswords.push(process.env.NEXT_PUBLIC_ADMIN_PASSWORD)
    }
    if (validPasswords.includes(adminInputPassword.trim())) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("rov_admin_auth", "true")
        window.dispatchEvent(new Event("admin-auth-changed"))
      }
      setIsAdmin(true)
      setShowAdminLoginModal(false)
      setAdminInputPassword("")
      setAdminLoginError("")
      showToast("Đã xác thực quyền Quản trị hệ thống! Bạn có thể sắp xếp các hàng và kéo thả.", "success")
    } else {
      setAdminLoginError("Mật khẩu quản trị không đúng!")
    }
  }

  const handleAdminLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("rov_admin_auth")
      window.dispatchEvent(new Event("admin-auth-changed"))
    }
    setIsAdmin(false)
    setIsReorderMode(false)
    showToast("Đã thoát chế độ Quản trị.", "info")
  }

  // Load from localStorage if available on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("rov_chart_layout")
        if (saved) {
          const parsed = JSON.parse(saved) as ChartLayoutData
          if (parsed && (parsed.row1Ids || parsed.row2Ids || parsed.deputyOrder || parsed.teams)) {
            setLayout(reconcileLayout(parsed, allPersonnel, byTeam))
          }
        }
      } catch (e) {
        console.error("Error reading layout from localStorage:", e)
      }
    }
  }, [allPersonnel, byTeam])

  useEffect(() => {
    if (allPersonnel.length > 0) {
      const hasOpenedBefore = sessionStorage.getItem("certificateModalOpened")
      if (!hasOpenedBefore) {
        setShowCertificateModal(true)
        sessionStorage.setItem("certificateModalOpened", "true")
      }
    }
  }, [allPersonnel])

  const isBirthdayToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    const [day, month, year] = dateStr.split("/").map(Number)
    return today.getDate() === day && today.getMonth() + 1 === month
  }

  const birthdayList = allPersonnel.filter((p) => isBirthdayToday(p.ngay_sinh))

  // Lookup map for fast personnel access
  const personnelMap = useMemo(() => {
    const map = new Map<number, PersonnelDB>()
    allPersonnel.forEach((p) => map.set(p.id, p))
    return map
  }, [allPersonnel])

  // Derive Hàng 1 (Top row)
  const row1Members = useMemo(() => {
    return (layout.row1Ids || []).map((id) => personnelMap.get(id)).filter(Boolean) as PersonnelDB[]
  }, [layout.row1Ids, personnelMap])

  // Derive Hàng 2 (Deputy row: 1, 2, or 3 people)
  const row2Members = useMemo(() => {
    return (layout.row2Ids || []).map((id) => personnelMap.get(id)).filter(Boolean) as PersonnelDB[]
  }, [layout.row2Ids, personnelMap])

  const teamNames = useMemo(() => {
    return Object.keys(byTeam).sort().reverse().filter((team) => team !== "Khác")
  }, [byTeam])

  const colorPalette = [
    "bg-blue-100 border-blue-400",
    "bg-green-100 border-green-400",
    "bg-purple-100 border-purple-400",
    "bg-yellow-100 border-yellow-400",
    "bg-pink-100 border-pink-400",
    "bg-indigo-100 border-indigo-400",
    "bg-orange-100 border-orange-400",
    "bg-teal-100 border-teal-400",
  ]

  const teamColors: Record<string, string> = {}
  teamNames.forEach((team, index) => {
    teamColors[team] = colorPalette[index % colorPalette.length]
  })

  // ---------------- UNIVERSAL DRAG & DROP LOGIC ---------------- //

  // Move person from anywhere to any target location
  const movePerson = useCallback((personId: number, targetLoc: DropLocation) => {
    setLayout((prev) => {
      const next: ChartLayoutData = JSON.parse(JSON.stringify(prev))
      if (!next.row1Ids) next.row1Ids = []
      if (!next.row2Ids) next.row2Ids = []
      if (!next.teams) next.teams = {}

      // Identify whether moving within the exact same list
      let sameList = false
      let currentList: number[] | null = null
      let targetList: number[] | null = null

      if (targetLoc.area === "row1") {
        targetList = next.row1Ids
        if (next.row1Ids.includes(personId)) {
          sameList = true
          currentList = next.row1Ids
        }
      } else if (targetLoc.area === "row2") {
        targetList = next.row2Ids
        if (next.row2Ids.includes(personId)) {
          sameList = true
          currentList = next.row2Ids
        }
      } else if (targetLoc.area === "team") {
        const tName = targetLoc.teamName
        if (!next.teams[tName]) next.teams[tName] = { phutrachIds: [], regularIds: [] }
        targetList = targetLoc.section === "phutrach" ? next.teams[tName].phutrachIds : next.teams[tName].regularIds
        if (targetList.includes(personId)) {
          sameList = true
          currentList = targetList
        }
      }

      if (sameList && currentList && targetList) {
        const oldIdx = currentList.indexOf(personId)
        let targetIdx = targetLoc.index !== undefined ? targetLoc.index : currentList.length - 1
        if (oldIdx !== -1 && oldIdx !== targetIdx) {
          currentList.splice(oldIdx, 1)
          if (targetIdx > oldIdx) targetIdx -= 1
          if (targetIdx < 0) targetIdx = 0
          currentList.splice(targetIdx, 0, personId)
        }
        return next
      }

      // Moving across different areas/lists:
      // 1. Remove personId from everywhere it currently exists
      next.row1Ids = next.row1Ids.filter((id) => id !== personId)
      next.row2Ids = next.row2Ids.filter((id) => id !== personId)
      Object.keys(next.teams).forEach((tName) => {
        const t = next.teams![tName]
        if (t) {
          t.phutrachIds = (t.phutrachIds || []).filter((id) => id !== personId)
          t.regularIds = (t.regularIds || []).filter((id) => id !== personId)
        }
      })

      // 2. Insert into target list
      if (targetLoc.area === "row1") {
        const idx = targetLoc.index !== undefined ? Math.min(targetLoc.index, next.row1Ids.length) : next.row1Ids.length
        next.row1Ids.splice(idx, 0, personId)
      } else if (targetLoc.area === "row2") {
        const idx = targetLoc.index !== undefined ? Math.min(targetLoc.index, next.row2Ids.length) : next.row2Ids.length
        next.row2Ids.splice(idx, 0, personId)
      } else if (targetLoc.area === "team") {
        const tName = targetLoc.teamName
        if (!next.teams[tName]) next.teams[tName] = { phutrachIds: [], regularIds: [] }
        const list = targetLoc.section === "phutrach" ? next.teams[tName].phutrachIds : next.teams[tName].regularIds
        const idx = targetLoc.index !== undefined ? Math.min(targetLoc.index, list.length) : list.length
        list.splice(idx, 0, personId)
      }

      return next
    })
  }, [])

  // Shift position within current row (arrow buttons ‹ ›)
  const shiftCard = useCallback((personId: number, currentLoc: DropLocation, direction: -1 | 1) => {
    setLayout((prev) => {
      const next: ChartLayoutData = JSON.parse(JSON.stringify(prev))
      let list: number[] | undefined

      if (currentLoc.area === "row1") {
        list = next.row1Ids
      } else if (currentLoc.area === "row2") {
        list = next.row2Ids
      } else if (currentLoc.area === "team" && currentLoc.teamName) {
        const t = next.teams?.[currentLoc.teamName]
        if (t) {
          list = currentLoc.section === "phutrach" ? t.phutrachIds : t.regularIds
        }
      }

      if (list) {
        const idx = list.indexOf(personId)
        const newIdx = idx + direction
        if (idx !== -1 && newIdx >= 0 && newIdx < list.length) {
          const temp = list[idx]
          list[idx] = list[newIdx]
          list[newIdx] = temp
        }
      }

      return next
    })
  }, [])

  const cleanupDrag = useCallback(() => {
    dragDataRef.current = null
    setDraggingPersonId(null)
    setDropTargetCardId(null)
    setDropTargetContainer(null)
  }, [])

  const handleCardDragStart = useCallback((e: React.DragEvent, personId: number, from: DropLocation) => {
    if (!isReorderMode) return
    dragDataRef.current = { id: personId, from }
    e.dataTransfer.setData("text/plain", String(personId))
    e.dataTransfer.effectAllowed = "move"
    setDraggingPersonId(personId)
  }, [isReorderMode])

  const handleDropTarget = useCallback((e: React.DragEvent, targetLoc: DropLocation) => {
    if (!isReorderMode) return
    e.preventDefault()
    e.stopPropagation()
    const rawId = e.dataTransfer.getData("text/plain")
    const personId = rawId ? parseInt(rawId, 10) : dragDataRef.current?.id
    if (personId) {
      movePerson(personId, targetLoc)
      const p = personnelMap.get(personId)
      const name = p?.ho_va_ten || "Nhân sự"
      if (targetLoc.area === "row1") {
        showToast(`Đã chuyển ${name} vào Hàng 1`, "info")
      } else if (targetLoc.area === "row2") {
        showToast(`Đã chuyển ${name} vào Hàng 2`, "info")
      } else {
        showToast(`Đã chuyển ${name} vào ${targetLoc.teamName}`, "info")
      }
    }
    cleanupDrag()
  }, [isReorderMode, movePerson, personnelMap, showToast, cleanupDrag])

  // Change columns count for a specific team
  const handleSetTeamColumns = useCallback((teamName: string, columns: number) => {
    setLayout((prev) => {
      const next: ChartLayoutData = JSON.parse(JSON.stringify(prev))
      if (!next.teamColumns) next.teamColumns = {}
      next.teamColumns[teamName] = columns
      return next
    })
    showToast(`Đã đổi ${teamName} thành ${columns} cột!`, "info")
  }, [showToast])

  // Presets: 1 in row 1 + 2 in row 2, or 1 in row 1 + 3 in row 2
  const applyPreset = useCallback((preset: "1-2" | "1-3" | "default") => {
    if (preset === "default") {
      const def = computeDefaultLayout(allPersonnel, byTeam)
      setLayout(def)
      showToast("Đã sắp xếp tự động chuẩn theo chức vụ & thâm niên!", "success")
      return
    }

    setLayout((prev) => {
      const def = computeDefaultLayout(allPersonnel, byTeam)
      const next: ChartLayoutData = JSON.parse(JSON.stringify(prev))
      
      const allTopCandidates = [
        ...(def.row1Ids || []),
        ...(def.row2Ids || [])
      ]
      
      const r1 = allTopCandidates[0] ? [allTopCandidates[0]] : []
      const remaining = allTopCandidates.filter((id) => !r1.includes(id))

      next.row1Ids = r1

      if (preset === "1-2") {
        next.row2Ids = remaining.slice(0, 2)
        const demoted = remaining.slice(2)
        if (demoted.length > 0) {
          if (!next.teams) next.teams = {}
          const vhbd = next.teams["Tổ VHBD ROV"] || { phutrachIds: [], regularIds: [] }
          demoted.forEach((id) => {
            if (!vhbd.phutrachIds.includes(id) && !vhbd.regularIds.includes(id)) {
              vhbd.phutrachIds.push(id)
            }
          })
          next.teams["Tổ VHBD ROV"] = vhbd
        }
        showToast("✓ Đã thiết lập: Hàng 1 (1 người) • Hàng 2 (2 người)!", "success")
      } else if (preset === "1-3") {
        next.row2Ids = remaining.slice(0, 3)
        const r2Set = new Set(next.row2Ids)
        if (next.teams) {
          Object.keys(next.teams).forEach((tName) => {
            next.teams![tName].phutrachIds = (next.teams![tName].phutrachIds || []).filter((id) => !r2Set.has(id))
            next.teams![tName].regularIds = (next.teams![tName].regularIds || []).filter((id) => !r2Set.has(id))
          })
        }
        showToast("✓ Đã thiết lập: Hàng 1 (1 người) • Hàng 2 (3 người)!", "success")
      }

      return next
    })
  }, [allPersonnel, byTeam, showToast])

  // Save layout action
  const handleSaveLayout = useCallback(async () => {
    setIsSaving(true)
    try {
      const toSave: ChartLayoutData = {
        ...layout,
        actingManagerId: layout.row1Ids?.[0] || undefined,
        deputyOrder: layout.row2Ids || [],
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("rov_chart_layout", JSON.stringify(toSave))
      }
      const res = await saveChartLayoutAction(toSave)
      recordAuditLog({
        action_type: "UPDATE_CHART_LAYOUT",
        target_name: "Sơ đồ tổ chức nhân sự",
        summary: "Lưu thay đổi vị trí sắp xếp sơ đồ và số cột hiển thị",
        details: toSave,
      })
      if (res.success) {
        showToast("✓ Đã lưu vị trí và số cột thành công lên hệ thống!", "success")
      } else {
        showToast("Đã lưu vị trí trên trình duyệt hiện tại.", "info")
      }
    } catch (error) {
      showToast("✓ Đã lưu vị trí thành công!", "success")
    } finally {
      setIsSaving(false)
    }
  }, [layout, showToast])

  // Reset action
  const handleResetLayout = useCallback(() => {
    if (initialChartLayout) {
      setLayout(reconcileLayout(initialChartLayout, allPersonnel, byTeam))
    } else {
      setLayout(computeDefaultLayout(allPersonnel, byTeam))
    }
    showToast("Đã khôi phục về trạng thái trước đó.", "info")
  }, [initialChartLayout, allPersonnel, byTeam, showToast])

  return (
    <div 
      ref={dashboardRootRef}
      className={`min-h-screen bg-gradient-to-br from-blue-50 to-white ${
        isDesktop && isAutoFit
          ? "h-screen w-screen overflow-hidden flex flex-col items-center justify-start p-1"
          : "p-2 lg:p-4 overflow-y-auto"
      }`}
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div
            className={`px-4 py-2 rounded-xl shadow-lg border text-xs sm:text-sm font-semibold flex items-center gap-2 ${
              toastMsg.type === "success"
                ? "bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20"
                : "bg-blue-600 text-white border-blue-700 shadow-blue-500/20"
            }`}
          >
            {toastMsg.type === "success" ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {toastMsg.text}
          </div>
        </div>
      )}

      <div 
        ref={dashboardContentRef}
        className="w-full flex flex-col items-center justify-start origin-top transition-transform duration-150"
        style={
          isDesktop && isAutoFit
            ? {
                width: "1600px",
                maxWidth: "1600px",
                transform: scale < 1 ? `scale(${scale})` : undefined,
                transformOrigin: "top center",
              }
            : {
                width: "100%",
                maxWidth: "1600px",
              }
        }
      >
        {/* Header */}
        <div className="text-center mb-1 lg:mb-2 w-full">
          <h1 className="text-base md:text-lg lg:text-xl font-bold text-blue-800 mb-0.5 leading-tight uppercase">
            {siteConfig.title}
          </h1>

          <div className="flex items-center justify-center gap-2.5 text-[10px] lg:text-xs text-gray-500">
            <span>{siteConfig.labels.totalEmployees}: {allPersonnel.length}</span>
            <span className="text-gray-300">•</span>
            {!isAdmin ? (
              <button
                id="admin-login-button"
                onClick={() => setShowAdminLoginModal(true)}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-blue-700 bg-white/80 hover:bg-white border border-gray-200 px-2 py-0.5 rounded-full shadow-2xs transition-all cursor-pointer"
                title="Đăng nhập Quản trị hệ thống để sắp xếp và quản lý"
              >
                <Lock className="w-3 h-3 text-gray-500" />
                <span>Quản trị</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-semibold rounded-full shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chế độ Quản trị</span>
                <button
                  id="admin-logout-button"
                  onClick={handleAdminLogout}
                  className="ml-1 text-[10px] text-emerald-700 hover:text-red-600 underline font-normal cursor-pointer"
                  title="Thoát chế độ Quản trị"
                >
                  [Thoát]
                </button>
              </div>
            )}

            {/* Nút bật/tắt Tự động vừa màn hình Desktop */}
            {isDesktop && (
              <>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => setIsAutoFit(!isAutoFit)}
                  className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full border shadow-2xs transition-all cursor-pointer ${
                    isAutoFit
                      ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold"
                      : "bg-white text-gray-600 border-gray-200 hover:text-gray-900"
                  }`}
                  title={isAutoFit ? "Đang bật Tự động vừa màn hình (không cần cuộn). Bấm để xem kích thước 100%" : "Đang xem kích thước gốc 100%. Bấm để tự động vừa màn hình"}
                >
                  {isAutoFit ? <Minimize2 className="w-3 h-3 text-blue-600" /> : <Maximize2 className="w-3 h-3 text-blue-600" />}
                  <span>{isAutoFit ? `Vừa màn hình (${Math.round(scale * 100)}%)` : "Kích thước 100%"}</span>
                </button>
              </>
            )}
          </div>

          {birthdayList.length > 0 && (
            <div className="overflow-hidden mt-1.5 bg-yellow-100 rounded">
              <div className="flex animate-marquee whitespace-nowrap">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span key={i} className="text-red-700 font-bold px-4 py-0.5 text-xs">
                    {siteConfig.labels.birthdayMarquee} {birthdayList.map((p) => p.ho_va_ten).join(", ")}! 🎂
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar: Reorder Mode Control Bar (Chỉ hiển thị khi Admin đăng nhập) */}
        {isAdmin && (
          <div className="flex items-center justify-center mb-3">
            {!isReorderMode ? (
              <button
                id="reorder-toggle-btn"
                onClick={() => setIsReorderMode(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-semibold rounded-full shadow-sm hover:bg-blue-50 hover:border-blue-500 hover:shadow transition-all cursor-pointer"
              >
                <Move className="w-3.5 h-3.5 text-blue-600" />
                Sắp xếp hàng & Kéo thả vị trí
              </button>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-2 p-2 bg-blue-50/95 border border-blue-300 rounded-xl shadow-md backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150 max-w-4xl">
                <div className="flex items-center gap-1 px-1 text-xs font-bold text-blue-900">
                  <GripVertical className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span>Kéo thả tự do hoặc bấm nút chuyển hàng:</span>
                </div>

                {/* Quick Layout Presets */}
                <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg border border-blue-200">
                  <button
                    onClick={() => applyPreset("1-2")}
                    className="px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                    title="Hàng 1 có 1 người, Hàng 2 có 2 người"
                  >
                    1 Hàng 1 + 2 Hàng 2
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => applyPreset("1-3")}
                    className="px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                    title="Hàng 1 có 1 người, Hàng 2 có 3 người"
                  >
                    1 Hàng 1 + 3 Hàng 2
                  </button>
                </div>

                <button
                  onClick={() => applyPreset("default")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer"
                  title="Tự động sắp xếp lại theo phân cấp tiêu chuẩn"
                >
                  <Sparkles className="w-3 h-3" />
                  Tự động
                </button>

                <button
                  onClick={handleSaveLayout}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  {isSaving ? "Đang lưu..." : "Lưu vị trí & số cột"}
                </button>

                <button
                  onClick={handleResetLayout}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Đặt lại
                </button>

                <button
                  onClick={() => setIsReorderMode(false)}
                  className="inline-flex items-center gap-0.5 px-2 py-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Đóng
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* HÀNG 1: HÀNG TRÊN CÙNG (1 người, hoặc tùy chỉnh) */}
        {/* ========================================================================= */}
        <div className="flex flex-col items-center gap-1 mb-1.5 max-w-4xl mx-auto w-full">
          {isAdmin && (
            <div className="text-center flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-blue-800 bg-blue-100/90 px-3 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                Hàng 1 • Phụ trách xưởng ({row1Members.length} người)
              </span>
            </div>
          )}

          <div
            className={`w-full min-h-[60px] rounded-xl transition-all p-1.5 flex justify-center items-center gap-2.5 flex-wrap ${
              isReorderMode
                ? dropTargetContainer === "row1"
                  ? "bg-emerald-50 border-2 border-dashed border-emerald-500 shadow-md ring-2 ring-emerald-300"
                  : draggingPersonId !== null
                  ? "border-2 border-dashed border-blue-400 bg-blue-50/50"
                  : "border border-dashed border-blue-200 bg-white/40"
                : ""
            }`}
            onDragOver={(e) => {
              if (!isReorderMode) return
              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = "move"
              if (dropTargetContainer !== "row1") setDropTargetContainer("row1")
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              if (dropTargetContainer === "row1") setDropTargetContainer(null)
            }}
            onDrop={(e) => handleDropTarget(e, { area: "row1" })}
          >
            {row1Members.length > 0 ? (
              row1Members.map((person, index) => (
                <div
                  key={person.id}
                  className={`w-full max-w-xs transition-all duration-150 ${
                    draggingPersonId === person.id ? "opacity-30 scale-95" : ""
                  } ${dropTargetCardId === person.id ? "ring-2 ring-emerald-500 scale-105 rounded-lg" : ""}`}
                  draggable={isReorderMode}
                  onDragStart={(e) => handleCardDragStart(e, person.id, { area: "row1", index })}
                  onDragOver={(e) => {
                    if (!isReorderMode) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"
                    if (dropTargetCardId !== person.id) setDropTargetCardId(person.id)
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return
                    if (dropTargetCardId === person.id) setDropTargetCardId(null)
                  }}
                  onDrop={(e) => handleDropTarget(e, { area: "row1", index })}
                  onDragEnd={cleanupDrag}
                >
                  <ManagerCard
                    person={person}
                    area="row1"
                    activeAssignment={activeAssignmentsMap.get(person.id)}
                    onOpenROVModal={(p, info) => setSelectedPersonnelROV({ person: p, info })}
                    isReorderMode={isReorderMode}
                    isDragging={draggingPersonId === person.id}
                    isDropTarget={dropTargetCardId === person.id}
                    onMoveLeft={index > 0 ? () => shiftCard(person.id, { area: "row1" }, -1) : undefined}
                    onMoveRight={index < row1Members.length - 1 ? () => shiftCard(person.id, { area: "row1" }, 1) : undefined}
                    onMoveDown={() => {
                      movePerson(person.id, { area: "row2" })
                      showToast(`Đã chuyển ${person.ho_va_ten} xuống Hàng 2`, "info")
                    }}
                    onMoveDownToTeam={() => {
                      movePerson(person.id, { area: "team", teamName: "Tổ VHBD ROV", section: "phutrach" })
                      showToast(`Đã chuyển ${person.ho_va_ten} xuống Tổ VHBD ROV`, "info")
                    }}
                  />
                </div>
              ))
            ) : (
              isReorderMode && (
                <div className="py-4 px-8 text-center text-xs font-semibold text-blue-600 bg-blue-50/60 border border-dashed border-blue-300 rounded-lg">
                  + Thả nhân sự vào đây để đặt vào Hàng 1
                </div>
              )
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HÀNG 2: XƯỞNG PHÓ (1 người, hoặc 2, 3 người tùy ý người dùng) */}
        {/* ========================================================================= */}
        <div className="flex flex-col items-center gap-1 mb-1.5 max-w-5xl mx-auto w-full">
          {isAdmin && (
            <div className="text-center flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-amber-900 bg-amber-100/90 px-3 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                Hàng 2 • Xưởng phó ({row2Members.length} người)
              </span>
            </div>
          )}

          <div
            className={`w-full min-h-[60px] rounded-xl transition-all p-1.5 flex justify-center items-stretch gap-2.5 lg:gap-3 flex-wrap ${
              isReorderMode
                ? dropTargetContainer === "row2"
                  ? "bg-emerald-50 border-2 border-dashed border-emerald-500 shadow-md ring-2 ring-emerald-300"
                  : draggingPersonId !== null
                  ? "border-2 border-dashed border-amber-400 bg-amber-50/50"
                  : "border border-dashed border-amber-200 bg-white/40"
                : ""
            }`}
            onDragOver={(e) => {
              if (!isReorderMode) return
              e.preventDefault()
              e.stopPropagation()
              e.dataTransfer.dropEffect = "move"
              if (dropTargetContainer !== "row2") setDropTargetContainer("row2")
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              if (dropTargetContainer === "row2") setDropTargetContainer(null)
            }}
            onDrop={(e) => handleDropTarget(e, { area: "row2" })}
          >
            {row2Members.length > 0 ? (
              row2Members.map((person, index) => (
                <div
                  key={person.id}
                  className={`w-full max-w-xs sm:w-64 transition-all duration-150 ${
                    draggingPersonId === person.id ? "opacity-30 scale-95" : ""
                  } ${dropTargetCardId === person.id ? "ring-2 ring-emerald-500 scale-105 rounded-lg" : ""}`}
                  draggable={isReorderMode}
                  onDragStart={(e) => handleCardDragStart(e, person.id, { area: "row2", index })}
                  onDragOver={(e) => {
                    if (!isReorderMode) return
                    e.preventDefault()
                    e.stopPropagation()
                    e.dataTransfer.dropEffect = "move"
                    if (dropTargetCardId !== person.id) setDropTargetCardId(person.id)
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return
                    if (dropTargetCardId === person.id) setDropTargetCardId(null)
                  }}
                  onDrop={(e) => handleDropTarget(e, { area: "row2", index })}
                  onDragEnd={cleanupDrag}
                >
                  <ManagerCard
                    person={person}
                    area="row2"
                    activeAssignment={activeAssignmentsMap.get(person.id)}
                    onOpenROVModal={(p, info) => setSelectedPersonnelROV({ person: p, info })}
                    isReorderMode={isReorderMode}
                    isDragging={draggingPersonId === person.id}
                    isDropTarget={dropTargetCardId === person.id}
                    onMoveLeft={index > 0 ? () => shiftCard(person.id, { area: "row2" }, -1) : undefined}
                    onMoveRight={index < row2Members.length - 1 ? () => shiftCard(person.id, { area: "row2" }, 1) : undefined}
                    onMoveUp={() => {
                      movePerson(person.id, { area: "row1" })
                      showToast(`Đã chuyển ${person.ho_va_ten} lên Hàng 1`, "info")
                    }}
                    onMoveDownToTeam={() => {
                      movePerson(person.id, { area: "team", teamName: "Tổ VHBD ROV", section: "phutrach" })
                      showToast(`Đã chuyển ${person.ho_va_ten} xuống Tổ VHBD ROV (Lãnh đạo)`, "info")
                    }}
                    onMoveDownToTongHop={() => {
                      movePerson(person.id, { area: "team", teamName: "Tổ Tổng hợp", section: "phutrach" })
                      showToast(`Đã chuyển ${person.ho_va_ten} xuống Tổ Tổng hợp (Lãnh đạo)`, "info")
                    }}
                  />
                </div>
              ))
            ) : (
              isReorderMode && (
                <div className="py-4 px-8 text-center text-xs font-semibold text-amber-700 bg-amber-50/60 border border-dashed border-amber-300 rounded-lg">
                  + Thả nhân sự vào đây để đặt vào Hàng 2 (Xưởng phó)
                </div>
              )
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CÁC HÀNG TIẾP THEO: THEO TỪNG TỔ VÀ SỐ CỘT NGƯỜI DÙNG CHỌN */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[1700px] mx-auto px-0.5">
          {(() => {
            const teamColMap: Record<string, number> = {}
            let totalColsSum = 0
            teamNames.forEach((tName) => {
              const isVHBD = tName.includes("VHBD")
              const c = layout.teamColumns?.[tName] || (isVHBD ? 7 : 2)
              teamColMap[tName] = c
              totalColsSum += c
            })

            return (
              <div
                className="flex flex-col lg:grid gap-2 items-start"
                style={{
                  gridTemplateColumns: `repeat(${totalColsSum}, minmax(0, 1fr))`,
                }}
              >
                {teamNames.map((teamName) => {
                  const isVHBD = teamName.includes("VHBD")
                  const teamLayout = layout.teams?.[teamName] || { phutrachIds: [], regularIds: [] }

                  const phutrach = (teamLayout.phutrachIds || [])
                    .map((id) => personnelMap.get(id))
                    .filter(Boolean) as PersonnelDB[]

                  const regularMembers = (teamLayout.regularIds || [])
                    .map((id) => personnelMap.get(id))
                    .filter(Boolean) as PersonnelDB[]

                  const cols = teamColMap[teamName] || (isVHBD ? 7 : 2)
                  const availableColumns = isVHBD ? [4, 5, 6, 7, 8] : [1, 2, 3, 4, 5]

                  return (
                    <div
                      key={teamName}
                      className="w-full flex flex-col"
                      style={{
                        gridColumn: `span ${cols} / span ${cols}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1 px-0.5">
                        <h2
                          className={`text-center text-xs lg:text-sm font-semibold border-2 py-0.5 px-2.5 ${teamColors[teamName]} rounded w-full`}
                        >
                          {teamName} ({phutrach.length + regularMembers.length} người)
                        </h2>
                      </div>

                      {/* Thanh chọn số cột cho tổ */}
                      {isReorderMode && (
                        <div className="flex items-center justify-center gap-1.5 mb-1.5 py-0.5 px-2 bg-white/90 border border-blue-200 rounded-lg text-xs shadow-2xs">
                          <span className="flex items-center gap-1 text-gray-600 font-medium text-[11px]">
                            <Columns className="w-3 h-3 text-blue-600" />
                            Số cột:
                          </span>
                          <div className="flex items-center gap-1">
                            {availableColumns.map((c) => (
                              <button
                                key={c}
                                onClick={() => handleSetTeamColumns(teamName, c)}
                                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                                  cols === c
                                    ? "bg-blue-600 text-white shadow-xs scale-105"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black"
                                }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* VÙNG 1 CỦA TỔ: HÀNG LÃNH ĐẠO TỔ */}
                      <div
                        className={`min-h-[36px] rounded-lg transition-all p-1 mb-1 ${
                          isReorderMode
                            ? dropTargetContainer === `team:${teamName}:phutrach`
                              ? "bg-emerald-50 border-2 border-dashed border-emerald-500 shadow-md ring-2 ring-emerald-300"
                              : draggingPersonId !== null
                              ? "border-2 border-dashed border-blue-300 bg-white/50"
                              : "border border-dashed border-blue-200/70 bg-white/30"
                            : ""
                        }`}
                        onDragOver={(e) => {
                          if (!isReorderMode) return
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = "move"
                          if (dropTargetContainer !== `team:${teamName}:phutrach`) {
                            setDropTargetContainer(`team:${teamName}:phutrach`)
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return
                          if (dropTargetContainer === `team:${teamName}:phutrach`) setDropTargetContainer(null)
                        }}
                        onDrop={(e) => handleDropTarget(e, { area: "team", teamName, section: "phutrach" })}
                      >
                        {phutrach.length > 0 ? (
                          <div className="flex justify-center gap-1.5 flex-wrap">
                            {phutrach.map((person, index) => (
                              <div
                                key={person.id}
                                className={`w-28 transition-all duration-150 ${
                                  draggingPersonId === person.id ? "opacity-30 scale-95" : ""
                                } ${dropTargetCardId === person.id ? "ring-2 ring-emerald-500 scale-105 rounded-lg" : ""}`}
                                draggable={isReorderMode}
                                onDragStart={(e) => handleCardDragStart(e, person.id, { area: "team", teamName, section: "phutrach", index })}
                                onDragOver={(e) => {
                                  if (!isReorderMode) return
                                  e.preventDefault()
                                  e.stopPropagation()
                                  e.dataTransfer.dropEffect = "move"
                                  if (dropTargetCardId !== person.id) setDropTargetCardId(person.id)
                                }}
                                onDragLeave={(e) => {
                                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                                  if (dropTargetCardId === person.id) setDropTargetCardId(null)
                                }}
                                onDrop={(e) => handleDropTarget(e, { area: "team", teamName, section: "phutrach", index })}
                                onDragEnd={cleanupDrag}
                              >
                                <PersonnelCard
                                  person={person}
                                  teamColor={teamColors[teamName]}
                                  activeAssignment={activeAssignmentsMap.get(person.id)}
                                  onOpenROVModal={(p, info) => setSelectedPersonnelROV({ person: p, info })}
                                  isReorderMode={isReorderMode}
                                  isDragging={draggingPersonId === person.id}
                                  isDropTarget={dropTargetCardId === person.id}
                                  onMoveLeft={index > 0 ? () => shiftCard(person.id, { area: "team", teamName, section: "phutrach" }, -1) : undefined}
                                  onMoveRight={index < phutrach.length - 1 ? () => shiftCard(person.id, { area: "team", teamName, section: "phutrach" }, 1) : undefined}
                                  onMoveUpToRow2={() => {
                                    movePerson(person.id, { area: "row2" })
                                    showToast(`Đã chuyển ${person.ho_va_ten} lên Hàng 2 (Xưởng phó)`, "info")
                                  }}
                                  onMoveDownToRegular={() => {
                                    movePerson(person.id, { area: "team", teamName, section: "regular" })
                                    showToast(`Đã chuyển ${person.ho_va_ten} xuống hàng thành viên`, "info")
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          isReorderMode && (
                            <div className="w-full py-2.5 border border-dashed border-gray-300 rounded-lg text-center text-[11px] font-medium text-gray-500 bg-white/40">
                              + Thả vào đây: Lãnh đạo tổ {teamName}
                            </div>
                          )
                        )}
                      </div>

                      {/* VÙNG 2 CỦA TỔ: CÁC HÀNG THÀNH VIÊN THEO SỐ CỘT (COLS) CHUẨN GRID */}
                      <div
                        className={`min-h-[40px] rounded-lg transition-all p-1 ${
                          isReorderMode
                            ? dropTargetContainer === `team:${teamName}:regular`
                              ? "bg-emerald-50 border-2 border-dashed border-emerald-500 shadow-md ring-2 ring-emerald-300"
                              : draggingPersonId !== null
                              ? "border-2 border-dashed border-gray-300 bg-white/40"
                              : "border border-dashed border-gray-200 bg-white/20"
                            : ""
                        }`}
                        onDragOver={(e) => {
                          if (!isReorderMode) return
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = "move"
                          if (dropTargetContainer !== `team:${teamName}:regular`) {
                            setDropTargetContainer(`team:${teamName}:regular`)
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return
                          if (dropTargetContainer === `team:${teamName}:regular`) setDropTargetContainer(null)
                        }}
                        onDrop={(e) => handleDropTarget(e, { area: "team", teamName, section: "regular" })}
                      >
                        {regularMembers.length > 0 ? (
                          <div
                            className="grid gap-1 justify-center mx-auto"
                            style={{
                              gridTemplateColumns: `repeat(${cols}, minmax(0, 112px))`,
                              width: "fit-content",
                              maxWidth: "100%",
                            }}
                          >
                            {regularMembers.map((person, index) => (
                              <div
                                key={person.id}
                                className={`w-full max-w-[112px] transition-all duration-150 ${
                                  draggingPersonId === person.id ? "opacity-30 scale-95" : ""
                                } ${dropTargetCardId === person.id ? "ring-2 ring-emerald-500 scale-105 rounded-lg" : ""}`}
                                draggable={isReorderMode}
                                onDragStart={(e) => handleCardDragStart(e, person.id, { area: "team", teamName, section: "regular", index })}
                                onDragOver={(e) => {
                                  if (!isReorderMode) return
                                  e.preventDefault()
                                  e.stopPropagation()
                                  e.dataTransfer.dropEffect = "move"
                                  if (dropTargetCardId !== person.id) setDropTargetCardId(person.id)
                                }}
                                onDragLeave={(e) => {
                                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                                  if (dropTargetCardId === person.id) setDropTargetCardId(null)
                                }}
                                onDrop={(e) => handleDropTarget(e, { area: "team", teamName, section: "regular", index })}
                                onDragEnd={cleanupDrag}
                              >
                                <PersonnelCard
                                  person={person}
                                  teamColor={teamColors[teamName]}
                                  activeAssignment={activeAssignmentsMap.get(person.id)}
                                  onOpenROVModal={(p, info) => setSelectedPersonnelROV({ person: p, info })}
                                  isReorderMode={isReorderMode}
                                  isDragging={draggingPersonId === person.id}
                                  isDropTarget={dropTargetCardId === person.id}
                                  onMoveLeft={index > 0 ? () => shiftCard(person.id, { area: "team", teamName, section: "regular" }, -1) : undefined}
                                  onMoveRight={index < regularMembers.length - 1 ? () => shiftCard(person.id, { area: "team", teamName, section: "regular" }, 1) : undefined}
                                  onMoveUpToLeader={() => {
                                    movePerson(person.id, { area: "team", teamName, section: "phutrach" })
                                    showToast(`Đã chuyển ${person.ho_va_ten} lên hàng lãnh đạo tổ`, "info")
                                  }}
                                  onMoveUpToRow2={() => {
                                    movePerson(person.id, { area: "row2" })
                                    showToast(`Đã chuyển ${person.ho_va_ten} lên Hàng 2 (Xưởng phó)`, "info")
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          isReorderMode && (
                            <div className="w-full py-3 border border-dashed border-gray-300 rounded-lg text-center text-[11px] font-medium text-gray-400 bg-white/40">
                              + Thả thành viên vào đây ({teamName})
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* ── 04 NÚT THIẾT BỊ ROV (NGAY DƯỚI TOÀN BỘ SƠ ĐỒ NHÂN SỰ) ── */}
        <ROVFleetSection
          allPersonnel={allPersonnel}
          trackRecords={trackRecords}
          assignments={assignments}
          onAssignmentsChange={setAssignments}
          isAdmin={isAdmin}
          onRequireAdmin={() => setShowAdminLoginModal(true)}
          selectedDate={selectedROVDate}
          onDateChange={setSelectedROVDate}
        />
      </div>

      {/* Radial Menu and Modals */}
      <CornerRadialMenu 
        onOpenCertificates={() => setShowCertificateModal(true)} 
        onOpenBirthdays={() => setShowBirthdayModal(true)} 
        allPersonnel={allPersonnel} 
      />

      <CertificateListModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        allPersonnel={allPersonnel}
        personnel={allPersonnel}
      />

      <BirthdayModal
        isOpen={showBirthdayModal}
        onClose={() => setShowBirthdayModal(false)}
        allPersonnel={allPersonnel}
        personnel={allPersonnel}
      />

      <PersonnelROVModal
        isOpen={!!selectedPersonnelROV}
        onClose={() => setSelectedPersonnelROV(null)}
        person={selectedPersonnelROV?.person || null}
        info={selectedPersonnelROV?.info || null}
      />

      {/* DIALOG ĐĂNG NHẬP ADMIN TRỰC TIẾP TRÊN TRANG CHỦ */}
      <Dialog open={showAdminLoginModal} onOpenChange={setShowAdminLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900">
              <Shield className="w-5 h-5 text-blue-600" />
              Đăng nhập Quản trị hệ thống
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdminLogin} className="space-y-4 pt-2">
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Nhập mật khẩu quản trị để mở chế độ sắp xếp vị trí hàng, kéo thả và cấu hình hệ thống.
              </p>
              <Input
                id="admin-password-input"
                type="password"
                placeholder="Nhập mật khẩu quản trị..."
                value={adminInputPassword}
                onChange={(e) => setAdminInputPassword(e.target.value)}
                required
                autoFocus
              />
            </div>
            {adminLoginError && <p className="text-xs text-red-600 font-semibold">{adminLoginError}</p>}
            <div className="flex gap-2">
              <Button id="admin-submit-button" type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Đăng nhập
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAdminLoginModal(false)
                  setAdminInputPassword("")
                  setAdminLoginError("")
                }}
              >
                Hủy
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 25s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }

        @keyframes pulse-birthday {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
          }
        }

        .animate-pulse-birthday {
          animation: pulse-birthday 2s infinite;
        }

        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
    </div>
  )
}

function fmtDate(d?: string | null): string {
  if (!d) return "—"
  const parts = d.slice(0, 10).split("-")
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

function ManagerCard({
  person,
  area,
  activeAssignment,
  onOpenROVModal,
  isReorderMode,
  isDragging,
  isDropTarget,
  onMoveLeft,
  onMoveRight,
  onMoveUp,
  onMoveDown,
  onMoveDownToTeam,
  onMoveDownToTongHop,
}: {
  person: PersonnelDB
  area: "row1" | "row2"
  activeAssignment?: ActivePersonnelAssignmentInfo
  onOpenROVModal?: (person: PersonnelDB, info: ActivePersonnelAssignmentInfo) => void
  isReorderMode?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onMoveDownToTeam?: () => void
  onMoveDownToTongHop?: () => void
}) {
  const isBirthdayToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    const [day, month, year] = dateStr.split("/").map(Number)
    return today.getDate() === day && today.getMonth() + 1 === month
  }

  const isBirthday = isBirthdayToday(person.ngay_sinh)
  const badgeTheme = activeAssignment?.assignment?.rovId
    ? ROV_PERSONNEL_BADGE_THEMES[activeAssignment.assignment.rovId] || ROV_PERSONNEL_BADGE_THEMES["compact-07"]
    : null

  const cardInner = (
    <div
      className={`relative z-10 border-2 rounded-lg bg-yellow-100 shadow-md p-1.5 sm:p-2 flex flex-col items-center justify-center transition-all w-full h-full select-none ${
        badgeTheme
          ? `${badgeTheme.cardBorder} ${badgeTheme.cardRing}`
          : ""
      } ${
        isBirthday ? "animate-pulse-birthday" : ""
      } ${
        isReorderMode
          ? "cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-lg"
          : "hover:shadow-xl cursor-pointer"
      }`}
    >
      {isReorderMode && (
        <div className="absolute top-1.5 right-1.5 z-30 p-1 bg-white/90 rounded shadow-sm text-blue-600">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full overflow-hidden border-2 mb-1 flex-shrink-0 pointer-events-none select-none">
        <Image
          src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
          alt={person.ho_va_ten}
          width={56}
          height={56}
          draggable={false}
          className="object-cover rounded-full w-full h-full pointer-events-none select-none"
          unoptimized={!!person.avatar_url}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/default-avatar.png"
          }}
        />
      </div>
      <p className="text-xs lg:text-sm font-semibold text-center leading-tight pointer-events-none select-none line-clamp-1">{person.ho_va_ten}</p>
      <p className="text-[10px] lg:text-xs font-bold text-center mt-0.5 text-gray-700 pointer-events-none select-none line-clamp-1">{person.cap_bac || person.chuc_vu}</p>

      {/* Badge ký hiệu đang thực hiện dự án ROV */}
      {activeAssignment && badgeTheme && (
        <div
          className={`mt-1.5 px-2.5 py-0.5 rounded-full ${badgeTheme.badgeBg} text-[9px] font-bold shadow-md flex items-center gap-1.5 max-w-[95%] pointer-events-none`}
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${badgeTheme.dotBg} opacity-75`}></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="truncate">⚓ {activeAssignment.rovDef?.shortName || activeAssignment.assignment.rovName}</span>
        </div>
      )}

      {isBirthday && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <Image
            src="/images/design-mode/birthday-frame2.png"
            alt="Birthday Frame"
            fill
            draggable={false}
            className="object-cover rounded-lg opacity-90"
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="relative h-full group hover:z-40">
      {isReorderMode ? (
        cardInner
      ) : activeAssignment && onOpenROVModal ? (
        <button
          type="button"
          onClick={() => onOpenROVModal(person, activeAssignment)}
          className="block h-full w-full text-left cursor-pointer focus:outline-none"
          title={`Bấm để xem thông tin thiết bị & dự án ${activeAssignment.assignment.rovName}`}
        >
          {cardInner}
        </button>
      ) : (
        <Link href={`/profile/${person.id}`} className="block h-full">
          {cardInner}
        </Link>
      )}

      {/* Popup tooltip khi rê chuột vào nhân sự đang làm việc trên ROV */}
      {activeAssignment && !isReorderMode && (
        <div
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 w-64 sm:w-72 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out shadow-2xl ${
            area === "row1"
              ? "top-[calc(100%+10px)] translate-y-1 group-hover:translate-y-0"
              : "bottom-[calc(100%+10px)] -translate-y-1 group-hover:translate-y-0"
          }`}
        >
          <div className="relative bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl">
            {/* Header tooltip: ROV Name & Status */}
            <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full ${badgeTheme?.dotBg || "bg-emerald-400"} animate-pulse flex-shrink-0`} />
                <span className={`font-bold text-xs truncate ${badgeTheme?.textAccent || "text-emerald-400"}`}>
                  ⚓ {activeAssignment.rovDef?.name || activeAssignment.assignment.rovName}
                </span>
              </div>
              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                Đang làm việc
              </span>
            </div>

            {/* Chi tiết chức danh, dự án & thời gian */}
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-start gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Chức danh ngoài biển:</span>
                  <span className="font-semibold text-white">{activeAssignment.assignment.role}</span>
                </div>
              </div>

              <div className="flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Dự án:</span>
                  <span className="font-medium text-slate-200 line-clamp-2">
                    {activeAssignment.currentProject?.client || activeAssignment.projectName || "Dự án ROV Offshore"}
                    {activeAssignment.currentProject?.project_task ? ` (${activeAssignment.currentProject.project_task})` : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Thời gian phân công:</span>
                  <span className="font-semibold text-emerald-300">
                    {fmtDate(activeAssignment.assignment.startDate)} → {activeAssignment.assignment.endDate ? fmtDate(activeAssignment.assignment.endDate) : "Tiếp diễn"}
                  </span>
                </div>
              </div>
            </div>

            {/* Hint footer */}
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-cyan-300/90 flex items-center justify-center gap-1 font-medium">
              <span>👉 Bấm nhẹ để xem chi tiết đầy đủ</span>
            </div>

            {/* Mũi tên tam giác */}
            {area === "row1" ? (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] border-b-slate-800" />
            ) : (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-slate-800" />
            )}
          </div>
        </div>
      )}

      {/* Action Buttons in Reorder Mode */}
      {isReorderMode && (
        <div className="absolute -bottom-3.5 inset-x-0 z-30 flex flex-wrap justify-center items-center gap-1">
          {onMoveLeft && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveLeft()
              }}
              className="p-1 bg-white hover:bg-blue-50 border border-blue-300 rounded-full shadow-md text-blue-700 cursor-pointer"
              title="Di chuyển sang trái"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}

          {area === "row1" && onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDown()
              }}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 border border-amber-700 rounded-full shadow-md text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="Chuyển xuống Hàng 2 (Xưởng phó)"
            >
              <ArrowDown className="w-2.5 h-2.5" />
              Xuống H2
            </button>
          )}

          {area === "row2" && (
            <>
              {onMoveUp && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveUp()
                  }}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded-full shadow-md text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                  title="Chuyển lên Hàng 1 (Phụ trách xưởng)"
                >
                  <ArrowUp className="w-2.5 h-2.5" />
                  Lên H1
                </button>
              )}

              {onMoveDownToTeam && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveDownToTeam()
                  }}
                  className="px-2 py-0.5 bg-teal-600 hover:bg-teal-700 border border-teal-700 rounded-full shadow-md text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                  title="Chuyển xuống hàng dưới: Tổ VHBD ROV"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                  Xuống VHBD
                </button>
              )}

              {onMoveDownToTongHop && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMoveDownToTongHop()
                  }}
                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 rounded-full shadow-md text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                  title="Chuyển xuống hàng dưới: Tổ Tổng hợp"
                >
                  <ArrowDown className="w-2.5 h-2.5" />
                  Xuống TH
                </button>
              )}
            </>
          )}

          {onMoveRight && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveRight()
              }}
              className="p-1 bg-white hover:bg-blue-50 border border-blue-300 rounded-full shadow-md text-blue-700 cursor-pointer"
              title="Di chuyển sang phải"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PersonnelCard({
  person,
  teamColor,
  activeAssignment,
  onOpenROVModal,
  isReorderMode,
  isDragging,
  isDropTarget,
  onMoveLeft,
  onMoveRight,
  onMoveUpToLeader,
  onMoveUpToRow2,
  onMoveDownToRegular,
}: {
  person: PersonnelDB
  teamColor: string
  activeAssignment?: ActivePersonnelAssignmentInfo
  onOpenROVModal?: (person: PersonnelDB, info: ActivePersonnelAssignmentInfo) => void
  isReorderMode?: boolean
  isDragging?: boolean
  isDropTarget?: boolean
  onMoveLeft?: () => void
  onMoveRight?: () => void
  onMoveUpToLeader?: () => void
  onMoveUpToRow2?: () => void
  onMoveDownToRegular?: () => void
}) {
  const isBirthdayToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    const [day, month, year] = dateStr.split("/").map(Number)
    return today.getDate() === day && today.getMonth() + 1 === month
  }

  const isBirthday = isBirthdayToday(person.ngay_sinh)
  const badgeTheme = activeAssignment?.assignment?.rovId
    ? ROV_PERSONNEL_BADGE_THEMES[activeAssignment.assignment.rovId] || ROV_PERSONNEL_BADGE_THEMES["compact-07"]
    : null

  const cardInner = (
    <div
      className={`relative z-10 border-2 rounded-lg ${teamColor} shadow p-1 flex flex-col items-center justify-between transition-all w-full h-full select-none ${
        badgeTheme
          ? `${badgeTheme.cardBorder} ${badgeTheme.cardRing}`
          : ""
      } ${
        isBirthday ? "animate-pulse-birthday" : ""
      } ${
        isReorderMode
          ? "cursor-grab active:cursor-grabbing hover:border-blue-500 hover:shadow-md"
          : "hover:shadow-md cursor-pointer"
      }`}
    >
      {isReorderMode && (
        <div className="absolute top-1 right-1 z-30 p-0.5 bg-white/90 rounded shadow-sm text-blue-600">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-full overflow-hidden border-2 flex-shrink-0 pointer-events-none select-none">
        <Image
          src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
          alt={person.ho_va_ten}
          width={44}
          height={44}
          draggable={false}
          className="object-cover rounded-full w-full h-full pointer-events-none select-none"
          unoptimized={!!person.avatar_url}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = "/default-avatar.png"
          }}
        />
      </div>

      <div className="flex flex-col items-center justify-center flex-1 min-h-0 w-full pointer-events-none select-none">
        <p className="text-[10px] lg:text-[11px] font-medium text-center line-clamp-2 leading-tight w-full px-0.5">
          {person.ho_va_ten}
        </p>
        <p className="text-[8px] lg:text-[9px] text-gray-600 text-center mt-0.5 line-clamp-1 w-full px-0.5">{person.chuc_vu}</p>
      </div>

      {/* Badge ký hiệu đang thực hiện dự án ROV */}
      {activeAssignment && badgeTheme && (
        <div
          className={`w-full mt-0.5 px-1 py-0.2 rounded ${badgeTheme.badgeBg} text-[8px] font-bold flex items-center justify-center gap-1 shadow-2xs pointer-events-none`}
        >
          <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${badgeTheme.dotBg} opacity-75`}></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
          </span>
          <span className="truncate">⚓ {activeAssignment.rovDef?.shortName || activeAssignment.assignment.rovName}</span>
        </div>
      )}

      {isBirthday && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <Image
            src="/images/design-mode/birthday-frame2.png"
            alt="Birthday Frame"
            fill
            draggable={false}
            className="object-cover rounded-lg opacity-90"
          />
        </div>
      )}
    </div>
  )

  return (
    <div className="relative w-full h-24 sm:h-28 lg:h-[110px] group hover:z-40">
      {isReorderMode ? (
        cardInner
      ) : activeAssignment && onOpenROVModal ? (
        <button
          type="button"
          onClick={() => onOpenROVModal(person, activeAssignment)}
          className="block w-full h-full text-left cursor-pointer focus:outline-none"
          title={`Bấm để xem thông tin thiết bị & dự án ${activeAssignment.assignment.rovName}`}
        >
          {cardInner}
        </button>
      ) : (
        <Link href={`/profile/${person.id}`} className="block w-full h-full">
          {cardInner}
        </Link>
      )}

      {/* Popup tooltip khi rê chuột vào nhân sự đang làm việc trên ROV */}
      {activeAssignment && !isReorderMode && (
        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-64 sm:w-72 opacity-0 invisible -translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 ease-out shadow-2xl">
          <div className="relative bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-xl p-3 shadow-2xl">
            {/* Header tooltip: ROV Name & Status */}
            <div className="flex items-center justify-between gap-1.5 border-b border-slate-800 pb-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`w-2 h-2 rounded-full ${badgeTheme?.dotBg || "bg-emerald-400"} animate-pulse flex-shrink-0`} />
                <span className={`font-bold text-xs truncate ${badgeTheme?.textAccent || "text-emerald-400"}`}>
                  ⚓ {activeAssignment.rovDef?.name || activeAssignment.assignment.rovName}
                </span>
              </div>
              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0">
                Đang làm việc
              </span>
            </div>

            {/* Chi tiết chức danh, dự án & thời gian */}
            <div className="space-y-1.5 text-[11px] text-slate-300">
              <div className="flex items-start gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Chức danh ngoài biển:</span>
                  <span className="font-semibold text-white">{activeAssignment.assignment.role}</span>
                </div>
              </div>

              <div className="flex items-start gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Dự án:</span>
                  <span className="font-medium text-slate-200 line-clamp-2">
                    {activeAssignment.currentProject?.client || activeAssignment.projectName || "Dự án ROV Offshore"}
                    {activeAssignment.currentProject?.project_task ? ` (${activeAssignment.currentProject.project_task})` : ""}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-slate-400 text-[10px] block leading-none">Thời gian phân công:</span>
                  <span className="font-semibold text-emerald-300">
                    {fmtDate(activeAssignment.assignment.startDate)} → {activeAssignment.assignment.endDate ? fmtDate(activeAssignment.assignment.endDate) : "Tiếp diễn"}
                  </span>
                </div>
              </div>
            </div>

            {/* Hint footer */}
            <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10px] text-cyan-300/90 flex items-center justify-center gap-1 font-medium">
              <span>👉 Bấm nhẹ để xem chi tiết đầy đủ</span>
            </div>

            {/* Mũi tên tam giác hướng xuống */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-slate-800" />
          </div>
        </div>
      )}

      {/* Action Buttons in Reorder Mode */}
      {isReorderMode && (
        <div className="absolute -bottom-3 inset-x-0 z-30 flex justify-center items-center gap-0.5 opacity-90 group-hover:opacity-100">
          {onMoveLeft && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveLeft()
              }}
              className="p-0.5 bg-white hover:bg-blue-50 border border-blue-300 rounded shadow text-blue-700 cursor-pointer"
              title="Di chuyển sang trước"
            >
              <ChevronLeft className="w-2.5 h-2.5" />
            </button>
          )}

          {onMoveUpToRow2 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUpToRow2()
              }}
              className="px-1 py-0.5 bg-amber-600 hover:bg-amber-700 border border-amber-700 rounded shadow text-white text-[9px] font-bold cursor-pointer"
              title="Chuyển lên Hàng 2 (Xưởng phó)"
            >
              ↑H2
            </button>
          )}

          {onMoveUpToLeader && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveUpToLeader()
              }}
              className="p-0.5 bg-blue-600 hover:bg-blue-700 border border-blue-700 rounded shadow text-white cursor-pointer"
              title="Chuyển lên hàng lãnh đạo tổ"
            >
              <ArrowUp className="w-2.5 h-2.5" />
            </button>
          )}

          {onMoveDownToRegular && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveDownToRegular()
              }}
              className="p-0.5 bg-gray-600 hover:bg-gray-700 border border-gray-700 rounded shadow text-white cursor-pointer"
              title="Chuyển xuống hàng thành viên"
            >
              <ArrowDown className="w-2.5 h-2.5" />
            </button>
          )}

          {onMoveRight && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onMoveRight()
              }}
              className="p-0.5 bg-white hover:bg-blue-50 border border-blue-300 rounded shadow text-blue-700 cursor-pointer"
              title="Di chuyển sang sau"
            >
              <ChevronRight className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
