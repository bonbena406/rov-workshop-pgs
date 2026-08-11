
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { getAvatarUrl, type PersonnelDB } from "@/lib/supabase"
import { AdminPanel } from "@/components/admin-panel"
import CertificateListModal from "@/components/certificate-list-modal"
import BirthdayModal from "@/components/birthday-modal"
import { Award, Cake } from "lucide-react"
import { siteConfig } from "@/lib/config"

const today = new Date()

interface HomeContentProps {
  initialPersonnel: PersonnelDB[]
  initialByTeam: Record<string, PersonnelDB[]>
}

export default function HomeContent({ initialPersonnel, initialByTeam }: HomeContentProps) {
  const allPersonnel = initialPersonnel
  const byTeam = initialByTeam
  const [showCertificateModal, setShowCertificateModal] = useState(false)
  const [showBirthdayModal, setShowBirthdayModal] = useState(false)

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

  const actingManager = allPersonnel.find((p) => {
    const capBac = p.cap_bac?.toLowerCase() || ""
    const chucVu = p.chuc_vu?.toLowerCase() || ""
    return (
      capBac.includes("phụ trách xưởng") ||
      capBac.includes("acting manager") ||
      capBac.includes("xưởng trưởng") ||
      chucVu.includes("phụ trách xưởng") ||
      chucVu.includes("acting manager") ||
      chucVu.includes("xưởng trưởng")
    )
  })

  const deputyManager = allPersonnel.find((p) => {
    const capBac = p.cap_bac?.toLowerCase() || ""
    const chucVu = p.chuc_vu?.toLowerCase() || ""
    return (
      capBac.includes("xưởng phó") ||
      (capBac.includes("deputy") && capBac.includes("manager")) ||
      chucVu.includes("xưởng phó") ||
      (chucVu.includes("deputy") && chucVu.includes("manager"))
    )
  })

  const parseDate = (str: string | null | undefined): number => {
    if (!str) return Number.POSITIVE_INFINITY
    const parts = str.split("/")
    if (parts.length !== 3) return Number.POSITIVE_INFINITY
    const [first, second, year] = parts.map(Number)
    if (isNaN(first) || isNaN(second) || isNaN(year)) return Number.POSITIVE_INFINITY
    return new Date(year, second - 1, first).getTime()
  }

  const teamNames = Object.keys(byTeam).sort().reverse()
  const filteredTeamNames = teamNames.filter((team) => team !== "Khác")

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
  filteredTeamNames.forEach((team, index) => {
    teamColors[team] = colorPalette[index % colorPalette.length]
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white p-2 lg:p-4">
      <div className="lg:scale-container">
        <div className="text-center mb-2 lg:mb-4">
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-blue-800 mb-1 leading-tight uppercase">
            {siteConfig.title}
          </h1>

          <p className="text-[10px] lg:text-xs text-gray-400">{siteConfig.labels.totalEmployees}: {allPersonnel.length}</p>

          {birthdayList.length > 0 && (
            <div className="overflow-hidden mt-1 bg-yellow-100 rounded">
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

        <div className="flex flex-col items-center gap-2 lg:gap-3 mb-3 lg:mb-4 max-w-2xl mx-auto">
          {actingManager && (
            <div className="w-full max-w-xs">
              <ManagerCard person={actingManager} />
            </div>
          )}
          {deputyManager && (
            <div className="w-full max-w-xs">
              <ManagerCard person={deputyManager} />
            </div>
          )}
        </div>

        <div className="max-w-7xl mx-auto px-1">
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-7 lg:gap-3">
            {filteredTeamNames.map((teamName) => {
              const teamList = byTeam[teamName] || []
              const teamMembers = teamList.filter((p) => p.id !== actingManager?.id && p.id !== deputyManager?.id)

              const isVHBD = teamName.includes("VHBD")
              const isUDKTCN = teamName.includes("UDKTCN")

              let phutrach: PersonnelDB[] = []
              let regularMembers: PersonnelDB[] = []

              if (isUDKTCN) {
                const janitors = teamMembers
                  .filter((p) => p.chuc_vu?.toLowerCase().includes("janitor"))
                  .sort((a, b) => parseDate(a.kinh_nghiem) - parseDate(b.kinh_nghiem))

                const nonJanitors = teamMembers
                  .filter((p) => !p.chuc_vu?.toLowerCase().includes("janitor"))
                  .sort((a, b) => parseDate(a.kinh_nghiem) - parseDate(b.kinh_nghiem))

                regularMembers = [...nonJanitors, ...janitors]
              } else {
                phutrach = teamMembers
                  .filter((p) => p.cap_bac?.toLowerCase().includes("phụ trách"))
                  .sort((a, b) => parseDate(a.kinh_nghiem) - parseDate(b.kinh_nghiem))

                regularMembers = teamMembers
                  .filter((p) => !p.cap_bac?.toLowerCase().includes("phụ trách"))
                  .sort((a, b) => parseDate(a.kinh_nghiem) - parseDate(b.kinh_nghiem))
              }

              return (
                <div key={teamName} className={isVHBD ? "lg:col-span-5" : "lg:col-span-2"}>
                  <h2
                    className={`text-center text-sm font-semibold border-2 mb-2 py-1 px-2 ${teamColors[teamName]} rounded`}
                  >
                    {teamName}
                  </h2>

                  {phutrach.length > 0 && (
                    <div className="flex justify-center gap-1.5 mb-2 flex-wrap">
                      {phutrach.map((person) => (
                        <div key={person.id} className="w-28">
                          <PersonnelCard person={person} teamColor={teamColors[teamName]} />
                        </div>
                      ))}
                    </div>
                  )}

                  {isVHBD ? (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {regularMembers.map((person) => (
                        <div key={person.id} className="w-28">
                          <PersonnelCard person={person} teamColor={teamColors[teamName]} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      {Array.from({ length: Math.ceil(regularMembers.length / 2) }).map((_, rowIndex) => {
                        const rowMembers = regularMembers.slice(rowIndex * 2, (rowIndex + 1) * 2)
                        return (
                          <div key={rowIndex} className="flex justify-center gap-1.5">
                            {rowMembers.map((person) => (
                              <div key={person.id} className="w-28">
                                <PersonnelCard person={person} teamColor={teamColors[teamName]} />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-3 lg:mt-4 mb-2 flex justify-center gap-3">
          <button
            onClick={() => setShowCertificateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 font-medium text-sm"
          >
            <Award className="w-4 h-4" />
            {siteConfig.labels.viewCertificates}
          </button>
          <button
            onClick={() => setShowBirthdayModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg shadow-lg hover:from-pink-600 hover:to-purple-600 transition-all duration-200 font-medium text-sm"
          >
            <Cake className="w-4 h-4" />
            {siteConfig.labels.monthBirthdays}
          </button>
        </div>
      </div>

      <AdminPanel />

      <CertificateListModal
        isOpen={showCertificateModal}
        onClose={() => setShowCertificateModal(false)}
        allPersonnel={allPersonnel}
      />

      <BirthdayModal
        isOpen={showBirthdayModal}
        onClose={() => setShowBirthdayModal(false)}
        allPersonnel={allPersonnel}
      />

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 15s linear infinite;
        }

        @keyframes pulse-birthday {
          0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
          70% { box-shadow: 0 0 50px 30px rgba(255, 215, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
        }
        .animate-pulse-birthday {
          animation: pulse-birthday 1s infinite;
        }

        @media (min-width: 1024px) {
          .scale-container {
            transform-origin: top center;
            width: 100%;
          }
          
          @media (max-height: 900px) {
            .scale-container {
              transform: scale(0.85);
            }
          }
          
          @media (max-height: 800px) {
            .scale-container {
              transform: scale(0.75);
            }
          }
          
          @media (max-height: 700px) {
            .scale-container {
              transform: scale(0.65);
            }
          }
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

function ManagerCard({ person }: { person: PersonnelDB }) {
  const isBirthdayToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    const [day, month, year] = dateStr.split("/").map(Number)
    return today.getDate() === day && today.getMonth() + 1 === month
  }

  const isBirthday = isBirthdayToday(person.ngay_sinh)

  return (
    <div className="relative">
      <Link
        href={`/profile/${person.id}`}
        className={`relative z-10 border-2 rounded-lg bg-yellow-100 shadow-lg p-3 flex flex-col items-center hover:shadow-xl transition-shadow ${isBirthday ? "animate-pulse-birthday" : ""}`}
      >
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 mb-1.5">
          <Image
            src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
            alt={person.ho_va_ten}
            width={64}
            height={64}
            className="object-cover rounded-full w-full h-full"
            unoptimized={!!person.avatar_url}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/default-avatar.png"
            }}
          />
        </div>
        <p className="text-sm font-semibold text-center leading-tight">{person.ho_va_ten}</p>
        <p className="text-xs font-bold text-center mt-0.5">{person.cap_bac || person.chuc_vu}</p>

        {isBirthday && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <Image
              src="/images/design-mode/birthday-frame2.png"
              alt="Birthday Frame"
              fill
              className="object-cover rounded-lg opacity-90"
            />
          </div>
        )}
      </Link>
    </div>
  )
}

function PersonnelCard({ person, teamColor }: { person: PersonnelDB; teamColor: string }) {
  const isBirthdayToday = (dateStr: string | null | undefined): boolean => {
    if (!dateStr) return false
    const [day, month, year] = dateStr.split("/").map(Number)
    return today.getDate() === day && today.getMonth() + 1 === month
  }

  const isBirthday = isBirthdayToday(person.ngay_sinh)

  return (
    <div className="relative w-full h-32">
      <Link
        href={`/profile/${person.id}`}
        className={`relative z-10 border-2 rounded-lg ${teamColor} shadow p-1.5 flex flex-col items-center justify-between hover:shadow-md transition-shadow w-full h-full ${isBirthday ? "animate-pulse-birthday" : ""}`}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0">
          <Image
            src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
            alt={person.ho_va_ten}
            width={48}
            height={48}
            className="object-cover rounded-full w-full h-full"
            unoptimized={!!person.avatar_url}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/default-avatar.png"
            }}
          />
        </div>
        <div className="flex flex-col items-center justify-center flex-1 min-h-[2.5rem] w-full">
          <p className="text-[11px] font-medium text-center line-clamp-2 leading-tight w-full px-0.5">
            {person.ho_va_ten}
          </p>
          <p className="text-[9px] text-gray-600 text-center mt-0.5 line-clamp-1 w-full px-0.5">{person.chuc_vu}</p>
        </div>

        {isBirthday && (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <Image
              src="/images/design-mode/birthday-frame2.png"
              alt="Birthday Frame"
              fill
              className="object-cover rounded-lg opacity-90"
            />
          </div>
        )}
      </Link>
    </div>
  )
}
