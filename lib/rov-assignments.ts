import defaultAssignments from "@/data/rov-assignments.json"
import type { ROVPersonnelAssignment } from "./rov-assignments-shared"

export * from "./rov-assignments-shared"

// Lấy danh sách phân công nhân sự ROV
export async function getROVAssignments(): Promise<ROVPersonnelAssignment[]> {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("rov_assignments_data")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as ROVPersonnelAssignment[]
        }
      }
    } catch (e) {
      console.warn("Error reading assignments from localStorage:", e)
    }
  }
  return (defaultAssignments || []) as ROVPersonnelAssignment[]
}

// Lưu danh sách phân công nhân sự ROV
export async function saveROVAssignments(assignments: ROVPersonnelAssignment[]): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("rov_assignments_data", JSON.stringify(assignments))
      window.dispatchEvent(new Event("rov_assignments_updated"))
      return true
    } catch (e) {
      console.error("Error saving assignments to localStorage:", e)
      return false
    }
  }
  return true
}
