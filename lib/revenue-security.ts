/**
 * ROV Workshop - Quản lý bảo mật & Phân quyền xem dữ liệu Doanh thu
 * Dùng chung một hệ thống mật khẩu cho toàn bộ các chức năng doanh thu.
 */

// Danh sách mật khẩu hợp lệ (Mật khẩu admin & mật khẩu được phân quyền)
export const VALID_REVENUE_PASSWORDS = [
  "edit123",    // Mật khẩu Admin mặc định của hệ thống
  "admin",      // Mật khẩu admin thông dụng
  "123456",     // Mật khẩu số thông dụng
  "ROV@1234",   // Mật khẩu phân quyền quản trị ROV Workshop
  "admin123",   // Mật khẩu quản trị dự phòng
  "rov2026",    // Mật khẩu phân quyền ROV 2026
  "ptsc2026",   // Mật khẩu phân quyền PTSC 2026
]

export const REVENUE_STORAGE_KEY = "rov_revenue_unlocked"

/**
 * Kiểm tra mật khẩu có khớp với mật khẩu admin hoặc mật khẩu phân quyền hay không
 */
export function verifyRevenuePassword(pwd: string): boolean {
  if (!pwd) return false
  const trimmed = pwd.trim()
  // Cho phép ROV@1234 khớp chính xác hoặc các mật khẩu thường (không phân biệt hoa thường)
  return VALID_REVENUE_PASSWORDS.some((valid) => {
    if (valid === "ROV@1234") {
      return trimmed === valid
    }
    return trimmed.toLowerCase() === valid.toLowerCase()
  })
}

/**
 * Kiểm tra trạng thái đã mở khóa doanh thu trong sessionStorage hay chưa (chạy ở Client)
 */
export function getSavedRevenueUnlocked(): boolean {
  if (typeof window === "undefined") return false
  try {
    return sessionStorage.getItem(REVENUE_STORAGE_KEY) === "true"
  } catch {
    return false
  }
}

/**
 * Lưu trạng thái mở khóa doanh thu vào sessionStorage
 */
export function setSavedRevenueUnlocked(unlocked: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (unlocked) {
      sessionStorage.setItem(REVENUE_STORAGE_KEY, "true")
    } else {
      sessionStorage.removeItem(REVENUE_STORAGE_KEY)
    }
  } catch {}
}
