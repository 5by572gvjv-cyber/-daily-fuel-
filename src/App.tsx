import { createContext, lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Cloud, Database, Edit3, ImagePlus, Library, LineChart as LineIcon,
  Laptop, Pencil, Plus, RotateCcw, Search, Settings, Smartphone, Sparkles, Trash2,
  Undo2, Utensils, X,
} from 'lucide-react'
import {
  addItemToMeals, calculateSummary, goals, mealTemplates, quickFoods, removeItemFromMeals,
  type DailyEntry, type DayType, type Meal, type MealItem, type MealType, type Nutrients,
} from './domain/mock-data'
import { navigationItems, type NavigationId } from './config/navigation'
import { createBackup, loadLocalData, parseBackup, restoreBackup, saveDailyRecord, saveFood, saveGoals, type LocalGoals } from './domain/storage'
import { calculateMealItem, calculateRecipe } from './domain/nutrition'
import { createRequestGuard, parseAssistantDraft, type AssistantDraft } from './domain/assistant'

const InsightsPage = lazy(() => import('./components/InsightsPage'))

type ThemeMode = 'system' | 'light' | 'dark'
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
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [demoState, setDemoState] = useState<DemoState>('ready')
  const [entries, setEntries] = useState<DailyEntry[]>([])
  const [foods, setFoods] = useState<MealItem[]>([])
  const [nutritionGoals, setNutritionGoals] = useState<LocalGoals>(() => structuredClone(goals))
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [selectedDate, setSelectedDate] = useState(localDate)
  const [expandedMeals, setExpandedMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner', 'snack'])
  const [toast, setToast] = useState<Toast>(null)
  const [recordInput, setRecordInput] = useState('')
  const [assistantDraft, setAssistantDraft] = useState<AssistantDraft | null>(null)
  const assistantRequestGuard = useRef(createRequestGuard())
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    loadLocalData().then(({ entries: savedEntries, foods: savedFoods, goals: savedGoals }) => { setEntries(savedEntries); setFoods(savedFoods); setNutritionGoals(savedGoals); setIsStorageReady(true) }).catch(() => setToast({ text: '本地数据库无法打开，请检查浏览器存储权限。' }))
  }, [])

  const currentEntry = entries.find((entry) => entry.date === selectedDate) ?? { date: selectedDate, dayType: 'rest' as DayType, completeness: '未记录' as const, meals: [] }
  const summary = useMemo(() => calculateSummary(currentEntry.meals), [currentEntry.meals])
  const goal = nutritionGoals[currentEntry.dayType]

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
    setFoods((previous) => [...previous, food])
    void saveFood(food).then(() => setToast({ text: '食物已保存到本机食物库' })).catch(() => setToast({ text: '食物保存失败。' }))
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
      setToast({ text: '备份已恢复到本机浏览器。' })
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : '备份恢复失败。' })
    }
  }

  const content = !isStorageReady ? <StatePanel icon={<RotateCcw />} title="正在打开本地数据" detail="数据仅保存在这台设备的浏览器中。" />
    : demoState === 'loading' ? <StatePanel icon={<RotateCcw />} title="正在加载界面状态" detail="不会读取或上传任何外部数据。" />
    : demoState === 'error' ? <StatePanel icon={<CircleHelp />} title="模拟加载失败" detail="真实产品会保留草稿并提供重试。本原型未连接服务。" action={() => setDemoState('ready')} actionLabel="重试" />
      : demoState === 'empty' ? <StatePanel icon={<Utensils />} title="这一天还没有记录" detail="未记录不代表未吃。你可以使用下方记录入口补记。" action={() => { setDemoState('ready'); setActivePage('record') }} actionLabel="开始记录" />
        : activePage === 'today' ? <TodayPage entry={currentEntry} summary={summary} goal={goal} onDate={setSelectedDate} onDayType={toggleDayType} expandedMeals={expandedMeals} setExpandedMeals={setExpandedMeals} onRemove={removeItem} onEdit={editItem} onQuick={(item) => addItem(item, '加餐')} onRecord={() => setActivePage('record')} />
          : activePage === 'foods' ? <FoodsPage foods={foods} onAdd={(item) => addItem(item)} onSaveFood={addFood} />
            : activePage === 'record' ? <RecordPage foods={foods} input={recordInput} setInput={setRecordInput} draft={assistantDraft} onParse={createAssistantDraft} onConfirmDraft={confirmAssistantDraft} onDismissDraft={() => setAssistantDraft(null)} manualOpen={manualOpen} setManualOpen={setManualOpen} onAdd={addItem} />
              : activePage === 'history' ? <HistoryPage entries={entries} selectedDate={selectedDate} onDate={(date) => { setSelectedDate(date); setActivePage('today') }} />
                : <Suspense fallback={<StatePanel icon={<RotateCcw />} title="正在加载分析" detail="图表模块按需加载，不会读取外部数据。" />}><InsightsPage entries={entries} /></Suspense>

  return (
    <AssistantInputContext.Provider value={{ input: recordInput, setInput: setRecordInput }}><div className="app-shell" data-theme={theme === 'system' ? undefined : theme}>
      <aside className="sidebar"><Brand /><Navigation active={activePage} onNavigate={setActivePage} /><button className="sidebar-setting" type="button" onClick={() => setIsSettingsOpen(true)}><Settings size={18} />设置</button></aside>
      <main className="main-content">
        <header className="topbar"><Brand compact /><div className="header-actions"><button className="demo-chip" type="button" onClick={() => setDemoState(demoState === 'ready' ? 'loading' : 'ready')}>界面状态</button><button className="icon-button" type="button" aria-label="打开设置" onClick={() => setIsSettingsOpen(true)}><Settings size={19} /></button></div></header>
        <section className="page" aria-labelledby="page-title"><div className="page-heading"><div><p className="eyebrow">{pageMeta[activePage].eyebrow}</p><h1 id="page-title">{pageMeta[activePage].title}</h1></div><StateSwitcher state={demoState} setState={setDemoState} /></div>{content}</section>
      </main>
      <nav className="bottom-nav" aria-label="主导航"><Navigation active={activePage} onNavigate={setActivePage} /></nav>
      {toast && <div className="toast" role="status"><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => { toast.undo?.(); setToast(null) }}><Undo2 size={15} />撤销</button>}<button aria-label="关闭提示" type="button" onClick={() => setToast(null)}><X size={16} /></button></div>}
      {isSettingsOpen && <SettingsModal theme={theme} setTheme={setTheme} goals={nutritionGoals} onGoalChange={updateGoal} onExport={exportData} onImport={importData} onClose={() => setIsSettingsOpen(false)} />}
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

