"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { ArrowLeft, Lock } from "lucide-react"

export default function AdminLogin() {
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "ROV@1234"
    if (password === adminPassword) {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("Mật khẩu không đúng!")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-red-600">Quản lý nhân sự</h1>
          <div className="flex gap-2">
            <Button onClick={() => setIsAuthenticated(false)} variant="outline">
              Đăng xuất
            </Button>
            <Link href="/">
              <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                <ArrowLeft className="w-4 h-4" />
                Trang chủ
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add New Personnel */}
          <Link href="/admin/add">
            <Card className="border-dashed border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-colors">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-2xl text-blue-600">+</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Thêm nhân viên mới</h3>
                <p className="text-gray-500 text-sm">Nhấp để thêm nhân viên mới vào hệ thống</p>
              </CardContent>
            </Card>
          </Link>

          {/* Edit Existing Personnel */}
          <Link href="/admin/manage">
            <Card className="hover:shadow-lg cursor-pointer transition-shadow">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-green-600">✏️</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Quản lý nhân viên</h3>
                <p className="text-gray-500 text-sm">Chỉnh sửa hoặc xóa thông tin nhân viên</p>
              </CardContent>
            </Card>
          </Link>

          {/* Delete Personnel */}
          <Link href="/admin/delete">
            <Card className="hover:shadow-lg cursor-pointer transition-shadow">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-red-600">🗑️</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Xóa nhân viên</h3>
                <p className="text-gray-500 text-sm">Xóa nhân viên khỏi hệ thống</p>
              </CardContent>
            </Card>
          </Link>

          {/* Export Data */}
          <Link href="/admin/export">
            <Card className="hover:shadow-lg cursor-pointer transition-shadow">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-purple-600">📊</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Xuất báo cáo</h3>
                <p className="text-gray-500 text-sm">Xuất danh sách nhân viên ra Excel</p>
              </CardContent>
            </Card>
          </Link>

          {/* Import Data */}
          <Link href="/admin/import">
            <Card className="hover:shadow-lg cursor-pointer transition-shadow">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl text-orange-600">📥</span>
                </div>
                <h3 className="font-semibold text-lg mb-2">Nhập dữ liệu</h3>
                <p className="text-gray-500 text-sm">Nhập danh sách từ file Excel</p>
              </CardContent>
            </Card>
          </Link>

          {/* Settings */}
          <Card className="hover:shadow-lg cursor-pointer transition-shadow">
            <CardContent className="flex flex-col items-center justify-center h-48 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <span className="text-xl text-gray-600">⚙️</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Cài đặt</h3>
              <p className="text-gray-500 text-sm">Cấu hình hệ thống và phân quyền</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Cập nhật thông tin: BÙI ĐÌNH VƯƠNG</span>
                <span className="text-sm text-gray-500">2 giờ trước</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Thêm nhân viên mới: NGUYỄN VĂN A</span>
                <span className="text-sm text-gray-500">1 ngày trước</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Xuất báo cáo nhân sự tháng 12</span>
                <span className="text-sm text-gray-500">3 ngày trước</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
