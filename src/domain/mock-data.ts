export type DayType = 'training' | 'rest'
export type MealType = '早餐' | '午餐' | '晚餐' | '加餐'

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number }
export type FoodUnit = 'g' | 'ml' | '份'
export type MealItem = Nutrients & {
  id: string
  name: string
  amount: string
  state: '熟重' | '生重' | '估算'
  source: string
  favorite?: boolean
  basisAmount?: number
  basisUnit?: 'g' | 'ml'
  servingGrams?: number
  densityGPerMl?: number
}
export type Meal = { id: string; type: MealType; time: string; items: MealItem[] }
export type DailyEntry = { date: string; dayType: DayType; completeness: '完整' | '部分记录' | '未记录'; meals: Meal[] }

export const goals: Record<DayType, Nutrients> = {
  training: { kcal: 2200, protein: 155, carbs: 250, fat: 65 },
  rest: { kcal: 1900, protein: 155, carbs: 180, fat: 70 },
}

export const quickFoods: MealItem[] = [
  { id: 'food-yogurt', name: '希腊酸奶', amount: '200 g', state: '熟重', source: '包装标签', kcal: 146, protein: 20, carbs: 9, fat: 3, basisAmount: 200, basisUnit: 'g', servingGrams: 200 },
  { id: 'food-chicken', name: '鸡胸肉', amount: '150 g', state: '熟重', source: 'USDA 基础数据', kcal: 248, protein: 46, carbs: 0, fat: 5, basisAmount: 150, basisUnit: 'g', servingGrams: 150 },
  { id: 'food-rice', name: '米饭', amount: '150 g', state: '熟重', source: '中国食物成分表（演示）', kcal: 174, protein: 4, carbs: 38, fat: 0, basisAmount: 150, basisUnit: 'g', servingGrams: 150 },
]

export const mealTemplates = [
  { id: 'template-1', name: '高蛋白早餐', note: '酸奶、燕麦与蓝莓', kcal: 418 },
  { id: 'template-2', name: '鸡胸能量碗', note: '鸡胸肉、米饭与蔬菜', kcal: 634 },
]

export const demoEntries: DailyEntry[] = [
  {
    date: '2026-11-24', dayType: 'training', completeness: '完整', meals: [
      { id: 'breakfast', type: '早餐', time: '08:15', items: [
        { id: 'b1', name: '希腊酸奶碗', amount: '1 份', state: '熟重', source: '私人菜谱（演示）', kcal: 418, protein: 32, carbs: 46, fat: 11, favorite: true },
      ] },
      { id: 'lunch', type: '午餐', time: '12:40', items: [
        { id: 'l1', name: '鸡胸能量碗', amount: '1 份', state: '熟重', source: '套餐（演示）', kcal: 634, protein: 55, carbs: 72, fat: 14 },
        { id: 'l2', name: '美式咖啡', amount: '350 ml', state: '估算', source: '估算：未加糖', kcal: 8, protein: 0, carbs: 1, fat: 0 },
      ] },
      { id: 'dinner', type: '晚餐', time: '19:10', items: [
        { id: 'd1', name: '三文鱼配时蔬', amount: '1 份', state: '熟重', source: '外卖拆解（演示）', kcal: 562, protein: 42, carbs: 35, fat: 28 },
      ] },
      { id: 'snack', type: '加餐', time: '16:30', items: [
        { id: 's1', name: '香蕉', amount: '120 g', state: '熟重', source: 'USDA 基础数据', kcal: 107, protein: 1, carbs: 28, fat: 0 },
      ] },
    ],
  },
  { date: '2026-11-23', dayType: 'rest', completeness: '完整', meals: [] },
  { date: '2026-11-22', dayType: 'training', completeness: '部分记录', meals: [] },
  { date: '2026-11-21', dayType: 'rest', completeness: '完整', meals: [] },
  { date: '2026-11-20', dayType: 'training', completeness: '部分记录', meals: [] },
  { date: '2026-11-19', dayType: 'rest', completeness: '完整', meals: [] },
  { date: '2026-11-18', dayType: 'training', completeness: '未记录', meals: [] },
]

export function calculateSummary(meals: Meal[]): Nutrients {
  return meals.flatMap((meal) => meal.items).reduce<Nutrients>((total, item) => ({
    kcal: total.kcal + item.kcal,
    protein: total.protein + item.protein,
    carbs: total.carbs + item.carbs,
    fat: total.fat + item.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

export function addItemToMeals(meals: Meal[], item: MealItem, mealType: MealType): Meal[] {
  const existing = meals.find((meal) => meal.type === mealType)
  if (!existing) return [...meals, { id: `meal-${mealType}`, type: mealType, time: '现在', items: [item] }]
  return meals.map((meal) => meal.id === existing.id ? { ...meal, items: [...meal.items, item] } : meal)
}

export function removeItemFromMeals(meals: Meal[], itemId: string): { meals: Meal[]; removed?: MealItem; mealType?: MealType } {
  let removed: MealItem | undefined
  let mealType: MealType | undefined
  const nextMeals = meals.map((meal) => {
    const target = meal.items.find((item) => item.id === itemId)
    if (target) { removed = target; mealType = meal.type }
    return { ...meal, items: meal.items.filter((item) => item.id !== itemId) }
  }).filter((meal) => meal.items.length > 0)
  return { meals: nextMeals, removed, mealType }
}

export const trendData = [
  { day: '11/18', kcal: null, protein: null, carbs: null, fat: null, completeness: '未记录' },
  { day: '11/19', kcal: 1820, protein: 148, carbs: 165, fat: 62, completeness: '完整' },
  { day: '11/20', kcal: 2010, protein: 132, carbs: 221, fat: 66, completeness: '部分记录' },
  { day: '11/21', kcal: 1874, protein: 159, carbs: 176, fat: 69, completeness: '完整' },
  { day: '11/22', kcal: 2140, protein: 144, carbs: 238, fat: 70, completeness: '部分记录' },
  { day: '11/23', kcal: 1788, protein: 151, carbs: 169, fat: 58, completeness: '完整' },
  { day: '11/24', kcal: 1729, protein: 130, carbs: 182, fat: 53, completeness: '完整' },
]
