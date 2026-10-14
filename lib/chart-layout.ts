import defaultLayout from "@/data/chart-layout.json"

export interface ChartLayoutData {
  row1Ids?: number[] // Hàng 1 (mặc định 1 người, có thể tùy biến)
  row2Ids?: number[] // Hàng 2 (mặc định 1, 2 hoặc 3 người tùy biến)
  actingManagerId?: number
  deputyOrder?: number[]
  teamColumns?: {
    [teamName: string]: number
  }
  teams?: {
    [teamName: string]: {
      phutrachIds: number[]
      regularIds: number[]
    }
  }
}

export async function getChartLayout(): Promise<ChartLayoutData | null> {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("rov_chart_layout")
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.warn("Error reading chart-layout from localStorage:", e)
    }
  }
  return defaultLayout as ChartLayoutData
}

export async function saveChartLayout(layout: ChartLayoutData): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("rov_chart_layout", JSON.stringify(layout))
      window.dispatchEvent(new Event("rov_chart_layout_updated"))
      return true
    } catch (e) {
      console.error("Error saving chart-layout to localStorage:", e)
      return false
    }
  }
  return true
}
