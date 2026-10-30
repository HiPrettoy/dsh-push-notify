# dsh-push-notify

[![npm version](https://img.shields.io/npm/v/dsh-push-notify.svg)](https://www.npmjs.com/package/dsh-push-notify)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/dsh) 多渠道实时消息推送插件。

当 Agent **对话回合结束**、**需要高权限审批确认**、**等待用户选择输入** 或 **发生未捕获异常** 时，通过 **Bark (iOS)** 和 **ntfy (Android / iOS / Web / Desktop)** 实时推送提醒至你的移动设备与桌面端。

---

## ✨ 核心特性

- 📱 **多渠道通知覆盖**：
  - **Bark (iOS)**：专为 iPhone 设计的极简低功耗 APNs 推送，内置经典短促提示音（如 `bell` 清脆铃声、`chime` 清幽和弦等），告别冗长刺耳。
  - **ntfy (全平台)**：支持 Android、iOS、网页端及各桌面客户端，支持官方云端或任意自建 ntfy 实例、Topic 订阅与 Access Token 鉴权。
- ⚙️ **完整的 Web UI 图形化设置**：
  - 自动集成至 DSH 的 **“更多 -> 设置 -> 通知推送”**，随时在浏览器端开/关通道、调整配置与铃声。
  - 支持分别对 Bark、ntfy 进行单通道独立测试，或一键测试所有通道。
- 🎯 **精准的生命周期事件拦截**：
  - ❓ **等待用户回答 / 选择方案 (`ask_user_question`)**：自动解析提问标题、具体问题正文及候选项，完整推送到手机。
  - ⚠️ **等待权限批准 (`approval/request`)**：当 Agent 请求执行危险命令或高权限文件修改时及时告警。
  - ✅ **对话回合结束 (`agent/turn-stopping`)**：长任务、多轮工具调用思考完毕后提醒下一轮指令。
  - ❌ **运行异常告警 (`agent/error`)**：捕获异常并在手机端紧急提醒。
- 🔗 **一键唤醒回跳**：
  - 通知支持附带 DSH Web UI 地址，手机端点击通知直接唤起当前会话页面进行审批或交互。

---

## 📦 安装方式

### 方式 1：使用 npm 安装（推荐）

在运行 DSH 的环境中，使用标准 `dsh` CLI 命令即可一键安装：

```bash
# 如果使用指定 profile（例如 web profile）
dsh plugin --profile web add dsh-push-notify

# 或全局默认 profile
dsh plugin add dsh-push-notify
```

### 方式 2：使用本地包 / tgz 安装

```bash
dsh plugin add ./dsh-push-notify-1.0.0.tgz
```

---

## 🚀 使用指南

1. 安装完成后，刷新 DSH Web 页面。
2. 打开左下角 **“更多” -> “设置” -> “通知推送”**。
3. 根据需要开启通道：
   - **Bark**：填写在手机 Bark App 首页获取的 `Device Key`，并选择喜欢的提示音。
   - **ntfy**：填写订阅的 `Topic` 名称（如 `my-dsh-topic-8899`），并在手机或电脑端 ntfy 订阅同名 Topic。
4. 点击 **“测试推送”** 验证连通性。
5. 点击 **“保存配置”**，设置将即时生效并持久化。

---

## 🛠️ 本地开发

```bash
# 克隆仓库
git clone https://github.com/faruzanCN/dsh-push-notify.git
cd dsh-push-notify

# 以软链接方式安装至本地 DSH profile 进行调试
dsh plugin add .
```

---

## 📄 License

[MIT](LICENSE)
