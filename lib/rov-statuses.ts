import defaultStatuses from "@/data/rov-statuses.json"
import {
  DEFAULT_ROV_STATUSES,
  type ROVStatusItem,
  type ROVStatusMap,
} from "./rov-statuses-shared"

export * from "./rov-statuses-shared"

export async function getROVStatuses(): Promise<ROVStatusMap> {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("rov_statuses_data")
      if (saved) {
        return JSON.parse(saved) as ROVStatusMap
      }
    } catch (e) {
      console.warn("Error reading statuses from localStorage:", e)
    }
  }
  return ((defaultStatuses as ROVStatusMap) || DEFAULT_ROV_STATUSES)
}

export async function saveROVStatuses(statuses: ROVStatusMap): Promise<boolean> {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("rov_statuses_data", JSON.stringify(statuses))
      window.dispatchEvent(new Event("rov_statuses_updated"))
      return true
    } catch (e) {
      console.error("Error saving statuses to localStorage:", e)
      return false
    }
  }
  return true
}
