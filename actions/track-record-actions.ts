import { supabase } from "@/lib/supabase"
import type { TrackRecordDB } from "@/lib/supabase"
import fallbackRecords from "@/lib/track-records-fallback.json"

const TABLE = "track_records"

// Lấy toàn bộ track records, mới nhất trước (có fallback đảm bảo không bao giờ bị rỗng khi timeout mạng)
export async function getTrackRecords(): Promise<TrackRecordDB[]> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("no", { ascending: false })
    if (error || !data || data.length === 0) {
      if (error) console.warn("Supabase fetch notice, using fallback records:", error.message)
      return fallbackRecords as TrackRecordDB[]
    }
    return data as TrackRecordDB[]
  } catch (err) {
    console.warn("getTrackRecords network exception, using fallback records:", err)
    return fallbackRecords as TrackRecordDB[]
  }
}

// Thêm mới 1 track record
export async function createTrackRecord(
  payload: Omit<TrackRecordDB, "id" | "duration_days" | "created_at" | "updated_at">
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from(TABLE).insert([payload])
  if (error) {
    console.error("createTrackRecord error:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// Cập nhật track record theo id
export async function updateTrackRecord(
  id: number,
  payload: Partial<Omit<TrackRecordDB, "id" | "duration_days" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from(TABLE).update(payload).eq("id", id)
  if (error) {
    console.error("updateTrackRecord error:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// Xóa track record theo id
export async function deleteTrackRecord(id: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id)
  if (error) {
    console.error("deleteTrackRecord error:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}

// Xóa nhiều track records theo danh sách id
export async function deleteTrackRecords(ids: number[]): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from(TABLE).delete().in("id", ids)
  if (error) {
    console.error("deleteTrackRecords error:", error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
