/**
 * Curoco — Proactive Message Manager
 * Handles scheduled proactive messages and auto-follow-up
 * Runs as a singleton, checks periodically
 */

import { CompanionRepository } from '../db/repositories/CompanionRepository';
import { ConversationRepository } from '../db/repositories/ConversationRepo';
import { MessageRepository } from '../db/repositories/MessageRepository';
import { ScheduleRepository } from '../db/repositories/ScheduleRepository';
import { getDatabase } from '../db';
import { MessageEngine, type MessageEngineCallbacks } from './engine/MessageEngine';
import { PersonaEngine } from './persona/PersonaEngine';
import type { Companion, ApiConfig } from '../types/models';
import { v4 as uuidv4 } from 'uuid';
import { AppState, type AppStateStatus } from 'react-native';

function genId(): string {
  try { return uuidv4(); } catch { return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

class ProactiveManager {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private llmConfig: ApiConfig | null = null;
  private visionConfig: ApiConfig | null = null;
  private ttsConfig: ApiConfig | null = null;
  private onNewMessage: ((conversationId: string) => void) | null = null;
  private appStateSub: any = null;
  private lastCheckTime: number = Date.now();
  private isPaused: boolean = false;

  start(llmConfig: ApiConfig | null, visionConfig: ApiConfig | null, ttsConfig: ApiConfig | null, onNewMessage?: (conversationId: string) => void) {
    this.llmConfig = llmConfig;
    this.visionConfig = visionConfig;
    this.ttsConfig = ttsConfig;
    this.onNewMessage = onNewMessage || null;
    this.lastCheckTime = Date.now();

    // Check every 60 seconds
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      if (!this.isPaused) this.check();
    }, 60000);
    // Also check once after 10 seconds
    setTimeout(() => this.check(), 10000);

    // Listen for AppState changes
    if (!this.appStateSub) {
      this.appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          this.isPaused = false;
          // Catch up on missed checks when coming back from background
          const elapsed = Date.now() - this.lastCheckTime;
          if (elapsed > 120000) {
            this.check();
          }
        } else {
          this.isPaused = true;
        }
      });
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.appStateSub) {
      this.appStateSub.remove();
      this.appStateSub = null;
    }
  }

  private async check() {
    if (!this.llmConfig) return;
    this.lastCheckTime = Date.now();

    try {
      const companions = await CompanionRepository.getAll();

      for (const comp of companions) {
        // Check proactive messages
        if (comp.proactiveMessageEnabled) {
          await this.checkProactive(comp);
        }

        // Check auto-follow-up
        if (comp.autoFollowUpEnabled) {
          await this.checkAutoFollowUp(comp);
        }
      }

      // Check proactive calls (every 30 minutes)
      await this.checkProactiveCalls();
    } catch (e) {
      console.warn('Proactive check failed:', e);
    }
  }

  private async checkProactive(comp: Companion) {
    const schedule = await ScheduleRepository.getByCompanion(comp.id);
    if (!schedule || !schedule.isActive) return;

    const now = new Date();
    const lastTriggered = schedule.lastTriggeredAt ? new Date(schedule.lastTriggeredAt) : null;

    if (schedule.type === 'fixed') {
      // Check if current time matches any fixed time
      const times: string[] = JSON.parse(schedule.fixedTimes);
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (times.includes(currentTime)) {
        // Don't trigger twice in the same minute
        if (lastTriggered && (now.getTime() - lastTriggered.getTime()) < 60000) return;
        await this.sendProactiveMessage(comp);
        await ScheduleRepository.markTriggered(comp.id);
      }
    } else {
      // Random interval
      const minMs = schedule.randomIntervalMin * 3600000;
      const maxMs = schedule.randomIntervalMax * 3600000;
      const elapsed = lastTriggered ? now.getTime() - lastTriggered.getTime() : maxMs;

      if (elapsed >= minMs) {
        // Random chance based on how far past min interval
        const chance = Math.min(1, (elapsed - minMs) / (maxMs - minMs));
        if (Math.random() < chance) {
          await this.sendProactiveMessage(comp);
          await ScheduleRepository.markTriggered(comp.id);
        }
      }
    }
  }

  private async checkAutoFollowUp(comp: Companion) {
    const conversation = await ConversationRepository.getByCompanionId(comp.id);
    if (!conversation) return;

    // Check if last message was from AI (meaning user hasn't replied)
    const recentMessages = await MessageRepository.getRecent(conversation.id, 1);
    if (recentMessages.length === 0) return;

    const lastMsg = recentMessages[0];
    if (lastMsg.role !== 'assistant') return; // User sent last message, no follow-up needed

    // Check how long since last AI message
    const lastMsgTime = new Date(lastMsg.createdAt).getTime();
    const elapsed = Date.now() - lastMsgTime;
    const timeoutMs = comp.autoFollowUpTimeoutMin * 60000;

    if (elapsed >= timeoutMs) {
      await this.sendProactiveMessage(comp, true);
    }
  }

  /**
   * Check if any companion should proactively call the user
   */
  async checkProactiveCalls(): Promise<void> {
    if (!this.llmConfig) return;

    try {
      const companions = await CompanionRepository.getAll();
      const now = new Date();
      const hour = now.getHours();

      // Only call during reasonable hours (9am-9pm)
      if (hour < 9 || hour >= 21) return;

      for (const comp of companions) {
        if (!comp.proactiveMessageEnabled) continue;

        const conv = await ConversationRepository.getByCompanionId(comp.id);
        if (!conv) continue;

        // Check last message time
        const lastMsg = await MessageRepository.getRecent(conv.id, 1);
        if (lastMsg.length === 0) continue;

        const lastMsgTime = new Date(lastMsg[0].createdAt).getTime();
        const hoursSinceLastMsg = (Date.now() - lastMsgTime) / 3600000;

        // Call if inactive for 4+ hours
        if (hoursSinceLastMsg >= 4) {
          // Check if we already called today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayMessages = await MessageRepository.getRecent(conv.id, 20);
          const alreadyCalledToday = todayMessages.some(
            (m) => m.type === 'system_notification' &&
              m.content.includes('语音通话') &&
              new Date(m.createdAt) >= today
          );

          if (!alreadyCalledToday) {
            // Trigger proactive call notification
            const { sendNotification } = require('./NotificationManager');
            await sendNotification({
              type: 'voice_call',
              companionId: comp.id,
              companionName: comp.name,
              conversationId: conv.id,
              message: `${comp.name} 想和你语音通话`,
            });
            return; // Only one call per check
          }
        }
      }
    } catch (e) {
      console.warn('Proactive call check failed:', e);
    }
  }

  private async sendProactiveMessage(comp: Companion, isFollowUp: boolean = false) {
    if (!this.llmConfig) return;

    try {
      const conversation = await ConversationRepository.getByCompanionId(comp.id);
      if (!conversation) return;

      // Read user signature from settings
      const db = await getDatabase();
      const sigRow = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', ['userSignature']);
      const userSignature = sigRow?.value || '';

      const persona = await PersonaEngine.load(comp.id, userSignature);
      if (!persona) return;

      const { PromptBuilder } = require('./engine/PromptBuilder');
      const { ResponseParser } = require('./engine/ResponseParser');

      const systemPrompt = PromptBuilder.buildSystemPrompt(persona);
      const activeMessages = await MessageRepository.getRecent(conversation.id, 10);
      const longTermMemory = conversation.longTermMemorySummary || '';

      const prompt = isFollowUp
        ? '对方有一段时间没回复了。根据你们的关系和对话内容，自然地发一条消息。可以是关心、撒娇、分享日常。简短自然。'
        : '现在是主动联系对方的时间。根据你们的关系和最近的对话，自然地发一条消息。';

      const messages = PromptBuilder.buildMessages(systemPrompt, longTermMemory, activeMessages, prompt);

      const { LLMClient } = require('./api/LLMClient');
      const llmClient = new LLMClient(this.llmConfig);
      const rawResponse = await llmClient.chat(messages);
      const structured = ResponseParser.parse(rawResponse);

      // Save the AI message (with optional TTS)
      for (const msgText of structured.messages) {
        let mediaUri: string | null = null;
        let mediaDuration: number | null = null;
        let msgType: 'text' | 'voice' = 'text';

        // Try TTS if companion has voice enabled
        if (comp.voiceEnabled && comp.ttsVoiceId && this.ttsConfig) {
          try {
            const ttsId = comp.ttsVoiceId;
            if (this.ttsConfig.baseUrl.includes('xiaomimimo')) {
              const { MiMoTTSClient } = require('./api/MiMoTTSClient');
              const client = new MiMoTTSClient(this.ttsConfig);
              let model: any = 'mimo-v2.5-tts';
              let voice = 'Chloe';
              if (ttsId === 'clone' && comp.ttsVoiceSampleUri) {
                const FS = require('expo-file-system');
                const info = await FS.getInfoAsync(comp.ttsVoiceSampleUri);
                if (info.exists) {
                  const b64 = await FS.readAsStringAsync(comp.ttsVoiceSampleUri, { encoding: FS.EncodingType.Base64 });
                  model = 'mimo-v2.5-tts-voiceclone';
                  voice = `data:audio/mp3;base64,${b64}`;
                }
              } else if (ttsId.startsWith('preset:')) {
                voice = ttsId.slice(7);
              } else if (ttsId.startsWith('design:')) {
                model = 'mimo-v2.5-tts-voicedesign';
                voice = ttsId.slice(7);
              } else {
                voice = ttsId || 'Chloe';
              }
              if (msgText.trim()) {
                mediaUri = await client.synthesize(msgText, model as any, voice, structured.emotion);
              }
              mediaDuration = Math.ceil(msgText.length * 0.15);
              msgType = 'voice';
            } else {
              const { TTSClient } = require('./api/TTSClient');
              const client = new TTSClient(this.ttsConfig);
              mediaUri = await client.synthesize(msgText, ttsId, 1.0);
              mediaDuration = Math.ceil(msgText.length * 0.15);
              msgType = 'voice';
            }
          } catch (e) {
            console.warn('Proactive TTS failed:', e);
          }
        }

        await MessageRepository.create({
          conversationId: conversation.id,
          role: 'assistant',
          type: msgType,
          content: msgText,
          emotion: structured.emotion,
          mediaUri,
          mediaDuration,
        });
        await ConversationRepository.updateLastAIMessage(conversation.id, msgType === 'voice' ? '[语音消息]' : msgText.slice(0, 50));
        await ConversationRepository.incrementMessageCount(conversation.id);
      }

      // Send notification for proactive message
      try {
        const { sendNotification } = require('./NotificationManager');
        const preview = structured.messages[0]?.slice(0, 100) || '发来了一条消息';
        await sendNotification({
          type: 'chat_message',
          companionId: comp.id,
          companionName: comp.name,
          conversationId: conversation.id,
          message: isFollowUp ? `${comp.name} 想你了：${preview}` : preview,
        });
      } catch (e) {
        console.warn('Proactive notification failed:', e);
      }

      // Notify the UI
      this.onNewMessage?.(conversation.id);
    } catch (e) {
      console.warn('Proactive message failed for', comp.name, ':', e);
    }
  }
}

export const proactiveManager = new ProactiveManager();
