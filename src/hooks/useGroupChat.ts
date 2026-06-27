/**
 * Curoco — Group Chat Hook
 * Multiple companions in one conversation, @ mention routing
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MessageRepository } from '../db/repositories/MessageRepository';
import { ConversationRepository } from '../db/repositories/ConversationRepo';
import { MessageEngine, type MessageEngineCallbacks } from '../core/engine/MessageEngine';
import { PersonaEngine } from '../core/persona/PersonaEngine';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { CompanionRepository } from '../db/repositories/CompanionRepository';
import { sendNotification } from '../core/NotificationManager';
import type { DisplayMessage, QueuedMessage } from '../types/message';
import type { Message } from '../types/models';
import type { PersonaConfig } from '../types/persona';
import { v4 as uuidv4 } from 'uuid';

function genId(): string {
  try { return uuidv4(); } catch { return 'd-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

interface GroupMember {
  companionId: string;
  name: string;
  engine: MessageEngine | null;
  persona: PersonaConfig | null;
}

export function useGroupChat(conversationId: string) {
  const [isLoading, setIsLoading] = useState(true);
  const [groupName, setGroupName] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const mountedRef = useRef(true);
  const isGeneratingRef = useRef(false);
  const pendingQueueRef = useRef<{ text: string; targetId?: string }[]>([]);
  const isSendingRef = useRef(false);
  const recentDedupRef = useRef<Map<string, number>>(new Map());

  const { sessions, typingConversations, addMessage, setMessages, setTyping } = useChatStore();
  const { apiConfigs, settings } = useSettingsStore();

  const messages = sessions[conversationId] || [];
  const isTyping = typingConversations.has(conversationId);

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const loadMoreMessages = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const currentMessages = useChatStore.getState().sessions[conversationId] || [];
      if (currentMessages.length === 0) { setHasMore(false); return; }
      const oldestMsg = currentMessages[0];
      const olderMsgs = await MessageRepository.getOlderMessages(conversationId, oldestMsg.createdAt, 50);
      if (olderMsgs.length === 0) {
        setHasMore(false);
      } else {
        const existing = useChatStore.getState().sessions[conversationId] || [];
        useChatStore.getState().setMessages(conversationId, [...olderMsgs.map(msgToDisplay), ...existing]);
        if (olderMsgs.length < 50) setHasMore(false);
      }
    } catch (e) {
      console.warn('Load more messages failed:', e);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [conversationId, hasMore]);

  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      setIsLoading(true);
      try {
        // Load conversation info
        const conv = await ConversationRepository.getById(conversationId);
        if (!conv) return;
        setGroupName(conv.groupName || '群聊');

        // Load group members
        const memberRows = await ConversationRepository.getGroupMembers(conversationId);
        const loadedMembers: GroupMember[] = [];

        for (const row of memberRows) {
          const persona = await PersonaEngine.load(row.companionId, settings.userSignature);
          if (!persona) continue;

          const llmConfig = apiConfigs.llm;
          let engine: MessageEngine | null = null;
          if (llmConfig) {
            const callbacks = createEngineCallbacks(row.companionId, persona.name);
            engine = new MessageEngine(llmConfig, apiConfigs.vision, persona, conversationId, callbacks);
          }

          loadedMembers.push({
            companionId: row.companionId,
            name: persona.name,
            engine,
            persona,
          });
        }

        if (mountedRef.current) {
          setMembers(loadedMembers);

          // Load messages
          const dbMessages = await MessageRepository.getRecent(conversationId, 50);
          setMessages(conversationId, dbMessages.map(msgToDisplay));
          await ConversationRepository.resetUnread(conversationId);
          await MessageRepository.markConversationRead(conversationId);
        }
      } catch (e) {
        console.error('Group chat init failed:', e);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();

    return () => { mountedRef.current = false; };
  }, [conversationId]);

  function createEngineCallbacks(companionId: string, companionName: string): MessageEngineCallbacks {
    return {
      onTypingStart: () => setTyping(conversationId, true),
      onTypingEnd: () => setTyping(conversationId, false),
      onQueuedMessage: async (msg: QueuedMessage) => {
        const aiMsg: DisplayMessage = {
          id: genId(), role: 'assistant', type: 'text',
          content: msg.content, emotion: msg.emotion,
          status: 'sent', isRead: mountedRef.current, createdAt: new Date().toISOString(),
          companionId, companionName,
        };
        addMessage(conversationId, aiMsg);

        try {
          await MessageRepository.create({
            conversationId, role: 'assistant', type: 'text',
            content: msg.content, emotion: msg.emotion,
          });
          await ConversationRepository.updateLastAIMessage(conversationId, `${companionName}: ${msg.content.slice(0, 40)}`);
          await ConversationRepository.incrementMessageCount(conversationId);
          if (mountedRef.current) await ConversationRepository.resetUnread(conversationId);
        } catch {}

        // Notification if background
        const appState = AppState.currentState;
        if (appState === 'background' || !mountedRef.current) {
          try {
            await sendNotification({
              type: 'chat_message', companionId, companionName,
              conversationId, message: msg.content.slice(0, 100),
            });
          } catch {}
        }
      },
      onAllMessagesSent: () => {},
      onError: (error: Error) => {
        setTyping(conversationId, false);
        if (mountedRef.current) {
          addMessage(conversationId, {
            id: genId(), role: 'assistant', type: 'text',
            content: `⚠️ ${companionName}回复失败`,
            status: 'failed', isRead: true, createdAt: new Date().toISOString(),
            companionId, companionName,
          });
        }
      },
    };
  }

  // Parse @ mentions: returns companionId if found
  function parseMention(text: string): string | undefined {
    for (const m of members) {
      if (text.includes(`@${m.name}`)) return m.companionId;
    }
    return undefined;
  }

  // Process message through specific companion or all
  async function processForMembers(text: string, targetId?: string) {
    isGeneratingRef.current = true;
    try {
      const targets = targetId
        ? members.filter(m => m.companionId === targetId)
        : members;

      for (const m of targets) {
        if (!m.engine) continue;
        setTyping(conversationId, true);
        try {
          await m.engine.processTextMessage(text);
        } catch (e) {
          console.warn(`${m.name} processTextMessage failed:`, e);
        }
      }
    } finally {
      isGeneratingRef.current = false;
      setTyping(conversationId, false);

      // Process next queued message
      if (pendingQueueRef.current.length > 0) {
        const next = pendingQueueRef.current.shift()!;
        processForMembers(next.text, next.targetId);
      }
    }
  }

  const sendText = useCallback(async (text: string) => {
    if (isSendingRef.current) return;
    const now = Date.now();
    const lastSent = recentDedupRef.current.get(text);
    if (lastSent && now - lastSent < 3000) return;
    isSendingRef.current = true;
    recentDedupRef.current.set(text, now);
    setTimeout(() => recentDedupRef.current.delete(text), 10000);

    try {
      addMessage(conversationId, {
        id: genId(), role: 'user', type: 'text', content: text,
        status: 'sent', isRead: true, createdAt: new Date().toISOString(),
      });

      try {
        await MessageRepository.create({ conversationId, role: 'user', content: text });
        await ConversationRepository.updateLastMessage(conversationId, text.slice(0, 50));
        await ConversationRepository.incrementMessageCount(conversationId);
      } catch {}

      // Parse @ mention for targeted reply
      const targetId = parseMention(text);

      if (isGeneratingRef.current) {
        pendingQueueRef.current.push({ text, targetId });
      } else {
        processForMembers(text, targetId);
      }
    } finally {
      setTimeout(() => { isSendingRef.current = false; }, 1000);
    }
  }, [conversationId, members]);

  return {
    messages, isTyping, isLoading, groupName, members,
    hasMore, isLoadingMore, loadMoreMessages,
    sendText,
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
  };
}
