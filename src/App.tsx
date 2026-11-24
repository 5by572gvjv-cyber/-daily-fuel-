import { createContext, lazy, Suspense, useContext, useMemo, useState } from 'react'
import {
  BarChart3, BookOpen, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  CircleHelp, Cloud, Database, Edit3, ImagePlus, Library, LineChart as LineIcon,
  Laptop, Pencil, Plus, RotateCcw, Search, Settings, Smartphone, Sparkles, Trash2,
  Undo2, Utensils, X,
} from 'lucide-react'
import {
  addItemToMeals, calculateSummary, demoEntries, goals, mealTemplates, quickFoods, removeItemFromMeals,
  type DailyEntry, type DayType, type Meal, type MealItem, type MealType, type Nutrients,
} from './domain/mock-data'
import { navigationItems, type NavigationId } from './config/navigation'
import { getTrendPoints } from './domain/insights'

const InsightsPage = lazy(() => import('./components/InsightsPage'))

type ThemeMode = 'system' | 'light' | 'dark'
type DemoState = 'ready' | 'loading' | 'error' | 'empty'
type Toast = { text: string; undo?: () => void } | null
type AssistantInput = { input: string; setInput: (value: string) => void }
const AssistantInputContext = createContext<AssistantInput | null>(null)

const pageMeta: Record<NavigationId, { title: string; eyebrow: string }> = {
  today: { title: '今日', eyebrow: '演示数据' }, foods: { title: '食物库', eyebrow: '演示数据' },
  record: { title: '记录', eyebrow: '本地交互模拟' }, history: { title: '历史', eyebrow: '演示数据' },
  insights: { title: '分析', eyebrow: '演示数据' },
}

const formatDate = (iso: string) => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(`${iso}T12:00:00`))
const formatNumber = (value: number) => new Intl.NumberFormat('zh-CN').format(value)

function App() {
  const isPreviewFrame = new URLSearchParams(window.location.search).has('preview-frame')
  if (import.meta.env.DEV && !isPreviewFrame) return <DevelopmentPreview />
  return <DailyFuelApp />
}

