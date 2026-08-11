"use client"

import { useState, useEffect } from "react"
import { X, Cake } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { type PersonnelDB, getAvatarUrl } from "@/lib/supabase"

interface BirthdayModalProps {
  isOpen: boolean
  onClose: () => void
  allPersonnel: PersonnelDB[]
}

interface BirthdayInfo {
  person: PersonnelDB
  birthday: string
  day: number
}

export default function BirthdayModal({ isOpen, onClose, allPersonnel }: BirthdayModalProps) {
  const [birthdays, setBirthdays] = useState<BirthdayInfo[]>([])
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1)

  useEffect(() => {
    if (isOpen) {
      const birthdayList: BirthdayInfo[] = []

      allPersonnel.forEach((person) => {
        if (!person.ngay_sinh) return

        const parts = person.ngay_sinh.split("/")
        if (parts.length !== 3) return

        const day = Number.parseInt(parts[0], 10)
        const month = Number.parseInt(parts[1], 10)

        if (isNaN(day) || isNaN(month)) return

        if (month === selectedMonth) {
          birthdayList.push({
            person,
            birthday: person.ngay_sinh,
            day,
          })
        }
      })

      // Sắp xếp theo ngày trong tháng
      birthdayList.sort((a, b) => a.day - b.day)
      setBirthdays(birthdayList)
    }
  }, [isOpen, allPersonnel, selectedMonth])

  if (!isOpen) return null

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1

  const getMonthName = (month: number) => {
    const months = [
      "Tháng 1",
      "Tháng 2",
      "Tháng 3",
      "Tháng 4",
      "Tháng 5",
      "Tháng 6",
      "Tháng 7",
      "Tháng 8",
      "Tháng 9",
      "Tháng 10",
      "Tháng 11",
      "Tháng 12",
    ]
    return months[month - 1]
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-pink-500 to-purple-500 text-white">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cake className="w-6 h-6" />
              <h2 className="text-xl font-bold">Sinh nhật {getMonthName(selectedMonth)}</h2>
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1 rounded bg-white/20 text-white border border-white/30 hover:bg-white/30 transition"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month} className="text-gray-800">
                  {getMonthName(month)}
                </option>
              ))}
            </select>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {birthdays.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎂</div>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Không có sinh nhật nào trong tháng này</h3>
              <p className="text-gray-500">Hãy chọn tháng khác để xem</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {birthdays.map((item) => {
                const isToday = selectedMonth === currentMonth && item.day === currentDay
                const isPast = selectedMonth === currentMonth && item.day < currentDay
                const isFuture = selectedMonth === currentMonth && item.day > currentDay
                const isOtherMonth = selectedMonth !== currentMonth

                return (
                  <div
                    key={item.person.id}
                    className={`p-4 rounded-lg border-2 ${
                      isToday
                        ? "bg-yellow-100 border-yellow-400"
                        : isPast
                          ? "bg-gray-100 border-gray-300"
                          : isOtherMonth
                            ? "bg-purple-50 border-purple-300"
                            : "bg-blue-50 border-blue-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-300">
                          <Image
                            src={getAvatarUrl(item.person.avatar_url) || "/placeholder.svg"}
                            alt={item.person.ho_va_ten}
                            width={48}
                            height={48}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/profile/${item.person.id}`}
                            className="font-semibold hover:underline"
                            onClick={onClose}
                          >
                            {item.person.ho_va_ten}
                          </Link>
                          {isToday && <span className="text-lg">🎉</span>}
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Sinh nhật:</span>
                            <span>{item.birthday}</span>
                          </div>

                          <span className="text-sm bg-gray-200 px-2 py-1 rounded">{item.person.to_phong}</span>
                          <span className="text-sm bg-blue-200 px-2 py-1 rounded">{item.person.chuc_vu}</span>

                          {isToday && <span className="font-bold text-red-600 animate-pulse">🎂 HÔM NAY!</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <div className="flex justify-between items-center text-sm text-gray-600">
            <div className="flex items-center gap-4">
              {selectedMonth === currentMonth && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-yellow-400 rounded"></span>
                    <span>Hôm nay</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-300 rounded"></span>
                    <span>Sắp tới</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-300 rounded"></span>
                    <span>Đã qua</span>
                  </div>
                </>
              )}
              {selectedMonth !== currentMonth && (
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-purple-300 rounded"></span>
                  <span>Tháng {selectedMonth}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Tổng: {birthdays.length} người</span>
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
    </div>
  )
}
