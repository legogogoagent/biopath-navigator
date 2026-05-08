# AI 驱动选科测试 - 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将静态 10 题 quiz 改造为 AI LLM 驱动，AI 自适应追问（上限 20 题），按现有分析规范渲染结果页

**Architecture:** Vercel 全栈 — `index.html` 静态页面 + `api/chat.js` Serverless 函数代理 DeepSeek API。API Key 存 Vercel 环境变量

**Tech Stack:** HTML/CSS/JS (原生), Vercel Serverless Functions (Node.js), DeepSeek API (OpenAI 兼容)

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `api/chat.js` | 创建 | Vercel Serverless 函数，代理 DeepSeek API |
| `vercel.json` | 创建 | Vercel 路由和构建设置 |
| `index.html` | 修改 | 静态前端：新增 CSS / HTML 元素 / 重写 JS 逻辑 |

---

### Task 1: 创建 Vercel 配置文件

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: 创建 vercel.json**

```json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/$1" }],
  "buildCommand": null,
  "outputDirectory": "."
}
```

- [ ] **Step 2: 验证文件存在**

Run: `cat vercel.json`
Expected: 输出上述 JSON

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel configuration"
```

---

### Task 2: 创建 API 代理函数

**Files:**
- Create: `api/chat.js`

- [ ] **Step 1: 创建 api/chat.js**

```js
const SYSTEM_PROMPT = `你是一位资深香港升学与生涯规划顾问，专攻生物资讯学（Bioinformatics）与药剂学（Pharmacy）的选科比较。你以「顶级人生规划师」身份对用户提问。

## 你的知识库
- 10 个评估维度：性格类型、工作偏好、学科强项、进修意愿、薪酬期望、时间成本、未来方向、AI冲击态度、发展视野、创业精神
- 2026 年最新信息：
  - 衞生署药剂师起薪 HK$61,865/月，医管局约 $56,450/月
  - 生物资讯学初级（1-3年）月薪约 $35,000-42,000，资深科学家年薪可达 HK$107 万+
  - 河套香港园区已开园，60+ 企业进驻，生命健康科技与 AI 为核心产业
  - 药厂 PhD 津贴近 $18,500-$28,400/月
  - 全球 Biotech Hub：波士顿、伦敦、新加坡、巴塞尔等

## 对话模式（默认）
当收到 mode=chat 时，根据对话历史提出下一个问题。
- 每次回复仅返回一条 JSON，包含一道题目
- 每道题给出 2-4 个选项（每个选项含 emoji、title、desc、tag）
- 根据用户的上一个回答，自适应追问，逐步覆盖 10 个维度
- 如对话历史超过 18 轮，提示用户即将结束
- JSON 格式：
{
  "type": "question",
  "chip": "维度标签中文",
  "question": "问题标题",
  "subtitle": "副标题描述",
  "options": [
    { "emoji": "🔬", "title": "选项标题", "desc": "选项描述", "tag": "倾向标签" }
  ]
}

## 分析模式
当收到 mode=analyze 时，综合分析完整对话历史，返回最终分析结果。
- 评估用户在 10 个维度上的偏向
- 给出综合评分（B=生物资讯学适配%, P=药剂学适配%, G=大湾区指数%, AI=AI适应力%, EN=创业潜力%, IT=国际流动力%）
- 确定 resultType：bio（明显倾向生物资讯学）、pha（明显倾向药剂学）、tie（两者均衡）
- 给出个性化分析文字、优势列表、挑战列表、职业路线图
- JSON 格式：
{
  "type": "analysis",
  "scores": { "B": 72, "P": 45, "G": 60, "AI": 80, "EN": 55, "IT": 70 },
  "resultType": "bio",
  "emoji": "🧬",
  "title": "生物资讯学（Bioinformatics）",
  "summaryText": "个性化的综合描述...",
  "dimensions": [
    { "icon": "🌟", "label": "性格", "value": "探索型 → 🧬" }
  ],
  "pros": ["优势1", "优势2", "优势3", "优势4", "优势5", "优势6"],
  "cons": ["挑战1", "挑战2", "挑战3", "挑战4"],
  "roadmap": [
    { "emoji": "📚", "year": "第1-4年", "desc": "...", "salary": "..." }
  ]
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const userContent = mode === 'analyze'
    ? '请综合分析以上对话，按指定JSON格式返回分析结果。'
    : '请根据对话历史提出下一个问题，按指定JSON格式返回。';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
          { role: 'user', content: userContent },
        ],
        temperature: 0.7,
        max_tokens: mode === 'analyze' ? 4096 : 2048,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `DeepSeek API error: ${response.status}`, detail: err });
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({ error: 'Failed to parse AI response as JSON', raw: content });
    }

    return res.json(parsed);
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'AI 响应超时，请重试' });
    }
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
```

