"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAllPersonnel } from "@/lib/personnel-data"
import { getAvatarUrl, type PersonnelDB } from "@/lib/supabase"
import { ArrowLeft, Search, Edit, Eye } from "lucide-react"

export default function ManagePersonnelPage() {
  const [personnel, setPersonnel] = useState<PersonnelDB[]>([])
  const [filteredPersonnel, setFilteredPersonnel] = useState<PersonnelDB[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

    loadPersonnel()
  }, [])

  useEffect(() => {
    const filtered = personnel.filter(
      (person) =>
        person.ho_va_ten?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.chuc_vu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        person.to_phong?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredPersonnel(filtered)
  }, [searchTerm, personnel])

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
          <h1 className="text-2xl font-bold">Quản lý nhân viên</h1>
        </div>

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
                    <TableHead>Số điện thoại</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                          <Image
                            src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"}
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
                      <TableCell>{person.so_dien_thoai}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Link href={`/profile/${person.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link href={`/profile/${person.id}/edit`}>
                            <Button variant="outline" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
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
