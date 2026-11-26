import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Cloud, Database, Edit3, ImagePlus, Library, LineChart as LineIcon,
  Laptop, Package, Pencil, Plus, RotateCcw, Search, Settings, Smartphone, Sparkles, Trash2,
  Undo2, Utensils, WifiOff, X,
} from 'lucide-react'
import {
  addItemToMeals, calculateSummary, goals, removeItemFromMeals,
  type DailyEntry, type DayType, type Meal, type MealCombo, type MealItem, type MealType, type Nutrients,
} from './domain/mock-data'
import { navigationItems, type NavigationId } from './config/navigation'
import {
  createBackup, loadLocalData, parseBackup, restoreBackup, saveCombos as persistCombos,
  saveDailyRecord, saveFood, saveGoals, saveQuickFoodIds, type LocalGoals,
} from './domain/storage'
import { calculateMealItem, calculateRecipe } from './domain/nutrition'
import { createRequestGuard, parseAssistantDraft, type AssistantDraft } from './domain/assistant'
import { browserStorage, readTheme, saveTheme, type ThemeMode } from './domain/preferences'

const InsightsPage = lazy(() => import('./components/InsightsPage'))

type DemoState = 'ready' | 'loading' | 'error' | 'empty'
type Toast = { text: string; undo?: () => void } | null
type AssistantInput = { input: string; setInput: (value: string) => void }
const AssistantInputContext = createContext<AssistantInput | null>(null)

const pageMeta: Record<NavigationId, { title: string; eyebrow: string }> = {
  today: { title: '今日', eyebrow: '本机数据' }, foods: { title: '食物库', eyebrow: '本机数据' },
  record: { title: '记录', eyebrow: '本机记录' }, history: { title: '历史', eyebrow: '本机数据' },
  insights: { title: '分析', eyebrow: '本机数据' },
}

const formatDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${iso}T12:00:00`))
const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value)
const localDate = () => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('/', '-')
const shiftDate = (iso: string, offset: number) => { const date = new Date(`${iso}T12:00:00`); date.setDate(date.getDate() + offset); return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).replaceAll('/', '-') }

function App() {
  const isPreviewFrame = new URLSearchParams(window.location.search).has('preview-frame')
  useEffect(() => {
    if (!isPreviewFrame) return
    document.documentElement.dataset.previewFrame = 'true'
    return () => { delete document.documentElement.dataset.previewFrame }
  }, [isPreviewFrame])
  if (import.meta.env.DEV && !isPreviewFrame) return <DevelopmentPreview />
  return <DailyFuelApp />
}

function DailyFuelApp() {
  const [activePage, setActivePage] = useState<NavigationId>('today')
  const [theme, setTheme] = useState<ThemeMode>(() => readTheme(browserStorage()))
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [demoState, setDemoState] = useState<DemoState>('ready')
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [foods, setFoods] = useState<MealItem[]>([])
  const [nutritionGoals, setNutritionGoals] = useState<LocalGoals>(() => structuredClone(goals))
  const [quickFoodIds, setQuickFoodIds] = useState<string[]>([])
  const [combos, setCombos] = useState<MealCombo[]>([])
  const [isQuickManaging, setIsQuickManaging] = useState(false)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDate)
  const [expandedMeals, setExpandedMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner', 'snack'])
  const [toast, setToast] = useState<Toast>(null)
  const [recordInput, setRecordInput] = useState('')
  const [assistantDraft, setAssistantDraft] = useState<AssistantDraft | null>(null)
  const assistantRequestGuard = useRef(createRequestGuard())
  const [manualOpen, setManualOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const updateConnection = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => { window.removeEventListener('online', updateConnection); window.removeEventListener('offline', updateConnection) }
  }, [])

  useEffect(() => {
    loadLocalData().then((saved) => {
      setEntries(saved.entries)
      setFoods(saved.foods)
      setNutritionGoals(saved.goals)
      setQuickFoodIds(saved.quickFoodIds)
      setCombos(saved.combos)
      setIsStorageReady(true)
    }).catch(() => setToast({ text: '本地数据库无法打开，请检查浏览器存储权限。' }))
  }, [])

  // 切页后回到顶部，避免沿用上一页的滚动位置。
  useEffect(() => { window.scrollTo(0, 0) }, [activePage])

  const currentEntry = entries.find((entry) => entry.date === selectedDate) ?? { date: selectedDate, dayType: 'rest' as DayType, completeness: '未记录' as const, meals: [] }
  const summary = useMemo(() => calculateSummary(currentEntry.meals), [currentEntry.meals])
  const goal = nutritionGoals[currentEntry.dayType]
  const quickItems = useMemo(
    () => quickFoodIds.map((id) => foods.find((food) => food.id === id)).filter((food): food is MealItem => Boolean(food)),
    [quickFoodIds, foods],
  )

  function updateCurrent(mutator: (entry: DailyEntry) => DailyEntry) {
    setEntries((previous) => {
      const found = previous.some((entry) => entry.date === selectedDate)
      const changed = mutator(found ? previous.find((entry) => entry.date === selectedDate)! : currentEntry)
      const next = found ? previous.map((entry) => entry.date === selectedDate ? changed : entry) : [...previous, changed]
      void saveDailyRecord(changed).catch(() => setToast({ text: '本地保存失败，记录仍保留在当前页面。' }))
      return next
    })
  }

  function toggleDayType() {
    updateCurrent((entry) => ({ ...entry, dayType: entry.dayType === 'training' ? 'rest' : 'training' }))
  }

  function addItem(item: MealItem, mealType: MealType = '加餐', note = '已保存到本机浏览器') {
    const added = { ...item, id: `${item.id}-${Date.now()}` }
    updateCurrent((entry) => {
      const meals = addItemToMeals(entry.meals, added, mealType)
      return { ...entry, meals, completeness: '完整' }
    })
    setToast({ text: note, undo: () => removeItem(added.id, false) })
  }

  function updateQuickIds(ids: string[]) {
    setQuickFoodIds(ids)
    void saveQuickFoodIds(ids).catch(() => setToast({ text: '常用列表保存失败。' }))
  }

  function updateCombos(next: MealCombo[]) {
    setCombos(next)
    void persistCombos(next).catch(() => setToast({ text: '套餐保存失败。' }))
  }

  function addCombo(combo: MealCombo) {
    const stamp = Date.now()
    const items = combo.items.map((item, index) => ({ ...item, id: `${item.id}-${stamp}-${index}` }))
    updateCurrent((entry) => ({
      ...entry,
      meals: items.reduce((meals, item) => addItemToMeals(meals, item, combo.mealType), entry.meals),
      completeness: '完整',
    }))
    setToast({ text: `已记录套餐「${combo.name}」${items.length} 项，可在记录页修改` })
  }

  function createAssistantDraft() {
    const draft = parseAssistantDraft(recordInput, foods)
    setAssistantDraft(draft)
    setManualOpen(false)
  }

  function confirmAssistantDraft() {
    if (!assistantDraft || assistantDraft.intent !== 'add') return
    if (!assistantRequestGuard.current.claim(assistantDraft.requestId)) { setToast({ text: '这条解析已处理，未重复写入。' }); return }
    const timestamp = Date.now()
    const prepared = assistantDraft.items.map((item, index) => ({ ...item, id: `${item.id}-${timestamp}-${index}` }))
    updateCurrent((entry) => ({ ...entry, meals: prepared.reduce((meals, item) => addItemToMeals(meals, item, assistantDraft.mealType), entry.meals), completeness: '完整' }))
    setToast({ text: `已确认 ${prepared.length} 项并保存到本机浏览器` })
    setAssistantDraft(null)
    setRecordInput('')
  }

  function removeItem(itemId: string, announce = true) {
    const result = removeItemFromMeals(currentEntry.meals, itemId)
    updateCurrent((entry) => ({ ...entry, meals: removeItemFromMeals(entry.meals, itemId).meals }))
    if (announce && result.removed && result.mealType) setToast({ text: '已从本机记录中删除', undo: () => addItem(result.removed!, result.mealType!, '已撤销删除并保存') })
  }

  function editItem(itemId: string) {
    updateCurrent((entry) => ({ ...entry, meals: entry.meals.map((meal) => ({ ...meal, items: meal.items.map((item) => item.id === itemId ? { ...item, amount: item.amount.includes('150') ? item.amount.replace('150', '200') : item.amount, kcal: Math.round(item.kcal * 1.12), protein: Math.round(item.protein * 1.12), carbs: Math.round(item.carbs * 1.12), fat: Math.round(item.fat * 1.12) } : item) })) }))
    setToast({ text: '已修改份量并重新计算汇总' })
  }

  function addFood(food: MealItem) {
    const isEdit = foods.some((item) => item.id === food.id)
    setFoods((previous) => isEdit ? previous.map((item) => item.id === food.id ? food : item) : [...previous, food])
    void saveFood(food).then(() => setToast({ text: isEdit ? '食物已更新，历史记录不受影响' : '食物已保存到本机食物库' })).catch(() => setToast({ text: '食物保存失败。' }))
  }

  function changeTheme(next: ThemeMode) {
    setTheme(next)
    saveTheme(browserStorage(), next)
  }

  function updateGoal(dayType: DayType, key: keyof Nutrients, value: number) {
    if (!Number.isFinite(value) || value < 0) return
    setNutritionGoals((previous) => {
      const next = { ...previous, [dayType]: { ...previous[dayType], [key]: value } }
      void saveGoals(next).catch(() => setToast({ text: '目标保存失败。' }))
      return next
    })
  }

  async function exportData() {
    const backup = await createBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `daily-fuel-backup-${localDate()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setToast({ text: '本地备份已导出。请妥善保存该文件。' })
  }

  async function importData(file: File) {
    try {
      const data = await restoreBackup(parseBackup(await file.text()))
      setEntries(data.entries)
      setFoods(data.foods)
      setNutritionGoals(data.goals)
      setQuickFoodIds(data.quickFoodIds)
      setCombos(data.combos)
      setToast({ text: '备份已恢复到本机浏览器。' })
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : '备份恢复失败。' })
    }
  }

  const content = !isStorageReady ? <StatePanel icon={<RotateCcw />} title="正在打开本地数据" detail="数据仅保存在这台设备的浏览器中。" />
    : demoState === 'loading' ? <StatePanel icon={<RotateCcw />} title="正在加载界面状态" detail="不会读取或上传任何外部数据。" />
    : demoState === 'error' ? <StatePanel icon={<CircleHelp />} title="模拟加载失败" detail="真实产品会保留草稿并提供重试。本原型未连接服务。" action={() => setDemoState('ready')} actionLabel="重试" />
      : demoState === 'empty' ? <StatePanel icon={<Utensils />} title="这一天还没有记录" detail="未记录不代表未吃。你可以使用下方记录入口补记。" action={() => { setDemoState('ready'); setActivePage('record') }} actionLabel="开始记录" />
        : activePage === 'today' ? <TodayPage entry={currentEntry} summary={summary} goal={goal} onDate={setSelectedDate} onDayType={toggleDayType} expandedMeals={expandedMeals} setExpandedMeals={setExpandedMeals} onRemove={removeItem} onEdit={editItem} onQuick={(item) => addItem(item, '加餐')} quickItems={quickItems} combos={combos} onCombo={addCombo} onManageQuick={() => setIsQuickManaging(true)} onRecord={() => setActivePage('record')} />
          : activePage === 'foods' ? <FoodsPage foods={foods} onAdd={(item) => addItem(item)} onSaveFood={addFood} combos={combos} onCombosChange={updateCombos} onCombo={addCombo} />
            : activePage === 'record' ? <RecordPage foods={foods} input={recordInput} setInput={setRecordInput} draft={assistantDraft} onParse={createAssistantDraft} onConfirmDraft={confirmAssistantDraft} onDismissDraft={() => setAssistantDraft(null)} manualOpen={manualOpen} setManualOpen={setManualOpen} onAdd={addItem} quickItems={quickItems} combos={combos} onCombo={addCombo} onManageQuick={() => setIsQuickManaging(true)} />
              : activePage === 'history' ? <HistoryPage entries={entries} today={localDate()} />
                : <Suspense fallback={<StatePanel icon={<RotateCcw />} title="正在加载分析" detail="图表模块按需加载，不会读取外部数据。" />}><InsightsPage entries={entries} /></Suspense>

  return (
    <AssistantInputContext.Provider value={{ input: recordInput, setInput: setRecordInput }}><div className="app-shell" data-theme={theme === 'system' ? undefined : theme}>
      <aside className="sidebar"><Brand /><Navigation active={activePage} onNavigate={setActivePage} /><button className="sidebar-setting" type="button" onClick={() => setIsSettingsOpen(true)}><Settings size={18} />设置</button></aside>
      <main className="main-content">
        <header className="topbar"><Brand compact /><div className="header-actions">{!isOnline && <span className="network-status" role="status"><WifiOff size={14} />离线</span>}<button className="demo-chip" type="button" onClick={() => setDemoState(demoState === 'ready' ? 'loading' : 'ready')}>界面状态</button><button className="icon-button" type="button" aria-label="打开设置" onClick={() => setIsSettingsOpen(true)}><Settings size={19} /></button></div></header>
        <section className="page" aria-labelledby="page-title"><div className="page-heading"><div><p className="eyebrow">{pageMeta[activePage].eyebrow}</p><h1 id="page-title">{pageMeta[activePage].title}</h1></div><StateSwitcher state={demoState} setState={setDemoState} /></div>{!isOnline && <p className="offline-notice" role="status"><WifiOff size={15} />当前离线：记录仍会保存到这台设备。</p>}{content}</section>
      </main>
      <nav className="bottom-nav" aria-label="主导航"><Navigation active={activePage} onNavigate={setActivePage} /></nav>
      {toast && <div className="toast" role="status"><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => { toast.undo?.(); setToast(null) }}><Undo2 size={15} />撤销</button>}<button aria-label="关闭提示" type="button" onClick={() => setToast(null)}><X size={16} /></button></div>}
      {isSettingsOpen && <SettingsModal theme={theme} setTheme={changeTheme} goals={nutritionGoals} onGoalChange={updateGoal} onExport={exportData} onImport={importData} onClose={() => setIsSettingsOpen(false)} />}
      {isQuickManaging && <QuickManager foods={foods} selected={quickFoodIds} onSave={(ids) => { updateQuickIds(ids); setIsQuickManaging(false); setToast({ text: `常用已更新为 ${ids.length} 项` }) }} onClose={() => setIsQuickManaging(false)} />}
    </div></AssistantInputContext.Provider>
  )
}

