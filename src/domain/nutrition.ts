import type { FoodUnit, MealItem, Nutrients } from './mock-data'

export type QuantityInput = { quantity: number; unit: FoodUnit }

function round(value: number) { return Math.round(value * 10) / 10 }

export function calculateMealItem(food: MealItem, input: QuantityInput): MealItem {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('数量必须大于 0。')
  const basisAmount = food.basisAmount ?? Number.parseFloat(food.amount)
  const basisUnit = food.basisUnit ?? (food.amount.includes('ml') ? 'ml' : 'g')
  if (!Number.isFinite(basisAmount) || basisAmount <= 0) throw new Error('该食物缺少可计算的营养基准。')

  let grams: number
  if (input.unit === 'g') grams = input.quantity
  else if (input.unit === '份') {
    if (!food.servingGrams) throw new Error('该食物没有确认的每份重量，不能按“份”计算。')
    grams = input.quantity * food.servingGrams
  } else {
    if (!food.densityGPerMl && basisUnit !== 'ml') throw new Error('该食物没有密度，不能把毫升换算为克。')
    grams = input.quantity * (food.densityGPerMl ?? 1)
  }
  const basisGrams = basisUnit === 'g' ? basisAmount : basisAmount * (food.densityGPerMl ?? 1)
  const factor = grams / basisGrams
  const nutrients: Nutrients = { kcal: round(food.kcal * factor), protein: round(food.protein * factor), carbs: round(food.carbs * factor), fat: round(food.fat * factor) }
  return { ...food, ...nutrients, amount: `${input.quantity} ${input.unit}` }
}
