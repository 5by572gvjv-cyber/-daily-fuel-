import { describe, expect, it } from 'vitest'
import { navigationItems } from './navigation'

describe('主导航骨架', () => {
  it('保留四个入口及顺序，记录入口已并入今日', () => {
    expect(navigationItems.map((item) => item.label)).toEqual(['今日', '食物库', '历史', '分析'])
  })
})
