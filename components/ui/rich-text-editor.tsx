"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Bold, Italic, Underline, List, ListOrdered, Quote, Minus, Type } from "lucide-react"

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

export function RichTextEditor({ value, onChange, placeholder, rows = 6 }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isPreview, setIsPreview] = useState(false)

  const insertText = (before: string, after = "", placeholder = "text") => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    let newText = ""
    if (selectedText) {
      newText = before + selectedText + after
    } else {
      newText = before + placeholder + after
    }

    const newValue = value.substring(0, start) + newText + value.substring(end)
    onChange(newValue)

    // Set cursor position after insertion
    setTimeout(() => {
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length + placeholder.length)
      }
      textarea.focus()
    }, 0)
  }

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    const newValue = value.substring(0, start) + text + value.substring(end)
    onChange(newValue)

    // Set cursor position after insertion
    setTimeout(() => {
      textarea.setSelectionRange(start + text.length, start + text.length)
      textarea.focus()
    }, 0)
  }

  const addListItem = (type: "bullet" | "numbered") => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const lines = value.substring(0, start).split("\n")
    const currentLineStart = value.lastIndexOf("\n", start - 1) + 1
    const currentLine = value.substring(currentLineStart, start)

    let prefix = ""
    if (type === "bullet") {
      prefix = "• "
    } else {
      // Count existing numbered items
      const numberedLines = value.split("\n").filter((line) => line.match(/^\d+\.\s/))
      const nextNumber = numberedLines.length + 1
      prefix = `${nextNumber}. `
    }

    // If we're at the start of a line or the line is empty, add the prefix
    if (currentLine.trim() === "" || start === currentLineStart) {
      insertAtCursor(prefix)
    } else {
      // Add new line with prefix
      insertAtCursor("\n" + prefix)
    }
  }

  const addHeading = (level: number) => {
    const prefix = "#".repeat(level) + " "
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const currentLineStart = value.lastIndexOf("\n", start - 1) + 1

    // Insert at the beginning of current line
    const newValue = value.substring(0, currentLineStart) + prefix + value.substring(currentLineStart)
    onChange(newValue)

    setTimeout(() => {
      textarea.setSelectionRange(currentLineStart + prefix.length, currentLineStart + prefix.length)
      textarea.focus()
    }, 0)
  }

  const addDivider = () => {
    insertAtCursor("\n---\n")
  }

  const addBlockquote = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = value.substring(start, end)

    if (selectedText) {
      // Add blockquote to selected text
      const lines = selectedText.split("\n")
      const quotedLines = lines.map((line) => `&gt; ${line}`)
      const newText = quotedLines.join("\n")

      const newValue = value.substring(0, start) + newText + value.substring(end)
      onChange(newValue)
    } else {
      // Add blockquote at current line
      const currentLineStart = value.lastIndexOf("\n", start - 1) + 1
      const newValue = value.substring(0, currentLineStart) + "&gt; " + value.substring(currentLineStart)
      onChange(newValue)
    }
  }

  // Render formatted preview
  const renderPreview = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/__(.*?)__/g, "<u>$1</u>")
      .replace(/~~(.*?)~~/g, "<del>$1</del>")
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(
        /^&gt; (.*$)/gm,
        '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600">$1</blockquote>',
      )
      .replace(/^---$/gm, '<hr class="my-4 border-gray-300">')
      .replace(/^• (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/^\d+\. (.*$)/gm, '<li class="ml-4">$1</li>')
      .replace(/\n/g, "<br>")
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-gray-50">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText("**", "**", "đậm")}
            className="h-8 w-8 p-0"
            title="Bôi đậm (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText("*", "*", "nghiêng")}
            className="h-8 w-8 p-0"
            title="In nghiêng (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText("__", "__", "gạch chân")}
            className="h-8 w-8 p-0"
            title="Gạch chân (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText("~~", "~~", "gạch ngang")}
            className="h-8 w-8 p-0"
            title="Gạch ngang"
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => insertText("`", "`", "code")}
            className="h-8 w-8 p-0"
            title="Code"
          >
            <span className="text-xs font-mono">{`</>`}</span>
          </Button>
        </div>

        {/* Headings */}
        <div className="flex gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addHeading(1)}
            className="h-8 px-2 text-xs font-bold"
            title="Tiêu đề 1"
          >
            H1
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addHeading(2)}
            className="h-8 px-2 text-xs font-bold"
            title="Tiêu đề 2"
          >
            H2
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addHeading(3)}
            className="h-8 px-2 text-xs font-bold"
            title="Tiêu đề 3"
          >
            H3
          </Button>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addListItem("bullet")}
            className="h-8 w-8 p-0"
            title="Danh sách dấu chấm"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addListItem("numbered")}
            className="h-8 w-8 p-0"
            title="Danh sách số"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
        </div>

        {/* Other */}
        <div className="flex gap-1 border-r pr-2 mr-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addBlockquote}
            className="h-8 w-8 p-0"
            title="Trích dẫn"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addDivider}
            className="h-8 w-8 p-0"
            title="Đường phân cách"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        {/* Preview Toggle */}
        <div className="flex gap-1">
          <Button
            type="button"
            variant={isPreview ? "default" : "ghost"}
            size="sm"
            onClick={() => setIsPreview(!isPreview)}
            className="h-8 px-3 text-xs"
            title="Xem trước"
          >
            {isPreview ? "Chỉnh sửa" : "Xem trước"}
          </Button>
        </div>
      </div>

      {/* Editor/Preview */}
      {isPreview ? (
        <div className="min-h-[150px] p-3 border rounded-md bg-white">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: renderPreview(value) }} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm resize-y"
          onKeyDown={(e) => {
            // Keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
              switch (e.key) {
                case "b":
                  e.preventDefault()
                  insertText("**", "**", "đậm")
                  break
                case "i":
                  e.preventDefault()
                  insertText("*", "*", "nghiêng")
                  break
                case "u":
                  e.preventDefault()
                  insertText("__", "__", "gạch chân")
                  break
              }
            }
          }}
        />
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-500 space-y-1">
        <div>
          <strong>Định dạng:</strong> **đậm**, *nghiêng*, __gạch chân__, ~~gạch ngang~~, `code`
        </div>
        <div>
          <strong>Phím tắt:</strong> Ctrl+B (đậm), Ctrl+I (nghiêng), Ctrl+U (gạch chân)
        </div>
        <div>
          <strong>Tiêu đề:</strong> # Tiêu đề 1, ## Tiêu đề 2, ### Tiêu đề 3
        </div>
        <div>
          <strong>Khác:</strong> • Danh sách, 1. Danh sách số, &gt; Trích dẫn, --- Đường phân cách
        </div>
      </div>
    </div>
  )
}
