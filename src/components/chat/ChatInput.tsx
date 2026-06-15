/**
 * Curoco — Chat Input (v1.6.1 WeChat-style)
 * Voice/keyboard toggle, press-to-talk, sticker panel, more panel
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, StyleSheet, Platform,
  ScrollView, Animated, Keyboard, Image, Dimensions, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeProvider';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { BUILTIN_STICKER_PACKS, type Sticker } from '../../utils/stickers';
import { StickerRepository, type CustomSticker } from '../../db/repositories/StickerRepository';
import { StickerSearchClient, type NetworkSticker } from '../../core/api/StickerSearchClient';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendImage?: (uri: string, caption?: string) => void;
  onSendVoice?: (uri: string, duration: number) => void;
  onSendSticker?: (emoji: string) => void;
  onSendCustomSticker?: (sticker: CustomSticker) => void;
  onSendNetworkSticker?: (sticker: NetworkSticker) => void;
  voiceEnabled?: boolean;
  disabled?: boolean;
  quoteTo?: { id: string; content: string; role: string } | null;
  onCancelQuote?: () => void;
}

type PanelMode = 'none' | 'sticker' | 'more';
type InputMode = 'text' | 'voice';

export default function ChatInput({
  onSend, onSendImage, onSendVoice, onSendSticker, onSendCustomSticker, onSendNetworkSticker,
  voiceEnabled = false, disabled = false, quoteTo = null, onCancelQuote,
}: ChatInputProps) {
  const { theme } = useTheme();
  const [text, setText] = useState('');
  const [panelMode, setPanelMode] = useState<PanelMode>('none');
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [isRecording, setIsRecording] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const [customStickers, setCustomStickers] = useState<CustomSticker[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NetworkSticker[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const sendScale = useRef(new Animated.Value(1)).current;
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const durationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef(false);
  const isSendingRef = useRef(false);
  const hasText = text.trim().length > 0;

  useEffect(() => {
    if (panelMode === 'sticker') {
      StickerRepository.getAll().then(setCustomStickers).catch(() => {});
    }
  }, [panelMode]);

  useEffect(() => {
    return () => {
      if (durationTimer.current) clearInterval(durationTimer.current);
    };
  }, []);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSendingRef.current) return;
    isSendingRef.current = true;
    Animated.sequence([
      Animated.timing(sendScale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.timing(sendScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    onSend(trimmed);
    setText('');
    setTimeout(() => { isSendingRef.current = false; }, 500);
  };

  const togglePanel = (mode: PanelMode) => {
    Keyboard.dismiss();
    setPanelMode(panelMode === mode ? 'none' : mode);
  };

  const toggleInputMode = () => {
    if (inputMode === 'text') {
      setInputMode('voice');
      Keyboard.dismiss();
      setPanelMode('none');
    } else {
      setInputMode('text');
    }
  };

  // Voice recording
  async function startRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        web: {
          mimeType: 'audio/mp4',
          bitsPerSecond: 128000,
        },
      };
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      setIsRecording(true);
      setIsCancelled(false);
      isCancelledRef.current = false;
      setRecordDuration(0);
      durationTimer.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (e) { console.warn('Record failed:', e); }
  }

  async function stopRecordingAndSend() {
    if (durationTimer.current) { clearInterval(durationTimer.current); durationTimer.current = null; }
    if (!recordingRef.current) { setIsRecording(false); return; }
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      const status = await recordingRef.current.getStatusAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (uri && onSendVoice) {
        const duration = (status as any).durationMillis ? (status as any).durationMillis / 1000 : 0;
        if (duration < 0.5) return;
        const cacheDir = (FileSystem.cacheDirectory || '') + 'voice_messages/';
        try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
        const destUri = cacheDir + 'msg_' + Date.now() + '.m4a';
        await FileSystem.copyAsync({ from: uri, to: destUri });
        onSendVoice(destUri, duration);
      }
    } catch (e) { console.warn('Stop failed:', e); }
    recordingRef.current = null;
  }

  async function cancelRecording() {
    if (durationTimer.current) { clearInterval(durationTimer.current); durationTimer.current = null; }
    if (!recordingRef.current) { setIsRecording(false); return; }
    setIsRecording(false);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch {}
    recordingRef.current = null;
  }

  // PanResponder for "按住 说话" button — press to record, release to send, swipe up to cancel
  const talkPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        touchStartY.current = evt.nativeEvent.pageY;
        touchStartX.current = evt.nativeEvent.pageX;
        isCancelledRef.current = false;
        setIsCancelled(false);
        startRecording();
      },
      onPanResponderMove: (evt) => {
        const deltaY = evt.nativeEvent.pageY - touchStartY.current;
        if (deltaY < -60) {
          if (!isCancelledRef.current) {
            isCancelledRef.current = true;
            setIsCancelled(true);
          }
        } else {
          if (isCancelledRef.current) {
            isCancelledRef.current = false;
            setIsCancelled(false);
          }
        }
      },
      onPanResponderRelease: () => {
        if (isCancelledRef.current) {
          cancelRecording();
        } else {
          stopRecordingAndSend();
        }
      },
      onPanResponderTerminate: () => {
        cancelRecording();
      },
    })
  ).current;

  // Image picking
  async function handlePickImage() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if ((file.size || 0) > 10 * 1024 * 1024) return;
      const cacheDir = (FileSystem.cacheDirectory || '') + 'chat_images/';
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'jpg';
      const destUri = cacheDir + 'img_' + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: destUri });
      onSendImage?.(destUri);
      setPanelMode('none');
    } catch {}
  }

  function handleSticker(sticker: Sticker) {
    onSendSticker?.(sticker.emoji);
    setPanelMode('none');
  }

  const packs = BUILTIN_STICKER_PACKS;
  const allTabs = ['内置表情', '我的'];
  const isBuiltInTab = activeTab === 0;
  const isMyTab = activeTab === 1;

  // Flatten all built-in stickers into one list
  const allBuiltInStickers = packs.flatMap(p => p.stickers);

  async function handleSearchStickers(query: string) {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const results = await StickerSearchClient.search(query);
      setSearchResults(results);
    } catch { setSearchResults([]); }
    finally { setSearchLoading(false); }
  }

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.bgSecondary }]}>
      {/* Sticker Panel */}
      {panelMode === 'sticker' && (
        <View style={[styles.panel, { backgroundColor: theme.bgTertiary, borderTopColor: theme.border }]}>
          <View style={styles.tabRow}>
            {allTabs.map((name, i) => (
              <TouchableOpacity
                key={name}
                style={[styles.tab, activeTab === i && styles.tabActive]}
                onPress={() => setActiveTab(i)}
              >
                <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={styles.stickerScroll} contentContainerStyle={styles.stickerGrid}>
            {isBuiltInTab ? (
              allBuiltInStickers.map((s) => (
                <TouchableOpacity key={s.id} style={styles.stickerItem} onPress={() => handleSticker(s)} activeOpacity={0.6}>
                  <Text style={styles.stickerEmoji}>{s.emoji}</Text>
                  <Text style={styles.stickerLabel}>{s.label}</Text>
                </TouchableOpacity>
              ))
            ) : isMyTab ? (
              <>
                {/* Network sticker search */}
                <View style={styles.searchBarWrap}>
                  <Ionicons name="search" size={16} color="#A0A0B8" style={{ marginLeft: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={handleSearchStickers}
                    placeholder="搜索网络表情包..."
                    placeholderTextColor="#A0A0B8"
                    returnKeyType="search"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={16} color="#A0A0B8" />
                    </TouchableOpacity>
                  )}
                </View>
                {/* Network search results */}
                {searchLoading ? (
                  <View style={styles.emptyStickers}>
                    <Text style={styles.emptyStickersText}>搜索中...</Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  searchResults.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.networkStickerItem}
                      onPress={() => { onSendNetworkSticker?.(s); setPanelMode('none'); }}
                      activeOpacity={0.6}
                    >
                      <Image source={{ uri: s.url }} style={styles.networkStickerImg} resizeMode="contain" />
                    </TouchableOpacity>
                  ))
                ) : searchQuery.length > 0 ? (
                  <View style={styles.emptyStickers}>
                    <Text style={styles.emptyStickersText}>没有找到结果</Text>
                  </View>
                ) : null}
                {/* Custom stickers */}
                {customStickers.length > 0 && (
                  <>
                    <View style={styles.customSectionHeader}>
                      <Text style={styles.customSectionTitle}>我的表情包</Text>
                    </View>
                    {customStickers.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.customStickerItem}
                        onPress={() => { onSendCustomSticker?.(s); setPanelMode('none'); }}
                        activeOpacity={0.6}
                      >
                        <Image source={{ uri: s.thumbnail_path || s.file_path }} style={styles.customStickerImg} resizeMode="contain" />
                        {s.meaning ? <Text style={styles.stickerLabel} numberOfLines={1}>{s.meaning}</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {!searchQuery && customStickers.length === 0 && (
                  <View style={styles.emptyStickers}>
                    <Ionicons name="images-outline" size={40} color="#C0C0C0" />
                    <Text style={styles.emptyStickersText}>还没有表情包</Text>
                    <Text style={styles.emptyStickersHint}>搜索网络表情包 或 去「设置 → 表情包管理」导入</Text>
                  </View>
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* More Panel */}
      {panelMode === 'more' && (
        <View style={styles.panel}>
          <View style={styles.moreGrid}>
            <TouchableOpacity style={styles.moreItem} onPress={handlePickImage} activeOpacity={0.7}>
              <View style={[styles.moreIcon, { backgroundColor: '#6C63FF' }]}>
                <Ionicons name="image" size={22} color="#fff" />
              </View>
              <Text style={styles.moreLabel}>图片</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreItem} onPress={() => {}} activeOpacity={0.7}>
              <View style={[styles.moreIcon, { backgroundColor: '#FF9500' }]}>
                <Ionicons name="camera" size={22} color="#fff" />
              </View>
              <Text style={styles.moreLabel}>拍照</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreItem} onPress={() => {}} activeOpacity={0.7}>
              <View style={[styles.moreIcon, { backgroundColor: '#5856D6' }]}>
                <Ionicons name="document" size={22} color="#fff" />
              </View>
              <Text style={styles.moreLabel}>文件</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Recording overlay — centered floating card */}
      {isRecording && (
        <View style={styles.recordOverlay}>
          <View style={[styles.recordCard, isCancelled && styles.recordCardCancel]}>
            <View style={styles.recordDotRow}>
              <View style={[styles.recordDot, isCancelled && styles.recordDotCancel]} />
              <Text style={[styles.recordTime, isCancelled && { color: '#FF4757' }]}>
                {isCancelled ? '松手取消' : `${Math.floor(recordDuration / 60)}:${(recordDuration % 60).toString().padStart(2, '0')}`}
              </Text>
            </View>
            <Text style={[styles.recordHint, isCancelled && { color: '#FF4757' }]}>
              {isCancelled ? '↑ 上滑取消' : '↑ 上滑取消 · 松手发送'}
            </Text>
            <Ionicons
              name={isCancelled ? 'close-circle' : 'mic'}
              size={32}
              color={isCancelled ? '#FF4757' : '#6C63FF'}
            />
          </View>
        </View>
      )}

      {/* Quote Preview Bar */}
      {quoteTo && (
        <View style={[styles.quoteBar, { backgroundColor: theme.bgTertiary, borderLeftColor: theme.textTertiary }]}>
          <Ionicons name="arrow-undo-outline" size={14} color={theme.textSecondary} style={{ marginRight: 6 }} />
          <Text style={[styles.quoteBarText, { color: theme.textSecondary }]} numberOfLines={1}>
            {quoteTo.role === 'user' ? '你的消息' : '对方的消息'}：{quoteTo.content}
          </Text>
          <TouchableOpacity onPress={onCancelQuote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      <View style={[styles.container, { backgroundColor: theme.bgSecondary, borderTopColor: theme.border }]}>
        {/* Left toggle: voice ↔ keyboard */}
        <TouchableOpacity style={styles.iconBtn} onPress={toggleInputMode} activeOpacity={0.6}>
          <Ionicons
            name={inputMode === 'text' ? 'mic-outline' : 'keypad-outline'}
            size={24}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {/* Center: text input OR "按住 说话" button */}
        {inputMode === 'text' ? (
          <View style={[styles.inputWrapper, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              value={text}
              onChangeText={setText}
              placeholder="输入消息..."
              placeholderTextColor={theme.textTertiary}
              multiline
              maxLength={2000}
              editable={!disabled}
              returnKeyType="send"
              blurOnSubmit
              onFocus={() => setPanelMode('none')}
            />
          </View>
        ) : (
          <View style={[styles.talkButtonWrap]} {...talkPanResponder.panHandlers}>
            <View style={[styles.talkButton, { backgroundColor: '#F0F0F0' }]}>
              <Text style={styles.talkButtonText}>按住 说话</Text>
            </View>
          </View>
        )}

        {/* Sticker button */}
        <TouchableOpacity style={styles.iconBtn} onPress={() => togglePanel('sticker')} activeOpacity={0.6}>
          <Ionicons name="happy-outline" size={24} color={panelMode === 'sticker' ? theme.primary : theme.textSecondary} />
        </TouchableOpacity>

        {/* Send / More button */}
        {hasText && inputMode === 'text' ? (
          <Animated.View style={{ transform: [{ scale: sendScale }] }}>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              onPressIn={() => Animated.timing(sendScale, { toValue: 0.92, duration: 100, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(sendScale, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }).start()}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity style={styles.iconBtn} onPress={() => togglePanel('more')} activeOpacity={0.6}>
            <Ionicons name="add-circle-outline" size={24} color={panelMode === 'more' ? theme.primary : theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { backgroundColor: 'rgba(255,255,255,0.95)' },
  panel: {
    height: 260,
    backgroundColor: '#F8F7FC',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8F0',
  },
  tabRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { fontSize: 12, color: '#6B6B8D', fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  stickerScroll: { flex: 1 },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8, paddingBottom: 8 },
  stickerItem: { width: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  customStickerItem: { width: '25%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  customStickerImg: { width: 60, height: 60, borderRadius: 8 },
  customSectionHeader: { width: '100%', paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 },
  customSectionTitle: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  stickerEmoji: { fontSize: 32 },
  stickerLabel: { fontSize: 10, color: '#A0A0B8', marginTop: 2 },
  emptyStickers: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, width: '100%' },
  emptyStickersText: { fontSize: 14, color: '#A0A0B8', marginTop: 8 },
  emptyStickersHint: { fontSize: 12, color: '#C0C0C0', marginTop: 4 },
  moreGrid: { flexDirection: 'row', padding: 20, gap: 24 },
  moreItem: { alignItems: 'center' },
  moreIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moreLabel: { fontSize: 11, color: '#6B6B8D', marginTop: 6 },
  // Recording overlay
  recordOverlay: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center', zIndex: 100,
  },
  recordCard: {
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, paddingVertical: 16, paddingHorizontal: 24,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  recordCardCancel: { borderColor: '#FF475730', backgroundColor: '#FFF5F5' },
  recordDotRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF4757' },
  recordDotCancel: { backgroundColor: '#FF4757' },
  recordTime: { fontSize: 18, fontWeight: '600', color: '#1A1A2E', fontVariant: ['tabular-nums'] },
  recordHint: { fontSize: 12, color: '#8E8E93' },
  // Input bar
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8F0',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  quoteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderLeftWidth: 3,
    marginHorizontal: 0,
    gap: 4,
  },
  quoteBarText: {
    flex: 1,
    fontSize: 13,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F5F4FA',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E8E8F0',
    marginHorizontal: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    maxHeight: 100,
    color: '#1A1A2E',
  },
  // WeChat-style "按住 说话" button
  talkButtonWrap: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 40,
    justifyContent: 'center',
  },
  talkButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  talkButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B6B8D',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  // Network sticker search
  searchBarWrap: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F0EFF5', borderRadius: 18, marginBottom: 8,
    paddingRight: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, paddingVertical: 8, paddingHorizontal: 8, color: '#1A1A2E',
  },
  networkStickerItem: { width: '25%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  networkStickerImg: { width: 70, height: 70, borderRadius: 8 },
});
