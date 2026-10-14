
import { getAllPersonnel, getPersonnelByTeam } from "@/lib/personnel-data"
import { getChartLayout } from "@/lib/chart-layout"
import { getTrackRecords } from "@/actions/track-record-actions"
import { getROVAssignments } from "@/lib/rov-assignments"
import HomeContent from "./home-content"


export default async function HomePage() {
  // Fetch data on the server for maximum performance
  const [initialPersonnel, initialByTeam, initialChartLayout, initialTrackRecords, initialROVAssignments] = await Promise.all([
    getAllPersonnel(),
    getPersonnelByTeam(),
    getChartLayout(),
    getTrackRecords(),
    getROVAssignments(),
  ])

  return (
    <HomeContent 
      initialPersonnel={initialPersonnel} 
      initialByTeam={initialByTeam} 
      initialChartLayout={initialChartLayout}
      initialTrackRecords={initialTrackRecords}
      initialROVAssignments={initialROVAssignments}
    />
  )
}

