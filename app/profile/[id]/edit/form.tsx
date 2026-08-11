"use client"

import type React from "react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, CheckCircle } from "lucide-react"
import type { PersonnelDB } from "@/lib/supabase"
import { AvatarUpload } from "@/components/ui/avatar-upload"
import { updatePersonnelAction } from "@/actions/personnel"
import Link from "next/link"

interface EditFormProps {
  person: PersonnelDB
}

export default function EditForm({ person }: EditFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    ho_va_ten: person.ho_va_ten || "",
    chuc_vu: person.chuc_vu || "",
    cap_bac: person.cap_bac || "",
    to_phong: person.to_phong || "",
    email: person.email || "",
    so_dien_thoai: person.so_dien_thoai || "",
    ngay_sinh: person.ngay_sinh || "",
    que_quan: person.que_quan || "",
    cho_o_hien_tai: person.cho_o_hien_tai || "",
    kinh_nghiem: person.kinh_nghiem || "",
    hoc_van: person.hoc_van || "",
    ky_nang: person.ky_nang || "",
    mo_ta_cong_viec: person.mo_ta_cong_viec || "",
    avatar_url: person.avatar_url || "",
    passport: person.passport || "",
    opito: person.opito || "",
    medical: person.medical || "",
    seamanbook: person.seamanbook || "",
    MTCS_Maritime_Skills_Assesor: person.MTCS_Maritime_Skills_Assesor || "",
    MTCS_Superintendent: person.MTCS_Superintendent || "",
    MTCS_Offshore_Project_Manager: person.MTCS_Offshore_Project_Manager || "",
    MTCS_Supervisor: person.MTCS_Supervisor || "",
    MTCS_Pilot_I: person.MTCS_Pilot_I || "",
    MTCS_Pilot_II: person.MTCS_Pilot_II || "",
    MTCS_Senior_Pilot: person.MTCS_Senior_Pilot || "",
    opito_bosiet: person.opito_bosiet || "",
    TSBB: person.TSBB || "",
    CA_EBS_Issue_date: person.CA_EBS_Issue_date || "",
    PCCC: person.PCCC || "",
    ATLD: person.ATLD || "",
    ATHC: person.ATHC || "",
    HV_Course: person.HV_Course || "",
    CP1_Issue_date: person.CP1_Issue_date || "",
    basic_rigging: person.basic_rigging || "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleAvatarChange = (avatarUrl: string | null) => {
    setFormData((prev) => ({ ...prev, avatar_url: avatarUrl || "" }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage("")
    setIsSuccess(false)

    startTransition(async () => {
      try {
        console.log("Submitting form with data:", formData)

        // Create FormData for server action
        const submitData = new FormData()
        submitData.append("id", person.id.toString())

        Object.entries(formData).forEach(([key, value]) => {
          submitData.append(key, value || "")
        })

        const result = await updatePersonnelAction(submitData)

        if (result.success) {
          setMessage("Cập nhật thông tin thành công!")
          setIsSuccess(true)

          // Wait a bit longer and force a hard refresh
          setTimeout(() => {
            window.location.href = `/profile/${person.id}`
          }, 2000)
        } else {
          setMessage(result.message || "Có lỗi xảy ra khi cập nhật thông tin!")
          setIsSuccess(false)
        }
      } catch (error) {
        console.error("Error updating personnel:", error)
        setMessage("Có lỗi xảy ra khi cập nhật thông tin!")
        setIsSuccess(false)
      }
    })
  }

  // Success screen
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Cập nhật thành công!</h2>
            <p className="text-gray-600 mb-4">Thông tin đã được lưu và đang chuyển hướng...</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href={`/profile/${person.id}`}>
            <Button variant="outline" className="flex items-center bg-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Quay lại
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Chỉnh sửa hồ sơ: {person.ho_va_ten}</h1>
        </div>

        {message && !isSuccess && (
          <div className="p-4 rounded-lg text-center bg-red-100 text-red-700 border border-red-200">{message}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <AvatarUpload currentAvatar={formData.avatar_url} onAvatarChange={handleAvatarChange} />
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="bg-white shadow-lg">
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
          <Card className="bg-white shadow-lg">
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
          <Card className="bg-white shadow-lg">
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

          {/* Certificate Expiry Dates */}
          <Card className="bg-white shadow-lg">
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
              <div className="space-y-2">
                <Label htmlFor="MTCS_Maritime_Skills_Assesor">MTCS Maritime Skills Assesor</Label>
                <Input
                  id="MTCS_Maritime_Skills_Assesor"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Maritime_Skills_Assesor}
                  onChange={(e) => handleInputChange("MTCS_Maritime_Skills_Assesor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Superintendent">MTCS Superintendent</Label>
                <Input
                  id="MTCS_Superintendent"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Superintendent}
                  onChange={(e) => handleInputChange("MTCS_Superintendent", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Offshore_Project_Manager">MTCS Offshore Project Manager</Label>
                <Input
                  id="MTCS_Offshore_Project_Manager"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Offshore_Project_Manager}
                  onChange={(e) => handleInputChange("MTCS_Offshore_Project_Manager", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Supervisor">MTCS Supervisor</Label>
                <Input
                  id="MTCS_Supervisor"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Supervisor}
                  onChange={(e) => handleInputChange("MTCS_Supervisor", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Pilot_I">MTCS Pilot I</Label>
                <Input
                  id="MTCS_Pilot_I"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Pilot_I}
                  onChange={(e) => handleInputChange("MTCS_Pilot_I", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Pilot_II">MTCS Pilot II</Label>
                <Input
                  id="MTCS_Pilot_II"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Pilot_II}
                  onChange={(e) => handleInputChange("MTCS_Pilot_II", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="MTCS_Senior_Pilot">MTCS Senior Pilot</Label>
                <Input
                  id="MTCS_Senior_Pilot"
                  placeholder="dd/mm/yyyy"
                  value={formData.MTCS_Senior_Pilot}
                  onChange={(e) => handleInputChange("MTCS_Senior_Pilot", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opito_bosiet">OPITO BOSIET</Label>
                <Input
                  id="opito_bosiet"
                  placeholder="dd/mm/yyyy"
                  value={formData.opito_bosiet}
                  onChange={(e) => handleInputChange("opito_bosiet", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="TSBB">TSBB</Label>
                <Input
                  id="TSBB"
                  placeholder="dd/mm/yyyy"
                  value={formData.TSBB}
                  onChange={(e) => handleInputChange("TSBB", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="CA_EBS_Issue_date">CA EBS Issue Date</Label>
                <Input
                  id="CA_EBS_Issue_date"
                  placeholder="dd/mm/yyyy"
                  value={formData.CA_EBS_Issue_date}
                  onChange={(e) => handleInputChange("CA_EBS_Issue_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="PCCC">PCCC</Label>
                <Input
                  id="PCCC"
                  placeholder="dd/mm/yyyy"
                  value={formData.PCCC}
                  onChange={(e) => handleInputChange("PCCC", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ATLD">ATLD</Label>
                <Input
                  id="ATLD"
                  placeholder="dd/mm/yyyy"
                  value={formData.ATLD}
                  onChange={(e) => handleInputChange("ATLD", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ATHC">ATHC</Label>
                <Input
                  id="ATHC"
                  placeholder="dd/mm/yyyy"
                  value={formData.ATHC}
                  onChange={(e) => handleInputChange("ATHC", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="HV_Course">HV Course</Label>
                <Input
                  id="HV_Course"
                  placeholder="dd/mm/yyyy"
                  value={formData.HV_Course}
                  onChange={(e) => handleInputChange("HV_Course", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="CP1_Issue_date">CP1 Issue Date</Label>
                <Input
                  id="CP1_Issue_date"
                  placeholder="dd/mm/yyyy"
                  value={formData.CP1_Issue_date}
                  onChange={(e) => handleInputChange("CP1_Issue_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="basic_rigging">Basic Rigging</Label>
                <Input
                  id="basic_rigging"
                  placeholder="dd/mm/yyyy"
                  value={formData.basic_rigging}
                  onChange={(e) => handleInputChange("basic_rigging", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Info */}
          <Card className="bg-white shadow-lg">
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
                  rows={10}
                  placeholder="Nhập mô tả công việc chi tiết..."
                />
                <p className="text-xs text-gray-500">
                  Gợi ý: Sử dụng **text** để tạo tiêu đề, • hoặc - để tạo danh sách
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-center pb-8">
            <Button type="submit" disabled={isPending} className="px-8 py-3 text-lg">
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Đang lưu...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Lưu thay đổi
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
