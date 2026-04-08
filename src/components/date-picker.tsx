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
  const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>()

  React.useEffect(() => {
    const today = getToday()
    setDate(today)
    setDisplayMonth(today)
  }, [])

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent>
        {!displayMonth ? (
          <div className="h-[17rem] rounded-xl border border-dashed border-border/60 bg-muted/20" />
        ) : (
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            captionLayout="dropdown"
            className="bg-transparent [--cell-size:2.1rem]"
          />
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
