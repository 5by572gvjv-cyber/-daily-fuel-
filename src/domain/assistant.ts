import type { MealItem, MealType } from './mock-data'
import { calculateMealItem } from './nutrition'

export type AssistantDraft = {
  requestId: string
  intent: 'add' | 'clarify'
  mealType: MealType
  items: MealItem[]
  clarification?: string
  requiresConfirmation: boolean
}

export function parseAssistantDraft(text: string, foods: MealItem[]): AssistantDraft {
  const requestId = crypto.randomUUID()
  const mealType: MealType = /早餐/.test(text) ? '早餐' : /晚餐/.test(text) ? '晚餐' : /加餐/.test(text) ? '加餐' : '午餐'
  const items: MealItem[] = []
  const patterns = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(g|ml|份)?\s*([^、，,和与]+?)(?=(?:、|，|,|和|与|$))/g)]
  for (const match of patterns) {
    const quantity = Number(match[1]); const unit = (match[2] ?? '份') as 'g' | 'ml' | '份'; const query = match[3].trim()
    const food = foods.find((candidate) => query.includes(candidate.name) || candidate.name.includes(query))
    if (!food) continue
    try { items.push(calculateMealItem(food, { quantity, unit })) } catch { return { requestId, intent: 'clarify', mealType, items: [], clarification: `“${food.name}”缺少${unit === 'ml' ? '密度' : '每份重量'}，请改用克数或补充信息。`, requiresConfirmation: true } }
  }
  if (!items.length) return { requestId, intent: 'clarify', mealType, items: [], clarification: '没有找到可确认的食物与数量。请例如输入：午餐 150g 鸡胸肉、150g 米饭。', requiresConfirmation: true }
  return { requestId, intent: 'add', mealType, items, requiresConfirmation: false }
}
