"use client"

import * as React from "react"

import { Calendar } from "@/components/ui/calendar"
import { DayDetailPanel } from "@/components/day-detail-panel"
import type { CalendarNoteData } from "@/components/day-detail-panel"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { useLunarMonth } from "@/features/chinese-calendar"
import type { LunarDayInfo, DateMarker } from "@/features/chinese-calendar"
import { getCalendarDateKey } from "@/lib/date-time"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  getDefaultClassNames,
  type DayButton as DayButtonType,
} from "react-day-picker"
import { getLunarDayInfo } from "@/features/chinese-calendar"

// Context to pass lunar data into the custom DayButton
const LunarDataContext = React.createContext<{
  lunarData: Map<string, LunarDayInfo>
  markers: DateMarker[]
}>({ lunarData: new Map(), markers: [] })

function toISODate(d: Date): string {
  return getCalendarDateKey(d)
}

function getToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

interface ChineseDatePickerProps {
  markers?: DateMarker[]
  userEmail?: string
}

export function ChineseDatePicker({ markers: externalMarkers = [], userEmail = "" }: ChineseDatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>()
  const [displayMonth, setDisplayMonth] = React.useState<Date | undefined>()
  const [notes, setNotes] = React.useState<CalendarNoteData[]>([])
  const [fetchVersion, setFetchVersion] = React.useState(0)

  React.useEffect(() => {
    const today = getToday()
    setDate(today)
    setDisplayMonth(today)
  }, [])

  // Fetch all notes for this user
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch("/api/calendar-notes")
        if (!res.ok) return
        const json = (await res.json()) as { notes?: CalendarNoteData[] }
        if (!cancelled && Array.isArray(json.notes)) {
          setNotes(json.notes)
        }
      } catch {
        // ignore
      }
    }
    void load()
    return () => { cancelled = true }
  }, [fetchVersion])

  const lunarData = useLunarMonth(displayMonth ?? getToday())

  // Convert notes to markers
  const allMarkers = React.useMemo(() => {
    const noteMarkers: DateMarker[] = notes.map((n) => ({
      date: n.solarDate,
      color: n.color,
      label: n.note,
    }))
    return [...externalMarkers, ...noteMarkers]
  }, [externalMarkers, notes])

  // Get selected date's lunar info
  const selectedLunarInfo = React.useMemo(() => {
    if (!date) return null
    const key = toISODate(date)
    return lunarData.get(key) ?? getLunarDayInfo(date)
  }, [date, lunarData])

  // Notes for the selected date
  const selectedDateNotes = React.useMemo(() => {
    if (!date) return []
    const key = toISODate(date)
    return notes.filter((n) => n.solarDate === key)
  }, [date, notes])

  return (
    <SidebarGroup className="px-0">
      <SidebarGroupContent className="w-full">
        {!displayMonth ? (
          <div className="px-2 py-1">
            <div className="h-[17rem] rounded-xl border border-dashed border-border/60 bg-muted/20" />
          </div>
        ) : (
        <LunarDataContext.Provider value={{ lunarData, markers: allMarkers }}>
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            captionLayout="label"
            className="w-full bg-transparent"
            style={
              {
                "--cell-size": "clamp(2.4rem, calc((100% - 1rem) / 7), 3rem)",
              } as React.CSSProperties
            }
            classNames={{
              root: "w-full",
              weekday: "flex-1",
              day: "flex-1 min-w-0",
            }}
            components={{
              DayButton: ChineseDayButton,
            }}
          />
        </LunarDataContext.Provider>
        )}
        {date && selectedLunarInfo && (
          <DayDetailPanel
            info={selectedLunarInfo}
            date={date}
            notes={selectedDateNotes}
            userEmail={userEmail}
            onNotesChanged={() => setFetchVersion((v) => v + 1)}
          />
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function ChineseDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: React.ComponentProps<typeof DayButtonType>) {
  const defaultClassNames = getDefaultClassNames()
  const { lunarData, markers } = React.useContext(LunarDataContext)

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const isoDate = toISODate(day.date)
  const info = lunarData.get(isoDate)
  const dayMarkers = markers.filter((m) => m.date === isoDate).slice(0, 3)

  const isSelected =
    modifiers.selected &&
    !modifiers.range_start &&
    !modifiers.range_end &&
    !modifiers.range_middle

  // Show displayText in cell only if ≤2 chars (春节、清明、初一…),
  // otherwise fall back to lunarDay (初几)
  const cellText =
    info && info.displayText.length <= 2 ? info.displayText : info?.lunarDay
  const showSpecial = info && info.displayText.length <= 2 && info.displayType !== "normal"

  // Determine lunar text color
  let lunarColorClass = "text-muted-foreground"
  if (showSpecial) {
    if (info.displayType === "jieqi") {
      lunarColorClass = "text-green-600 dark:text-green-400"
    } else if (info.displayType === "lunar-festival" || info.displayType === "solar-festival") {
      lunarColorClass = "text-red-600 dark:text-red-400"
    }
  }
  if (info?.isWorkday) {
    lunarColorClass = "text-orange-600 dark:text-orange-400"
  } else if (info?.isHoliday && !showSpecial) {
    lunarColorClass = "text-red-600 dark:text-red-400"
  }

  // Override colors when selected
  if (isSelected) {
    lunarColorClass = "text-primary-foreground/70"
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={getCalendarDateKey(day.date)}
      data-selected-single={isSelected}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative isolate z-10 flex aspect-auto size-auto h-auto w-full min-w-0 flex-col gap-0 border-0 py-0.5 leading-none font-normal",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground",
        "data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground",
        "data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "dark:hover:text-foreground",
        defaultClassNames.day,
        className
      )}
      {...props}
    >
      {/* Top row: holiday badge + date number */}
      <span className="relative flex w-full items-center justify-center text-[0.8rem]">
        {info?.isHoliday && (
          <span className="absolute -top-0.5 right-0 rounded-sm bg-red-500 px-0.5 text-[0.4rem] leading-[0.7rem] text-white">
            休
          </span>
        )}
        {info?.isWorkday && (
          <span className="absolute -top-0.5 right-0 rounded-sm bg-orange-500 px-0.5 text-[0.4rem] leading-[0.7rem] text-white">
            班
          </span>
        )}
        {children}
      </span>
      {/* Lunar text: ≤2 chars show displayText, otherwise lunarDay */}
      {cellText && (
        <span
          className={cn(
            "text-center text-[0.5rem] leading-[0.6rem]",
            lunarColorClass
          )}
        >
          {cellText}
        </span>
      )}
      {/* Custom markers */}
      {dayMarkers.length > 0 && (
        <span className="flex justify-center gap-0.5">
          {dayMarkers.map((m, i) => (
            <span
              key={i}
              className="size-1 rounded-full"
              style={{ backgroundColor: m.color }}
              title={m.label}
            />
          ))}
        </span>
      )}
    </Button>
  )
}
