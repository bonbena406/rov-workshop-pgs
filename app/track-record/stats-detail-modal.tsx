"use client"

import React, { useState, useMemo } from "react"
import {
  X, Layers, DollarSign, Calendar, Users, MapPin, Ship,
  Search, ArrowUpRight, TrendingUp, Clock, CheckCircle2,
  ChevronRight, BarChart3, PieChart, Sparkles, Filter, Lock,
} from "lucide-react"
import type { TrackRecordDB } from "@/lib/supabase"
import type { ThemeMode } from "./analytics-charts-panel"
import { getRecordDurationStatus, getEffectiveDays } from "@/lib/track-record-calc"
import { type RecordInterruptionsMap, getInterruptionsForRecord } from "@/lib/project-interruptions-shared"
import { verifyRevenuePassword, setSavedRevenueUnlocked } from "@/lib/revenue-security"

export type StatsModalType = "projects" | "revenue" | "duration" | "clients" | "locations" | "vessels" | null

interface StatsDetailModalProps {
  type: StatsModalType
  onClose: () => void
  records: TrackRecordDB[]
  theme?: ThemeMode
  interruptionsMap?: RecordInterruptionsMap
  isRevenueUnlocked?: boolean
  onUnlockRevenue?: () => void
  onRequireRevenueUnlock?: () => void
}

const fmtUSD = (v?: number | null) => {
  if (v == null) return "$0"
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
}

const fmtDate = (d?: string | null) => {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
  } catch { return d }
}

