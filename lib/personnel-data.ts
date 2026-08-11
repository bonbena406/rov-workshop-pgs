import { supabase, type PersonnelDB } from "./supabase"
import { revalidatePath } from "next/cache"
import { siteConfig } from "./config"

const TABLE_NAME = siteConfig.tableName

// Get all personnel
export async function getAllPersonnel(): Promise<PersonnelDB[]> {
  try {
    const { data, error } = await supabase.from(TABLE_NAME).select("*").order("ho_va_ten")

    if (error) {
      console.error("Error fetching personnel:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Exception fetching personnel:", error)
    return []
  }
}

// Get personnel by ID with better error handling
export async function getPersonnelById(id: string): Promise<PersonnelDB | null> {
  try {
    console.log("Fetching personnel with ID:", id)

    // Validate ID
    const numericId = Number.parseInt(id)
    if (isNaN(numericId)) {
      console.error("Invalid ID format:", id)
      return null
    }

    const { data, error } = await supabase.from(TABLE_NAME).select("*").eq("id", numericId).single()

    if (error) {
      console.error("Supabase error fetching personnel by ID:", error)
      return null
    }

    console.log("Personnel fetched successfully:", data?.ho_va_ten)
    return data
  } catch (error) {
    console.error("Exception fetching personnel by ID:", error)
    return null
  }
}

// Get leadership structure
export async function getLeadership() {
  try {
    const { data, error } = await supabase.from(TABLE_NAME).select("*").order("ho_va_ten")

    if (error) {
      console.error("Error fetching leadership:", error)
      return { head: [], deputies: [], advisors: [] }
    }

    const personnel = data || []

    const head = personnel.filter((p) => p.chuc_vu?.toLowerCase().includes("trưởng phòng"))

    const deputies = personnel.filter((p) => p.chuc_vu?.toLowerCase().includes("phó phòng"))

    const advisors = personnel.filter((p) => p.chuc_vu?.toLowerCase().includes("tư vấn"))

    return { head, deputies, advisors }
  } catch (error) {
    console.error("Exception fetching leadership:", error)
    return { head: [], deputies: [], advisors: [] }
  }
}

// Get personnel by team
export async function getPersonnelByTeam(): Promise<Record<string, PersonnelDB[]>> {
  try {
    const { data, error } = await supabase.from(TABLE_NAME).select("*").order("ho_va_ten")

    if (error) {
      console.error("Error fetching personnel by team:", error)
      return {}
    }

    const personnel = data || []
    const byTeam: Record<string, PersonnelDB[]> = {}

    personnel.forEach((person) => {
      const team = person.to_phong || "Khác"
      if (!byTeam[team]) {
        byTeam[team] = []
      }
      byTeam[team].push(person)
    })

    return byTeam
  } catch (error) {
    console.error("Exception fetching personnel by team:", error)
    return {}
  }
}

// Update personnel with proper data handling and revalidation
export async function updatePersonnel(id: string, updates: Partial<PersonnelDB>): Promise<boolean> {
  try {
    console.log("Updating personnel ID:", id, "with data:", updates)

    const numericId = Number.parseInt(id)
    if (isNaN(numericId)) {
      console.error("Invalid ID format:", id)
      return false
    }

    const { data, error } = await supabase.from(TABLE_NAME).update(updates).eq("id", numericId).select()

    if (error) {
      console.error("Error updating personnel:", error)
      return false
    }

    console.log("Update successful:", data)

    // Force revalidation of all related paths
    revalidatePath("/")
    revalidatePath(`/profile/${id}`)
    revalidatePath(`/profile/${id}/edit`)
    revalidatePath("/admin")
    revalidatePath("/admin/manage")

    return true
  } catch (error) {
    console.error("Exception updating personnel:", error)
    return false
  }
}

// Add new personnel
export async function addPersonnel(data: Omit<PersonnelDB, "id">): Promise<boolean> {
  try {
    const { error } = await supabase.from(TABLE_NAME).insert([data])

    if (error) {
      console.error("Error adding personnel:", error)
      return false
    }

    revalidatePath("/")
    return true
  } catch (error) {
    console.error("Exception adding personnel:", error)
    return false
  }
}

// Delete personnel
export async function deletePersonnel(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", Number.parseInt(id))

    if (error) {
      console.error("Error deleting personnel:", error)
      return false
    }

    revalidatePath("/")
    return true
  } catch (error) {
    console.error("Exception deleting personnel:", error)
    return false
  }
}

export type { PersonnelDB }
