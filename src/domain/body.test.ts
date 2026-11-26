import { describe, expect, it } from 'vitest'
import { entryOn, isBodyEntry, isValidHeight, isValidWeight, latestBodyEntry, upsertBodyEntry, weightChange, weightPoints } from './body'

describe('体重与身高数据', () => {
  it('同一天只保留一条体重，并按日期排序', () => {
    const entries = upsertBodyEntry([{ date: '2026-11-20', weightKg: 73 }, { date: '2026-11-18', weightKg: 73.6 }], '2026-11-20', 72.44)
    expect(entries.map((entry) => entry.date)).toEqual(['2026-11-18', '2026-11-20'])
    expect(entries[1].weightKg).toBe(72.4)
  })

  it('最新一条与首次变化按一位小数计算', () => {
    const entries = upsertBodyEntry(upsertBodyEntry([], '2026-11-18', 73.6), '2026-11-22', 72.4)
    expect(latestBodyEntry(entries)).toMatchObject({ date: '2026-11-22', weightKg: 72.4 })
    expect(weightChange(entries)).toBe(-1.2)
    expect(weightChange([{ date: '2026-11-18', weightKg: 73 }])).toBeNull()
  })

  it('只取区间内实际称过的点，缺失日不补 0', () => {
    const entries = [{ date: '2026-11-10', weightKg: 74 }, { date: '2026-11-22', weightKg: 72.4 }, { date: '2026-11-24', weightKg: 72.1 }]
    const points = weightPoints(entries, 7, '2026-11-24')
    expect(points.map((point) => point.day)).toEqual(['11/22', '11/24'])
    expect(points.every((point) => point.weight > 0)).toBe(true)
  })

  it('拒绝明显不合理的身高体重，避免写入垃圾数据', () => {
    expect(isValidWeight(0)).toBe(false)
    expect(isValidWeight(500)).toBe(false)
    expect(isValidHeight(178)).toBe(true)
    expect(isValidHeight(20)).toBe(false)
    expect(isBodyEntry({ date: '2026-11-24' })).toBe(false)
    expect(entryOn([{ date: '2026-11-24', weightKg: 72 }], '2026-11-24')?.weightKg).toBe(72)
  })
})
