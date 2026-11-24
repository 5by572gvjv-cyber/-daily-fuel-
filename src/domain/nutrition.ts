import type { FoodUnit, MealItem, Nutrients } from './mock-data'

export type QuantityInput = { quantity: number; unit: FoodUnit }
export type RecipeIngredient = { food: MealItem; quantity: number; unit: FoodUnit }

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

export function calculateRecipe(name: string, ingredients: RecipeIngredient[], servingGrams: number, eatenGrams: number): MealItem {
  if (!Number.isFinite(servingGrams) || servingGrams <= 0 || !Number.isFinite(eatenGrams) || eatenGrams <= 0) throw new Error('菜谱成品重量和食用重量必须大于 0。')
  if (!ingredients.length) throw new Error('菜谱至少需要一种原料。')
  const total = ingredients.map(({ food, quantity, unit }) => calculateMealItem(food, { quantity, unit })).reduce<Nutrients>((sum, item) => ({ kcal: sum.kcal + item.kcal, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const factor = eatenGrams / servingGrams
  return { id: `recipe-${crypto.randomUUID()}`, name, amount: `${eatenGrams} g`, state: '熟重', source: `私人菜谱：成品 ${servingGrams} g`, kcal: round(total.kcal * factor), protein: round(total.protein * factor), carbs: round(total.carbs * factor), fat: round(total.fat * factor), basisAmount: servingGrams, basisUnit: 'g' }
}

export function markEstimated(item: MealItem, minKcal: number, maxKcal: number): MealItem {
  if (!Number.isFinite(minKcal) || !Number.isFinite(maxKcal) || minKcal < 0 || maxKcal < minKcal) throw new Error('估算范围不正确。')
  const center = (minKcal + maxKcal) / 2
  const factor = item.kcal ? center / item.kcal : 1
  return { ...item, state: '估算', source: `估算：${item.source}`, kcal: round(center), protein: round(item.protein * factor), carbs: round(item.carbs * factor), fat: round(item.fat * factor), estimateRange: { minKcal, maxKcal } }
}
