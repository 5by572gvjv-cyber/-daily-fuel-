import { describe, expect, it } from 'vitest'
import { navigationItems } from './navigation'

describe('主导航骨架', () => {
  it('保留产品规定的五个入口及顺序', () => {
    expect(navigationItems.map((item) => item.label)).toEqual(['今日', '食物库', '记录', '历史', '分析'])
  })
})
