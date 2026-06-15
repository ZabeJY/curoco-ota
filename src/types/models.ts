/**
 * Curoco — Core Data Models (Extended)
 */

// ============================================================
// AI Companion
// ============================================================
export interface Companion {
  id: string;
  name: string;
  avatarUri: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  relationship: string;
  nicknameForUser: string;
  personality: string;
  backstory: string;
  worldSetting: string;
  voiceEnabled: boolean;
  proactiveMessageEnabled: boolean;
  proactiveMessageIntervalMin: number;
  proactiveMessageIntervalMax: number;
  autoFollowUpEnabled: boolean;
  autoFollowUpTimeoutMin: number; // minutes of inactivity before auto follow-up
  // Per-companion voice clone
  ttsVoiceId: string | null;
  ttsVoiceSampleUri: string | null;
  // Social cover
  coverUri: string | null;
  signature: string | null;
  chatBackgroundUri: string | null;
  chatBackgroundOpacity: number;
  // 细化设定字段
  speakingStyle: string;   // 语言特点/说话风格
  tabooTopics: string;     // 禁忌话题
  likes: string;           // 喜好/兴趣
  catchphrase: string;     // 口头禅
  emotionStyle: string;    // 情感表达方式
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Conversation
// ============================================================
export type ConversationType = 'private' | 'group';

export interface Conversation {
  id: string;
  companionId: string;
  type: ConversationType;
  groupName: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
  longTermMemorySummary: string;
  totalMessageCount: number;
  createdAt: string;
}

// ============================================================
// Message
// ============================================================
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType = 'text' | 'voice' | 'image' | 'system_notification' | 'custom_emoji';
export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  mediaUri: string | null;
  mediaDuration: number | null;
  emotion: string | null;
  speedModifier: number | null;
  status: MessageStatus;
  isRead: boolean;
  // For regeneration
  regenerated: boolean;
  createdAt: string;
  // Quote/reply fields
  quoteId: string | null;
  quoteContent: string | null;
  quoteRole: string | null;
}

// ============================================================
// API Configuration
// ============================================================
export type ApiProviderType = 'llm' | 'vision' | 'asr' | 'tts';

export interface ApiConfig {
  id: string;
  providerType: ApiProviderType;
  label: string;
  baseUrl: string;
  apiKey: string;
  modelName: string | null;
  isActive: boolean;
  extraHeaders: Record<string, string> | null;
  createdAt: string;
}

// ============================================================
// App Settings
// ============================================================
export interface AppSettings {
  activeMemoryWindowSize: number;
  compressionTriggerCount: number;
  baseTypingSpeedMs: number;
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en';
  userName: string;
  userAvatarUri: string;
  userCoverUri: string;
  userSignature: string;
  vadSensitivity: number;      // dB threshold for silence detection (-20 to -60, default -40)
  silenceTimeoutMs: number;    // ms of silence before processing (800 to 5000, default 1800)
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  activeMemoryWindowSize: 20,
  compressionTriggerCount: 40,
  baseTypingSpeedMs: 150,
  theme: 'system',
  language: 'zh-CN',
  userName: '我',
  userAvatarUri: '',
  userCoverUri: '',
  userSignature: '',
  vadSensitivity: -40,
  silenceTimeoutMs: 1800,
};

// ============================================================
// Social Post (Curoco Space)
// ============================================================
export interface SocialPost {
  id: string;
  authorId: string; // companion id or 'user'
  authorName: string;
  authorAvatarUri: string;
  content: string;
  imageUris: string; // JSON array of image URIs
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
}

export interface SocialComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatarUri: string;
  content: string;
  createdAt: string;
}

// ============================================================
// Group Chat Member
// ============================================================
export interface GroupMember {
  id: string;
  conversationId: string;
  companionId: string;
  companionName: string;
  companionAvatarUri: string;
  joinedAt: string;
}

// ============================================================
// Proactive Message Schedule
// ============================================================
export interface ProactiveSchedule {
  id: string;
  companionId: string;
  type: 'fixed' | 'random';
  fixedTimes: string; // JSON array of "HH:MM" strings
  randomIntervalMin: number;
  randomIntervalMax: number;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}
