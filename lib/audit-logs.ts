import { supabase } from "./supabase"

export type AuditActionType =
  | "UPDATE_PERSONNEL"
  | "CREATE_PERSONNEL"
  | "DELETE_PERSONNEL"
  | "UPDATE_ROV_ASSIGNMENT"
  | "DELETE_ROV_ASSIGNMENT"
  | "UPDATE_ROV_STATUS"
  | "UPDATE_CHART_LAYOUT"
  | "CREATE_TRACK_RECORD"
  | "UPDATE_TRACK_RECORD"
  | "DELETE_TRACK_RECORD"
  | "LOGIN_ADMIN"
  | "EXPORT_DATA"

export interface AuditLogEntry {
  id: string | number
  action_type: AuditActionType
  actor_name: string
  ip_address: string
  device_info: string
  target_name: string
  summary: string
  details?: Record<string, any> | null
  created_at: string
}

const LOCAL_STORAGE_KEY = "rov_audit_logs_v1"

/**
 * Lấy IP công khai của Client và thông tin Thiết bị / Hệ điều hành
 */
export async function getClientAuditContext(): Promise<{ ip: string; device: string; actor: string }> {
  let ip = "127.0.0.1 (Nội bộ)"
  let device = "Web Browser"
  let actor = "Quản trị viên (Admin)"

  if (typeof window !== "undefined") {
    // 1. IP Address (ưu tiên lấy từ sessionStorage để tránh gọi API nhiều lần)
    const cachedIp = sessionStorage.getItem("rov_client_ip")
    if (cachedIp) {
      ip = cachedIp
    } else {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res.ok) {
          const data = await res.json()
          if (data?.ip) {
            ip = data.ip
            sessionStorage.setItem("rov_client_ip", data.ip)
          }
        }
      } catch {
        // Fallback nhẹ nếu mạng chặn ipify
        ip = "127.0.0.1 (Client)"
      }
    }

    // 2. Parse Device & OS
    try {
      const ua = navigator.userAgent
      let os = "Thiết bị khác"
      if (ua.includes("Win")) os = "Windows"
      else if (ua.includes("Mac")) os = "macOS"
      else if (ua.includes("Linux")) os = "Linux"
      else if (ua.includes("Android")) os = "Android"
      else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS"

      let browser = "Trình duyệt"
      if (ua.includes("Edg")) browser = "Edge"
      else if (ua.includes("Chrome") && !ua.includes("Edg")) browser = "Chrome"
      else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari"
      else if (ua.includes("Firefox")) browser = "Firefox"

      device = `${os} • ${browser}`
    } catch {
      device = "Web Browser"
    }

    // 3. Actor Name
    const storedAdmin = sessionStorage.getItem("rov_admin_auth")
    if (storedAdmin === "true") {
      actor = "Quản trị viên (Admin)"
    }
  }

  return { ip, device, actor }
}

/**
 * Ghi lại một sự kiện sửa đổi vào cơ sở dữ liệu và LocalStorage
 */
export async function recordAuditLog(entry: {
  action_type: AuditActionType
  target_name: string
  summary: string
  actor_name?: string
  details?: Record<string, any> | null
}): Promise<void> {
  try {
    const ctx = await getClientAuditContext()
    const logItem: AuditLogEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      action_type: entry.action_type,
      actor_name: entry.actor_name || ctx.actor,
      ip_address: ctx.ip,
      device_info: ctx.device,
      target_name: entry.target_name,
      summary: entry.summary,
      details: entry.details || null,
      created_at: new Date().toISOString(),
    }

    // Luôn lưu vào LocalStorage (ngay lập tức hiển thị trên giao diện và làm bộ nhớ đệm an toàn)
    if (typeof window !== "undefined") {
      try {
        const localLogs: AuditLogEntry[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]")
        localLogs.unshift(logItem)
        if (localLogs.length > 200) localLogs.length = 200
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localLogs))
        window.dispatchEvent(new CustomEvent("rov_audit_log_added", { detail: logItem }))
      } catch (e) {
        console.warn("Lỗi lưu audit log cục bộ:", e)
      }
    }

    // Gửi lên bảng app_audit_logs của Supabase (nếu bảng đã được khởi tạo)
    try {
      await supabase.from("app_audit_logs").insert([
        {
          action_type: logItem.action_type,
          actor_name: logItem.actor_name,
          ip_address: logItem.ip_address,
          device_info: logItem.device_info,
          target_name: logItem.target_name,
          summary: logItem.summary,
          details: logItem.details,
          created_at: logItem.created_at,
        },
      ])
    } catch {
      // Bỏ qua nếu bảng Supabase chưa tạo (vẫn có lưu trong LocalStorage)
    }
  } catch (err) {
    console.error("Lỗi recordAuditLog:", err)
  }
}

/**
 * Lấy danh sách lịch sử sửa đổi (hợp nhất từ Supabase & LocalStorage)
 */
export async function getAuditLogs(limitCount = 100): Promise<AuditLogEntry[]> {
  let supabaseLogs: AuditLogEntry[] = []

  try {
    const { data, error } = await supabase
      .from("app_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limitCount)

    if (!error && data && data.length > 0) {
      supabaseLogs = data as AuditLogEntry[]
    }
  } catch {
    // Không kết nối được Supabase
  }

  let localLogs: AuditLogEntry[] = []
  if (typeof window !== "undefined") {
    try {
      localLogs = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]")
    } catch {
      localLogs = []
    }
  }

  // Kết hợp và lọc trùng
  const combined = [...supabaseLogs]
  for (const item of localLogs) {
    if (!combined.some((c) => c.created_at === item.created_at && c.summary === item.summary)) {
      combined.push(item)
    }
  }

  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Dữ liệu mẫu nếu chưa có hoạt động nào
  if (combined.length === 0) {
    return [
      {
        id: "demo_1",
        action_type: "LOGIN_ADMIN",
        actor_name: "Quản trị viên (Admin)",
        ip_address: "113.161.72.105",
        device_info: "Windows • Chrome",
        target_name: "Hệ thống Quản trị",
        summary: "Đăng nhập quyền Quản trị thành công",
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: "demo_2",
        action_type: "UPDATE_ROV_STATUS",
        actor_name: "Quản trị viên (Admin)",
        ip_address: "113.161.72.105",
        device_info: "Windows • Chrome",
        target_name: "Quasar II - 30",
        summary: "Cập nhật trạng thái ROV: Đang làm việc (Dự án PVGAS)",
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: "demo_3",
        action_type: "UPDATE_PERSONNEL",
        actor_name: "Quản trị viên (Admin)",
        ip_address: "113.161.72.105",
        device_info: "Windows • Chrome",
        target_name: "Bùi Đình Vượng",
        summary: "Cập nhật chứng chỉ & chức danh: Xưởng phó",
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      },
    ]
  }

  return combined.slice(0, limitCount)
}