function DevelopmentPreview() {
  const [device, setDevice] = useState<'desktop' | 'iphone'>('desktop')
  const previewSrc = `${window.location.pathname}?preview-frame=1`

  return <div className="development-preview">
    <header className="preview-toolbar">
      <div><strong>Daily Fuel 开发预览</strong><span>仅本地开发环境显示</span></div>
      <div className="preview-device-switcher" role="group" aria-label="预览设备">
        <button className={device === 'desktop' ? 'selected' : ''} type="button" onClick={() => setDevice('desktop')}><Laptop size={16} />电脑</button>
        <button className={device === 'iphone' ? 'selected' : ''} type="button" onClick={() => setDevice('iphone')}><Smartphone size={16} />iPhone 390 × 844</button>
      </div>
    </header>
    <div className={`preview-stage ${device === 'iphone' ? 'preview-stage--iphone' : ''}`}>
      <iframe key={device} className="preview-frame" title={device === 'iphone' ? 'Daily Fuel iPhone 390 × 844 预览' : 'Daily Fuel 桌面预览'} src={previewSrc} />
    </div>
  </div>
}

function TodayPage({ entry, summary, goal, onDate, onDayType, expandedMeals, setExpandedMeals, onRemove, onEdit, onQuick, quickItems, combos, onCombo, onManageQuick, onRecord }: { entry: DailyEntry; summary: Nutrients; goal: Nutrients; onDate: (date: string) => void; onDayType: () => void; expandedMeals: string[]; setExpandedMeals: (value: string[]) => void; onRemove: (id: string) => void; onEdit: (id: string) => void; onQuick: (item: MealItem) => void; quickItems: MealItem[]; combos: MealCombo[]; onCombo: (combo: MealCombo) => void; onManageQuick: () => void; onRecord: () => void }) {
  const progress = Math.min(100, Math.round(summary.kcal / goal.kcal * 100))
  return <div className="today-layout"><div className="today-primary"><section className="date-row"><button className="icon-plain" aria-label="前一天" onClick={() => onDate(shiftDate(entry.date, -1))}><ChevronLeft size={20} /></button><button className="date-button" type="button"><CalendarDays size={17} />{formatDate(entry.date)}</button><button className="icon-plain" aria-label="后一天" onClick={() => onDate(shiftDate(entry.date, 1))}><ChevronRight size={20} /></button><button className={`day-type ${entry.dayType}`} type="button" onClick={onDayType}>{entry.dayType === 'training' ? '训练日' : '休息日'}</button></section>
    <section className="energy-card card"><div className="energy-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong className="numeric">{formatNumber(summary.kcal)}</strong><span>/ {formatNumber(goal.kcal)} kcal</span></div></div><div className="energy-copy"><p className="section-label">ENERGY</p><h2>今日能量</h2><p>已完成 <span className="numeric">{progress}%</span> · 还可摄入 <strong className="numeric">{Math.max(0, goal.kcal - summary.kcal)} kcal</strong></p></div></section>
    <section className="macro-grid">{([{ key: 'protein', label: '蛋白质', unit: 'g', color: 'protein' }, { key: 'carbs', label: '碳水', unit: 'g', color: 'carbs' }, { key: 'fat', label: '脂肪', unit: 'g', color: 'fat' }] as const).map(({ key, label, unit, color }) => <article className={`macro-card ${color}`} key={key}><span>{label}</span><strong className="numeric">{summary[key]}<small> / {goal[key]} {unit}</small></strong><div className="meter"><i style={{ width: `${Math.min(100, summary[key] / goal[key] * 100)}%` }} /></div><em>剩余 {Math.max(0, goal[key] - summary[key])} {unit}</em></article>)}</section>
    <RecordComposer onRecord={onRecord} />
    <section className="section-block"><div className="section-header"><div><p className="section-label">MEALS</p><h2>餐食</h2></div><span className="muted">{entry.completeness}</span></div>{entry.meals.map((meal) => <MealCard key={meal.id} meal={meal} expanded={expandedMeals.includes(meal.id)} onToggle={() => setExpandedMeals(expandedMeals.includes(meal.id) ? expandedMeals.filter((id) => id !== meal.id) : [...expandedMeals, meal.id])} onRemove={onRemove} onEdit={onEdit} />)}</section>
  </div><aside className="today-side"><QuickPanel quickFoods={quickItems} combos={combos} onQuick={onQuick} onCombo={onCombo} onManage={onManageQuick} /></aside></div>
}

