# AI 驱动选科测试 - 设计文档

## 目标

将现有静态 10 题选科测试（生物资讯学 vs 药剂学）改造为 AI LLM 驱动的动态测试。AI 以「顶级人生规划师」身份，理解用户回答并自适应追问（上限 20 题），最终按现有分析规范生成个性化结果。

## 架构

```
┌────────────────────────────────────┐
│  Vercel 项目                        │
│                                    │
│  index.html (静态)                  │
│  ├─ Intro 页                       │
│  ├─ Quiz 页 (AI 动态题目)           │
│  └─ Result 页 (AI 文字 + 静态图表)  │
│       │                            │
│       │ fetch POST                  │
│       ▼                            │
│  api/chat.js (Serverless)          │
│       │ 代理转发                    │
│       ▼                            │
│  api.deepseek.com                  │
│  Model: deepseek-v4-pro            │
│                                    │
│  API Key → Vercel 环境变量 🔒      │
└────────────────────────────────────┘
```

- 两个源文件：`index.html` + `api/chat.js`
- 配置 `vercel.json` 控制路由和构建
- 托管从 GitHub Pages 迁移到 Vercel

## 交互流程

```
Intro → 开始对话
  → POST /api/chat (mode=chat) → AI 返回第1题
  → 用户点选项或自由输入 → 追加到 messages
  → POST /api/chat (mode=chat) → AI 返回下一题
  → ...重复...
  → 用户点「提前结束」或满20题
  → POST /api/chat (mode=analyze) → AI 返回分析 JSON
  → 前端渲染结果页
```

## UI 设计

### Intro 页
保留现有设计不变。按钮文字改为「开始 AI 对话」。

### Quiz 页（AI 动态题目）
保持现有 quiz 卡片风格：
- 进度圆点 + 进度条（第 N / 最多 20 题）
- 每题为一张卡片，包含：
  - AI 生成的维度标签（如「性格维度」「工作偏好」）
  - AI 生成的问题标题
  - AI 生成的副标题描述
  - 2-4 个选项按钮（继承现有 `.ob` 风格，紫色/绿色/青色主题）
- 底部可选「自定义输入」：文本输入框 + 发送按钮，允许用户不选按钮而自由打字
- 导航按钮：「← 返回」「下一题 →」（必须作答后才能下一步）
- 「提前结束，开始分析」按钮始终可见

### Result 页
完全保留现有结果页结构和视觉。改动仅在数据来源：

| 模块 | 数据来源 |
|------|---------|
| 结论标题 + emoji | AI 返回 |
| 综合描述文字 | AI 返回 |
| 综合评分 (B/P%) | AI 返回 scores |
| 六维雷达图 | AI 返回 scores，前端 Canvas 渲染 |
| 四大指标环（大湾区/AI/创业/国际） | AI 返回 scores，前端 SVG 渲染 |
| 10 维度逐项分析 | AI 返回各维度文字 |
| 优劣势列表 | AI 返回 |
| 路线图 | AI 返回 |
| 薪酬表 | 静态硬编码（数据不变） |
| 世界地图/河套机遇 | 静态硬编码（数据不变） |

## 系统 Prompt 设计

AI 以「顶级人生规划师」身份运行 System Prompt：

- 角色：资深香港升学与生涯规划顾问，专攻生物资讯学 vs 药剂学比较
- 知识库嵌入：
  - 10 个评估维度：性格、工作偏好、学科强项、进修意愿、薪酬期望、时间成本、未来方向、AI 态度、发展视野、创业精神
  - 2026 年最新数据：药厂起薪、药厂 PhD 津贴、河套园区、全球 Biotech Hub
- 规则：
  - 每次回复给出问题 + 2-4 个选项（每个选项含 emoji、标题、描述、倾向标签）
  - 允许用户自由输入
  - 理解回答后分析并追问，逐步覆盖 10 个维度
  - 上限 20 轮
- 当前第几题、进度百分比由前端自行计算，不依赖 AI

## API 设计

### `POST /api/chat`

单一 endpoint，通过 `mode` 参数区分：

**对话模式 (mode=chat)**：

请求:
```json
{
  "messages": [{ "role": "user", "content": "..." }, ...],
  "mode": "chat"
}
```

响应: AI 返回下一题
```json
{
  "type": "question",
  "chip": "💼 工作偏好",
  "question": "你更喜欢哪一种工作环境？",
  "subtitle": "想象你每天上班最享受的场景",
  "options": [
    { "emoji": "🏥", "title": "面对病人", "desc": "直接帮助病人...", "tag": "→ 药剂学" },
    { "emoji": "💻", "title": "分析数据", "desc": "写程式、逻辑推理...", "tag": "→ 生物资讯学" }
  ]
}
```

**分析模式 (mode=analyze)**：

请求:
```json
{
  "messages": [{ "role": "user", "content": "..." }, ...],
  "mode": "analyze"
}
```

响应:
```json
{
  "type": "analysis",
  "scores": { "B": 72, "P": 45, "G": 60, "AI": 80, "EN": 55, "IT": 70 },
  "resultType": "bio",
  "emoji": "🧬",
  "title": "生物资讯学（Bioinformatics）",
  "summaryText": "你是一个充满探索精神...",
  "dimensions": [
    { "icon": "🌟", "label": "性格", "value": "探索型 → 🧬" },
    ...
  ],
  "pros": ["全球流动性极强...", "资深科学家年薪可达..."],
  "cons": ["本科初期起薪较低...", "需读博士..."],
  "roadmap": [
    { "emoji": "📚", "year": "第1-4年", "desc": "港大 BBiomedSc...", "salary": "..." },
    ...
  ]
}
```

## 前端状态管理

```js
let state = {
  phase: 'intro',       // 'intro' | 'quiz' | 'result'
  messages: [],          // 完整对话历史 [{role, content}, ...]
  currentQuestion: null, // 当前 AI 返回的题目
  answers: [],           // 用户答案
  analysisData: null,    // AI 分析结果
};
```

## 错误处理

- API 超时（10s）：显示「AI 正在思考，请稍候...」
- API 返回错误：显示重试按钮 + 错误信息
- 网络断开：提示检查网络连接
- 上一题未作答：禁止前进到下一题

## 迁移部署

1. 移除 GitHub Pages
2. 安装 Vercel CLI 或通过 Vercel Dashboard 导入 GitHub 仓库
3. 设置环境变量 `DEEPSEEK_API_KEY`
4. 部署后获得 `*.vercel.app` 域名

## 不涉及

- 后端无需数据库/存储
- 不记录用户数据
- 不涉及用户认证/登录
- 不改变现有静态内容（薪酬表、世界地图、河套机遇等）