- [ ] **Step 2: 验证文件存在**

Run: `cat api/chat.js | head -5`
Expected: 输出函数开头

- [ ] **Step 3: Commit**

```bash
mkdir -p api && git add api/chat.js
git commit -m "feat: add API proxy function for DeepSeek"
```

---

### Task 3: 添加新 UI 元素的 CSS

**Files:**
- Modify: `index.html` (在 `</style>` 前插入新样式)

- [ ] **Step 1: 添加自定义输入行和提前结束按钮样式**

在 `</style>` 前（约第 242 行）插入：

```css
.custom-row{display:flex;gap:8px;margin-top:18px;align-items:center}
.custom-inp{flex:1;padding:13px 18px;border-radius:50px;border:2.5px solid var(--border);font-size:14px;font-family:inherit;color:var(--text);outline:none;transition:border-color .25s;background:#fff}
.custom-inp:focus{border-color:var(--bio)}
.custom-inp::placeholder{color:var(--muted)}
.custom-send{padding:13px 22px;border-radius:50px;border:2.5px solid var(--border);background:#fff;color:var(--muted);font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .25s}
.custom-send:hover{border-color:var(--bio);color:var(--bio)}
.end-btn{display:block;width:100%;margin-top:14px;padding:12px;border-radius:50px;border:2px dashed var(--border);background:transparent;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .25s}
.end-btn:hover{border-color:var(--grn);color:var(--grn);background:var(--grn-l)}
```

- [ ] **Step 2: 验证样式已插入**

Run: `grep -c "custom-row" index.html`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add CSS for custom input and early-finish button"
```

---

### Task 4: 修改 HTML 结构

**Files:**
- Modify: `index.html` (更新 Quiz 区 JS 模板和添加新元素)

- [ ] **Step 1: 更新 Intro 页按钮文字**

找到 `开始智能分析 →（约 3 分钟）`（约第 304 行），替换为：

```html
<button class="btn-s" onclick="startQuiz()">开始 AI 对话 →</button>
```

- [ ] **Step 2: 在 Quiz 区底部添加提前结束和自定义输入元素**

在 quiz div 内（约第 316 行的 `</div>` 前，即 `<!-- RESULT -->` 上方），在 `.nav` 之后插入：

```html
<button class="end-btn" id="endBtn" onclick="finishEarly()">🎯 提前结束，查看分析 →</button>
```

- [ ] **Step 3: 验证修改**

Run: `grep -c "开始 AI 对话" index.html`
Expected: `1`
Run: `grep -c "提前结束" index.html`
Expected: `1`

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add early-finish button, update intro text"
```

---

### Task 5: 重写 JS — 状态管理与 API 调用

**Files:**
- Modify: `index.html` (替换现有 `<script>` 块头部，从 `const QS=` 至 `function startQuiz()` 之间)

- [ ] **Step 1: 删除旧的静态题集和旧函数**

删除从 `/* ════ QUESTIONS ════ */`（约第 324 行）到 `function startQuiz(){`（约第 411 行）之间的所有代码，替换为新的状态和 API 函数：

