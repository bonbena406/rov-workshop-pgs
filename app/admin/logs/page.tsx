"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, RefreshCw, Download, Search, Filter, Shield, User, Globe, Laptop, Calendar, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAuditLogs, type AuditLogEntry, type AuditActionType } from "@/lib/audit-logs"

const ACTION_CONFIG: Record<
  AuditActionType,
  { label: string; color: string; badgeVariant: "default" | "secondary" | "destructive" | "outline" }
> = {
  UPDATE_PERSONNEL: { label: "Sửa nhân sự", color: "bg-blue-50 text-blue-700 border-blue-200", badgeVariant: "outline" },
  CREATE_PERSONNEL: { label: "Thêm nhân sự", color: "bg-emerald-50 text-emerald-700 border-emerald-200", badgeVariant: "outline" },
  DELETE_PERSONNEL: { label: "Xóa nhân sự", color: "bg-red-50 text-red-700 border-red-200", badgeVariant: "destructive" },
  UPDATE_ROV_ASSIGNMENT: { label: "Phân công ROV", color: "bg-cyan-50 text-cyan-700 border-cyan-200", badgeVariant: "outline" },
  DELETE_ROV_ASSIGNMENT: { label: "Xóa phân công", color: "bg-amber-50 text-amber-700 border-amber-200", badgeVariant: "outline" },
  UPDATE_ROV_STATUS: { label: "Trạng thái ROV", color: "bg-indigo-50 text-indigo-700 border-indigo-200", badgeVariant: "outline" },
  UPDATE_CHART_LAYOUT: { label: "Sắp xếp sơ đồ", color: "bg-purple-50 text-purple-700 border-purple-200", badgeVariant: "outline" },
  CREATE_TRACK_RECORD: { label: "Thêm dự án", color: "bg-teal-50 text-teal-700 border-teal-200", badgeVariant: "outline" },
  UPDATE_TRACK_RECORD: { label: "Sửa dự án", color: "bg-sky-50 text-sky-700 border-sky-200", badgeVariant: "outline" },
  DELETE_TRACK_RECORD: { label: "Xóa dự án", color: "bg-rose-50 text-rose-700 border-rose-200", badgeVariant: "destructive" },
  LOGIN_ADMIN: { label: "Đăng nhập", color: "bg-slate-100 text-slate-700 border-slate-300", badgeVariant: "secondary" },
  EXPORT_DATA: { label: "Xuất file", color: "bg-green-50 text-green-700 border-green-200", badgeVariant: "outline" },
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedType, setSelectedType] = useState<string>("ALL")
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getAuditLogs(200)
      setLogs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Thống kê nhanh
  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const todayCount = logs.filter((l) => new Date(l.created_at).toDateString() === today).length
    const uniqueIps = new Set(logs.map((l) => l.ip_address).filter(Boolean)).size
    return {
      total: logs.length,
      todayCount,
      uniqueIps,
    }
  }, [logs])

  // Lọc dữ liệu
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchType = selectedType === "ALL" || log.action_type === selectedType
      if (!matchType) return false

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        log.target_name.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.actor_name.toLowerCase().includes(q) ||
        (log.ip_address && log.ip_address.includes(q))
      )
    })
  }, [logs, selectedType, search])

  // Xuất file CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return

    const headers = ["Thời gian", "Người thực hiện", "Địa chỉ IP", "Thiết bị", "Hành động", "Đối tượng", "Chi tiết nội dung"]
    const rows = filteredLogs.map((log) => [
      `"${new Date(log.created_at).toLocaleString("vi-VN")}"`,
      `"${log.actor_name || ""}"`,
      `"${log.ip_address || ""}"`,
      `"${log.device_info || ""}"`,
      `"${ACTION_CONFIG[log.action_type]?.label || log.action_type}"`,
      `"${log.target_name.replace(/"/g, '""')}"`,
      `"${log.summary.replace(/"/g, '""')}"`,
    ])

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Lich_su_sua_doi_ROV_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
              <Link href="/admin" className="hover:text-blue-600 transition-colors flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Quản trị hệ thống
              </Link>
              <span>/</span>
              <span className="text-slate-800 font-medium">Nhật ký thay đổi</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-7 h-7 text-blue-600" />
              Lịch sử sửa đổi & Nhật ký hệ thống
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Theo dõi chi tiết các thao tác thêm, sửa, xóa, phân công ROV, người thực hiện và IP truy cập.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
              Làm mới
            </Button>
            <Button
              size="sm"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Download className="w-4 h-4" />
              Xuất Excel (CSV)
            </Button>
          </div>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-2xs border-slate-200/80 bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng số lượt sửa đổi</p>
                <p className="text-2xl font-bold text-slate-800 mt-0.5">{stats.total}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                📜
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border-slate-200/80 bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hoạt động trong ngày</p>
                <p className="text-2xl font-bold text-emerald-600 mt-0.5">{stats.todayCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                ⚡
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-2xs border-slate-200/80 bg-white">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Số địa chỉ IP tác động</p>
                <p className="text-2xl font-bold text-indigo-600 mt-0.5">{stats.uniqueIps}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                🌐
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc */}
        <Card className="shadow-2xs border-slate-200/80 bg-white">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên nhân sự, nội dung, IP (ví dụ: 113.161..., Mai Thế Hùng)..."
                  className="pl-9 bg-slate-50 border-slate-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">Tất cả hành động ({logs.length})</option>
                  <option value="UPDATE_PERSONNEL">Sửa nhân sự</option>
                  <option value="CREATE_PERSONNEL">Thêm nhân sự mới</option>
                  <option value="DELETE_PERSONNEL">Xóa nhân sự</option>
                  <option value="UPDATE_ROV_ASSIGNMENT">Phân công thiết bị ROV</option>
                  <option value="UPDATE_ROV_STATUS">Trạng thái thiết bị ROV</option>
                  <option value="UPDATE_CHART_LAYOUT">Sắp xếp sơ đồ tổ chức</option>
                  <option value="UPDATE_TRACK_RECORD">Dự án Track Record</option>
                  <option value="LOGIN_ADMIN">Đăng nhập Admin</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bảng danh sách lịch sử */}
        <Card className="shadow-xs border-slate-200 bg-white overflow-hidden">
          <CardHeader className="py-3.5 px-5 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-800">
              Nhật ký chi tiết ({filteredLogs.length} sự kiện)
            </CardTitle>
            <span className="text-xs text-slate-500">Mới nhất hiển thị trước</span>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-sm">Đang tải nhật ký sửa đổi...</span>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <p className="text-base font-medium">Không tìm thấy bản ghi lịch sử nào</p>
                <p className="text-xs text-slate-400 mt-1">Hãy thử đổi từ khóa tìm kiếm hoặc lọc hành động khác.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action_type] || {
                    label: log.action_type,
                    color: "bg-slate-100 text-slate-700 border-slate-200",
                  }
                  const time = new Date(log.created_at)

                  return (
                    <div
                      key={log.id}
                      className="p-4 md:p-4.5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
                    >
                      {/* Cột trái: Hành động, Đối tượng, Nội dung */}
                      <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                          <span className="font-bold text-slate-900 truncate">
                            {log.target_name}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-snug font-normal text-[13px]">
                          {log.summary}
                        </p>
                      </div>

                      {/* Cột giữa & phải: Người sửa, IP, Thiết bị, Thời gian */}
                      <div className="flex flex-wrap md:flex-col lg:flex-row md:items-end lg:items-center gap-2 lg:gap-4 text-xs text-slate-500 flex-shrink-0">
                        {/* Người thực hiện */}
                        <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-1 rounded text-slate-700 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.actor_name || "Quản trị viên"}</span>
                        </div>

                        {/* Địa chỉ IP */}
                        <div className="flex items-center gap-1 font-mono text-[11px] text-blue-700 bg-blue-50/80 px-2 py-1 rounded border border-blue-100/60">
                          <Globe className="w-3.5 h-3.5 text-blue-500" />
                          <span>{log.ip_address || "127.0.0.1"}</span>
                        </div>

                        {/* Thiết bị */}
                        {log.device_info && (
                          <div className="hidden xl:flex items-center gap-1 text-[11px] text-slate-400">
                            <Laptop className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[130px]">{log.device_info}</span>
                          </div>
                        )}

                        {/* Thời gian */}
                        <div className="flex items-center gap-1 text-slate-500 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {time.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                            {time.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Nút xem chi tiết (nếu có payload JSON) */}
                        {log.details && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Chi tiết
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal chi tiết thay đổi (Diff / Payload) */}
        <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <span>Chi tiết thay đổi</span>
                {selectedLog && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {ACTION_CONFIG[selectedLog.action_type]?.label}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedLog && (
              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                  <p><strong className="text-slate-700">Đối tượng:</strong> {selectedLog.target_name}</p>
                  <p><strong className="text-slate-700">Tóm tắt:</strong> {selectedLog.summary}</p>
                  <p><strong className="text-slate-700">Người thực hiện:</strong> {selectedLog.actor_name}</p>
                  <p><strong className="text-slate-700">Địa chỉ IP:</strong> {selectedLog.ip_address}</p>
                  <p><strong className="text-slate-700">Thời gian:</strong> {new Date(selectedLog.created_at).toLocaleString("vi-VN")}</p>
                </div>

                {selectedLog.details && (
                  <div>
                    <p className="font-semibold text-slate-700 mb-1.5">Nội dung thay đổi (Dữ liệu gửi lên):</p>
                    <pre className="bg-slate-900 text-emerald-400 p-3 rounded-lg overflow-x-auto text-[11px] max-h-60 leading-relaxed font-mono">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
