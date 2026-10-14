import defaultInterruptions from "@/data/project-interruptions.json"
import {
  type RecordInterruptionsMap,
  DEFAULT_INTERRUPTIONS,
} from "./project-interruptions-shared"

export * from "./project-interruptions-shared"

/**
 * Đọc dữ liệu các đợt tạm ngưng (kèm fallback mẫu)
 */
export async function getProjectInterruptions(): Promise<RecordInterruptionsMap> {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("rov_project_interruptions")
      if (saved) {
        return JSON.parse(saved) as RecordInterruptionsMap
      }
    } catch (e) {
      console.warn("Error reading project-interruptions from localStorage:", e)
    }
  }
  return { ...DEFAULT_INTERRUPTIONS, ...((defaultInterruptions as RecordInterruptionsMap) || {}) }
}

/**
 * Lưu dữ liệu các đợt tạm ngưng
 */
export async function saveProjectInterruptions(data: RecordInterruptionsMap): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("rov_project_interruptions", JSON.stringify(data))
      window.dispatchEvent(new Event("rov_project_interruptions_updated"))
      return true
    } catch (e) {
      console.error("Error saving project-interruptions to localStorage:", e)
      return false
    }
  }
  return true
}