function DailyFuelApp() {
  const [activePage, setActivePage] = useState<NavigationId>('today')
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [demoState, setDemoState] = useState<DemoState>('ready')
  const [entries, setEntries] = useState<DailyEntry[]>(() => structuredClone(demoEntries))
  const [selectedDate, setSelectedDate] = useState('2026-11-24')
  const [expandedMeals, setExpandedMeals] = useState<string[]>(['breakfast', 'lunch', 'dinner', 'snack'])
  const [toast, setToast] = useState<Toast>(null)
  const [recordInput, setRecordInput] = useState('')
  const [showEstimate, setShowEstimate] = useState(false)
  const [manualOpen, setManualOpen] = useState(false)

  const currentEntry = entries.find((entry) => entry.date === selectedDate) ?? { date: selectedDate, dayType: 'rest' as DayType, completeness: '未记录' as const, meals: [] }
  const summary = useMemo(() => calculateSummary(currentEntry.meals), [currentEntry.meals])
  const goal = goals[currentEntry.dayType]

  function updateCurrent(mutator: (entry: DailyEntry) => DailyEntry) {
    setEntries((previous) => {
      const found = previous.some((entry) => entry.date === selectedDate)
      const next = found ? previous.map((entry) => entry.date === selectedDate ? mutator(entry) : entry) : [...previous, mutator(currentEntry)]
      return next
    })
  }

  function toggleDayType() {
    updateCurrent((entry) => ({ ...entry, dayType: entry.dayType === 'training' ? 'rest' : 'training' }))
  }

  function addItem(item: MealItem, mealType: MealType = '加餐', note = '已作为演示数据加入，未写入数据库') {
    const added = { ...item, id: `${item.id}-${Date.now()}` }
    updateCurrent((entry) => {
      const meals = addItemToMeals(entry.meals, added, mealType)
      return { ...entry, meals, completeness: '完整' }
    })
    setToast({ text: note, undo: () => removeItem(added.id, false) })
  }

  function removeItem(itemId: string, announce = true) {
    const result = removeItemFromMeals(currentEntry.meals, itemId)
    updateCurrent((entry) => ({ ...entry, meals: removeItemFromMeals(entry.meals, itemId).meals }))
    if (announce && result.removed && result.mealType) setToast({ text: '已从演示记录中删除', undo: () => addItem(result.removed!, result.mealType!, '已撤销删除') })
  }

  function editItem(itemId: string) {
    updateCurrent((entry) => ({ ...entry, meals: entry.meals.map((meal) => ({ ...meal, items: meal.items.map((item) => item.id === itemId ? { ...item, amount: item.amount.includes('150') ? item.amount.replace('150', '200') : item.amount, kcal: Math.round(item.kcal * 1.12), protein: Math.round(item.protein * 1.12), carbs: Math.round(item.carbs * 1.12), fat: Math.round(item.fat * 1.12) } : item) })) }))
    setToast({ text: '已修改演示份量并重新计算汇总' })
  }

  const content = demoState === 'loading' ? <StatePanel icon={<RotateCcw />} title="正在加载演示状态" detail="这是界面状态示例，不会读取或上传任何数据。" />
    : demoState === 'error' ? <StatePanel icon={<CircleHelp />} title="模拟加载失败" detail="真实产品会保留草稿并提供重试。本原型未连接服务。" action={() => setDemoState('ready')} actionLabel="重试" />
      : demoState === 'empty' ? <StatePanel icon={<Utensils />} title="这一天还没有记录" detail="未记录不代表未吃。你可以使用下方记录入口补记。" action={() => { setDemoState('ready'); setActivePage('record') }} actionLabel="开始记录" />
        : activePage === 'today' ? <TodayPage entry={currentEntry} summary={summary} goal={goal} onDate={setSelectedDate} onDayType={toggleDayType} expandedMeals={expandedMeals} setExpandedMeals={setExpandedMeals} onRemove={removeItem} onEdit={editItem} onQuick={(item) => addItem(item, '加餐')} onRecord={() => setActivePage('record')} />
          : activePage === 'foods' ? <FoodsPage onAdd={(item) => addItem(item)} />
            : activePage === 'record' ? <RecordPage input={recordInput} setInput={setRecordInput} showEstimate={showEstimate} setShowEstimate={setShowEstimate} manualOpen={manualOpen} setManualOpen={setManualOpen} onAdd={addItem} />
              : activePage === 'history' ? <HistoryPage entries={entries} selectedDate={selectedDate} onDate={(date) => { setSelectedDate(date); setActivePage('today') }} />
                : <Suspense fallback={<StatePanel icon={<RotateCcw />} title="正在加载分析" detail="图表模块按需加载，不会读取外部数据。" />}><InsightsPage /></Suspense>

  return (
    <AssistantInputContext.Provider value={{ input: recordInput, setInput: setRecordInput }}><div className="app-shell" data-theme={theme === 'system' ? undefined : theme}>
      <aside className="sidebar"><Brand /><Navigation active={activePage} onNavigate={setActivePage} /><button className="sidebar-setting" type="button" onClick={() => setIsSettingsOpen(true)}><Settings size={18} />设置</button></aside>
      <main className="main-content">
        <header className="topbar"><Brand compact /><div className="header-actions"><button className="demo-chip" type="button" onClick={() => setDemoState(demoState === 'ready' ? 'loading' : 'ready')}>演示数据</button><button className="icon-button" type="button" aria-label="打开设置" onClick={() => setIsSettingsOpen(true)}><Settings size={19} /></button></div></header>
        <section className="page" aria-labelledby="page-title"><div className="page-heading"><div><p className="eyebrow">{pageMeta[activePage].eyebrow}</p><h1 id="page-title">{pageMeta[activePage].title}</h1></div><StateSwitcher state={demoState} setState={setDemoState} /></div>{content}</section>
      </main>
      <nav className="bottom-nav" aria-label="主导航"><Navigation active={activePage} onNavigate={setActivePage} /></nav>
      {toast && <div className="toast" role="status"><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => { toast.undo?.(); setToast(null) }}><Undo2 size={15} />撤销</button>}<button aria-label="关闭提示" type="button" onClick={() => setToast(null)}><X size={16} /></button></div>}
      {isSettingsOpen && <SettingsModal theme={theme} setTheme={setTheme} onClose={() => setIsSettingsOpen(false)} />}
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
  const dates = ['2026-11-22', '2026-11-23', '2026-11-24']
  const progress = Math.min(100, Math.round(summary.kcal / goal.kcal * 100))
  return <div className="today-layout"><div className="today-primary"><section className="date-row"><button className="icon-plain" aria-label="前一天" onClick={() => onDate(dates[Math.max(0, dates.indexOf(entry.date) - 1)])}><ChevronLeft size={20} /></button><button className="date-button" type="button"><CalendarDays size={17} />{formatDate(entry.date)}</button><button className="icon-plain" aria-label="后一天" onClick={() => onDate(dates[Math.min(dates.length - 1, dates.indexOf(entry.date) + 1)])}><ChevronRight size={20} /></button><button className={`day-type ${entry.dayType}`} type="button" onClick={onDayType}>{entry.dayType === 'training' ? '训练日' : '休息日'}</button></section>
    <section className="energy-card card"><div className="energy-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><div><strong className="numeric">{formatNumber(summary.kcal)}</strong><span>/ {formatNumber(goal.kcal)} kcal</span></div></div><div className="energy-copy"><p className="section-label">ENERGY</p><h2>今日能量</h2><p>已完成 <span className="numeric">{progress}%</span> · 还可摄入 <strong className="numeric">{Math.max(0, goal.kcal - summary.kcal)} kcal</strong></p></div></section>
    <section className="macro-grid">{([{ key: 'protein', label: '蛋白质', unit: 'g', color: 'protein' }, { key: 'carbs', label: '碳水', unit: 'g', color: 'carbs' }, { key: 'fat', label: '脂肪', unit: 'g', color: 'fat' }] as const).map(({ key, label, unit, color }) => <article className={`macro-card ${color}`} key={key}><span>{label}</span><strong className="numeric">{summary[key]}<small> / {goal[key]} {unit}</small></strong><div className="meter"><i style={{ width: `${Math.min(100, summary[key] / goal[key] * 100)}%` }} /></div><em>剩余 {Math.max(0, goal[key] - summary[key])} {unit}</em></article>)}</section>
    <RecordComposer onRecord={onRecord} />
    <section className="section-block"><div className="section-header"><div><p className="section-label">MEALS</p><h2>餐食</h2></div><span className="muted">{entry.completeness}</span></div>{entry.meals.map((meal) => <MealCard key={meal.id} meal={meal} expanded={expandedMeals.includes(meal.id)} onToggle={() => setExpandedMeals(expandedMeals.includes(meal.id) ? expandedMeals.filter((id) => id !== meal.id) : [...expandedMeals, meal.id])} onRemove={onRemove} onEdit={onEdit} />)}</section>
  </div><aside className="today-side"><QuickPanel onQuick={onQuick} /></aside></div>
}

