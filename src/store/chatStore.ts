/**
 * Curoco — Chat Store (Zustand)
 * Global state for active chat sessions + persistent engines
 */

import { create } from 'zustand';
import type { DisplayMessage } from '../types/message';
import type { MessageEngine } from '../core/engine/MessageEngine';

interface ChatSessionState {
  sessions: Record<string, DisplayMessage[]>;
  typingConversations: Set<string>;
  // Global engine map — engines survive component unmount
  engines: Record<string, MessageEngine>;

  addMessage: (conversationId: string, message: DisplayMessage) => void;
  updateMessageStatus: (conversationId: string, messageId: string, status: 'sending' | 'sent' | 'failed') => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<DisplayMessage>) => void;
  setMessages: (conversationId: string, messages: DisplayMessage[]) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  clearSession: (conversationId: string) => void;
  setEngine: (conversationId: string, engine: MessageEngine) => void;
  getEngine: (conversationId: string) => MessageEngine | undefined;
  removeEngine: (conversationId: string) => void;
}

export const useChatStore = create<ChatSessionState>((set, get) => ({
  sessions: {},
  typingConversations: new Set(),
  engines: {},

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.sessions[conversationId] || [];
      // Nonce-based dedup: skip if a message with the same nonce already exists
      if (message.nonce && existing.some((m) => m.nonce === message.nonce)) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [conversationId]: [...existing, message],
        },
      };
    }),

  updateMessageStatus: (conversationId, messageId, status) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [conversationId]: (state.sessions[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      },
    })),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [conversationId]: (state.sessions[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      sessions: { ...state.sessions, [conversationId]: messages },
    })),

  setTyping: (conversationId, isTyping) =>
    set((state) => {
      const newSet = new Set(state.typingConversations);
      if (isTyping) newSet.add(conversationId);
      else newSet.delete(conversationId);
      return { typingConversations: newSet };
    }),

  clearSession: (conversationId) =>
    set((state) => {
      const newSessions = { ...state.sessions };
      delete newSessions[conversationId];
      return { sessions: newSessions };
    }),

  setEngine: (conversationId, engine) =>
    set((state) => ({
      engines: { ...state.engines, [conversationId]: engine },
    })),

  getEngine: (conversationId) => get().engines[conversationId],

  removeEngine: (conversationId) =>
    set((state) => {
      const newEngines = { ...state.engines };
      delete newEngines[conversationId];
      return { engines: newEngines };
    }),
}));
