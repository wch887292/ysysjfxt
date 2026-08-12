import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/admin/',  // 添加这一行
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    // 开发环境代理：将 /api 请求转发到后端服务，避免 CORS 问题
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  // 生产构建时移除调试语句：
  // - pure 标记的调用会被视为无副作用，未被引用时整体摇除（保留 console.error / console.warn 便于线上排障）
  // - drop debugger 防止调试断点意外进入生产包
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
    drop: ['debugger']
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // 手动分包：避免所有第三方依赖与业务代码打进单个 1.2MB+ 主包。
        // 拆分后浏览器可并行下载，且依赖包内容稳定、可长期强缓存，
        // 业务代码迭代不会导致用户重新下载整个 Element Plus。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // 注意：必须先判断 icons，因为 '@element-plus/icons-vue' 路径同样包含 'element-plus' 子串
          if (id.includes('@element-plus/icons-vue')) return 'element-icons'
          if (id.includes('element-plus')) return 'element-plus'
          return 'vendor'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
 