function TodayPage({ entry, summary, goal, onDate, onDayType, expandedMeals, setExpandedMeals, onRemove, onEdit, onQuick, onRecord }: { entry: DailyEntry; summary: Nutrients; goal: Nutrients; onDate: (date: string) => void; onDayType: () => void; expandedMeals: string[]; setExpandedMeals: (value: string[]) => void; onRemove: (id: string) => void; onEdit: (id: string) => void; onQuick: (item: MealItem) => void; onRecord: () => void }) {
  const progress = Math.min(100, Math.round(summary.kcal / goal.kcal * 100))
  return <div className="today-layout"><div className="today-primary"><section className="date-row"><button className="icon-plain" aria-label="前一天" onClick={() => onDate(shiftDate(entry.date, -1))}><ChevronLeft size={20} /></button><button className="date-button" type="button"><CalendarDays size={17} />{formatDate(entry.date)}</button><button className="icon-plain" aria-label="后一天" onClick={() => onDate(shiftDate(entry.date, 1))}><ChevronRight size={20} /></button><button className={`day-type ${entry.dayType}`} type="button" onClick={onDayType}>{entry.dayType === 'training' ? '训练日' : '休息日'}</button></section>
    <section className="energy-card card"><div className="energy-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong className="numeric">{formatNumber(summary.kcal)}</strong><span>/ {formatNumber(goal.kcal)} kcal</span></div></div><div className="energy-copy"><p className="section-label">ENERGY</p><h2>今日能量</h2><p>已完成 <span className="numeric">{progress}%</span> · 还可摄入 <strong className="numeric">{Math.max(0, goal.kcal - summary.kcal)} kcal</strong></p></div></section>
    <section className="macro-grid">{([{ key: 'protein', label: '蛋白质', unit: 'g', color: 'protein' }, { key: 'carbs', label: '碳水', unit: 'g', color: 'carbs' }, { key: 'fat', label: '脂肪', unit: 'g', color: 'fat' }] as const).map(({ key, label, unit, color }) => <article className={`macro-card ${color}`} key={key}><span>{label}</span><strong className="numeric">{summary[key]}<small> / {goal[key]} {unit}</small></strong><div className="meter"><i style={{ width: `${Math.min(100, summary[key] / goal[key] * 100)}%` }} /></div><em>剩余 {Math.max(0, goal[key] - summary[key])} {unit}</em></article>)}</section>
    <RecordComposer onRecord={onRecord} />
    <section className="section-block"><div className="section-header"><div><p className="section-label">MEALS</p><h2>餐食</h2></div><span className="muted">{entry.completeness}</span></div>{entry.meals.map((meal) => <MealCard key={meal.id} meal={meal} expanded={expandedMeals.includes(meal.id)} onToggle={() => setExpandedMeals(expandedMeals.includes(meal.id) ? expandedMeals.filter((id) => id !== meal.id) : [...expandedMeals, meal.id])} onRemove={onRemove} onEdit={onEdit} />)}</section>
  </div><aside className="today-side"><QuickPanel onQuick={onQuick} /></aside></div>
}

