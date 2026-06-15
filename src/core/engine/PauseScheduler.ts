/**
 * Curoco — Pause Scheduler
 * Calculates emotional delay for each message in the queue
 */

import type { QueuedMessage, PauseStrategy, StructuredLLMResponse } from '../../types/message';
import { DEFAULT_PAUSE_STRATEGY } from '../../types/message';

export class PauseScheduler {
  private strategy: PauseStrategy;

  constructor(strategy: PauseStrategy = DEFAULT_PAUSE_STRATEGY) {
    this.strategy = strategy;
  }

  /**
   * Convert structured LLM response into a queue of messages with delays
   */
  buildQueue(response: StructuredLLMResponse): QueuedMessage[] {
    const { emotion, speed_modifier, send_voice, messages } = response;
    const multiplier =
      this.strategy.emotionMultipliers[emotion] ||
      this.strategy.emotionMultipliers.default;

    return messages.map((content, index) => {
      const charCount = content.length;
      const isLast = index === messages.length - 1;

      // Base typing time: characters * base delay
      let delayMs = charCount * this.strategy.baseCharDelayMs;

      // Apply speed modifier from LLM
      delayMs *= speed_modifier;

      // Apply emotion multiplier
      delayMs *= multiplier;

      // Add extra pause for emotional messages (between messages, not before first)
      if (index > 0) {
        if (emotion === 'shy' || emotion === 'sad') {
          delayMs += 1500 + Math.random() * 1500; // 1.5-3s extra
        } else if (emotion === 'thinking') {
          delayMs += 800 + Math.random() * 700; // 0.8-1.5s extra
        } else if (emotion === 'excited') {
          delayMs *= 0.6; // Faster for excited
        }
      }

      // Clamp to max
      delayMs = Math.min(delayMs, this.strategy.maxDelayMs);

      // Minimum delay for realism
      delayMs = Math.max(delayMs, 300);

      return {
        content,
        delayMs: Math.round(delayMs),
        emotion,
        sendVoice: send_voice,
        isLast,
      };
    });
  }

  /**
   * Calculate total time for a message queue
   */
  static totalDelay(queue: QueuedMessage[]): number {
    return queue.reduce((sum, msg) => sum + msg.delayMs, 0);
  }

  updateStrategy(strategy: Partial<PauseStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }
}