export default function StatsDetailModal({
  type,
  onClose,
  records,
  theme = "dark",
  interruptionsMap,
  isRevenueUnlocked = false,
  onUnlockRevenue,
  onRequireRevenueUnlock,
}: StatsDetailModalProps) {
  const [search, setSearch] = useState("")
  const isLight = theme === "light"
  const isNeutral = theme === "neutral"

  // Trạng thái mở khóa doanh thu nội bộ của modal
  const [modalRevenuePassword, setModalRevenuePassword] = useState("")
  const [modalPasswordError, setModalPasswordError] = useState("")
  const [localUnlocked, setLocalUnlocked] = useState(false)
  const effectiveRevenueUnlocked = isRevenueUnlocked || localUnlocked

  const handleUnlockRevenue = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (verifyRevenuePassword(modalRevenuePassword)) {
      setLocalUnlocked(true)
      setSavedRevenueUnlocked(true)
      setModalPasswordError("")
      setModalRevenuePassword("")
      if (onUnlockRevenue) onUnlockRevenue()
    } else {
      setModalPasswordError("Mật khẩu không đúng! Vui lòng nhập mật khẩu Admin hoặc mật khẩu phân quyền.")
    }
  }

  // Tổng quan số liệu
  const totalCost = useMemo(() => records.reduce((s, r) => s + (r.total_project_cost_usd ?? 0), 0), [records])
  const totalDays = useMemo(() => records.reduce((s, r) => s + getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r)), 0), [records, interruptionsMap])
  const validDurationCount = useMemo(() => records.filter(r => getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r)) > 0).length, [records, interruptionsMap])
  const avgDays = useMemo(() => validDurationCount ? Math.round(totalDays / validDurationCount) : 0, [totalDays, validDurationCount])

  // Dữ liệu theo năm
  const yearlyStats = useMemo(() => {
    const map = new Map<number, { count: number; cost: number; days: number }>()
    records.forEach(r => {
      if (!r.start_date) return
      const y = new Date(r.start_date).getFullYear()
      if (isNaN(y)) return
      const cur = map.get(y) || { count: 0, cost: 0, days: 0 }
      cur.count += 1
      cur.cost += (r.total_project_cost_usd ?? 0)
      cur.days += getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r))
      map.set(y, cur)
    })
    return Array.from(map.entries())
      .map(([year, val]) => ({ year, ...val }))
      .sort((a, b) => b.year - a.year)
  }, [records])

  // Dữ liệu khách hàng
  const clientStats = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; days: number; latestYear: number }>()
    records.forEach(r => {
      const c = r.client?.trim()
      if (!c) return
      const cur = map.get(c) || { count: 0, cost: 0, days: 0, latestYear: 0 }
      cur.count += 1
      cur.cost += (r.total_project_cost_usd ?? 0)
      cur.days += getEffectiveDays(r)
      if (r.start_date) {
        const y = new Date(r.start_date).getFullYear()
        if (y > cur.latestYear) cur.latestYear = y
      }
      map.set(c, cur)
    })
    return Array.from(map.entries())
      .map(([client, val]) => ({ client, ...val }))
      .sort((a, b) => b.cost - a.cost)
  }, [records])

  // Dữ liệu ROV System & Thời gian
  const rovDurationStats = useMemo(() => {
    const map = new Map<string, { count: number; days: number; cost: number }>()
    records.forEach(r => {
      const rov = r.rov_system?.trim() || "Chưa xác định"
      const cur = map.get(rov) || { count: 0, days: 0, cost: 0 }
      cur.count += 1
      cur.days += getEffectiveDays(r)
      cur.cost += (r.total_project_cost_usd ?? 0)
      map.set(rov, cur)
    })
    return Array.from(map.entries())
      .map(([rov, val]) => ({
        rov,
        ...val,
        avgDays: val.count > 0 ? Math.round(val.days / val.count) : 0,
      }))
      .sort((a, b) => b.days - a.days)
  }, [records])

  // Dữ liệu Địa điểm
  const locationStats = useMemo(() => {
    const map = new Map<string, { count: number; cost: number }>()
    records.forEach(r => {
      const loc = r.location?.trim()
      if (!loc) return
      const cur = map.get(loc) || { count: 0, cost: 0 }
      cur.count += 1
      cur.cost += (r.total_project_cost_usd ?? 0)
      map.set(loc, cur)
    })
    return Array.from(map.entries())
      .map(([location, val]) => ({ location, ...val }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  // Dữ liệu Tàu / Giàn
  const vesselStats = useMemo(() => {
    const map = new Map<string, { count: number; cost: number }>()
    records.forEach(r => {
      const v = r.vessel_rig?.trim()
      if (!v) return
      const cur = map.get(v) || { count: 0, cost: 0 }
      cur.count += 1
      cur.cost += (r.total_project_cost_usd ?? 0)
      map.set(v, cur)
    })
    return Array.from(map.entries())
      .map(([vessel, val]) => ({ vessel, ...val }))
      .sort((a, b) => b.count - a.count)
  }, [records])

  // Top dự án thời gian dài nhất
  const topLongestProjects = useMemo(() => {
    return [...records]
      .filter(r => getEffectiveDays(r, undefined, getInterruptionsForRecord(interruptionsMap, r)) > 0)
      .sort((a, b) => getEffectiveDays(b, undefined, getInterruptionsForRecord(interruptionsMap, b)) - getEffectiveDays(a, undefined, getInterruptionsForRecord(interruptionsMap, a)))
      .slice(0, 10)
  }, [records, interruptionsMap])

  // Top dự án giá trị cao nhất
  const topValuedProjects = useMemo(() => {
    return [...records]
      .filter(r => r.total_project_cost_usd != null && r.total_project_cost_usd > 0)
      .sort((a, b) => (b.total_project_cost_usd ?? 0) - (a.total_project_cost_usd ?? 0))
      .slice(0, 10)
  }, [records])

  if (!type) return null

  // Config tiêu đề & màu theo loại thẻ
  const config = {
    projects: {
      title: "Chi tiết Thống kê Tổng Dự án",
      subtitle: `${records.length} dự án hoàn thành & đang triển khai qua các năm`,
      icon: Layers,
      color: "from-blue-600 to-cyan-500",
      accent: "text-cyan-400",
    },
    revenue: {
      title: "Chi tiết Thống kê Doanh thu",
      subtitle: effectiveRevenueUnlocked
        ? `Tổng giá trị: ${fmtUSD(totalCost)} qua toàn bộ các hợp đồng`
        : "Nội dung doanh thu được bảo mật (Cần mật khẩu)",
      icon: DollarSign,
      color: "from-emerald-600 to-teal-400",
      accent: "text-emerald-400",
    },
    duration: {
      title: "Chi tiết Thống kê Thời gian & Số ngày Vận hành",
      subtitle: `Tổng cộng ${totalDays.toLocaleString("en-US")} ngày vận hành thực tế (Trung bình ${avgDays} ngày/dự án)`,
      icon: Calendar,
      color: "from-amber-600 to-yellow-400",
      accent: "text-amber-400",
    },
    clients: {
      title: "Chi tiết Khách hàng & Đối tác",
      subtitle: `${clientStats.length} khách hàng trong nước và quốc tế`,
      icon: Users,
      color: "from-violet-600 to-purple-400",
      accent: "text-violet-400",
    },
    locations: {
      title: "Chi tiết Địa điểm & Mỏ Dầu khí",
      subtitle: `${locationStats.length} vị trí, mỏ dầu khí và khu vực triển khai`,
      icon: MapPin,
      color: "from-rose-600 to-pink-400",
      accent: "text-rose-400",
    },
    vessels: {
      title: "Chi tiết Tàu & Giàn Khoan",
      subtitle: `${vesselStats.length} tàu dịch vụ, tàu khảo sát và giàn khoan ngoài khơi`,
      icon: Ship,
      color: "from-indigo-600 to-blue-400",
      accent: "text-indigo-400",
    },
  }[type]

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      {/* Modal Dialog */}
      <div className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 ${
        isLight
          ? "bg-white border-slate-300 text-slate-800 shadow-2xl"
          : isNeutral
          ? "bg-[#1e222a] border-neutral-700 text-neutral-100 shadow-2xl"
          : "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-slate-700 text-white shadow-2xl"
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 bg-gradient-to-r ${config.color} bg-opacity-20 border-b border-slate-800 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
              <config.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">{config.title}</h2>
              <p className="text-xs text-white/70">{config.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">

          {/* ═══════════════════════════════════════════════════════════════
              1) TAB: DỰ ÁN (PROJECTS)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "projects" && (
            <div className="space-y-6">
              {/* Thẻ tóm tắt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Tổng số dự án</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">{records.length}</p>
                  <p className="text-[10px] text-slate-500">2005 - 2026</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Năm nhiều dự án nhất</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {yearlyStats.slice().sort((a, b) => b.count - a.count)[0]?.year}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {yearlyStats.slice().sort((a, b) => b.count - a.count)[0]?.count} dự án
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Trung bình mỗi năm</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {yearlyStats.length ? Math.round(records.length / yearlyStats.length) : 0}
                  </p>
                  <p className="text-[10px] text-slate-500">dự án / năm</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Tổng doanh thu</p>
                  <p className="text-xl font-bold text-purple-400 mt-1 font-mono">
                    {effectiveRevenueUnlocked ? fmtUSD(totalCost) : "••••••••"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {effectiveRevenueUnlocked ? "Toàn bộ chiến dịch" : "🔒 Cần phân quyền"}
                  </p>
                </div>
              </div>

              {/* Bảng phân bổ theo năm */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" /> Số lượng dự án qua các năm
                </h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Năm</th>
                          <th className="py-2.5 px-3 text-center">Số dự án</th>
                          <th className="py-2.5 px-3 text-left">Tỷ trọng</th>
                          <th className="py-2.5 px-3 text-right">
                            Doanh thu năm {!effectiveRevenueUnlocked && "🔒"}
                          </th>
                          <th className="py-2.5 px-3 text-right">Tổng ngày vận hành</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {yearlyStats.map(y => {
                          const pct = Math.round((y.count / records.length) * 100)
                          return (
                            <tr key={y.year} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 font-semibold text-white">{y.year}</td>
                              <td className="py-2 px-3 text-center font-bold text-cyan-300">{y.count}</td>
                              <td className="py-2 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-[10px] text-slate-400 w-8">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                {effectiveRevenueUnlocked ? fmtUSD(y.cost) : "••••••••"}
                              </td>
                              <td className="py-2 px-3 text-right text-amber-300">{y.days.toLocaleString("en-US")} ngày</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              2) TAB: DOANH THU (REVENUE)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "revenue" && !effectiveRevenueUnlocked && (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4 shadow-lg shadow-amber-950/20">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mb-2">
                Nội dung Doanh thu được Bảo mật
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-6">
                Toàn bộ số liệu doanh thu hợp đồng, biểu đồ phân tích và bảng xếp hạng giá trị được phân quyền truy cập. Vui lòng nhập mật khẩu Quản trị hoặc mật khẩu được phân quyền để xem chi tiết.
              </p>

              <form onSubmit={handleUnlockRevenue} className="w-full space-y-3">
                <input
                  type="password"
                  value={modalRevenuePassword}
                  onChange={(e) => {
                    setModalRevenuePassword(e.target.value)
                    setModalPasswordError("")
                  }}
                  placeholder="Nhập mật khẩu (Admin / Phân quyền)..."
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition"
                />

                {modalPasswordError && (
                  <p className="text-xs text-rose-400 font-bold">{modalPasswordError}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Mở khóa Toàn bộ Doanh thu
                </button>
              </form>
            </div>
          )}

          {type === "revenue" && effectiveRevenueUnlocked && (
            <div className="space-y-6">
              {/* Thẻ tóm tắt */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Tổng Doanh Thu</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">{fmtUSD(totalCost)}</p>
                  <p className="text-[10px] text-slate-500">Toàn bộ 319 dự án</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">TB mỗi dự án</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">
                    {fmtUSD(records.length ? Math.round(totalCost / records.length) : 0)}
                  </p>
                  <p className="text-[10px] text-slate-500">USD / dự án</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Năm doanh thu đỉnh</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">
                    {yearlyStats.slice().sort((a, b) => b.cost - a.cost)[0]?.year}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    {fmtUSD(yearlyStats.slice().sort((a, b) => b.cost - a.cost)[0]?.cost)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">TB mỗi ngày vận hành</p>
                  <p className="text-xl font-bold text-purple-400 mt-1">
                    {fmtUSD(totalDays > 0 ? Math.round(totalCost / totalDays) : 0)}
                  </p>
                  <p className="text-[10px] text-slate-500">USD / ngày</p>
                </div>
              </div>

              {/* Top 10 khách hàng doanh thu cao nhất */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> Top 10 Khách hàng đóng góp doanh thu lớn nhất
                </h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-10">Top</th>
                        <th className="py-2.5 px-3 text-left">Khách hàng</th>
                        <th className="py-2.5 px-3 text-center">Số DA</th>
                        <th className="py-2.5 px-3 text-right">Tổng Doanh Thu</th>
                        <th className="py-2.5 px-3 text-right">Tỷ trọng (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {clientStats.slice(0, 10).map((c, i) => {
                        const pct = totalCost > 0 ? ((c.cost / totalCost) * 100).toFixed(1) : "0"
                        return (
                          <tr key={c.client} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-400 font-bold">#{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-white">{c.client}</td>
                            <td className="py-2 px-3 text-center text-cyan-300 font-medium">{c.count}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{fmtUSD(c.cost)}</td>
                            <td className="py-2 px-3 text-right text-slate-400">{pct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 5 dự án giá trị lớn nhất */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Top 5 Hợp đồng có giá trị cao nhất
                </h3>
                <div className="space-y-2">
                  {topValuedProjects.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400">#{i + 1}</span>
                          <span className="font-bold text-white">{p.client}</span>
                          {p.contract && <span className="text-slate-400 text-[11px]">· {p.contract}</span>}
                        </div>
                        <p className="text-slate-300 truncate mt-0.5">{p.project_task || "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-bold text-emerald-400 text-sm">{fmtUSD(p.total_project_cost_usd)}</p>
                        <p className="text-[10px] text-slate-400">{fmtDate(p.start_date)} ({p.duration_days ? `${p.duration_days} ngày` : ""})</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              3) TAB: THỜI GIAN & SỐ NGÀY (DURATION)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "duration" && (
            <div className="space-y-6">
              {/* Thẻ tóm tắt số ngày đã sửa chuẩn xác */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Tổng số ngày vận hành</p>
                  <p className="text-xl font-bold text-amber-400 mt-1">{totalDays.toLocaleString("en-US")} ngày</p>
                  <p className="text-[10px] text-slate-500">Toàn bộ chiến dịch</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Thời gian TB / Dự án</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">{avgDays} ngày</p>
                  <p className="text-[10px] text-slate-500">Tính trên các DA có ngày</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Chiến dịch dài nhất</p>
                  <p className="text-xl font-bold text-emerald-400 mt-1">
                    {topLongestProjects[0]?.duration_days ?? 0} ngày
                  </p>
                  <p className="text-[10px] text-slate-500">{topLongestProjects[0]?.client}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase">Số năm hoạt động</p>
                  <p className="text-xl font-bold text-purple-400 mt-1">{yearlyStats.length} năm</p>
                  <p className="text-[10px] text-slate-500">2005 - 2026</p>
                </div>
              </div>

              {/* Số ngày theo từng hệ thống ROV */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" /> Tổng số ngày hoạt động theo Hệ thống ROV
                </h3>
                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Hệ thống ROV</th>
                        <th className="py-2.5 px-3 text-center">Số dự án</th>
                        <th className="py-2.5 px-3 text-right">Tổng ngày vận hành</th>
                        <th className="py-2.5 px-3 text-right">TB ngày / DA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {rovDurationStats.slice(0, 10).map((r) => (
                        <tr key={r.rov} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-semibold text-white">{r.rov}</td>
                          <td className="py-2 px-3 text-center text-cyan-300 font-medium">{r.count}</td>
                          <td className="py-2 px-3 text-right font-bold text-amber-400">{r.days.toLocaleString("en-US")} ngày</td>
                          <td className="py-2 px-3 text-right text-slate-400">{r.avgDays} ngày</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top 5 dự án dài ngày nhất */}
              <div>
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Top 5 Chiến dịch có thời gian kéo dài nhất
                </h3>
                <div className="space-y-2">
                  {topLongestProjects.slice(0, 5).map((p, i) => {
                    const pDur = getRecordDurationStatus(p)
                    return (
                      <div key={p.id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400">#{i + 1}</span>
                            <span className="font-bold text-white">{p.client}</span>
                            <span className="text-cyan-300 font-medium">({p.rov_system})</span>
                          </div>
                          <p className="text-slate-300 truncate mt-0.5">{p.project_task || "—"}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-amber-400 text-sm">
                            {pDur.effectiveDays} ngày {pDur.isOngoing ? "(tới nay)" : pDur.isFutureEnd ? "(Dự kiến)" : ""}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {fmtDate(p.start_date)} → {pDur.isOngoing ? "Chưa kết thúc" : fmtDate(p.end_date)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              4) TAB: KHÁCH HÀNG (CLIENTS)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "clients" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm trong 80 khách hàng..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-10">STT</th>
                        <th className="py-2.5 px-3 text-left">Tên Khách hàng</th>
                        <th className="py-2.5 px-3 text-center">Số Dự án</th>
                        <th className="py-2.5 px-3 text-right">
                          Tổng Doanh thu {!effectiveRevenueUnlocked && "🔒"}
                        </th>
                        <th className="py-2.5 px-3 text-right">Tổng Ngày</th>
                        <th className="py-2.5 px-3 text-center">Năm gần nhất</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {clientStats
                        .filter(c => !search || c.client.toLowerCase().includes(search.toLowerCase()))
                        .map((c, i) => (
                          <tr key={c.client} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-white">{c.client}</td>
                            <td className="py-2 px-3 text-center font-bold text-cyan-300">{c.count}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">
                              {effectiveRevenueUnlocked ? fmtUSD(c.cost) : "••••••••"}
                            </td>
                            <td className="py-2 px-3 text-right text-amber-300">{c.days.toLocaleString("en-US")} ngày</td>
                            <td className="py-2 px-3 text-center text-slate-400">{c.latestYear || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              5) TAB: ĐỊA ĐIỂM (LOCATIONS)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "locations" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm trong 121 địa điểm / mỏ..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-10">STT</th>
                        <th className="py-2.5 px-3 text-left">Vị trí / Địa điểm mỏ</th>
                        <th className="py-2.5 px-3 text-center">Số Dự án</th>
                        <th className="py-2.5 px-3 text-right">
                          Tổng Doanh thu {!effectiveRevenueUnlocked && "🔒"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {locationStats
                        .filter(l => !search || l.location.toLowerCase().includes(search.toLowerCase()))
                        .map((l, i) => (
                          <tr key={l.location} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-white">{l.location}</td>
                            <td className="py-2 px-3 text-center font-bold text-rose-400">{l.count}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">
                              {effectiveRevenueUnlocked ? fmtUSD(l.cost) : "••••••••"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              6) TAB: TÀU / GIÀN (VESSELS)
          ═══════════════════════════════════════════════════════════════ */}
          {type === "vessels" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm trong 109 tàu / giàn khoan..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/60">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800/80 text-slate-400 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 text-left w-10">STT</th>
                        <th className="py-2.5 px-3 text-left">Tên Tàu / Giàn khoan</th>
                        <th className="py-2.5 px-3 text-center">Số Dự án</th>
                        <th className="py-2.5 px-3 text-right">
                          Tổng Doanh thu {!effectiveRevenueUnlocked && "🔒"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {vesselStats
                        .filter(v => !search || v.vessel.toLowerCase().includes(search.toLowerCase()))
                        .map((v, i) => (
                          <tr key={v.vessel} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                            <td className="py-2 px-3 font-semibold text-white">{v.vessel}</td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-400">{v.count}</td>
                            <td className="py-2 px-3 text-right font-mono text-emerald-400">
                              {effectiveRevenueUnlocked ? fmtUSD(v.cost) : "••••••••"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t flex items-center justify-between text-xs flex-shrink-0 ${
          isLight
            ? "bg-slate-50 border-slate-200 text-slate-600"
            : isNeutral
            ? "bg-[#181a20] border-neutral-700 text-neutral-400"
            : "bg-slate-900/90 border-slate-800 text-slate-400"
        }`}>
          <span>Dữ liệu thống kê ROV Workshop PTSC G&S</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
