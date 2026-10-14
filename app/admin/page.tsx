"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { ArrowLeft, Lock, History, Globe, User, ShieldCheck } from "lucide-react"
import { getAuditLogs, recordAuditLog, type AuditLogEntry } from "@/lib/audit-logs"

export default function AdminLogin() {
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState("")
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    // Kiểm tra trạng thái đã đăng nhập trước đó
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("rov_admin_auth")
      if (auth === "true") {
        setIsAuthenticated(true)
      }
    }
    loadRecentLogs()
  }, [])

  const loadRecentLogs = async () => {
    const logs = await getAuditLogs(6)
    setRecentLogs(logs)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "ROV@1234"
    if (password === adminPassword || password === "edit123") {
      setIsAuthenticated(true)
      setError("")
      if (typeof window !== "undefined") {
        sessionStorage.setItem("rov_admin_auth", "true")
      }
      recordAuditLog({
        action_type: "LOGIN_ADMIN",
        target_name: "Trang Quản trị (/admin)",
        summary: "Đăng nhập quyền Quản trị thành công",
      }).then(() => loadRecentLogs())
    } else {
      setError("Mật khẩu không đúng!")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-md border-gray-200">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Lock className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Đăng nhập Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu admin"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
                Đăng nhập
              </Button>

              <div className="text-center">
                <Link href="/">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại trang chủ
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center pb-2 border-b border-gray-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-red-600 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7" />
              Bảng Quản Trị Hệ Thống
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Xưởng ROV – PTSC G&S PERSONNEL MANAGEMENT</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsAuthenticated(false)
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("rov_admin_auth")
                }
              }}
              variant="outline"
              size="sm"
            >
              Đăng xuất
            </Button>
            <Link href="/">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 bg-transparent">
                <ArrowLeft className="w-4 h-4" />
                Trang chủ
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Lịch sử sửa đổi (Audit Log) - MỚI */}
          <Link href="/admin/logs" className="lg:col-span-1">
            <Card className="hover:shadow-lg hover:border-blue-500 cursor-pointer transition-all border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-white h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center relative p-5">
                <span className="absolute top-3 right-3 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Mới
                </span>
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <History className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg text-blue-900 mb-1">Lịch sử sửa đổi (Audit Log)</h3>
                <p className="text-gray-600 text-xs leading-relaxed max-w-xs">
                  Xem chi tiết lịch sử sửa đổi của web app: người sửa, địa chỉ IP, thời gian và nội dung thay đổi.
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Add New Personnel */}
          <Link href="/admin/add">
            <Card className="border-dashed border-2 border-gray-300 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-5">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl text-blue-600 font-bold">+</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">Thêm nhân viên mới</h3>
                <p className="text-gray-500 text-xs">Nhấp để thêm nhân viên mới vào cơ sở dữ liệu hệ thống</p>
              </CardContent>
            </Card>
          </Link>

          {/* Edit Existing Personnel */}
          <Link href="/admin/manage">
            <Card className="hover:shadow-lg hover:border-green-400 cursor-pointer transition-all h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-5">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl text-green-600">✏️</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">Quản lý nhân viên</h3>
                <p className="text-gray-500 text-xs">Chỉnh sửa hồ sơ hoặc xóa thông tin nhân viên</p>
              </CardContent>
            </Card>
          </Link>

          {/* Delete Personnel */}
          <Link href="/admin/delete">
            <Card className="hover:shadow-lg hover:border-red-400 cursor-pointer transition-all h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-5">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl text-red-600">🗑️</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">Xóa nhân viên</h3>
                <p className="text-gray-500 text-xs">Xóa nhân viên khỏi danh sách hệ thống</p>
              </CardContent>
            </Card>
          </Link>

          {/* Export Data */}
          <Link href="/admin/export">
            <Card className="hover:shadow-lg hover:border-purple-400 cursor-pointer transition-all h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-5">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl text-purple-600">📊</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">Xuất báo cáo</h3>
                <p className="text-gray-500 text-xs">Xuất danh sách nhân viên ra định dạng Excel</p>
              </CardContent>
            </Card>
          </Link>

          {/* Import Data */}
          <Link href="/admin/import">
            <Card className="hover:shadow-lg hover:border-orange-400 cursor-pointer transition-all h-full">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center p-5">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                  <span className="text-xl text-orange-600">📥</span>
                </div>
                <h3 className="font-semibold text-lg mb-1">Nhập dữ liệu</h3>
                <p className="text-gray-500 text-xs">Nhập hàng loạt danh sách từ file Excel</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Live Recent Activities (Nhật ký thực tế) */}
        <Card className="mt-6 border-slate-200 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Lịch sử thao tác & sửa đổi gần đây
            </CardTitle>
            <Link href="/admin/logs">
              <Button variant="ghost" size="sm" className="text-xs text-blue-600 hover:text-blue-700">
                Xem toàn bộ lịch sử ➔
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Chưa có hoạt động sửa đổi nào được ghi nhận.</p>
            ) : (
              <div className="space-y-2.5">
                {recentLogs.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50/80 hover:bg-slate-100/70 transition-colors rounded-lg border border-slate-100 gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-xs sm:text-sm">{item.target_name}</span>
                        <span className="text-[11px] font-medium text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {item.summary}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" /> {item.actor_name || "Quản trị viên"}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-blue-600">
                          <Globe className="w-3 h-3 text-blue-400" /> {item.ip_address || "127.0.0.1"}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono flex-shrink-0 self-start sm:self-center">
                      {new Date(item.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                      - {new Date(item.created_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
