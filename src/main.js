// 添加 process 的 polyfill
if (typeof window !== 'undefined' && typeof window.process === 'undefined') {
  window.process = { env: { NODE_ENV: 'production' } };
}

import { createApp } from 'vue'
import App from './App.vue'

const container = document.createElement('div')
container.id = 'custom-agent-root'
document.body.appendChild(container)

createApp(App).mount(container)