import Dexie, { type EntityTable } from 'dexie'
import { goals, quickFoods, type DailyEntry, type DayType, type MealCombo, type MealItem, type Nutrients } from './mock-data'
import { isBodyEntry, isValidHeight, type BodyEntry } from './body'

export const backupSchemaVersion = 4
export type LocalGoals = Record<DayType, Nutrients>

type MetaRecord = { key: string; value: string }

class DailyFuelDatabase extends Dexie {
  dailyRecords!: EntityTable<DailyEntry, 'date'>
  foods!: EntityTable<MealItem, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>
  bodyMetrics!: EntityTable<BodyEntry, 'date'>

  constructor() {
    super('daily-fuel')
    this.version(1).stores({
      dailyRecords: '&date',
      foods: '&id,name',
      meta: '&key',
    })
    // 体重按日期一条；身高是单个值，存在 meta 里。
    this.version(2).stores({ bodyMetrics: '&date' })
  }
}

const db = new DailyFuelDatabase()

export type DailyFuelBackup = {
  schemaVersion: typeof backupSchemaVersion
  exportedAt: string
  dailyRecords: DailyEntry[]
  foods: MealItem[]
  goals: LocalGoals
  /** 今日页「常用」里显示的食物 id，按顺序排列。 */
  quickFoodIds: string[]
  /** 用户自建的常用套餐。 */
  combos: MealCombo[]
  /** 按日期的体重记录。 */
  bodyMetrics: BodyEntry[]
  /** 身高（厘米），未填写时为 null。 */
  heightCm: number | null
}

const starterFoods: MealItem[] = quickFoods.map((food) => ({ ...food }))

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isMealItem(value: unknown): value is MealItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && typeof item.name === 'string' && typeof item.amount === 'string'
    && typeof item.source === 'string' && ['熟重', '生重', '估算'].includes(String(item.state))
    && (item.brand === undefined || typeof item.brand === 'string')
    && isFiniteNonNegative(item.kcal) && isFiniteNonNegative(item.protein)
    && isFiniteNonNegative(item.carbs) && isFiniteNonNegative(item.fat)
}

function isMealCombo(value: unknown): value is MealCombo {
  if (!value || typeof value !== 'object') return false
  const combo = value as Record<string, unknown>
  return typeof combo.id === 'string' && typeof combo.name === 'string'
    && ['早餐', '午餐', '晚餐', '加餐'].includes(String(combo.mealType))
    && Array.isArray(combo.items) && combo.items.length > 0 && combo.items.every(isMealItem)
}

function isDailyEntry(value: unknown): value is DailyEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return /^\d{4}-\d{2}-\d{2}$/.test(String(entry.date))
    && ['training', 'rest'].includes(String(entry.dayType))
    && ['完整', '部分记录', '未记录'].includes(String(entry.completeness))
    && Array.isArray(entry.meals)
    && entry.meals.every((meal) => meal && typeof meal === 'object' && Array.isArray((meal as { items?: unknown }).items) && (meal as { items: unknown[] }).items.every(isMealItem))
}

/** 初始常用：优先保留内置的三种食物，用户删掉后再退化为食物库前三个。 */
export function defaultQuickFoodIds(foods: MealItem[]): string[] {
  const starter = foods.filter((food) => quickFoods.some((item) => item.id === food.id)).map((food) => food.id)
  return starter.length ? starter : foods.slice(0, 3).map((food) => food.id)
}

export function parseBackup(text: string): DailyFuelBackup {
  const raw: unknown = JSON.parse(text)
  if (!raw || typeof raw !== 'object') throw new Error('备份文件不是有效的 JSON 数据。')
  const backup = raw as Partial<DailyFuelBackup>
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  // v1/v2 没有常用与套餐字段，按旧默认值补齐；v3 起完整保存。
  if (version !== 1 && version !== 2 && version !== 3 && version !== backupSchemaVersion) throw new Error('此备份版本暂不支持恢复。')
  if (!Array.isArray(backup.dailyRecords) || !backup.dailyRecords.every(isDailyEntry)) throw new Error('备份中的饮食记录格式不正确。')
  if (!Array.isArray(backup.foods) || !backup.foods.every(isMealItem)) throw new Error('备份中的食物库格式不正确。')
  const parsedGoals = backup.goals as LocalGoals | undefined
  const validGoals = parsedGoals && ['training', 'rest'].every((day) => ['kcal', 'protein', 'carbs', 'fat'].every((key) => isFiniteNonNegative(parsedGoals[day as DayType][key as keyof Nutrients])))
  const parsedQuickIds = Array.isArray(backup.quickFoodIds) ? backup.quickFoodIds.filter((id): id is string => typeof id === 'string') : null
  const parsedCombos = Array.isArray(backup.combos) ? backup.combos.filter(isMealCombo) : []
  const parsedBody = Array.isArray(backup.bodyMetrics) ? backup.bodyMetrics.filter(isBodyEntry) : []
  const parsedHeight = isValidHeight(backup.heightCm) ? backup.heightCm : null
  return {
    schemaVersion: backupSchemaVersion,
    exportedAt: String(backup.exportedAt ?? ''),
    dailyRecords: backup.dailyRecords,
    foods: backup.foods,
    goals: validGoals ? parsedGoals : structuredClone(goals),
    quickFoodIds: parsedQuickIds ?? defaultQuickFoodIds(backup.foods),
    combos: parsedCombos,
    bodyMetrics: parsedBody,
    heightCm: parsedHeight,
  }
}

