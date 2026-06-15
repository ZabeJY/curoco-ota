/**
 * Curoco — Response Parser
 * Parses structured JSON, strips ALL non-dialogue content
 */

import type { StructuredLLMResponse } from '../../types/message';
import { cleanLLMOutputFull, cleanMessageContent } from '../../utils/textFilter';

export class ResponseParser {
  static parse(rawResponse: string): StructuredLLMResponse {
    const cleaned = cleanLLMOutputFull(rawResponse);

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch {}
      }
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages)) {
      return ResponseParser.normalize(parsed);
    }

    // Fallback: segment plain text
    return ResponseParser.segmentPlainText(cleaned || '...');
  }

  private static normalize(data: any): StructuredLLMResponse {
    const emotion = typeof data.emotion === 'string' ? data.emotion : 'neutral';
    const speed_modifier = typeof data.speed_modifier === 'number' ? data.speed_modifier : 1.0;
    const send_voice = data.send_voice === true;

    let messages: string[];
    if (Array.isArray(data.messages) && data.messages.length > 0) {
      messages = data.messages
        .filter((m: any) => typeof m === 'string' && m.trim().length > 0)
        .map((m: string) => cleanMessageContent(m));
    } else if (typeof data.messages === 'string') {
      messages = [cleanMessageContent(data.messages)];
    } else if (typeof data.content === 'string') {
      messages = [cleanMessageContent(data.content)];
    } else {
      messages = ['...'];
    }

    messages = messages.filter((m) => m.length > 0);
    if (messages.length === 0) messages = ['...'];

    // Split overly long messages
    messages = messages.flatMap((m) => ResponseParser.splitLongMessage(m));

    return { emotion, speed_modifier, send_voice, messages };
  }

  private static segmentPlainText(text: string): StructuredLLMResponse {
    const cleaned = cleanMessageContent(text);
    const segments = ResponseParser.splitLongMessage(cleaned);
    return {
      emotion: 'neutral',
      speed_modifier: 1.0,
      send_voice: false,
      messages: segments.length > 0 ? segments : ['...'],
    };
  }

  private static splitLongMessage(text: string): string[] {
    if (text.length <= 25) return [text];
    const sentences = text.split(/(?<=[。！？\n])\s*/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 1) {
      if (text.length > 40) {
        const parts = text.split(/(?<=[，,、])\s*/).filter((s) => s.trim().length > 0);
        if (parts.length > 1) return ResponseParser.groupSegments(parts, 2);
      }
      return [text];
    }
    return ResponseParser.groupSegments(sentences, 2);
  }

  private static groupSegments(pieces: string[], maxPerGroup: number): string[] {
    const result: string[] = [];
    let current = '';
    for (const piece of pieces) {
      if (current.length + piece.length > 50 && current.length > 0) {
        result.push(current.trim());
        current = piece;
      } else {
        current += (current && !current.endsWith('\n') ? '' : '') + piece;
      }
    }
    if (current.trim()) result.push(current.trim());
    return result.filter((s) => s.length > 0);
  }
}
