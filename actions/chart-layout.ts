import { getChartLayout, saveChartLayout, type ChartLayoutData } from "@/lib/chart-layout"

export async function getChartLayoutAction(): Promise<ChartLayoutData | null> {
  return await getChartLayout()
}

export async function saveChartLayoutAction(layout: ChartLayoutData): Promise<{ success: boolean; message?: string }> {
  try {
    const success = await saveChartLayout(layout)
    if (success) {
      return { success: true }
    }
    return { success: false, message: "Không thể ghi dữ liệu cấu hình." }
  } catch (error: any) {
    console.error("Exception in saveChartLayoutAction:", error)
    return { success: false, message: error?.message || "Lỗi khi lưu cấu hình." }
  }
}