function FoodsPage({ foods, onAdd, onSaveFood, combos, onCombosChange, onCombo }: { foods: MealItem[]; onAdd: (item: MealItem) => void; onSaveFood: (item: MealItem) => void; combos: MealCombo[]; onCombosChange: (combos: MealCombo[]) => void; onCombo: (combo: MealCombo) => void }) {
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<'food' | 'recipe' | 'combo' | null>(null)
  const [editing, setEditing] = useState<MealItem | null>(null)
  const [category, setCategory] = useState<'all' | 'recipes' | 'brand' | 'combos'>('all')
  const name = query.trim()
  const foodList = foods.filter((food) => food.name.includes(name) && (
    category === 'all' ? true
      : category === 'recipes' ? food.source.startsWith('私人菜谱：')
        : category === 'brand' ? Boolean(food.brand?.trim())
          : false
  ))
  const comboList = combos.filter((combo) => combo.name.includes(name))
  const current = foodList[0]
  const tabs: { id: typeof category; label: string }[] = [
    { id: 'all', label: `本机食物库 ${foods.filter((food) => !food.source.startsWith('私人菜谱：') && !food.brand?.trim()).length}` },
    { id: 'recipes', label: '私人菜谱' },
    { id: 'brand', label: '品牌食品' },
    { id: 'combos', label: `常用套餐 ${combos.length}` },
  ]
  return <div className="library-layout"><div>
    <div className="toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索食物、品牌或别名" /></label><button className="secondary-button" type="button" onClick={() => { setEditor(editor === 'recipe' ? null : 'recipe'); setEditing(null) }}><Library size={17} />创建菜谱</button><button className="primary-button" type="button" onClick={() => { setEditor(editor === 'food' ? null : 'food'); setEditing(null) }}><Plus size={17} />新增食物</button></div>
    {editor === 'food' && <FoodEditor initial={editing} onClose={() => { setEditor(null); setEditing(null) }} onSave={onSaveFood} />}
    {editor === 'recipe' && <RecipeEditor foods={foods} onClose={() => setEditor(null)} onSave={onSaveFood} />}
    {editor === 'combo' && <ComboEditor foods={foods} onClose={() => setEditor(null)} onSave={(combo) => { onCombosChange([...combos, combo]); setEditor(null) }} />}
    <div className="category-tabs">{tabs.map((tab) => <button key={tab.id} className={category === tab.id ? 'selected' : ''} onClick={() => { setCategory(tab.id); setEditing(null) }}>{tab.label}</button>)}</div>
    {category === 'combos' ? <>
      <div className="toolbar toolbar--inline"><p className="source-note">把常吃的一组食物存成套餐，点一下就能整餐写入当天记录。</p><button className="primary-button" type="button" onClick={() => setEditor(editor === 'combo' ? null : 'combo')}><Plus size={17} />新建套餐</button></div>
      <div className="food-list">{comboList.map((combo) => <article className="food-row combo-row card" key={combo.id}><div className="food-glyph"><Library size={19} /></div><div><h3>{combo.name}</h3><p>{combo.mealType} · {combo.items.length} 项 · {combo.items.map((item) => item.name).join('、')}</p></div><div className="food-nutrition numeric">{calculateSummary([{ id: combo.id, type: combo.mealType, time: '', items: combo.items }]).kcal}<small>kcal</small></div><button className="icon-plain" aria-label={`记录套餐${combo.name}`} onClick={() => onCombo(combo)}><Plus size={19} /></button><button className="icon-plain" aria-label={`删除套餐${combo.name}`} onClick={() => onCombosChange(combos.filter((item) => item.id !== combo.id))}><Trash2 size={16} /></button></article>)}</div>
      {!comboList.length && <StatePanel icon={<Library />} title={combos.length ? '没有匹配的套餐' : '还没有常用套餐'} detail="新建套餐时可以选择多项食物和各自重量，保存后可一键记录。" />}
    </> : <>
      <div className="food-list">{foodList.map((food) => <article className="food-row card" key={food.id}><div className="food-glyph">{food.brand ? <Package size={19} /> : <Utensils size={19} />}</div><div><h3>{food.name}</h3><p>{food.amount} · {food.state} · {food.brand ? `品牌：${food.brand}` : food.source}</p></div><div className="food-nutrition numeric">{food.kcal}<small> kcal</small><span>P {food.protein}g</span></div><button className="icon-plain" aria-label={`记录${food.name}`} onClick={() => onAdd(food)}><Plus size={19} /></button></article>)}</div>
      {!foodList.length && <StatePanel icon={<Search />} title={category === 'brand' ? '还没有品牌食品' : '没有匹配的食物'} detail={category === 'brand' ? '在「新增食物」里勾选「品牌 / 包装食品」并填写品牌名，就会出现在这里。' : '换个关键词，或新增一种食物。'} />}
    </>
    }
  </div><aside className="library-detail card">{category === 'combos' ? <><p className="section-label">MEAL COMBO</p><h2>常用套餐</h2><p className="source-note">套餐是按食物库当前营养值算出的快照；记录后再改食物库，不会改动已经写进历史的记录。</p><button className="secondary-button" type="button" onClick={() => setEditor('combo')}><Plus size={16} />新建套餐</button></> : <><p className="section-label">LOCAL FOOD</p><h2>{current?.name ?? '未找到食物'}</h2>{current && <><div className="detail-nutrients"><b className="numeric">{current.kcal}<small> kcal</small></b><span>蛋白质 {current.protein}g</span><span>碳水 {current.carbs}g</span><span>脂肪 {current.fat}g</span></div><p className="source-note">数据来源：{current.brand ? `品牌：${current.brand} · ${current.source}` : current.source}。食物库和记录均仅保存在本机浏览器。</p><button className="secondary-button" type="button" onClick={() => { setEditing(current); setEditor('food') }}><Pencil size={16} />编辑食物</button></>}</>}</aside></div>
}

