import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// iOS 上 navigator.standalone 只在 Safari/WebView 中存在：false 表示仍在浏览器里，Safari 的顶部工具栏会浮在页面上。
const standaloneHint = (navigator as Navigator & { standalone?: boolean }).standalone
if (standaloneHint === false) document.documentElement.dataset.iosBrowser = 'true'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // PWA 缓存不可用时，应用仍可作为普通本地网页使用。
    })
  })
}
