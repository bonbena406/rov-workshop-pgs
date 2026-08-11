import { getPersonnelById } from "@/lib/personnel-data"
import { notFound } from "next/navigation"

import EditForm from "./form"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export default async function Page({ params }: PageProps) {
  /* validate & load dữ liệu */
  if (!params?.id || isNaN(Number(params.id))) return notFound()

  const person = await getPersonnelById(params.id)
  if (!person) return notFound()

  /* render */
  return <EditForm person={person} />
}
