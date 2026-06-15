/**
 * Curoco — Vision API Client
 * MiMo: POST /v1/chat/completions, api-key header, model: mimo-v2.5, max_completion_tokens
 * OpenAI: POST /v1/chat/completions, Bearer token, max_tokens
 */

import type { ApiConfig } from '../../types/models';

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.match(/\/v\d+$/)) url = url + '/v1';
  return url;
}

export class VisionClient {
  private config: ApiConfig | null;

  constructor(config: ApiConfig | null) {
    this.config = config;
  }

  async analyze(imageBase64: string, userPrompt?: string): Promise<string> {
    if (!this.config) throw new Error('Vision API 未配置');

    const isMiMo = this.config.baseUrl.includes('xiaomimimo');
    const url = `${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`;

    const body: any = {
      model: isMiMo ? (this.config.modelName || 'mimo-v2.5') : (this.config.modelName || 'gpt-4o'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt || '请描述这张图片的内容，用简洁的中文。' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    };

    // MiMo uses max_completion_tokens, OpenAI uses max_tokens
    if (isMiMo) {
      body.max_completion_tokens = 500;
    } else {
      body.max_tokens = 500;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(isMiMo
        ? { 'api-key': this.config.apiKey }
        : { Authorization: `Bearer ${this.config.apiKey}` }),
    };

    console.log('[Vision] Request:', { url, model: body.model, isMiMo });

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      let errMsg = `Vision API 错误: ${response.status}`;
      try {
        const errBody = await response.text();
        errMsg += ` - ${errBody.slice(0, 300)}`;
        console.error('[Vision] Error response:', errBody.slice(0, 500));
      } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    console.log('[Vision] Response:', JSON.stringify(data).slice(0, 200));
    return data?.choices?.[0]?.message?.content || '';
  }

  isConfigured(): boolean { return this.config !== null; }
  updateConfig(config: ApiConfig | null): void { this.config = config; }
}
