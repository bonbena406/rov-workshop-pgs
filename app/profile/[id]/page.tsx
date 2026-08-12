import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mail, Phone, MapPin, Calendar, Building, User, GraduationCap, Briefcase, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { getPersonnelById } from "@/lib/personnel-data"
import { getAvatarUrl } from "@/lib/supabase"
import EditButton from "./edit-button"

export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

function getDaysRemaining(dateStr: string | null | undefined, isExpiryDate = true): string {
  if (!dateStr) return ""

  // Parse dd/mm/yyyy
  const parts = dateStr.split("/")
  if (parts.length !== 3) return ""

  const day = Number.parseInt(parts[0], 10)
  const month = Number.parseInt(parts[1], 10) - 1 // 0-based
  const year = Number.parseInt(parts[2], 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) return ""

  const expireDate = new Date(year, month, day)
  if (isNaN(expireDate.getTime())) return ""

  if (!isExpiryDate) return ""

  // So sánh ngày
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  expireDate.setHours(0, 0, 0, 0)

  const diffMs = expireDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return "(Đã hết hạn)"
  }

  return `(còn ${diffDays} ngày)`
}

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = await params
  const id = resolvedParams.id

  const person = await getPersonnelById(id)

  if (!person) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="rounded-xl mb-6 bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md">
          <div className="flex items-center justify-between p-4">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 border border-white/30 rounded-lg bg-white/20 hover:bg-white/30 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại
            </Link>
            <EditButton
              personId={person.id}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded px-3 py-1.5 shadow"
            />
          </div>
          <div className="flex flex-col items-center pb-6">
            <Avatar className="w-32 h-44 border-4 border-white shadow-xl rounded-full">
              <AvatarImage src={getAvatarUrl(person.avatar_url) || "/placeholder.svg"} alt={person.ho_va_ten} />
              <AvatarFallback className="text-2xl">{person.ho_va_ten?.charAt(0) || "N"}</AvatarFallback>
            </Avatar>
            <h1 className="mt-4 text-3xl font-bold">{person.ho_va_ten}</h1>
            {person.chuc_vu && <p className="text-lg opacity-90">{person.chuc_vu}</p>}
            {person.to_phong && <p className="text-sm opacity-80">{person.to_phong}</p>}
          </div>
        </div>

        {/* Hàng 1: grid 2 cột */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card className="border border-green-300 bg-white shadow rounded-lg">
            <CardHeader className="bg-green-50 rounded-t-lg border-b border-green-200">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <User className="w-5 h-5" />
                Thông tin liên hệ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {person.email && (
                <div className="flex items-center gap-3 text-green-900">
                  <Mail className="w-4 h-4 text-green-700" />
                  <span>E-mail: {person.email}</span>
                </div>
              )}
              {person.so_dien_thoai && (
                <div className="flex items-center gap-3 text-green-900">
                  <Phone className="w-4 h-4 text-green-700" />
                  <span>Điện thoại: {person.so_dien_thoai}</span>
                </div>
              )}
              {person.ngay_sinh && (
                <div className="flex items-center gap-3 text-green-900">
                  <Calendar className="w-4 h-4 text-green-700" />
                  <span>Ngày sinh: {person.ngay_sinh}</span>
                </div>
              )}
              {person.cho_o_hien_tai && (
                <div className="flex items-center gap-3 text-green-900">
                  <MapPin className="w-4 h-4 text-green-700" />
                  <span>Nơi ở hiện tại: {person.cho_o_hien_tai}</span>
                </div>
              )}
              {person.que_quan && (
                <div className="flex items-center gap-3 text-green-900">
                  <MapPin className="w-4 h-4 text-green-700" />
                  <span>Quê quán: {person.que_quan}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Work Information */}
          <Card className="border border-pink-300 bg-white shadow rounded-lg">
            <CardHeader className="bg-pink-50 rounded-t-lg border-b border-pink-200">
              <CardTitle className="flex items-center gap-2 text-pink-800">
                <Building className="w-5 h-5" />
                Thông tin nghề nghiệp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {person.kinh_nghiem && (
                <div className="flex items-center gap-3 text-pink-900">
                  <Briefcase className="w-4 h-4 text-pink-700" />
                  <span>Ngày vào PTSC G&S: {person.kinh_nghiem}</span>
                </div>
              )}
              {person.hoc_van && (
                <div className="flex items-center gap-3 text-pink-900">
                  <GraduationCap className="w-4 h-4 text-pink-700" />
                  <span>Trình độ chuyên môn: {person.hoc_van}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="border border-blue-300 bg-white shadow rounded-lg w-full">
            <CardHeader className="bg-blue-50 rounded-t-lg border-b border-blue-200">
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Building className="w-5 h-5" />
                Bảng theo dõi thời hạn các chứng chỉ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {person.passport && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    Passport: {person.passport} {getDaysRemaining(person.passport, true)}
                  </span>
                </div>
              )}
              {person.medical && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    Medical: {person.medical} {getDaysRemaining(person.medical, true)}
                  </span>
                </div>
              )}
              {person.seamanbook && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>Seamanbook (Ngày cấp): {person.seamanbook}</span>
                </div>
              )}
              {person.opito && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    OPITO: {person.opito} {getDaysRemaining(person.opito, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Maritime_Skills_Assesor && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Maritime Skills Assesor: {person.MTCS_Maritime_Skills_Assesor}{" "}
                    {getDaysRemaining(person.MTCS_Maritime_Skills_Assesor, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Superintendent && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Superintendent: {person.MTCS_Superintendent}{" "}
                    {getDaysRemaining(person.MTCS_Superintendent, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Offshore_Project_Manager && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Offshore Project Manager: {person.MTCS_Offshore_Project_Manager}{" "}
                    {getDaysRemaining(person.MTCS_Offshore_Project_Manager, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Supervisor && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Supervisor: {person.MTCS_Supervisor} {getDaysRemaining(person.MTCS_Supervisor, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Pilot_I && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Pilot I: {person.MTCS_Pilot_I} {getDaysRemaining(person.MTCS_Pilot_I, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Pilot_II && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Pilot II: {person.MTCS_Pilot_II} {getDaysRemaining(person.MTCS_Pilot_II, true)}
                  </span>
                </div>
              )}
              {person.MTCS_Senior_Pilot && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    MTCS Senior Pilot: {person.MTCS_Senior_Pilot}{" "}
                    {getDaysRemaining(person.MTCS_Senior_Pilot, true)}
                  </span>
                </div>
              )}
              {person.opito_bosiet && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    OPITO BOSIET: {person.opito_bosiet} {getDaysRemaining(person.opito_bosiet, true)}
                  </span>
                </div>
              )}
              {person.TSBB && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    TSBB: {person.TSBB} {getDaysRemaining(person.TSBB, true)}
                  </span>
                </div>
              )}
              {person.CA_EBS_Issue_date && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>CA EBS (Ngày cấp): {person.CA_EBS_Issue_date}</span>
                </div>
              )}
              {person.PCCC && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    PCCC: {person.PCCC} {getDaysRemaining(person.PCCC, true)}
                  </span>
                </div>
              )}
              {person.ATLD && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    ATLD: {person.ATLD} {getDaysRemaining(person.ATLD, true)}
                  </span>
                </div>
              )}
              {person.ATHC && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    ATHC: {person.ATHC} {getDaysRemaining(person.ATHC, true)}
                  </span>
                </div>
              )}
              {person.HV_Course && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    HV Course: {person.HV_Course} {getDaysRemaining(person.HV_Course, true)}
                  </span>
                </div>
              )}
              {person.CP1_Issue_date && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>CP1 (Ngày cấp): {person.CP1_Issue_date}</span>
                </div>
              )}
              {person.basic_rigging && (
                <div className="flex items-center gap-3 text-blue-900">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                  <span>
                    Basic Rigging: {person.basic_rigging} {getDaysRemaining(person.basic_rigging, true)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Hàng 3: Mô tả công việc (full-width) */}
        {(person.ky_nang || person.mo_ta_cong_viec) && (
          <div className="mt-6">
            {person.mo_ta_cong_viec && (
              <Card className="border border-red-300 bg-amber-50 shadow rounded-lg w-full">
                <CardHeader className="bg-red-50 rounded-t-lg border-b border-red-200">
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <Briefcase className="w-5 h-5" />
                    Mô tả công việc
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 bg-white">
                  {person.mo_ta_cong_viec
                    .split(/\n+/)
                    .filter((line) => line.trim() !== "")
                    .map((line, idx) => (
                      <div key={idx} className="bg-amber-50 rounded px-3 py-2 mb-2 text-gray-800">
                        {line}
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
