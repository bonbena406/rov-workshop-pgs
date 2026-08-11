"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllPersonnel, getPersonnelByTeam } from "@/lib/personnel-data"
import { exportToExcel } from "@/lib/excel-utils"
import type { PersonnelDB } from "@/lib/supabase"
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react"

export default function ExportPage() {
  const [allPersonnel, setAllPersonnel] = useState<PersonnelDB[]>([])
  const [byTeam, setByTeam] = useState<Record<string, PersonnelDB[]>>({})
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [personnelData, teamData] = await Promise.all([getAllPersonnel(), getPersonnelByTeam()])
        setAllPersonnel(personnelData)
        setByTeam(teamData)
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      let dataToExport: PersonnelDB[]
      let filename: string

      if (selectedTeam === "all") {
        dataToExport = allPersonnel
        filename = "danh-sach-nhan-vien-tat-ca.xlsx"
      } else {
        dataToExport = byTeam[selectedTeam] || []
        const teamSlug = selectedTeam.toLowerCase().replace(/\s+/g, "-")
        filename = `danh-sach-nhan-vien-${teamSlug}.xlsx`
      }

      exportToExcel(dataToExport, filename)
      alert(`Đã xuất ${dataToExport.length} nhân viên thành công!`)
    } catch (error) {
      console.error("Export error:", error)
      alert("Có lỗi xảy ra khi xuất file!")
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  const getDataCount = () => {
    if (selectedTeam === "all") {
      return allPersonnel.length
    }
    return byTeam[selectedTeam]?.length || 0
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin">
            <Button variant="outline" className="flex items-center bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Xuất báo cáo Excel</h1>
        </div>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Tùy chọn xuất file
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Chọn phạm vi xuất:</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tổ/phòng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả nhân viên ({allPersonnel.length})</SelectItem>
                  {Object.keys(byTeam).map((team) => (
                    <SelectItem key={team} value={team}>
                      {team} ({byTeam[team].length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Sẽ xuất:</strong> {getDataCount()} nhân viên
              </p>
              <p className="text-xs text-blue-600 mt-1">
                File Excel sẽ chứa đầy đủ thông tin: họ tên, chức vụ, liên hệ, kinh nghiệm, học vấn, kỹ năng...
              </p>
            </div>

            <Button onClick={handleExport} disabled={exporting || getDataCount() === 0} className="w-full">
              {exporting ? (
                "Đang xuất file..."
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Xuất file Excel
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Hướng dẫn sử dụng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                1
              </span>
              <p className="text-sm">Chọn phạm vi xuất: tất cả nhân viên hoặc theo từng tổ/phòng</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                2
              </span>
              <p className="text-sm">Nhấn "Xuất file Excel" để tải file về máy tính</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                3
              </span>
              <p className="text-sm">File sẽ được lưu với định dạng .xlsx, có thể mở bằng Excel hoặc Google Sheets</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
