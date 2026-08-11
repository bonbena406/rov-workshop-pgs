"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X } from "lucide-react"
import Image from "next/image"
import { uploadAvatar } from "@/lib/supabase"
import { getAvatarUrl } from "@/lib/supabase"

interface AvatarUploadProps {
  currentAvatar?: string
  onAvatarChange: (avatarUrl: string | null) => void
}

export function AvatarUpload({ currentAvatar, onAvatarChange }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Vui lòng chọn file ảnh!")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File ảnh quá lớn! Vui lòng chọn file nhỏ hơn 5MB.")
      return
    }

    setError(null)
    setIsUploading(true)

    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to Supabase
      console.log("Starting upload process...")
      const avatarPath = await uploadAvatar(file)

      if (avatarPath) {
        console.log("Upload successful, path:", avatarPath)
        onAvatarChange(avatarPath)
      } else {
        throw new Error("Upload failed")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setError("Lỗi tải ảnh lên! Vui lòng thử lại.")
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setPreviewUrl(null)
    onAvatarChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const displayUrl = previewUrl || getAvatarUrl(currentAvatar)

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border-4 border-gray-300">
          <Image
            src={displayUrl || "/placeholder.svg"}
            alt="Avatar"
            width={128}
            height={128}
            className="object-cover w-full h-full"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = "/default-avatar.png"
            }}
          />
        </div>

        {(previewUrl || currentAvatar) && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            disabled={isUploading}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? "Đang tải lên..." : "Chọn ảnh"}
        </Button>

        {error && <p className="text-sm text-red-600 text-center max-w-xs">{error}</p>}

        <p className="text-xs text-gray-500 text-center max-w-xs">Chọn ảnh JPG, PNG hoặc GIF. Tối đa 5MB.</p>
      </div>
    </div>
  )
}
