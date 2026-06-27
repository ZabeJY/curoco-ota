/**
 * Curoco — Active Memory
 * Sliding window of recent messages for context
 */

import { MessageRepository } from '../../db/repositories/MessageRepository';
import { ConversationRepository } from '../../db/repositories/ConversationRepo';
import { SettingsRepository } from '../../db/repositories/SettingsRepository';
import type { Message } from '../../types/models';

export class ActiveMemory {
  private conversationId: string;

  constructor(conversationId: string) {
    this.conversationId = conversationId;
  }

  /**
   * Get the N most recent messages (active memory window)
   * In full memory mode (compressionTriggerCount >= 99999), returns up to 200 messages
   */
  async getRecent(): Promise<Message[]> {
    const settings = await SettingsRepository.getSettings();
    const isFullMemory = settings.compressionTriggerCount >= 99999;
    const windowSize = isFullMemory ? Math.min(200, settings.activeMemoryWindowSize * 10) : settings.activeMemoryWindowSize;
    return MessageRepository.getRecent(
      this.conversationId,
      windowSize
    );
  }

  /**
   * Get the long-term memory summary for this conversation
   */
  async getLongTermMemory(): Promise<string> {
    const conv = await ConversationRepository.getById(this.conversationId);
    return conv?.longTermMemorySummary || '';
  }

  /**
   * Get recent system messages (call events, notifications) for context hints
   */
  async getRecentSystemMessages(): Promise<Array<{ content: string; createdAt: string }>> {
    return MessageRepository.getRecentSystem(this.conversationId, 5);
  }

  /**
   * Get total message count
   */
  async getTotalCount(): Promise<number> {
    return MessageRepository.count(this.conversationId);
  }
}
