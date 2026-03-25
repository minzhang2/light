// @ts-expect-error -- lunar-javascript has no type declarations
import { Solar } from "lunar-javascript"
import { getHolidayType } from "./holidays"
import type { LunarDayInfo } from "./types"

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function getLunarDayInfo(date: Date): LunarDayInfo {
  const solar = Solar.fromDate(date)
  const lunar = solar.getLunar()
  const isoDate = toISODate(date)

  const jieQi: string = lunar.getJieQi() || ""
  const lunarFestivals: string[] = lunar.getFestivals()
  const solarFestivals: string[] = solar.getFestivals()
  const lunarFestival = lunarFestivals.length > 0 ? lunarFestivals[0] : ""
  const solarFestival = solarFestivals.length > 0 ? solarFestivals[0] : ""
  const lunarDay = lunar.getDayInChinese()

  // Display text priority: 节气 > 农历节日 > 公历节日 > 普通日期
  let displayText = lunarDay
  let displayType: LunarDayInfo["displayType"] = "normal"

  if (jieQi) {
    displayText = jieQi
    displayType = "jieqi"
  } else if (lunarFestival) {
    displayText = lunarFestival
    displayType = "lunar-festival"
  } else if (solarFestival) {
    displayText = solarFestival
    displayType = "solar-festival"
  }

  const holidayType = getHolidayType(isoDate)

  return {
    lunarDay,
    lunarMonth: lunar.getMonthInChinese(),
    jieQi,
    lunarFestival,
    solarFestival,
    yi: lunar.getDayYi(),
    ji: lunar.getDayJi(),
    ganZhiDay: lunar.getDayInGanZhi(),
    ganZhiMonth: lunar.getMonthInGanZhi(),
    ganZhiYear: lunar.getYearInGanZhi(),
    displayText,
    displayType,
    isHoliday: holidayType === "holiday",
    isWorkday: holidayType === "workday",
  }
}

/**
 * Compute lunar info for all days visible in a month view (~42 days).
 * Returns a Map keyed by ISO date string for O(1) lookup.
 */
export function getLunarMonth(
  year: number,
  month: number // 0-indexed (JS Date convention)
): Map<string, LunarDayInfo> {
  const result = new Map<string, LunarDayInfo>()

  // Start from the first day visible in the calendar grid
  // (could be up to 6 days before the 1st of the month)
  const firstOfMonth = new Date(year, month, 1)
  const startDay = firstOfMonth.getDay() // 0=Sun
  const start = new Date(year, month, 1 - startDay)

  // Always compute 42 days (6 weeks) to cover the full grid
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = toISODate(d)
    result.set(key, getLunarDayInfo(d))
  }

  return result
}
