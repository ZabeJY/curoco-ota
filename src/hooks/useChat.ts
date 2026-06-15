/**
 * Curoco — useChat Hook
 * Voice, keyboard, background delivery, proactive messaging
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MessageRepository } from '../db/repositories/MessageRepository';
import { ConversationRepository } from '../db/repositories/ConversationRepo';
import { MessageEngine, type MessageEngineCallbacks } from '../core/engine/MessageEngine';
import { PersonaEngine } from '../core/persona/PersonaEngine';
import { TTSClient } from '../core/api/TTSClient';
import { MiMoTTSClient } from '../core/api/MiMoTTSClient';
import { cleanForTTS } from '../utils/textFilter';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { CompanionRepository } from '../db/repositories/CompanionRepository';
import type { DisplayMessage, QueuedMessage } from '../types/message';
import type { Message } from '../types/models';
import { StickerRepository } from '../db/repositories/StickerRepository';
import { sendNotification } from '../core/NotificationManager';
import { v4 as uuidv4 } from 'uuid';

function genId(): string {
  try { return uuidv4(); } catch { return 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

// Generate unique nonce for message deduplication
function genNonce(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function useChat(conversationId: string, companionId: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [companionName, setCompanionName] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState({
    ready: false, hasTTSConfig: false, ttsLabel: '',
    voiceEnabled: false, hasVoiceId: false, voiceIdLabel: '',
    aiSentVoice: false, ttsSuccess: false, ttsError: '',
  });
  const engineRef = useRef<MessageEngine | null>(null);
  const cancelledRef = useRef(false);
  const deliveryRef = useRef(false);
  const mountedRef = useRef(true);
  const isGeneratingRef = useRef(false); // True while AI is generating
  const pendingQueueRef = useRef<string[]>([]); // Buffered user messages
  const isSendingRef = useRef(false); // Anti-burst: send lock
  const recentDedupRef = useRef<Map<string, number>>(new Map()); // Anti-burst: content dedup
  const appStateRef = useRef<AppStateStatus>(AppState.currentState); // Track app state

  const { sessions, typingConversations, addMessage, setMessages, setTyping } = useChatStore();
  const { apiConfigs, settings } = useSettingsStore();

  const messages = sessions[conversationId] || [];
  const isTyping = typingConversations.has(conversationId);
  const isGenerating = isTyping; // Alias for UI

  // Initialize — runs once, engine stays alive even after unmount
  useEffect(() => {
    cancelledRef.current = false;
    mountedRef.current = true;
    let backgroundTimestamp: number | null = null;

    // Track app state for background notifications and foreground resume
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      // When going to background, record timestamp
      if (nextState === 'background' || nextState === 'inactive') {
        backgroundTimestamp = Date.now();
      }

      // When coming back to foreground, check for pending messages
      if (prevState === 'background' && nextState === 'active') {
        console.log('[useChat] App returned to foreground, checking pending queue');
        const backgroundDuration = backgroundTimestamp ? Date.now() - backgroundTimestamp : 0;
        backgroundTimestamp = null;

        // If AI was generating when app went to background and we were gone > 30 seconds,
        // the request likely timed out. Reset state silently — user can resend if needed.
        if (isGeneratingRef.current && backgroundDuration > 30000) {
          isGeneratingRef.current = false;
          setTyping(conversationId, false);
          console.log('[useChat] Background timeout (>30s), resetting generation state');
        }

        // If there are pending messages and no current generation, process them
        if (!isGeneratingRef.current && pendingQueueRef.current.length > 0) {
          const next = pendingQueueRef.current.shift()!;
          processMessage(next);
        }
      }
    });

    (async () => {
      setIsLoading(true);
      try {
        const persona = await PersonaEngine.load(companionId, settings.userSignature || '');
        if (!persona || cancelledRef.current) return;
        setCompanionName(persona.name);
        setVoiceEnabled(persona.voiceEnabled);

        const dbMessages = await MessageRepository.getRecent(conversationId, 50);
        if (cancelledRef.current) return;
        setMessages(conversationId, dbMessages.map(msgToDisplay));

        await ConversationRepository.resetUnread(conversationId);
        await MessageRepository.markConversationRead(conversationId);

        buildEngine(persona);
      } catch (e) {
        console.error('Chat init failed:', e);
      } finally {
        if (!cancelledRef.current) setIsLoading(false);
      }
    })();

    return () => {
      cancelledRef.current = false; // DON'T cancel — keep engine alive for background delivery
      mountedRef.current = false;
      appStateSub.remove();
    };
  }, [conversationId, companionId]);

  // Rebuild engine when API config changes
  useEffect(() => {
    if (apiConfigs.llm && companionId) {
      PersonaEngine.load(companionId, settings.userSignature || '').then((persona) => {
        if (persona) buildEngine(persona);
      });
    }
  }, [apiConfigs.llm, apiConfigs.vision, apiConfigs.tts]);

  function buildEngine(persona: any) {
    const llmConfig = apiConfigs.llm;
    if (!llmConfig) { engineRef.current = null; return; }

    const ttsConfig = apiConfigs.tts;
    let ttsClient: TTSClient | null = null;
    let mimoTtsClient: MiMoTTSClient | null = null;
    const hasTTSConfig = !!ttsConfig;
    const hasVoiceId = !!persona.ttsVoiceId;

    if (ttsConfig && persona.voiceEnabled && persona.ttsVoiceId) {
      if (ttsConfig.baseUrl.includes('xiaomimimo')) {
        mimoTtsClient = new MiMoTTSClient(ttsConfig);
      } else {
        ttsClient = new TTSClient(ttsConfig);
      }
    }

    setVoiceStatus({
      ready: hasTTSConfig && persona.voiceEnabled && hasVoiceId,
      hasTTSConfig, ttsLabel: ttsConfig?.label || '',
      voiceEnabled: persona.voiceEnabled, hasVoiceId,
      voiceIdLabel: persona.ttsVoiceId || '',
      aiSentVoice: false, ttsSuccess: false, ttsError: '',
    });

    let ttsCallCount = 0; // Track TTS calls for rate limiting

    const callbacks: MessageEngineCallbacks = {
      onTypingStart: () => setTyping(conversationId, true),
      onTypingEnd: () => setTyping(conversationId, false),
      onQueuedMessage: async (msg: QueuedMessage) => {
        // Don't block — allow multiple queued messages to be delivered

        let mediaUri: string | null = null;
        let mediaDuration: number | null = null;
        let msgType: 'text' | 'voice' = 'text';

        const hasTTS = (ttsClient && persona.ttsVoiceId) || mimoTtsClient;
        const aiWantsVoice = msg.sendVoice;
        const randomVoice = !aiWantsVoice && msg.content.length >= 4 && msg.content.length <= 200 && Math.random() < 0.5;
        const canUseTTS = hasTTS && (aiWantsVoice || randomVoice);

        if (aiWantsVoice) setVoiceStatus((p) => ({ ...p, aiSentVoice: true }));

        if (canUseTTS) {
          // Rate limit: wait between consecutive TTS calls
          if (ttsCallCount > 0) {
            await new Promise((r) => setTimeout(r, 2000)); // 2s between TTS calls
          }
          ttsCallCount++;

          // TTS with retry logic (retry once on failure)
          const maxRetries = 2;
          for (let attempt = 0; attempt < maxRetries && !mediaUri; attempt++) {
            try {
              if (mimoTtsClient && persona.ttsVoiceId) {
                const ttsId = persona.ttsVoiceId;

                let model: string;
                let voice: string;

                if (ttsId === 'clone' || ttsId.startsWith('clone:')) {
                  // Clone mode: load audio sample, convert to DataURL
                  try {
                    const comp = await CompanionRepository.getById(companionId);
                    const sampleUri = comp?.ttsVoiceSampleUri;
                    if (sampleUri) {
                      const FS = require('expo-file-system');
                      const info = await FS.getInfoAsync(sampleUri);
                      if (info.exists) {
                        const b64 = await FS.readAsStringAsync(sampleUri, { encoding: FS.EncodingType.Base64 });
                        const ext = sampleUri.split('.').pop()?.toLowerCase() || 'mp3';
                        const mime = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
                        model = 'mimo-v2.5-tts-voiceclone';
                        voice = `data:${mime};base64,${b64}`;
                      } else {
                        model = 'mimo-v2.5-tts';
                        voice = 'Chloe';
                      }
                    } else {
                      model = 'mimo-v2.5-tts';
                      voice = 'Chloe';
                    }
                  } catch {
                    model = 'mimo-v2.5-tts';
                    voice = 'Chloe';
                  }
                } else if (ttsId.startsWith('design:')) {
                  // Text description mode
                  model = 'mimo-v2.5-tts-voicedesign';
                  voice = ttsId.slice(7);
                } else {
                  // Preset voice (plain name like "Chloe" or "preset:Chloe")
                  const voiceName = ttsId.startsWith('preset:') ? ttsId.slice(7) : ttsId;
                  model = 'mimo-v2.5-tts';
                  voice = voiceName || 'Chloe';
                }

                const ttsText = cleanForTTS(msg.content).trim();
                if (ttsText) {
                  mediaUri = await mimoTtsClient.synthesize(ttsText, model as any, voice, msg.emotion || undefined);
                } else {
                  console.warn('[TTS] 文本清理后为空，跳过语音合成');
                }
              } else if (ttsClient && persona.ttsVoiceId) {
                const ttsText = cleanForTTS(msg.content).trim();
                if (ttsText) {
                  mediaUri = await ttsClient.synthesize(ttsText, persona.ttsVoiceId, 1.0);
                } else {
                  console.warn('[TTS] 文本清理后为空，跳过语音合成');
                }
              }
              if (mediaUri) {
                mediaDuration = Math.ceil(msg.content.length * 0.15);
                msgType = 'voice';
                setVoiceStatus((p) => ({ ...p, ttsSuccess: true, ttsError: '' }));
              }
            } catch (e: any) {
              console.warn(`TTS attempt ${attempt + 1} failed:`, e?.message);
              if (attempt === maxRetries - 1) {
                // Final attempt failed — send as text with error note
                setVoiceStatus((p) => ({ ...p, ttsSuccess: false, ttsError: e?.message || '未知错误' }));
                if (mountedRef.current) {
                  addMessage(conversationId, {
                    id: genId(), role: 'assistant', type: 'text',
                    content: `⚠️ 语音合成失败: ${e?.message || '未知错误'}`,
                    status: 'failed', isRead: true, createdAt: new Date().toISOString(),
                  });
                }
              } else {
                // Wait before retry
                await new Promise((r) => setTimeout(r, 1000));
              }
            }
          }
        }

        const aiMsg: DisplayMessage = {
          id: genId(), role: 'assistant', type: msgType,
          content: msg.content, emotion: msg.emotion,
          mediaUri: mediaUri || undefined, mediaDuration: mediaDuration || undefined,
          status: 'sent', isRead: mountedRef.current, createdAt: new Date().toISOString(),
        };
        addMessage(conversationId, aiMsg);

        // Send notification if app is in background
        const isInBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
        if (isInBackground || !mountedRef.current) {
          try {
            await sendNotification({
              type: 'chat_message',
              companionId,
              companionName: persona.name,
              conversationId,
              message: msgType === 'voice' ? '[语音消息]' : msg.content.slice(0, 100),
            });
          } catch (e) { console.warn('Send notification failed:', e); }
        }

        try {
          await MessageRepository.create({
            conversationId, role: 'assistant', type: msgType,
            content: msg.content, emotion: msg.emotion, mediaUri, mediaDuration,
          });
          await ConversationRepository.updateLastAIMessage(
            conversationId, msgType === 'voice' ? '[语音消息]' : msg.content.slice(0, 50)
          );
          await ConversationRepository.incrementMessageCount(conversationId);
          // If user is currently viewing this chat, keep unread at 0
          if (mountedRef.current) {
            await ConversationRepository.resetUnread(conversationId);
          }
        } catch (e) { console.warn('Persist AI msg failed:', e); }

        // Check if AI message matches a custom sticker — send sticker as bonus
        if (msgType === 'text' && msg.content.length <= 30) {
          try {
            const stickers = await StickerRepository.getAll();
            if (stickers.length > 0) {
              // Fuzzy match: check meaning, tags, or content similarity
              const match = stickers.find(s => {
                const meaning = (s.meaning || '').toLowerCase();
                const content = msg.content.toLowerCase();
                if (!meaning) return false;
                // Exact or partial match
                if (content.includes(meaning) || meaning.includes(content)) return true;
                // Check if any tag matches
                try {
                  const tags = Array.isArray(s.tags) ? s.tags : JSON.parse(s.tags || '[]');
                  if (tags.some((t: string) => content.includes(t.toLowerCase()))) return true;
                } catch {}
                return false;
              });
              if (match) {
                const stickerMsg: DisplayMessage = {
                  id: genId(), role: 'assistant', type: 'custom_emoji',
                  content: match.meaning || '[表情包]',
                  emojiId: match.id, emojiUri: match.file_path, emojiMeaning: match.meaning,
                  status: 'sent', isRead: mountedRef.current, createdAt: new Date().toISOString(),
                };
                addMessage(conversationId, stickerMsg);
                try {
                  await MessageRepository.create({
                    conversationId, role: 'assistant', type: 'custom_emoji',
                    content: match.meaning || '[表情包]', mediaUri: match.file_path,
                  });
                  if (mountedRef.current) {
                    await ConversationRepository.resetUnread(conversationId);
                  }
                } catch {}
              }
            }
          } catch {}
        }
      },
      onAllMessagesSent: () => {},
      onError: (error: Error) => {
        setTyping(conversationId, false);
        if (mountedRef.current) {
          addMessage(conversationId, {
            id: genId(), role: 'assistant', type: 'text',
            content: '⚠️ 消息发送失败，请检查 API 配置',
            status: 'failed', isRead: true, createdAt: new Date().toISOString(),
          });
        }
      },
    };

    engineRef.current = new MessageEngine(llmConfig, apiConfigs.vision, persona, conversationId, callbacks);
  }

  // Process a single text message through the engine
  async function processMessage(text: string) {
    if (!engineRef.current) return;

    // Mark generating — queued user messages wait for this
    isGeneratingRef.current = true;
    try {
      await engineRef.current.processTextMessage(text);
    } catch (e) {
      console.warn('processTextMessage failed:', e);
    }
    isGeneratingRef.current = false;

    // Process next queued message if any
    if (pendingQueueRef.current.length > 0) {
      const next = pendingQueueRef.current.shift()!;
      processMessage(next).catch((e) => console.warn('Queued processMessage failed:', e));
    }
  }

  // Send text — user message always shows immediately, AI reply queued
  const sendText = useCallback(async (text: string, quote?: { id: string; content: string; role: string } | null) => {
    // Anti-burst: strict lock + content dedup (3s window, no time-bucket boundary issues)
    if (isSendingRef.current) return;
    const dedupKey = text;
    const now = Date.now();
    const lastSent = recentDedupRef.current.get(dedupKey);
    if (lastSent && now - lastSent < 3000) return;
    isSendingRef.current = true;
    recentDedupRef.current.set(dedupKey, now);
    // Cleanup old entries after 10s
    setTimeout(() => recentDedupRef.current.delete(dedupKey), 10000);

    try {
      // 1. Show user message instantly with unique nonce
      const nonce = genNonce();
      addMessage(conversationId, {
        id: genId(), role: 'user', type: 'text', content: text,
        status: 'sent', isRead: true, createdAt: new Date().toISOString(),
        nonce,
        ...(quote ? { quoteId: quote.id, quoteContent: quote.content, quoteRole: quote.role } : {}),
      });

      // 2. Persist to DB immediately
      try {
        await MessageRepository.create({
          conversationId, role: 'user', content: text,
          ...(quote ? { quoteId: quote.id, quoteContent: quote.content, quoteRole: quote.role } : {}),
        });
        await ConversationRepository.updateLastMessage(conversationId, text.slice(0, 50));
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch (e) { console.warn('Persist failed:', e); }

      // 3. Queue AI response — if already generating, queue it
      if (isGeneratingRef.current) {
        pendingQueueRef.current.push(text);
      } else {
        processMessage(text); // Fire and forget
      }
    } finally {
      // Hold lock for 1s after dispatch to block rapid re-sends
      setTimeout(() => { isSendingRef.current = false; }, 1000);
    }
  }, [conversationId]);

  // Send image
  const sendImage = useCallback(async (uri: string, caption?: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const nonce = genNonce();
      addMessage(conversationId, {
        id: genId(), role: 'user', type: 'image', content: caption || '[图片]',
        mediaUri: uri, status: 'sent', isRead: true, createdAt: new Date().toISOString(),
        nonce,
      });
      try {
        await MessageRepository.create({ conversationId, role: 'user', type: 'image', content: caption || '', mediaUri: uri });
        await ConversationRepository.updateLastMessage(conversationId, '[图片]');
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch {}
      if (engineRef.current) {
        try {
          const FS = require('expo-file-system');
          const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
          await engineRef.current.processImageMessage(b64, caption);
        } catch {}
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [conversationId]);

  // Send voice
  const sendVoice = useCallback(async (uri: string, duration: number) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const nonce = genNonce();
      const voiceMsgId = genId();
      addMessage(conversationId, {
        id: voiceMsgId, role: 'user', type: 'voice', content: '[语音消息]',
        mediaUri: uri, mediaDuration: duration, status: 'sent', isRead: true, createdAt: new Date().toISOString(),
        nonce,
      });
      try {
        await MessageRepository.create({ conversationId, role: 'user', type: 'voice', content: '[语音消息]', mediaUri: uri, mediaDuration: duration });
        await ConversationRepository.updateLastMessage(conversationId, '[语音消息]');
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch {}
      if (engineRef.current) {
        let voiceText = '';

        // Helper to update this specific voice message (avoids race condition with rapid voice sends)
        const updateVoiceMsg = (updates: Partial<DisplayMessage>) => {
          if (mountedRef.current) {
            useChatStore.getState().updateMessage(conversationId, voiceMsgId, updates);
          }
        };

        // Try ASR if configured (inherit from LLM config for MiMo users)
        const asrConfig = apiConfigs.asr || (apiConfigs.llm?.baseUrl.includes('xiaomimimo') ? {
          ...apiConfigs.llm, id: 'asr-inherited', providerType: 'asr' as const, label: 'ASR (继承)', modelName: 'mimo-v2.5-asr',
        } : null);
        if (asrConfig) {
          try {
            const FS = require('expo-file-system');
            const { ASRClient } = require('../core/api/ASRClient');
            const asr = new ASRClient(asrConfig);

            const fileInfo = await FS.getInfoAsync(uri);
            if (!fileInfo.exists) throw new Error('录音文件不存在');

            const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
            if (!b64 || b64.length < 100) throw new Error('录音文件为空或损坏');

            const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
            const mimeType = ext === 'm4a' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';

            // ASR with one retry on failure
            let transcribed = '';
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                transcribed = await asr.transcribe(b64, mimeType);
                break;
              } catch (retryErr: any) {
                if (attempt === 0) {
                  console.warn('[ASR] First attempt failed, retrying:', retryErr?.message);
                  await new Promise(r => setTimeout(r, 1000));
                } else {
                  throw retryErr;
                }
              }
            }

            if (transcribed && transcribed.trim()) {
              voiceText = transcribed.trim();
              console.log('[ASR] Transcription successful:', voiceText.slice(0, 50));
              // Update the voice message content with transcription for future context
              updateVoiceMsg({ content: voiceText });
              try {
                await MessageRepository.updateContent(voiceMsgId, voiceText);
              } catch (e) { console.warn('[ASR] Failed to update voice message content:', e); }
            } else {
              console.warn('[ASR] Transcription returned empty text');
            }
          } catch (e: any) {
            console.warn('ASR failed:', e?.message);
            const errorMsg = e?.message?.includes('未配置') ? '未配置语音识别API'
              : e?.message?.includes('401') || e?.message?.includes('403') ? '语音识别API密钥无效'
              : e?.message?.includes('网络') || e?.message?.includes('Network') ? '网络连接失败'
              : '语音识别失败';
            updateVoiceMsg({ status: 'failed', content: `[语音消息] ${errorMsg}` });
            return; // Block: do NOT feed empty/error context to LLM
          }
        } else {
          // No ASR and no MiMo LLM to inherit from
          updateVoiceMsg({ status: 'failed', content: '[语音消息] 请在设置→API配置中添加语音识别(ASR)' });
          return;
        }

        // Defense: if ASR returned empty, block from LLM
        if (!voiceText || !voiceText.trim()) {
          updateVoiceMsg({ status: 'failed', content: '[语音消息] 未能识别' });
          return; // Block: do NOT feed empty context to LLM
        }

        // Send to AI with clear voice message format
        const aiPrompt = `[用户发送了一条语音消息，语音转文字内容如下] ${voiceText}`;
        await engineRef.current.processTextMessage(aiPrompt);
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [conversationId, apiConfigs.asr, apiConfigs.llm]);

  // Send custom sticker (as custom_emoji type, description preserved for LLM but hidden in UI)
  const sendCustomSticker = useCallback(async (sticker: { file_path: string; meaning?: string }) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const nonce = genNonce();
      addMessage(conversationId, {
        id: genId(), role: 'user', type: 'custom_emoji',
        content: sticker.meaning || '[表情包]',
        emojiUri: sticker.file_path, emojiMeaning: sticker.meaning,
        status: 'sent', isRead: true, createdAt: new Date().toISOString(),
        nonce,
      });
      try {
        await MessageRepository.create({ conversationId, role: 'user', type: 'custom_emoji', content: sticker.meaning || '[表情包]', mediaUri: sticker.file_path });
        await ConversationRepository.updateLastMessage(conversationId, '[表情包]');
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch {}
      // Send to LLM with description for context
      if (engineRef.current && sticker.meaning) {
        await engineRef.current.processTextMessage(`[用户发送了一个表情包：${sticker.meaning}]`);
      }
    } finally {
      isSendingRef.current = false;
    }
  }, [conversationId]);

  // Send sticker
  const sendSticker = useCallback(async (emoji: string) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      const nonce = genNonce();
      addMessage(conversationId, {
        id: genId(), role: 'user', type: 'text', content: emoji,
        status: 'sent', isRead: true, createdAt: new Date().toISOString(),
        nonce,
      });
      try {
        await MessageRepository.create({ conversationId, role: 'user', content: emoji });
        await ConversationRepository.updateLastMessage(conversationId, emoji);
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch {}
      if (engineRef.current) await engineRef.current.processTextMessage(emoji);
    } finally {
      isSendingRef.current = false;
    }
  }, [conversationId]);

  // Transcribe a voice message on demand
  const transcribeMessage = useCallback(async (_messageId: string, mediaUri: string): Promise<string | null> => {
    const asrConfig = apiConfigs.asr || (apiConfigs.llm?.baseUrl.includes('xiaomimimo') ? {
      ...apiConfigs.llm, id: 'asr-inherited', providerType: 'asr' as const, label: 'ASR (继承)', modelName: 'mimo-v2.5-asr',
    } : null);
    if (!asrConfig) {
      throw new Error('未配置语音识别 API');
    }
    try {
      const FS = require('expo-file-system');
      const { ASRClient } = require('../core/api/ASRClient');
      const asr = new ASRClient(asrConfig);
      const b64 = await FS.readAsStringAsync(mediaUri, { encoding: FS.EncodingType.Base64 });
      // Detect MIME type from file extension
      const ext = mediaUri.split('.').pop()?.toLowerCase() || 'm4a';
      const mimeType = ext === 'm4a' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/mp4';
      const text = await asr.transcribe(b64, mimeType);
      if (!text || !text.trim()) return null;
      return text.trim();
    } catch (e: any) {
      console.warn('Transcribe failed:', e?.message);
      const cleanMsg = e?.message?.includes('500') ? '语音识别服务暂时不可用' : (e?.message || '转写失败');
      throw new Error(cleanMsg);
    }
  }, [apiConfigs.asr, apiConfigs.llm]);

  // Recall/delete a single message and refresh conversation preview
  const recallMessage = useCallback(async (messageId: string) => {
    try {
      // Use recallMessage which also updates conversation preview
      await MessageRepository.recallMessage(messageId, conversationId);
      // Remove from store immediately
      const current = useChatStore.getState().sessions[conversationId] || [];
      const updated = current.filter((m) => m.id !== messageId);
      useChatStore.getState().setMessages(conversationId, updated);
    } catch (e) {
      console.warn('Recall failed:', e);
    }
  }, [conversationId]);

  // Delete a single message (for other's messages or when recall isn't available)
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      // Persist deletion to DB first — use recallMessage which also updates conversation preview
      await MessageRepository.recallMessage(messageId, conversationId);
      // Remove from store immediately
      const current = useChatStore.getState().sessions[conversationId] || [];
      const updated = current.filter((m) => m.id !== messageId);
      useChatStore.getState().setMessages(conversationId, updated);
    } catch (e) {
      console.warn('Delete failed:', e);
    }
  }, [conversationId]);

  return {
    messages, isTyping, isLoading, companionName, voiceEnabled, voiceStatus,
    sendText, sendImage, sendVoice, sendSticker, sendCustomSticker, recallMessage, deleteMessage, transcribeMessage,
  };
}

function msgToDisplay(msg: Message): DisplayMessage {
  const type = msg.type as 'text' | 'voice' | 'image' | 'custom_emoji';
  return {
    id: msg.id, role: msg.role as 'user' | 'assistant',
    type,
    content: msg.content, mediaUri: msg.mediaUri || undefined,
    mediaDuration: msg.mediaDuration || undefined, emotion: msg.emotion || undefined,
    status: msg.status as 'sending' | 'sent' | 'failed', isRead: msg.isRead, createdAt: msg.createdAt,
    ...(type === 'custom_emoji' ? { emojiUri: msg.mediaUri || undefined, emojiMeaning: msg.content } : {}),
    ...(msg.quoteId ? { quoteId: msg.quoteId, quoteContent: msg.quoteContent || undefined, quoteRole: msg.quoteRole || undefined } : {}),
  };
}
