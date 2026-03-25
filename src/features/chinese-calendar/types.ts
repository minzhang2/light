export interface LunarDayInfo {
  /** 农历日期文本，如"初一"、"十五" */
  lunarDay: string
  /** 农历月份，如"正"、"二" */
  lunarMonth: string
  /** 节气名称，如"清明"、"立春"，无则为空 */
  jieQi: string
  /** 农历节日，如"春节"、"中秋节" */
  lunarFestival: string
  /** 公历节日，如"元旦节"、"国庆节" */
  solarFestival: string
  /** 宜 */
  yi: string[]
  /** 忌 */
  ji: string[]
  /** 干支日期，如"甲子" */
  ganZhiDay: string
  /** 干支月份 */
  ganZhiMonth: string
  /** 干支年份 */
  ganZhiYear: string
  /** 显示文本（优先级：节气 > 农历节日 > 公历节日 > 普通农历日期） */
  displayText: string
  /** 显示类型，决定文字颜色 */
  displayType: "jieqi" | "lunar-festival" | "solar-festival" | "normal"
  /** 是否法定假日（休） */
  isHoliday: boolean
  /** 是否调休工作日（班） */
  isWorkday: boolean
}

export interface DateMarker {
  date: string // ISO date string, e.g. "2025-01-29"
  color: string // tailwind color class or hex
  label?: string
}