function RecordPage({ foods, input, setInput, draft, onParse, onConfirmDraft, onDismissDraft, manualOpen, setManualOpen, onAdd, quickItems, combos, onCombo, onManageQuick }: { foods: MealItem[]; input: string; setInput: (value: string) => void; draft: AssistantDraft | null; onParse: () => void; onConfirmDraft: () => void; onDismissDraft: () => void; manualOpen: boolean; setManualOpen: (value: boolean) => void; onAdd: (item: MealItem, type?: MealType, note?: string) => void; quickItems: MealItem[]; combos: MealCombo[]; onCombo: (combo: MealCombo) => void; onManageQuick: () => void }) {
  const draftTotal = draft?.items.length ? calculateSummary([{ id: 'assistant-preview', type: draft.mealType, time: '现在', items: draft.items }]) : null
  return <div className="record-layout"><section className="record-hero card"><div className="record-heading"><div><p className="section-label">本地饮食助手 · 规则解析</p><h2>用自然语言描述这一餐</h2><p>仅匹配本机已有食物与明确重量；不会调用 AI 或发送数据到外部服务。</p></div><Sparkles className="brand-icon" size={26} /></div><textarea value={input} onChange={(event) => { setInput(event.target.value); onDismissDraft() }} placeholder="例如：午餐 150g 鸡胸肉、150g 米饭" rows={4} /><div className="record-actions"><button className="secondary-button" onClick={() => setManualOpen(!manualOpen)}><Edit3 size={17} />手动记录</button><button className="secondary-button disabled" type="button"><ImagePlus size={17} />图片识别（尚未开放）</button><button className="primary-button" disabled={!input.trim()} onClick={onParse}>解析并确认</button></div></section>{draft?.intent === 'clarify' && <section className="estimate-card card"><div><p className="section-label">需要补充</p><h2>暂时不能安全记录</h2><p>{draft.clarification}</p></div><div className="estimate-actions"><button className="secondary-button" onClick={onDismissDraft}>返回修改</button><button className="primary-button" onClick={() => { onDismissDraft(); setManualOpen(true) }}>改用手动记录</button></div></section>}{draft?.intent === 'add' && draftTotal && <section className="estimate-card card"><div><p className="section-label">本地解析待确认</p><h2>{draft.mealType} · {draft.items.length} 项</h2><p>请核对食物、重量和营养值；确认后才会写入本机浏览器。</p></div>{draft.items.map((item) => <div className="estimate-item" key={item.id}><b>{item.name}</b><span>{item.amount} · {item.kcal} kcal · P {item.protein}g</span></div>)}<div className="estimate-item"><b>合计</b><span className="numeric">{draftTotal.kcal} kcal · P {draftTotal.protein}g · C {draftTotal.carbs}g · F {draftTotal.fat}g</span></div><div className="estimate-actions"><button className="secondary-button" onClick={onDismissDraft}>返回修改</button><button className="primary-button" onClick={onConfirmDraft}>确认并保存</button></div></section>}{manualOpen && <ManualForm foods={foods} onAdd={onAdd} /> }<section className="section-block"><QuickPanel quickFoods={quickItems} combos={combos} onQuick={(item) => onAdd(item, '加餐')} onCombo={onCombo} onManage={onManageQuick} /></section></div>
}

function HistoryPage({ entries, today }: { entries: DailyEntry[]; today: string }) {
  const [cursor, setCursor] = useState(() => new Date(`${today}T12:00:00`))
  const [detailDate, setDetailDate] = useState(today)
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, index) => index - firstDay + 1)
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(cursor)
  const entryFor = (date: string) => entries.find((entry) => entry.date === date)
  const summaryRows = entries.filter((entry) => entry.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).sort((a, b) => b.date.localeCompare(a.date))
  const detail = entryFor(detailDate)
  const detailMeals = detail?.meals.filter((meal) => meal.items.length > 0) ?? []
  const detailTotal = detail ? calculateSummary(detail.meals) : null
  const detailCount = detailMeals.reduce((count, meal) => count + meal.items.length, 0)
  return <div className="history-layout"><section className="calendar-card card"><div className="calendar-controls"><button className="icon-plain" aria-label="上个月" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={19} /></button><div><h2>{monthLabel}</h2><button className="text-button" onClick={() => { setCursor(new Date(`${today}T12:00:00`)); setDetailDate(today) }}>返回今天</button></div><button className="icon-plain" aria-label="下个月" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={19} /></button></div><div className="weekday-row">{['日', '一', '二', '三', '四', '五', '六'].map((item) => <span key={item}>{item}</span>)}</div><div className="calendar-grid full-month">{cells.map((day, index) => { if (day < 1 || day > days) return <span key={`empty-${index}`} />; const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const entry = entryFor(date); return <button key={date} className={`${date === detailDate ? 'selected ' : ''}${entry?.completeness === '完整' ? 'complete' : entry?.completeness === '部分记录' ? 'partial' : ''}`} type="button" aria-label={`${date} ${entry?.completeness ?? '未记录'}`} onClick={() => setDetailDate(date)}><span>{day}</span><i /></button> })}</div><div className="calendar-legend"><span><i className="complete-dot" />已确认完整</span><span><i className="partial-dot" />部分记录</span><span><i className="empty-dot" />未记录</span></div></section><section className="history-list"><section className="history-detail card"><div className="history-detail-head"><div><p className="section-label">DAY DETAIL</p><h3>{formatDate(detailDate)}</h3></div><span className={`history-badge ${detail?.completeness === '完整' ? 'complete' : detail?.completeness === '部分记录' ? 'partial' : ''}`}>{detail?.completeness ?? '未记录'}</span></div>{detailMeals.length && detailTotal ? <><div className="history-detail-total"><strong className="numeric">{formatNumber(detailTotal.kcal)}<small> kcal</small></strong><em className="numeric">P {detailTotal.protein} · C {detailTotal.carbs} · F {detailTotal.fat} g</em></div><p className="source-note">{detail?.dayType === 'training' ? '训练日' : '休息日'} · {detailCount} 项 · 只在此处查看，不会改动今日记录</p><div className="history-detail-meals">{detailMeals.map((meal) => <div className="history-meal" key={meal.id}><div className="history-meal-head"><b>{meal.type}</b><span className="numeric">{meal.time} · {calculateSummary([meal]).kcal} kcal</span></div>{meal.items.map((item) => <div className="history-meal-item" key={item.id}><span>{item.name} · {item.amount} · {item.state}</span><b className="numeric">{item.kcal} kcal</b></div>)}</div>)}</div></> : <p className="detail-empty">这一天没有记录。未记录不代表未吃。</p>}{detailDate === today && <p className="source-note">这是今天，需要修改请到「今日」或「记录」页。</p>}</section><div className="section-header"><div><h2>每日汇总</h2><p className="muted">点击日期在上方查看当天餐食</p></div></div>{summaryRows.length ? summaryRows.map((entry) => { const total = calculateSummary(entry.meals); const hasMeals = entry.meals.length > 0; return <button className={`history-row card ${entry.date === detailDate ? 'selected' : ''}`} key={entry.date} type="button" onClick={() => setDetailDate(entry.date)}><div><b>{formatDate(entry.date)}</b><span>{entry.completeness}</span></div><strong className="numeric">{hasMeals ? total.kcal : '—'}<small> kcal</small></strong><em className="history-macros numeric">P {hasMeals ? total.protein : '—'} · C {hasMeals ? total.carbs : '—'} · F {hasMeals ? total.fat : '—'} g</em><ChevronRight size={18} /></button> }) : <StatePanel icon={<CalendarDays />} title="本月还没有本机记录" detail="未记录不代表未吃。" />}</section></div>
}

