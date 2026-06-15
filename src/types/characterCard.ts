/**
 * Curoco — Character Card Schema
 * Export/Import format for cross-device companion migration
 */

export interface CharacterCard {
  // Meta
  version: string;              // "1.0"
  exportedAt: string;           // ISO 8601
  deviceName: string;           // Export device name

  // Layer 1: Basic persona settings
  persona: {
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
    proactiveIntervalMin: number;
    proactiveIntervalMax: number;
    autoFollowUpEnabled: boolean;
    autoFollowUpTimeoutMin: number;
    ttsVoiceId: string | null;
    avatarUri: string | null;     // Base64 encoded avatar image
    signature: string | null;
    // 细化设定字段
    speakingStyle?: string;       // 语言特点/说话风格
    tabooTopics?: string;         // 禁忌话题
    likes?: string;               // 喜好/兴趣
    catchphrase?: string;         // 口头禅
    emotionStyle?: string;        // 情感表达方式
  };

  // Layer 2: Memory assets
  memory: {
    longTermSummary: string;      // Current long-term memory summary
    memoryTags: string[];         // Extracted key memory tags
  };

  // Layer 3: Session anchor (for cross-device continuation)
  session: {
    sessionId: string;            // Original conversation ID
    lastMessages: Array<{         // Last N messages snapshot
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      emotion?: string;
    }>;
    totalMessageCount: number;
    lastActiveAt: string;         // Last conversation timestamp
  };
}

// File extension
export const CARD_EXTENSION = '.curoco';
export const CARD_MIME_TYPE = 'application/json';
