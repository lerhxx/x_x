import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: 'x_x',
  server: {
    headers: {
      // 静态资源不要被 ServiceWorker/回退缓存影响
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
    fs: {
      // 允许 dev server 读取 public 下的模型
      strict: false,
    },
  },
  optimizeDeps: {
    // 每次启动都重新构建依赖缓存，避免旧的 graph 残留
    force: true,
  },
})

