// 添加 process 的 polyfill
if (typeof window !== "undefined" && typeof window.process === "undefined") {
  window.process = { env: { NODE_ENV: "production" } };
}

import { createApp } from "vue";
import App from "./App.vue";
import axios from "axios";
import { Quasar } from "quasar";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.css";

// 創建獨立的容器
const container = document.createElement("div");
container.id = "agent-ui-root";
document.body.appendChild(container);
// ✅ 创建应用实例
const app = createApp(App);

// ✅ 使用 Quasar
app.use(Quasar, {
  plugins: {},
  config: {
    brand: {
      primary: "#1976D2",
      secondary: "#26A69A",
      accent: "#9C27B0",
    },
  },
});

// ✅ 全局挂载 axios
app.config.globalProperties.$axios = axios;

// ✅ 挂载到 DOM（确保 index.html 中有 id="app" 的元素）
app.mount(container);
