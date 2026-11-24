import { describe, expect, it } from 'vitest'
import { addItemToMeals, calculateSummary, demoEntries, removeItemFromMeals } from './mock-data'

describe('演示营养汇总', () => {
  it('从同一份餐食明细计算总量', () => {
    expect(calculateSummary(demoEntries[0].meals)).toEqual({ kcal: 1729, protein: 130, carbs: 182, fat: 53 })
  })

  it('删除后可用保留的原始明细撤销', () => {
    const meals = demoEntries[0].meals
    const firstItem = meals[0].items[0]
    const removed = removeItemFromMeals(meals, firstItem.id)
    expect(removed.removed).toEqual(firstItem)
    expect(removed.meals).toHaveLength(meals.length - 1)
    expect(addItemToMeals(removed.meals, removed.removed!, removed.mealType!)).toContainEqual(expect.objectContaining({ type: '早餐' }))
  })
})
