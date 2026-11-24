import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // 相对路径让 GitHub Pages、个人子目录和本地预览使用同一份构建产物。
  base: './',
  plugins: [react(), tailwindcss()],
})
