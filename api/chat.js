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
    { "icon": "🌟", "label": "性格", "value": "探索型 → 🧬" },
    { "icon": "💼", "label": "工作偏好", "value": "数据导向 → 🧬" },
    { "icon": "📚", "label": "学科强项", "value": "数理电脑 → 🧬" },
    { "icon": "🎓", "label": "进修意愿", "value": "愿读博 → 🧬" },
    { "icon": "💰", "label": "薪酬期望", "value": "高天花板 → 🧬" },
    { "icon": "⏰", "label": "时间成本", "value": "先苦后甜 → 🧬" },
    { "icon": "🔭", "label": "未来方向", "value": "AI科研 → 🧬" },
    { "icon": "🤖", "label": "AI态度", "value": "拥抱AI → 🧬" },
    { "icon": "🌏", "label": "发展视野", "value": "国际舞台 → 🧬" },
    { "icon": "🚀", "label": "创业精神", "value": "创业型 → 🧬" }
  ],
  "pros": ["优势1", "优势2", "优势3", "优势4", "优势5", "优势6"],
  "cons": ["挑战1", "挑战2", "挑战3", "挑战4"],
  "roadmap": [
    { "emoji": "📚", "year": "第1-4年", "desc": "...", "salary": "..." },
    { "emoji": "🔬", "year": "第5-8年", "desc": "...", "salary": "..." },
    { "emoji": "🌍", "year": "第9-10年", "desc": "...", "salary": "..." },
    { "emoji": "🚀", "year": "第15年+", "desc": "...", "salary": "..." }
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
