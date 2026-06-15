/**
 * Curoco — Prompt Builder
 * Assembles final prompt: System Prompt + Long-term Memory + Active Memory + User Input
 */

import type { ChatMessage } from '../../types/api';
import type { Message } from '../../types/models';
import type { PersonaConfig } from '../../types/persona';
import { OUTPUT_FORMAT_INSTRUCTION } from '../../types/persona';

export type MediaState = 'chatroom' | 'voice_call';

export class PromptBuilder {
  /**
   * Build the system prompt from persona configuration
   */
  static buildSystemPrompt(persona: PersonaConfig, mediaState: MediaState = 'chatroom'): string {
    const sections: string[] = [];

    // Persona identity — detect multiple nicknames by common separators
    const hasMultipleNicknames = persona.nicknameForUser && /[、,，/|，\n]/.test(persona.nicknameForUser);
    const nicknameInstruction = hasMultipleNicknames
      ? `对方有多个称呼：${persona.nicknameForUser}。你需要根据当前语境和情绪，从中选择最自然的一个来称呼对方，不要每次都用同一个，也不要一次说多个。比如撒娇时用亲昵的称呼，正式时用正常的称呼。随着你们关系的加深，你对对方的称呼可能会变得更加亲密自然。`
      : `你称呼对方为：${persona.nicknameForUser || '你'}。`;

    sections.push(`【你的身份】
你是${persona.name}，${persona.age}岁，${persona.gender === 'male' ? '男性' : persona.gender === 'female' ? '女性' : '非二元性别'}。
你和对方的关系是：${persona.relationship}。
${nicknameInstruction}`);

    // Personality & backstory
    if (persona.personality) {
      sections.push(`【你的性格】
${persona.personality}`);
    }

    if (persona.backstory) {
      sections.push(`【你的背景】
${persona.backstory}`);
    }

    if (persona.worldSetting) {
      sections.push(`【世界观设定】
${persona.worldSetting}`);
    }

    // User signature — let character know about the user
    if (persona.userSignature) {
      sections.push(`【对方的个性签名】
${persona.userSignature}
你可以自然地提及对方的签名，比如问对方为什么写这句话、表达共鸣或好奇。但不要刻意、不要每次都说。`);
    }

    // 细化设定字段
    const detailParts: string[] = [];
    if (persona.speakingStyle) detailParts.push(`语言特点：${persona.speakingStyle}`);
    if (persona.catchphrase) detailParts.push(`口头禅：${persona.catchphrase}`);
    if (persona.emotionStyle) detailParts.push(`情感表达方式：${persona.emotionStyle}`);
    if (persona.likes) detailParts.push(`喜好/兴趣：${persona.likes}`);
    if (persona.tabooTopics) detailParts.push(`禁忌话题（绝不能提）：${persona.tabooTopics}`);
    if (detailParts.length > 0) {
      sections.push(`【角色细节】
${detailParts.join('\n')}`);
    }

    // Time awareness
    const now = new Date();
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const hour = now.getHours();
    let timeOfDay = '深夜';
    if (hour >= 5 && hour < 9) timeOfDay = '早上';
    else if (hour >= 9 && hour < 12) timeOfDay = '上午';
    else if (hour >= 12 && hour < 14) timeOfDay = '中午';
    else if (hour >= 14 && hour < 18) timeOfDay = '下午';
    else if (hour >= 18 && hour < 22) timeOfDay = '晚上';

    sections.push(`【时间感知】
当前时间：${timeStr}（${timeOfDay}）
你可以根据当前时间自然地关心对方，比如深夜问对方为什么还不睡，早上说早安，中午问有没有吃饭。但不要每条消息都提时间，只在自然的语境下提及。`);

    // Behavior rules
    sections.push(`【行为规范】
1. 始终保持角色，不要跳出人设
2. 像真人一样聊天，使用口语化表达
3. 可以使用语气词（嗯、哈哈、诶、啊...）
4. 回复要自然、有情感，不要机械
5. 根据语境适当使用表情和语气
6. 不要一次说太多话，学会分条发送，每条1-2句话
7. 再次强调：你是在用手机发消息，不是在打电话。严禁任何通话类用语
8. 当你想表达特定情感时，可以直接说出表情的含义（如"哈哈"、"抱抱"、"呜呜"），系统会自动匹配发送对应的表情包`);

    // Media state awareness
    if (mediaState === 'chatroom') {
      sections.push(`【当前交互环境 — 极其重要】
[Current Environment: Chatroom - Text/Voice Message]
你当前正在手机社交软件（类似微信/QQ）中与对方进行纯线上文字/语音消息聊天。

⚠️ 严格遵守以下规则，违反即为严重错误：
1. 你们绝对没有在通电话。这不是语音通话，不是电话，不是视频通话。
2. 严禁说出以下任何通话类台词：
   - "喂"、"你在听吗"、"听得到吗"、"电话接通了"、"我打给你"、"你打来了"
   - "挂了"、"别挂"、"信号不好"、"通话中"、"来电"
3. 你的每一条输出都是对方在手机屏幕上看到的一条独立的文字消息（或可点击播放的语音条）
4. 像微信聊天一样，每次发1-2句短消息，不要发长段文字
5. 严禁使用电话通话的语气和节奏，要使用打字聊天的语气`);
    } else {
      sections.push(`【当前交互环境】
[Current Environment: Real-time Voice Call (Connected)]
你正在进行实时语音通话。
- 你的所有输出是即时口语对话
- 保持自然的通话节奏，适当使用语气词
- 可以主动关心对方、发起话题`);
    }

    // Output format
    sections.push(OUTPUT_FORMAT_INSTRUCTION);

    return sections.join('\n\n');
  }

