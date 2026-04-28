<template>
  <div
    class="custom-agent-ui"
    :class="{ collapsed: isCollapsed }"
    v-show="!isClosed"
  >
    <div class="control-panel">
      <div class="header">
        <div class="header-left">
          <button
            class="collapse-btn"
            @click="toggleCollapse"
            :title="isCollapsed ? '展開' : '摺疊'"
          >
            <span class="collapse-icon">{{ isCollapsed ? "◀" : "▼" }}</span>
          </button>
          <h3>🤖 Agent</h3>
        </div>
        <div class="header-buttons">
          <button
            v-if="isRunning"
            @click="stopTask"
            class="stop-btn"
            title="暫停"
          >
            ⏹️ 暫停
          </button>
          <button v-else @click="runTask" :disabled="!agent" class="run-btn">
            🚀 執行
          </button>
          <button @click="closePanel" class="close-btn" title="關閉">✕</button>
        </div>
      </div>

      <div class="collapsible-content" v-show="!isCollapsed">
        <div class="task-input-section">
          <div class="task-input-label">
            <span class="label-icon">📝</span>
            <span>任務描述</span>
          </div>
          <textarea
            v-model="customTask"
            class="task-textarea"
            placeholder="請輸入您想要 AI 執行的任務"
            rows="4"
          />
          <div class="task-input-hint">
            <span>💡 提示：支援自然語言描述，AI 會自動理解並執行</span>
            <button class="clear-task-btn" @click="clearTask" title="清空輸入">
              清空
            </button>
          </div>
        </div>

        <div class="quick-tasks">
          <div class="quick-tasks-title">⚡ 快捷任務</div>
          <div class="quick-tasks-buttons">
            <button class="quick-task-btn" @click="setQuickTask('fillForm')">
              📝 填寫測試表單
            </button>
            <button class="quick-task-btn" @click="setQuickTask('clickButton')">
              🖱️ 點擊提交按鈕
            </button>
            <button class="quick-task-btn" @click="setQuickTask('extractData')">
              📊 提取頁面資料
            </button>
            <button class="quick-task-btn" @click="setQuickTask('scrollPage')">
              📜 捲動到頁面底部
            </button>
          </div>
        </div>

        <div class="log-panel">
          <div class="log-title">
            <span>📋 執行日誌</span>
            <span class="log-count">{{ logs.length }} 條記錄</span>
          </div>
          <div class="log-content">
            <div
              v-for="(log, index) in logs"
              :key="index"
              class="log-item"
              :class="getLogClass(log)"
            >
              {{ log }}
            </div>
            <div v-if="logs.length === 0" class="log-empty">
              暫無日誌，輸入任務後點擊上方按鈕開始執行
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="showInputDialog"
        class="dialog-overlay"
        @click.self="cancelInput"
      >
        <div class="dialog">
          <div class="dialog-header">
            <span class="dialog-icon">💬</span>
            <h4>需要您的輸入</h4>
          </div>
          <div class="dialog-content">
            <p>{{ pendingQuestion }}</p>
            <input
              ref="inputRef"
              v-model="inputValue"
              type="text"
              placeholder="請輸入..."
              @keyup.enter="submitInput"
            />
          </div>
          <div class="dialog-buttons">
            <button @click="cancelInput" class="btn-cancel">取消</button>
            <button @click="submitInput" class="btn-confirm">確認</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { PageAgentCore } from "@page-agent/core";
import { PageController } from "@page-agent/page-controller";

// ========== 響應式狀態 ==========
const isRunning = ref(false);
const logs = ref([]);
const showInputDialog = ref(false);
const pendingQuestion = ref("");
const inputValue = ref("");
const inputRef = ref(null);
const customTask = ref("");
const isCollapsed = ref(false);
const isClosed = ref(false);

// ========== Agent 實例 ==========
let agent = null;
let inputResolver = null;
let originalConsoleLog = null;

// ========== UI 互動 ==========
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const clearTask = () => {
  customTask.value = "";
  addLog("🗑️ 已清空");
};

const setQuickTask = (taskType) => {
  if (isRunning.value) {
    addLog("⚠️ 請先停止當前任務");
    return;
  }

  const tasks = {
    fillForm: "幫我填寫表單，不用提交",
    clickButton: "找到頁面上的提交按鈕並點擊",
    extractData: "提取頁面上所有表單的資訊",
    scrollPage: "捲動到頁面底部",
  };

  customTask.value = tasks[taskType];
  addLog(`⚡ 已載入: ${taskType}`);
  runTask();
};