async function readMeta<T>(key: string, fallback: T): Promise<T> {
  const record = await db.meta.get(key)
  if (!record) return fallback
  try { return JSON.parse(record.value) as T } catch { return fallback }
}

export async function loadLocalData() {
  if (await db.foods.count() === 0) await db.foods.bulkPut(starterFoods)
  const foods = await db.foods.toArray()
  const localGoals = await readMeta<LocalGoals>('nutrition-goals', structuredClone(goals))
  const quickFoodIds = await readMeta<string[] | null>('quick-food-ids', null)
  const combos = await readMeta<MealCombo[]>('meal-combos', [])
  const profile = await readMeta<{ heightCm: number | null }>('body-profile', { heightCm: null })
  return {
    entries: await db.dailyRecords.toArray(),
    foods,
    goals: localGoals,
    quickFoodIds: quickFoodIds ?? defaultQuickFoodIds(foods),
    combos: combos.filter(isMealCombo),
    bodyMetrics: (await db.bodyMetrics.toArray()).filter(isBodyEntry).sort((a, b) => a.date.localeCompare(b.date)),
    heightCm: isValidHeight(profile.heightCm) ? profile.heightCm : null,
  }
}

export async function saveGoals(localGoals: LocalGoals) { await db.meta.put({ key: 'nutrition-goals', value: JSON.stringify(localGoals) }) }

export async function saveQuickFoodIds(ids: string[]) { await db.meta.put({ key: 'quick-food-ids', value: JSON.stringify(ids) }) }

export async function saveCombos(combos: MealCombo[]) { await db.meta.put({ key: 'meal-combos', value: JSON.stringify(combos) }) }

export async function saveBodyEntry(entry: BodyEntry) { await db.bodyMetrics.put(entry) }

export async function saveHeight(heightCm: number | null) { await db.meta.put({ key: 'body-profile', value: JSON.stringify({ heightCm }) }) }

export async function saveDailyRecord(entry: DailyEntry) {
  await db.dailyRecords.put(entry)
}

export async function saveFood(food: MealItem) {
  await db.foods.put(food)
}

export async function createBackup(): Promise<DailyFuelBackup> {
  const local = await loadLocalData()
  return {
    schemaVersion: backupSchemaVersion,
    exportedAt: new Date().toISOString(),
    dailyRecords: await db.dailyRecords.toArray(),
    foods: await db.foods.toArray(),
    goals: local.goals,
    quickFoodIds: local.quickFoodIds,
    combos: local.combos,
    bodyMetrics: local.bodyMetrics,
    heightCm: local.heightCm,
  }
}

export async function restoreBackup(backup: DailyFuelBackup) {
  await db.transaction('rw', db.dailyRecords, db.foods, db.meta, db.bodyMetrics, async () => {
    await db.dailyRecords.clear()
    await db.foods.clear()
    await db.bodyMetrics.clear()
    await db.dailyRecords.bulkPut(backup.dailyRecords)
    await db.foods.bulkPut(backup.foods)
    await db.bodyMetrics.bulkPut(backup.bodyMetrics)
    await saveGoals(backup.goals)
    await saveQuickFoodIds(backup.quickFoodIds)
    await saveCombos(backup.combos)
    await saveHeight(backup.heightCm)
  })
  return { entries: backup.dailyRecords, foods: backup.foods, goals: backup.goals, quickFoodIds: backup.quickFoodIds, combos: backup.combos, bodyMetrics: backup.bodyMetrics, heightCm: backup.heightCm }
}
