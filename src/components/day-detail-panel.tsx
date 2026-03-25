import type { LunarDayInfo } from "@/features/chinese-calendar"

interface DayDetailPanelProps {
  info: LunarDayInfo
  date: Date
}

export function DayDetailPanel({ info, date }: DayDetailPanelProps) {
  const dateStr = date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

  const lunarStr = `农历${info.lunarMonth}月${info.lunarDay}`
  const ganZhi = `${info.ganZhiYear}年 ${info.ganZhiMonth}月 ${info.ganZhiDay}日`

  // Collect festival/节气 tags
  const tags: { text: string; colorClass: string }[] = []
  if (info.jieQi) {
    tags.push({ text: info.jieQi, colorClass: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" })
  }
  if (info.lunarFestival) {
    tags.push({ text: info.lunarFestival, colorClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" })
  }
  if (info.solarFestival) {
    tags.push({ text: info.solarFestival, colorClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" })
  }
  if (info.isHoliday) {
    tags.push({ text: "休", colorClass: "bg-red-500 text-white" })
  }
  if (info.isWorkday) {
    tags.push({ text: "班", colorClass: "bg-orange-500 text-white" })
  }

  return (
    <div className="space-y-1.5 px-3 py-2 text-sm">
      <div>
        <div className="font-medium">{dateStr}</div>
        <div className="text-muted-foreground text-xs">
          {lunarStr} &middot; {ganZhi}
        </div>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag, i) => (
            <span
              key={i}
              className={`rounded px-1.5 py-0.5 text-[0.65rem] leading-none font-medium ${tag.colorClass}`}
            >
              {tag.text}
            </span>
          ))}
        </div>
      )}
      {info.yi.length > 0 && (
        <div className="flex gap-1.5">
          <span className="shrink-0 font-medium text-green-600 dark:text-green-400">
            宜
          </span>
          <span className="text-muted-foreground text-xs leading-5">
            {info.yi.join(" · ")}
          </span>
        </div>
      )}
      {info.ji.length > 0 && (
        <div className="flex gap-1.5">
          <span className="shrink-0 font-medium text-red-600 dark:text-red-400">
            忌
          </span>
          <span className="text-muted-foreground text-xs leading-5">
            {info.ji.join(" · ")}
          </span>
        </div>
      )}
    </div>
  )
}
