/**
 * Curoco — API Request/Response Types
 * Types for all external API communications
 */

// ============================================================
// LLM Chat API
// ============================================================
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
}

export interface LLMResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================
// Vision API (图像识别)
// ============================================================
export interface VisionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;
  }>;
  max_tokens?: number;
}

export interface VisionResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ============================================================
// ASR API (语音识别)
// ============================================================
export interface ASRRequest {
  model: string;
  file: string; // base64 encoded audio or file path
  language?: string;
  response_format?: 'json' | 'text';
}

export interface ASRResponse {
  text: string;
}

// ============================================================
// TTS API (语音合成)
// ============================================================
export interface TTSRequest {
  model: string;
  input: string;
  voice: string; // Voice ID for cloning
  speed?: number;
  response_format?: 'mp3' | 'wav' | 'opus';
}

export interface VoiceCloneRequest {
  name: string;
  files: string[]; // base64 encoded audio samples
  description?: string;
}

export interface VoiceCloneResponse {
  voice_id: string;
  name: string;
  created_at: string;
}

// ============================================================
// API Error
// ============================================================
export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

// ============================================================
// Summary Compression Request
// ============================================================
export interface SummaryRequest {
  messages: Array<{ role: string; content: string }>;
  existingSummary: string;
}
