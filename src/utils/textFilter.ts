/**
 * Curoco — Text Sanitizer
 * Strips ALL non-dialogue content: actions, emotions, stage directions
 */

/**
 * Remove <think>...</think> blocks
 */
export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Remove markdown code fences
 */
export function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (match) return match[1].trim();
  return text.trim();
}

/**
 * Clean raw LLM output (before JSON parsing)
 */
export function cleanLLMOutput(raw: string): string {
  let cleaned = raw;
  cleaned = stripThinkTags(cleaned);
  cleaned = stripCodeFences(cleaned);
  return cleaned.trim();
}

/**
 * Aggressive sanitizer — strips ALL non-dialogue content
 * This is the nuclear option: any parenthesized/bracketed content is removed
 */
export function sanitizeDialogue(raw: string): string {
  let text = raw;

  // 1. Remove *action* and **action** (star-enclosed)
  text = text.replace(/\*{1,2}[^*]+\*{1,2}/g, '');

  // 2. Remove （中文括号） content
  text = text.replace(/（[^）]*）/g, '');

  // 3. Remove (英文括号) content
  text = text.replace(/\([^)]*\)/g, '');

  // 4. Remove [方括号] content
  text = text.replace(/\[[^\]]*\]/g, '');

  // 5. Remove 【中文方括号】 content
  text = text.replace(/【[^】]*】/g, '');

  // 6. Remove standalone action verbs at sentence start
  text = text.replace(/^[，,。.、\s]+/, '');

  // 7. Clean up orphaned punctuation
  text = text.replace(/[，,]{2,}/g, '，');
  text = text.replace(/。{2,}/g, '。');
  text = text.replace(/\s{2,}/g, ' ');

  // 8. Trim
  text = text.trim();

  return text;
}

/**
 * Clean raw LLM output BEFORE JSON parsing
 * Only strips think tags and code fences — does NOT sanitize dialogue
 * (sanitization happens AFTER JSON extraction, on individual messages)
 */
export function cleanLLMOutputFull(raw: string): string {
  let cleaned = raw;
  cleaned = stripThinkTags(cleaned);
  cleaned = stripCodeFences(cleaned);
  return cleaned.trim();
}

/**
 * Clean a single message content (post-parse)
 * Used in ResponseParser after JSON extraction
 */
export function cleanMessageContent(text: string): string {
  return sanitizeDialogue(text);
}

/**
 * Clean text before sending to TTS engine
 * Ensures voice messages don't read out action descriptions
 */
export function cleanForTTS(text: string): string {
  return sanitizeDialogue(text);
}
