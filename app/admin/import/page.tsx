"use client"

import type React from "react"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { addPersonnel } from "@/lib/personnel-data"
import { importFromExcel } from "@/lib/excel-utils"
import type { PersonnelDB } from "@/lib/supabase"
import { ArrowLeft, Upload, FileSpreadsheet, Check, X } from "lucide-react"

export default function ImportPage() {
  const [importData, setImportData] = useState<Partial<PersonnelDB>[]>([])
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      alert("Vui lòng chọn file Excel (.xlsx hoặc .xls)")
      return
    }

    try {
      const data = await importFromExcel(file)
      setImportData(data)
      setResults({ success: 0, failed: 0, errors: [] })
    } catch (error) {
      console.error("Import error:", error)
      alert("Có lỗi xảy ra khi đọc file Excel!")
    }
  }

  const handleImport = async () => {
    if (importData.length === 0) return

    setImporting(true)
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const person of importData) {
      try {
        if (!person.ho_va_ten) {
          failed++
          errors.push(`Dòng ${importData.indexOf(person) + 1}: Thiếu họ tên`)
          continue
        }

        const result = await addPersonnel(person as Omit<PersonnelDB, "id">)
        if (result) {
          success++
        } else {
          failed++
          errors.push(`${person.ho_va_ten}: Không thể thêm vào database`)
        }
      } catch (error) {
        failed++
        errors.push(`${person.ho_va_ten}: ${error}`)
      }
    }

    setResults({ success, failed, errors })
    setImporting(false)

    if (success > 0) {
      alert(`Nhập thành công ${success} nhân viên!`)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      {
        "Họ và tên": "NGUYỄN VĂN A",
        "Chức vụ": "Nhân viên",
        "Cấp bậc": "Chuyên viên",
        "Tổ/Phòng": "Tổ Điều phối dự án",
        Email: "nguyenvana@example.com",
        "Số điện thoại": "0123456789",
        "Ngày sinh": "1990-01-01",
        "Quê quán": "Hà Nội",
        "Chỗ ở hiện tại": "Hà Nội",
        "Nơi làm việc": "PTSC G&S",
        "Kinh nghiệm": "Có kinh nghiệm làm việc 5 năm",
        "Học vấn": "Đại học",
        "Kỹ năng": "Excel, Word, PowerPoint",
        "Mô tả công việc": "Phụ trách công tác điều phối dự án",
      },
    ]

    // Create and download template
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(templateData)
      XLSX.utils.book_append_sheet(wb, ws, "Template")
      XLSX.writeFile(wb, "template-nhan-vien.xlsx")
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin">
            <Button variant="outline" className="flex items-center bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Nhập dữ liệu từ Excel</h1>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Chọn file Excel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Chọn file Excel
              </Button>
              <Button variant="outline" onClick={downloadTemplate} className="flex items-center gap-2 bg-transparent">
                <FileSpreadsheet className="w-4 h-4" />
                Tải template mẫu
              </Button>
            </div>

            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />

            <Alert>
              <AlertDescription>
                <strong>Lưu ý:</strong> File Excel phải có các cột: Họ và tên, Chức vụ, Cấp bậc, Tổ/Phòng, Email, Số
                điện thoại, Ngày sinh, Quê quán, Chỗ ở hiện tại, Nơi làm việc, Kinh nghiệm, Học vấn, Kỹ năng, Mô tả công
                việc.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Preview Data */}
        {importData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Xem trước dữ liệu ({importData.length} dòng)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>STT</TableHead>
                      <TableHead>Họ và tên</TableHead>
                      <TableHead>Chức vụ</TableHead>
                      <TableHead>Tổ/Phòng</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importData.map((person, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className={!person.ho_va_ten ? "text-red-600" : ""}>
                          {person.ho_va_ten || "Thiếu tên"}
                        </TableCell>
                        <TableCell>{person.chuc_vu}</TableCell>
                        <TableCell>{person.to_phong}</TableCell>
                        <TableCell>{person.email}</TableCell>
                        <TableCell>
                          {person.ho_va_ten ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Check className="w-4 h-4" />
                              Hợp lệ
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <X className="w-4 h-4" />
                              Lỗi
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-center">
                <Button onClick={handleImport} disabled={importing || importData.length === 0} className="px-8">
                  {importing ? (
                    "Đang nhập dữ liệu..."
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Nhập {importData.length} nhân viên
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {(results.success > 0 || results.failed > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Kết quả nhập dữ liệu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-green-700 font-medium">Thành công: {results.success}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-700 font-medium">Thất bại: {results.failed}</p>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-700 font-medium mb-2">Chi tiết lỗi:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {results.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
