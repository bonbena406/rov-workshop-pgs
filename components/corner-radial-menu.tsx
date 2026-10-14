"use client"

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import {
  Award,
  Cake,
  FolderKanban,
  BarChart3,
  CalendarCheck,
  Settings,
  X,
  Compass,
  Lock,
  Sparkles,
  ChevronRight,
  Shield,
  RotateCw,
  RotateCcw,
  Info,
  ClipboardList,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type PersonnelDB } from "@/lib/supabase"

interface CornerRadialMenuProps {
  onOpenCertificates: () => void
  onOpenBirthdays: () => void
  allPersonnel?: PersonnelDB[]
}

interface FeatureDetail {
  title: string
  subTitle: string
  icon: React.ElementType
  color: string
  gradient: string
  description: string
  highlights: string[]
}

export function CornerRadialMenu({
  onOpenCertificates,
  onOpenBirthdays,
  allPersonnel = [],
}: CornerRadialMenuProps) {
  // Trạng thái mở/đóng menu 1/4 vòng tròn
  const [isExpanded, setIsExpanded] = useState(true)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

  // Vị trí xoay hiện tại (rotation index dạng số thực, hỗ trợ kéo vuốt mượt mà)
  const [rotationOffset, setRotationOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  // Ref theo dõi tọa độ kéo để xử lý mượt mà và phân biệt giữa Click và Drag
  const dragInfoRef = useRef<{
    isDragging: boolean
    startAngle: number
    startOffset: number
    startX: number
    startY: number
    hasMoved: boolean
  }>({
    isDragging: false,
    startAngle: 0,
    startOffset: 0,
    startX: 0,
    startY: 0,
    hasMoved: false,
  })

  const lastWheelTimeRef = useRef<number>(0)

  // Trạng thái Quản trị Admin
  const [isAdminOpen, setIsAdminOpen] = useState(false)
  const [adminPassword, setAdminPassword] = useState("")
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)
  const [adminError, setAdminError] = useState("")

  // Trạng thái Modal tính năng đang phát triển
  const [featureModalData, setFeatureModalData] = useState<FeatureDetail | null>(null)

  // Tính số lượng sinh nhật trong tháng hiện tại
  const birthdayCountThisMonth = useMemo(() => {
    if (!allPersonnel.length) return 0
    const currentMonth = new Date().getMonth() + 1
    return allPersonnel.filter((p) => {
      if (!p.ngay_sinh) return false
      const parts = p.ngay_sinh.split("/")
      return parts.length === 3 && Number(parts[1]) === currentMonth
    }).length
  }, [allPersonnel])

  // Tính số lượng chứng chỉ còn <= 30 ngày hoặc hết hạn
  const expiringCertCount = useMemo(() => {
    if (!allPersonnel.length) return 0
    const certKeys = [
      "bang_cap",
      "chung_chi_chuyen_mon",
      "chung_chi_an_toan",
      "chung_chi_tieng_anh",
      "chung_chi_khac",
    ]
    let count = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    allPersonnel.forEach((person) => {
      certKeys.forEach((key) => {
        const dateStr = person[key as keyof PersonnelDB] as string | undefined
        if (dateStr) {
          const parts = dateStr.split("/")
          if (parts.length === 3) {
            const [d, m, y] = parts.map(Number)
            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const expireDate = new Date(y, m - 1, d)
              const diffTime = expireDate.getTime() - today.getTime()
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
              if (diffDays <= 30) {
                count++
              }
            }
          }
        }
      })
    })
    return count
  }, [allPersonnel])

  // Đồng bộ trạng thái Quản trị Admin từ sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isAuth = sessionStorage.getItem("rov_admin_auth") === "true"
      setIsAdminAuthenticated(isAuth)
      const onAuthChanged = () => {
        setIsAdminAuthenticated(sessionStorage.getItem("rov_admin_auth") === "true")
      }
      window.addEventListener("admin-auth-changed", onAuthChanged)
      return () => window.removeEventListener("admin-auth-changed", onAuthChanged)
    }
  }, [])

  // Xử lý đăng nhập Admin
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const validPasswords = ["edit123", "ROV@1234"]
    if (process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      validPasswords.push(process.env.NEXT_PUBLIC_ADMIN_PASSWORD)
    }
    if (validPasswords.includes(adminPassword.trim())) {
      setIsAdminAuthenticated(true)
      setAdminError("")
      if (typeof window !== "undefined") {
        sessionStorage.setItem("rov_admin_auth", "true")
        window.dispatchEvent(new Event("admin-auth-changed"))
      }
    } else {
      setAdminError("Mật khẩu không đúng!")
    }
  }

  const handleAdminLogout = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("rov_admin_auth")
      window.dispatchEvent(new Event("admin-auth-changed"))
    }
    setIsAdminAuthenticated(false)
    setAdminPassword("")
    setAdminError("")
  }

  const handleCloseAdminDialog = () => {
    setIsAdminOpen(false)
    setAdminPassword("")
    setAdminError("")
  }

  const router = useRouter()

  // Danh sách 7 tính năng quay vòng nối tiếp
  const menuItems = useMemo(
    () => [
      {
        id: "certificates",
        label: "Theo dõi Chứng chỉ",
        subLabel: "Thời hạn & Cảnh báo",
        icon: Award,
        gradient: "from-blue-600 via-sky-500 to-cyan-400",
        glowColor: "shadow-cyan-500/50 border-cyan-300/80",
        badge: expiringCertCount > 0 ? `${expiringCertCount}` : null,
        badgeColor: "bg-amber-500 text-white animate-pulse",
        onClick: onOpenCertificates,
      },
      {
        id: "birthdays",
        label: "Sinh nhật trong tháng",
        subLabel: "Chúc mừng sinh nhật",
        icon: Cake,
        gradient: "from-pink-600 via-rose-500 to-fuchsia-500",
        glowColor: "shadow-pink-500/50 border-pink-300/80",
        badge: birthdayCountThisMonth > 0 ? `${birthdayCountThisMonth}` : null,
        badgeColor: "bg-rose-500 text-white",
        onClick: onOpenBirthdays,
      },
      {
        id: "track-record",
        label: "Track Record",
        subLabel: "Lịch sử dự án ROV",
        icon: ClipboardList,
        gradient: "from-teal-600 via-cyan-600 to-sky-500",
        glowColor: "shadow-teal-500/50 border-teal-300/80",
        badge: null,
        badgeColor: "bg-teal-600 text-white",
        onClick: () => router.push("/track-record"),
      },
      {
        id: "projects",
        label: "Quản lý Dự án",
        subLabel: "Chiến dịch & Tàu ROV",
        icon: FolderKanban,
        gradient: "from-amber-500 via-orange-500 to-yellow-400",
        glowColor: "shadow-amber-500/50 border-amber-300/80",
        badge: "Mới",
        badgeColor: "bg-blue-600 text-white",
        onClick: () => {
          setFeatureModalData({
            title: "Quản lý Dự án ROV",
            subTitle: "Điều phối chiến dịch ngoài khơi & bờ",
            icon: FolderKanban,
            color: "text-amber-500",
            gradient: "from-amber-500 to-orange-500",
            description:
              "Hệ thống quản lý thông tin các chiến dịch khảo sát ROV ngoài khơi, kết nối nhân sự theo từng dự án và theo dõi tài sản thiết bị.",
            highlights: [
              "Danh sách dự án đang triển khai (Offshore / Onshore)",
              "Phân bổ nhân sự, vị trí Supervisor, Pilot, Tech lên tàu & giàn",
              "Theo dõi nhật ký vận hành và tình trạng kỹ thuật thiết bị ROV",
              "Lịch trình huy động và giải tỏa nhân sự theo dự án",
            ],
          })
        },
      },
      {
        id: "reports",
        label: "Báo cáo & Thống kê",
        subLabel: "Dữ liệu vận hành xưởng",
        icon: BarChart3,
        gradient: "from-indigo-600 via-purple-500 to-violet-400",
        glowColor: "shadow-indigo-500/50 border-indigo-300/80",
        badge: null,
        badgeColor: "bg-purple-600 text-white",
        onClick: () => {
          setFeatureModalData({
            title: "Báo cáo & Thống kê",
            subTitle: "Tổng hợp dữ liệu vận hành & nhân sự",
            icon: BarChart3,
            color: "text-purple-500",
            gradient: "from-indigo-600 to-violet-500",
            description:
              "Báo cáo chuyên sâu về cơ cấu nhân sự, năng lực chuyên môn, số giờ vận hành ROV và tình trạng kiểm định định kỳ.",
            highlights: [
              "Thống kê cơ cấu nhân sự theo tổ đội (VHBD, UDKTCN)",
              "Báo cáo tổng hợp số giờ lặn và vận hành ROV lũy kế",
              "Bảng theo dõi hạn kiểm định kỹ thuật và bảo hiểm",
              "Xuất dữ liệu Excel báo cáo ban lãnh đạo PTSC G&S",
            ],
          })
        },
      },
      {
        id: "attendance",
        label: "Chấm công & Phân ca",
        subLabel: "Ngày công & Trực xưởng",
        icon: CalendarCheck,
        gradient: "from-emerald-600 via-teal-500 to-cyan-400",
        glowColor: "shadow-emerald-500/50 border-emerald-300/80",
        badge: null,
        badgeColor: "bg-emerald-600 text-white",
        onClick: () => {
          setFeatureModalData({
            title: "Chấm công & Phân ca",
            subTitle: "Theo dõi ngày công ngoài khơi & trực xưởng",
            icon: CalendarCheck,
            color: "text-emerald-500",
            gradient: "from-emerald-600 to-teal-500",
            description:
              "Quản lý lịch phân ca trực tại xưởng ROV, theo dõi ngày công thực địa Offshore/Onshore và nhật ký bàn giao ca làm việc.",
            highlights: [
              "Theo dõi ngày công công tác ngoài khơi (Offshore days)",
              "Quản lý phép năm, nghỉ bù và luân phiên ca làm việc",
              "Sổ bàn giao công việc ca trực kỹ thuật",
            ],
          })
        },
      },
      {
        id: "admin",
        label: "Quản trị hệ thống",
        subLabel: "Cài đặt & Dữ liệu",
        icon: Settings,
        gradient: "from-red-600 via-rose-600 to-pink-600",
        glowColor: "shadow-red-500/50 border-red-300/80",
        badge: null,
        badgeColor: "bg-red-600 text-white",
        onClick: () => setIsAdminOpen(true),
      },
    ],
    [
      expiringCertCount,
      birthdayCountThisMonth,
      onOpenCertificates,
      onOpenBirthdays,
      router,
    ]
  )

  const numItems = menuItems.length // 7 mục

  // ============================================================
  // THÔNG SỐ HÌNH HỌC TỐI ƯU THEO YÊU CẦU:
  // - Vòng tròn tổng: R = 145px (thu nhỏ gọn ở góc dưới trái)
  // - Kích thước nút to lên: 68px (các nút giáp sát nhau tạo thành chuỗi liên tục)
  // - Bước góc giữa các nấc: 30 độ
  // - 4 vị trí xuất hiện trong cung 90°:
  //    * Slot 0: 0° (mép dưới, hiển thị 1 nửa)
  //    * Slot 1: 30° (đầy đủ)
  //    * Slot 2: 60° (đầy đủ)
  //    * Slot 3: 90° (mép trái, hiển thị 1 nửa)
  // ============================================================
  const originX = 14
  const originY = 14
  const R = 145
  const BUTTON_SIZE = 68 // Nút to 68px, giáp sát nhau

  // Hàm tính góc (độ) của chuột/ngón tay so với tâm góc dưới bên trái
  const getPointerAngle = useCallback((clientX: number, clientY: number) => {
    if (typeof window === "undefined") return 45
    const originScreenX = originX
    const originScreenY = window.innerHeight - originY
    const dx = clientX - originScreenX
    const dy = originScreenY - clientY // dy > 0 khi hướng lên vào trong màn hình
    const rad = Math.atan2(dy, dx)
    return (rad * 180) / Math.PI
  }, [originX, originY])

  // Hàm xoay nấc
  const rotateNext = useCallback(() => {
    setRotationOffset((prev) => Math.round(prev) + 1)
  }, [])

  const rotatePrev = useCallback(() => {
    setRotationOffset((prev) => Math.round(prev) - 1)
  }, [])

  // ============================================================
  // XỬ LÝ KÉO XOAY BẰNG CHUỘT (DESKTOP) HOẶC VUỐT NGÓN TAY (MOBILE)
  // ============================================================
  const handlePointerDown = (e: React.PointerEvent) => {
    // Chỉ kích hoạt chuột trái hoặc chạm cảm ứng
    if (e.button !== 0 && e.pointerType === "mouse") return

    const angle = getPointerAngle(e.clientX, e.clientY)
    dragInfoRef.current = {
      isDragging: true,
      startAngle: angle,
      startOffset: rotationOffset,
      startX: e.clientX,
      startY: e.clientY,
      hasMoved: false,
    }
    setIsDragging(true)

    // Bắt đầu lắng nghe toàn cục trên window để khi di chuột nhanh ra ngoài vẫn mượt
    window.addEventListener("pointermove", handleGlobalPointerMove)
    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerUp)
  }

  const handleGlobalPointerMove = useCallback((e: PointerEvent) => {
    if (!dragInfoRef.current.isDragging) return

    const dist = Math.hypot(
      e.clientX - dragInfoRef.current.startX,
      e.clientY - dragInfoRef.current.startY
    )

    if (dist > 4) {
      dragInfoRef.current.hasMoved = true
    }

    const currentAngle = getPointerAngle(e.clientX, e.clientY)
    const angleDiff = currentAngle - dragInfoRef.current.startAngle

    // Xoay thuận theo ngón tay/chuột: vuốt lên/sang trái làm các nút xoay theo
    // Mỗi 30 độ tương ứng 1 bước offset
    const newOffset = dragInfoRef.current.startOffset - angleDiff / 30
    setRotationOffset(newOffset)
  }, [getPointerAngle])

  const handleGlobalPointerUp = useCallback(() => {
    if (!dragInfoRef.current.isDragging) return
    dragInfoRef.current.isDragging = false
    setIsDragging(false)

    window.removeEventListener("pointermove", handleGlobalPointerMove)
    window.removeEventListener("pointerup", handleGlobalPointerUp)
    window.removeEventListener("pointercancel", handleGlobalPointerUp)

    // Tự động căn chỉnh mượt mà vào nấc gần nhất
    setRotationOffset((prev) => Math.round(prev))

    // Reset cờ di chuyển sau 50ms để click không bị kích hoạt nhầm sau drag
    setTimeout(() => {
      dragInfoRef.current.hasMoved = false
    }, 60)
  }, [handleGlobalPointerMove])

  // Xử lý cuộn chuột (Mouse Wheel) để xoay
  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now()
    if (now - lastWheelTimeRef.current < 100) return
    lastWheelTimeRef.current = now

    if (e.deltaY > 0 || e.deltaX > 0) {
      rotateNext()
    } else {
      rotatePrev()
    }
  }

  // Dọn dẹp event listener nếu unmount
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove)
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerUp)
    }
  }, [handleGlobalPointerMove, handleGlobalPointerUp])

  // ============================================================
  // TÍNH TOÁN VỊ TRÍ CỦA CÁC NÚT TRÊN CUNG TRÒN
  // ============================================================
  const visibleButtons = useMemo(() => {
    const items = []
    const minK = Math.floor(rotationOffset) - 1
    const maxK = Math.ceil(rotationOffset) + 4

    for (let k = minK; k <= maxK; k++) {
      // Góc tính bằng độ: góc = (k - rotationOffset) * 30°
      const angleDeg = (k - rotationOffset) * 30

      // Render các nút trong góc [-25°, 115°]
      if (angleDeg >= -25 && angleDeg <= 115) {
        // Nối tiếp liên tục (vòng lặp modulo 6)
        const itemIndex = ((k % numItems) + numItems) % numItems
        const itemData = menuItems[itemIndex]

        const rad = (angleDeg * Math.PI) / 180
        const posX = originX + R * Math.cos(rad)
        const posY = originY + R * Math.sin(rad)

        // Kiểm tra xem nút có nằm ở 2 mép biên không
        const isNearBottomEdge = angleDeg <= 10
        const isNearLeftEdge = angleDeg >= 80
        const isEdge = isNearBottomEdge || isNearLeftEdge

        items.push({
          key: `${k}-${itemData.id}`,
          item: itemData,
          angleDeg,
          posX,
          posY,
          isEdge,
          isNearBottomEdge,
          isNearLeftEdge,
          itemIndex,
        })
      }
    }
    return items
  }, [rotationOffset, menuItems, numItems, originX, originY, R])

  return (
    <>
      {/* ============================================================ */}
      {/* CONTAINER CHÍNH GÓC DƯỚI BÊN TRÁI                            */}
      {/* ============================================================ */}
      <div
        className="fixed bottom-0 left-0 z-40 pointer-events-none select-none"
        style={{ width: "220px", height: "220px" }}
      >
        {/* ============================================================ */}
        {/* 1/4 VÒNG TRÒN NỀN RADAR GỌN GÀNG (195px x 195px)              */}
        {/* ============================================================ */}
        <div
          className={`absolute bottom-0 left-0 transition-all duration-300 ease-out origin-bottom-left ${
            isExpanded
              ? "opacity-100 scale-100 pointer-events-none"
              : "opacity-0 scale-50 pointer-events-none"
          }`}
          style={{ width: "195px", height: "195px" }}
        >
          {/* Mảng 1/4 hình tròn với kính mờ glassmorphism và viền neon */}
          <div className="absolute inset-0 rounded-tr-full bg-gradient-to-tr from-slate-950/95 via-blue-950/85 to-cyan-950/70 backdrop-blur-md border-t-2 border-r-2 border-cyan-400/50 shadow-[0_0_30px_rgba(6,182,212,0.25)] overflow-hidden pointer-events-none">
            {/* SVG các đường cung định vị radar */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 195 195"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Vòng cung quỹ đạo chính (R = 145) xuyên qua tâm các nút to */}
              <circle
                cx={originX}
                cy={195 - originY}
                r="145"
                stroke="rgba(34, 211, 238, 0.55)"
                strokeWidth="2"
                strokeDasharray="4 6"
              />

              {/* Vòng cung nội bộ (R = 85) */}
              <circle
                cx={originX}
                cy={195 - originY}
                r="85"
                stroke="rgba(96, 165, 250, 0.3)"
                strokeWidth="1"
              />

              {/* Các tia góc 30° và 60° */}
              {[30, 60].map((deg) => {
                const rad = (deg * Math.PI) / 180
                const x2 = originX + 165 * Math.cos(rad)
                const y2 = 195 - originY - 165 * Math.sin(rad)
                return (
                  <line
                    key={deg}
                    x1={originX}
                    y1={195 - originY}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                )
              })}
            </svg>

            {/* Nhãn hiệu ứng công nghệ */}
            <div className="absolute bottom-9 left-9 pointer-events-none">
              <span className="text-[9px] font-bold tracking-wider text-cyan-300/80 uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                ROV HUB
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VÙNG TƯƠNG TÁC XOAY CHUỘT / CẢM ỨNG (DRAG / SWIPE ZONE)       */}
        {/* ============================================================ */}
        {isExpanded && (
          <div
            className="absolute bottom-0 left-0 w-[215px] h-[215px] rounded-tr-full pointer-events-auto cursor-grab active:cursor-grabbing z-10 touch-none select-none"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            title="Kéo chuột hoặc vuốt ngón tay để xoay vòng các nút"
          />
        )}

        {/* ============================================================ */}
        {/* CÁC NÚT VỆ TINH TO QUAY XUNG QUANH (CAROUSEL SATELLITES)      */}
        {/* ============================================================ */}
        {isExpanded &&
          visibleButtons.map(({ key, item, angleDeg, posX, posY, isEdge, isNearBottomEdge, isNearLeftEdge }) => {
            const IconComponent = item.icon
            const isHovered = hoveredItemId === item.id

            // Nút ở 2 mép: hiển thị một nửa
            const edgeOpacity = angleDeg < 0 || angleDeg > 90 ? "opacity-75" : "opacity-100"

            return (
              <div
                key={key}
                className={`absolute z-20 pointer-events-auto ${edgeOpacity} transition-opacity duration-200 select-none touch-none`}
                style={{
                  left: `${posX}px`,
                  bottom: `${posY}px`,
                  transform: "translate(-50%, 50%)",
                  transition: isDragging ? "none" : "left 250ms ease-out, bottom 250ms ease-out",
                }}
                onMouseEnter={() => setHoveredItemId(item.id)}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <div className="relative group">
                  {/* Nút tròn to (68px), giáp sát nhau thành chuỗi liên tục */}
                  <button
                    onPointerDown={handlePointerDown}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Nếu vừa thực hiện thao tác kéo xoay thì không kích hoạt click
                      if (dragInfoRef.current.hasMoved) return

                      if (isNearBottomEdge) {
                        rotatePrev()
                      } else if (isNearLeftEdge) {
                        rotateNext()
                      } else {
                        item.onClick()
                      }
                    }}
                    title={
                      isEdge
                        ? `Xoay để xem "${item.label}"`
                        : `${item.label} (Kéo chuột/vuốt để xoay)`
                    }
                    style={{ width: `${BUTTON_SIZE}px`, height: `${BUTTON_SIZE}px` }}
                    className={`relative flex items-center justify-center rounded-full bg-gradient-to-tr ${item.gradient} text-white shadow-2xl ${item.glowColor} border-2 hover:scale-105 active:scale-95 transition-transform duration-150 focus:outline-none cursor-grab active:cursor-grabbing`}
                  >
                    <IconComponent className="w-7 h-7 drop-shadow-md" />

                    {/* Huy hiệu số lượng / nhãn nổi bật */}
                    {item.badge && (
                      <span
                        className={`absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[22px] h-[22px] flex items-center justify-center text-[11px] font-bold rounded-full border-2 border-white shadow-md ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Tooltip chú thích khi rê chuột (Desktop) */}
                  {isHovered && !isDragging && (
                    <div
                      className={`absolute z-50 whitespace-nowrap bg-slate-900/95 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-lg border border-cyan-400/50 shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150 flex items-center gap-2 ${
                        angleDeg > 50
                          ? "left-20 top-1/2 -translate-y-1/2"
                          : "left-10 bottom-20"
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                      <div>
                        <p className="font-semibold text-white text-[12px] leading-tight">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-cyan-200/80 leading-tight">
                          {item.subLabel}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

        {/* ============================================================ */}
        {/* NÚT ĐIỀU HƯỚNG XOAY PHỤ TRỢ (QUICK ROTATE BUTTONS)            */}
        {/* ============================================================ */}
        {isExpanded && (
          <div className="absolute bottom-2 left-[190px] flex flex-col gap-1 pointer-events-auto z-30">
            <button
              onClick={rotatePrev}
              title="Xoay lùi"
              className="p-1 rounded-full bg-slate-900/90 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-950 hover:text-white shadow-lg active:scale-90 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={rotateNext}
              title="Xoay tiếp"
              className="p-1 rounded-full bg-slate-900/90 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-950 hover:text-white shadow-lg active:scale-90 transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* NÚT TÂM GÓC DƯỚI CÙNG (VERTEX HUB CONTROLLER)                */}
        {/* ============================================================ */}
        <div
          className="absolute pointer-events-auto z-30"
          style={{
            left: `${originX}px`,
            bottom: `${originY}px`,
            transform: "translate(-50%, 50%)",
          }}
        >
          <div className="relative group">
            {!isExpanded && (
              <span className="absolute inset-0 rounded-full bg-cyan-500/50 animate-ping"></span>
            )}

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Thu nhỏ menu" : "Mở menu vòng xoay"}
              className="relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-slate-950 via-blue-900 to-cyan-600 text-white border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.6)] hover:scale-110 active:scale-95 transition-all duration-300 focus:outline-none"
            >
              {isExpanded ? (
                <X className="w-5 h-5 text-cyan-200 transition-transform duration-300 rotate-90 group-hover:rotate-0" />
              ) : (
                <Compass className="w-6 h-6 text-cyan-200 animate-spin-slow transition-transform" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* DIALOG QUẢN TRỊ ADMIN (MẬT KHẨU EDIT123)                      */}
      {/* ============================================================ */}
      <Dialog open={isAdminOpen} onOpenChange={setIsAdminOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5 text-red-600" />
              Quản trị hệ thống Xưởng ROV
            </DialogTitle>
          </DialogHeader>

          {!isAdminAuthenticated ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Nhập mật khẩu quản trị để truy cập các tính năng thêm/sửa/xóa nhân sự, xuất nhập dữ liệu.
                </p>
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu quản trị"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {adminError && <p className="text-sm text-red-600">{adminError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white">
                  Đăng nhập Quản trị
                </Button>
                <Button type="button" variant="outline" onClick={handleCloseAdminDialog}>
                  Hủy
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 text-sm font-medium flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> Đã xác thực quyền Quản trị thành công!
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/admin" onClick={handleCloseAdminDialog}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    Vào trang Admin
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleCloseAdminDialog}>
                  Đóng
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={handleAdminLogout}
                className="w-full text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                Đăng xuất chế độ Quản trị
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG THÔNG BÁO TÍNH NĂNG ĐANG PHÁT TRIỂN                    */}
      {/* ============================================================ */}
      <Dialog
        open={!!featureModalData}
        onOpenChange={(open) => {
          if (!open) setFeatureModalData(null)
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden border-2 border-slate-200">
          {featureModalData && (
            <div>
              <div
                className={`p-5 bg-gradient-to-r ${featureModalData.gradient} text-white flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                    <featureModalData.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{featureModalData.title}</h3>
                    <p className="text-xs text-white/90">{featureModalData.subTitle}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[11px] font-semibold bg-white/25 rounded-full border border-white/30 backdrop-blur-sm">
                  Đang phát triển
                </span>
              </div>

              <div className="p-5 space-y-4 bg-white">
                <div className="flex items-start gap-3 p-3 bg-blue-50/80 rounded-lg border border-blue-100 text-blue-900 text-xs leading-relaxed">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p>{featureModalData.description}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Các mô-đun dự kiến tích hợp:
                  </h4>
                  <ul className="space-y-2">
                    {featureModalData.highlights.map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-2 text-xs text-gray-700 p-2 bg-gray-50 rounded-md border border-gray-100"
                      >
                        <ChevronRight className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t flex justify-between items-center text-xs text-gray-500">
                  <span>Dự kiến triển khai trong phiên bản tiếp theo.</span>
                  <Button
                    onClick={() => setFeatureModalData(null)}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-4"
                  >
                    Đã hiểu
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
