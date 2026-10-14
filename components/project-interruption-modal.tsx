"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertCircle,
  Save,
  X,
  Sparkles,
  Info,
  CheckCircle2,
  CalendarDays,
  FileText,
  Tag,
  Ship,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TrackRecordDB } from "@/lib/supabase"
import type { ProjectInterruption } from "@/lib/project-interruptions-shared"
import { getRecordDurationStatus } from "@/lib/track-record-calc"

interface ProjectInterruptionModalProps {
  isOpen: boolean
  onClose: () => void
  record: TrackRecordDB | null
  initialInterruptions?: ProjectInterruption[]
  onSave: (recordKey: string, updated: ProjectInterruption[]) => Promise<void>
  theme?: "dark" | "light" | "neutral"
}

const PRESET_REASONS = [
  "Standby chờ thời tiết biển xấu",
  "Bảo dưỡng định kỳ hệ thống ROV",
  "Tàu quay về cảng tiếp nhiên liệu/chuyển quân",
  "Chờ chủ đầu tư cấp phép/phê duyệt ca",
  "Nghỉ giữa 2 giai đoạn (Phase standby)",
  "Sự cố thiết bị phụ trợ trên tàu",
]

function fmtDateVN(d?: string | null): string {
  if (!d) return "—"
  const parts = d.slice(0, 10).split("-")
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

export function ProjectInterruptionModal({
  isOpen,
  onClose,
  record,
  initialInterruptions = [],
  onSave,
  theme = "dark",
}: ProjectInterruptionModalProps) {
  const [items, setItems] = useState<ProjectInterruption[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [days, setDays] = useState<number | "">("")
  const [reason, setReason] = useState("")
  const [note, setNote] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Đồng bộ dữ liệu khi mở modal
  useEffect(() => {
    if (isOpen && record) {
      setItems([...initialInterruptions])
      setStartDate("")
      setEndDate("")
      setDays("")
      setReason("")
      setNote("")
      setFormError(null)
      setSaveSuccess(false)
    }
  }, [isOpen, record, initialInterruptions])

  // Tự động tính số ngày khi chọn startDate và endDate
  useEffect(() => {
    if (startDate && endDate) {
      const s = new Date(startDate)
      const e = new Date(endDate)
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        if (e >= s) {
          const diffMs = e.getTime() - s.getTime()
          const calcDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
          setDays(calcDays)
          setFormError(null)
        } else {
          setFormError("Ngày kết thúc tạm ngưng phải lớn hơn hoặc bằng ngày bắt đầu!")
        }
      }
    }
  }, [startDate, endDate])

  // Tính toán tóm tắt ngày vận hành thực tế
  const durationStatus = useMemo(() => {
    if (!record) return null
    return getRecordDurationStatus(record, new Date(), items)
  }, [record, items])

  if (!record) return null

  const handleAddItem = () => {
    if (!startDate || !endDate) {
      setFormError("Vui lòng chọn ngày bắt đầu và kết thúc đợt tạm ngưng!")
      return
    }
    const numDays = typeof days === "number" ? days : parseInt(String(days), 10)
    if (!numDays || numDays <= 0) {
      setFormError("Số ngày tạm ngưng phải lớn hơn 0!")
      return
    }

    const newItem: ProjectInterruption = {
      id: `int_${record.no || record.id}_${Date.now()}`,
      recordId: record.id,
      recordNo: record.no ?? undefined,
      startDate,
      endDate,
      days: numDays,
      reason: reason.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    setItems((prev) => [...prev, newItem])
    setStartDate("")
    setEndDate("")
    setDays("")
    setReason("")
    setNote("")
    setFormError(null)
  }

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const key = String(record.no || record.id)
      await onSave(key, items)
      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        onClose()
      }, 700)
    } catch (err: any) {
      setFormError(err?.message || "Lỗi lưu dữ liệu.")
    } finally {
      setIsSaving(false)
    }
  }

  const isLight = theme === "light"
  const isNeutral = theme === "neutral"

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={`max-w-2xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border transition-colors ${
        isLight
          ? "bg-white text-slate-900 border-slate-300"
          : isNeutral
          ? "bg-[#1c1f26] text-neutral-100 border-neutral-700"
          : "bg-slate-900 text-white border-slate-700"
      }`}>
        {/* Header */}
        <div className={`p-5 border-b flex-shrink-0 ${
          isLight
            ? "bg-amber-50/70 border-amber-200"
            : isNeutral
            ? "bg-amber-950/20 border-neutral-800"
            : "bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-slate-800"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  No. {record.no || record.id}
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⏸️ Quản lý thời gian ngắt quãng / tạm nghỉ
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black mt-1 leading-snug">
                {record.client} – {record.project_task || "Dự án ROV"}
              </h2>
              <p className="text-xs opacity-80 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>HĐ: {record.contract || "—"}</span>
                <span>•</span>
                <span>Bắt đầu: {fmtDateVN(record.start_date)}</span>
                <span>•</span>
                <span>
                  {record.end_date ? `Kết thúc: ${fmtDateVN(record.end_date)}` : "Đang thực hiện (Chưa kết thúc)"}
                </span>
                {record.rov_system && (
                  <>
                    <span>•</span>
                    <span className="text-cyan-400 font-semibold">{record.rov_system}</span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Thống kê nhanh số ngày */}
          {durationStatus && (
            <div className={`grid grid-cols-3 gap-2 sm:gap-3 p-3 rounded-xl border text-center ${
              isLight
                ? "bg-slate-50 border-slate-200"
                : isNeutral
                ? "bg-[#232732] border-neutral-700/80"
                : "bg-slate-800/80 border-slate-700/80"
            }`}>
              <div className="p-2">
                <p className="text-[10px] sm:text-xs opacity-70 font-semibold">Tổng ngày theo lịch</p>
                <p className="text-base sm:text-xl font-black mt-0.5 text-blue-400">
                  {durationStatus.rawDays ?? "—"} <span className="text-xs font-normal">ngày</span>
                </p>
                <p className="text-[10px] opacity-60">
                  {durationStatus.isOngoing ? "(tới hôm nay)" : "(toàn bộ)"}
                </p>
              </div>

              <div className="p-2 border-x border-slate-700/50">
                <p className="text-[10px] sm:text-xs text-amber-400 font-semibold">Tạm ngưng / Nghỉ</p>
                <p className="text-base sm:text-xl font-black mt-0.5 text-amber-400">
                  {durationStatus.pauseDays} <span className="text-xs font-normal">ngày</span>
                </p>
                <p className="text-[10px] text-amber-300/80">
                  {items.length} đợt nghỉ
                </p>
              </div>

              <div className="p-2">
                <p className="text-[10px] sm:text-xs text-emerald-400 font-semibold">Vận hành thực tế</p>
                <p className="text-base sm:text-xl font-black mt-0.5 text-emerald-400">
                  {durationStatus.effectiveDays ?? "—"} <span className="text-xs font-normal">ngày</span>
                </p>
                <p className="text-[10px] text-emerald-300/80">
                  (Thực tế hoạt động)
                </p>
              </div>
            </div>
          )}

          {/* Form thêm đợt tạm ngưng mới */}
          <div className={`p-4 rounded-xl border ${
            isLight
              ? "bg-amber-50/50 border-amber-200"
              : isNeutral
              ? "bg-amber-950/20 border-amber-900/40"
              : "bg-amber-950/20 border-amber-500/30"
          }`}>
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-3">
              <Plus className="w-3.5 h-3.5" /> Thêm đợt tạm ngưng / ngắt quãng mới
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-80">
                  Từ ngày (Start date) <span className="text-red-400">*</span>
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-80">
                  Đến ngày (End date) <span className="text-red-400">*</span>
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 text-xs font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-1 opacity-80">
                  Số ngày nghỉ <span className="text-red-400">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  value={days}
                  onChange={(e) => setDays(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  placeholder="Tự động tính"
                  className="h-9 text-xs font-bold text-amber-400"
                />
              </div>
            </div>

            {/* Lý do tạm ngưng */}
            <div className="mt-2.5">
              <label className="text-[11px] font-bold block mb-1 opacity-80">
                Lý do tạm ngưng (Chọn mẫu hoặc gõ vào):
              </label>
              <Input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: Tháng 7 nghỉ chờ thời tiết, bảo dưỡng định kỳ..."
                className="h-9 text-xs"
              />
              {/* Preset buttons */}
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {PRESET_REASONS.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => setReason(pr)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 hover:border-amber-400 bg-slate-800/80 hover:bg-amber-950/40 text-slate-300 hover:text-amber-300 transition"
                  >
                    + {pr}
                  </button>
                ))}
              </div>
            </div>

            {/* Ghi chú thêm */}
            <div className="mt-2.5">
              <label className="text-[11px] font-bold block mb-1 opacity-80">
                Ghi chú thêm:
              </label>
              <Input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú thêm về nhân sự, tàu, hoặc biên bản làm việc..."
                className="h-9 text-xs"
              />
            </div>

            {formError && (
              <p className="text-xs text-red-400 font-bold mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {formError}
              </p>
            )}

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleAddItem}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Thêm đợt này vào danh sách
              </Button>
            </div>
          </div>

          {/* Danh sách các đợt tạm ngưng hiện tại */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider opacity-90 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
                Các đợt tạm ngưng đã cấu hình ({items.length} đợt)
              </h3>
              {items.length > 0 && (
                <span className="text-[11px] font-bold text-amber-400">
                  Tổng trừ: {items.reduce((s, i) => s + (i.days || 0), 0)} ngày
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <div className={`p-6 rounded-xl border text-center ${
                isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-800"
              }`}>
                <Info className="w-6 h-6 mx-auto mb-1 opacity-40 text-amber-400" />
                <p className="text-xs font-semibold opacity-70">
                  Dự án này chưa có đợt tạm ngưng nào.
                </p>
                <p className="text-[11px] opacity-50 mt-0.5">
                  Nếu dự án bị gián đoạn giữa chừng (ví dụ tháng 7 nghỉ 15 ngày, tháng 8 nghỉ 10 ngày), hãy thêm ở biểu mẫu phía trên.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                      isLight
                        ? "bg-white border-slate-300 shadow-2xs hover:border-amber-400"
                        : isNeutral
                        ? "bg-[#252833] border-neutral-700 hover:border-amber-500/50"
                        : "bg-slate-800/90 border-slate-700 hover:border-amber-400/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Đợt {idx + 1}
                        </span>
                        <span className="text-xs font-black text-amber-300">
                          {fmtDateVN(item.startDate)} → {fmtDateVN(item.endDate)}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-500/20 text-red-300 border border-red-500/30">
                          Nghỉ {item.days} ngày
                        </span>
                      </div>

                      {item.reason && (
                        <p className="text-xs font-medium mt-1 text-slate-200">
                          <span className="opacity-70 text-[11px]">Lý do:</span> {item.reason}
                        </p>
                      )}

                      {item.note && (
                        <p className="text-[11px] opacity-70 mt-0.5 italic">
                          Ghi chú: {item.note}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Xóa đợt tạm ngưng này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 flex-shrink-0 ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-900 border-slate-800"
        }`}>
          <div>
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Đã lưu thành công!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs"
            >
              Hủy
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md"
            >
              {isSaving ? (
                <>Đang lưu...</>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1" /> Lưu cấu hình
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