```js
/* ════ STATE ════ */
const MAX_Q = 20;
let state = { phase: 'intro', messages: [], curQ: null, answers: [], curIdx: 0, selIdx: null, analyzing: false };

/* ════ API ════ */
async function callAPI(mode) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: state.messages, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

async function fetchNextQuestion() {
  try {
    const data = await callAPI('chat');
    if (data.type === 'question') {
      state.curQ = data;
      state.selIdx = null;
      renderQ();
    }
  } catch (e) {
    alert('AI 回应失败: ' + e.message + '\n请检查网络后重试。');
  }
}

async function fetchAnalysis() {
  try {
    state.analyzing = true;
    const data = await callAPI('analyze');
    if (data.type === 'analysis') {
      state.analysisData = data;
      showResult(data);
    }
  } catch (e) {
    state.analyzing = false;
    alert('AI 分析失败: ' + e.message + '\n请重试。');
  }
}

function startQuiz() {
  document.getElementById('intro').classList.add('hidden');
  document.getElementById('quiz').classList.remove('hidden');
  state.phase = 'quiz';
  state.messages = [];
  state.answers = [];
  state.curIdx = 0;
  state.selIdx = null;
  state.analyzing = false;
  fetchNextQuestion();
}
```

- [ ] **Step 2: 验证替换正确**

Run: `grep -c "MAX_Q" index.html`
Expected: `1`
Run: `grep -c "callAPI" index.html`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: replace static quiz data with AI API calls and state management"
```

---

### Task 6: 重写 JS — 动态题目渲染与交互

**Files:**
- Modify: `index.html` (替换 `renderQ`、`pick`、`nextQ`、`prevQ`、`upBtn` 函数)

- [ ] **Step 1: 替换 renderQ、pick、nextQ、prevQ、upBtn**

删除旧的 `renderQ()` 到 `upBtn()` 之间的所有代码（约第 427-476 行），替换为：

```js
function renderQ() {
  const q = state.curQ;
  if (!q) {
    document.getElementById('qBox').innerHTML = '<div class="card"><div class="q-title" style="text-align:center">AI 正在思考...</div><div class="q-sub">请稍候片刻</div></div>';
    return;
  }
  const pct = Math.round(((state.curIdx + 1) / MAX_Q) * 100);
  document.getElementById('pFill').style.width = pct + '%';
  document.getElementById('pLbl').textContent = `問題 ${state.curIdx + 1} / 最多 ${MAX_Q}`;
  document.getElementById('bkBtn').style.visibility = state.curIdx === 0 ? 'hidden' : 'visible';

  const csClass = pickChipClass(q.chip);
  let html = `<div class="card">
    <span class="qchip ${csClass}">${q.chip || ''}</span>
    <div class="q-title">${q.question}</div>
    <div class="q-sub">${q.subtitle || ''}</div>
    <div class="opts">`;

  if (q.options && q.options.length) {
    q.options.forEach((o, i) => {
      let cls = '';
      if (state.selIdx === i) {
        cls = o.tag && o.tag.includes('药剂') ? 'sp' : o.tag && o.tag.includes('生物') ? 'sb' : 'sn';
      }
      html += `<button class="ob ${cls}" onclick="pickOption(${i})">
        <div class="ock">${state.selIdx === i ? '✓' : ''}</div>
        <span class="oem">${o.emoji || ''}</span>
        <div>
          <div class="otit">${o.title}</div>
          <div class="odesc">${o.desc}</div>
          ${o.tag ? `<span class="otag ${o.tag.includes('药剂') ? 'tp' : o.tag.includes('生物') ? 'tb' : 'tn'}">${o.tag}</span>` : ''}
        </div>
      </button>`;
    });
  }
  html += `</div>
    <div class="custom-row">
      <input class="custom-inp" id="customInput" type="text" placeholder="或自由输入你的回答...">
      <button class="custom-send" onclick="sendCustom()">发送 ✨</button>
    </div>
  </div>`;

  document.getElementById('qBox').innerHTML = html;
  upBtn();
}

function pickChipClass(chip) {
  if (/AI|人工智能|科技/.test(chip)) return 'qc-ai';
  if (/国际|全球|视野/.test(chip)) return 'qc-intl';
  return 'qc-n';
}

