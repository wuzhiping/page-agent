<template>
  <div
    class="custom-agent-ui"
    :class="{ collapsed: isCollapsed }"
    v-show="!isClosed"
  >
    <div class="control-panel">
      <!-- ✅ 动态状态指示器 -->
      <div class="status-indicator" :class="statusClass">
        <span class="status-dot"></span>
        <span class="status-text">{{ agentStatusText }}</span>
      </div>

      <div class="collapsible-content">
        <div class="task-input-section">
          <div class="task-input-label">
            <span>🤖 Agent</span>
            <button @click="closePanel" class="close-btn" title="關閉">
              ✕
            </button>
          </div>

          <div
            style="
              display: flex;
              justify-content: space-between;
              align-items: center;
            "
          >
            <yysbcc
              :disableSentBtn="isRunning"
              @recordText="recordText"
              style="color: white"
            />
            <input
              v-model="customTask"
              class="task-textarea"
              placeholder="请输入您想要 AI 执行的任务"
              @keyup.enter="runTask"
            />
            <div class="header-buttons">
              <button
                v-if="isRunning"
                @click="stopTask"
                class="stop-btn"
                title="暫停"
              >
                暫停
              </button>
              <button
                v-else
                @click="runTask"
                :disabled="!agent"
                class="run-btn"
              >
                發送
              </button>
            </div>
          </div>

          <div class="task-input-hint">
            <span>💡 提示：支援自然語言描述，AI 會自動理解並執行</span>
            <button class="clear-task-btn" @click="clearTask" title="清空輸入">
              清空
            </button>
          </div>
        </div>

        <div class="quick-tasks">
          <div class="quick-tasks-buttons">
            <button
              v-for="item in question"
              :key="item"
              class="quick-task-btn"
              @click="setQuickTask(item)"
            >
              {{ item }}
            </button>
          </div>
        </div>

        <div class="log-panel">
          <div class="log-title">
            <div class="header-left">
              <button
                class="collapse-btn"
                @click="toggleCollapse"
                :title="isCollapsed ? '展開' : '摺疊'"
              >
                <span class="collapse-icon">{{ isCollapsed ? "◀" : "▼" }}</span>
              </button>
              <span>📋 執行日誌</span>
            </div>
            <span class="log-count">{{ logs.length }} 條記錄</span>
          </div>

          <div
            :style="{ maxHeight: !isCollapsed ? '500px' : '55px' }"
            class="log-content"
          >
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

      <!-- 用户输入弹窗 -->
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
import { ref, onMounted, onUnmounted, computed } from "vue";
import { PageAgentCore } from "@page-agent/core";
import { PageController } from "@page-agent/page-controller";
import yysbcc from "./yysbcc.vue";
import axios from "axios";

// ================== 状态 ==================
const isRunning = ref(false);
const logs = ref([]);
const showInputDialog = ref(false);
const pendingQuestion = ref("");
const inputValue = ref("");
const inputRef = ref(null);
const customTask = ref("");
const isCollapsed = ref(true);
const isClosed = ref(false);
const question = ref([]);

let agent = null;
let inputResolver = null;
let originalConsoleLog = null;

// ✅ 状态指示器文案
const agentStatusText = ref("⏳ 初始化中...");

// ✅ 状态 class
const statusClass = computed(() => {
  if (agentStatusText.value.includes("執行中")) return "running";
  if (agentStatusText.value.includes("暫停")) return "paused";
  if (
    agentStatusText.value.includes("錯誤") ||
    agentStatusText.value.includes("失敗")
  )
    return "error";
  if (
    agentStatusText.value.includes("完成") ||
    agentStatusText.value.includes("就緒")
  )
    return "complete";
  return "";
});

// ================== 日志 ==================
const formatLog = (type, content, step = null) => {
  const time = new Date().toLocaleTimeString();
  const prefix = step ? `步骤 ${step}` : "";
  return prefix
    ? `[${time}] ${type} ${prefix}\n   ${content}`
    : `[${time}] ${type} ${content}`;
};

const addOfficialLog = (type, content, step = null) => {
  logs.value.unshift(formatLog(type, content, step));
  if (logs.value.length > 200) logs.value.pop();
};

const addLog = (msg) => {
  logs.value.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  if (logs.value.length > 200) logs.value.pop();
};

const recordText = (text) => {
  customTask.value = text;
};

// ================== UI ==================
const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value;
};

const clearTask = () => {
  customTask.value = "";
  addLog("🗑️ 已清空输入框");
};

const setQuickTask = (item) => {
  if (isRunning.value) {
    addLog("⚠️ 请先停止当前任务");
    return;
  }
  customTask.value = item;
  addOfficialLog("⚡", `已加载快速任务: ${item}`);
  runTask();
};

const closePanel = () => {
  isClosed.value = true;
  addLog("🔒 面板已关闭");
};

