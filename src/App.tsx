import { useEffect, useState } from 'react'
import { navigationItems, type NavigationId } from './config/navigation'

type ThemeMode = 'system' | 'light' | 'dark'

const pageCopy: Record<NavigationId, { eyebrow: string; title: string; description: string }> = {
  today: {
    eyebrow: 'TODAY',
    title: '今天，从一餐开始',
    description: '记录入口与真实饮食数据将在下一阶段接入。当前不会保存或展示任何演示饮食记录。',
  },
  foods: {
    eyebrow: 'FOOD LIBRARY',
    title: '食物库',
    description: '食材、品牌、菜谱与套餐将在本地数据层完成后出现。',
  },
  record: {
    eyebrow: 'LOG',
    title: '记录',
    description: '统一记录输入框将在 AI 与手动降级流程完成后开放。',
  },
  history: {
    eyebrow: 'HISTORY',
    title: '历史',
    description: '日期、补记与餐食详情将只显示用户自己的本地记录。',
  },
  insights: {
    eyebrow: 'INSIGHTS',
    title: '分析',
    description: '趋势与完整度分析将在计算规则和本地数据完成后呈现。',
  },
}

function App() {
  const [activePage, setActivePage] = useState<NavigationId>('today')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>('system')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
      return
    }
    root.dataset.theme = theme
  }, [theme])

  const page = pageCopy[activePage]

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="主导航">
        <Brand />
        <Navigation activePage={activePage} onNavigate={setActivePage} />
        <button className="settings-trigger" type="button" onClick={() => setIsSettingsOpen(true)}>
          <SettingsIcon />
          设置
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <Brand compact />
          <button className="icon-button" type="button" aria-label="打开设置" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon />
          </button>
        </header>

        <section className="page" aria-labelledby="page-title">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 id="page-title">{page.title}</h1>
          <div className="stage-card">
            <span className="stage-mark" aria-hidden="true">01</span>
            <div>
              <p className="card-kicker">项目骨架已就位</p>
              <p className="card-copy">{page.description}</p>
            </div>
          </div>
        </section>
      </main>

      <nav className="bottom-nav" aria-label="主导航">
        <Navigation activePage={activePage} onNavigate={setActivePage} />
      </nav>

      {isSettingsOpen && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsSettingsOpen(false)}>
          <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PREFERENCES</p>
                <h2 id="settings-title">显示设置</h2>
              </div>
              <button className="icon-button" type="button" aria-label="关闭设置" onClick={() => setIsSettingsOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <fieldset className="theme-picker">
              <legend>界面主题</legend>
              <p>仅调整当前页面外观，不会保存饮食数据。</p>
              <div className="theme-options">
                {(['system', 'light', 'dark'] as const).map((option) => (
                  <button className={theme === option ? 'theme-option is-selected' : 'theme-option'} type="button" key={option} aria-pressed={theme === option} onClick={() => setTheme(option)}>
                    {{ system: '跟随系统', light: '浅色', dark: '深色' }[option]}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      )}
    </div>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'brand brand--compact' : 'brand'} aria-label="Daily Fuel">
      <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span className="brand-name">DAILY FUEL</span>
    </div>
  )
}

function Navigation({ activePage, onNavigate }: { activePage: NavigationId; onNavigate: (id: NavigationId) => void }) {
  return (
    <div className="navigation-items">
      {navigationItems.map((item) => (
        <button className={activePage === item.id ? 'nav-item is-active' : 'nav-item'} key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-current={activePage === item.id ? 'page' : undefined}>
          <span className="nav-icon" aria-hidden="true">{item.symbol}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function SettingsIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.1 3.8 1.5-1.2-1.8-3.1-1.8.7a7.7 7.7 0 0 0-1.3-.8l-.3-1.9h-3.6l-.3 1.9c-.5.2-.9.5-1.3.8l-1.8-.7-1.8 3.1L5.9 12c0 .5.1 1 .2 1.5l-1.5 1.2 1.8 3.1 1.8-.7c.4.3.8.6 1.3.8l.3 1.9h3.6l.3-1.9c.5-.2.9-.5 1.3-.8l1.8.7 1.8-3.1-1.5-1.2c.1-.5.2-1 .2-1.5Z" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

export default App
