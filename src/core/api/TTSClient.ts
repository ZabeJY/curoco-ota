/**
 * Curoco — TTS Client
 * React Native compatible, auto-handles /v1 path
 */

import * as FileSystem from 'expo-file-system';
import type { TTSRequest, VoiceCloneRequest, VoiceCloneResponse } from '../../types/api';
import type { ApiConfig } from '../../types/models';

/**
 * Normalize base URL: ensure it ends with /v1 if not already present
 */
function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  // If URL doesn't end with /v1 (or /v1/), append it
  if (!url.match(/\/v\d+$/)) {
    url = url + '/v1';
  }
  return url;
}

export class TTSClient {
  private config: ApiConfig | null;

  constructor(config: ApiConfig | null) {
    this.config = config;
  }

  async synthesize(text: string, voiceId: string, speed: number = 1.0): Promise<string> {
    if (!this.config) {
      throw new Error('TTS API 未配置');
    }

    const baseUrl = normalizeBaseUrl(this.config.baseUrl);
    const url = `${baseUrl}/audio/speech`;

    const body: TTSRequest = {
      model: this.config.modelName || 'tts-1',
      input: text,
      voice: voiceId,
      speed,
      response_format: 'mp3',
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...((this.config.extraHeaders as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new Error(`网络错误: ${e?.message || '无法连接 TTS 服务器'}`);
    }

    if (!response.ok) {
      let errMsg = `TTS API 错误: ${response.status}`;
      try {
        const errBody = await response.text();
        // Try to extract useful info from HTML error pages
        if (errBody.includes('404')) {
          errMsg = `TTS 接口不存在 (404)\n请求地址: ${url}\n\n请检查:\n1. Base URL 是否正确（应包含 /v1）\n2. TTS API 是否支持此接口`;
        } else {
          errMsg += ` - ${errBody.slice(0, 150)}`;
        }
      } catch {}
      throw new Error(errMsg);
    }

    // React Native: read response as arrayBuffer → base64 → file
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // @ts-ignore
    const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');

    const fileUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return fileUri;
  }

  async cloneVoice(name: string, audioSamples: string[]): Promise<VoiceCloneResponse> {
    if (!this.config) {
      throw new Error('TTS API 未配置');
    }

    const baseUrl = normalizeBaseUrl(this.config.baseUrl);
    const url = `${baseUrl}/audio/voices`;

    const body: VoiceCloneRequest = { name, files: audioSamples };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...((this.config.extraHeaders as Record<string, string>) || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (e: any) {
      throw new Error(`网络错误: ${e?.message || '无法连接'}`);
    }

    if (!response.ok) {
      let errMsg = `音色克隆 API 错误: ${response.status}`;
      try {
        const errBody = await response.text();
        if (errBody.includes('404')) {
          errMsg = `音色克隆接口不存在 (404)\n请求地址: ${url}\n\n该 TTS 服务可能不支持音色克隆`;
        } else {
          errMsg += ` - ${errBody.slice(0, 150)}`;
        }
      } catch {}
      throw new Error(errMsg);
    }

    return await response.json();
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  updateConfig(config: ApiConfig | null): void {
    this.config = config;
  }
}
