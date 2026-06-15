/**
 * Curoco — Summary Worker
 * Background compression of old messages into long-term memory
 */

import { MessageRepository } from '../../db/repositories/MessageRepository';
import { ConversationRepository } from '../../db/repositories/ConversationRepo';
import { SettingsRepository } from '../../db/repositories/SettingsRepository';
import { PromptBuilder } from '../engine/PromptBuilder';
import { LLMClient } from '../api/LLMClient';
import type { ApiConfig } from '../../types/models';
import { SUMMARY_SYSTEM_PROMPT } from '../../utils/constants';

export class SummaryWorker {
  private conversationId: string;
  private llmClient: LLMClient;

  constructor(conversationId: string, llmConfig: ApiConfig) {
    this.conversationId = conversationId;
    this.llmClient = new LLMClient(llmConfig);
  }

  /**
   * Check if compression is needed and execute it
   */
  async checkAndCompress(): Promise<void> {
    const settings = await SettingsRepository.getSettings();
    const conversation = await ConversationRepository.getById(this.conversationId);

    if (!conversation) return;

    const totalCount = conversation.totalMessageCount;

    if (totalCount < settings.compressionTriggerCount) return;

    // How many messages to compress (everything outside the active window)
    const compressCount = totalCount - settings.activeMemoryWindowSize;
    if (compressCount <= 0) return;

    // Get the oldest messages to compress
    const oldMessages = await MessageRepository.getOlderThan(
      this.conversationId,
      0,
      compressCount
    );

    if (oldMessages.length === 0) return;

    // Build summary prompt
    const summaryPrompt = PromptBuilder.buildSummaryPrompt(
      oldMessages.map((m) => ({ role: m.role, content: m.content })),
      conversation.longTermMemorySummary
    );

    try {
      // Call LLM for summary
      const summary = await this.llmClient.chat(summaryPrompt);

      // Update long-term memory
      const updatedSummary = conversation.longTermMemorySummary
        ? `${conversation.longTermMemorySummary}\n${summary}`
        : summary;

      await ConversationRepository.updateLongTermMemory(
        this.conversationId,
        updatedSummary
      );

      // NOTE: Messages are preserved for complete chat history.
      // The long-term memory summary is updated, but original messages remain in DB.
      // Users can enable "full memory mode" in settings to prevent any compression.
    } catch (error) {
      // Summary compression failed silently — messages stay in DB
      console.warn('Summary compression failed:', error);
    }
  }

  updateLLMConfig(config: ApiConfig): void {
    this.llmClient.updateConfig(config);
  }
}