const getLogClass = (log) => {
  if (log.includes("❌") || log.includes("错误")) return "log-error";
  if (log.includes("✅") || log.includes("成功")) return "log-success";
  if (log.includes("🧠") || log.includes("思考")) return "log-thinking";
  if (log.includes("🔨")) return "log-action";
  if (log.includes("🤖")) return "log-complete";
  return "";
};

// ================== 核心：任务真正结束时调用 ==================
const finishTaskUI = () => {
  // 防止重复触发
  if (!isRunning.value) return;

  isRunning.value = false;
  customTask.value = ""; // ✅ 清空输入框
  agentStatusText.value = "✅ Agent 已就绪";
};

// ================== 停止 ==================
const stopTask = async () => {
  if (agent?.stop) {
    await agent.stop();
  }

  if (inputResolver) {
    inputResolver.reject(new Error("已停止"));
    inputResolver = null;
    showInputDialog.value = false;
    inputValue.value = "";
  }

  isRunning.value = false;
  agentStatusText.value = "⏸️ 已暫停";
  customTask.value = "";
};

// ================== 执行 ==================
const runTask = async () => {
  if (!agent) {
    addOfficialLog("❌", "Agent 未初始化");
    return;
  }
  if (isRunning.value) {
    addOfficialLog("⚠️", "任务执行中，请先停止");
    return;
  }

  const task = customTask.value.trim();
  if (!task) {
    addOfficialLog("⚠️", "请输入任务");
    return;
  }

  isRunning.value = true;
  agentStatusText.value = "⏳ 任務執行中";

  addOfficialLog("🎯", task);
  addOfficialLog("👁️", "Page navigated to → " + window.location.href);

  // ✅ 只负责执行，不负责结束状态
  await agent.execute(task);
};

// ================== Agent 初始化 ==================
const getPageAgent = async () => {
  const res = await axios.get("https://abc.feg.com.tw/oauth2/pageAgent");
  question.value = res.data.question;
  return res.data;
};

const initAgent = async () => {
  try {
    const res = await getPageAgent();
    const pageController = new PageController({ enableMask: true });

    agent = new PageAgentCore({
      pageController,
      model: res.model,
      baseURL: res.baseURL,
      apiKey: res.apiKey,
    });

    agent.addEventListener("statuschange", () => {
      // 仅作为辅助参考，不直接决定完成状态
      isRunning.value = agent.status === "running";
    });

    agent.addEventListener("askuser", async (e) => {
      const q = e.detail?.question || e.detail;
      if (!q || !isRunning.value) throw new Error("任务已停止");

      addOfficialLog("❓", `需要确认: ${q}`);
      pendingQuestion.value = q;

      showInputDialog.value = true;
      setTimeout(() => inputRef.value?.focus(), 100);

      return new Promise((resolve, reject) => {
        inputResolver = { resolve, reject };
      });
    });

    agent.addEventListener("error", (e) => {
      const err = e.detail?.error || e.detail;
      if (err?.name !== "AbortError") {
        addOfficialLog("❌", err?.message || "未知错误");
        agentStatusText.value = "❌ 發生錯誤";
      }
      isRunning.value = false;
      customTask.value = "";
    });

    // ✅ taskcomplete 只记录日志，不碰 UI
    agent.addEventListener("taskcomplete", (e) => {
      const result = e.detail?.result || e.detail;
      addOfficialLog(
        "🤖",
        `任务执行完成！\n${typeof result === "string" ? result : JSON.stringify(result, null, 2)}`,
      );
    });

    agentStatusText.value = "✅ Agent 已就绪";
    addOfficialLog("🎉", "Agent 初始化完成");
  } catch (error) {
    agentStatusText.value = "❌ 初始化失敗";
    addOfficialLog("❌", `初始化失败: ${error.message}`);
  }
};

// ================== 输入弹窗 ==================
const submitInput = () => {
  if (inputResolver) {
    inputResolver.resolve(inputValue.value);
    inputResolver = null;
  }
  showInputDialog.value = false;
  addOfficialLog("💬", `输入: ${inputValue.value}`);
  inputValue.value = "";
};

const cancelInput = () => {
  if (inputResolver) {
    inputResolver.reject(new Error("使用者取消"));
    inputResolver = null;
  }
  showInputDialog.value = false;
  inputValue.value = "";
  addOfficialLog("❌", "取消输入");
};