function pickOption(i) {
  state.selIdx = i;
  document.querySelectorAll('.ob').forEach((b, idx) => {
    b.classList.remove('sb', 'sp', 'sn', 'si');
    b.querySelector('.ock').textContent = '';
    if (idx === i) {
      const o = state.curQ.options[i];
      b.classList.add(o.tag && o.tag.includes('药剂') ? 'sp' : o.tag && o.tag.includes('生物') ? 'sb' : 'sn');
      b.querySelector('.ock').textContent = '✓';
    }
  });
  upBtn();
}

async function sendCustom() {
  const inp = document.getElementById('customInput');
  const val = inp.value.trim();
  if (!val) return;
  inp.value = '';
  state.messages.push({ role: 'user', content: val });
  state.answers.push(val);
  state.curIdx++;
  if (state.curIdx >= MAX_Q) {
    await fetchAnalysis();
    return;
  }
  await fetchNextQuestion();
}

function upBtn() {
  const b = document.getElementById('nxBtn');
  if (state.selIdx !== null) {
    b.classList.add('on');
    b.textContent = state.curIdx >= MAX_Q - 1 ? '🎉 查看分析结果' : '下一題 →';
  } else b.classList.remove('on');
}

async function nextQ() {
  if (state.selIdx === null) return;
  const o = state.curQ.options[state.selIdx];
  state.messages.push({ role: 'user', content: `我选择: ${o.emoji} ${o.title}` });
  state.answers.push({ emoji: o.emoji, title: o.title, tag: o.tag });
  state.curIdx++;
  if (state.curIdx >= MAX_Q) {
    await fetchAnalysis();
    return;
  }
  await fetchNextQuestion();
}

async function prevQ() {
  if (state.curIdx <= 0) return;
  state.messages.pop();
  state.answers.pop();
  state.curIdx--;
  state.selIdx = null;
  await fetchNextQuestion();
}

async function finishEarly() {
  if (!confirm('确定要提前结束并查看分析吗？已答 ' + state.curIdx + ' 题。')) return;
  await fetchAnalysis();
}
```

- [ ] **Step 2: 验证新函数存在**

Run: `grep -c "pickOption" index.html`
Expected: `1`
Run: `grep -c "sendCustom" index.html`
Expected: `1`
Run: `grep -c "finishEarly" index.html`
Expected: `1`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: implement dynamic question rendering and interaction"
```

---

### Task 7: 重写 JS — 结果页渲染

**Files:**
- Modify: `index.html` (替换 `calc`、`showResult` 函数，保留 `drawRadar`、`restart`、`copyR`、`dlR`)

- [ ] **Step 1: 替换 calc 和 showResult**

删除 `calc()`（约第 481-493 行）和 `showResult()`（约第 519-724 行），替换为：