function FoodsPage({ onAdd }: { onAdd: (item: MealItem) => void }) { const [query, setQuery] = useState(''); const [editor, setEditor] = useState(false); const list = [...quickFoods, { id: 'food-tofu', name: '北豆腐', amount: '100 g', state: '熟重' as const, source: '中国食物成分表（演示）', kcal: 81, protein: 8, carbs: 2, fat: 5 }].filter((food) => food.name.includes(query)); return <div className="library-layout"><div><div className="toolbar"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索食物、品牌或别名" /></label><button className="primary-button" type="button" onClick={() => setEditor(!editor)}><Plus size={17} />新增食物</button></div>{editor && <FoodEditor onClose={() => setEditor(false)} onAdd={onAdd} />}<div className="category-tabs"><button className="selected">常用食材</button><button>品牌食品</button><button>私人菜谱</button><button>常用套餐</button></div><div className="food-list">{list.map((food) => <article className="food-row card" key={food.id}><div className="food-glyph"><Utensils size={19} /></div><div><h3>{food.name}</h3><p>{food.amount} · {food.state} · {food.source}</p></div><div className="food-nutrition numeric">{food.kcal}<small> kcal</small><span>P {food.protein}g</span></div><button className="icon-plain" aria-label={`记录${food.name}`} onClick={() => onAdd(food)}><Plus size={19} /></button></article>)}</div></div><aside className="library-detail card"><p className="section-label">FOOD DETAIL</p><h2>{list[0]?.name ?? '未找到食物'}</h2>{list[0] && <><div className="detail-nutrients"><b className="numeric">{list[0].kcal}<small> kcal</small></b><span>蛋白质 {list[0].protein}g</span><span>碳水 {list[0].carbs}g</span><span>脂肪 {list[0].fat}g</span></div><p className="source-note">数据来源：{list[0].source}。本页仅演示 UI，未建立正式食物库。</p><button className="secondary-button"><Pencil size={16} />编辑食物</button></>}</aside></div> }

function RecordPage({ input, setInput, showEstimate, setShowEstimate, manualOpen, setManualOpen, onAdd }: { input: string; setInput: (value: string) => void; showEstimate: boolean; setShowEstimate: (value: boolean) => void; manualOpen: boolean; setManualOpen: (value: boolean) => void; onAdd: (item: MealItem, type?: MealType, note?: string) => void }) { return <div className="record-layout"><section className="record-hero card"><div className="record-heading"><div><p className="section-label">AI INPUT · PROTOTYPE</p><h2>用自然语言描述这一餐</h2><p>此输入仅展示确认流程，未调用 AI 或外部服务。</p></div><Sparkles className="brand-icon" size={26} /></div><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="例如：午餐吃了 150g 鸡胸肉、半碗米饭和一杯美式" rows={4} /><div className="record-actions"><button className="secondary-button" onClick={() => setManualOpen(!manualOpen)}><Edit3 size={17} />手动记录</button><button className="secondary-button disabled" type="button"><ImagePlus size={17} />图片识别（尚未开放）</button><button className="primary-button" disabled={!input.trim()} onClick={() => setShowEstimate(true)}>查看模拟解析</button></div></section>{showEstimate && <section className="estimate-card card"><div><p className="section-label">ESTIMATE CONFIRMATION</p><h2>需要你确认的估算</h2><p>本地原型根据固定示例展示拆解结果，不是 AI 解析，也不会写入数据库。</p></div><div className="estimate-item"><b>鸡胸肉</b><span>150 g · 熟重 · 约 248 kcal</span></div><div className="estimate-actions"><button className="secondary-button" onClick={() => setShowEstimate(false)}>取消</button><button className="primary-button" onClick={() => { onAdd(quickFoods[1], '午餐', '已确认估算并写入演示状态'); setShowEstimate(false); setInput('') }}>确认作为演示记录</button></div></section>}{manualOpen && <ManualForm onAdd={onAdd} /> }<section className="section-block"><div className="section-header"><div><p className="section-label">QUICK LOG</p><h2>快速记录</h2></div></div><QuickPanel onQuick={(item) => onAdd(item, '加餐')} /></section></div> }

function HistoryPage({ entries, selectedDate, onDate }: { entries: DailyEntry[]; selectedDate: string; onDate: (date: string) => void }) {
  const [cursor, setCursor] = useState(new Date('2026-11-01T12:00:00'))
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + days) / 7) * 7 }, (_, index) => index - firstDay + 1)
  const monthLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(cursor)
  const entryFor = (date: string) => entries.find((entry) => entry.date === date)
  const trendByDate = new Map(getTrendPoints(7).map((point) => [point.date, point]))
  const summaryRows = entries.filter((entry) => entry.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).sort((a, b) => b.date.localeCompare(a.date))
  return <div className="history-layout"><section className="calendar-card card"><div className="calendar-controls"><button className="icon-plain" aria-label="上个月" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft size={19} /></button><div><h2>{monthLabel}</h2><button className="text-button" onClick={() => setCursor(new Date('2026-11-01T12:00:00'))}>返回今天</button></div><button className="icon-plain" aria-label="下个月" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight size={19} /></button></div><div className="weekday-row">{['日', '一', '二', '三', '四', '五', '六'].map((item) => <span key={item}>{item}</span>)}</div><div className="calendar-grid full-month">{cells.map((day, index) => { if (day < 1 || day > days) return <span key={`empty-${index}`} />; const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const entry = entryFor(date); return <button key={date} className={`${date === selectedDate ? 'selected ' : ''}${entry?.completeness === '完整' ? 'complete' : entry?.completeness === '部分记录' ? 'partial' : ''}`} type="button" aria-label={`${date} ${entry?.completeness ?? '未记录'}`} onClick={() => onDate(date)}><span>{day}</span><i /></button> })}</div><div className="calendar-legend"><span><i className="complete-dot" />已确认完整</span><span><i className="partial-dot" />部分记录</span><span><i className="empty-dot" />未记录</span></div></section><section className="history-list"><div className="section-header"><div><h2>每日汇总</h2><p className="muted">点击日期查看对应餐食</p></div></div>{summaryRows.length ? summaryRows.map((entry) => { const mealTotal = calculateSummary(entry.meals); const total = mealTotal.kcal ? mealTotal : trendByDate.get(entry.date) ?? mealTotal; return <button className="history-row card" key={entry.date} type="button" onClick={() => onDate(entry.date)}><div><b>{formatDate(entry.date)}</b><span>{entry.completeness}</span></div><strong className="numeric">{total.kcal ?? '—'}<small> kcal</small></strong><em className="history-macros numeric">P {total.protein ?? '—'} · C {total.carbs ?? '—'} · F {total.fat ?? '—'} g</em><ChevronRight size={18} /></button> }) : <StatePanel icon={<CalendarDays />} title="本月没有演示记录" detail="未记录不代表未吃。" />}</section></div>
}

