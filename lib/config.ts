
export const siteConfig = {
  name: "ROV - PTSC G&S PERSONNEL MANAGEMENT",
  title: "APP QUẢN LÝ THÔNG TIN NHÂN SỰ CỦA XƯỞNG ROV – PTSC G&S",
  shortTitle: "APP QUẢN LÝ NHÂN SỰ",
  tableName: process.env.NEXT_PUBLIC_TABLE_NAME || "rov_workshop_data",
  department: "Xưởng ROV",
  company: "PTSC G&S",
  // Thứ tự hiển thị các Xưởng phó từ trái qua phải (theo Họ và Tên)
  deputyOrder: [
    "Mai Thế Hùng",
    "Bùi Đình Vượng",
    "Đinh Ngọc Hưng",
  ],
  labels: {
    totalEmployees: "Tổng số nhân viên",
    loading: "Đang tải dữ liệu...",
    error: "Lỗi tải dữ liệu",
    retry: "Thử lại",
    birthdayMarquee: "🎉 Chúc mừng sinh nhật",
    viewCertificates: "Theo dõi Chứng chỉ",
    monthBirthdays: "Ngày sinh nhật trong tháng",
  }
}

export type SiteConfig = typeof siteConfig
