import type { TrackRecordDB } from "@/lib/supabase"
import type { ProjectInterruption } from "./project-interruptions-shared"

export interface RecordDurationStatus {
  effectiveDays: number | null     // Số ngày làm việc thực tế (sau khi đã trừ các đợt nghỉ ngắt quãng)
  rawDays: number | null           // Tổng số ngày theo lịch (từ ngày bắt đầu đến kết thúc / hôm nay)
  pauseDays: number                // Tổng số ngày tạm ngưng / nghỉ đã trừ
  interruptionCount: number        // Số đợt tạm ngưng
  interruptions?: ProjectInterruption[]
  isOngoing: boolean               // Chưa điền ngày kết thúc (!end_date && !!start_date)
  isFutureEnd: boolean             // Có ngày kết thúc nhưng trong tương lai (end_date > today)
  isMissingBoth: boolean           // Không có ngày bắt đầu và kết thúc
  todayFormatted: string           // Chuỗi ngày hôm nay định dạng VN (dd/mm/yyyy)
}

/**
 * Tính số ngày trùng lặp giữa 2 khoảng thời gian [startA, endA] và [startB, endB] (tính cả 2 đầu ngày)
 */
export function calculateDateOverlapDays(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): number {
  const sA = new Date(startA.getFullYear(), startA.getMonth(), startA.getDate()).getTime()
  const eA = new Date(endA.getFullYear(), endA.getMonth(), endA.getDate()).getTime()
  const sB = new Date(startB.getFullYear(), startB.getMonth(), startB.getDate()).getTime()
  const eB = new Date(endB.getFullYear(), endB.getMonth(), endB.getDate()).getTime()

  if (eA < sB || sA > eB) return 0
  const overlapStart = Math.max(sA, sB)
  const overlapEnd = Math.min(eA, eB)
  if (overlapEnd < overlapStart) return 0
  const diffDays = Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1
  return Math.max(0, diffDays)
}

/**
 * Phân tích trạng thái thời gian và tính toán số ngày vận hành thực tế/dự kiến cho dự án Track Record:
 * 1. Nếu chưa điền ngày kết thúc (!end_date) nhưng có ngày bắt đầu:
 *    - Tự động thống kê số ngày từ ngày bắt đầu đến ngày hôm nay (today).
 *    - Đánh dấu isOngoing = true để tô nền vàng cảnh báo cho dự án.
 * 2. Nếu có ngày kết thúc nhưng ở tương lai (end_date > today):
 *    - Đánh dấu isFutureEnd = true để thêm chú thích "(Dự kiến)".
 * 3. Nếu có các đợt tạm ngưng (interruptions):
 *    - Tự động tính tổng số ngày tạm ngưng nằm trong khoảng thời gian hoạt động của dự án.
 *    - effectiveDays = rawDays - pauseDays.
 */
export function getRecordDurationStatus(
  r: TrackRecordDB,
  referenceDate: Date = new Date(),
  interruptions?: ProjectInterruption[]
): RecordDurationStatus {
  const todayStart = new Date(referenceDate)
  todayStart.setHours(0, 0, 0, 0)

  const todayEnd = new Date(referenceDate)
  todayEnd.setHours(23, 59, 59, 999)

  const todayFormatted = todayStart.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const hasStart = !!r.start_date && !isNaN(new Date(r.start_date).getTime())
  const hasEnd = !!r.end_date && !isNaN(new Date(r.end_date).getTime())

  // Hàm tính pause days cho khoảng hoạt động của dự án
  const computePauseDays = (projStart: Date, projEnd: Date): number => {
    if (!interruptions || interruptions.length === 0) return 0
    let totalPause = 0
    interruptions.forEach((int) => {
      if (int.startDate && int.endDate) {
        const iStart = new Date(int.startDate)
        iStart.setHours(0, 0, 0, 0)
        const iEnd = new Date(int.endDate)
        iEnd.setHours(23, 59, 59, 999)
        const overlap = calculateDateOverlapDays(projStart, projEnd, iStart, iEnd)
        totalPause += overlap
      } else if (int.days && int.days > 0) {
        totalPause += int.days
      }
    })
    return totalPause
  }

  // Không có cả start_date và end_date
  if (!hasStart && !hasEnd) {
    const rawDays = r.duration_days ?? null
    return {
      effectiveDays: rawDays,
      rawDays,
      pauseDays: 0,
      interruptionCount: (interruptions || []).length,
      interruptions,
      isOngoing: false,
      isFutureEnd: false,
      isMissingBoth: true,
      todayFormatted,
    }
  }

  // Trường hợp 1: Có ngày bắt đầu nhưng CHƯA điền ngày kết thúc (dự án đang tiếp diễn)
  if (hasStart && !hasEnd) {
    const start = new Date(r.start_date!)
    const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const tDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate())

    if (sDate.getTime() <= tDate.getTime()) {
      const diffMs = tDate.getTime() - sDate.getTime()
      const rawDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
      const pauseDays = computePauseDays(sDate, tDate)
      const effectiveDays = Math.max(0, rawDays - pauseDays)

      return {
        effectiveDays,
        rawDays,
        pauseDays,
        interruptionCount: (interruptions || []).length,
        interruptions,
        isOngoing: true,
        isFutureEnd: false,
        isMissingBoth: false,
        todayFormatted,
      }
    } else {
      // Ngày bắt đầu ở tương lai
      return {
        effectiveDays: 0,
        rawDays: 0,
        pauseDays: 0,
        interruptionCount: (interruptions || []).length,
        interruptions,
        isOngoing: true,
        isFutureEnd: false,
        isMissingBoth: false,
        todayFormatted,
      }
    }
  }

  // Trường hợp 2: Có ngày kết thúc
  const start = hasStart ? new Date(r.start_date!) : new Date(r.end_date!)
  const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const end = new Date(r.end_date!)
  const eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const tDate = new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate())
  const isFutureEnd = eDate.getTime() > tDate.getTime()

  let rawDays = r.duration_days
  if ((rawDays == null || rawDays <= 0) && hasStart) {
    const diffMs = eDate.getTime() - sDate.getTime()
    rawDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1)
  }

  const pauseDays = computePauseDays(sDate, eDate)
  const effectiveDays = rawDays != null ? Math.max(0, rawDays - pauseDays) : null

  return {
    effectiveDays,
    rawDays: rawDays ?? null,
    pauseDays,
    interruptionCount: (interruptions || []).length,
    interruptions,
    isOngoing: false,
    isFutureEnd,
    isMissingBoth: false,
    todayFormatted,
  }
}