// ========== 停止任務 ==========
const stopTask = async () => {
  addLog("⏹️ 正在停止...");

  if (agent?.stop) {
    await agent.stop();
  }

  if (inputResolver) {
    inputResolver.reject(new Error("已停止"));
    inputResolver = null;
    showInputDialog.value = false;
    inputValue.value = "";
  }
};

// ========== 執行任務 ==========
const runTask = async () => {
  if (!agent) return addLog("Agent 未初始化");
  if (isRunning.value) return addLog("⚠️ 任務執行中，請先停止");

  const task = customTask.value.trim();
  if (!task) return addLog("⚠️ 請輸入任務");

  addLog(`🚀 執行: ${task.slice(0, 100)}${task.length > 100 ? "..." : ""}`);

  try {
    await agent.execute(task);
  } catch (error) {
    // 錯誤由 PageAgent 的 error 事件處理
  }
};

// ========== 關閉面板 ==========
const closePanel = () => {
  isClosed.value = true;
  addLog("🔒 面板已關閉");
};

const openPanel = () => {
  isClosed.value = false;
};

// ========== 日誌處理 ==========
const addLog = (msg) => {
  // 清理 ANSI 顏色代碼，保留繁體中文和 emoji
  const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, "");
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${cleanMsg}`);
  if (logs.value.length > 200) logs.value.pop();
};

const getLogClass = (log) => {
  if (log.includes("❌") || log.includes("錯誤") || log.includes("失敗"))
    return "log-error";
  if (log.includes("✅") || log.includes("成功") || log.includes("完成"))
    return "log-success";
  return "";
};

// ========== 初始化 Agent ==========
const initAgent = () => {
  const pageController = new PageController({ enableMask: true });

  agent = new PageAgentCore({
    pageController,
    model: "Qwen/Qwen2.5-VL-32B-Instruct",
    baseURL: "http://litellm.feg.cn/v1",
    apiKey: "sk-k5UlvstW5kP4G0jd7rK1cA",
  });

  // 監聽狀態變化
  agent.addEventListener("statuschange", () => {
    isRunning.value = agent.status === "running";
  });

  // 使用者輸入彈窗
  agent.addEventListener("askuser", async (e) => {
    const question = e.detail?.question || e.detail;
    if (!question || !isRunning.value) throw new Error("任務已停止");

    return new Promise((resolve, reject) => {
      inputResolver = { resolve, reject };
      pendingQuestion.value = question;
      showInputDialog.value = true;
      setTimeout(() => inputRef.value?.focus(), 100);
    });
  });

  // 錯誤處理
  agent.addEventListener("error", (e) => {
    const error = e.detail?.error || e.detail;
    if (error?.name !== "AbortError") {
      addLog(`❌ ${error?.message || "未知錯誤"}`);
    }
    isRunning.value = false;
  });
};

// ========== 使用者輸入彈窗 ==========
const submitInput = () => {
  if (inputResolver) {
    inputResolver.resolve(inputValue.value);
    inputResolver = null;
  }
  showInputDialog.value = false;
  addLog(`💬 輸入: ${inputValue.value}`);
  inputValue.value = "";
};

const cancelInput = () => {
  if (inputResolver) {
    inputResolver.reject(new Error("使用者取消"));
    inputResolver = null;
  }
  showInputDialog.value = false;
  inputValue.value = "";
  addLog("❌ 取消輸入");
};

// ========== 暴露全域方法 ==========
if (typeof window !== "undefined") {
  window.AgentUI = {
    open: openPanel,
    close: closePanel,
    toggle: () => {
      if (isClosed.value) {
        openPanel();
      } else {
        closePanel();
      }
    },
  };
}

// ========== 生命週期 ==========
onMounted(() => {
  // 攔截 console.log，將 PageAgent 的內部日誌添加到 UI
  originalConsoleLog = console.log;
  console.log = (...args) => {
    // 仍然輸出到瀏覽器主控台
    originalConsoleLog(...args);

    // 將日誌添加到 UI 面板
    const msg = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");

    // 不過濾任何日誌，全部顯示
    if (msg && msg.length > 0) {
      addLog(msg);
    }
  };

  initAgent();
  addLog("✨ Agent 已就緒");
  customTask.value = "幫我填寫表單，不要提交";

  // 每次都是預設狀態：展開 + 顯示
  isCollapsed.value = false;
  isClosed.value = false;
});

onUnmounted(() => {
  if (originalConsoleLog) console.log = originalConsoleLog;
  agent?.stop();
  agent?.dispose();
});
</script>

<style scoped>
/* 你的樣式保持不變 */
.custom-agent-ui {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: calc(100vw - 40px);
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  z-index: 10000000000;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", sans-serif;
  transition: all 0.3s ease;
}

.control-panel {
  background: white;
  border-radius: 20px;
  overflow: hidden;
}

.header {
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-buttons {
  display: flex;
  gap: 10px;
}

.collapse-btn {
  padding: 0;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.collapse-icon {
  color: white;
  font-size: 14px;
  transition: transform 0.3s;
  display: inline-block;
}

.custom-agent-ui.collapsed .collapse-icon {
  transform: rotate(180deg);
}

.header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
  letter-spacing: 0.5px;
}

.run-btn,
.header-buttons button {
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s;
}

.run-btn:hover,
.header-buttons button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.header-buttons button:disabled {
  background: rgba(255, 255, 255, 0.1);
  cursor: not-allowed;
  opacity: 0.6;
}

.stop-btn {
  background: #ef4444 !important;
  border-color: #ef4444 !important;
}

.stop-btn:hover {
  background: #dc2626 !important;
  transform: translateY(-1px);
}

/* 關閉按鈕樣式 */
.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  padding: 6px 14px;
  color: white;
  transition: all 0.3s;
  margin-left: 4px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.collapsible-content {
  transition: all 0.3s ease;
}

.task-input-section {
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.task-input-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
}

.label-icon {
  font-size: 14px;
}

.task-textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  transition: all 0.3s;
  box-sizing: border-box;
  background: white;
}

.task-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.task-input-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: #999;
}

.clear-task-btn {
  padding: 4px 12px;
  background: #e0e0e0;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 11px;
  color: #666;
  transition: all 0.2s;
}

.clear-task-btn:hover {
  background: #d0d0d0;
}

.quick-tasks {
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.quick-tasks-title {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  margin-bottom: 10px;
}

.quick-tasks-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-task-btn {
  padding: 6px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  color: #555;
}

.quick-task-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: translateY(-1px);
}

.current-step {
  padding: 14px 20px;
  background: linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%);
  border-left: 4px solid #f59e0b;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: #333;
}

.step-icon {
  font-size: 16px;
}

.log-panel {
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.log-title {
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 2px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.log-count {
  font-size: 11px;
  background: #e0e0e0;
  padding: 2px 8px;
  border-radius: 10px;
  color: #666;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #fafbfc;
  min-height: 200px;
  max-height: 300px;
}

.log-item {
  padding: 8px 12px;
  margin-bottom: 6px;
  background: white;
  border-radius: 8px;
  font-size: 12px;
  font-family: "Courier New", "Monaco", monospace;
  color: #333;
  border-left: 3px solid #667eea;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
}

.log-item:hover {
  transform: translateX(2px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.log-error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.log-success {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.log-empty {
  text-align: center;
  color: #999;
  padding: 40px 20px;
  font-size: 13px;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.dialog {
  background: white;
  border-radius: 16px;
  min-width: 350px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  animation: dialogSlideIn 0.2s ease-out;
}

@keyframes dialogSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.dialog-header {
  padding: 20px 24px 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  gap: 10px;
}

.dialog-icon {
  font-size: 24px;
}

.dialog-header h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.dialog-content {
  padding: 24px;
}

.dialog-content p {
  margin: 0 0 16px 0;
  color: #555;
  font-size: 14px;
  line-height: 1.5;
}

.dialog-content input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s;
  box-sizing: border-box;
}

.dialog-content input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dialog-buttons {
  padding: 12px 24px 24px 24px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.dialog-buttons button {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-cancel {
  background: #f0f0f0;
  color: #666;
}

.btn-cancel:hover {
  background: #e0e0e0;
  transform: translateY(-1px);
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
