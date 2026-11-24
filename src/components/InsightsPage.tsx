import { useMemo, useState } from 'react'
import { CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getCompleteness, getKnownAverage, getTrendPoints, metricMeta, type InsightMetric, type TrendPoint } from '../domain/insights'

const ranges = [7, 14, 30] as const
const metrics = Object.keys(metricMeta) as InsightMetric[]

export default function InsightsPage() {
  const [range, setRange] = useState<(typeof ranges)[number]>(7)
  const [metric, setMetric] = useState<InsightMetric>('kcal')
  const [selected, setSelected] = useState<TrendPoint | null>(null)
  const points = useMemo(() => getTrendPoints(range), [range])
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
      <div className="chart-wrap enhanced-chart"><ResponsiveContainer width="100%" height={300}><LineChart key={metric} data={points} margin={{ top: 14, right: 10, left: 2, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={18} /><YAxis unit={meta.unit} tickLine={false} axisLine={false} width={58} domain={['auto', 'auto']} /><Tooltip formatter={(value) => [`${value ?? '未记录'} ${meta.unit}`, meta.label]} labelFormatter={(label) => `${label}（演示数据）`} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)' }} /><ReferenceLine y={meta.goal} stroke="var(--faint)" strokeDasharray="4 4" label={{ value: `目标 ${meta.goal}`, fill: 'var(--muted)', fontSize: 11, position: 'insideTopRight' }} /><Line type="monotone" dataKey={metric} stroke={meta.color} strokeWidth={2.5} connectNulls={false} dot={(props) => <SelectableDot {...props} color={meta.color} onSelect={() => { const payload = props.payload as TrendPoint; if (payload[metric] !== null) setSelected(payload) }} />} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div>
      {selected && <button className="selected-point" type="button" onClick={() => setSelected(null)}><span>{selected.day}</span><b className="numeric">{selected[metric]} {meta.unit}</b><small>点击关闭</small></button>}
    </section>
  </div>
}

function SelectableDot({ cx, cy, color, onSelect }: { cx?: number; cy?: number; color: string; onSelect: () => void }) {
  if (cx === undefined || cy === undefined) return null
  return <Dot cx={cx} cy={cy} r={3.5} fill="var(--card)" stroke={color} strokeWidth={2} onClick={onSelect} style={{ cursor: 'pointer' }} />
}