function FoodsPage({ foods, onAdd, onSaveFood }: { foods: MealItem[]; onAdd: (item: MealItem) => void; onSaveFood: (item: MealItem) => void }) {
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<'food' | 'recipe' | null>(null)
  const [category, setCategory] = useState<'all' | 'recipes'>('all')
  const list = foods.filter((food) => food.name.includes(query) && (category === 'all' || food.source.startsWith('私人菜谱：')))
  return <div className="library-layout"><div><div className="toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索食物、品牌或别名" /></label><button className="secondary-button" type="button" onClick={() => setEditor(editor === 'recipe' ? null : 'recipe')}><Library size={17} />创建菜谱</button><button className="primary-button" type="button" onClick={() => setEditor(editor === 'food' ? null : 'food')}><Plus size={17} />新增食物</button></div>{editor === 'food' && <FoodEditor onClose={() => setEditor(null)} onSave={onSaveFood} />}{editor === 'recipe' && <RecipeEditor foods={foods} onClose={() => setEditor(null)} onSave={onSaveFood} />}<div className="category-tabs"><button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>本机食物库</button><button className={category === 'recipes' ? 'selected' : ''} onClick={() => setCategory('recipes')}>私人菜谱</button><button disabled>品牌食品</button><button disabled>常用套餐</button></div><div className="food-list">{list.map((food) => <article className="food-row card" key={food.id}><div className="food-glyph"><Utensils size={19} /></div><div><h3>{food.name}</h3><p>{food.amount} · {food.state} · {food.source}</p></div><div className="food-nutrition numeric">{food.kcal}<small> kcal</small><span>P {food.protein}g</span></div><button className="icon-plain" aria-label={`记录${food.name}`} onClick={() => onAdd(food)}><Plus size={19} /></button></article>)}</div></div><aside className="library-detail card"><p className="section-label">LOCAL FOOD</p><h2>{list[0]?.name ?? '未找到食物'}</h2>{list[0] && <><div className="detail-nutrients"><b className="numeric">{list[0].kcal}<small> kcal</small></b><span>蛋白质 {list[0].protein}g</span><span>碳水 {list[0].carbs}g</span><span>脂肪 {list[0].fat}g</span></div><p className="source-note">数据来源：{list[0].source}。食物库和记录均仅保存在本机浏览器。</p><button className="secondary-button"><Pencil size={16} />编辑食物</button></>}</aside></div>
}

