import type { TrackRecordDB } from "./supabase"

/**
 * Cấu trúc thông tin của 1 đợt tạm ngưng / ngắt quãng dự án
 */
export interface ProjectInterruption {
  id: string              // Mã định danh duy nhất (vd: "int_306_1")
  recordId: number        // ID của dự án (TrackRecordDB.id)
  recordNo?: number       // Số thứ tự dự án (TrackRecordDB.no, vd: 306, 305)
  startDate: string       // Ngày bắt đầu tạm ngưng ("YYYY-MM-DD")
  endDate: string         // Ngày kết thúc tạm ngưng ("YYYY-MM-DD")
  days: number            // Số ngày tạm ngưng (tự động tính: endDate - startDate + 1, hoặc nhập tay)
  reason?: string         // Lý do (vd: "Standby chờ giấy phép mỏ KSA", "Bảo dưỡng tàu", "Thời tiết biển xấu")
  note?: string           // Ghi chú chi tiết
  createdAt?: string
}

/**
 * Bản đồ lưu trữ các đợt ngắt quãng: key là recordId hoặc recordNo (dạng string/number)
 */
export type RecordInterruptionsMap = Record<string, ProjectInterruption[]>

/**
 * Dữ liệu mẫu khởi tạo cho 2 dự án số 306 và 305 theo yêu cầu (nghỉ ngắt quãng trong tháng 7 và tháng 8)
 */
export const DEFAULT_INTERRUPTIONS: RecordInterruptionsMap = {
  // Dự án No. 306 (id: 14) - INDEPTH - Vessel Bourbon Enterprise - ROV Panther Plus 911
  "306": [
    {
      id: "int_306_1",
      recordId: 14,
      recordNo: 306,
      startDate: "2026-07-10",
      endDate: "2026-07-22",
      days: 13,
      reason: "Standby chờ giấy phép mỏ KSA",
      note: "Tháng 7 nghỉ 13 ngày (từ 10/07 đến 22/07/2026)",
      createdAt: "2026-07-10T00:00:00Z",
    },
    {
      id: "int_306_2",
      recordId: 14,
      recordNo: 306,
      startDate: "2026-08-08",
      endDate: "2026-08-20",
      days: 13,
      reason: "Bảo dưỡng định kỳ hệ thống ROV Panther Plus 911",
      note: "Tháng 8 nghỉ 13 ngày (từ 08/08 đến 20/08/2026)",
      createdAt: "2026-08-08T00:00:00Z",
    },
  ],
  "14": [
    {
      id: "int_306_1",
      recordId: 14,
      recordNo: 306,
      startDate: "2026-07-10",
      endDate: "2026-07-22",
      days: 13,
      reason: "Standby chờ giấy phép mỏ KSA",
      note: "Tháng 7 nghỉ 13 ngày (từ 10/07 đến 22/07/2026)",
      createdAt: "2026-07-10T00:00:00Z",
    },
    {
      id: "int_306_2",
      recordId: 14,
      recordNo: 306,
      startDate: "2026-08-08",
      endDate: "2026-08-20",
      days: 13,
      reason: "Bảo dưỡng định kỳ hệ thống ROV Panther Plus 911",
      note: "Tháng 8 nghỉ 13 ngày (từ 08/08 đến 20/08/2026)",
      createdAt: "2026-08-08T00:00:00Z",
    },
  ],

  // Dự án No. 305 (id: 15) - INDEPTH - Vessel Shujaa 2000 - ROV Panther Plus 954
  "305": [
    {
      id: "int_305_1",
      recordId: 15,
      recordNo: 305,
      startDate: "2026-07-05",
      endDate: "2026-07-20",
      days: 16,
      reason: "Tạm ngưng chờ thời tiết biển xấu",
      note: "Tháng 7 nghỉ 16 ngày (từ 05/07 đến 20/07/2026)",
      createdAt: "2026-07-05T00:00:00Z",
    },
    {
      id: "int_305_2",
      recordId: 15,
      recordNo: 305,
      startDate: "2026-08-12",
      endDate: "2026-08-22",
      days: 11,
      reason: "Tàu Shujaa 2000 về cảng chuyển quân & bảo dưỡng",
      note: "Tháng 8 nghỉ 11 ngày (từ 12/08 đến 22/08/2026)",
      createdAt: "2026-08-12T00:00:00Z",
    },
  ],
  "15": [
    {
      id: "int_305_1",
      recordId: 15,
      recordNo: 305,
      startDate: "2026-07-05",
      endDate: "2026-07-20",
      days: 16,
      reason: "Tạm ngưng chờ thời tiết biển xấu",
      note: "Tháng 7 nghỉ 16 ngày (từ 05/07 đến 20/07/2026)",
      createdAt: "2026-07-05T00:00:00Z",
    },
    {
      id: "int_305_2",
      recordId: 15,
      recordNo: 305,
      startDate: "2026-08-12",
      endDate: "2026-08-22",
      days: 11,
      reason: "Tàu Shujaa 2000 về cảng chuyển quân & bảo dưỡng",
      note: "Tháng 8 nghỉ 11 ngày (từ 12/08 đến 22/08/2026)",
      createdAt: "2026-08-12T00:00:00Z",
    },
  ],
}

/**
 * Tìm danh sách đợt tạm ngưng của 1 dự án (tra cứu linh hoạt theo id hoặc no)
 */
export function getInterruptionsForRecord(
  map: RecordInterruptionsMap | undefined | null,
  record: TrackRecordDB
): ProjectInterruption[] {
  if (!map) return []
  if (record.id != null) {
    const list = map[record.id] || map[String(record.id)]
    if (list && list.length > 0) return list
  }
  if (record.no != null) {
    const list = map[record.no] || map[String(record.no)]
    if (list && list.length > 0) return list
  }
  return []
}
