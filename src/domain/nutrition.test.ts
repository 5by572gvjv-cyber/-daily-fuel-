import { describe, expect, it } from 'vitest'
import { quickFoods } from './mock-data'
import { calculateMealItem, calculateRecipe, markEstimated, readQuantity, rescaleItem } from './nutrition'

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

describe('修改已记录条目的克重', () => {
  const chicken = calculateMealItem(quickFoods[1], { quantity: 150, unit: 'g' })

  it('按新的克数从每克营养值重算，而不是乘一个固定系数', () => {
    expect(rescaleItem(chicken, 300, 'g')).toMatchObject({ kcal: 496, protein: 92, amount: '300 g', quantity: 300 })
    expect(rescaleItem(chicken, 100, 'g')).toMatchObject({ kcal: 165.3, protein: 30.7, amount: '100 g' })
  })

  it('反复修改不会累计误差', () => {
    expect(rescaleItem(rescaleItem(rescaleItem(chicken, 200, 'g'), 90, 'g'), 150, 'g')).toMatchObject({ kcal: 248, protein: 46 })
  })

  it('旧记录没存数量时从 amount 文本读回', () => {
    const legacy = { ...quickFoods[2] }
    expect(readQuantity(legacy)).toEqual({ quantity: 150, unit: 'g' })
    expect(rescaleItem(legacy, 200, 'g')).toMatchObject({ kcal: 232 })
  })

  it('数量读不出来时拒绝重算，不猜测', () => {
    const broken = { ...quickFoods[1], amount: '一小碗', quantity: undefined, unit: undefined }
    expect(readQuantity(broken)).toBeNull()
    expect(() => rescaleItem(broken, 200, 'g')).toThrow('缺少可换算的数量')
  })
})
