import { describe, expect, it } from 'vitest'
import { addItemToMeals, calculateSummary, demoEntries, removeItemFromMeals, replaceItemInMeals } from './mock-data'

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

describe('修改单条记录', () => {
  const meals = demoEntries[0].meals

  it('同一餐次内原地替换，条目数不变', () => {
    const target = meals[1].items[1]
    const next = replaceItemInMeals(meals, { ...target, kcal: 20 }, '午餐')
    expect(next.flatMap((meal) => meal.items)).toHaveLength(meals.flatMap((meal) => meal.items).length)
    expect(next[1].items[1].kcal).toBe(20)
  })

  it('换餐次时从原餐次移出并写入目标餐次', () => {
    const moved = { ...meals[0].items[0], kcal: 400 }
    const next = replaceItemInMeals(meals, moved, '晚餐')
    expect(next.some((meal) => meal.type === '早餐')).toBe(false)
    expect(next.find((meal) => meal.type === '晚餐')?.items).toContainEqual(moved)
    expect(calculateSummary(next).kcal).toBe(calculateSummary(meals).kcal - 418 + 400)
  })

  it('找不到原条目时原样返回，不误写', () => {
    expect(replaceItemInMeals(meals, { ...meals[0].items[0], id: 'ghost' }, '午餐')).toBe(meals)
  })
})