function RecordPage({ foods, input, setInput, draft, onParse, onConfirmDraft, onDismissDraft, manualOpen, setManualOpen, onAdd }: { foods: MealItem[]; input: string; setInput: (value: string) => void; draft: AssistantDraft | null; onParse: () => void; onConfirmDraft: () => void; onDismissDraft: () => void; manualOpen: boolean; setManualOpen: (value: boolean) => void; onAdd: (item: MealItem, type?: MealType, note?: string) => void }) {
  const draftTotal = draft?.items.length ? calculateSummary([{ id: 'assistant-preview', type: draft.mealType, time: '现在', items: draft.items }]) : null
  return <div className="record-layout"><section className="record-hero card"><div className="record-heading"><div><p className="section-label">本地饮食助手 · 规则解析</p><h2>用自然语言描述这一餐</h2><p>仅匹配本机已有食物与明确重量；不会调用 AI 或发送数据到外部服务。</p></div><Sparkles className="brand-icon" size={26} /></div><textarea value={input} onChange={(event) => { setInput(event.target.value); onDismissDraft() }} placeholder="例如：午餐 150g 鸡胸肉、150g 米饭" rows={4} /><div className="record-actions"><button className="secondary-button" onClick={() => setManualOpen(!manualOpen)}><Edit3 size={17} />手动记录</button><button className="secondary-button disabled" type="button"><ImagePlus size={17} />图片识别（尚未开放）</button><button className="primary-button" disabled={!input.trim()} onClick={onParse}>解析并确认</button></div></section>{draft?.intent === 'clarify' && <section className="estimate-card card"><div><p className="section-label">需要补充</p><h2>暂时不能安全记录</h2><p>{draft.clarification}</p></div><div className="estimate-actions"><button className="secondary-button" onClick={onDismissDraft}>返回修改</button><button className="primary-button" onClick={() => { onDismissDraft(); setManualOpen(true) }}>改用手动记录</button></div></section>}{draft?.intent === 'add' && draftTotal && <section className="estimate-card card"><div><p className="section-label">本地解析待确认</p><h2>{draft.mealType} · {draft.items.length} 项</h2><p>请核对食物、重量和营养值；确认后才会写入本机浏览器。</p></div>{draft.items.map((item) => <div className="estimate-item" key={item.id}><b>{item.name}</b><span>{item.amount} · {item.kcal} kcal · P {item.protein}g</span></div>)}<div className="estimate-item"><b>合计</b><span className="numeric">{draftTotal.kcal} kcal · P {draftTotal.protein}g · C {draftTotal.carbs}g · F {draftTotal.fat}g</span></div><div className="estimate-actions"><button className="secondary-button" onClick={onDismissDraft}>返回修改</button><button className="primary-button" onClick={onConfirmDraft}>确认并保存</button></div></section>}{manualOpen && <ManualForm foods={foods} onAdd={onAdd} /> }<section className="section-block"><div className="section-header"><div><p className="section-label">QUICK LOG</p><h2>常用</h2></div></div><QuickPanel onQuick={(item) => onAdd(item, '加餐')} /></section></div>
}

