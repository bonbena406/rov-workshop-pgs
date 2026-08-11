"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Profile page error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi tải thông tin</h1>
        <p className="text-gray-600 mb-4">Không thể tải thông tin nhân sự.</p>
        <div className="space-x-4">
          <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Thử lại
          </button>
          <Link href="/" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Quay lại trang chính
          </Link>
        </div>
      </div>
    </div>
  )
}
