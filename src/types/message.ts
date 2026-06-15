/**
 * Curoco — Message Queue & Pause Types
 * Structured LLM response and emotional pause queue
 */

// ============================================================
// Structured LLM Response (大模型结构化输出)
// ============================================================
export interface StructuredLLMResponse {
  emotion: string; // 情感标签
  speed_modifier: number; // 语速修正因子 (1.0 = 正常)
  send_voice: boolean; // AI 是否决定用语音发送
  messages: string[]; // 意群切分的消息数组
}

// ============================================================
// Emotion Pause Queue (情感停顿队列)
// ============================================================
export interface QueuedMessage {
  content: string; // 消息文本
  delayMs: number; // 该条消息的等待时间(ms)
  emotion: string; // 情感标签
  sendVoice: boolean; // AI 是否决定用语音发送
  isLast: boolean; // 是否为本组最后一条
}

// ============================================================
// Pause Strategy Config (停顿策略)
// ============================================================
export interface PauseStrategy {
  baseCharDelayMs: number; // 每字基础延迟 (150ms)
  emotionMultipliers: Record<string, number>;
  maxDelayMs: number; // 单条最大延迟上限
}

export const DEFAULT_PAUSE_STRATEGY: PauseStrategy = {
  baseCharDelayMs: 150,
  emotionMultipliers: {
    happy: 1.0,
    excited: 0.5,
    sad: 2.0,
    shy: 2.5,
    angry: 0.6,
    thinking: 1.8,
    neutral: 1.0,
    default: 1.0,
  },
  maxDelayMs: 8000,
};

// ============================================================
// Emotion Labels (情感标签枚举)
// ============================================================
export const EMOTION_LABELS = [
  'happy',
  'sad',
  'shy',
  'excited',
  'angry',
  'thinking',
  'neutral',
  'surprised',
  'worried',
  'playful',
] as const;

export type EmotionLabel = (typeof EMOTION_LABELS)[number];

// ============================================================
// Chat State (聊天页面状态)
// ============================================================
export interface ChatState {
  conversationId: string;
  messages: DisplayMessage[];
  isTyping: boolean; // "对方正在输入..."
  isGenerating: boolean; // AI 正在生成回复
  inputText: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'text' | 'voice' | 'image' | 'custom_emoji';
  content: string;
  mediaUri?: string;
  mediaDuration?: number;
  emotion?: string;
  status: 'sending' | 'sent' | 'failed';
  isRead: boolean;
  createdAt: string;
  // Unique nonce for message deduplication (prevents "sent twice" hallucination)
  nonce?: string;
  // Custom sticker fields
  emojiId?: string;
  emojiUri?: string;
  emojiMeaning?: string;
  // Quote/reply fields
  quoteId?: string;
  quoteContent?: string;
  quoteRole?: string;
  // Group chat fields
  companionId?: string;
  companionName?: string;
}
