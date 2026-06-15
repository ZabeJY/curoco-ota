/**
 * Curoco — ASR Client
 * MiMo: POST /v1/chat/completions, model: mimo-v2.5-asr
 * OpenAI: POST /v1/audio/transcriptions (multipart form)
 */

import { Platform, NativeModules } from 'react-native';
import type { ApiConfig } from '../../types/models';

function getDeviceLanguage(): string {
  try {
    const locale =
      Platform.OS === 'ios'
        ? NativeModules.SettingsManager?.settings?.AppleLocale ||
          NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
        : NativeModules.I18nManager?.localeIdentifier;
    if (locale && typeof locale === 'string') {
      return locale.split(/[-_]/)[0].toLowerCase();
    }
  } catch {}
  return 'zh';
}

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.match(/\/v\d+$/)) url = url + '/v1';
  return url;
}

export class ASRClient {
  private config: ApiConfig | null;

  constructor(config: ApiConfig | null) {
    this.config = config;
  }

  async transcribe(audioBase64: string, mimeType: string = 'audio/mp4'): Promise<string> {
    if (!this.config) throw new Error('ASR API 未配置');

    const isMiMo = this.config.baseUrl.includes('xiaomimimo');
    if (isMiMo) return this.transcribeMiMo(audioBase64, mimeType);
    return this.transcribeOpenAI(audioBase64, mimeType);
  }

  private async transcribeMiMo(audioBase64: string, mimeType: string): Promise<string> {
    const url = `${normalizeBaseUrl(this.config!.baseUrl)}/chat/completions`;
    // Sanitize: strip any existing data: prefix to prevent double-header (data data:audio/wav;base64,...)
    let cleanBase64 = audioBase64;
    if (cleanBase64.startsWith('data:')) {
      const commaIndex = cleanBase64.indexOf(',');
      if (commaIndex !== -1) cleanBase64 = cleanBase64.slice(commaIndex + 1);
    }
    const dataUrl = `data:${mimeType};base64,${cleanBase64}`;

    const body = {
      model: this.config!.modelName || 'mimo-v2.5-asr',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: { data: dataUrl },
            },
          ],
        },
      ],
      asr_options: {
        language: getDeviceLanguage(),
      },
    };

    console.log('[ASR] MiMo request:', { url, model: body.model, dataLen: dataUrl.length });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config!.apiKey,
    };
    if (this.config!.extraHeaders) Object.assign(headers, this.config!.extraHeaders);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      let errMsg = `MiMo ASR 错误: ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = `MiMo ASR 错误: ${errBody?.error?.code || response.status} - ${errBody?.error?.message || '未知'}`;
        console.error('[ASR] Error:', errBody);
      } catch {
        try { errMsg += ` - ${(await response.text()).slice(0, 200)}`; } catch {}
      }
      throw new Error(errMsg);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content || '';
    console.log('[ASR] MiMo response:', { hasChoices: !!data?.choices, textLen: text.length, textPreview: text.slice(0, 50) });
    if (!text) {
      console.warn('[ASR] MiMo returned empty text. Response structure:', JSON.stringify(data).slice(0, 200));
    }
    return text;
  }

  private async transcribeOpenAI(audioBase64: string, mimeType: string): Promise<string> {
    const url = `${normalizeBaseUrl(this.config!.baseUrl)}/audio/transcriptions`;

    // Sanitize: strip any existing data: prefix
    let cleanBase64 = audioBase64;
    if (cleanBase64.startsWith('data:')) {
      const commaIndex = cleanBase64.indexOf(',');
      if (commaIndex !== -1) cleanBase64 = cleanBase64.slice(commaIndex + 1);
    }

    // Determine filename extension from MIME type
    const extMap: Record<string, string> = { 'audio/wav': 'wav', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg' };
    const ext = extMap[mimeType] || 'm4a';

    const formData = new FormData();
    const byteCharacters = atob(cleanBase64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
    const blob = new Blob([byteArray], { type: mimeType });
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', this.config!.modelName || 'whisper-1');
    formData.append('language', 'zh');

    // Build headers: support both Bearer and api-key, merge extraHeaders
    const headers: Record<string, string> = {};
    if (this.config!.apiKey) {
      headers['Authorization'] = `Bearer ${this.config!.apiKey}`;
    }
    if (this.config!.extraHeaders) {
      Object.assign(headers, this.config!.extraHeaders);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errMsg = `ASR 错误: ${response.status}`;
      try {
        const errBody = await response.json();
        errMsg = `ASR 错误: ${response.status} - ${errBody?.error?.message || '未知'}`;
      } catch {
        try { errMsg += ` - ${(await response.text()).slice(0, 200)}`; } catch {}
      }
      throw new Error(errMsg);
    }
    const data = await response.json();
    return data.text || '';
  }

  isConfigured(): boolean { return this.config !== null; }
  updateConfig(config: ApiConfig | null): void { this.config = config; }
}
