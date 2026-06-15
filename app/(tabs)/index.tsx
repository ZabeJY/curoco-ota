/**
 * Curoco — Chat List
 * Better notification badges, auto-refresh on focus
 */

import React, { useCallback, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import ChatListItem from '../../src/components/chat/ChatList';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import type { Conversation } from '../../src/types/models';

interface ConvWithComp extends Conversation {
  companionName: string;
  companionAvatar: string | null;
}

export default function ChatListPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [conversations, setConversations] = useState<ConvWithComp[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Load immediately on focus (e.g., returning from chat page)
      loadConversations();
      // Auto-refresh every 5 seconds for new messages
      intervalRef.current = setInterval(loadConversations, 5000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }, [])
  );

  async function loadConversations() {
    try {
      const convs = await ConversationRepository.getAll();
      const enriched: ConvWithComp[] = [];
      for (const conv of convs) {
        if (conv.type === 'group') {
          enriched.push({ ...conv, companionName: conv.groupName || '群聊', companionAvatar: null });
        } else {
          const comp = await CompanionRepository.getById(conv.companionId);
          if (comp) enriched.push({ ...conv, companionName: comp.name, companionAvatar: comp.avatarUri || null });
        }
      }
      setConversations(enriched);
    } catch {}
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            companionName={item.companionName}
            avatarUri={item.companionAvatar}
            lastMessage={item.lastMessagePreview}
            lastMessageAt={item.lastMessageAt}
            unreadCount={item.unreadCount}
            onPress={() => {
              if (item.type === 'group') {
                router.push({ pathname: '/chat/group/[id]', params: { id: item.id } });
              } else {
                router.push({ pathname: '/chat/[id]', params: { id: item.id, companionId: item.companionId, name: item.companionName } });
              }
            }}
          />
        )}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.bgTertiary }]}><Ionicons name="chatbubbles-outline" size={48} color={theme.textTertiary} /></View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>暂无对话</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>去「角色」页面创建角色开始聊天吧 ✨</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  unreadBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(108,99,255,0.08)',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8F0',
  },
  unreadText: { fontSize: 13, color: '#6C63FF', fontWeight: '500' },
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0EFF5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#6B6B8D', textAlign: 'center' },
});