function QuickPanel({ onQuick }: { onQuick: (item: MealItem) => void }) { return <section className="quick-panel"><div className="section-header"><div><p className="section-label">QUICK ADD</p><h2>常用</h2></div><button className="text-button">管理</button></div><div className="quick-list">{quickFoods.map((item) => <button className="quick-item card" type="button" key={item.id} onClick={() => onQuick(item)}><span className="food-glyph"><Plus size={16} /></span><span><b>{item.name}</b><small>{item.amount} · {item.kcal} kcal</small></span></button>)}</div><div className="template-list">{mealTemplates.map((item) => <button className="template-item" type="button" key={item.id}><Library size={17} /><span><b>{item.name}</b><small>{item.note}</small></span><strong className="numeric">{item.kcal}</strong></button>)}</div></section> }

function MealCard({ meal, expanded, onToggle, onRemove, onEdit }: { meal: Meal; expanded: boolean; onToggle: () => void; onRemove: (id: string) => void; onEdit: (id: string) => void }) { const total = calculateSummary([meal]); return <article className="meal-card card"><button className="meal-title" type="button" onClick={onToggle}><div><span className="meal-dot" /><b>{meal.type}</b><small>{meal.time} · {meal.items.length} 项</small></div><div><strong className="numeric">{total.kcal}<small> kcal</small></strong><ChevronDown className={expanded ? 'rotated' : ''} size={18} /></div></button>{expanded && <div className="meal-items">{meal.items.map((item) => <div className="meal-item" key={item.id}><div><b>{item.name}</b><span>{item.amount} · {item.state} · {item.source}</span></div><div className="item-right"><strong className="numeric">{item.kcal}<small> kcal</small></strong><button aria-label={`修改${item.name}`} onClick={() => onEdit(item.id)}><Pencil size={15} /></button><button aria-label={`删除${item.name}`} onClick={() => onRemove(item.id)}><Trash2 size={15} /></button></div></div>)}</div>}</article> }