function HistoryPage({ entries, selectedDate, onDate }: { entries: DailyEntry[]; selectedDate: string; onDate: (date: string) => void }) {
  const [cursor, setCursor] = useState(() => new Date(`${selectedDate}T12:00:00`))
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, index) => index - firstDay + 1)
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(cursor)
  const entryFor = (date: string) => entries.find((entry) => entry.date === date)
  const summaryRows = entries.filter((entry) => entry.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).sort((a, b) => b.date.localeCompare(a.date))
  return <div className="history-layout"><section className="calendar-card card"><div className="calendar-controls"><button className="icon-plain" aria-label="上个月" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={19} /></button><div><h2>{monthLabel}</h2><button className="text-button" onClick={() => setCursor(new Date(`${localDate()}T12:00:00`))}>返回今天</button></div><button className="icon-plain" aria-label="下个月" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={19} /></button></div><div className="weekday-row">{['日', '一', '二', '三', '四', '五', '六'].map((item) => <span key={item}>{item}</span>)}</div><div className="calendar-grid full-month">{cells.map((day, index) => { if (day < 1 || day > days) return <span key={`empty-${index}`} />; const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const entry = entryFor(date); return <button key={date} className={`${date === selectedDate ? 'selected ' : ''}${entry?.completeness === '完整' ? 'complete' : entry?.completeness === '部分记录' ? 'partial' : ''}`} type="button" aria-label={`${date} ${entry?.completeness ?? '未记录'}`} onClick={() => onDate(date)}><span>{day}</span><i /></button> })}</div><div className="calendar-legend"><span><i className="complete-dot" />已确认完整</span><span><i className="partial-dot" />部分记录</span><span><i className="empty-dot" />未记录</span></div></section><section className="history-list"><div className="section-header"><div><h2>每日汇总</h2><p className="muted">点击日期查看对应餐食</p></div></div>{summaryRows.length ? summaryRows.map((entry) => { const total = calculateSummary(entry.meals); const hasMeals = entry.meals.length > 0; return <button className="history-row card" key={entry.date} type="button" onClick={() => onDate(entry.date)}><div><b>{formatDate(entry.date)}</b><span>{entry.completeness}</span></div><strong className="numeric">{hasMeals ? total.kcal : '—'}<small> kcal</small></strong><em className="history-macros numeric">P {hasMeals ? total.protein : '—'} · C {hasMeals ? total.carbs : '—'} · F {hasMeals ? total.fat : '—'} g</em><ChevronRight size={18} /></button> }) : <StatePanel icon={<CalendarDays />} title="本月还没有本机记录" detail="未记录不代表未吃。" />}</section></div>
}

function QuickPanel({ onQuick }: { onQuick: (item: MealItem) => void }) { return <section className="quick-panel"><div className="section-header"><div><p className="section-label">QUICK ADD</p><h2>常用</h2></div><button className="text-button">管理</button></div><div className="quick-list">{quickFoods.map((item) => <button className="quick-item card" type="button" key={item.id} onClick={() => onQuick(item)}><span className="food-glyph"><Plus size={16} /></span><span><b>{item.name}</b><small>{item.amount} · {item.kcal} kcal</small></span></button>)}</div><div className="template-list">{mealTemplates.map((item) => <button className="template-item" type="button" key={item.id}><Library size={17} /><span><b>{item.name}</b><small>{item.note}</small></span><strong className="numeric">{item.kcal}</strong></button>)}</div></section> }

function MealCard({ meal, expanded, onToggle, onRemove, onEdit }: { meal: Meal; expanded: boolean; onToggle: () => void; onRemove: (id: string) => void; onEdit: (id: string) => void }) { const total = calculateSummary([meal]); return <article className="meal-card card"><button className="meal-title" type="button" onClick={onToggle}><div><span className="meal-dot" /><b>{meal.type}</b><small>{meal.time} · {meal.items.length} 项</small></div><div><strong className="numeric">{total.kcal}<small> kcal</small></strong><ChevronDown className={expanded ? 'rotated' : ''} size={18} /></div></button>{expanded && <div className="meal-items">{meal.items.map((item) => <div className="meal-item" key={item.id}><div><b>{item.name}</b><span>{item.amount} · {item.state} · {item.source}{item.estimateRange ? ` · 范围 ${item.estimateRange.minKcal}–${item.estimateRange.maxKcal} kcal` : ''}</span></div><div className="item-right"><strong className="numeric">{item.kcal}<small> kcal</small></strong><button aria-label={`修改${item.name}`} onClick={() => onEdit(item.id)}><Pencil size={15} /></button><button aria-label={`删除${item.name}`} onClick={() => onRemove(item.id)}><Trash2 size={15} /></button></div></div>)}</div>}</article> }

