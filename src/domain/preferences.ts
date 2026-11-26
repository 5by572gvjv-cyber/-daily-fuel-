export const themeModes = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof themeModes)[number]

const themeKey = 'daily-fuel-theme'

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/** localStorage 在隐私模式或被禁用时访问即抛错，这里统一降级为「不保存」。 */
export function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function readTheme(storage: StorageLike | undefined): ThemeMode {
  try {
    const stored = storage?.getItem(themeKey)
    return themeModes.includes(stored as ThemeMode) ? (stored as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

export function saveTheme(storage: StorageLike | undefined, theme: ThemeMode): boolean {
  try {
    storage?.setItem(themeKey, theme)
    return Boolean(storage)
  } catch {
    return false
  }
}
