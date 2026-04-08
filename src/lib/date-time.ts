export const APP_LOCALE = "zh-CN"
export const APP_TIME_ZONE = "Asia/Shanghai"

const DAY_IN_MS = 24 * 60 * 60 * 1000

function toDate(value: Date | number | string) {
  return value instanceof Date ? value : new Date(value)
}

function toUtcDateFromLocalParts(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}

function getTimeZoneDateParts(value: Date | number | string, timeZone = APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(value))

  const getPart = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  }
}

export function formatInAppTimeZone(
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions,
  locale = APP_LOCALE,
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value))
}

export function formatCalendarMonthLabel(date: Date, locale = APP_LOCALE) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "UTC",
  }).format(toUtcDateFromLocalParts(date))
}

export function getCalendarDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export function getTimeZoneDayIndex(
  value: Date | number | string,
  timeZone = APP_TIME_ZONE,
) {
  const { year, month, day } = getTimeZoneDateParts(value, timeZone)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_IN_MS)
}
