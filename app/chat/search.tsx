/**
 * Curoco — Chat History Search
 * Search messages by keyword within a companion's conversations
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { MessageRepository } from '../../src/db/repositories/MessageRepository';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import type { Message } from '../../src/types/models';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${h}:${m}`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `昨天 ${h}:${m}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${h}:${m}`;
}

export default function ChatSearchPage() {
  const { companionId, companionName } = useLocalSearchParams<{ companionId: string; companionName?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `搜索 ${companionName || ''} 的聊天记录`,
      headerStyle: { backgroundColor: theme.bgPrimary },
      headerTintColor: theme.textPrimary,
    });
  }, [companionName, theme]);

  const handleSearch = useCallback(async () => {
    const kw = keyword.trim();
    if (!kw || !companionId) return;
    setSearching(true);
    setSearched(true);
    try {
      const msgs = await MessageRepository.searchByCompanion(companionId, kw, 100);
      setResults(msgs);
    } catch (e) {
      console.warn('Search failed:', e);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [keyword, companionId]);

  const handleNavigateToChat = useCallback(async (msg: Message) => {
    try {
      const conv = await ConversationRepository.getById(msg.conversationId);
      if (conv) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: conv.id, companionId: conv.companionId, name: companionName || '', scrollToMessageId: msg.id },
        });
      }
    } catch {}
  }, [companionName]);

  function highlightText(text: string, kw: string) {
    if (!kw) return <Text>{text}</Text>;
    const parts = text.split(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <Text>
        {parts.map((part, i) =>
          part.toLowerCase() === kw.toLowerCase() ? (
            <Text key={i} style={{ color: '#FF6B6B', fontWeight: '600' }}>{part}</Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputWrap, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="搜索聊天内容..."
            placeholderTextColor={theme.textTertiary}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoFocus
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => { setKeyword(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={handleSearch} disabled={!keyword.trim()}>
          <Text style={[styles.searchBtn, { color: keyword.trim() ? theme.primary : theme.textTertiary }]}>搜索</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {searching ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>没有找到相关消息</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.resultItem, { backgroundColor: theme.bgSecondary, borderBottomColor: theme.border }]}
              onPress={() => handleNavigateToChat(item)}
              activeOpacity={0.7}
            >
              <View style={styles.resultHeader}>
                <View style={[styles.roleTag, { backgroundColor: item.role === 'user' ? '#6C63FF15' : '#2ED57315' }]}>
                  <Text style={[styles.roleText, { color: item.role === 'user' ? '#6C63FF' : '#2ED573' }]}>
                    {item.role === 'user' ? '我' : 'AI'}
                  </Text>
                </View>
                <Text style={[styles.resultTime, { color: theme.textTertiary }]}>{formatTimestamp(item.createdAt)}</Text>
              </View>
              <Text style={[styles.resultContent, { color: theme.textPrimary }]} numberOfLines={3}>
                {highlightText(item.content, keyword.trim())}
              </Text>
              {item.type === 'voice' && (
                <View style={styles.typeTag}>
                  <Ionicons name="mic" size={11} color={theme.textTertiary} />
                  <Text style={[styles.typeText, { color: theme.textTertiary }]}>语音消息</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          ListHeaderComponent={
            results.length > 0 ? (
              <Text style={[styles.resultCount, { color: theme.textTertiary }]}>
                找到 {results.length} 条相关消息
              </Text>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5F4FA', borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  searchBtn: { fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 15, marginTop: 12 },
  resultCount: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 10 },
  resultItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  roleTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '600' },
  resultTime: { fontSize: 11 },
  resultContent: { fontSize: 14, lineHeight: 20 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  typeText: { fontSize: 11 },
});
