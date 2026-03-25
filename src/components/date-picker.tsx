import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

function getToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function DatePicker() {
  const [date, setDate] = React.useState<Date | undefined>()

  React.useEffect(() => {
    setDate(getToday())
  }, [])

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          captionLayout="dropdown"
          className="bg-transparent [--cell-size:2.1rem]"
        />
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
