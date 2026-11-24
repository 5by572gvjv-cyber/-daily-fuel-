export const navigationItems = [
  { id: 'today', label: '今日', symbol: '◉' },
  { id: 'foods', label: '食物库', symbol: '◇' },
  { id: 'record', label: '记录', symbol: '＋' },
  { id: 'history', label: '历史', symbol: '◷' },
  { id: 'insights', label: '分析', symbol: '⌁' },
] as const

export type NavigationId = (typeof navigationItems)[number]['id']
