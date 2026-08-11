"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getAllPersonnel, deletePersonnel } from "@/lib/personnel-data"
import { getAvatarUrl, type PersonnelDB } from "@/lib/supabase"
import { ArrowLeft, Search, Trash2 } from "lucide-react"

export default function DeletePersonnelPage() {
  const [personnel, setPersonnel] = useState<PersonnelDB[]>([])
  const [filteredPersonnel, setFilteredPersonnel] = useState<PersonnelDB[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    loadPersonnel()
  }, [])

  useEffect(() => {
    const filtered = personnel.filter(
      (person) =>
        person.ho_va_ten.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.chuc_vu.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.to_phong.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredPersonnel(filtered)
  }, [searchTerm, personnel])

  async function loadPersonnel() {
    try {
      const data = await getAllPersonnel()
      setPersonnel(data)
      setFilteredPersonnel(data)
    } catch (error) {
      console.error("Error loading personnel:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    setDeleting(id)
    try {
      const success = await deletePersonnel(id)
      if (success) {
        alert(`Đã xóa ${name} thành công!`)
        await loadPersonnel()
      } else {
        alert("Có lỗi xảy ra khi xóa nhân viên!")
      }
    } catch (error) {
      console.error("Error deleting personnel:", error)
      alert("Có lỗi xảy ra khi xóa nhân viên!")
    } finally {
      setDeleting(null)
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/admin">
            <Button variant="outline" className="flex items-center bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-red-600">Xóa nhân viên</h1>
        </div>

        {/* Warning */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700 font-medium">
              ⚠️ Cảnh báo: Thao tác xóa nhân viên không thể hoàn tác. Vui lòng cân nhắc kỹ trước khi thực hiện.
            </p>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Tìm kiếm nhân viên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Tìm theo tên, chức vụ, hoặc tổ/phòng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Tìm thấy {filteredPersonnel.length} / {personnel.length} nhân viên
            </p>
          </CardContent>
        </Card>

        {/* Personnel Table */}
        <Card>
          <CardHeader>
            <CardTitle>Danh sách nhân viên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ảnh</TableHead>
                    <TableHead>Họ và tên</TableHead>
                    <TableHead>Chức vụ</TableHead>
                    <TableHead>Tổ/Phòng</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <Image
                            src={getAvatarUrl(person.avatarurl) || "/placeholder.svg"}
                            alt={person.ho_va_ten}
                            width={40}
                            height={40}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = "/default-avatar.png"
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{person.ho_va_ten}</TableCell>
                      <TableCell>{person.chuc_vu}</TableCell>
                      <TableCell>{person.to_phong}</TableCell>
                      <TableCell>{person.email}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={deleting === person.id}>
                              {deleting === person.id ? (
                                "Đang xóa..."
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Xóa
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xác nhận xóa nhân viên</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa nhân viên <strong>{person.ho_va_ten}</strong>?
                                <br />
                                Thao tác này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(person.id, person.ho_va_ten)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