function RecordComposer({ onRecord }: { onRecord: () => void }) {
  const assistant = useContext(AssistantInputContext)
  if (!assistant) return null
  const shortcuts = ['记录午餐', '补记昨晚', '复制早餐']
  return <section className="assistant-card card"><div className="assistant-title"><div><p className="section-label">饮食助手 <span>模拟</span></p><h2>直接描述你吃了什么</h2></div><Sparkles size={21} /></div><textarea value={assistant.input} onChange={(event) => assistant.setInput(event.target.value)} rows={3} placeholder="例如：午餐吃了鸡胸肉、米饭和一杯美式" /><div className="assistant-footer"><div className="assistant-shortcuts">{shortcuts.map((item) => <button type="button" key={item} onClick={() => assistant.setInput(item)}>{item}</button>)}</div><button className="send-button" type="button" disabled={!assistant.input.trim()} onClick={onRecord}><Sparkles size={16} />发送</button></div><p className="assistant-note">可使用系统键盘听写 · 图片识别尚未开放 · 不调用真实 AI</p></section>
}
function FoodEditor({ onClose, onSave }: { onClose: () => void; onSave: (item: MealItem) => void }) { const [name, setName] = useState(''); return <form className="food-editor card" onSubmit={(event) => { event.preventDefault(); if (name) { onSave({ id: `custom-${crypto.randomUUID()}`, name, amount: '100 g', state: '熟重', source: '用户新增，待补充来源', kcal: 120, protein: 10, carbs: 8, fat: 5 }); onClose() } }}><div className="section-header"><h2>新增食物</h2><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><label>食物名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：自制燕麦杯" /></label><div className="form-grid"><label>重量<input defaultValue="100" type="number" /></label><label>状态<select defaultValue="熟重"><option>熟重</option><option>生重</option></select></label><label>个人单位<select defaultValue="克"><option>克</option><option>毫升</option><option>份</option></select></label></div><button className="primary-button" type="submit">保存到本机食物库</button></form> }
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
  return <section className="food-editor recipe-editor card"><div className="section-header"><div><p className="section-label">PRIVATE RECIPE</p><h2>创建私人菜谱</h2></div><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><p className="source-note">按原料营养合计，按成品重量均匀分配；烹饪损失请通过实际成品重量体现。</p><label>菜谱名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：鸡胸肉饭" /></label><div className="form-grid"><label>原料一<select value={firstFood} onChange={(event) => setFirstFood(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>重量 g<input value={firstGrams} min="0" type="number" onChange={(event) => setFirstGrams(event.target.value)} /></label><label>原料二<select value={secondFood} onChange={(event) => setSecondFood(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label></div><div className="form-grid"><label>重量 g<input value={secondGrams} min="0" type="number" onChange={(event) => setSecondGrams(event.target.value)} /></label><label>成品总重 g<input value={yieldGrams} min="0" type="number" onChange={(event) => setYieldGrams(event.target.value)} /></label><label>本次食用 g<input value={eatenGrams} min="0" type="number" onChange={(event) => setEatenGrams(event.target.value)} /></label></div>{error && <p className="source-note">{error}</p>}<button className="primary-button" type="button" onClick={save}>计算并保存菜谱</button></section>
}
function ManualForm({ foods, onAdd }: { foods: MealItem[]; onAdd: (item: MealItem, type?: MealType, note?: string) => void }) { const [foodId, setFoodId] = useState(foods[0]?.id ?? ''); const [quantity, setQuantity] = useState('100'); const [unit, setUnit] = useState<'g' | 'ml' | '份'>('g'); const [error, setError] = useState(''); const add = () => { const food = foods.find((item) => item.id === foodId); if (!food) return setError('请先选择食物。'); try { onAdd(calculateMealItem(food, { quantity: Number(quantity), unit }), '晚餐', '已按确认的营养基准保存'); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : '无法计算营养。') } }; return <section className="manual-form card"><p className="section-label">MANUAL LOG</p><h2>手动记录</h2><div className="form-grid"><label>食物<select value={foodId} onChange={(event) => setFoodId(event.target.value)}>{foods.map((food) => <option key={food.id} value={food.id}>{food.name}</option>)}</select></label><label>数量<input value={quantity} min="0" type="number" onChange={(event) => setQuantity(event.target.value)} /></label><label>单位<select value={unit} onChange={(event) => setUnit(event.target.value as 'g' | 'ml' | '份')}><option value="g">g</option><option value="ml">ml</option><option value="份">份</option></select></label></div>{error && <p className="source-note">{error}</p>}<button className="primary-button" type="button" onClick={add}>计算并保存记录</button></section> }
function StatePanel({ icon, title, detail, action, actionLabel }: { icon: React.ReactNode; title: string; detail: string; action?: () => void; actionLabel?: string }) { return <div className="state-panel card"><span>{icon}</span><h2>{title}</h2><p>{detail}</p>{action && <button className="primary-button" onClick={action}>{actionLabel}</button>}</div> }
function StateSwitcher({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) { return <div className="state-switcher"><button className={state === 'ready' ? 'selected' : ''} onClick={() => setState('ready')}>数据</button><button className={state === 'empty' ? 'selected' : ''} onClick={() => setState('empty')}>空</button><button className={state === 'error' ? 'selected' : ''} onClick={() => setState('error')}>错误</button></div> }
function SettingsModal({ theme, setTheme, goals: localGoals, onGoalChange, onExport, onImport, onClose }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void; goals: LocalGoals; onGoalChange: (dayType: DayType, key: keyof Nutrients, value: number) => void; onExport: () => Promise<void>; onImport: (file: File) => Promise<void>; onClose: () => void }) { return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-panel settings-full" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">SETTINGS / LOCAL</p><h2 id="settings-title">设置</h2></div><button className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}><X size={19} /></button></div><section className="setting-group"><h3>界面主题</h3><div className="theme-options">{(['system', 'light', 'dark'] as const).map((item) => <button key={item} className={theme === item ? 'is-selected' : ''} onClick={() => setTheme(item)}>{{ system: '跟随系统', light: '浅色', dark: '深色' }[item]}</button>)}</div></section><GoalEditor dayType="training" title="训练日目标" goals={localGoals.training} onChange={onGoalChange} /><GoalEditor dayType="rest" title="休息日目标" goals={localGoals.rest} onChange={onGoalChange} /><section className="setting-group"><h3>本地数据</h3><p className="muted">记录、目标和食物库只保存在这台设备的浏览器中。恢复备份会替换当前本机数据。</p><div className="record-actions"><button className="secondary-button" type="button" onClick={() => void onExport()}><Database size={17} />导出备份</button><label className="secondary-button"><Database size={17} />恢复备份<input hidden type="file" accept="application/json,.json" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void onImport(file); event.currentTarget.value = '' }} /></label></div></section><section className="setting-group link-group"><button><BookOpen size={18} />个人饮食习惯 <ChevronRight size={17} /></button><button><Cloud size={18} />云端同步 <em>尚未开放</em></button><button><Sparkles size={18} />AI 配置 <em>未接入真实服务</em></button></section></section></div> }

