export interface ROVStatusItem {
  rovId: string // "panther-954", "quasar-30", "compact-07", "panther-911"
  statusCategory: "standby_vessel" | "operating" | "standby_weather" | "standby_client" | "maintenance" | "mob_demob" | "workshop" | "custom"
  statusLabel: string
  detailText: string
  updatedAt?: string
}

export type ROVStatusMap = Record<string, ROVStatusItem>

export interface StatusPreset {
  category: ROVStatusItem["statusCategory"]
  label: string
  templateText: string
  badgeColor: string
  dotColor: string
}

export const ROV_STATUS_PRESETS: StatusPreset[] = [
  {
    category: "standby_vessel",
    label: "Standby do tàu khách hàng lên đốc",
    templateText: "ROV {code} standby do tàu của khách hàng lên đốc",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    dotColor: "bg-amber-400",
  },
  {
    category: "operating",
    label: "Đang thi công lặn khảo sát bình thường",
    templateText: "ROV {code} đang thi công vận hành dự án ngoài khơi",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    dotColor: "bg-emerald-400",
  },
  {
    category: "standby_weather",
    label: "Standby do thời tiết xấu / biển động",
    templateText: "ROV {code} standby trên tàu do biển động / thời tiết xấu",
    badgeColor: "bg-orange-500/20 text-orange-300 border-orange-500/40",
    dotColor: "bg-orange-400",
  },
  {
    category: "standby_client",
    label: "Standby chờ lệnh điều động từ khách hàng",
    templateText: "ROV {code} standby trên giàn/tàu chờ kế hoạch từ khách hàng",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    dotColor: "bg-yellow-400",
  },
  {
    category: "maintenance",
    label: "Bảo dưỡng kỹ thuật / Kiểm định định kỳ",
    templateText: "ROV {code} đang thực hiện bảo dưỡng kỹ thuật và kiểm định thiết bị",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    dotColor: "bg-cyan-400",
  },
  {
    category: "mob_demob",
    label: "Đang huy động / Rút thiết bị (Mob/Demob)",
    templateText: "ROV {code} đang trong quá trình huy động / vận chuyển thiết bị",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    dotColor: "bg-purple-400",
  },
  {
    category: "workshop",
    label: "Sẵn sàng hoạt động tại Xưởng PTSC G&S",
    templateText: "ROV {code} sẵn sàng hoạt động tại ROV Workshop PTSC G&S",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    dotColor: "bg-blue-400",
  },
  {
    category: "custom",
    label: "Khác (Nhập trạng thái tùy chỉnh)",
    templateText: "",
    badgeColor: "bg-slate-700/60 text-slate-200 border-slate-600",
    dotColor: "bg-slate-300",
  },
]

export const DEFAULT_ROV_STATUSES: ROVStatusMap = {
  "panther-954": {
    rovId: "panther-954",
    statusCategory: "standby_vessel",
    statusLabel: "Standby do tàu khách hàng lên đốc",
    detailText: "ROV 954 standby do tàu của khách hàng lên đốc",
    updatedAt: "2026-10-14T00:00:00.000Z",
  },
  "compact-07": {
    rovId: "compact-07",
    statusCategory: "operating",
    statusLabel: "Đang thi công dự án",
    detailText: "ROV 07 đang vận hành khảo sát dự án khách hàng JVPC",
    updatedAt: "2026-10-14T00:00:00.000Z",
  },
  "quasar-30": {
    rovId: "quasar-30",
    statusCategory: "operating",
    statusLabel: "Đang thi công dự án",
    detailText: "ROV MKII-30 đang thực hiện công việc lặn khảo sát ngoài khơi",
    updatedAt: "2026-10-14T00:00:00.000Z",
  },
  "panther-911": {
    rovId: "panther-911",
    statusCategory: "operating",
    statusLabel: "Đang thi công dự án",
    detailText: "ROV 911 đang làm việc dự án INDEPTH trên tàu Shujaa 2000",
    updatedAt: "2026-10-14T00:00:00.000Z",
  },
}
