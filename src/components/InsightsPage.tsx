import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCompleteness, getKnownAverage, getTrendPoints, metricMeta, type InsightMetric, type TrendPoint } from '../domain/insights'
import { entryOn, isValidHeight, isValidWeight, latestBodyEntry, weightChange, weightPoints, type BodyEntry } from '../domain/body'
import type { DailyEntry } from '../domain/mock-data'

const ranges = [7, 14, 30] as const
const metrics = Object.keys(metricMeta) as InsightMetric[]
const axisTick = { fontSize: 11 }

export default function InsightsPage({ entries, today, bodyMetrics, heightCm, onSaveWeight, onSaveHeight }: { entries: DailyEntry[]; today: string; bodyMetrics: BodyEntry[]; heightCm: number | null; onSaveWeight: (date: string, weightKg: number) => void; onSaveHeight: (heightCm: number | null) => void }) {
  const [range, setRange] = useState<(typeof ranges)[number]>(7)
  const [metric, setMetric] = useState<InsightMetric>('kcal')
  const [selected, setSelected] = useState<TrendPoint | null>(null)
  const points = useMemo(() => getTrendPoints(entries, range), [entries, range])
  const meta = metricMeta[metric]
  const average = getKnownAverage(points, metric)
  const completeness = getCompleteness(points)

  return <div className="insights-layout">
    <section className="insight-summary">
      <article className="insight-stat card"><span>平均{meta.label}</span><b className="numeric">{average ?? '—'}<small>{meta.unit}</small></b><p>仅基于已记录日</p></article>
      <article className="insight-stat card"><span>目标达成</span><b className="numeric">{average ? `${Math.round(average / meta.goal * 100)}` : '—'}<small>%</small></b><p>每日目标 {meta.goal} {meta.unit}</p></article>
      <article className="insight-stat card"><span>数据完整度</span><b className="numeric">{completeness}<small>%</small></b><p>{points.filter((point) => point.kcal !== null).length} / {range} 天有记录</p></article>
    </section>
    <section className="chart-card card">
      <div className="section-header chart-heading"><div><h2>{meta.label}趋势</h2><p className="muted">缺失日保留为空，不按 0 计算或连接。</p></div><div className="range-tabs">{ranges.map((item) => <button key={item} className={range === item ? 'selected' : ''} onClick={() => setRange(item)}>{item}日</button>)}</div></div>
      <div className="metric-tabs" role="tablist" aria-label="营养指标">{metrics.map((item) => <button role="tab" aria-selected={metric === item} className={metric === item ? 'selected' : ''} key={item} onClick={() => { setMetric(item); setSelected(null) }}>{metricMeta[item].label}</button>)}</div>
      <div className="chart-unit">单位：{meta.unit} <span>目标 {meta.goal} {meta.unit}</span></div>
      <div className="chart-wrap enhanced-chart"><ResponsiveContainer width="100%" height={300}><LineChart key={metric} data={points} margin={{ top: 14, right: 16, left: 8, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={18} tick={axisTick} /><YAxis unit={meta.unit} tickLine={false} axisLine={false} tickMargin={6} width={64} domain={['auto', 'auto']} tick={axisTick} /><Tooltip formatter={(value) => [`${value ?? '未记录'} ${meta.unit}`, meta.label]} labelFormatter={(label) => `${label}（演示数据）`} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)' }} /><ReferenceLine y={meta.goal} stroke="var(--faint)" strokeDasharray="4 4" label={{ value: `目标 ${meta.goal}`, fill: 'var(--muted)', fontSize: 11, position: 'insideTopRight' }} /><Line type="monotone" dataKey={metric} stroke={meta.color} strokeWidth={2.5} connectNulls={false} dot={(props) => <SelectableDot {...props} color={meta.color} onSelect={() => { const payload = props.payload as TrendPoint; if (payload[metric] !== null) setSelected(payload) }} />} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
      {selected && <button className="selected-point" type="button" onClick={() => setSelected(null)}><span>{selected.day}</span><b className="numeric">{selected[metric]} {meta.unit}</b><small>点击关闭</small></button>}
    </section>
    <BodyCard entries={bodyMetrics} heightCm={heightCm} today={today} range={range} onSaveWeight={onSaveWeight} onSaveHeight={onSaveHeight} />
  </div>
}

function BodyCard({ entries, heightCm, today, range, onSaveWeight, onSaveHeight }: { entries: BodyEntry[]; heightCm: number | null; today: string; range: number; onSaveWeight: (date: string, weightKg: number) => void; onSaveHeight: (heightCm: number | null) => void }) {
  const latest = latestBodyEntry(entries)
  const todayEntry = entryOn(entries, today)
  const [heightInput, setHeightInput] = useState(heightCm ? String(heightCm) : '')
  const [weightInput, setWeightInput] = useState(todayEntry ? String(todayEntry.weightKg) : latest ? String(latest.weightKg) : '')
  const [error, setError] = useState('')
  const points = weightPoints(entries, range, today)
  const change = weightChange(entries)

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const height = heightInput.trim() === '' ? null : Number(heightInput)
    if (height !== null && !isValidHeight(height)) return setError('身高请填写 80–250 cm，或留空。')
    const weight = Number(weightInput)
    if (weightInput.trim() === '' || !isValidWeight(weight)) return setError('体重请填写 25–350 kg。')
    setError('')
    onSaveHeight(height)
    onSaveWeight(today, weight)
  }

  return <section className="body-card card">
    <div className="section-header"><div><p className="section-label">BODY</p><h2>身体数据</h2></div><span className="muted">只存本机</span></div>
    <form onSubmit={submit}>
      <div className="body-grid">
        <label>身高 cm<input value={heightInput} inputMode="decimal" type="text" placeholder="如 178" onChange={(event) => setHeightInput(event.target.value)} /></label>
        <label>今日体重 kg<input value={weightInput} inputMode="decimal" type="text" placeholder="如 72.4" onChange={(event) => setWeightInput(event.target.value)} /></label>
      </div>
      <div className="body-stats">
        <strong className="numeric">{latest ? latest.weightKg : '—'}<small> kg</small></strong>
        <em>{latest ? `最近一次 ${latest.date.slice(5).replace('-', '/')}` : '还没有体重记录'}</em>
        {change !== null && <em>较首次 {change > 0 ? '+' : ''}{change} kg</em>}
      </div>
      {points.length > 1
        ? <div className="chart-wrap chart-wrap--half"><ResponsiveContainer width="100%" height={140}><AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4779dc" stopOpacity={0.26} /><stop offset="100%" stopColor="#4779dc" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={16} tick={axisTick} /><YAxis tickLine={false} axisLine={false} width={40} tickMargin={4} tick={axisTick} domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} /><Tooltip formatter={(value) => [`${value ?? '—'} kg`, '体重']} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)' }} /><Area type="monotone" dataKey="weight" stroke="#4779dc" strokeWidth={2.2} fill="url(#weight-fill)" dot={{ r: 3, fill: 'var(--card)', stroke: '#4779dc', strokeWidth: 2 }} activeDot={{ r: 5 }} /></AreaChart></ResponsiveContainer></div>
        : <p className="body-hint">{points.length === 1 ? '已记录一次。再称一次就能看到体重曲线。' : `最近 ${range} 天还没有体重记录。称一次并填在「今日体重」即可开始。`}</p>}
      {error && <p className="source-note form-error">{error}</p>}
      <div className="record-actions" style={{ marginTop: 12 }}><button className="primary-button" type="submit">保存身体数据</button></div>
    </form>
  </section>
}

function SelectableDot({ cx, cy, color, onSelect }: { cx?: number; cy?: number; color: string; onSelect: () => void }) {
  if (cx === undefined || cy === undefined) return null
  return <Dot cx={cx} cy={cy} r={3.5} fill="var(--card)" stroke={color} strokeWidth={2} onClick={onSelect} style={{ cursor: 'pointer' }} />
}