function QuickPanel({ quickFoods, combos, onQuick, onCombo, onManage }: { quickFoods: MealItem[]; combos: MealCombo[]; onQuick: (item: MealItem) => void; onCombo: (combo: MealCombo) => void; onManage: () => void }) {
  return <section className="quick-panel">
    <div className="section-header"><div><p className="section-label">QUICK ADD</p><h2>常用</h2></div><button className="text-button" type="button" onClick={onManage}>管理</button></div>
    {quickFoods.length
      ? <div className="quick-list">{quickFoods.map((item) => <button className="quick-item card" type="button" key={item.id} onClick={() => onQuick(item)}><span className="food-glyph"><Plus size={16} /></span><span><b>{item.name}</b><small>{item.amount} · {item.kcal} kcal</small></span></button>)}</div>
      : <p className="quick-empty">还没有常用食物。点右上角「管理」，从食物库挑几个常吃的。</p>}
    <div className="template-list">
      {combos.map((combo) => <button className="template-item" type="button" key={combo.id} onClick={() => onCombo(combo)}><Library size={17} /><span><b>{combo.name}</b><small>{combo.mealType} · {combo.items.length} 项 · {calculateSummary([{ id: combo.id, type: combo.mealType, time: '现在', items: combo.items }]).kcal} kcal</small></span><Plus size={15} /></button>)}
      {!combos.length && <p className="quick-empty">还没有常用套餐。到食物库「常用套餐」新建一组，就能一次记完整餐。</p>}
    </div>
  </section>
}

function MealCard({ meal, expanded, onToggle, onRemove, onEdit }: { meal: Meal; expanded: boolean; onToggle: () => void; onRemove: (id: string) => void; onEdit: (id: string) => void }) { const total = calculateSummary([meal]); return <article className="meal-card card"><button className="meal-title" type="button" onClick={onToggle}><div><span className="meal-dot" /><b>{meal.type}</b><small>{meal.time} · {meal.items.length} 项</small></div><div><strong className="numeric">{total.kcal}<small> kcal</small></strong><ChevronDown className={expanded ? 'rotated' : ''} size={18} /></div></button>{expanded && <div className="meal-items">{meal.items.map((item) => <div className="meal-item" key={item.id}><div><b>{item.name}</b><span>{item.amount} · {item.state} · {item.source}{item.estimateRange ? ` · 范围 ${item.estimateRange.minKcal}–${item.estimateRange.maxKcal} kcal` : ''}</span></div><div className="item-right"><strong className="numeric">{item.kcal}<small> kcal</small></strong><button aria-label={`修改${item.name}`} onClick={() => onEdit(item.id)}><Pencil size={15} /></button><button aria-label={`删除${item.name}`} onClick={() => onRemove(item.id)}><Trash2 size={15} /></button></div></div>)}</div>}</article> }

function RecordComposer({ onRecord }: { onRecord: () => void }) {
  const assistant = useContext(AssistantInputContext)
  if (!assistant) return null
  const shortcuts = ['记录午餐', '补记昨晚', '复制早餐']
  return <section className="assistant-card card"><div className="assistant-title"><div><p className="section-label">饮食助手 <span>模拟</span></p><h2>直接描述你吃了什么</h2></div><Sparkles size={21} /></div><textarea value={assistant.input} onChange={(event) => assistant.setInput(event.target.value)} rows={3} placeholder="例如：午餐吃了鸡胸肉、米饭和一杯美式" /><div className="assistant-footer"><div className="assistant-shortcuts">{shortcuts.map((item) => <button type="button" key={item} onClick={() => assistant.setInput(item)}>{item}</button>)}</div><button className="send-button" type="button" disabled={!assistant.input.trim()} onClick={onRecord}><Sparkles size={16} />发送</button></div><p className="assistant-note">可使用系统键盘听写 · 图片识别尚未开放 · 不调用真实 AI</p></section>
}
function FoodEditor({ initial, onClose, onSave }: { initial?: MealItem | null; onClose: () => void; onSave: (item: MealItem) => void }) {
  const initialBasis = initial ? (initial.basisAmount ?? Number.parseFloat(initial.amount)) : 100
  const [name, setName] = useState(initial?.name ?? '')
  const [basisAmount, setBasisAmount] = useState(String(Number.isFinite(initialBasis) && initialBasis > 0 ? initialBasis : 100))
  const [state, setState] = useState<'熟重' | '生重'>(initial?.state === '生重' ? '生重' : '熟重')
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '')
  const [protein, setProtein] = useState(initial ? String(initial.protein) : '')
  const [carbs, setCarbs] = useState(initial ? String(initial.carbs) : '')
  const [fat, setFat] = useState(initial ? String(initial.fat) : '')
  const [isBrand, setIsBrand] = useState(Boolean(initial?.brand?.trim()))
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [error, setError] = useState('')
  function submit() {
    if (!name.trim()) return setError('请填写食物名称。')
    const basis = Number(basisAmount)
    if (!Number.isFinite(basis) || basis <= 0) return setError('营养基准重量必须大于 0。')
    const values = [kcal, protein, carbs, fat].map((value) => Number(value))
    if (values.some((value) => !Number.isFinite(value) || value < 0)) return setError('请按包装标签或可靠来源填写四项营养值，未知数据不要填 0。')
    const brandName = isBrand ? brand.trim() : ''
    if (isBrand && !brandName) return setError('请填写品牌名，或取消「品牌 / 包装食品」。')
    const [energy, proteinValue, carbsValue, fatValue] = values
    onSave({
      id: initial?.id ?? `custom-${crypto.randomUUID()}`,
      name: name.trim(),
      amount: `${basis} g`,
      state,
      source: isBrand ? '包装标签' : (initial?.source ?? '用户新增，待补充来源'),
      brand: brandName || undefined,
      kcal: energy, protein: proteinValue, carbs: carbsValue, fat: fatValue,
      basisAmount: basis, basisUnit: 'g', servingGrams: basis,
    })
    onClose()
  }
  return <form className="food-editor card" onSubmit={(event) => { event.preventDefault(); submit() }}><div className="section-header"><div><p className="section-label">{initial ? 'EDIT FOOD' : 'NEW FOOD'}</p><h2>{initial ? '编辑食物' : '新增食物'}</h2></div><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><label>食物名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：自制燕麦杯" /></label><div className="form-grid"><label>营养基准 g<input value={basisAmount} min="1" step="any" type="number" onChange={(event) => setBasisAmount(event.target.value)} /></label><label>状态<select value={state} onChange={(event) => setState(event.target.value as '熟重' | '生重')}><option value="熟重">熟重</option><option value="生重">生重</option></select></label><label>热量 kcal<input value={kcal} min="0" step="any" type="number" onChange={(event) => setKcal(event.target.value)} placeholder="每基准" /></label></div><div className="form-grid"><label>蛋白质 g<input value={protein} min="0" step="any" type="number" placeholder="如 31" onChange={(event) => setProtein(event.target.value)} /></label><label>碳水 g<input value={carbs} min="0" step="any" type="number" placeholder="如 0" onChange={(event) => setCarbs(event.target.value)} /></label><label>脂肪 g<input value={fat} min="0" step="any" type="number" placeholder="如 4" onChange={(event) => setFat(event.target.value)} /></label></div><label className="switch-row"><input checked={isBrand} type="checkbox" onChange={(event) => setIsBrand(event.target.checked)} /><span>品牌 / 包装食品</span></label>{isBrand && <label>品牌名<input value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="例如：星巴克、Oatly" /></label>}<p className="source-note">营养值按上面的基准重量填写；保存后可在记录与套餐里按克换算。</p>{error && <p className="source-note form-error">{error}</p>}<button className="primary-button" type="submit">{initial ? '保存修改' : '保存到本机食物库'}</button></form>
}

