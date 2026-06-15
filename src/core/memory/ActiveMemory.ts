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
   */
  async getRecent(): Promise<Message[]> {
    const settings = await SettingsRepository.getSettings();
    return MessageRepository.getRecent(
      this.conversationId,
      settings.activeMemoryWindowSize
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
