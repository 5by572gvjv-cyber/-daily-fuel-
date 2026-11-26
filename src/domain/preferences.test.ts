import { describe, expect, it } from 'vitest'
import { readTheme, saveTheme } from './preferences'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    dump: () => Object.fromEntries(data),
  }
}

describe('主题偏好', () => {
  it('未保存或值不合法时回落到跟随系统', () => {
    expect(readTheme(memoryStorage())).toBe('system')
    expect(readTheme(memoryStorage({ 'daily-fuel-theme': 'neon' }))).toBe('system')
    expect(readTheme(undefined)).toBe('system')
  })

  it('读取已保存的深浅主题', () => {
    expect(readTheme(memoryStorage({ 'daily-fuel-theme': 'dark' }))).toBe('dark')
    expect(readTheme(memoryStorage({ 'daily-fuel-theme': 'light' }))).toBe('light')
  })

  it('保存后可原样读回，且不与其他键冲突', () => {
    const storage = memoryStorage({ 'other-key': 'keep' })
    expect(saveTheme(storage, 'dark')).toBe(true)
    expect(storage.dump()).toEqual({ 'other-key': 'keep', 'daily-fuel-theme': 'dark' })
    expect(readTheme(storage)).toBe('dark')
  })

  it('存储不可用时不抛出，仅表示未保存', () => {
    const throwing = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    }
    expect(readTheme(throwing)).toBe('system')
    expect(saveTheme(throwing, 'dark')).toBe(false)
    expect(saveTheme(undefined, 'dark')).toBe(false)
  })
})
