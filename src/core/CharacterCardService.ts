/**
 * Curoco — Character Card Service
 * Export/Import companions with memory and session data
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { CompanionRepository } from '../db/repositories/CompanionRepository';
import { ConversationRepository } from '../db/repositories/ConversationRepo';
import { MessageRepository } from '../db/repositories/MessageRepository';
import type { CharacterCard } from '../types/characterCard';
import type { Companion } from '../types/models';

const CARD_VERSION = '1.0';

export const CharacterCardService = {
  /**
   * Export a companion to a .curoco card file
   */
  async exportCard(companionId: string): Promise<string> {
    const companion = await CompanionRepository.getById(companionId);
    if (!companion) throw new Error('角色不存在');

    const conversation = await ConversationRepository.getByCompanionId(companionId);
    const recentMessages = conversation
      ? await MessageRepository.getRecent(conversation.id, 20)
      : [];

    // Build avatar base64 if exists
    let avatarBase64: string | null = null;
    if (companion.avatarUri) {
      try {
        const info = await FileSystem.getInfoAsync(companion.avatarUri);
        if (info.exists) {
          avatarBase64 = await FileSystem.readAsStringAsync(companion.avatarUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      } catch {}
    }

    // Extract memory tags from long-term summary
    const longTermSummary = conversation?.longTermMemorySummary || '';
    const memoryTags = longTermSummary
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((l) => l.trim());

    const card: CharacterCard = {
      version: CARD_VERSION,
      exportedAt: new Date().toISOString(),
      deviceName: 'Curoco App',

      persona: {
        name: companion.name,
        gender: companion.gender,
        age: companion.age,
        relationship: companion.relationship,
        nicknameForUser: companion.nicknameForUser,
        personality: companion.personality,
        backstory: companion.backstory,
        worldSetting: companion.worldSetting,
        voiceEnabled: companion.voiceEnabled,
        proactiveMessageEnabled: companion.proactiveMessageEnabled,
        proactiveIntervalMin: companion.proactiveMessageIntervalMin,
        proactiveIntervalMax: companion.proactiveMessageIntervalMax,
        autoFollowUpEnabled: companion.autoFollowUpEnabled,
        autoFollowUpTimeoutMin: companion.autoFollowUpTimeoutMin,
        ttsVoiceId: companion.ttsVoiceId,
        avatarUri: avatarBase64 ? `data:image/jpeg;base64,${avatarBase64}` : null,
        signature: companion.signature,
        speakingStyle: companion.speakingStyle,
        tabooTopics: companion.tabooTopics,
        likes: companion.likes,
        catchphrase: companion.catchphrase,
        emotionStyle: companion.emotionStyle,
      },

      memory: {
        longTermSummary,
        memoryTags,
      },

      session: {
        sessionId: conversation?.id || '',
        lastMessages: recentMessages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.createdAt,
          emotion: m.emotion || undefined,
        })),
        totalMessageCount: conversation?.totalMessageCount || 0,
        lastActiveAt: conversation?.lastMessageAt || new Date().toISOString(),
      },
    };

    // Write to file
    const json = JSON.stringify(card, null, 2);
    const fileName = `${companion.name}_角色卡_${new Date().toISOString().slice(0, 10)}.curoco`;
    const filePath = (FileSystem.cacheDirectory || '') + fileName;
    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return filePath;
  },

  /**
   * Share the exported card file
   */
  async shareCard(filePath: string): Promise<void> {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: '分享角色卡',
      });
    }
  },

  /**
   * Import a .curoco card file
   */
  async importCard(): Promise<{ success: boolean; companionName?: string; error?: string }> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return { success: false, error: '未选择文件' };
      }

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const card: CharacterCard = JSON.parse(content);

      // Validate
      if (!card.version || !card.persona?.name) {
        return { success: false, error: '无效的角色卡文件' };
      }

      // Save avatar if exists
      let avatarUri = '';
      if (card.persona.avatarUri?.startsWith('data:image')) {
        try {
          const base64 = card.persona.avatarUri.split(',')[1];
          const cacheDir = (FileSystem.cacheDirectory || '') + 'avatars/';
          try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
          const dest = cacheDir + 'imported_' + Date.now() + '.jpg';
          await FileSystem.writeAsStringAsync(dest, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          avatarUri = dest;
        } catch {}
      }

      // Create companion
      const companion = await CompanionRepository.create({
        name: card.persona.name,
        avatarUri,
        gender: card.persona.gender,
        age: card.persona.age,
        relationship: card.persona.relationship,
        nicknameForUser: card.persona.nicknameForUser,
        personality: card.persona.personality,
        backstory: card.persona.backstory,
        worldSetting: card.persona.worldSetting,
        voiceEnabled: card.persona.voiceEnabled,
        proactiveMessageEnabled: card.persona.proactiveMessageEnabled,
        proactiveMessageIntervalMin: card.persona.proactiveIntervalMin,
        proactiveMessageIntervalMax: card.persona.proactiveIntervalMax,
        autoFollowUpEnabled: card.persona.autoFollowUpEnabled,
        autoFollowUpTimeoutMin: card.persona.autoFollowUpTimeoutMin,
        ttsVoiceId: card.persona.ttsVoiceId,
        ttsVoiceSampleUri: null,
        coverUri: null,
        signature: card.persona.signature,
        chatBackgroundUri: null,
        speakingStyle: card.persona.speakingStyle || '',
        tabooTopics: card.persona.tabooTopics || '',
        likes: card.persona.likes || '',
        catchphrase: card.persona.catchphrase || '',
        emotionStyle: card.persona.emotionStyle || '',
      });

      // Create conversation with restored memory
      const conversation = await ConversationRepository.create(companion.id);
      if (card.memory.longTermSummary) {
        await ConversationRepository.updateLongTermMemory(
          conversation.id,
          card.memory.longTermSummary
        );
      }

      // Restore recent messages
      if (card.session.lastMessages?.length > 0) {
        for (const msg of card.session.lastMessages) {
          await MessageRepository.create({
            conversationId: conversation.id,
            role: msg.role,
            content: msg.content,
            emotion: msg.emotion || null,
          });
        }
        // Update conversation preview
        const lastMsg = card.session.lastMessages[card.session.lastMessages.length - 1];
        await ConversationRepository.updateLastMessage(
          conversation.id,
          lastMsg.content.slice(0, 50)
        );
      }

      return { success: true, companionName: card.persona.name };
    } catch (e: any) {
      console.error('Import failed:', e);
      return { success: false, error: e?.message || '导入失败' };
    }
  },
};
