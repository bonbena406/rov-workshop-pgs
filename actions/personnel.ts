"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { updatePersonnel } from "@/lib/personnel-data"
import { type PersonnelDB } from "@/lib/supabase"

export async function updatePersonnelAction(formData: FormData) {
  try {
    const id = formData.get("id") as string
    const updates: Partial<PersonnelDB> = {
      ho_va_ten: formData.get("ho_va_ten") as string,
      chuc_vu: formData.get("chuc_vu") as string,
      cap_bac: formData.get("cap_bac") as string,
      to_phong: formData.get("to_phong") as string,
      email: formData.get("email") as string,
      so_dien_thoai: formData.get("so_dien_thoai") as string,
      ngay_sinh: formData.get("ngay_sinh") as string,
      que_quan: formData.get("que_quan") as string,
      cho_o_hien_tai: formData.get("cho_o_hien_tai") as string,
      kinh_nghiem: formData.get("kinh_nghiem") as string,
      hoc_van: formData.get("hoc_van") as string,
      ky_nang: formData.get("ky_nang") as string,
      mo_ta_cong_viec: formData.get("mo_ta_cong_viec") as string,
      avatar_url: formData.get("avatar_url") as string,
      passport: formData.get("passport") as string,
      opito: formData.get("opito") as string,
      medical: formData.get("medical") as string,
      seamanbook: formData.get("seamanbook") as string,
      MTCS_Maritime_Skills_Assesor: formData.get("MTCS_Maritime_Skills_Assesor") as string,
      MTCS_Superintendent: formData.get("MTCS_Superintendent") as string,
      MTCS_Offshore_Project_Manager: formData.get("MTCS_Offshore_Project_Manager") as string,
      MTCS_Supervisor: formData.get("MTCS_Supervisor") as string,
      MTCS_Pilot_I: formData.get("MTCS_Pilot_I") as string,
      MTCS_Pilot_II: formData.get("MTCS_Pilot_II") as string,
      MTCS_Senior_Pilot: formData.get("MTCS_Senior_Pilot") as string,
      opito_bosiet: formData.get("opito_bosiet") as string,
      TSBB: formData.get("TSBB") as string,
      CA_EBS_Issue_date: formData.get("CA_EBS_Issue_date") as string,
      PCCC: formData.get("PCCC") as string,
      ATLD: formData.get("ATLD") as string,
      ATHC: formData.get("ATHC") as string,
      HV_Course: formData.get("HV_Course") as string,
      CP1_Issue_date: formData.get("CP1_Issue_date") as string,
      basic_rigging: formData.get("basic_rigging") as string,
    }

    console.log("Server action - updating personnel:", id, updates)

    const success = await updatePersonnel(id, updates)

    if (success) {
      // Comprehensive revalidation
      revalidatePath("/", "layout")
      revalidatePath(`/profile/${id}`, "page")
      revalidatePath(`/profile/${id}/edit`, "page")
      revalidatePath("/admin", "page")
      revalidatePath("/admin/manage", "page")

      // Add cache tags for better invalidation
      revalidateTag("personnel")
      revalidateTag(`personnel-${id}`)

      return { success: true, message: "Cập nhật thành công!" }
    } else {
      return { success: false, message: "Có lỗi xảy ra khi cập nhật!" }
    }
  } catch (error) {
    console.error("Server action error:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Có lỗi xảy ra!",
    }
  }
}
