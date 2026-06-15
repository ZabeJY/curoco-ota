/**
 * Curoco — MiMo TTS Client (Correct)
 *
 * 3 models, all via POST /v1/chat/completions:
 *   - mimo-v2.5-tts:           Preset voices.   audio.voice = "Chloe"
 *   - mimo-v2.5-tts-voiceclone: Clone from sample. audio.voice = "data:{mime};base64,{b64}"
 *   - mimo-v2.5-tts-voicedesign: Text description.  No audio.voice, desc in user message
 */

import * as FileSystem from 'expo-file-system';
import type { ApiConfig } from '../../types/models';

export type MiMoTTSModel = 'mimo-v2.5-tts' | 'mimo-v2.5-tts-voiceclone' | 'mimo-v2.5-tts-voicedesign';

const EMOTION_STYLES: Record<string, string> = {
  happy: 'Warm, cheerful, upbeat tone. Natural pace, slightly rising pitch.',
  sad: 'Gentle, soft, melancholic tone. Slow pace, lower pitch.',
  shy: 'Soft, hesitant, slightly breathy tone. Pauses between phrases.',
  excited: 'Fast, energetic, bursting with enthusiasm. Rising pitch.',
  angry: 'Firm, sharp, frustrated tone. Clipped words, forceful.',
  thinking: 'Slow, contemplative, uncertain tone. Pauses for thought.',
  neutral: 'Calm, clear, conversational tone. Natural pace and pitch.',
  surprised: 'High-pitched, sudden, incredulous tone.',
  worried: 'Anxious, slightly trembling, concerned tone.',
  playful: 'Teasing, sing-song, mischievous tone. Variable pitch.',
};

export class MiMoTTSClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    let url = this.config.baseUrl.replace(/\/+$/, '');
    if (!url.match(/\/v\d+$/)) url = url + '/v1';
    return url;
  }

  /**
   * Synthesize speech
   * @param text - Text to speak
   * @param model - Which MiMo TTS model
   * @param voice - For preset: voice name. For clone: DataURL. For design: unused.
   * @param emotion - Emotion for voice style instruction
   */
  async synthesize(text: string, model: MiMoTTSModel, voice: string, emotion?: string): Promise<string> {
    const url = `${this.getBaseUrl()}/chat/completions`;

    // Sanitize: strip empty/whitespace-only text that would cause 400
    const cleanText = text?.trim();
    if (!cleanText) {
      throw new Error('TTS 文本为空，跳过语音合成');
    }

    const style = emotion ? (EMOTION_STYLES[emotion] || '') : '';

    const messages: Array<{ role: string; content: string }> = [];

    if (model === 'mimo-v2.5-tts-voicedesign') {
      // Voice design: user message = voice description (required)
      messages.push({ role: 'user', content: voice || 'A natural, warm, clear voice.' });
    } else if (style) {
      // Preset/Clone: user message = style instruction (optional)
      messages.push({ role: 'user', content: style });
    }

    // Target text in assistant message
    messages.push({ role: 'assistant', content: cleanText });

    const body: any = {
      model,
      messages,
      audio: { format: 'wav' },
    };

    // Set voice field
    if (model === 'mimo-v2.5-tts-voicedesign') {
      // No voice field — description is in user message
    } else if (model === 'mimo-v2.5-tts-voiceclone') {
      // Clone: voice = DataURL of audio sample
      if (!voice || !voice.startsWith('data:')) {
        throw new Error('音色复刻需要音频样本 DataURL');
      }
      body.audio.voice = voice;
    } else {
      // Preset: voice = name like "Chloe"
      body.audio.voice = voice || 'Chloe';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errMsg = `MiMo TTS 错误: ${response.status}`;
      let rawBody = '';
      try {
        rawBody = await response.text();
        const errBody = JSON.parse(rawBody);
        errMsg = `MiMo TTS 错误: ${errBody?.error?.code || response.status} - ${errBody?.error?.message || rawBody.slice(0, 200)}`;
      } catch {
        errMsg += ` - ${rawBody.slice(0, 200)}`;
      }
      console.error('[MiMo TTS] Request:', { url, model, voiceLen: voice?.length, voiceStart: voice?.slice(0, 30), emotion, textLen: cleanText.length });
      console.error('[MiMo TTS] Body:', JSON.stringify(body).slice(0, 500));
      console.error('[MiMo TTS] Response:', errMsg);
      throw new Error(errMsg);
    }

    return await this.saveAudioResponse(response);
  }

  static getPresetVoices(): Array<{ name: string; desc: string }> {
    return [
      { name: 'Chloe', desc: '温柔女声' },
      { name: 'Alloy', desc: '中性自然' },
      { name: 'Echo', desc: '清澈男声' },
      { name: 'Fable', desc: '沉稳叙述' },
      { name: 'Onyx', desc: '低沉磁性' },
      { name: 'Nova', desc: '活泼少女' },
      { name: 'Shimmer', desc: '明亮甜美' },
    ];
  }

  private async saveAudioResponse(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') || '';
    console.log('[MiMo TTS] Response content-type:', contentType);

    // Case 1: Direct audio response
    if (contentType.includes('audio/')) {
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      // @ts-ignore
      const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
      const ext = contentType.includes('wav') ? 'wav' : 'mp3';
      const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.${ext}`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      console.log('[MiMo TTS] Saved audio file:', fileUri, 'size:', bytes.length);
      return fileUri;
    }

    // Case 2: JSON response with base64 audio data
    const data = await response.json();
    console.log('[MiMo TTS] JSON response keys:', Object.keys(data));

    const audioBase64 =
      data?.choices?.[0]?.message?.audio?.data ||
      data?.audio?.data ||
      data?.audio_base64 ||
      data?.data?.audio ||
      null;

    if (!audioBase64) {
      console.error('[MiMo TTS] No audio data in response:', JSON.stringify(data).slice(0, 300));
      throw new Error('MiMo TTS 返回了空音频。请检查模型名和 API 配置。');
    }

    const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.wav`;
    await FileSystem.writeAsStringAsync(fileUri, audioBase64, { encoding: FileSystem.EncodingType.Base64 });
    console.log('[MiMo TTS] Saved audio from JSON:', fileUri);
    return fileUri;
  }
}
