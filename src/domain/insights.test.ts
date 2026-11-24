import { describe, expect, it } from 'vitest'
import { demoEntries } from './mock-data'
import { getCompleteness, getKnownAverage, getTrendPoints } from './insights'

describe('分析数据口径', () => {
  it('缺失日不会参与平均值或被当作零', () => {
    const points = getTrendPoints(demoEntries, 7, '2026-11-24')
    expect(getKnownAverage(points, 'kcal')).toBe(1729)
    expect(getCompleteness(points)).toBe(14)
  })

  it('按需范围提供连续日期序列，但保留缺失值', () => {
    const points = getTrendPoints(demoEntries, 30, '2026-11-24')
    expect(points).toHaveLength(30)
    expect(points.some((point) => point.kcal === null)).toBe(true)
  })
})
