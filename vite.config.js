import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig({
  plugins: [
    vue(),
    cssInjectedByJsPlugin()  // 自动将 CSS 注入 JS
  ],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    lib: {
      entry: 'src/main.js',
      name: 'PageAgentUI',
      formats: ['iife'],
      fileName: () => 'agent.js'
    },
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true
      }
    },
    cssCodeSplit: false
  }
})