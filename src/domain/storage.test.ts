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

describe('常用与套餐的备份兼容', () => {
  const legacy = JSON.stringify({
    schemaVersion: 2,
    exportedAt: '2026-11-20T00:00:00.000Z',
    dailyRecords: [],
    foods: [
      { id: 'food-yogurt', name: '希腊酸奶', amount: '200 g', state: '熟重', source: '包装标签', kcal: 146, protein: 20, carbs: 9, fat: 3, basisAmount: 200, basisUnit: 'g' },
      { id: 'food-chicken', name: '鸡胸肉', amount: '150 g', state: '熟重', source: 'USDA 基础数据', kcal: 248, protein: 46, carbs: 0, fat: 5, basisAmount: 150, basisUnit: 'g' },
    ],
  })

  it('旧版备份按内置常用补齐，套餐为空', () => {
    const parsed = parseBackup(legacy)
    expect(parsed.quickFoodIds).toEqual(['food-yogurt', 'food-chicken'])
    expect(parsed.combos).toEqual([])
  })

  it('保留品牌字段并跟随新版本保存常用与套餐', () => {
    const brandFood = { id: 'brand-1', name: '高蛋白酸奶', amount: '100 g', state: '熟重', source: '包装标签', brand: '示例品牌', kcal: 90, protein: 12, carbs: 5, fat: 2 }
    const combo = { id: 'combo-1', name: '工作日午餐', mealType: '午餐', items: [brandFood] }
    const parsed = parseBackup(JSON.stringify({
      schemaVersion: backupSchemaVersion,
      exportedAt: '2026-11-26T00:00:00.000Z',
      dailyRecords: [],
      foods: [brandFood],
      quickFoodIds: ['brand-1'],
      combos: [combo],
    }))
    expect(parsed.foods[0].brand).toBe('示例品牌')
    expect(parsed.quickFoodIds).toEqual(['brand-1'])
    expect(parsed.combos).toHaveLength(1)
  })

  it('丢弃结构不完整的套餐，不影响其余数据', () => {
    const parsed = parseBackup(JSON.stringify({
      schemaVersion: backupSchemaVersion,
      exportedAt: '2026-11-26T00:00:00.000Z',
      dailyRecords: [],
      foods: [],
      quickFoodIds: [],
      combos: [{ id: 'combo-bad', name: '缺项套餐', mealType: '午餐', items: [] }],
    }))
    expect(parsed.combos).toEqual([])
  })
})

describe('常用与套餐的备份兼容', () => {
  const legacy = JSON.stringify({
    schemaVersion: 2,
    exportedAt: '2026-11-20T00:00:00.000Z',
    dailyRecords: [],
    foods: [
      { id: 'food-yogurt', name: '希腊酸奶', amount: '200 g', state: '熟重', source: '包装标签', kcal: 146, protein: 20, carbs: 9, fat: 3, basisAmount: 200, basisUnit: 'g' },
      { id: 'food-chicken', name: '鸡胸肉', amount: '150 g', state: '熟重', source: 'USDA 基础数据', kcal: 248, protein: 46, carbs: 0, fat: 5, basisAmount: 150, basisUnit: 'g' },
    ],
  })

  it('旧版备份按内置常用补齐，套餐为空', () => {
    const parsed = parseBackup(legacy)
    expect(parsed.quickFoodIds).toEqual(['food-yogurt', 'food-chicken'])
    expect(parsed.combos).toEqual([])
  })

  it('保留品牌字段并跟随新版本保存常用与套餐', () => {
    const brandFood = { id: 'brand-1', name: '高蛋白酸奶', amount: '100 g', state: '熟重', source: '包装标签', brand: '示例品牌', kcal: 90, protein: 12, carbs: 5, fat: 2 }
    const combo = { id: 'combo-1', name: '工作日午餐', mealType: '午餐', items: [brandFood] }
    const parsed = parseBackup(JSON.stringify({
      schemaVersion: backupSchemaVersion,
      exportedAt: '2026-11-26T00:00:00.000Z',
      dailyRecords: [],
      foods: [brandFood],
      quickFoodIds: ['brand-1'],
      combos: [combo],
    }))
    expect(parsed.foods[0].brand).toBe('示例品牌')
    expect(parsed.quickFoodIds).toEqual(['brand-1'])
    expect(parsed.combos).toHaveLength(1)
  })

  it('丢弃结构不完整的套餐，不影响其余数据', () => {
    const parsed = parseBackup(JSON.stringify({
      schemaVersion: backupSchemaVersion,
      exportedAt: '2026-11-26T00:00:00.000Z',
      dailyRecords: [],
      foods: [],
      quickFoodIds: [],
      combos: [{ id: 'combo-bad', name: '缺项套餐', mealType: '午餐', items: [] }],
    }))
    expect(parsed.combos).toEqual([])
  })
})
