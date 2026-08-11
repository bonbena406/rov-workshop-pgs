"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AvatarUpload } from "@/components/ui/avatar-upload"
import { addPersonnel } from "@/lib/personnel-data"
import { Save, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AddPersonnelPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [formData, setFormData] = useState({
    ho_va_ten: "",
    chuc_vu: "",
    cap_bac: "",
    to_phong: "",
    email: "",
    so_dien_thoai: "",
    ngay_sinh: "",
    que_quan: "",
    cho_o_hien_tai: "",
    kinh_nghiem: "",
    hoc_van: "",
    ky_nang: "",
    mo_ta_cong_viec: "",
    avatar_url: "",
    passport: "",
    medical: "",
    seamanbook: "",
    opito: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (avatarUrl: string | null) => {
    setFormData((prev) => ({ ...prev, avatar_url: avatarUrl || "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      const success = await addPersonnel(formData)

      if (success) {
        setMessage("Thêm nhân viên thành công!")
        setTimeout(() => {
          router.push("/admin")
        }, 1500)
      } else {
        setMessage("Có lỗi xảy ra khi thêm nhân viên!")
      }
    } catch (error) {
      console.error("Error adding personnel:", error)
      setMessage("Có lỗi xảy ra khi thêm nhân viên!")
    } finally {
      setIsLoading(false)
    }
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
          <h1 className="text-2xl font-bold">Thêm nhân viên mới</h1>
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg text-center ${
              message.includes("thành công") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <Card>
            <CardHeader>
              <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <AvatarUpload currentAvatar={formData.avatar_url} onAvatarChange={handleAvatarChange} />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ho_va_ten">Họ và tên *</Label>
                <Input
                  id="ho_va_ten"
                  value={formData.ho_va_ten}
                  onChange={(e) => handleInputChange("ho_va_ten", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chuc_vu">Chức vụ</Label>
                <Input
                  id="chuc_vu"
                  value={formData.chuc_vu}
                  onChange={(e) => handleInputChange("chuc_vu", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap_bac">Cấp bậc</Label>
                <Input
                  id="cap_bac"
                  value={formData.cap_bac}
                  onChange={(e) => handleInputChange("cap_bac", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to_phong">Tổ/Phòng</Label>
                <Input
                  id="to_phong"
                  value={formData.to_phong}
                  onChange={(e) => handleInputChange("to_phong", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin liên hệ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="so_dien_thoai">Số điện thoại</Label>
                <Input
                  id="so_dien_thoai"
                  value={formData.so_dien_thoai}
                  onChange={(e) => handleInputChange("so_dien_thoai", e.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="cho_o_hien_tai">Chỗ ở hiện tại</Label>
                <Input
                  id="cho_o_hien_tai"
                  value={formData.cho_o_hien_tai}
                  onChange={(e) => handleInputChange("cho_o_hien_tai", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Personal Info */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin cá nhân</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ngay_sinh">Ngày sinh (dd/mm/yyyy)</Label>
                <Input
                  id="ngay_sinh"
                  placeholder="dd/mm/yyyy"
                  value={formData.ngay_sinh}
                  onChange={(e) => handleInputChange("ngay_sinh", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="que_quan">Quê quán</Label>
                <Input
                  id="que_quan"
                  value={formData.que_quan}
                  onChange={(e) => handleInputChange("que_quan", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thông tin chứng chỉ</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="passport">Passport (số/ngày hết hạn)</Label>
                <Input
                  id="passport"
                  placeholder="Số passport hoặc ngày hết hạn"
                  value={formData.passport}
                  onChange={(e) => handleInputChange("passport", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="medical">Medical (ngày hết hạn)</Label>
                <Input
                  id="medical"
                  placeholder="dd/mm/yyyy"
                  value={formData.medical}
                  onChange={(e) => handleInputChange("medical", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seamanbook">Seamanbook (ngày cấp)</Label>
                <Input
                  id="seamanbook"
                  placeholder="dd/mm/yyyy"
                  value={formData.seamanbook}
                  onChange={(e) => handleInputChange("seamanbook", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opito">OPITO (ngày hết hạn)</Label>
                <Input
                  id="opito"
                  placeholder="dd/mm/yyyy"
                  value={formData.opito}
                  onChange={(e) => handleInputChange("opito", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Info */}
          <Card>
            <CardHeader>
              <CardTitle>Thông tin nghề nghiệp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kinh_nghiem">Ngày vào PTSC G&S (dd/mm/yyyy)</Label>
                <Input
                  id="kinh_nghiem"
                  placeholder="dd/mm/yyyy"
                  value={formData.kinh_nghiem}
                  onChange={(e) => handleInputChange("kinh_nghiem", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hoc_van">Trình độ chuyên môn</Label>
                <Textarea
                  id="hoc_van"
                  value={formData.hoc_van}
                  onChange={(e) => handleInputChange("hoc_van", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ky_nang">Kỹ năng</Label>
                <Textarea
                  id="ky_nang"
                  value={formData.ky_nang}
                  onChange={(e) => handleInputChange("ky_nang", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mo_ta_cong_viec">Mô tả công việc</Label>
                <Textarea
                  id="mo_ta_cong_viec"
                  value={formData.mo_ta_cong_viec}
                  onChange={(e) => handleInputChange("mo_ta_cong_viec", e.target.value)}
                  rows={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button type="submit" disabled={isLoading} className="px-8">
              {isLoading ? (
                "Đang lưu..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Thêm nhân viên
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
