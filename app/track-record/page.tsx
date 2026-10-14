import { getTrackRecords } from "@/actions/track-record-actions"
import { getProjectInterruptions } from "@/lib/project-interruptions"
import { getROVAssignments } from "@/lib/rov-assignments"
import { getAllPersonnel } from "@/lib/personnel-data"
import TrackRecordContent from "./track-record-content"

export const metadata = {
  title: "Track Record – ROV Workshop PTSC G&S",
  description: "Danh sách các dự án ROV đã và đang triển khai – PTSC G&S",
}


export default async function TrackRecordPage() {
  const [records, initialInterruptions, initialAssignments, initialPersonnel] = await Promise.all([
    getTrackRecords(),
    getProjectInterruptions(),
    getROVAssignments(),
    getAllPersonnel(),
  ])
  return (
    <TrackRecordContent
      initialRecords={records}
      initialInterruptions={initialInterruptions}
      initialAssignments={initialAssignments}
      initialPersonnel={initialPersonnel}
    />
  )
}
