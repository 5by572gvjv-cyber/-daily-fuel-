import type { FoodUnit, MealItem, Nutrients } from './mock-data'

export type QuantityInput = { quantity: number; unit: FoodUnit }
export type RecipeIngredient = { food: MealItem; quantity: number; unit: FoodUnit }

function round(value: number) { return Math.round(value * 10) / 10 }

function basisUnitOf(item: MealItem): FoodUnit {
  return item.basisUnit ?? (item.amount.includes('ml') ? 'ml' : 'g')
}

/** 把「数量 + 单位」换算成克。缺少密度或每份重量时明确报错，不做猜测。 */
export function gramsFor(item: MealItem, quantity: number, unit: FoodUnit): number {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('数量必须大于 0。')
  if (unit === 'g') return quantity
  if (unit === '份') {
    if (!item.servingGrams) throw new Error('该食物没有确认的每份重量，不能按“份”计算。')
    return quantity * item.servingGrams
  }
  if (!item.densityGPerMl && basisUnitOf(item) !== 'ml') throw new Error('该食物没有密度，不能把毫升换算为克。')
  return quantity * (item.densityGPerMl ?? 1)
}

export function calculateMealItem(food: MealItem, input: QuantityInput): MealItem {
  const grams = gramsFor(food, input.quantity, input.unit)
  const basisAmount = food.basisAmount ?? Number.parseFloat(food.amount)
  if (!Number.isFinite(basisAmount) || basisAmount <= 0) throw new Error('该食物缺少可计算的营养基准。')
  const basisGrams = basisUnitOf(food) === 'g' ? basisAmount : basisAmount * (food.densityGPerMl ?? 1)
  const perGram: Nutrients = { kcal: food.kcal / basisGrams, protein: food.protein / basisGrams, carbs: food.carbs / basisGrams, fat: food.fat / basisGrams }
  return { ...food, ...scale(perGram, grams), amount: `${input.quantity} ${input.unit}`, quantity: input.quantity, unit: input.unit, perGram }
}

function scale(perGram: Nutrients, grams: number): Nutrients {
  return { kcal: round(perGram.kcal * grams), protein: round(perGram.protein * grams), carbs: round(perGram.carbs * grams), fat: round(perGram.fat * grams) }
}

/** 读出记录里保存的数量；旧记录没有存数量时退回解析 amount 文本。 */
export function readQuantity(item: MealItem): QuantityInput | null {
  if (typeof item.quantity === 'number' && item.unit && Number.isFinite(item.quantity) && item.quantity > 0) {
    return { quantity: item.quantity, unit: item.unit }
  }
  const matched = /^\s*(\d+(?:\.\d+)?)\s*(g|ml|份)\s*$/.exec(item.amount)
  if (!matched) return null
  const quantity = Number(matched[1])
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  return { quantity, unit: matched[2] as FoodUnit }
}

/**
 * 按新的数量重算一条已写入记录的条目。有每克营养值时直接按克重算，
 * 否则以这条记录当前的数量为基准等比缩放。食物库不受影响。
 */
export function rescaleItem(item: MealItem, quantity: number, unit: FoodUnit): MealItem {
  const current = readQuantity(item)
  if (!current) throw new Error('这条记录缺少可换算的数量，无法按克重算。')
  const grams = gramsFor(item, quantity, unit)
  const perGram = item.perGram ?? derivePerGram(item, gramsFor(item, current.quantity, current.unit))
  return { ...item, ...scale(perGram, grams), amount: `${quantity} ${unit}`, quantity, unit, perGram }
}

function derivePerGram(item: MealItem, grams: number): Nutrients {
  return { kcal: item.kcal / grams, protein: item.protein / grams, carbs: item.carbs / grams, fat: item.fat / grams }
}

export function calculateRecipe(name: string, ingredients: RecipeIngredient[], servingGrams: number, eatenGrams: number): MealItem {
  if (!Number.isFinite(servingGrams) || servingGrams <= 0 || !Number.isFinite(eatenGrams) || eatenGrams <= 0) throw new Error('菜谱成品重量和食用重量必须大于 0。')
  if (!ingredients.length) throw new Error('菜谱至少需要一种原料。')
  const total = ingredients.map(({ food, quantity, unit }) => calculateMealItem(food, { quantity, unit })).reduce<Nutrients>((sum, item) => ({ kcal: sum.kcal + item.kcal, protein: sum.protein + item.protein, carbs: sum.carbs + item.carbs, fat: sum.fat + item.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const perGram: Nutrients = { kcal: total.kcal / servingGrams, protein: total.protein / servingGrams, carbs: total.carbs / servingGrams, fat: total.fat / servingGrams }
  return { id: `recipe-${crypto.randomUUID()}`, name, amount: `${eatenGrams} g`, state: '熟重', source: `私人菜谱：成品 ${servingGrams} g`, ...scale(perGram, eatenGrams), quantity: eatenGrams, unit: 'g', perGram, basisAmount: servingGrams, basisUnit: 'g' }
}

export function markEstimated(item: MealItem, minKcal: number, maxKcal: number): MealItem {
  if (!Number.isFinite(minKcal) || !Number.isFinite(maxKcal) || minKcal < 0 || maxKcal < minKcal) throw new Error('估算范围不正确。')
  const center = (minKcal + maxKcal) / 2
  const factor = item.kcal ? center / item.kcal : 1
  return { ...item, state: '估算', source: `估算：${item.source}`, kcal: round(center), protein: round(item.protein * factor), carbs: round(item.carbs * factor), fat: round(item.fat * factor), estimateRange: { minKcal, maxKcal }, perGram: undefined }
}
