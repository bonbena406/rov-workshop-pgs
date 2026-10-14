import {
  getROVAssignments,
  saveROVAssignments,
  type ROVPersonnelAssignment,
} from "@/lib/rov-assignments"

export async function getROVAssignmentsAction(): Promise<ROVPersonnelAssignment[]> {
  return await getROVAssignments()
}

export async function saveROVAssignmentsAction(
  assignments: ROVPersonnelAssignment[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const ok = await saveROVAssignments(assignments)
    if (ok) {
      return { success: true }
    }
    return { success: false, error: "Không thể ghi dữ liệu phân công ROV" }
  } catch (error: any) {
    console.error("saveROVAssignmentsAction error:", error)
    return { success: false, error: error.message || "Lỗi lưu dữ liệu" }
  }
}
