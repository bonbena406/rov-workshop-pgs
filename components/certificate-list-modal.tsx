"use client"

import { useState, useEffect } from "react"
import { X, Award, Maximize2, Minimize2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { type PersonnelDB, getAvatarUrl } from "@/lib/supabase"

interface CertificateListModalProps {
  isOpen: boolean
  onClose: () => void
  allPersonnel: PersonnelDB[]
}

interface CertificateInfo {
  person: PersonnelDB
  certType: string
  expireDate: string
  daysRemaining: number
}

function getDaysRemaining(expireDateStr: string | null | undefined): number {
  if (!expireDateStr) return Number.POSITIVE_INFINITY

  // Parse dd/mm/yyyy
  const parts = expireDateStr.split("/")
  if (parts.length !== 3) return Number.POSITIVE_INFINITY

  const day = Number.parseInt(parts[0], 10)
  const month = Number.parseInt(parts[1], 10) - 1 // 0-based
  const year = Number.parseInt(parts[2], 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) return Number.POSITIVE_INFINITY

  const expireDate = new Date(year, month, day)
  if (isNaN(expireDate.getTime())) return Number.POSITIVE_INFINITY

  // So sánh ngày
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  expireDate.setHours(0, 0, 0, 0)

  const diffMs = expireDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
}

export default function CertificateListModal({ isOpen, onClose, allPersonnel }: CertificateListModalProps) {
  const [certificates, setCertificates] = useState<CertificateInfo[]>([])
  const [filterDays, setFilterDays] = useState<number>(60)
  const [showExpired, setShowExpired] = useState<boolean>(false)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  useEffect(() => {
    if (isOpen) {
      const certs: CertificateInfo[] = []

      const certFields: Array<{ key: keyof PersonnelDB; label: string }> = [
        { key: "passport", label: "Passport" },
        { key: "opito", label: "OPITO" },
        { key: "medical", label: "Medical" },
        { key: "seamanbook", label: "Seamanbook" },
        { key: "MTCS_Maritime_Skills_Assesor", label: "MTCS Maritime Skills Assesor" },
        { key: "MTCS_Superintendent", label: "MTCS Superintendent" },
        { key: "MTCS_Offshore_Project_Manager", label: "MTCS Offshore Project Manager" },
        { key: "MTCS_Supervisor", label: "MTCS Supervisor" },
        { key: "MTCS_Pilot_I", label: "MTCS Pilot I" },
        { key: "MTCS_Pilot_II", label: "MTCS Pilot II" },
        { key: "MTCS_Senior_Pilot", label: "MTCS Senior Pilot" },
        { key: "opito_bosiet", label: "OPITO BOSIET" },
        { key: "TSBB", label: "TSBB" },
        { key: "CA_EBS_Issue_date", label: "CA EBS Issue Date" },
        { key: "PCCC", label: "PCCC" },
        { key: "ATLD", label: "ATLD" },
        { key: "ATHC", label: "ATHC" },
        { key: "HV_Course", label: "HV Course" },
        { key: "CP1_Issue_date", label: "CP1 Issue Date" },
        { key: "basic_rigging", label: "Basic Rigging" },
      ]

      allPersonnel.forEach((person) => {
        certFields.forEach(({ key, label }) => {
          const value = person[key]
          if (value && typeof value === "string" && value.includes("/")) {
            const days = getDaysRemaining(value)
            certs.push({
              person,
              certType: label,
              expireDate: value,
              daysRemaining: days,
            })
          }
        })
      })

      const filteredCerts = certs.filter((cert) => {
        if (showExpired) {
          return cert.daysRemaining < 0
        } else {
          return cert.daysRemaining >= 0 && cert.daysRemaining <= filterDays
        }
      })

      filteredCerts.sort((a, b) => a.daysRemaining - b.daysRemaining)
      setCertificates(filteredCerts)
    }
  }, [isOpen, allPersonnel, filterDays, showExpired])

  if (!isOpen) return null

  const getUrgencyColor = (days: number) => {
    if (days < 0) return "bg-gray-100 border-gray-400 text-gray-800"
    if (days <= 7) return "bg-red-100 border-red-400 text-red-800"
    if (days <= 15) return "bg-orange-100 border-orange-400 text-orange-800"
    if (days <= 30) return "bg-yellow-100 border-yellow-400 text-yellow-800"
    return "bg-green-100 border-green-400 text-green-800"
  }

  const getUrgencyIcon = (days: number) => {
    if (days < 0) return "❌"
    if (days <= 7) return "🚨"
    if (days <= 15) return "⚠️"
    if (days <= 30) return "📅"
    return "✅"
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 p-2">
      <div
        className={`bg-white rounded-tl-lg shadow-xl ${isExpanded ? "w-[95vw]" : "w-[50vw]"} md:w-[420px] max-h-[85vh] overflow-hidden border border-gray-300 transition-all duration-300`}
      >
        <div className="flex items-center justify-between p-2 md:p-4 border-b bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <div className="flex items-center gap-1 md:gap-2">
            <Award className="w-4 h-4 md:w-6 md:h-6" />
            <h2 className="text-sm md:text-xl font-bold">Bảng theo dõi thời hạn chứng chỉ</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/20 rounded md:hidden"
              title={isExpanded ? "Thu nhỏ" : "Mở rộng"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        <div className="p-2 md:p-4 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <div className="flex items-center gap-1 md:gap-2">
              <label className="text-xs md:text-sm font-medium">Hiển thị:</label>
              <select
                value={showExpired ? "expired" : filterDays.toString()}
                onChange={(e) => {
                  if (e.target.value === "expired") {
                    setShowExpired(true)
                  } else {
                    setShowExpired(false)
                    setFilterDays(Number.parseInt(e.target.value))
                  }
                }}
                className="px-2 py-1 border rounded text-xs md:text-sm"
              >
                <option value="7">Còn ≤ 7 ngày</option>
                <option value="15">Còn ≤ 15 ngày</option>
                <option value="30">Còn ≤ 30 ngày</option>
                <option value="60">Còn ≤ 60 ngày</option>
                <option value="90">Còn ≤ 90 ngày</option>
                <option value="365">Còn ≤ 1 năm</option>
                <option value="expired">Đã hết hạn</option>
              </select>
            </div>

            <div className="text-xs md:text-sm text-gray-600">
              Tìm thấy: <span className="font-bold text-blue-600">{certificates.length}</span> chứng chỉ
            </div>
          </div>
        </div>

        <div className="p-2 md:p-4 overflow-y-auto max-h-[calc(85vh-160px)]">
          {certificates.length === 0 ? (
            <div className="text-center py-4 md:py-8">
              <div className="text-4xl md:text-6xl mb-2 md:mb-4">{showExpired ? "📋" : "🎉"}</div>
              <h3 className="text-sm md:text-xl font-semibold text-gray-600 mb-1 md:mb-2">
                {showExpired ? "Không có chứng chỉ nào đã hết hạn" : `Không có chứng chỉ nào còn ≤ ${filterDays} ngày`}
              </h3>
              <p className="text-xs md:text-base text-gray-500">
                {showExpired ? "Tất cả chứng chỉ đều còn trong thời hạn" : "Hãy thử thay đổi bộ lọc để xem thêm"}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 md:gap-3">
              {certificates.map((cert, index) => (
                <div
                  key={`${cert.person.id}-${cert.certType}`}
                  className={`p-2 md:p-4 rounded-lg border-2 ${getUrgencyColor(cert.daysRemaining)}`}
                >
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-full overflow-hidden border-2 border-gray-300">
                        <Image
                          src={getAvatarUrl(cert.person.avatar_url) || "/placeholder.svg"}
                          alt={cert.person.ho_va_ten}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <Link
                          href={`/profile/${cert.person.id}`}
                          className="text-xs md:text-base font-semibold hover:underline truncate"
                          onClick={onClose}
                        >
                          {cert.person.ho_va_ten}
                        </Link>
                        <span className="text-[10px] md:text-sm bg-gray-200 px-1 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap">
                          {cert.person.to_phong}
                        </span>
                        <span className="text-[10px] md:text-sm bg-blue-200 px-1 md:px-2 py-0.5 md:py-1 rounded whitespace-nowrap">
                          {cert.person.chuc_vu}
                        </span>
                      </div>

                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-[10px] md:text-sm">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{cert.certType}:</span>
                          <span>{cert.expireDate}</span>
                        </div>

                        <div className="flex items-center gap-1 font-bold">
                          <span className="text-sm md:text-lg">{getUrgencyIcon(cert.daysRemaining)}</span>
                          {cert.daysRemaining < 0 ? (
                            <span className="text-red-600">Đã hết hạn {Math.abs(cert.daysRemaining)} ngày</span>
                          ) : cert.daysRemaining === 0 ? (
                            <span className="text-red-600">HÔM NAY HẾT HẠN!</span>
                          ) : (
                            <span>Còn {cert.daysRemaining} ngày</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-2 md:p-4 bg-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-[10px] md:text-sm text-gray-600">
            <div className="hidden sm:flex items-center gap-2 md:gap-4 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 md:w-3 md:h-3 bg-red-400 rounded"></span>
                <span>≤ 7 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 md:w-3 md:h-3 bg-orange-400 rounded"></span>
                <span>8-15 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded"></span>
                <span>16-30 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 md:w-3 md:h-3 bg-green-400 rounded"></span>
                <span>&gt; 30 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 md:w-3 md:h-3 bg-gray-400 rounded"></span>
                <span>Đã hết hạn</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition text-xs md:text-sm"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
