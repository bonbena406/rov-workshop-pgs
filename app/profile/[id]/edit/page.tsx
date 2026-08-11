import { notFound } from "next/navigation"
import { getPersonnelById } from "@/lib/personnel-data"
import EditForm from "./form"

export const dynamic = "force-dynamic"
export const revalidate = 0

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditPage({ params }: EditPageProps) {
  const resolvedParams = await params
  const id = resolvedParams.id

  const person = await getPersonnelById(id)

  if (!person) {
    notFound()
  }

  return <EditForm person={person} />
}
