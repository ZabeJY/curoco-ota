/**
 * Curoco — LLM API Client
 * MiMo: api-key header
 * OpenAI: Bearer token
 */

import type { ChatMessage, LLMRequest, LLMResponse } from '../../types/api';
import type { ApiConfig } from '../../types/models';

function normalizeBaseUrl(baseUrl: string): string {
  let url = baseUrl.replace(/\/+$/, '');
  if (!url.match(/\/v\d+$/)) url = url + '/v1';
  return url;
}

export class LLMClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const isMiMo = this.config.baseUrl.includes('xiaomimimo');

    const body: LLMRequest = {
      model: this.config.modelName || (isMiMo ? 'mimo-v2.5-pro' : 'gpt-4o'),
      messages,
      temperature: 0.8,
      max_tokens: 1024,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(isMiMo
        ? { 'api-key': this.config.apiKey }
        : { Authorization: `Bearer ${this.config.apiKey}` }),
      ...((this.config.extraHeaders as Record<string, string>) || {}),
    };

    const url = `${normalizeBaseUrl(this.config.baseUrl)}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM API error ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data: LLMResponse = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  updateConfig(config: ApiConfig): void {
    this.config = config;
  }
}
