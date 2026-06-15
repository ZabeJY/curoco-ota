/**
 * Curoco — Chat Bubble (v1.6.0)
 * Text + voice + image + sticker rendering
 * Coordinate-based glassmorphism context menu (Popover mode)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  ActivityIndicator, Modal, Animated, Clipboard, findNodeHandle, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { SoundManager } from '../../utils/SoundManager';
import { useTheme } from '../../theme/ThemeProvider';
import ImageViewer from '../common/ImageViewer';
import type { DisplayMessage } from '../../types/message';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const MAX_BUBBLE_WIDTH = Math.floor(SCREEN_WIDTH * 0.72);
const MENU_WIDTH = 180;
const MENU_ITEM_HEIGHT = 48;

interface ChatBubbleProps {
  message: DisplayMessage;
  isGroupChat?: boolean;
  companionName?: string;
  isHighlighted?: boolean;
  onRecall?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReply?: (messageId: string, content: string) => void;
  onTranscribe?: (messageId: string, mediaUri: string) => Promise<string | null>;
}

function isSticker(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > 16) return false;
  if (/[a-zA-Z0-9]/.test(trimmed)) return false;
  if (/[一-鿿　-〿＀-￯]/.test(trimmed)) return false;
  return true;
}

function parseSharePost(content: string): any | null {
  const match = content.match(/^\[SHARE_POST:(.+)\]$/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  onPress: () => void;
}

// Bubble position for popover
interface BubbleLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  pageX: number;
  pageY: number;
}

export default function ChatBubble({ message, isGroupChat, companionName, isHighlighted, onRecall, onDelete, onReply, onTranscribe }: ChatBubbleProps) {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const isSelf = message.role === 'user';
  const isVoice = message.type === 'voice' && message.mediaUri;
  const isImage = message.type === 'image' && message.mediaUri;
  const isCustomEmoji = message.type === 'custom_emoji';
  const sharePost = !isVoice && !isImage && !isCustomEmoji ? parseSharePost(message.content) : null;
  const isStickerMsg = !sharePost && isSticker(message.content) && !isVoice && !isImage && !isCustomEmoji;
  const isFailed = message.status === 'failed';
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const waveHeights = useMemo(() => Array.from({ length: 12 }, () => 4 + Math.random() * 12), []);

  // Highlight animation for search result navigation
  const highlightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.delay(1400),
        Animated.timing(highlightAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
      ]).start();
    }
  }, [isHighlighted]);

  // Context menu state
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const menuFade = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current;
  const bubbleRef = useRef<View>(null);

  const bubbleBg = isSelf ? theme.bubbleSelf : theme.bubbleOther;
  const textColor = isSelf ? theme.textSelf : theme.textPrimary;
  const highlightBorder = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)'],
  });

  // Animate menu open/close
  useEffect(() => {
    if (showMenu) {
      Animated.parallel([
        Animated.timing(menuFade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(menuScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(menuFade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(menuScale, { toValue: 0.95, duration: 120, useNativeDriver: true }),
      ]).start();
    }
  }, [showMenu]);

  // Build menu items per message type
  const menuItems: MenuItem[] = [];

  // 引用 (all types)
  menuItems.push({
    icon: 'chatbubble-ellipses-outline',
    label: '引用',
    onPress: () => {
      setShowMenu(false);
      if (onReply) {
        const quoteText = message.content || (isVoice ? '[语音消息]' : isImage ? '[图片]' : '[表情包]');
        onReply(message.id, quoteText);
      }
    },
  });

  // 复制 (text only)
  if (!isVoice && !isImage && !isCustomEmoji && !sharePost && !isStickerMsg && message.content) {
    menuItems.push({
      icon: 'copy-outline',
      label: '复制',
      onPress: () => {
        Clipboard.setString(message.content);
        setShowMenu(false);
      },
    });
  }

  // 转文字 (voice only)
  if (isVoice && onTranscribe) {
    menuItems.push({
      icon: transcription ? (showTranscription ? 'document-text' : 'document-text-outline') : 'document-text-outline',
      label: transcription ? (showTranscription ? '隐藏文字' : '显示文字') : '转文字',
      onPress: () => {
        if (transcription) {
          setShowTranscription(!showTranscription);
        } else {
          handleTranscribe();
        }
        setShowMenu(false);
      },
    });
  }

  // 撤回 (self messages)
  if (isSelf && onRecall) {
    menuItems.push({
      icon: 'arrow-undo-circle-outline',
      label: '撤回',
      color: '#FF9500',
      onPress: () => {
        onRecall(message.id);
        setShowMenu(false);
      },
    });
  }

  // 删除
  if (onDelete) {
    menuItems.push({
      icon: 'trash-outline',
      label: '删除',
      color: '#FF4757',
      onPress: () => {
        onDelete(message.id);
        setShowMenu(false);
      },
    });
  }

  // Measure bubble and compute menu position (Popover mode)
  function handleLongPress() {
    if (menuItems.length === 0) return;
    const handle = findNodeHandle(bubbleRef.current);
    if (!handle) { setShowMenu(true); return; }

    bubbleRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      // Smart positioning: menu above if bubble is in lower half, below otherwise
      const menuHeight = menuItems.length * MENU_ITEM_HEIGHT + 12;
      const spaceAbove = y;
      const spaceBelow = SCREEN_HEIGHT - y - h;

      let menuY: number;
      if (spaceAbove > menuHeight + 12) {
        // Place above bubble
        menuY = y - menuHeight - 4;
      } else if (spaceBelow > menuHeight + 12) {
        // Place below bubble
        menuY = y + h + 4;
      } else {
        // Default: above
        menuY = y - menuHeight - 4;
      }

      // Horizontal: align with bubble edge, clamp to screen
      let menuX: number;
      if (isSelf) {
        // Self bubble: right-align menu to bubble right edge
        menuX = x + w - MENU_WIDTH;
      } else {
        // Other bubble: left-align menu to bubble left edge
        menuX = x;
      }
      // Clamp to screen bounds
      menuX = Math.max(8, Math.min(menuX, SCREEN_WIDTH - MENU_WIDTH - 8));
      menuY = Math.max(40, Math.min(menuY, SCREEN_HEIGHT - menuHeight - 40));

      setMenuPos({ x: menuX, y: menuY });
      setShowMenu(true);
    });
  }

  async function handlePlayVoice() {
    if (!message.mediaUri) return;
    if (isPlaying) {
      await SoundManager.stop();
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    await SoundManager.play(message.mediaUri, () => setIsPlaying(false));
  }

  async function handleTranscribe() {
    if (!onTranscribe || !message.mediaUri) return;
    if (transcription) {
      setShowTranscription(!showTranscription);
      return;
    }
    setIsTranscribing(true);
    try {
      const result = await onTranscribe(message.id, message.mediaUri);
      if (result) {
        setTranscription(result);
        setShowTranscription(true);
      }
    } catch (e: any) {
      console.warn('Transcribe display failed:', e?.message);
      // Show error in bubble
      setTranscription(`转写失败: ${e?.message || '未知错误'}`);
      setShowTranscription(true);
    } finally {
      setIsTranscribing(false);
    }
  }

  // Context menu renderer — coordinate-based popover
  function renderContextMenu() {
    if (menuItems.length === 0) return null;
    const glassBg = isDark ? 'rgba(30,30,46,0.85)' : 'rgba(255,255,255,0.85)';
    const borderClr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)';

    return (
      <Modal transparent visible={showMenu} animationType="none" statusBarTranslucent onRequestClose={() => setShowMenu(false)}>
        <Animated.View style={[menuStyles.overlay, { opacity: menuFade }]}>
          <TouchableOpacity style={menuStyles.overlayTouch} activeOpacity={1} onPress={() => setShowMenu(false)}>
            <Animated.View style={[menuStyles.card, {
              backgroundColor: glassBg,
              borderColor: borderClr,
              left: menuPos.x,
              top: menuPos.y,
              transform: [{ scale: menuScale }],
            }]}>
              <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={menuStyles.content}>
                {menuItems.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={menuStyles.item}
                    onPress={item.onPress}
                    activeOpacity={0.6}
                  >
                    <Ionicons name={item.icon} size={18} color={item.color || theme.textPrimary} />
                    <Text style={[menuStyles.itemLabel, { color: item.color || theme.textPrimary }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    );
  }

  // Voice message
  if (isVoice) {
    return (
      <>
        <TouchableOpacity
          ref={bubbleRef}
          style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}
          onPress={handlePlayVoice}
          onLongPress={handleLongPress}
          delayLongPress={400}
          activeOpacity={0.8}
        >
          <Animated.View style={[styles.bubble, { backgroundColor: bubbleBg }, isHighlighted && { borderColor: highlightBorder, borderWidth: 1.5 }]}>
            <View style={styles.voiceRow}>
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={28}
                color={isSelf ? theme.textSelf : theme.primary}
              />
              <View style={styles.voiceInfo}>
                <View style={styles.voiceWaveform}>
                  {waveHeights.map((h, i) => (
                    <View key={i} style={[styles.waveBar, { height: h, backgroundColor: isSelf ? theme.textSelf + '40' : theme.textTertiary }]} />
                  ))}
                </View>
                <Text style={[styles.voiceDuration, { color: theme.textSecondary }]}>
                  {message.mediaDuration ? `${Math.ceil(message.mediaDuration)}″` : ''}
                </Text>
              </View>
            </View>

            {transcription && showTranscription && (
              <Text style={[styles.transcriptionText, { color: textColor }]}>
                {transcription}
              </Text>
            )}
          </Animated.View>
        </TouchableOpacity>
        {renderContextMenu()}
      </>
    );
  }

  // Image
  if (isImage) {
    return (
      <>
        <TouchableOpacity
          ref={bubbleRef}
          style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}
          onLongPress={handleLongPress}
          onPress={() => message.mediaUri && setViewingImage(message.mediaUri)}
          activeOpacity={0.8}
        >
          <View style={[styles.imageBubble, { backgroundColor: bubbleBg }]}>
            <Image source={{ uri: message.mediaUri }} style={styles.chatImage} resizeMode="cover" />
            {message.content && message.content !== '[图片]' && (
              <Text style={[styles.imageCaption, { color: textColor }]}>{message.content}</Text>
            )}
          </View>
        </TouchableOpacity>
        <ImageViewer visible={!!viewingImage} uri={viewingImage || ''} onClose={() => setViewingImage(null)} />
        {renderContextMenu()}
      </>
    );
  }

  // Sticker (unicode emoji)
  if (isStickerMsg) {
    return (
      <>
        <TouchableOpacity
          ref={bubbleRef}
          style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
        >
          <Text style={styles.stickerText}>{message.content}</Text>
        </TouchableOpacity>
        {renderContextMenu()}
      </>
    );
  }

  // Custom emoji (image sticker)
  if (isCustomEmoji && message.emojiUri) {
    return (
      <>
        <TouchableOpacity
          ref={bubbleRef}
          style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}
          onLongPress={handleLongPress}
          activeOpacity={0.8}
        >
          <View style={styles.emojiBubble}>
            <Image source={{ uri: message.emojiUri }} style={styles.emojiImage} resizeMode="contain" />
          </View>
        </TouchableOpacity>
        {renderContextMenu()}
      </>
    );
  }

  // Shared post card
  if (sharePost) {
    return (
      <>
        <View style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}>
          <TouchableOpacity
            style={[styles.shareCard, { backgroundColor: theme.bgSecondary }]}
            activeOpacity={0.7}
            onPress={() => { router.push('/(tabs)/discover'); }}
          >
            <View style={styles.shareCardHeader}>
              <Ionicons name="planet" size={14} color="#6C63FF" />
              <Text style={styles.shareCardLabel}>Curoco Space</Text>
            </View>
            {sharePost.images?.length > 0 && (
              <Image source={{ uri: sharePost.images[0] }} style={styles.shareCardImage} resizeMode="cover" />
            )}
            <Text style={[styles.shareCardContent, { color: theme.textPrimary }]} numberOfLines={3}>
              {sharePost.content}
            </Text>
            <View style={styles.shareCardFooter}>
              <Text style={styles.shareCardAuthor}>{sharePost.author}</Text>
              <View style={styles.shareCardStats}>
                {sharePost.likes > 0 && (
                  <View style={styles.shareCardStat}>
                    <Ionicons name="heart" size={11} color="#FF4757" />
                    <Text style={styles.shareCardStatText}>{sharePost.likes}</Text>
                  </View>
                )}
                {sharePost.comments > 0 && (
                  <View style={styles.shareCardStat}>
                    <Ionicons name="chatbubble" size={11} color="#8E8E93" />
                    <Text style={styles.shareCardStatText}>{sharePost.comments}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.shareCardArrow}>
              <Ionicons name="chevron-forward" size={14} color="#C0C0C0" />
            </View>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  // Text (default)
  return (
    <>
      <TouchableOpacity
        ref={bubbleRef}
        style={[styles.row, isSelf ? styles.rowSelf : styles.rowOther]}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.bubble, { backgroundColor: bubbleBg }, isHighlighted && { borderColor: highlightBorder, borderWidth: 1.5 }]}>
          {isGroupChat && !isSelf && companionName && (
            <Text style={[styles.senderName, { color: theme.primary }]}>{companionName}</Text>
          )}
          {message.quoteContent ? (
            <View style={[styles.quoteCard, { borderLeftColor: theme.textTertiary, backgroundColor: isSelf ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.04)' }]}>
              <Text style={[styles.quoteCardText, { color: theme.textSecondary }]} numberOfLines={2}>
                {message.quoteContent}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.text, { color: textColor }, isFailed && { color: theme.danger }]}>
            {message.content}
          </Text>
        </Animated.View>
      </TouchableOpacity>
      {renderContextMenu()}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 4 },
  rowSelf: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: MAX_BUBBLE_WIDTH, minWidth: 48, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, flexShrink: 1, alignSelf: 'flex-start',
  },
  senderName: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  quoteCard: {
    borderLeftWidth: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  quoteCardText: { fontSize: 12, lineHeight: 16 },
  text: { fontSize: 15, lineHeight: 22, flexWrap: 'wrap' },
  // Voice
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 120 },
  voiceInfo: { flex: 1 },
  voiceWaveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 16 },
  waveBar: { width: 3, borderRadius: 1.5 },
  voiceDuration: { fontSize: 11, marginTop: 4 },
  transcriptionText: { fontSize: 13, lineHeight: 18, marginTop: 8, fontStyle: 'italic' },
  // Image
  imageBubble: { borderRadius: 16, overflow: 'hidden', alignSelf: 'flex-start' },
  chatImage: { width: 200, height: 200, borderRadius: 12 },
  imageCaption: { fontSize: 13, paddingHorizontal: 10, paddingVertical: 6 },
  // Sticker / Emoji
  stickerText: { fontSize: 64, lineHeight: 72 },
  emojiBubble: { borderRadius: 16, overflow: 'hidden', alignSelf: 'flex-start' },
  emojiImage: { width: 120, height: 120 },
  // Share card
  shareCard: {
    width: 240, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#E8E8F0',
  },
  shareCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6,
  },
  shareCardLabel: { fontSize: 11, fontWeight: '600', color: '#6C63FF' },
  shareCardImage: { width: '100%', height: 120 },
  shareCardContent: {
    fontSize: 13, lineHeight: 18, paddingHorizontal: 12, paddingTop: 6,
  },
  shareCardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  shareCardAuthor: { fontSize: 11, color: '#8E8E93' },
  shareCardStats: { flexDirection: 'row', gap: 8 },
  shareCardStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  shareCardStatText: { fontSize: 11, color: '#8E8E93' },
  shareCardArrow: { position: 'absolute', right: 8, top: '50%', marginTop: -7 },
});

const menuStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  overlayTouch: { flex: 1 },
  card: {
    position: 'absolute',
    borderRadius: 16, overflow: 'hidden', width: MENU_WIDTH,
    borderWidth: 1,
    backgroundColor: 'transparent',
    shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0, shadowRadius: 0, elevation: 0,
  },
  content: { paddingVertical: 4, position: 'relative', zIndex: 1 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  itemLabel: { fontSize: 14, fontWeight: '500' },
});