/**
 * Trả về số ngày hiệu lực (effective days), mặc định 0 nếu không xác định
 */
export function getEffectiveDays(
  r: TrackRecordDB,
  referenceDate: Date = new Date(),
  interruptions?: ProjectInterruption[]
): number {
  const status = getRecordDurationStatus(r, referenceDate, interruptions)
  return status.effectiveDays ?? 0
}

/**
 * Tính toán phân bổ số ngày hoạt động thực tế vào từng tháng trong năm
 * Hỗ trợ cả dự án đang chạy (kết thúc ở hôm nay) và dự án có ngày kết thúc,
 * đồng thời khấu trừ chính xác các ngày tạm ngưng phát sinh trong tháng đó.
 * ĐẢM BẢO TUYỆT ĐỐI không vượt quá số ngày thực tế của tháng (ví dụ tháng 6 tối đa 30 ngày).
 */
export function getDaysInMonthForRecord(
  r: TrackRecordDB,
  year: number,
  monthIndex: number, // 0 - 11
  referenceDate: Date = new Date(),
  interruptions?: ProjectInterruption[]
): number {
  if (!r.start_date) return 0
  const start = new Date(r.start_date)
  if (isNaN(start.getTime())) return 0

  const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  let eDate: Date
  if (r.end_date) {
    const end = new Date(r.end_date)
    if (isNaN(end.getTime())) return 0
    eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  } else {
    // Chưa kết thúc: Tính đến referenceDate (mặc định hôm nay)
    const ref = new Date(referenceDate)
    const curYear = ref.getFullYear()
    if (year < curYear) {
      eDate = new Date(year, 11, 31)
    } else {
      eDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    }
  }

  const daysInM = new Date(year, monthIndex + 1, 0).getDate()
  const mStart = new Date(year, monthIndex, 1)
  const mEnd = new Date(year, monthIndex, daysInM)

  // Không có giao nhau với tháng
  if (eDate < mStart || sDate > mEnd) return 0

  const overlapStart = sDate > mStart ? sDate : mStart
  const overlapEnd = eDate < mEnd ? eDate : mEnd

  const diffDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diffDays <= 0) return 0

  // Giới hạn tuyệt đối không vượt quá số ngày của tháng đó
  const rawMonthDays = Math.min(daysInM, Math.max(1, diffDays))

  // Khấu trừ số ngày tạm ngưng nằm trong tháng này (nếu có)
  if (interruptions && interruptions.length > 0) {
    let pauseInMonth = 0
    interruptions.forEach((int) => {
      if (int.startDate && int.endDate) {
        const iStart = new Date(int.startDate)
        const iEnd = new Date(int.endDate)
        if (!isNaN(iStart.getTime()) && !isNaN(iEnd.getTime())) {
          const isDate = new Date(iStart.getFullYear(), iStart.getMonth(), iStart.getDate())
          const ieDate = new Date(iEnd.getFullYear(), iEnd.getMonth(), iEnd.getDate())
          const effStart = isDate > overlapStart ? isDate : overlapStart
          const effEnd = ieDate < overlapEnd ? ieDate : overlapEnd
          if (effStart <= effEnd) {
            const pDays = Math.round((effEnd.getTime() - effStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            pauseInMonth += Math.max(0, pDays)
          }
        }
      }
    })
    return Math.min(daysInM, Math.max(0, rawMonthDays - pauseInMonth))
  }

  return rawMonthDays
}
