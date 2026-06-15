/**
 * Curoco — Create Group Chat
 * Select companions + name → create group conversation
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, FlatList,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../src/components/common/Avatar';
import { useCompanionStore } from '../../src/store/companionStore';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { Companion } from '../../src/types/models';

export default function CreateGroupPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { companions } = useCompanionStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function handleCreate() {
    if (selected.size < 2) {
      Alert.alert('提示', '请至少选择 2 个角色');
      return;
    }
    const name = groupName.trim() || Array.from(selected).map(id => companions.find(c => c.id === id)?.name || '').join('、');
    try {
      const conv = await ConversationRepository.createGroup(name, Array.from(selected));
      router.replace({ pathname: '/chat/[id]', params: { id: conv.id, name, isGroup: 'true' } });
    } catch (e) {
      Alert.alert('错误', '创建群聊失败');
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bgPrimary }]}>
      {/* Group name input */}
      <View style={[styles.nameSection, { backgroundColor: theme.bgSecondary }]}>
        <Ionicons name="people" size={24} color={theme.primary} />
        <TextInput
          style={[styles.nameInput, { color: theme.textPrimary }]}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="群聊名称（可选）"
          placeholderTextColor={theme.textTertiary}
          maxLength={20}
        />
        <Text style={[styles.countText, { color: theme.textTertiary }]}>{selected.size}人</Text>
      </View>

      {/* Companion list */}
      <FlatList
        data={companions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: theme.bgSecondary }, isSelected && { backgroundColor: theme.primary + '10' }]}
              onPress={() => toggle(item.id)}
              activeOpacity={0.6}
            >
              <View style={[styles.checkbox, { borderColor: theme.border }, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Avatar uri={item.avatarUri || null} name={item.name} size="sm" />
              <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Create button */}
      <View style={[styles.footer, { backgroundColor: theme.bgPrimary }]}>
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: theme.primary, opacity: selected.size >= 2 ? 1 : 0.4 }]}
          onPress={handleCreate}
          disabled={selected.size < 2}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>创建群聊</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nameSection: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 14 },
  nameInput: { flex: 1, fontSize: 16 },
  countText: { fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 16, marginTop: 8, borderRadius: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '500', flex: 1 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32 },
  createBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
