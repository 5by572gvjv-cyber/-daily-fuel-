import { goals, trendData, type Nutrients } from './mock-data'

export type InsightMetric = keyof Nutrients
export type TrendPoint = { day: string; date: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; completeness: string }

export const metricMeta: Record<InsightMetric, { label: string; unit: 'kcal' | 'g'; color: string; goal: number }> = {
  kcal: { label: '热量', unit: 'kcal', color: '#4779dc', goal: goals.training.kcal },
  protein: { label: '蛋白质', unit: 'g', color: '#4779dc', goal: goals.training.protein },
  carbs: { label: '碳水', unit: 'g', color: '#d5a04e', goal: goals.training.carbs },
  fat: { label: '脂肪', unit: 'g', color: '#54a58d', goal: goals.training.fat },
}

const makeDate = (day: number) => `2026-11-${String(day).padStart(2, '0')}`

const extendedTrend: TrendPoint[] = Array.from({ length: 30 }, (_, index) => {
  const day = 24 - (29 - index)
  const date = day > 0 ? makeDate(day) : `2026-10-${String(31 + day).padStart(2, '0')}`
  const matching = trendData.find((point) => point.day === date.slice(5).replace('-', '/'))
  if (matching) return { ...matching, date }
  const isMissing = index % 7 === 1 || index % 11 === 0
  const offset = (index % 5) * 22
  return { date, day: date.slice(5).replace('-', '/'), kcal: isMissing ? null : 1840 + offset, protein: isMissing ? null : 138 + (index % 4) * 5, carbs: isMissing ? null : 175 + (index % 6) * 9, fat: isMissing ? null : 59 + (index % 4) * 3, completeness: isMissing ? '未记录' : index % 4 === 0 ? '部分记录' : '完整' }
})

export function getTrendPoints(range: 7 | 14 | 30): TrendPoint[] {
  return extendedTrend.slice(-range)
}

export function getKnownAverage(points: TrendPoint[], metric: InsightMetric): number | null {
  const known = points.map((point) => point[metric]).filter((value): value is number => value !== null)
  return known.length ? Math.round(known.reduce((total, value) => total + value, 0) / known.length) : null
}

export function getCompleteness(points: TrendPoint[]): number {
  if (!points.length) return 0
  return Math.round(points.filter((point) => point.kcal !== null).length / points.length * 100)
}
