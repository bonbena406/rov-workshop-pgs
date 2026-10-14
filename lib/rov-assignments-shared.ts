// Các chức danh chuẩn ngoài biển theo yêu cầu người dùng
export const ROV_OFFSHORE_ROLES = [
  "ROV Offshore Manager",
  "ROV Superintendent",
  "Senior ROV Supervisor",
  "Assistant ROV Offshore Manager",
  "ROV Supervisor",
  "Senior ROV Submersible",
  "Assistant ROV Supervisor",
  "ROV Submersible",
  "ROV Pilot technician",
  "ROV Representative",
  "Junior ROV Pilot",
  "Assistant ROV Pilot",
  "ROV Pilot support engineer",
] as const

export type ROVOffshoreRole = typeof ROV_OFFSHORE_ROLES[number]

// Định nghĩa màu sắc và phong cách giao diện riêng biệt cho từng ROV
export interface ROVColorTheme {
  name: string
  colorName: string
  hex: string
  activeBorder: string
  activeShadow: string
  activeGradient: string
  pingDot: string
  solidDot: string
  textAccent: string
  borderAccent: string
  bgAccent: string
  badgeActive: string
  badgeIcon: string
  inactiveBorderHover: string
}

// Định nghĩa 04 ROV chủ lực của xưởng
export interface ROVFleetDef {
  id: string
  name: string
  shortName: string
  code: string
  theme: ROVColorTheme
  matcher: (r: string) => boolean
}

export const FLEET_DEFS: ROVFleetDef[] = [
  {
    id: "quasar-30",
    name: "ROV Quasar MKII-30",
    shortName: "Quasar II - 30",
    code: "MKII-30",
    theme: {
      name: "cyan",
      colorName: "Xanh lơ (Cyan)",
      hex: "#06b6d4",
      activeBorder: "border-cyan-400/90 hover:border-cyan-300",
      activeShadow: "shadow-[0_0_16px_rgba(6,182,212,0.28)] hover:shadow-[0_0_24px_rgba(6,182,212,0.45)]",
      activeGradient: "from-cyan-950/80 via-slate-900/95 to-slate-900",
      pingDot: "bg-cyan-400",
      solidDot: "bg-cyan-500 shadow-sm shadow-cyan-400",
      textAccent: "text-cyan-400",
      borderAccent: "border-cyan-500/40",
      bgAccent: "bg-cyan-500/15",
      badgeActive: "bg-cyan-950/80 border-cyan-500/50 text-cyan-300 group-hover:bg-cyan-900/80",
      badgeIcon: "text-cyan-400",
      inactiveBorderHover: "hover:border-cyan-500/60",
    },
    matcher: (r: string) => /quasar.*(?:mkii|ii)?[- ]*30/i.test(r),
  },
  {
    id: "compact-07",
    name: "ROV Quasar Compact 07",
    shortName: "Compact 07",
    code: "07",
    theme: {
      name: "emerald",
      colorName: "Xanh lục (Emerald)",
      hex: "#10b981",
      activeBorder: "border-emerald-400/90 hover:border-emerald-300",
      activeShadow: "shadow-[0_0_16px_rgba(16,185,129,0.28)] hover:shadow-[0_0_24px_rgba(16,185,129,0.45)]",
      activeGradient: "from-emerald-950/80 via-slate-900/95 to-slate-900",
      pingDot: "bg-emerald-400",
      solidDot: "bg-emerald-500 shadow-sm shadow-emerald-400",
      textAccent: "text-emerald-400",
      borderAccent: "border-emerald-500/40",
      bgAccent: "bg-emerald-500/15",
      badgeActive: "bg-emerald-950/80 border-emerald-500/50 text-emerald-300 group-hover:bg-emerald-900/80",
      badgeIcon: "text-emerald-400",
      inactiveBorderHover: "hover:border-emerald-500/60",
    },
    matcher: (r: string) => /compact.*07|quasar.*07/i.test(r),
  },
  {
    id: "panther-954",
    name: "ROV Panther Plus 954",
    shortName: "Panther Plus 954",
    code: "954",
    theme: {
      name: "amber",
      colorName: "Vàng cam (Amber)",
      hex: "#f59e0b",
      activeBorder: "border-amber-400/90 hover:border-amber-300",
      activeShadow: "shadow-[0_0_16px_rgba(245,158,11,0.28)] hover:shadow-[0_0_24px_rgba(245,158,11,0.45)]",
      activeGradient: "from-amber-950/80 via-slate-900/95 to-slate-900",
      pingDot: "bg-amber-400",
      solidDot: "bg-amber-500 shadow-sm shadow-amber-400",
      textAccent: "text-amber-400",
      borderAccent: "border-amber-500/40",
      bgAccent: "bg-amber-500/15",
      badgeActive: "bg-amber-950/80 border-amber-500/50 text-amber-300 group-hover:bg-amber-900/80",
      badgeIcon: "text-amber-400",
      inactiveBorderHover: "hover:border-amber-500/60",
    },
    matcher: (r: string) => /954/.test(r),
  },
  {
    id: "panther-911",
    name: "ROV Panther Plus 911",
    shortName: "Panther Plus 911",
    code: "911",
    theme: {
      name: "purple",
      colorName: "Tím (Purple)",
      hex: "#a855f7",
      activeBorder: "border-purple-400/90 hover:border-purple-300",
      activeShadow: "shadow-[0_0_16px_rgba(168,85,247,0.28)] hover:shadow-[0_0_24px_rgba(168,85,247,0.45)]",
      activeGradient: "from-purple-950/80 via-slate-900/95 to-slate-900",
      pingDot: "bg-purple-400",
      solidDot: "bg-purple-500 shadow-sm shadow-purple-400",
      textAccent: "text-purple-400",
      borderAccent: "border-purple-500/40",
      bgAccent: "bg-purple-500/15",
      badgeActive: "bg-purple-950/80 border-purple-500/50 text-purple-300 group-hover:bg-purple-900/80",
      badgeIcon: "text-purple-400",
      inactiveBorderHover: "hover:border-purple-500/60",
    },
    matcher: (r: string) => /911/.test(r),
  },
]