function RecipeEditor({ foods, onClose, onSave }: { foods: MealItem[]; onClose: () => void; onSave: (item: MealItem) => void }) {
  const [name, setName] = useState('')
  const [firstFood, setFirstFood] = useState(foods[0]?.id ?? '')
  const [secondFood, setSecondFood] = useState(foods[1]?.id ?? foods[0]?.id ?? '')
  const [firstGrams, setFirstGrams] = useState('150')
  const [secondGrams, setSecondGrams] = useState('150')
  const [yieldGrams, setYieldGrams] = useState('300')
  const [eatenGrams, setEatenGrams] = useState('150')
  const [error, setError] = useState('')
  const save = () => {
    const first = foods.find((food) => food.id === firstFood)
    const second = foods.find((food) => food.id === secondFood)
    if (!name.trim() || !first || !second) return setError('请填写菜谱名称并选择两种原料。')
    try {
      onSave(calculateRecipe(name.trim(), [{ food: first, quantity: Number(firstGrams), unit: 'g' }, { food: second, quantity: Number(secondGrams), unit: 'g' }], Number(yieldGrams), Number(eatenGrams)))
      onClose()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '菜谱无法计算。') }
  }
  return <section className="food-editor recipe-editor card"><div className="section-header"><div><p className="section-label">PRIVATE RECIPE</p><h2>创建私人菜谱</h2></div><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><p className="source-note">按原料营养合计，按成品重量均匀分配；烹饪损失请通过实际成品重量体现。</p><label>菜谱名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：鸡胸肉饭" /></label><div className="form-grid"><label>原料一<select value={firstFood} onChange={(event) => setFirstFood(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>重量 g<input value={firstGrams} min="0" step="any" type="number" onChange={(event) => setFirstGrams(event.target.value)} /></label><label>原料二<select value={secondFood} onChange={(event) => setSecondFood(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label></div><div className="form-grid"><label>重量 g<input value={secondGrams} min="0" step="any" type="number" onChange={(event) => setSecondGrams(event.target.value)} /></label><label>成品总重 g<input value={yieldGrams} min="0" step="any" type="number" onChange={(event) => setYieldGrams(event.target.value)} /></label><label>本次食用 g<input value={eatenGrams} min="0" step="any" type="number" onChange={(event) => setEatenGrams(event.target.value)} /></label></div>{error && <p className="source-note">{error}</p>}<button className="primary-button" type="button" onClick={save}>计算并保存菜谱</button></section>
}
function ComboEditor({ foods, onClose, onSave }: { foods: MealItem[]; onClose: () => void; onSave: (combo: MealCombo) => void }) {
  const [name, setName] = useState('')
  const [mealType, setMealType] = useState<MealType>('午餐')
  const [rows, setRows] = useState<{ foodId: string; grams: string }[]>(() => {
    if (!foods.length) return []
    const first = foods[0].id
    const second = foods[1]?.id ?? first
    return foods.length > 1 ? [{ foodId: first, grams: '150' }, { foodId: second, grams: '150' }] : [{ foodId: first, grams: '150' }]
  })
  const [error, setError] = useState('')
  function buildItems(): MealItem[] {
    return rows.map((row) => {
      const food = foods.find((item) => item.id === row.foodId)
      if (!food) throw new Error('请为每一行选择食物。')
      return calculateMealItem(food, { quantity: Number(row.grams), unit: 'g' })
    })
  }
  let preview: Nutrients | null = null
  try { const items = buildItems(); preview = items.length ? calculateSummary([{ id: 'combo-preview', type: mealType, time: '', items }]) : null } catch { preview = null }
  function save() {
    if (!name.trim()) return setError('请填写套餐名称。')
    if (!rows.length) return setError('至少需要一种食物。')
    try { onSave({ id: `combo-${crypto.randomUUID()}`, name: name.trim(), mealType, items: buildItems() }) } catch (reason) { setError(reason instanceof Error ? reason.message : '套餐无法保存。') }
  }
  return <section className="food-editor recipe-editor card"><div className="section-header"><div><p className="section-label">MEAL COMBO</p><h2>新建常用套餐</h2></div><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><p className="source-note">按食物库当前营养值生成快照，记录后改动食物库不会影响已写入的记录。</p><label>套餐名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：工作日午餐" /></label><div className="form-grid"><label>记到哪一餐<select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)}>{(['早餐', '午餐', '晚餐', '加餐'] as const).map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>{rows.map((row, index) => <div className="form-grid" key={`${row.foodId}-${index}`}><label>食物<select value={row.foodId} onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, foodId: event.target.value } : item))}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>重量 g<input value={row.grams} min="0" step="any" type="number" onChange={(event) => setRows(rows.map((item, position) => position === index ? { ...item, grams: event.target.value } : item))} /></label><label className="align-end"><button className="secondary-button" type="button" onClick={() => setRows(rows.filter((_, position) => position !== index))}>移除</button></label></div>)}<div className="record-actions"><button className="secondary-button" type="button" onClick={() => setRows([...rows, { foodId: foods[0]?.id ?? '', grams: '100' }])} disabled={!foods.length}><Plus size={16} />添加食物</button>{preview && <span className="combo-total numeric">合计 {preview.kcal} kcal · P {preview.protein} · C {preview.carbs} · F {preview.fat} g</span>}</div>{error && <p className="source-note form-error">{error}</p>}<button className="primary-button" type="button" onClick={save}>保存套餐</button></section>
}

