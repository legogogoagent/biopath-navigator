# 🧬 选科智能罗盘 2026

> AI 驱动的生物资讯学 vs 药剂学选科分析工具。DeepSeek V4 Pro 以「顶级人生规划师」身份自适应追问（上限 20 题），生成个性化生涯分析报告。

**Demo**: [biopath-navigator.vercel.app](https://biopath-navigator.vercel.app)

## 架构

```
┌─────────────────────────────────────────┐
│  Vercel (全栈托管)                        │
│                                          │
│  index.html (SPA, 原生 JS)               │
│  ┌──────────────────────────────────┐   │
│  │ Intro → 开始 AI 对话               │   │
│  │   ↓                                │   │
│  │ Quiz (AI 动态题目, max 20 题)       │   │
│  │  - 选项按钮 (继承 .ob 设计系统)     │   │
│  │  - 自定义输入                       │   │
│  │  - 加载旋转动画                     │   │
│  │   ↓                                │   │
│  │ Result (AI 文字 + Canvas/SVG 图表)  │   │
│  │  - 综合评分条                       │   │
│  │  - 六维雷达图 (Canvas)              │   │
│  │  - 四大指标环 (SVG)                │   │
│  │  - 10 维度逐项分析                  │   │
│  │  - 薪酬对照表 / 路线图 / 全球机遇   │   │
│  └──────────────────────────────────┘   │
│       │ fetch POST /api/chat            │
│       ▼                                  │
│  api/chat.js (Serverless Function)       │
│       │ OpenAI-compatible API            │
│       ▼                                  │
│  api.deepseek.com / deepseek-v4-pro     │
│                                          │
│  DEEPSEEK_API_KEY → Vercel Env Var      │
└─────────────────────────────────────────┘
```

## 文件结构

```
├── index.html          # 前端 SPA (HTML + inline CSS + inline JS)
├── api/
│   └── chat.js         # Vercel Serverless 函数 (DeepSeek API 代理)
├── vercel.json         # Vercel 路由配置
└── docs/
    └── superpowers/
        ├── specs/      # 设计文档
        └── plans/      # 实现计划
```

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Vanilla HTML/CSS/JS (零依赖) |
| 后端 | Vercel Serverless Functions (Node.js) |
| AI | DeepSeek V4 Pro (OpenAI-compatible API) |
| 托管 | Vercel (Production) + GitHub Pages (旧静态版) |
| 图表 | Canvas (雷达图) + SVG (环形指标) |

## 数据流

### 1. 对话模式 (mode=chat)

```
用户点击选项 / 输入文字
  → frontend 追加到 state.messages[]
  → POST /api/chat { messages, mode: "chat" }
  → api/chat.js 转发 DeepSeek (system prompt + history + instruction)
  → DeepSeek 返回 JSON { type: "question", question, options[] }
  → frontend renderQ() 渲染题目卡片
```

### 2. 分析模式 (mode=analyze)

```
用户点击「提前结束」或满 20 题
  → POST /api/chat { messages, mode: "analyze" }
  → DeepSeek 返回 JSON { type: "analysis", scores, dimensions, pros, cons, roadmap }
  → frontend showResult() 渲染完整报告
```

## API 端点

### `POST /api/chat`

| 字段 | 类型 | 描述 |
|------|------|------|
| `messages` | `array` | OpenAI 格式对话历史 `[{role, content}]` |
| `mode` | `string` | `"chat"` 返回下一题 / `"analyze"` 返回分析报告 |

**Chat 响应:**

```json
{
  "type": "question",
  "chip": "性格類型",
  "question": "你更喜歡哪一種工作環境？",
  "subtitle": "請選擇最貼近你的場景",
  "options": [
    { "emoji": "🏥", "title": "面對病人", "desc": "直接幫助病人...", "tag": "→ 藥劑學" },
    { "emoji": "💻", "title": "分析數據", "desc": "編程、邏輯推理...", "tag": "→ 生物資訊學" }
  ]
}
```

**Analyze 响应:**

```json
{
  "type": "analysis",
  "scores": { "B": 72, "P": 45, "G": 60, "AI": 80, "EN": 55, "IT": 70 },
  "resultType": "bio",
  "emoji": "🧬",
  "title": "生物資訊學（Bioinformatics）",
  "summaryText": "个性化综合描述...",
  "dimensions": [{ "icon": "🌟", "label": "性格", "value": "探索型 → 🧬" }],
  "pros": ["优势1", "优势2", ...],
  "cons": ["挑战1", "挑战2", ...],
  "roadmap": [{ "emoji": "📚", "year": "第1-4年", "desc": "...", "salary": "..." }]
}
```

## 前端状态管理

```js
let state = {
  phase: 'intro',        // 'intro' | 'quiz' | 'result'
  messages: [],          // 对话历史 [{role, content}]
  curQ: null,            // 当前 AI 返回的题目对象
  answers: [],           // 用户已选答案
  curIdx: 0,             // 当前题号 (0-based)
  selIdx: null,          // 当前题已选选项索引
  analyzing: false,      // 是否正在分析中
  analysisData: null     // AI 分析结果
};
```

## 交互设计

- **每道题**：AI 生成问题 + 2-4 个选项按钮（继承现有视觉风格）
- **自定义输入**：允许用户不选按钮、自由打字（fallback 模式）
- **加载状态**：提交后显示旋转 spinner + 隐藏操作按钮，防止重复点击
- **返回**：支持退回上一题（重新请求 AI 生成新题目）
- **提前结束**：任意时刻可跳过剩余题目直接获取分析
- **上限**：最多 20 轮对话

## 10 个评估维度

1. 🌟 性格类型 — 稳建型 vs 探索型
2. 💼 工作偏好 — 面对病人 vs 面对数据
3. 📚 学科强项 — 生物化学 vs 数理电脑
4. 🎓 进修意愿 — 即時工作 vs 愿读博士
5. 💰 薪酬期望 — 高起点 vs 高天花板
6. ⏰ 时间成本 — 即时回报 vs 先苦后甜
7. 🔭 未来方向 — 临床执业 vs 科技研发
8. 🤖 AI 态度 — 避开 AI vs 拥抱 AI
9. 🌏 发展视野 — 本地 vs 大湾区 vs 全球
10. 🚀 创业精神 — 稳定打工 vs 创业

## 6 维评分指标

| 指标 | 含义 |
|------|------|
| B (生物资讯学) | 对 Bioinformatics 的适配度 |
| P (药剂学) | 对 Pharmacy 的适配度 |
| G (大湾区) | 河套园区 / 大湾区机遇匹配度 |
| AI (AI适应力) | 与 AI 共处/推动 AI 浪潮的能力 |
| EN (创业潜力) | Biotech 创业精神 |
| IT (国际流动力) | 全球流动职业适配度 |

## 部署

### 前置条件

- [Vercel 账号](https://vercel.com) (免费额度: 10 万次函数调用/月)
- [DeepSeek API Key](https://platform.deepseek.com)

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/legogogoagent/biopath-navigator.git
cd biopath-navigator

# 2. 部署到 Vercel
npx vercel --prod

# 3. 设置环境变量
# Vercel Dashboard → Settings → Environment Variables
# Key: DEEPSEEK_API_KEY
# Value: sk-xxxxxxxxxxxxxxxx
```

### 环境变量

| Key | 描述 | 必需 |
|-----|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | 是 |

## System Prompt 设计

AI 以「顶级人生规划师」身份运行，嵌入以下知识：

- **10 个评估维度**及评分逻辑
- **2026 年最新数据**：
  - 衞生署药剂师起薪 HK$61,865/月
  - 生物资讯学资深科学家年薪 HK$107 万+
  - 河套香港园区 60+ 企业进驻
  - 全球 Biotech Hub (波士顿、伦敦、新加坡、巴塞尔)
- **规则**：自适应追问、结构化 JSON 输出、2-4 选项引导、接受自由输入

详见 `api/chat.js` 中的 `SYSTEM_PROMPT`。

## 双版本

| 版本 | 链接 | 描述 |
|------|------|------|
| 🤖 AI 自适应版 | [biopath-navigator.vercel.app](https://biopath-navigator.vercel.app) | 当前版本，DeepSeek 驱动 |
| 📋 旧静态版 | [legogogoagent.github.io/biopath-navigator](https://legogogoagent.github.io/biopath-navigator/) | 原始 10 题固定测试 |

旧版代码保留在 `gh-pages` 分支，通过 GitHub Pages 托管。
