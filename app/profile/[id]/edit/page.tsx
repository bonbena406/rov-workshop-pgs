import { notFound } from "next/navigation"
import { getAllPersonnel, getPersonnelById } from "@/lib/personnel-data"
import EditForm from "./form"

export async function generateStaticParams() {
  const all = await getAllPersonnel()
  return all.map((p) => ({ id: p.id.toString() }))
}

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