function QuickManager({ foods, selected, onSave, onClose }: { foods: MealItem[]; selected: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<string[]>(selected)
  const limit = 12
  function toggle(id: string) {
    setDraft((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : previous.length >= limit ? previous : [...previous, id])
  }
  return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-panel manager-panel" role="dialog" aria-modal="true" aria-labelledby="quick-title" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">QUICK ADD / LOCAL</p><h2 id="quick-title">管理常用食物</h2></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}><X size={19} /></button></div><p className="source-note">勾选要出现在「常用」里的食物，最多 {limit} 项，顺序按勾选先后。只影响快捷入口，不会改动任何记录。</p><div className="manager-list">{foods.map((food) => { const checked = draft.includes(food.id); const full = !checked && draft.length >= limit; return <button className={`manager-row ${checked ? 'is-checked' : ''}`} key={food.id} type="button" disabled={full} aria-pressed={checked} onClick={() => toggle(food.id)}><span className="manager-check">{checked ? '✓' : ''}</span><span><b>{food.name}</b><small>{food.amount} · {food.kcal} kcal · {food.brand ? `品牌：${food.brand}` : food.source}</small></span></button> })}</div><div className="record-actions"><button className="secondary-button" type="button" onClick={() => setDraft([])}>全部取消</button><button className="primary-button" type="button" onClick={() => onSave(draft)}>保存常用（{draft.length}）</button></div></section></div>
}

function ManualForm({ foods, onAdd }: { foods: MealItem[]; onAdd: (item: MealItem, type?: MealType, note?: string) => void }) { const [foodId, setFoodId] = useState(foods[0]?.id ?? ''); const [quantity, setQuantity] = useState('100'); const [unit, setUnit] = useState<'g' | 'ml' | '份'>('g'); const [error, setError] = useState(''); const add = () => { const food = foods.find((item) => item.id === foodId); if (!food) return setError('请先选择食物。'); try { onAdd(calculateMealItem(food, { quantity: Number(quantity), unit }), '晚餐', '已按确认的营养基准保存'); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '无法计算营养。') } }; return <section className="manual-form card"><p className="section-label">MANUAL LOG</p><h2>手动记录</h2><div className="form-grid"><label>食物<select value={foodId} onChange={(event) => setFoodId(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>数量<input value={quantity} min="0" step="any" type="number" onChange={(event) => setQuantity(event.target.value)} /></label><label>单位<select value={unit} onChange={(event) => setUnit(event.target.value as 'g' | 'ml' | '份')}><option value="g">g</option><option value="ml">ml</option><option value="份">份</option></select></label></div>{error && <p className="source-note">{error}</p>}<button className="primary-button" type="button" onClick={add}>计算并保存记录</button></section> }
function StatePanel({ icon, title, detail, action, actionLabel }: { icon: React.ReactNode; title: string; detail: string; action?: () => void; actionLabel?: string }) { return <div className="state-panel card"><span>{icon}</span><h2>{title}</h2><p>{detail}</p>{action && <button className="primary-button" onClick={action}>{actionLabel}</button>}</div> }
function StateSwitcher({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) { return <div className="state-switcher"><button className={state === 'ready' ? 'selected' : ''} onClick={() => setState('ready')}>数据</button><button className={state === 'empty' ? 'selected' : ''} onClick={() => setState('empty')}>空</button><button className={state === 'error' ? 'selected' : ''} onClick={() => setState('error')}>错误</button></div> }
function SettingsModal({ theme, setTheme, goals: localGoals, onGoalChange, onExport, onImport, onClose }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void; goals: LocalGoals; onGoalChange: (dayType: DayType, key: keyof Nutrients, value: number) => void; onExport: () => Promise<void>; onImport: (file: File) => Promise<void>; onClose: () => void }) { return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-panel settings-full" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">SETTINGS / LOCAL</p><h2 id="settings-title">设置</h2></div><button className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}><X size={19} /></button></div><section className="setting-group"><h3>界面主题</h3><div className="theme-options">{(['system', 'light', 'dark'] as const).map((item) => <button key={item} className={theme === item ? 'is-selected' : ''} onClick={() => setTheme(item)}>{{ system: '跟随系统', light: '浅色', dark: '深色' }[item]}</button>)}</div></section><GoalEditor dayType="training" title="训练日目标" goals={localGoals.training} onChange={onGoalChange} /><GoalEditor dayType="rest" title="休息日目标" goals={localGoals.rest} onChange={onGoalChange} /><section className="setting-group"><h3>本地数据</h3><p className="muted">记录、目标和食物库只保存在这台设备的浏览器中。恢复备份会替换当前本机数据。</p><div className="record-actions"><button className="secondary-button" type="button" onClick={() => void onExport()}><Database size={17} />导出备份</button><label className="secondary-button"><Database size={17} />恢复备份<input hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void onImport(file); event.currentTarget.value = '' }} /></label></div></section><section className="setting-group link-group"><button><BookOpen size={18} />个人饮食习惯 <ChevronRight size={17} /></button><button><Cloud size={18} />云端同步 <em>尚未开放</em></button><button><Sparkles size={18} />AI 配置 <em>未接入真实服务</em></button></section></section></div> }

function GoalEditor({ dayType, title, goals: localGoals, onChange }: { dayType: DayType; title: string; goals: Nutrients; onChange: (dayType: DayType, key: keyof Nutrients, value: number) => void }) { return <section className="setting-group"><h3>{title} <span>保存到本机</span></h3><div className="goal-grid">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((item) => <label key={item}>{({ kcal: '热量', protein: '蛋白质', carbs: '碳水', fat: '脂肪' })[item]}<input value={localGoals[item]} min="0" step="any" type="number" onChange={(event) => onChange(dayType, item, Number(event.target.value))} /><small>{item === 'kcal' ? 'kcal' : 'g'}</small></label>)}</div></section> }
function Navigation({ active, onNavigate }: { active: NavigationId; onNavigate: (item: NavigationId) => void }) { const icons = { today: BarChart3, foods: Utensils, record: Plus, history: CalendarDays, insights: LineIcon }; return <div className="navigation-items">{navigationItems.map((item) => { const Icon = icons[item.id]; return <button className={active === item.id ? 'nav-item is-active' : 'nav-item'} key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></button> })}</div> }
function Brand({ compact = false }: { compact?: boolean }) { return <div className={compact ? 'brand brand--compact' : 'brand'}><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span className="brand-name">DAILY FUEL</span></div> }
export default App
