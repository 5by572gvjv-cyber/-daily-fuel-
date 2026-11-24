import { describe, expect, it } from 'vitest'
import { quickFoods } from './mock-data'
import { createRequestGuard, parseAssistantDraft } from './assistant'

describe('本地饮食助手解析', () => {
  it('只解析已知食物及明确数量', () => {
    const draft = parseAssistantDraft('午餐 150g 鸡胸肉、150g 米饭', quickFoods)
    expect(draft).toMatchObject({ intent: 'add', mealType: '午餐', requiresConfirmation: false })
    expect(draft.items).toHaveLength(2)
  })
  it('未知食物不会写入记录', () => {
    expect(parseAssistantDraft('午餐一碗拉面', quickFoods)).toMatchObject({ intent: 'clarify', items: [] })
  })
  it('混入未知食物时不会只写入已知部分', () => {
    expect(parseAssistantDraft('午餐 150g 鸡胸肉、200g 拉面', quickFoods)).toMatchObject({ intent: 'clarify', items: [] })
  })
  it('同一请求只能确认一次', () => {
    const guard = createRequestGuard()
    expect(guard.claim('request-1')).toBe(true)
    expect(guard.claim('request-1')).toBe(false)
  })
})
