"use client"

import { useState, useEffect } from "react"
import { X, AlertTriangle, Calendar, User } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { PersonnelDB, getAvatarUrl } from "@/lib/supabase"

interface CertificateModalProps {
  isOpen: boolean
  onClose: () => void
  allPersonnel: PersonnelDB[]
}

interface ExpiringCert {
  person: PersonnelDB
  certType: string
  expireDate: string
  daysRemaining: number
}

function getDaysRemaining(expireDateStr: string | null | undefined): number {
  if (!expireDateStr) return Infinity

  // Parse dd/mm/yyyy
  const parts = expireDateStr.split("/")
  if (parts.length !== 3) return Infinity
  
  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10) - 1 // 0-based
  const year = parseInt(parts[2], 10)
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return Infinity
  
  const expireDate = new Date(year, month, day)
  if (isNaN(expireDate.getTime())) return Infinity

  // So sánh ngày
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  expireDate.setHours(0, 0, 0, 0)

  const diffMs = expireDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  return diffDays
}

export default function CertificateModal({ isOpen, onClose, allPersonnel }: CertificateModalProps) {
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCert[]>([])

  useEffect(() => {
    if (isOpen) {
      const certs: ExpiringCert[] = []

      allPersonnel.forEach(person => {
        // Kiểm tra Passport
        if (person.passport) {
          const days = getDaysRemaining(person.passport)
          if (days >= 0 && days <= 30) {
            certs.push({
              person,
              certType: "Passport",
              expireDate: person.passport,
              daysRemaining: days
            })
          }
        }

        // Kiểm tra OPITO
        if (person.opito) {
          const days = getDaysRemaining(person.opito)
          if (days >= 0 && days <= 30) {
            certs.push({
              person,
              certType: "OPITO",
              expireDate: person.opito,
              daysRemaining: days
            })
          }
        }

        // Kiểm tra Medical
        if (person.medical) {
          const days = getDaysRemaining(person.medical)
          if (days >= 0 && days <= 30) {
            certs.push({
              person,
              certType: "Medical",
              expireDate: person.medical,
              daysRemaining: days
            })
          }
        }
      })

      // Sắp xếp theo số ngày còn lại (ít nhất trước)
      certs.sort((a, b) => a.daysRemaining - b.daysRemaining)
      setExpiringCerts(certs)
    }
  }, [isOpen, allPersonnel])

  if (!isOpen) return null

  const getUrgencyColor = (days: number) => {
    if (days <= 7) return "bg-red-100 border-red-400 text-red-800"
    if (days <= 15) return "bg-orange-100 border-orange-400 text-orange-800"
    return "bg-yellow-100 border-yellow-400 text-yellow-800"
  }

  const getUrgencyIcon = (days: number) => {
    if (days <= 7) return "🚨"
    if (days <= 15) return "⚠️"
    return "📅"
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-red-500 to-orange-500 text-white">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Chứng chỉ sắp hết hạn (≤ 30 ngày)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {expiringCerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-semibold text-green-600 mb-2">
                Tuyệt vời! Không có chứng chỉ nào sắp hết hạn
              </h3>
              <p className="text-gray-600">
                Tất cả chứng chỉ đều còn hạn trên 30 ngày
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 font-medium">
                  ⚠️ Có <span className="font-bold">{expiringCerts.length}</span> chứng chỉ sắp hết hạn cần chú ý!
                </p>
              </div>

              <div className="grid gap-3">
                {expiringCerts.map((cert, index) => (
                  <div
                    key={`${cert.person.id}-${cert.certType}`}
                    className={`p-4 rounded-lg border-2 ${getUrgencyColor(cert.daysRemaining)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-300">
                          <Image
                            src={getAvatarUrl(cert.person.avatar_url) || "/placeholder.svg"}
                            alt={cert.person.ho_va_ten}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/profile/${cert.person.id}`}
                            className="font-semibold hover:underline"
                            onClick={onClose}
                          >
                            {cert.person.ho_va_ten}
                          </Link>
                          <span className="text-sm bg-gray-200 px-2 py-1 rounded">
                            {cert.person.to_phong}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{cert.certType}:</span>
                            <span>{cert.expireDate}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 font-bold">
                            <span className="text-lg">{getUrgencyIcon(cert.daysRemaining)}</span>
                            {cert.daysRemaining === 0 ? (
                              <span className="text-red-600">HÔM NAY HẾT HẠN!</span>
                            ) : cert.daysRemaining < 0 ? (
                              <span className="text-red-600">ĐÃ HẾT HẠN!</span>
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-400 rounded"></span>
                <span>≤ 7 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-orange-400 rounded"></span>
                <span>8-15 ngày</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 bg-yellow-400 rounded"></span>
                <span>16-30 ngày</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
