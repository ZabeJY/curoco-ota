/**
 * Curoco — Memory Management Panel
 * View, edit, delete AI long-term memories
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import GlassModal from '../../src/components/common/GlassModal';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import { MessageRepository } from '../../src/db/repositories/MessageRepository';
import { useChatStore } from '../../src/store/chatStore';
import type { Companion, Conversation } from '../../src/types/models';

interface MemoryItem {
  id: string;
  content: string;
  companionId: string;
  companionName: string;
  conversationId: string;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useFocusEffect(useCallback(() => { loadMemories(); }, []));

  async function loadMemories() {
    setLoading(true);
    try {
      const companions = await CompanionRepository.getAll();
      const items: MemoryItem[] = [];

      for (const comp of companions) {
        const conv = await ConversationRepository.getByCompanionId(comp.id);
        if (conv && conv.longTermMemorySummary) {
          // Split memory into individual items by line
          const lines = conv.longTermMemorySummary.split('\n').filter((l) => l.trim().length > 0);
          for (const line of lines) {
            items.push({
              id: `mem_${comp.id}_${items.length}`,
              content: line.trim(),
              companionId: comp.id,
              companionName: comp.name,
              conversationId: conv.id,
            });
          }
        }
      }

      setMemories(items);
    } catch (e) {
      console.warn('Load memories failed:', e);
    }
    setLoading(false);
  }

  // Edit a memory
  function handleEdit(memory: MemoryItem) {
    setEditingId(memory.id);
    setEditText(memory.content);
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    const memory = memories.find((m) => m.id === editingId);
    if (!memory) return;

    try {
      const conv = await ConversationRepository.getById(memory.conversationId);
      if (!conv) return;

      // Replace the old line with the new text
      const lines = conv.longTermMemorySummary.split('\n').filter((l) => l.trim().length > 0);
      const idx = memories.filter((m) => m.companionId === memory.companionId).indexOf(memory);
      if (idx >= 0 && idx < lines.length) {
        lines[idx] = editText.trim();
      }
      const newSummary = lines.join('\n');
      await ConversationRepository.updateLongTermMemory(memory.conversationId, newSummary);
      setEditingId(null);
      await loadMemories();
    } catch (e) {
      Alert.alert('保存失败');
    }
  }

  // Delete a single memory
  function handleDelete(memory: MemoryItem) {
    Alert.alert('删除记忆', `确定遗忘这条记忆？\n\n"${memory.content}"`, [
      { text: '取消', style: 'cancel' },
      {
        text: '遗忘', style: 'destructive',
        onPress: async () => {
          try {
            const conv = await ConversationRepository.getById(memory.conversationId);
            if (!conv) return;

            const lines = conv.longTermMemorySummary.split('\n').filter((l) => l.trim().length > 0);
            const idx = memories.filter((m) => m.companionId === memory.companionId).indexOf(memory);
            if (idx >= 0 && idx < lines.length) {
              lines.splice(idx, 1);
            }
            await ConversationRepository.updateLongTermMemory(memory.conversationId, lines.join('\n'));
            await loadMemories();
          } catch {}
        },
      },
    ]);
  }

  // Reset all memories for a companion
  function handleResetAll(compName: string, convId: string) {
    Alert.alert('一键重置记忆', `确定让 ${compName} 彻底遗忘所有关于你的记忆？此操作不可撤销。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '全部遗忘', style: 'destructive',
        onPress: async () => {
          try {
            await ConversationRepository.updateLongTermMemory(convId, '');
            // Also clear chat history
            const msgs = await MessageRepository.getRecent(convId, 9999);
            if (msgs.length > 0) await MessageRepository.deleteByIds(msgs.map((m) => m.id));
            await ConversationRepository.resetUnread(convId);
            // Clear store
            useChatStore.getState().clearSession(convId);
            await loadMemories();
            Alert.alert('已重置', `${compName} 已彻底遗忘所有记忆`);
          } catch {}
        },
      },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;

  // Group memories by companion
  const grouped = new Map<string, MemoryItem[]>();
  for (const m of memories) {
    const arr = grouped.get(m.companionName) || [];
    arr.push(m);
    grouped.set(m.companionName, arr);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {memories.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bulb-outline" size={48} color="#C0C0C0" />
          <Text style={styles.emptyTitle}>还没有记忆</Text>
          <Text style={styles.emptySub}>AI 会在聊天中逐渐记住关于你的事情</Text>
        </View>
      ) : (
        Array.from(grouped.entries()).map(([compName, items]) => (
          <View key={compName}>
            <View style={styles.compHeader}>
              <Text style={styles.compName}>{compName}</Text>
              <TouchableOpacity
                onPress={() => {
                  const conv = items[0];
                  handleResetAll(compName, conv.conversationId);
                }}
              >
                <Text style={styles.resetText}>重置全部</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.cardGroup}>
              {items.map((item) => (
                <View key={item.id} style={styles.memoryCard}>
                  <Ionicons name="bulb" size={14} color="#FFA502" />
                  <Text style={styles.memoryText}>{item.content}</Text>
                  <View style={styles.memoryActions}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.memActionBtn}>
                      <Ionicons name="pencil" size={14} color="#6C63FF" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)} style={styles.memActionBtn}>
                      <Ionicons name="trash-outline" size={14} color="#FF4757" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      {/* Edit Modal */}
      <GlassModal visible={!!editingId} onClose={() => setEditingId(null)}>
        <View style={{ padding: 8 }}>
          <Text style={styles.modalTitle}>编辑记忆</Text>
          <TextInput
            style={styles.modalInput}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingId(null)}>
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit}>
              <Text style={styles.modalSaveText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GlassModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F5' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#8E8E93', marginTop: 4, textAlign: 'center' },
  compHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  compName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  resetText: { fontSize: 13, color: '#FF4757', fontWeight: '500' },
  cardGroup: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  memoryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F2',
  },
  memoryText: { flex: 1, fontSize: 14, color: '#2C2C2E', lineHeight: 20 },
  memoryActions: { flexDirection: 'row', gap: 8 },
  memActionBtn: { padding: 4 },
  // Modal
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  modalInput: { borderWidth: 1.5, borderColor: '#E8E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1A1A2E', minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  modalCancel: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E8F0' },
  modalCancelText: { fontSize: 15, color: '#6B6B8D' },
  modalSave: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#6C63FF' },
  modalSaveText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