// ================== Console 日志拦截（关键） ==================
const formatConsoleLog = (msg) => {
  let formatted = msg;

  const patterns = [
    {
      pattern: /\[PageController\]\s+cleanUpHighlights/,
      replacement: "🧹 清理高亮标记",
    },
    {
      pattern: /Executing tool:\s+(\w+)\s+(.+)/,
      replacement: "🔨 执行工具: $1 $2",
    },
    {
      pattern: /Tool\s+\((\w+)\)\s+executed/,
      replacement: "✅ 工具 $1 执行完成",
    },
    {
      pattern: /Input text \((.+)\) into element/,
      replacement: '⌨️ 输入文本: "$1"',
    },
    { pattern: /Clicked element/, replacement: "🖱️ 点击元素" },
    { pattern: /✅:\s+(.+)/, replacement: "✓ $1" },
    { pattern: /💾:\s+(.+)/, replacement: "💾 $1" },
    { pattern: /🎯:\s+(.+)/, replacement: "🎯 $1" },
    { pattern: /🧠\s+Thinking\.\.\./, replacement: "🧠 思考中..." },
    { pattern: /👀\s+Observing\.\.\./, replacement: "👁️ 观察页面..." },
  ];

  for (const { pattern, replacement } of patterns) {
    if (pattern.test(formatted)) {
      formatted = formatted.replace(pattern, replacement);

      // ✅✅✅ 真·任务结束信号
      if (replacement === "🧹 清理高亮标记") {
        finishTaskUI();
      }

      break;
    }
  }

  return formatted;
};

// ================== 生命周期 ==================
onMounted(() => {
  originalConsoleLog = console.log;
  console.log = (...args) => {
    originalConsoleLog(...args);
    const msg = args.map((a) => String(a)).join(" ");
    if (
      !msg.includes("MouseEvent") &&
      !msg.includes("KeyboardEvent") &&
      !msg.includes("scrollData")
    ) {
      const formattedMsg = formatConsoleLog(msg);
      if (!formattedMsg.includes("MacroTool input")) {
        addLog(formattedMsg);
      }
    }
  };
  initAgent();
});

onUnmounted(() => {
  if (originalConsoleLog) console.log = originalConsoleLog;
  agent?.stop();
  agent?.dispose();
});
</script>

<style scoped>
.status-indicator {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: white;
  transition: background 0.3s;
}

.status-indicator.running {
  background: linear-gradient(135deg, #3b82f620, #2563eb20);
}
.status-indicator.paused {
  background: linear-gradient(135deg, #f59e0b20, #d9770620);
}
.status-indicator.error {
  background: linear-gradient(135deg, #ef444420, #dc262620);
}
.status-indicator.complete {
  background: linear-gradient(135deg, #22c55e20, #16a34a20);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 1.5s ease-in-out infinite;
}

.status-indicator.running .status-dot {
  background: #3b82f6;
}
.status-indicator.error .status-dot {
  background: #ef4444;
  animation: none;
}
.status-indicator.paused .status-dot {
  background: #f59e0b;
  animation: none;
}
.status-indicator.complete .status-dot {
  background: #22c55e;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}
.custom-agent-ui {
  position: fixed;
  bottom: 20px;
  right: 50%;
  transform: translate(50%, 0px);
  z-index: 10000000000;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Microsoft YaHei", sans-serif;
  transition: all 0.3s ease;
}

.control-panel {
  min-width: 360px;
  max-width: 400px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 16px #0009;
  background: #02001480;
}

/* 状态指示器样式 - 简洁版 */
.status-indicator {
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea20, #764ba220);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: white;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.status-text {
  font-weight: 500;
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

.run-btn,
.header-buttons button {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
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

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  padding: 0px 6px;
  color: white;
  transition: all 0.3s;
  margin-left: 4px;
  color: red;
  background: #645470;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
}

.collapsible-content {
  transition: all 0.3s ease;
  padding-bottom: 14px;
}

.task-input-section {
  padding: 14px 14px;
  border-bottom: 1px solid #e0e0e0;
}

.task-input-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: white;
  margin-bottom: 10px;
}

.task-textarea {
  width: calc(100% - 110px);
  padding: 8px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  transition: all 0.3s;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.9);
}

.task-textarea:focus {
  outline: none;
  border-color: #30b6ff99;
}

.task-input-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 11px;
  color: white;
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
  padding: 14px 14px;
  border-bottom: 1px solid #e0e0e0;
}

.quick-tasks-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-task-btn {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  color: white;
  background: rgba(255, 255, 255, 0.2);
}

.quick-task-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: translateY(-1px);
}

.log-panel {
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.log-title {
  padding: 14px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: white;
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
  max-height: 100px;
  border-top: 2px solid #e0e0e0;
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
  transition: all 0.2s;
  word-break: break-all;
  background: linear-gradient(135deg, #9333ea1a, #9333ea0d);
  box-shadow:
    inset 0 1px #ffffff1a,
    0 1px 3px #0000001a;
  backdrop-filter: blur(10px);
}

.log-item:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.log-error {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.log-success {
  border-left-color: #10b981;
  background: linear-gradient(135deg, #22c55e1a, #22c55e0d);
}

.log-thinking {
  border-left-color: #f59e0b;
  background: linear-gradient(135deg, #f59e0b1a, #f59e0b0d);
}

.log-action {
  border-left-color: #3b82f6;
  background: linear-gradient(135deg, #3b82f61a, #3b82f60d);
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
