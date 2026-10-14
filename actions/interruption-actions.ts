import {
  getProjectInterruptions,
  saveProjectInterruptions,
  type RecordInterruptionsMap,
  type ProjectInterruption,
} from "@/lib/project-interruptions"

export async function getProjectInterruptionsAction(): Promise<RecordInterruptionsMap> {
  return await getProjectInterruptions()
}

export async function saveProjectInterruptionsAction(
  map: RecordInterruptionsMap
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await saveProjectInterruptions(map)
    if (ok) {
      return { success: true }
    }
    return { success: false, error: "Không thể lưu dữ liệu đợt tạm ngưng." }
  } catch (error: any) {
    console.error("saveProjectInterruptionsAction error:", error)
    return { success: false, error: error?.message || "Lỗi khi lưu." }
  }
}
