/**
 * Curoco — Group Chat Page
 * Multiple companions, @ mention, shared conversation
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View, FlatList, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Text,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import ChatBubble from '../../../src/components/chat/ChatBubble';
import ChatInput from '../../../src/components/chat/ChatInput';
import { useGroupChat } from '../../../src/hooks/useGroupChat';
import { useTheme } from '../../../src/theme/ThemeProvider';
import type { DisplayMessage } from '../../../src/types/message';

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

function shouldShowTimestamp(cur: DisplayMessage, prev?: DisplayMessage): boolean {
  if (!prev) return true;
  return new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
}

export default function GroupChatPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const { messages, isTyping, isLoading, groupName, sendText } = useGroupChat(id!);

  useEffect(() => {
    navigation.setOptions({
      title: isTyping ? `${groupName} - 正在输入...` : groupName,
      headerTitleStyle: { fontWeight: '600' as const, fontSize: 17, color: theme.textPrimary },
      headerStyle: { backgroundColor: theme.bgPrimary },
      headerTintColor: theme.textPrimary,
    });
  }, [groupName, isTyping, theme]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isTyping) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [isTyping]);

  if (isLoading) {
    return <View style={[styles.center, { backgroundColor: theme.bgPrimary }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <>
            {shouldShowTimestamp(item, index > 0 ? messages[index - 1] : undefined) && (
              <View style={styles.tsWrap}>
                <Text style={[styles.tsText, { color: theme.textTertiary }]}>{formatTimestamp(item.createdAt)}</Text>
              </View>
            )}
            {/* Show companion name for assistant messages in group chat */}
            {item.role === 'assistant' && item.companionName && (
              <Text style={[styles.senderName, { color: theme.textTertiary }]}>
                {item.companionName}
              </Text>
            )}
            <ChatBubble message={item} />
          </>
        )}
        contentContainerStyle={styles.msgContent}
        style={styles.msgList}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      <ChatInput
        onSend={(text) => sendText(text)}
        voiceEnabled={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  msgList: { flex: 1 },
  msgContent: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 4 },
  tsWrap: { alignItems: 'center', marginVertical: 12 },
  tsText: { fontSize: 11, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  senderName: { fontSize: 11, marginLeft: 42, marginBottom: 2 },
});
