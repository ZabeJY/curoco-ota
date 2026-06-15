/**
 * Curoco — App Constants
 */

export const APP_NAME = 'Curoco';
export const APP_VERSION = '1.0.0';

// Memory layer defaults
export const DEFAULT_ACTIVE_MEMORY_SIZE = 20;
export const DEFAULT_COMPRESSION_TRIGGER = 40;

// Typing speed
export const DEFAULT_BASE_TYPING_DELAY_MS = 150;

// Message limits
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_VOICE_DURATION_SEC = 60;
export const MAX_IMAGE_SIZE_MB = 10;

// Summary compression prompt
export const SUMMARY_SYSTEM_PROMPT = `你是一个对话摘要助手。请将以下对话片段压缩为2-3句简洁的摘要，保留：
1. 关键事实和信息
2. 情感状态和变化
3. 双方约定或承诺
4. 重要的偏好或习惯

如果已有旧摘要，请在此基础上更新，不要重复。
输出纯文本摘要，不要加任何前缀或格式标记。`;

// Proactive message prompt
export const PROACTIVE_MESSAGE_PROMPT = `你现在要主动给对方发一条消息。根据你们的关系和最近的对话内容，发一条自然、温暖的消息。
要求：
- 像真人一样自然，不要太正式
- 可以关心对方、分享日常、或者撒娇
- 保持简短，1-2句话
- 仍然以结构化 JSON 格式回复`;