function RecordComposer({ onRecord }: { onRecord: () => void }) {
  const assistant = useContext(AssistantInputContext)
  if (!assistant) return null
  const shortcuts = ['记录午餐', '补记昨晚', '复制早餐']
  return <section className="assistant-card card"><div className="assistant-title"><div><p className="section-label">饮食助手 <span>模拟</span></p><h2>直接描述你吃了什么</h2></div><Sparkles size={21} /></div><textarea value={assistant.input} onChange={(event) => assistant.setInput(event.target.value)} rows={3} placeholder="例如：午餐吃了鸡胸肉、米饭和一杯美式" /><div className="assistant-footer"><div className="assistant-shortcuts">{shortcuts.map((item) => <button type="button" key={item} onClick={() => assistant.setInput(item)}>{item}</button>)}</div><button className="send-button" type="button" disabled={!assistant.input.trim()} onClick={onRecord}><Sparkles size={16} />发送</button></div><p className="assistant-note">可使用系统键盘听写 · 图片识别尚未开放 · 不调用真实 AI</p></section>
}
function FoodEditor({ onClose, onAdd }: { onClose: () => void; onAdd: (item: MealItem) => void }) { const [name, setName] = useState(''); return <form className="food-editor card" onSubmit={(event) => { event.preventDefault(); if (name) { onAdd({ id: `custom-${Date.now()}`, name, amount: '100 g', state: '熟重', source: '用户新增（演示）', kcal: 120, protein: 10, carbs: 8, fat: 5 }); onClose() } }}><div className="section-header"><h2>新增食物</h2><button className="icon-plain" type="button" onClick={onClose}><X size={18} /></button></div><label>食物名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：自制燕麦杯" /></label><div className="form-grid"><label>重量<input defaultValue="100" type="number" /></label><label>状态<select defaultValue="熟重"><option>熟重</option><option>生重</option></select></label><label>个人单位<select defaultValue="克"><option>克</option><option>毫升</option><option>份</option></select></label></div><button className="primary-button" type="submit">保存为演示食物</button></form> }
function ManualForm({ onAdd }: { onAdd: (item: MealItem, type?: MealType, note?: string) => void }) { return <section className="manual-form card"><p className="section-label">MANUAL LOG</p><h2>手动记录</h2><div className="form-grid"><label>食物<input defaultValue="鸡胸肉" /></label><label>重量<input defaultValue="150" /></label><label>单位<select><option>g</option><option>ml</option><option>份</option></select></label></div><button className="primary-button" onClick={() => onAdd(quickFoods[1], '晚餐', '已通过手动表单加入演示数据')}>加入演示记录</button></section> }
function StatePanel({ icon, title, detail, action, actionLabel }: { icon: React.ReactNode; title: string; detail: string; action?: () => void; actionLabel?: string }) { return <div className="state-panel card"><span>{icon}</span><h2>{title}</h2><p>{detail}</p>{action && <button className="primary-button" onClick={action}>{actionLabel}</button>}</div> }
function StateSwitcher({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) { return <div className="state-switcher"><button className={state === 'ready' ? 'selected' : ''} onClick={() => setState('ready')}>数据</button><button className={state === 'empty' ? 'selected' : ''} onClick={() => setState('empty')}>空</button><button className={state === 'error' ? 'selected' : ''} onClick={() => setState('error')}>错误</button></div> }
function SettingsModal({ theme, setTheme, onClose }: { theme: ThemeMode; setTheme: (theme: ThemeMode) => void; onClose: () => void }) { return <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}><section className="settings-panel settings-full" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}><div className="panel-heading"><div><p className="eyebrow">SETTINGS / DEMO</p><h2 id="settings-title">设置</h2></div><button className="icon-button" type="button" aria-label="关闭设置" onClick={onClose}><X size={19} /></button></div><section className="setting-group"><h3>界面主题</h3><div className="theme-options">{(['system', 'light', 'dark'] as const).map((item) => <button key={item} className={theme === item ? 'is-selected' : ''} onClick={() => setTheme(item)}>{{ system: '跟随系统', light: '浅色', dark: '深色' }[item]}</button>)}</div></section><section className="setting-group"><h3>营养目标 <span>演示设置</span></h3><div className="goal-grid">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((item) => <label key={item}>{({ kcal: '热量', protein: '蛋白质', carbs: '碳水', fat: '脂肪' })[item]}<input defaultValue={goals.training[item]} /><small>{item === 'kcal' ? 'kcal' : 'g'} · 训练日</small></label>)}</div><button className="secondary-button">切换至休息日目标</button></section><section className="setting-group link-group"><button><BookOpen size={18} />个人饮食习惯 <ChevronRight size={17} /></button><button><Database size={18} />数据备份 <em>第 03 阶段</em></button><button><Cloud size={18} />云端同步 <em>尚未开放</em></button><button><Sparkles size={18} />AI 配置 <em>未接入真实服务</em></button></section></section></div> }
function Navigation({ active, onNavigate }: { active: NavigationId; onNavigate: (item: NavigationId) => void }) { const icons = { today: BarChart3, foods: Utensils, record: Plus, history: CalendarDays, insights: LineIcon }; return <div className="navigation-items">{navigationItems.map((item) => { const Icon = icons[item.id]; return <button className={active === item.id ? 'nav-item is-active' : 'nav-item'} key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={active === item.id ? 'page' : undefined}><Icon size={19} /><span>{item.label}</span></button> })}</div> }
function Brand({ compact = false }: { compact?: boolean }) { return <div className={compact ? 'brand brand--compact' : 'brand'}><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span className="brand-name">DAILY FUEL</span></div> }
export default App