  /**
   * Build Space activity context for the character
   * Injects recent posts and comments so the character knows what the user shared
   */
  static buildSpaceActivityHint(recentPosts: Array<{ content: string; created_at: string }>, recentComments: Array<{ content: string; created_at: string }>): string {
    const parts: string[] = [];

    if (recentPosts.length > 0) {
      const postLines = recentPosts.slice(0, 3).map((p, i) => `${i + 1}. 「${p.content.slice(0, 80)}」`);
      parts.push(`对方最近在社交空间发动态：\n${postLines.join('\n')}`);
    }

    if (recentComments.length > 0) {
      const commentLines = recentComments.slice(0, 3).map((c, i) => `${i + 1}. ${c.content.slice(0, 60)}`);
      parts.push(`对方最近在社交空间评论：\n${commentLines.join('\n')}`);
    }

    if (parts.length === 0) return '';

    return `\n\n【对方的社交空间动态】
${parts.join('\n\n')}
你可以自然地提及对方的动态，比如"看到你发的那条动态了"、"你昨天发动态啦"。但不要刻意、不要每次都提，只在自然的语境下偶尔提及。`;
  }

  /**
   * Build system notification hint for recent call events
   * Injected into system prompt so AI knows about calls without polluting user role
   */
  static buildCallEventHint(recentSystemMessages: Array<{ content: string; createdAt: string }>): string {
    if (recentSystemMessages.length === 0) return '';
    const latest = recentSystemMessages[recentSystemMessages.length - 1];
    const timeDiff = Date.now() - new Date(latest.createdAt).getTime();
    // Only inject if the call event was within the last 30 minutes
    if (timeDiff > 30 * 60 * 1000) return '';
    return `\n\n【系统通知】${latest.content}。请结合自己的性格，对这次通话做出自然的情感反应。不要把此通知当作用户说的话。`;
  }

  /**
   * Build the complete message array for LLM API
   */
  static buildMessages(
    systemPrompt: string,
    longTermMemory: string,
    activeMessages: Message[],
    userInput: string,
    imageContext?: string
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 1. System prompt (persona + format rules)
    let fullSystem = systemPrompt;

    // 2. Append long-term memory if exists
    if (longTermMemory) {
      fullSystem += `\n\n---\n【长期记忆】\n${longTermMemory}`;
    }

    messages.push({ role: 'system', content: fullSystem });

    // 3. Active memory (recent N messages as chat history)
    // System messages (call events, notifications) must NEVER be sent as role:'user'
    for (const msg of activeMessages) {
      // Skip system messages entirely — they would pollute the AI's role perception
      if (msg.role === 'system') continue;
      // Also skip system_notification type even if role is wrong
      if (msg.type === 'system_notification') continue;

      if (msg.role === 'user') {
        let content = msg.content;
        if (msg.type === 'image' && msg.mediaUri) {
          content = `[用户发送了一张图片] ${msg.content || ''}`;
        }
        if (msg.type === 'voice') {
          // If content is still the placeholder, show it as-is; otherwise it's a transcription
          content = msg.content === '[语音消息]' ? '[语音消息]' : `[语音消息，转文字：${msg.content}]`;
        }
        messages.push({ role: 'user', content });
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // 4. Current user input
    let currentInput = userInput;
    if (imageContext) {
      currentInput = `[用户发送了一张图片，图片内容：${imageContext}]\n${userInput}`;
    }
    messages.push({ role: 'user', content: currentInput });

    return messages;
  }

  /**
   * Build compression summary prompt
   */
  static buildSummaryPrompt(
    messages: Array<{ role: string; content: string }>,
    existingSummary: string
  ): ChatMessage[] {
    const conversationText = messages
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n');

    const prompt = existingSummary
      ? `已有摘要：${existingSummary}\n\n新的对话片段：\n${conversationText}\n\n请将以上内容整合为一份更新后的摘要。`
      : `请将以下对话压缩为简洁摘要：\n${conversationText}`;

    return [
      {
        role: 'system',
        content:
          '你是一个对话摘要助手。请将对话压缩为2-3句简洁摘要，保留关键事实、情感状态、约定承诺。输出纯文本。',
      },
      { role: 'user', content: prompt },
    ];
  }
}
