import { describe, expect, it } from 'vitest'
import { backupSchemaVersion, parseBackup } from './storage'

const validBackup = JSON.stringify({
  schemaVersion: backupSchemaVersion,
  exportedAt: '2026-11-24T00:00:00.000Z',
  dailyRecords: [{ date: '2026-11-24', dayType: 'training', completeness: '完整', meals: [] }],
  foods: [{ id: 'food-1', name: '鸡胸肉', amount: '100 g', state: '熟重', source: '包装标签', kcal: 165, protein: 31, carbs: 0, fat: 4 }],
})

describe('本地备份校验', () => {
  it('仅接受当前版本且结构完整的备份', () => {
    expect(parseBackup(validBackup).foods).toHaveLength(1)
  })

  it('拒绝不支持的版本和不安全的营养数据', () => {
    expect(() => parseBackup(validBackup.replace(`"schemaVersion":${backupSchemaVersion}`, '"schemaVersion":99'))).toThrow('暂不支持')
    expect(() => parseBackup(validBackup.replace('"kcal":165', '"kcal":-1'))).toThrow('格式不正确')
  })
})