```js
function calcFromAI(scores) {
  const { B, P, G, AI, EN, IT } = scores;
  const MX = 100;
  return { B, P, G, AI, EN, IT, MX,
    bP: B, pP: P, gP: G, aiP: AI, enP: EN, itP: IT };
}

function showResult(analysis) {
  document.getElementById('quiz').classList.add('hidden');
  const sc = calcFromAI(analysis.scores);

  let rl, rt;
  if (analysis.resultType === 'bio') { rl = 'rl-b'; rt = 'rt-b'; }
  else if (analysis.resultType === 'pha') { rl = 'rl-p'; rt = 'rt-p'; }
  else { rl = 'rl-t'; rt = 'rt-t'; }

  const dims = analysis.dimensions || [];
  const pros = analysis.pros || [];
  const cons = analysis.cons || [];
  const road = analysis.roadmap || [];
  const isBio = analysis.resultType === 'bio';

  const salTableBio = `<table class="sal-table">
    <tr><th>職涯階段</th><th>年資</th><th>月薪（HKD）</th><th>資料來源</th></tr>
    <tr><td>初級生物資訊分析師（RA）</td><td>0-2 年</td><td>$20,000-$25,000</td><td><span class="sal-badge sb-p">大學研究職</span></td></tr>
    <tr><td>生物資訊工程師（工業界）</td><td>1-3 年</td><td>$35,000-$42,000</td><td><span class="sal-badge sb-b">ERI 薪酬調查</span></td></tr>
    <tr><td>生物資訊科學家（5-10年）</td><td>5-10 年</td><td>$63,000-$80,000</td><td><span class="sal-badge sb-g">ERI 薪酬調查</span></td></tr>
    <tr><td>資深科學家（10年+）</td><td>10 年+</td><td>$80,000-$110,000</td><td><span class="sal-badge sb-g">核實數據</span></td></tr>
    <tr><td>頂尖 AI 藥研專家 / 創業</td><td>15 年+</td><td>$100,000+</td><td><span class="sal-badge sb-g">行業最高位</span></td></tr>
  </table>
  <div class="data-note">⚠️ 注意：RA（研究助理）起薪較低，以大學學術路線為主。如走工業界（藥廠/Biotech），初級工程師薪酬更高。PhD 畢業後起薪通常比本科生高 40-60%。</div>`;

  const salTablePha = `<table class="sal-table">
    <tr><th>機構 / 職級</th><th>月薪（HKD）</th><th>資料來源</th></tr>
    <tr><td>衞生署藥劑師（起薪 MPS P27）</td><td>$61,865</td><td><span class="sal-badge sb-g">政府官方數據</span></td></tr>
    <tr><td>醫管局藥劑師（起薪）</td><td>$56,450</td><td><span class="sal-badge sb-g">醫管局薪級表</span></td></tr>
    <tr><td>私營藥房 / 社區藥劑師</td><td>$45,000-$65,000</td><td><span class="sal-badge sb-b">市場薪酬數據</span></td></tr>
    <tr><td>高級藥劑師（MPS P45-49）</td><td>$117,580-$135,470</td><td><span class="sal-badge sb-g">政府官方數據</span></td></tr>
    <tr><td>總藥劑師 / 管理層</td><td>$150,950-$179,425</td><td><span class="sal-badge sb-g">政府官方數據</span></td></tr>
  </table>
  <div class="data-note">⚠️ 注意：私營藥房薪酬差異較大。近年香港藥劑師供應量上升，部分私營藥房存在薪酬壓力。公營（衞生署/醫管局）起薪最穩定，福利包括退休金及醫療保障。</div>`;

  const worldBio = [
    { flag: '🇺🇸', city: '波士頓', role: 'AI 藥物研發', sal: 'USD $120k-200k' },
    { flag: '🇬🇧', city: '倫敦/劍橋', role: '基因組分析師', sal: 'GBP £55k-90k' },
    { flag: '🇸🇬', city: '新加坡', role: 'Biotech 科學家', sal: 'SGD $80k-150k' },
    { flag: '🇨🇭', city: '巴塞爾', role: 'Roche/Novartis', sal: 'CHF 120k-180k' },
    { flag: '🇨🇳', city: '深圳河套', role: 'AI 醫療研發', sal: 'RMB 50-120 萬/年' },
    { flag: '🇦🇺', city: '墨爾本', role: '精準醫療分析', sal: 'AUD $90k-130k' },
  ];
  const worldPha = [
    { flag: '🇭🇰', city: '香港', role: '衞生署/醫管局', sal: 'HK$61,865 起/月' },
    { flag: '🇬🇧', city: '倫敦', role: 'NHS 臨床藥劑師', sal: 'GBP £35k-50k' },
    { flag: '🇦🇺', city: '澳洲', role: '社區/醫院藥劑師', sal: 'AUD $75k-110k' },
    { flag: '🇸🇬', city: '新加坡', role: '公立醫院藥劑師', sal: 'SGD $48k-75k' },
    { flag: '🇺🇸', city: '美國', role: '臨床藥劑師 NAPLEX', sal: 'USD $120k-160k' },
    { flag: '🇨🇳', city: '大灣區', role: '藥廠 RA / CRA', sal: 'RMB 20-60 萬/年' },
  ];
  const worldData = isBio ? worldBio : worldPha;

  const rEl = document.getElementById('result');
  rEl.classList.remove('hidden');
  rEl.innerHTML = `<div class="rhero">
    <span class="rem">${analysis.emoji || (isBio ? '🧬' : '💊')}</span>
    <div class="rlbl ${rl}">🎯 你的分析結果</div>
    <div class="rtit ${rt}">${analysis.title || ''}</div>
    <div class="rdesc">${analysis.summaryText || ''}</div>
  </div>

  <div class="slbl">📊 綜合適配評分</div>
  <div class="srow"><div class="slb">🧬 生物資訊</div><div class="strk"><div class="sfil sf-b" id="bBar" style="width:0%"></div></div><div class="snum" style="color:var(--bio)">${sc.bP}%</div></div>
  <div class="srow"><div class="slb">💊 藥劑學</div><div class="strk"><div class="sfil sf-p" id="pBar" style="width:0%"></div></div><div class="snum" style="color:var(--pha)">${sc.pP}%</div></div>

  <div class="divider"></div>

  <div class="radar-sec">
    <div class="slbl">🕸️ 六維能力雷達圖</div>
    <canvas id="rCanvas" width="380" height="320" style="max-width:100%"></canvas>
    <div class="radar-legend">
      <div class="leg"><div class="ldot" style="background:var(--bio)"></div>生物資訊學</div>
      <div class="leg"><div class="ldot" style="background:var(--pha)"></div>藥劑學</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="slbl">🆕 2026 年四大新指標</div>
  <div class="spgrid">
    <div class="spcard">
      <div class="sp-i">🌏</div><div class="sp-l">大灣區指數</div>
      <div class="sp-ring"><svg viewBox="0 0 60 60" width="60" height="60"><circle class="sr-bg" cx="30" cy="30" r="25"/><circle class="sr-f" cx="30" cy="30" r="25" stroke="var(--grn)" stroke-dasharray="${sc.gP*1.57} 157"/></svg><div class="sr-txt" style="color:var(--grn)">${sc.gP}%</div></div>
      <div class="sp-note">${sc.gP>=50?'河套黃金人才 🌟':'立足香港穩步走 🏠'}</div>
    </div>
    <div class="spcard">
      <div class="sp-i">🤖</div><div class="sp-l">AI 適應力</div>
      <div class="sp-ring"><svg viewBox="0 0 60 60" width="60" height="60"><circle class="sr-bg" cx="30" cy="30" r="25"/><circle class="sr-f" cx="30" cy="30" r="25" stroke="var(--bio)" stroke-dasharray="${sc.aiP*1.57} 157"/></svg><div class="sr-txt" style="color:var(--bio)">${sc.aiP}%</div></div>
      <div class="sp-note">${sc.aiP>=50?'AI 浪潮推動者 🚀':'AI 衝擊抵抗型 🛡️'}</div>
    </div>
    <div class="spcard">
      <div class="sp-i">🚀</div><div class="sp-l">創業潛力</div>
      <div class="sp-ring"><svg viewBox="0 0 60 60" width="60" height="60"><circle class="sr-bg" cx="30" cy="30" r="25"/><circle class="sr-f" cx="30" cy="30" r="25" stroke="var(--amb)" stroke-dasharray="${sc.enP*1.57} 157"/></svg><div class="sr-txt" style="color:var(--amb)">${sc.enP}%</div></div>
      <div class="sp-note">${sc.enP>=50?'Biotech 創辦人質 🦄':'穩健打工族 💼'}</div>
    </div>
    <div class="spcard">
      <div class="sp-i">✈️</div><div class="sp-l">國際流動力</div>
      <div class="sp-ring"><svg viewBox="0 0 60 60" width="60" height="60"><circle class="sr-bg" cx="30" cy="30" r="25"/><circle class="sr-f" cx="30" cy="30" r="25" stroke="var(--sky)" stroke-dasharray="${sc.itP*1.57} 157"/></svg><div class="sr-txt" style="color:var(--sky)">${sc.itP}%</div></div>
      <div class="sp-note">${sc.itP>=50?'全球流動型人才 🌍':'本地紮根型人才 🏡'}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="slbl">🔍 10 維度逐項分析</div>
  <div class="dgrid">${dims.map(d => `<div class="ditem"><div class="di-i">${d.icon || '•'}</div><div class="di-l">${d.label}</div><div class="di-v">${d.value}</div></div>`).join('')}</div>

  <div class="divider"></div>

  <div class="slbl">💵 核實薪酬數據（2025 年）</div>
  ${isBio ? salTableBio : salTablePha}

  <div class="divider"></div>

  <div class="slbl">✅ 優勢 vs ⚠️ 挑戰</div>
  <div class="pcgrid">
    <div class="pbox"><h4>✅ 這條路的優勢</h4>${pros.map(p => `<li><span>${p}</span></li>`).join('')}</div>
    <div class="cbox"><h4>⚠️ 需要考慮的挑戰</h4>${cons.map(c => `<li><span>${c}</span></li>`).join('')}</div>
  </div>

  <div class="divider"></div>

  <div class="banner-card bc-gba">
    <div class="bc-head"><span style="font-size:24px">🏗️</span><h3>河套香港園區機遇（2026 最新）</h3></div>
    <div class="bc-body">
      <span class="pulse"></span>河套香港園區已正式開園，生命健康科技與 AI 為核心產業。60+ 企業進駐，政府投入 100 億加速發展，並設立 2 億元生命健康初創培育計劃。
      ${isBio ? '<strong>生物資訊學畢業生</strong>係河套最搶手人才，大數據分析及 AI 藥研職位持續增加。' : '<strong>藥劑學畢業生</strong>可透過臨床試驗管理（CRA）或法規事務（RA）角色，切入河套醫藥生態系。'}
    </div>
    <div class="bc-tags">
      <span class="bctag bctag-g">🧬 生命健康科技區</span>
      <span class="bctag bctag-g">🤖 AI 數據科學</span>
      <span class="bctag bctag-g">💊 臨床試驗中心</span>
      <span class="bctag bctag-g">🚀 初創孵化器</span>
    </div>
  </div>

  <div class="banner-card bc-intl">
    <div class="bc-head"><span style="font-size:24px">🌍</span><h3>全球就業機遇地圖</h3></div>
    <div class="bc-body">${isBio ? '生物資訊學具備極強嘅全球流動性。以下係主要 Biotech Hub 嘅職位與薪酬參考（數據來源：ERI/行業調查）：' : '藥劑師嘅國際流動需考取當地牌照。以下係主要國家嘅職位與薪酬參考：'}</div>
    <div class="world-row">${worldData.map(w => `<div class="world-item"><div class="wi-flag">${w.flag}</div><div class="wi-city">${w.city}</div><div class="wi-role">${w.role}</div><div class="wi-sal">${w.sal}</div></div>`).join('')}</div>
  </div>

  <div class="divider"></div>

  <div class="slbl">🗺️ 你的職業路線圖</div>
  <div class="road-steps">${road.map(r => {
    const dc = r.emoji && r.emoji.includes('📚') ? r.emoji.includes('藥') ? 'rd-p' : 'rd-b' :
               r.emoji && r.emoji.includes('🔬') ? 'rd-b' :
               r.emoji && r.emoji.includes('🌍') ? 'rd-s' : 'rd-g';
    return `<div class="rstep"><div class="rdot ${dc}">${r.emoji || '📍'}</div><div class="rcont"><div class="ry">${r.year}</div><div class="rd">${r.desc}</div><div class="rs">${r.salary}</div></div></div>`;
  }).join('')}</div>

  <div class="divider"></div>

  <div class="slbl">📤 分享結果</div>
  <div class="share-row">
    <button class="share-btn" onclick="copyR()">📋 複製結果文字</button>
    <button class="share-btn" onclick="dlR()">📸 儲存截圖提示</button>
  </div>

  <div class="rnote">
    <strong>💡 溫馨提示：</strong>薪酬數據已根據政府官方薪級表及 ERI 薪酬調查核實（2025年），僅供參考，實際薪酬視乎機構、個人表現及市場狀況而定。
    強烈建議出席 <strong>港大 Open Day</strong> 與在讀同學交流，並諮詢升學顧問，再做最終決定。
    無論選擇哪條路，成功的關鍵永遠是<strong>你對這條路的熱情與堅持</strong>。加油！🎉
  </div>

  <button class="btn-r" onclick="restart()">🔄 重新分析</button>`;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    document.getElementById('bBar').style.width = sc.bP + '%';
    document.getElementById('pBar').style.width = sc.pP + '%';
    drawRadar(document.getElementById('rCanvas'), sc);
  }, 400);
}
```

