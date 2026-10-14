"use client"

import React from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Calendar,
  Clock,
  MapPin,
  FileText,
  ExternalLink,
  Briefcase,
  UserCheck,
  Ship,
  Sparkles,
  Layers,
  CheckCircle2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { PersonnelDB } from "@/lib/supabase"
import { getAvatarUrl } from "@/lib/supabase"
import type { ActivePersonnelAssignmentInfo } from "@/lib/rov-assignments-shared"

interface PersonnelROVModalProps {
  isOpen: boolean
  onClose: () => void
  person: PersonnelDB | null
  info: ActivePersonnelAssignmentInfo | null
}

function fmtDate(d?: string | null): string {
  if (!d) return "—"
  const parts = d.slice(0, 10).split("-")
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return d
}

export function PersonnelROVModal({
  isOpen,
  onClose,
  person,
  info,
}: PersonnelROVModalProps) {
  if (!person || !info) return null

  const { assignment, rovDef, currentProject } = info
  const theme = rovDef?.theme

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl p-4 sm:p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-slate-600 flex-shrink-0 bg-slate-800 shadow-md">
              <Image
                src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
                alt={person.ho_va_ten}
                width={48}
                height={48}
                className="object-cover w-full h-full"
                unoptimized={!!person.avatar_url}
              />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                <span>{person.ho_va_ten}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5 truncate">
                {person.chuc_vu || person.cap_bac || "Nhân sự Xưởng ROV"} {person.to_phong ? `• ${person.to_phong}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="space-y-3.5 pt-3 text-xs">
          {/* Thẻ thiết bị ROV đang làm việc */}
          <div
            className={`p-3 rounded-xl border transition-all ${
              theme?.activeBorder || "border-emerald-500/80"
            } bg-slate-950/80 shadow-lg`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    theme?.solidDot || "bg-emerald-400 shadow-emerald-400"
                  } animate-pulse`}
                />
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Thiết bị ROV đang thực hiện
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  theme?.badgeActive || "bg-emerald-950/80 border border-emerald-500 text-emerald-300"
                }`}
              >
                ĐANG LÀM VIỆC
              </span>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <h3 className={`text-sm sm:text-base font-bold ${theme?.textAccent || "text-emerald-400"}`}>
                ⚓ {rovDef?.name || assignment.rovName}
              </h3>
              {rovDef?.code && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                  Mã: {rovDef.code}
                </span>
              )}
            </div>
          </div>

          {/* Chi tiết ca phân công của nhân sự */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold uppercase text-[11px] border-b border-slate-800 pb-1.5">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Ca làm việc của nhân sự</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-slate-300">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-medium">Chức danh ngoài biển:</p>
                <p className="font-bold text-white mt-0.5 text-xs flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <span className="truncate">{assignment.role}</span>
                </p>
              </div>

              <div>
                <p className="text-[10px] text-slate-400 uppercase font-medium">Thời gian phân công ca:</p>
                <p className={`font-semibold mt-0.5 text-xs flex items-center gap-1 ${theme?.textAccent || "text-emerald-400"}`}>
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {fmtDate(assignment.startDate)} → {assignment.endDate ? fmtDate(assignment.endDate) : "Tiếp diễn"}
                  </span>
                </p>
              </div>
            </div>

            {assignment.note && (
              <div className="pt-1.5 border-t border-slate-800/60 text-[11px] text-slate-400 italic">
                <span className="font-semibold text-slate-300 not-italic">Ghi chú:</span> {assignment.note}
              </div>
            )}
          </div>

          {/* Chi tiết Dự án ROV đang triển khai */}
          {currentProject ? (
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase text-[11px]">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Dự án đang thực hiện</span>
                </span>
                {currentProject.contract && (
                  <span className="text-[10px] text-slate-400">
                    HĐ: <b className="text-white">{currentProject.contract}</b>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Khách hàng / Đối tác:</p>
                  <p className="font-bold text-white mt-0.5">{currentProject.client}</p>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Thời gian dự án thiết bị:</p>
                  <p className="font-medium text-slate-200 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>
                      {fmtDate(currentProject.start_date)} → {currentProject.end_date ? fmtDate(currentProject.end_date) : "Tiếp diễn"}
                    </span>
                  </p>
                </div>

                {currentProject.project_task && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Công việc (Project Task):</p>
                    <p className="text-slate-200 mt-0.5 line-clamp-2">{currentProject.project_task}</p>
                  </div>
                )}

                {(currentProject.location || currentProject.vessel_rig) && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-slate-400 uppercase font-medium">Địa điểm / Tàu giàn:</p>
                    <p className="text-slate-200 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span>
                        {currentProject.location || ""} {currentProject.vessel_rig ? `(${currentProject.vessel_rig})` : ""}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Thiết bị và nhân sự được phân công sẵn sàng triển khai công tác ngoài biển.</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <Link
            href={`/profile/${person.id}`}
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Xem hồ sơ chi tiết</span>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
