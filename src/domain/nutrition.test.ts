import { describe, expect, it } from 'vitest'
import { quickFoods } from './mock-data'
import { calculateMealItem, calculateRecipe, markEstimated } from './nutrition'

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

  it('菜谱按成品重量和实际食用量计算', () => {
    const item = calculateRecipe('鸡肉饭', [{ food: quickFoods[1], quantity: 150, unit: 'g' }, { food: quickFoods[2], quantity: 150, unit: 'g' }], 300, 150)
    expect(item).toMatchObject({ kcal: 211, protein: 25, carbs: 19 })
    expect(item).toMatchObject({ state: '熟重', source: '私人菜谱：成品 300 g', amount: '150 g' })
  })

  it('拒绝空菜谱和无效的成品重量，避免产生误导性快照', () => {
    expect(() => calculateRecipe('空菜谱', [], 300, 150)).toThrow('至少需要一种原料')
    expect(() => calculateRecipe('鸡肉饭', [{ food: quickFoods[1], quantity: 150, unit: 'g' }], 0, 150)).toThrow('必须大于 0')
  })

  it('估算保留范围而非伪装成精确值', () => {
    expect(markEstimated(quickFoods[1], 220, 280)).toMatchObject({ kcal: 250, estimateRange: { minKcal: 220, maxKcal: 280 }, state: '估算' })
  })
})