function GoalEditor({ dayType, title, goals: localGoals, onChange }: { dayType: DayType; title: string; goals: Nutrients; onChange: (dayType: DayType, key: keyof Nutrients, value: number) => void }) { return <section className="setting-group"><h3>{title} <span>保存到本机</span></h3><div className="goal-grid">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((item) => <label key={item}>{({ kcal: '热量', protein: '蛋白质', carbs: '碳水', fat: '脂肪' })[item]}<input value={localGoals[item]} min="0" type="number" onChange={(event) => onChange(dayType, item, Number(event.target.value))} /><small>{item === 'kcal' ? 'kcal' : 'g'}</small></label>)}</div></section> }
function Navigation({ active, onNavigate }: { active: NavigationId; onNavigate: (item: NavigationId) => void }) { const icons = { today: BarChart3, foods: Utensils, record: Plus, history: CalendarDays, insights: LineIcon }; return <div className="navigation-items">{navigationItems.map((item) => { const Icon = icons[item.id]; return <button className={active === item.id ? 'nav-item is-active' : 'nav-item'} key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></button> })}</div> }
function Brand({ compact = false }: { compact?: boolean }) { return <div className={compact ? 'brand brand--compact' : 'brand'}><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span className="brand-name">DAILY FUEL</span></div> }
export default App
