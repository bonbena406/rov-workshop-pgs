"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Settings, Lock } from "lucide-react"
import Link from "next/link"

export function AdminPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === "edit123") {
      setIsAuthenticated(true)
      setError("")
    } else {
      setError("Mật khẩu không đúng!")
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setIsAuthenticated(false)
    setPassword("")
    setError("")
  }

  return (
    <div className="fixed bottom-4 right-4">
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="rounded-full w-12 h-12 bg-red-600 hover:bg-red-700 shadow-lg">
            <Settings className="w-6 h-6" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Quản trị hệ thống
            </DialogTitle>
          </DialogHeader>

          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Nhập mật khẩu quản trị"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full">
                Đăng nhập
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-green-600 text-sm">✓ Đã xác thực thành công</p>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/admin" onClick={handleClose}>
                  <Button variant="outline" className="w-full bg-transparent">
                    Quản lý Admin
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleClose}>
                  Đóng
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
