/**
 * Curoco — Chat Page
 * Layout: FlatList (flex:1) + ChatInput (bottom)
 * Keyboard: iOS uses KeyboardAvoidingView, Android uses windowSoftInputMode
 */

import React, { useRef, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Text, TouchableOpacity, Keyboard, Alert, Modal, Animated, FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatBubble from '../../src/components/chat/ChatBubble';
import ChatInput from '../../src/components/chat/ChatInput';
import { useChat } from '../../src/hooks/useChat';
import { useTheme } from '../../src/theme/ThemeProvider';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import { useCompanionStore } from '../../src/store/companionStore';
import { SoundManager } from '../../src/utils/SoundManager';
import type { DisplayMessage } from '../../src/types/message';

function shouldShowTimestamp(cur: DisplayMessage, prev?: DisplayMessage): boolean {
  if (!prev) return true;
  return new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000;
}

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

export default function ChatPage() {
  const { id, companionId, name, shareMessage, scrollToMessageId } = useLocalSearchParams<{ id: string; companionId: string; name?: string; shareMessage?: string; scrollToMessageId?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const flatListRef = useRef<any>(null);
  const { messages, isTyping, isLoading, companionName, voiceEnabled, sendText, sendImage, sendVoice, sendSticker, sendCustomSticker, recallMessage, deleteMessage, transcribeMessage } = useChat(id!, companionId!);
  const [showMenu, setShowMenu] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [quoteMessage, setQuoteMessage] = useState<{ id: string; content: string; role: string } | null>(null);
  const [chatBgUri, setChatBgUri] = useState<string | null>(null);
  const [chatBgOpacity, setChatBgOpacity] = useState(0.15);
  const { deleteCompanion } = useCompanionStore();
  const insets = useSafeAreaInsets();
  const menuFadeAnim = useRef(new Animated.Value(0)).current;
  const menuSlideAnim = useRef(new Animated.Value(30)).current;

  // Animate menu open/close
  useEffect(() => {
    if (showMenu) {
      Animated.parallel([
        Animated.timing(menuFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.timing(menuSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(menuFadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(menuSlideAnim, { toValue: 20, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [showMenu]);

  // Stop audio playback when leaving chat page
  useEffect(() => {
    return () => {
      SoundManager.stop();
    };
  }, []);

  // Header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: isTyping ? '正在输入中...' : (companionName || name || '聊天'),
      headerTitleStyle: { fontWeight: '600' as const, fontSize: 17, color: isTyping ? theme.primary : theme.textPrimary },
      headerStyle: { backgroundColor: theme.bgPrimary },
      headerTintColor: theme.textPrimary,
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/call/[id]', params: { id: companionId!, companionId: companionId!, conversationId: id! } })}
            style={{ padding: 8, marginRight: 4 }}
            disabled={isTyping}
          >
            <Ionicons name="call-outline" size={22} color={isTyping ? theme.textTertiary : theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(true)} style={{ padding: 8 }}>
            <Ionicons name="ellipsis-horizontal" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [companionName, name, isTyping, theme]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      // If scrollToMessageId is set, scroll to that message; otherwise scroll to end
      if (scrollToMessageId) {
        const idx = messages.findIndex(m => m.id === scrollToMessageId);
        if (idx >= 0) {
          setTimeout(() => {
            try { flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }); } catch {}
            setHighlightId(scrollToMessageId);
            setTimeout(() => setHighlightId(null), 2000);
          }, 300);
          return; // Don't auto-scroll to end
        }
      }
      setTimeout(() => { try { flatListRef.current?.scrollToEnd({ animated: true }); } catch {} }, 100);
    }
  }, [messages.length, scrollToMessageId]);

  // Load chat background
  useEffect(() => {
    if (companionId) {
      CompanionRepository.getById(companionId).then(c => {
        if (c?.chatBackgroundUri) {
          setChatBgUri(c.chatBackgroundUri);
          setChatBgOpacity(c.chatBackgroundOpacity ?? 0.15);
        }
      }).catch(() => {});
    }
  }, [companionId]);

  // Send shared message from social space (only once)
  const shareSentRef = useRef(false);
  useEffect(() => {
    if (shareMessage && !isLoading && !shareSentRef.current) {
      shareSentRef.current = true;
      // Small delay to ensure chat is ready
      const timer = setTimeout(() => {
        sendText(shareMessage);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shareMessage, isLoading]);

  useEffect(() => {
    if (isTyping) setTimeout(() => { try { flatListRef.current?.scrollToEnd({ animated: true }); } catch {} }, 100);
  }, [isTyping]);

  // Menu actions
  function handleMenuAction(action: string) {
    setShowMenu(false);
    switch (action) {
      case 'settings': router.push(`/companion/${companionId}/settings`); break;
      case 'edit': router.push(`/companion/${companionId}/edit`); break;
      case 'persona': router.push(`/companion/${companionId}/persona`); break;
      case 'detail': router.push(`/companion/${companionId}`); break;
      case 'search': router.push({ pathname: '/chat/search', params: { companionId: companionId!, companionName: companionName || name || '' } }); break;
      case 'clear':
        Alert.alert('清空聊天记录', '确定？', [
          { text: '取消', style: 'cancel' },
          { text: '清空', style: 'destructive', onPress: async () => {
            await ConversationRepository.clearMessages(id!);
            require('../../src/store/chatStore').useChatStore.getState().setMessages(id!, []);
          }},
        ]);
        break;
      case 'reset':
        Alert.alert('重置记忆', 'AI 将彻底遗忘所有记忆，确定？', [
          { text: '取消', style: 'cancel' },
          { text: '重置', style: 'destructive', onPress: async () => {
            await ConversationRepository.clearMessages(id!);
            await ConversationRepository.updateLongTermMemory(id!, '');
            require('../../src/store/chatStore').useChatStore.getState().setMessages(id!, []);
          }},
        ]);
        break;
      case 'delete':
        Alert.alert('删除角色', `确定删除 ${companionName}？`, [
          { text: '取消', style: 'cancel' },
          { text: '删除', style: 'destructive', onPress: async () => { await deleteCompanion(companionId!); router.back(); }},
        ]);
        break;
    }
  }

  if (isLoading) {
    return <View style={[styles.center, { backgroundColor: theme.bgPrimary }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
  }

  return (
    /*
     * Layout structure:
     * ┌─────────────────────┐
     * │  FlashList (flex:1)  │  ← messages fill space
     * ├─────────────────────┤
     * │   ChatInput          │  ← bottom bar
     * └─────────────────────┘
     */
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bgPrimary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Chat Background */}
      {chatBgUri ? (
        <Image source={{ uri: chatBgUri }} style={[styles.chatBgImage, { opacity: chatBgOpacity }]} resizeMode="cover" />
      ) : null}
      {/* Messages — flex:1 so it fills space above input */}
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
            <ChatBubble
              message={item}
              onRecall={recallMessage}
              onDelete={deleteMessage}
              onReply={(msgId, content) => setQuoteMessage({ id: msgId, content, role: item.role })}
              onTranscribe={transcribeMessage}
              isHighlighted={item.id === highlightId}
            />
          </>
        )}
        contentContainerStyle={styles.msgContent}
        style={styles.msgList}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />

      {/* Input — stays above keyboard, always enabled so user can send during AI generation */}
      <ChatInput
        onSend={(text) => { sendText(text, quoteMessage); setQuoteMessage(null); }}
        onSendImage={sendImage}
        onSendVoice={sendVoice}
        onSendSticker={sendSticker}
        onSendCustomSticker={(sticker) => sendCustomSticker(sticker)}
        onSendNetworkSticker={(sticker) => sendImage(sticker.fullUrl, sticker.title || '[表情包]')}
        voiceEnabled={voiceEnabled}
        quoteTo={quoteMessage}
        onCancelQuote={() => setQuoteMessage(null)}
      />

      {/* Menu modal — Glassmorphism */}
      <Modal visible={showMenu} transparent animationType="none" onRequestClose={() => setShowMenu(false)}>
        <Animated.View style={[styles.menuOverlay, { opacity: menuFadeAnim, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <Animated.View style={[styles.menuBox, {
              backgroundColor: isDark ? 'rgba(30,30,46,0.88)' : 'rgba(255,255,255,0.88)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
              transform: [{ translateY: menuSlideAnim }],
            }]}>
              <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={styles.menuContent}>
                <MI icon="settings-outline" label="角色设置" theme={theme} onPress={() => handleMenuAction('settings')} />
                <MI icon="create-outline" label="编辑全部" theme={theme} onPress={() => handleMenuAction('edit')} />
                <MI icon="person-outline" label="编辑人设" theme={theme} onPress={() => handleMenuAction('persona')} />
                <MI icon="information-circle-outline" label="详情" theme={theme} onPress={() => handleMenuAction('detail')} />
                <MI icon="search-outline" label="查找记录" theme={theme} onPress={() => handleMenuAction('search')} />
                <View style={[styles.menuDiv, { backgroundColor: theme.divider }]} />
                <MI icon="trash-outline" label="清空记录" color="#FF9500" theme={theme} onPress={() => handleMenuAction('clear')} />
                <MI icon="refresh-outline" label="重置记忆" color="#FF9500" theme={theme} onPress={() => handleMenuAction('reset')} />
                <MI icon="close-circle-outline" label="删除角色" color="#FF4757" theme={theme} onPress={() => handleMenuAction('delete')} />
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MI({ icon, label, color, theme, onPress }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      onPressIn={() => {
        Animated.spring(scaleAnim, { toValue: 0.95, tension: 100, friction: 8, useNativeDriver: true }).start();
      }}
      onPressOut={() => {
        Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
      }}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons name={icon} size={20} color={color || theme.textPrimary} />
      </Animated.View>
      <Text style={[styles.menuItemText, { color: color || theme.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1 },
  chatBgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  // FlashList MUST have flex:1 to fill space and enable scrolling
  msgList: { flex: 1 },
  msgContent: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 4 },
  tsWrap: { alignItems: 'center', marginVertical: 12 },
  tsText: { fontSize: 11, backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingRight: 16 },
  menuBox: {
    borderRadius: 20, minWidth: 190, overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 10,
  },
  menuContent: { paddingVertical: 6 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  menuItemText: { fontSize: 15 },
  menuDiv: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
