import { calculateSummary, goals, type DailyEntry, type Nutrients } from './mock-data'

export type InsightMetric = keyof Nutrients
export type TrendPoint = { day: string; date: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; completeness: string }

export const metricMeta: Record<InsightMetric, { label: string; unit: 'kcal' | 'g'; color: string; goal: number }> = {
  kcal: { label: '热量', unit: 'kcal', color: '#4779dc', goal: goals.training.kcal },
  protein: { label: '蛋白质', unit: 'g', color: '#4779dc', goal: goals.training.protein },
  carbs: { label: '碳水', unit: 'g', color: '#d5a04e', goal: goals.training.carbs },
  fat: { label: '脂肪', unit: 'g', color: '#54a58d', goal: goals.training.fat },
}

function toLocalDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function getTrendPoints(entries: DailyEntry[], range: 7 | 14 | 30, endDate = toLocalDate(new Date())): TrendPoint[] {
  const byDate = new Map(entries.map((entry) => [entry.date, entry]))
  const end = new Date(`${endDate}T12:00:00`)
  return Array.from({ length: range }, (_, index) => {
    const date = new Date(end)
    date.setDate(end.getDate() - (range - index - 1))
    const localDate = toLocalDate(date)
    const entry = byDate.get(localDate)
    const nutrients = entry && entry.meals.length ? calculateSummary(entry.meals) : null
    return { date: localDate, day: localDate.slice(5).replace('-', '/'), kcal: nutrients?.kcal ?? null, protein: nutrients?.protein ?? null, carbs: nutrients?.carbs ?? null, fat: nutrients?.fat ?? null, completeness: entry?.completeness ?? '未记录' }
  })
}

export function getKnownAverage(points: TrendPoint[], metric: InsightMetric): number | null {
  const known = points.map((point) => point[metric]).filter((value): value is number => value !== null)
  return known.length ? Math.round(known.reduce((total, value) => total + value, 0) / known.length) : null
}

export function getCompleteness(points: TrendPoint[]): number {
  if (!points.length) return 0
  return Math.round(points.filter((point) => point.kcal !== null).length / points.length * 100)
}
