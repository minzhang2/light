import { useMemo } from "react"
import { getLunarMonth } from "./lunar-utils"
import type { LunarDayInfo } from "./types"

/**
 * Caches lunar data for the currently displayed month.
 * Only recomputes when year/month changes.
 */
export function useLunarMonth(
  displayMonth: Date
): Map<string, LunarDayInfo> {
  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()

  return useMemo(() => getLunarMonth(year, month), [year, month])
}
