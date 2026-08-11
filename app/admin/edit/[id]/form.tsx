"use client"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, Save, Edit } from "lucide-react"

import { type Personnel, updatePersonnel } from "@/lib/personnel-data"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { AvatarUpload } from "@/components/ui/avatar-upload"

const POSITIONS = ["Trưởng phòng", "Phó Phòng", "Tư vấn", "Tổ trưởng", "Phụ trách công tác...", "Nhân viên"]

const TEAMS = [
  "Tổ Điều phối dự án",
  "Tổ Hậu cần",
  "Tổ Vận hành bảo dưỡng Địa Vật Lý",
  "Tổ Vận hành bảo dưỡng Địa Chất Công Trình",
  "Tổ Báo cáo kỹ thuật",
]

interface EditFormProps {
  person: Personnel
}

export default function EditForm({ person }: EditFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: person.name,
    position: person.position,
    level: person.level,
    team: person.team,
    email: person.email,
    phone: person.phone,
    address: person.address,
    experience: person.experience,
    education: person.education,
    skills: person.skills.join(", "),
    responsibilities: person.responsibilities.join("\n"),
    avatar: person.avatar ?? "",
  })

  /* ---------- helpers ---------- */
  const onField = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }))

  const onAvatar = (avatar: string | null) => setForm((p) => ({ ...p, avatar: avatar ?? "" }))

  /* ---------- submit ---------- */
  const onSave = async () => {
    setIsSaving(true)

    // xác định level từ position (tương tự file gốc)
    const mapLevel = (): Personnel["level"] => {
      switch (form.position) {
        case "Trưởng phòng":
          return "head"
        case "Phó Phòng":
          return "deputy"
        case "Tư vấn":
          return "advisor"
        case "Tổ trưởng":
          return "team_leader"
        case "Tổ phó":
          return "deputy_leader"
        default:
          return "staff"
      }
    }

    try {
      const updated = updatePersonnel(person.id, {
        ...form,
        level: mapLevel(),
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        responsibilities: form.responsibilities
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
        avatar: form.avatar || undefined,
      })

      /* phát sự kiện để các trang khác đồng bộ */
      if (updated && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("personnelUpdated", {
            detail: { action: "update", id: person.id, data: updated },
          }),
        )
        window.dispatchEvent(new CustomEvent("personnelDataChanged"))
      }

      setSuccess(true)
      setTimeout(() => router.push("/admin/manage"), 1800)
    } catch (err) {
      console.error("Error saving personnel:", err)
    } finally {
      setIsSaving(false)
    }
  }

  /* ---------- UI ---------- */
  if (success)
    return (
      <div className="flex items-center justify-center py-10">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Cập nhật thành công!</h2>
            <p className="text-gray-600">Đang chuyển hướng...</p>
          </CardContent>
        </Card>
      </div>
    )

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/manage">
            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-blue-600 flex items-center gap-2">
            <Edit className="w-8 h-8" />
            Chỉnh sửa thông tin nhân viên
          </h1>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* --- Avatar --- */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Ảnh đại diện</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <AvatarUpload currentAvatar={form.avatar} onAvatarChange={onAvatar} size={200} />
            </CardContent>
          </Card>

          {/* --- Thông tin cơ bản --- */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Thông tin cơ bản</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Họ và tên *</Label>
                <Input id="name" value={form.name} onChange={(e) => onField("name", e.target.value)} required />
              </div>

              <div>
                <Label htmlFor="position">Chức vụ *</Label>
                <Select value={form.position} onValueChange={(v) => onField("position", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn chức vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="team">Tổ *</Label>
                <Select value={form.team} onValueChange={(v) => onField("team", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn tổ" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => onField("email", e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Số điện thoại *</Label>
                <Input id="phone" value={form.phone} onChange={(e) => onField("phone", e.target.value)} required />
              </div>

              <div>
                <Label htmlFor="address">Địa chỉ</Label>
                <Input id="address" value={form.address} onChange={(e) => onField("address", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* --- Thông tin nghề nghiệp --- */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Thông tin nghề nghiệp</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="experience">Ngày vào PTSC G&amp;S</Label>
                <Input
                  id="experience"
                  value={form.experience}
                  onChange={(e) => onField("experience", e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="education">Trình độ chuyên môn</Label>
                <Input id="education" value={form.education} onChange={(e) => onField("education", e.target.value)} />
              </div>

              <div>
                <Label htmlFor="skills">Kỹ năng (phân cách bằng dấu phẩy)</Label>
                <Input id="skills" value={form.skills} onChange={(e) => onField("skills", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* --- Mô tả công việc --- */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Mô tả công việc</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={form.responsibilities}
                onChange={(v) => onField("responsibilities", v)}
                placeholder="Nhập mô tả công việc chi tiết..."
                rows={8}
              />
            </CardContent>
          </Card>
        </div>

        {/* --- Buttons --- */}
        <div className="flex justify-center gap-4 mt-8">
          <Link href="/admin/manage">
            <Button type="button" variant="outline">
              Hủy bỏ
            </Button>
          </Link>

          <Button type="button" disabled={isSaving} onClick={onSave} className="flex items-center gap-2">
            <Save className="w-4 h-4" />
            {isSaving ? "Đang cập nhật..." : "Cập nhật thông tin"}
          </Button>
        </div>
      </div>
    </div>
  )
}
