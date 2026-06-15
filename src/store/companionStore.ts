/**
 * Curoco — Companion Store (Fixed)
 * - Auto-creates conversation + greeting on companion creation
 * - Proper error handling
 */

import { create } from 'zustand';
import type { Companion } from '../types/models';
import { CompanionRepository } from '../db/repositories/CompanionRepository';
import { ConversationRepository } from '../db/repositories/ConversationRepo';
import { MessageRepository } from '../db/repositories/MessageRepository';

interface CompanionState {
  companions: Companion[];
  isLoading: boolean;
  error: string | null;

  loadCompanions: () => Promise<void>;
  addCompanion: (data: Omit<Companion, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ companion: Companion; conversationId: string }>;
  updateCompanion: (id: string, data: Partial<Companion>) => Promise<void>;
  deleteCompanion: (id: string) => Promise<void>;
}

export const useCompanionStore = create<CompanionState>((set) => ({
  companions: [],
  isLoading: false,
  error: null,

  loadCompanions: async () => {
    set({ isLoading: true, error: null });
    try {
      const companions = await CompanionRepository.getAll();
      set({ companions });
    } catch (e: any) {
      set({ error: e?.message || '加载失败' });
    } finally {
      set({ isLoading: false });
    }
  },

  addCompanion: async (data) => {
    // 1. Create the companion
    const companion = await CompanionRepository.create(data);

    // 2. Auto-create conversation
    const conversation = await ConversationRepository.create(companion.id);

    // 3. Create a greeting message from the AI
    const greeting = generateGreeting(companion);
    await MessageRepository.create({
      conversationId: conversation.id,
      role: 'assistant',
      content: greeting,
      emotion: 'happy',
    });

    // 4. Update conversation preview
    await ConversationRepository.updateLastAIMessage(conversation.id, greeting.slice(0, 50));
    await ConversationRepository.incrementMessageCount(conversation.id);

    // 5. Update store
    set((state) => ({ companions: [companion, ...state.companions] }));

    return { companion, conversationId: conversation.id };
  },

  updateCompanion: async (id, data) => {
    await CompanionRepository.update(id, data);
    set((state) => ({
      companions: state.companions.map((c) =>
        c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },

  deleteCompanion: async (id) => {
    const convs = await ConversationRepository.getAll();
    const companionConvs = convs.filter((c) => c.companionId === id);

    for (const conv of companionConvs) {
      const msgs = await MessageRepository.getRecent(conv.id, 9999);
      if (msgs.length > 0) {
        await MessageRepository.deleteByIds(msgs.map((m) => m.id));
      }
      await ConversationRepository.delete(conv.id);
    }

    // Delete the companion
    await CompanionRepository.delete(id);
    set((state) => ({
      companions: state.companions.filter((c) => c.id !== id),
    }));
  },
}));

function generateGreeting(companion: Companion): string {
  const name = companion.nicknameForUser || '你';
  const relationship = companion.relationship || '朋友';
  const personality = companion.personality || '';

  const greetings = [
    `嗨，${name}！我是${companion.name}，以后我们就是${relationship}啦～`,
    `${name}你好呀！终于见到你了，我是${companion.name}，以后多多关照哦～`,
    `哈喽${name}！我是${companion.name}，很高兴认识你！`,
  ];

  let greeting = greetings[Math.floor(Math.random() * greetings.length)];

  if (personality.includes('温柔') || personality.includes('体贴')) {
    greeting += '有什么想聊的随时找我哦，我会一直在的～';
  } else if (personality.includes('活泼') || personality.includes('开朗')) {
    greeting += '嘿嘿，我们快开始聊天吧！';
  }

  return greeting;
}
