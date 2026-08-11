
import { getAllPersonnel, getPersonnelByTeam } from "@/lib/personnel-data"
import HomeContent from "./home-content"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  // Fetch data on the server for maximum performance
  const [initialPersonnel, initialByTeam] = await Promise.all([
    getAllPersonnel(),
    getPersonnelByTeam()
  ])

  return (
    <HomeContent 
      initialPersonnel={initialPersonnel} 
      initialByTeam={initialByTeam} 
    />
  )
}

