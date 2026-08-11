"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Edit } from "lucide-react"

interface EditButtonProps {
  personId: number
  className?: string
}

export default function EditButton({ personId, className }: EditButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Check password (you can change this password)
    if (password === "ROV@1234") {
      setIsOpen(false)
      setPassword("")
      router.push(`/profile/${personId}/edit`)
    } else {
      setError("Mật khẩu không đúng!")
    }

    setIsLoading(false)
  }

  const handleClose = () => {
    setIsOpen(false)
    setPassword("")
    setError("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className={className || "flex items-center gap-2 bg-white bg-opacity-20 text-white hover:bg-opacity-30 backdrop-blur-sm"}>
          <Edit className="w-4 h-4" />
          Chỉnh sửa
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Xác thực để chỉnh sửa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nhập mật khẩu để chỉnh sửa:</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Đang xác thực..." : "Xác nhận"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
