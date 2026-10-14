import {
  getROVStatuses,
  saveROVStatuses,
  type ROVStatusMap,
  type ROVStatusItem,
} from "@/lib/rov-statuses"

export async function getROVStatusesAction(): Promise<ROVStatusMap> {
  return await getROVStatuses()
}

export async function updateROVStatusAction(
  rovId: string,
  status: ROVStatusItem
): Promise<{ success: boolean; error?: string; statuses?: ROVStatusMap }> {
  try {
    const current = await getROVStatuses()
    const updated: ROVStatusMap = {
      ...current,
      [rovId]: {
        ...status,
        rovId,
        updatedAt: new Date().toISOString(),
      },
    }
    const ok = await saveROVStatuses(updated)
    if (ok) {
      return { success: true, statuses: updated }
    }
    return { success: false, error: "Không thể lưu trạng thái thiết bị ROV." }
  } catch (error: any) {
    console.error("updateROVStatusAction error:", error)
    return { success: false, error: error?.message || "Lỗi cập nhật trạng thái." }
  }
}
