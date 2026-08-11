import * as XLSX from "xlsx"
import type { PersonnelDB } from "./supabase"

export function exportToExcel(data: PersonnelDB[], filename = "danh-sach-nhan-vien.xlsx") {
  // Prepare data for export
  const exportData = data.map((person) => ({
    "Họ và tên": person.ho_va_ten,
    "Chức vụ": person.chuc_vu,
    "Cấp bậc": person.cap_bac,
    "Tổ/Phòng": person.to_phong,
    Email: person.email,
    "Số điện thoại": person.so_dien_thoai,
    "Ngày sinh": person.ngay_sinh,
    "Quê quán": person.que_quan,
    "Chỗ ở hiện tại": person.cho_o_hien_tai,
    "Nơi làm việc": person.noi_lam_viec,
    "Kinh nghiệm": person.kinh_nghiem,
    "Học vấn": person.hoc_van,
    "Kỹ năng": person.ky_nang,
    "Mô tả công việc": person.mo_ta_cong_viec,
  }))

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(exportData)

  // Set column widths
  const colWidths = [
    { wch: 20 }, // Họ và tên
    { wch: 15 }, // Chức vụ
    { wch: 12 }, // Cấp bậc
    { wch: 25 }, // Tổ/Phòng
    { wch: 25 }, // Email
    { wch: 15 }, // Số điện thoại
    { wch: 12 }, // Ngày sinh
    { wch: 20 }, // Quê quán
    { wch: 25 }, // Chỗ ở hiện tại
    { wch: 20 }, // Nơi làm việc
    { wch: 30 }, // Kinh nghiệm
    { wch: 30 }, // Học vấn
    { wch: 30 }, // Kỹ năng
    { wch: 40 }, // Mô tả công việc
  ]
  ws["!cols"] = colWidths

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Danh sách nhân viên")

  // Save file
  XLSX.writeFile(wb, filename)
}

export function importFromExcel(file: File): Promise<Partial<PersonnelDB>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)

        // Map Excel columns to database fields
        const mappedData = jsonData.map((row: any) => ({
          ho_va_ten: row["Họ và tên"] || "",
          chuc_vu: row["Chức vụ"] || "",
          cap_bac: row["Cấp bậc"] || "",
          to_phong: row["Tổ/Phòng"] || "",
          email: row["Email"] || "",
          so_dien_thoai: row["Số điện thoại"] || "",
          ngay_sinh: row["Ngày sinh"] || "",
          que_quan: row["Quê quán"] || "",
          cho_o_hien_tai: row["Chỗ ở hiện tại"] || "",
          noi_lam_viec: row["Nơi làm việc"] || "",
          kinh_nghiem: row["Kinh nghiệm"] || "",
          hoc_van: row["Học vấn"] || "",
          ky_nang: row["Kỹ năng"] || "",
          mo_ta_cong_viec: row["Mô tả công việc"] || "",
          avatarurl: "",
        }))

        resolve(mappedData)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error("Không thể đọc file"))
    reader.readAsArrayBuffer(file)
  })
}
