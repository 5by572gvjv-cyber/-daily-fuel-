import Dexie, { type EntityTable } from 'dexie'
import { quickFoods, type DailyEntry, type MealItem } from './mock-data'

export const backupSchemaVersion = 1

type MetaRecord = { key: string; value: string }

class DailyFuelDatabase extends Dexie {
  dailyRecords!: EntityTable<DailyEntry, 'date'>
  foods!: EntityTable<MealItem, 'id'>
  meta!: EntityTable<MetaRecord, 'key'>

  constructor() {
    super('daily-fuel')
    this.version(1).stores({
      dailyRecords: '&date',
      foods: '&id,name',
      meta: '&key',
    })
  }
}

const db = new DailyFuelDatabase()

export type DailyFuelBackup = {
  schemaVersion: typeof backupSchemaVersion
  exportedAt: string
  dailyRecords: DailyEntry[]
  foods: MealItem[]
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
    && isFiniteNonNegative(item.kcal) && isFiniteNonNegative(item.protein)
    && isFiniteNonNegative(item.carbs) && isFiniteNonNegative(item.fat)
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

export function parseBackup(text: string): DailyFuelBackup {
  const raw: unknown = JSON.parse(text)
  if (!raw || typeof raw !== 'object') throw new Error('备份文件不是有效的 JSON 数据。')
  const backup = raw as Partial<DailyFuelBackup>
  if (backup.schemaVersion !== backupSchemaVersion) throw new Error('此备份版本暂不支持恢复。')
  if (!Array.isArray(backup.dailyRecords) || !backup.dailyRecords.every(isDailyEntry)) throw new Error('备份中的饮食记录格式不正确。')
  if (!Array.isArray(backup.foods) || !backup.foods.every(isMealItem)) throw new Error('备份中的食物库格式不正确。')
  return { schemaVersion: backupSchemaVersion, exportedAt: String(backup.exportedAt ?? ''), dailyRecords: backup.dailyRecords, foods: backup.foods }
}

export async function loadLocalData() {
  if (await db.foods.count() === 0) await db.foods.bulkPut(starterFoods)
  return { entries: await db.dailyRecords.toArray(), foods: await db.foods.toArray() }
}

export async function saveDailyRecord(entry: DailyEntry) {
  await db.dailyRecords.put(entry)
}

export async function saveFood(food: MealItem) {
  await db.foods.put(food)
}

export async function createBackup(): Promise<DailyFuelBackup> {
  return {
    schemaVersion: backupSchemaVersion,
    exportedAt: new Date().toISOString(),
    dailyRecords: await db.dailyRecords.toArray(),
    foods: await db.foods.toArray(),
  }
}

export async function restoreBackup(backup: DailyFuelBackup) {
  await db.transaction('rw', db.dailyRecords, db.foods, async () => {
    await db.dailyRecords.clear()
    await db.foods.clear()
    await db.dailyRecords.bulkPut(backup.dailyRecords)
    await db.foods.bulkPut(backup.foods)
  })
  return { entries: backup.dailyRecords, foods: backup.foods }
}
