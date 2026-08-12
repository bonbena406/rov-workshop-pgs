import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_XROV_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_XROV_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey,
  })
  throw new Error("Missing Supabase environment variables")
}

console.log("Supabase config:", {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
})

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        cache: "no-store",
      })
    },
  },
})

export interface PersonnelDB {
  id: number
  ho_va_ten: string
  chuc_vu?: string
  cap_bac?: string
  to_phong?: string
  email?: string
  so_dien_thoai?: string
  ngay_sinh?: string
  que_quan?: string
  cho_o_hien_tai?: string
  work_address?: string
  kinh_nghiem?: string
  hoc_van?: string
  ky_nang?: string
  mo_ta_cong_viec?: string
  avatar_url?: string
  passport?: string
  opito?: string
  medical?: string
  seamanbook?: string
  MTCS_Maritime_Skills_Assesor?: string
  MTCS_Superintendent?: string
  MTCS_Offshore_Project_Manager?: string
  MTCS_Supervisor?: string
  MTCS_Pilot_I?: string
  MTCS_Pilot_II?: string
  MTCS_Senior_Pilot?: string
  opito_bosiet?: string
  TSBB?: string
  CA_EBS_Issue_date?: string
  PCCC?: string
  ATLD?: string
  ATHC?: string
  HV_Course?: string
  CP1_Issue_date?: string
  basic_rigging?: string
}

// Get avatar URL helper with better error handling
export function getAvatarUrl(avatarPath: string | null | undefined): string {
  if (!avatarPath) return "/default-avatar.png"

  // If it's already a full URL, return it
  if (avatarPath.startsWith("http")) return avatarPath

  try {
    // If it's a storage path, get public URL
    const { data } = supabase.storage.from("avatars").getPublicUrl(avatarPath)
    return data.publicUrl || "/default-avatar.png"
  } catch (error) {
    console.error("Error getting avatar URL:", error)
    return "/default-avatar.png"
  }
}

// Add this function at the end of the file, before the export statements

export async function uploadAvatar(file: File): Promise<string | null> {
  try {
    console.log("Starting avatar upload:", file.name, file.size)

    // Generate unique filename
    const fileExt = file.name.split(".").pop()
    const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `avatars/${fileName}`

    console.log("Uploading to path:", filePath)

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage.from("avatars").upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (error) {
      console.error("Upload error:", error)
      throw error
    }

    console.log("Upload successful:", data)
    return filePath
  } catch (error) {
    console.error("Exception in uploadAvatar:", error)
    return null
  }
}
