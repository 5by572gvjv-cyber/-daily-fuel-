import { describe, expect, it } from 'vitest'
import { quickFoods } from './mock-data'
import { calculateMealItem } from './nutrition'

describe('重量与单位计算', () => {
  it('按克数从基准营养值等比例计算', () => {
    expect(calculateMealItem(quickFoods[1], { quantity: 300, unit: 'g' })).toMatchObject({ kcal: 496, protein: 92, amount: '300 g' })
  })

  it('没有密度时拒绝把毫升当作克', () => {
    expect(() => calculateMealItem(quickFoods[1], { quantity: 200, unit: 'ml' })).toThrow('没有密度')
  })

  it('没有每份重量时拒绝按份换算', () => {
    const food = { ...quickFoods[1], servingGrams: undefined }
    expect(() => calculateMealItem(food, { quantity: 1, unit: '份' })).toThrow('每份重量')
  })
})
