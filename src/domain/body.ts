export type BodyEntry = { date: string; weightKg: number }

export const weightRange = { min: 25, max: 350 }
export const heightRange = { min: 80, max: 250 }

export function isValidWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= weightRange.min && value <= weightRange.max
}

export function isValidHeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= heightRange.min && value <= heightRange.max
}

export function isBodyEntry(value: unknown): value is BodyEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date)) && isValidWeight(entry.weightKg)
}

/** 同一天只保留一条体重；写入后按日期升序，便于画曲线和算变化。 */
export function upsertBodyEntry(entries: BodyEntry[], date: string, weightKg: number): BodyEntry[] {
  const next = entries.filter((entry) => entry.date !== date)
  next.push({ date, weightKg: Math.round(weightKg * 10) / 10 })
  return next.sort((a, b) => a.date.localeCompare(b.date))
}

export function latestBodyEntry(entries: BodyEntry[]): BodyEntry | null {
  return entries.length ? entries[entries.length - 1] : null
}

export function entryOn(entries: BodyEntry[], date: string): BodyEntry | null {
  return entries.find((entry) => entry.date === date) ?? null
}

/** 与最早一条记录相比的体重变化；少于两条时没有可比性，返回 null。 */
export function weightChange(entries: BodyEntry[]): number | null {
  if (entries.length < 2) return null
  const first = entries[0].weightKg
  const last = entries[entries.length - 1].weightKg
  return Math.round((last - first) * 10) / 10
}

export type WeightPoint = { date: string; day: string; weight: number }

/** 只取实际称过的点，缺失日不伪造数据，也不按 0 处理。 */
export function weightPoints(entries: BodyEntry[], range: number, endDate: string): WeightPoint[] {
  const end = new Date(`${endDate}T12:00:00`)
  const start = new Date(end)
  start.setDate(end.getDate() - (range - 1))
  return entries
    .filter((entry) => {
      const date = new Date(`${entry.date}T12:00:00`)
      return date >= start && date <= end
    })
    .map((entry) => ({ date: entry.date, day: entry.date.slice(5).replace('-', '/'), weight: entry.weightKg }))
}
