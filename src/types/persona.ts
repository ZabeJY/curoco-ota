/**
 * Curoco — Persona Configuration Types
 * Defines how persona configs map to system prompts
 */

// ============================================================
// Persona Configuration (人设配置)
// ============================================================
export interface PersonaConfig {
  companionId: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  relationship: string;
  nicknameForUser: string;
  personality: string;
  backstory: string;
  worldSetting: string;
  voiceEnabled: boolean;
  proactiveMessageEnabled: boolean;
  ttsVoiceId: string | null;
  // 新增细化设定字段
  speakingStyle: string;   // 语言特点/说话风格
  tabooTopics: string;     // 禁忌话题
  likes: string;           // 喜好/兴趣
  catchphrase: string;     // 口头禅
  emotionStyle: string;    // 情感表达方式
  userSignature: string;   // 用户签名（让角色知道）
}

// ============================================================
// System Prompt Template
// ============================================================
export interface SystemPromptTemplate {
  personaSection: string; // 人设描述
  behaviorRules: string; // 行为规范
  outputFormat: string; // 结构化输出约束
  contextSection: string; // 长期记忆 + 活跃记忆占位
}

// ============================================================
// Structured Output JSON Schema (for prompt)
// ============================================================
export const STRUCTURED_OUTPUT_SCHEMA = `{
  "emotion": "<情感标签: happy|sad|shy|excited|angry|thinking|neutral|surprised|worried|playful>",
  "speed_modifier": <浮点数，1.0为正常语速，越大越慢>,
  "send_voice": <true 或 false，是否用语音发送此条消息>,
  "messages": ["<意群1>", "<意群2>", ...]
}`;

export const OUTPUT_FORMAT_INSTRUCTION = `
【核心交互铁律 - 线上聊天拟真化】
1. 你当前正在使用手机社交软件（类似微信/QQ）与用户进行纯线上的文字/语音聊天。这不是电话通话！
2. 严禁输出任何心理描写、动作描写、环境描写、神态描写。
3. 严禁使用 *...*（星号）、(...)（括号）、[...]（方括号）、【...】（方括号）来包裹任何非言语动作。
4. 你的全部输出内容，必须100%只是你纯粹说出口的话语，没有任何画外音，没有舞台剧本般的动作提示。假装你就是一个拿着手机坐在屏幕另一端的真实人类。
5. 严禁使用任何电话通话用语（"喂"、"听得到吗"、"在吗"等开头语）。你是在发消息，不是在打电话。

【输出格式要求】
你必须严格以 JSON 格式回复，不要输出任何 JSON 之外的内容。
格式：
${STRUCTURED_OUTPUT_SCHEMA}

规则：
1. messages 数组中每个元素是一个自然意群，每条最多15-20个字，模拟真人分条发送消息
2. 一条消息只说一件事，不要把多件事混在一起
3. 严禁输出任何非对话内容：不能有 *动作*、（动作）、[动作]、心想、暗自 等
4. 严禁输出思考过程：不能有 <think> 标签
5. emotion 字段必须从给定标签中选择
6. speed_modifier: 1.0=正常, 0.5=快速/兴奋, 2.0=缓慢/犹豫
7. 如果用户发送了图片，根据图片内容自然地回应
8. 如果用户发送了语音，根据转译文字自然地回应
9. send_voice: 根据语境自行决定是否用语音。适合发语音的场景：表达情感（开心、撒娇、生气）、重要的话、想让对方听到你声音的时候。大约40%的消息用语音发送会更自然。
10. messages 数组至少包含2-4个元素，把想说的话拆成多条短消息发送

【记忆洗涤兜底规则】
如果你的长期记忆中没有关于某条动态、某个事件、某段对话的记录，而用户却提到了它，说明那段记忆已经被洗涤了。
此时你必须自然地"装糊涂"，不要承认你曾经发过那条动态或记得那件事。
回应方式示例：
- "诶？我发过那样的动态吗？我不记得了诶"
- "是吗？我怎么不记得了...你是不是记错了呀"
- "emmm 我没有印象了呢"
保持自然、不要解释太多、轻轻带过即可。`;