- [ ] **Step 2: 更新 restart 函数适应新状态**

保留现有的 `restart()` 函数（约第 726-731 行），修改为：

```js
function restart() {
  state.phase = 'intro';
  state.messages = [];
  state.curQ = null;
  state.answers = [];
  state.curIdx = 0;
  state.selIdx = null;
  state.analyzing = false;
  state.analysisData = null;
  const r = document.getElementById('result');
  r.classList.add('hidden');
  r.innerHTML = '';
  document.getElementById('intro').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
```

- [ ] **Step 3: 更新 copyR 函数**

将旧的 `copyR()` 替换为：

```js
function copyR() {
  const a = state.analysisData;
  if (!a) return;
  const sc = calcFromAI(a.scores);
  navigator.clipboard.writeText(
    `我的选科分析结果\n🧬 生物资讯学：${sc.bP}%\n💊 药剂学：${sc.pP}%\n🌏 大湾区指数：${sc.gP}%\n🤖 AI适应力：${sc.aiP}%\n🚀 创业潜力：${sc.enP}%\n✈️ 国际流动力：${sc.itP}%`
  ).then(() => alert('✅ 已复制！'));
}
```

- [ ] **Step 4: 保留 drawRadar、dlR 不动**

`drawRadar()`（约第 496-516 行）和 `dlR()`（约第 740-742 行）保持不变。

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: implement AI-driven result rendering, update restart/copyR"
```

---

### Task 8: 本地测试

**Files:**
- Verify: `index.html`, `api/chat.js`, `vercel.json`

- [ ] **Step 1: 安装 Vercel CLI 并本地启动**

```bash
npx vercel dev --yes
```

Expected: 本地服务启动（默认 localhost:3000）

- [ ] **Step 2: 设置环境变量**

```bash
export DEEPSEEK_API_KEY=sk-9fb5a3ead96a4133a4f6316dfd1c7838
```

然后重新启动 `vercel dev`。

- [ ] **Step 3: 打开浏览器测试流程**

在浏览器打开 http://localhost:3000 ，进行以下测试：
- 点击「开始 AI 对话」
- AI 返回第一题（验证问题 + 选项显示正常）
- 点击一个选项 → 下一题出现
- 测试自定义输入
- 测试「提前结束」按钮
- 确认结果页所有模块渲染正常

- [ ] **Step 4: 测试错误处理**

阻断网络或设置错误 Key，确认错误提示正常显示。

- [ ] **Step 5: 测试 restarrt**

完成一轮后点击「重新分析」，确认回到 Intro 页并能重新开始。

---

### Task 9: 部署到 Vercel

- [ ] **Step 1: 推送代码到 GitHub**

```bash
git push origin main
```

- [ ] **Step 2: 在 Vercel 仪表板导入项目**

1. 打开 https://vercel.com
2. Import Git Repository → 选择 `legogogoagent/biopath-navigator`
3. 设置环境变量：`DEEPSEEK_API_KEY` = 你的 API Key
4. 点击 Deploy

- [ ] **Step 3: 验证线上部署**

打开 Vercel 生成的域名（`*.vercel.app`），测试完整流程。

- [ ] **Step 4: (可选) 设置自定义域名**

在 Vercel Dashboard → Settings → Domains 添加自定义域名。