// Cấu trúc phân công nhân sự theo thiết bị ROV
export interface ROVPersonnelAssignment {
  id: string
  rovId: string // e.g. "quasar-30", "compact-07", "panther-954", "panther-911"
  rovName: string // Tên rút gọn hoặc đầy đủ của ROV
  personnelId: number // ID nhân sự trong sơ đồ
  personnelName: string // Họ và tên nhân sự
  role: string // 1 trong 11 chức danh ROV Offshore
  startDate: string // YYYY-MM-DD
  endDate?: string | null // YYYY-MM-DD hoặc null nếu đang tiếp diễn
  note?: string
  createdAt: string
}

// Kiểm tra xem phân công này có đang hiệu lực trong ngày `checkDate` (YYYY-MM-DD) hay không
export function isAssignmentActiveOnDate(
  assignment: ROVPersonnelAssignment,
  checkDate: string
): boolean {
  if (!assignment.startDate) return false
  const start = assignment.startDate.slice(0, 10)
  if (assignment.endDate) {
    const end = assignment.endDate.slice(0, 10)
    return checkDate >= start && checkDate <= end
  }
  return checkDate >= start
}

// Cấu trúc dữ liệu đầy đủ cho nhân sự đang làm việc trên ROV
export interface ActivePersonnelAssignmentInfo {
  assignment: ROVPersonnelAssignment
  rovDef?: ROVFleetDef
  currentProject?: any | null // TrackRecordDB
  projectName?: string
}

// Bảng màu tương ứng cho Badge & Viền phát sáng trên thẻ nhân sự
export const ROV_PERSONNEL_BADGE_THEMES: Record<string, {
  badgeBg: string
  cardRing: string
  cardBorder: string
  textAccent: string
  dotBg: string
}> = {
  "quasar-30": {
    badgeBg: "bg-cyan-700 border border-cyan-400 text-white shadow-sm shadow-cyan-950/40",
    cardRing: "ring-2 ring-cyan-400 shadow-cyan-200",
    cardBorder: "border-cyan-500",
    textAccent: "text-cyan-400",
    dotBg: "bg-cyan-300",
  },
  "compact-07": {
    badgeBg: "bg-emerald-700 border border-emerald-400 text-white shadow-sm shadow-emerald-950/40",
    cardRing: "ring-2 ring-emerald-400 shadow-emerald-200",
    cardBorder: "border-emerald-500",
    textAccent: "text-emerald-400",
    dotBg: "bg-emerald-300",
  },
  "panther-954": {
    badgeBg: "bg-amber-700 border border-amber-400 text-white shadow-sm shadow-amber-950/40",
    cardRing: "ring-2 ring-amber-400 shadow-amber-200",
    cardBorder: "border-amber-500",
    textAccent: "text-amber-400",
    dotBg: "bg-amber-300",
  },
  "panther-911": {
    badgeBg: "bg-purple-700 border border-purple-400 text-white shadow-sm shadow-purple-950/40",
    cardRing: "ring-2 ring-purple-400 shadow-purple-200",
    cardBorder: "border-purple-500",
    textAccent: "text-purple-400",
    dotBg: "bg-purple-300",
  },
}
