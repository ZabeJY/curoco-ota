/**
 * Curoco Space — Premium Social Feed
 * Curved header, floating avatar, breathing cards, nested comments
 */

import React, { useState, useCallback, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View, FlatList, Text, TouchableOpacity, StyleSheet, TextInput,
  Alert, Animated, Dimensions, Modal, Platform, LayoutAnimation, UIManager,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useNavigation } from 'expo-router';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import TiltCard from '../../src/components/common/TiltCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Avatar from '../../src/components/common/Avatar';
import LikeButton from '../../src/components/social/LikeButton';
import ParallaxHeader from '../../src/components/social/ParallaxHeader';
import { SkeletonFeed } from '../../src/components/social/SkeletonCard';
import AnimatedPostInsert from '../../src/components/social/AnimatedPostInsert';
import { SocialRepo } from '../../src/db/repositories/SocialRepositoryNew';
import { useCompanionStore } from '../../src/store/companionStore';
import { useSettingsStore } from '../../src/store/settingsStore';
import { SettingsRepository } from '../../src/db/repositories/SettingsRepository';
import { PersonaEngine } from '../../src/core/persona/PersonaEngine';
import { PromptBuilder } from '../../src/core/engine/PromptBuilder';
import { LLMClient } from '../../src/core/api/LLMClient';
import type { PostWithMeta, SocialComment } from '../../src/types/social';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = 280;
const CARD_RADIUS = 14;

// Extract plain text from LLM response that may be JSON-structured
function extractPlainText(raw: string): string {
  const trimmed = raw.trim();
  // Try parsing as JSON (LLM may return {"emotion":"...","messages":["..."]})
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
      return parsed.messages[0];
    }
    if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
      return parsed.content;
    }
  } catch {}
  // Try extracting JSON from within the text (non-greedy first, then greedy fallback)
  const jsonMatch = trimmed.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return parsed.messages[0];
      }
    } catch {}
  }
  // Greedy fallback for multi-line JSON
  const greedyMatch = trimmed.match(/\{[\s\S]*\}/);
  if (greedyMatch && greedyMatch[0] !== jsonMatch?.[0]) {
    try {
      const parsed = JSON.parse(greedyMatch[0]);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages) && parsed.messages.length > 0) {
        return parsed.messages[0];
      }
    } catch {}
  }
  // Plain text: strip surrounding quotes
  return trimmed.replace(/^["']|["']$/g, '');
}

export default function DiscoverPage() {
  const router = useRouter();
  const navigation = useNavigation();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPostId, setNewPostId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [composerImages, setComposerImages] = useState<string[]>([]);
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const { companions } = useCompanionStore();
  const { settings } = useSettingsStore();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Transparent header: white text over cover image
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTintColor: '#fff',
      headerTitleStyle: { fontSize: 18, fontWeight: '700', color: '#fff' },
    });
  }, [navigation]);

  useFocusEffect(useCallback(() => { loadFeed(); loadCover(); }, []));

  async function loadFeed() {
    try {
      setPosts(await SocialRepo.getFeed());
    } catch (e) { console.warn('loadFeed:', e); }
    finally { setLoading(false); }
  }

  async function loadCover() {
    try { setCoverUri(await SettingsRepository.getSetting('space_cover_uri')); } catch {}
  }

  // ── Publish ──
  async function handlePublish() {
    const text = composerText.trim();
    if (!text && composerImages.length === 0) return;

    try {
      const post = await SocialRepo.createPost('user', settings.userName || '我', settings.userAvatarUri || '', text, composerImages);
      setComposerText('');
      setComposerImages([]);
      setShowComposer(false);
      setNewPostId(post.post_id);
      await loadFeed();
      scheduleAIReaction(text);
    } catch (e) {
      console.warn('Publish failed:', e);
      Alert.alert('发布失败', '请重试');
    }
  }

  // ── AI delayed reaction (LLM-based with persona) ──
  function scheduleAIReaction(content: string) {
    if (companions.length === 0) return;
    const comp = companions[Math.floor(Math.random() * companions.length)];
    const delay = 30000 + Math.floor(Math.random() * 30000);
    setTimeout(async () => {
      try {
        const posts = await SocialRepo.getFeed(1);
        if (posts.length === 0) return;
        const postId = posts[0].post_id;
        await SocialRepo.toggleLike(postId, comp.id, comp.name);

        const reactionText = await generatePersonaReaction(comp, content);
        await SocialRepo.addComment(postId, comp.id, comp.name, comp.avatarUri || '', reactionText);
        await loadFeed();
      } catch {}
    }, delay);
  }

  // Generate a persona-aware reaction using LLM
  // 性格从角色卡数据注入，网感由框架硬性约束
  async function generatePersonaReaction(comp: any, postContent: string): Promise<string> {
    const fallbackReactions = [
      `不错`, `嗯哼`, `还行`, `呵`, `可以`, `切`, `？`, `哦`, `嗯`, `行吧`,
    ];

    const apiConfigs = useSettingsStore.getState().apiConfigs;
    const userSignature = useSettingsStore.getState().settings.userSignature || '';
    if (!apiConfigs.llm) return fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];

    try {
      const persona = await PersonaEngine.load(comp.id, userSignature);
      if (!persona) return fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];

      const conv = await ConversationRepository.getByCompanionId(comp.id);
      const longTermMemory = conv?.longTermMemorySummary || '';
      const systemPrompt = PromptBuilder.buildSystemPrompt(persona, 'chatroom');
      const messages = PromptBuilder.buildMessages(
        systemPrompt + `\n\n【当前场景】你在社交空间看到对方发了一条动态，请自然地评论互动。

【评论行为规范】
1. 字数严格控制在5-12个字，像人类在朋友圈随手回复
2. 口语化：多用语气词（啊呢吧切哦嗯呵）和碎片化表达
3. 禁止书面语、禁止讲道理、禁止完整长句
4. 可以只发标点（？！）或单字（嗯、哦、切、呵）
5. 短句节奏参考：
   - 赞美类 → "可以啊" / "有眼光" / "绝了"
   - 敷衍类 → "哦" / "嗯" / "行吧"
   - 调侃类 → "就这？" / "？" / "呵"
   - 情绪类 → "啊啊啊" / "！！" / "哭了"`,
        longTermMemory, [],
        `对方发了一条动态：「${postContent}」\n用你的人设风格简短评论。`
      );
      const llmClient = new LLMClient(apiConfigs.llm);
      const response = await llmClient.chat(messages);
      const cleaned = extractPlainText(response);
      if (cleaned.length > 0 && cleaned.length <= 30) return cleaned;
      if (cleaned.length > 30) return cleaned.slice(0, 15);
      return fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];
    } catch {
      return fallbackReactions[Math.floor(Math.random() * fallbackReactions.length)];
    }
  }

  // ── AI proactive posting (heavily rate-limited) ──
  useEffect(() => {
    if (companions.length === 0) return;

    // Check every 30 minutes, but only post max 2/day with 8h cooldown
    const interval = setInterval(async () => {
      try {
        // Check how many posts AI made today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const allPosts = await SocialRepo.getFeed(20);
        const todayAIPosts = allPosts.filter(
          (p) => p.author_id !== 'user' && new Date(p.created_at) >= today
        );

        // Max 2 AI posts per day
        if (todayAIPosts.length >= 2) return;

        // Check cooldown (8 hours since last AI post)
        if (todayAIPosts.length > 0) {
          const lastPost = todayAIPosts[0];
          const hoursSinceLast = (Date.now() - new Date(lastPost.created_at).getTime()) / 3600000;
          if (hoursSinceLast < 8) return;
        }

        // Pick a random companion
        const comp = companions[Math.floor(Math.random() * companions.length)];
        const hour = new Date().getHours();

        // Only post during reasonable hours (8am-11pm)
        if (hour < 8 || hour >= 23) return;

        const content = await generatePersonaPost(comp, hour);
        await SocialRepo.createPost(comp.id, comp.name, comp.avatarUri || '', content, []);
        await loadFeed();
      } catch (e) {
        console.warn('AI post failed:', e);
      }
    }, 1800000); // Check every 30 minutes

    return () => clearInterval(interval);
  }, [companions]);

  // ── Like ──
  async function handleLike(postId: string) {
    await SocialRepo.toggleLike(postId, 'user', settings.userName || '我');
    await loadFeed();
  }

  // ── Share post to chat ──
  async function handleShareToChat(post: PostWithMeta) {
    if (companions.length === 0) {
      Alert.alert('还没有角色', '请先创建一个角色');
      return;
    }

    // Build share content with structured marker for card rendering
    const shareData = JSON.stringify({
      id: post.post_id,
      author: post.author_name,
      avatar: post.author_avatar_uri || '',
      content: post.content_text,
      images: post.media_urls.slice(0, 3),
      likes: post.like_count,
      comments: post.comment_count,
    });
    const shareContent = `[SHARE_POST:${shareData}]`;

    // Pick companion to share with
    if (companions.length === 1) {
      await shareToCompanion(companions[0], shareContent);
    } else {
      Alert.alert(
        '分享给谁？',
        '选择一个角色讨论这条动态',
        [
          ...companions.map(c => ({
            text: c.name,
            onPress: () => shareToCompanion(c, shareContent),
          })),
          { text: '取消', style: 'cancel' as const },
        ],
      );
    }
  }

  async function shareToCompanion(comp: any, content: string) {
    try {
      let conversation = await ConversationRepository.getByCompanionId(comp.id);
      if (!conversation) {
        conversation = await ConversationRepository.create(comp.id);
      }
      // Navigate to chat with the share content as initial message
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: conversation.id,
          companionId: comp.id,
          name: comp.name,
          shareMessage: content,
        },
      });
    } catch (e) {
      Alert.alert('分享失败', '请重试');
    }
  }

  // ── Comment ──
  async function handleComment() {
    if (!commentingPostId || !commentText.trim()) return;
    const commentContent = commentText.trim();
    await SocialRepo.addComment(
      commentingPostId, 'user', settings.userName || '我', settings.userAvatarUri || '',
      commentContent, replyTo?.id || null, replyTo?.name || null
    );
    setCommentText('');
    setReplyTo(null);
    await loadFeed();

    // Schedule AI reply to user's comment
    scheduleAICommentReply(commentingPostId, commentContent);
  }

  // ── AI comment reply (LLM-based with persona) ──
  function scheduleAICommentReply(postId: string, userComment: string) {
    if (companions.length === 0) return;
    const delay = 8000 + Math.floor(Math.random() * 15000); // 8-23 seconds
    setTimeout(async () => {
      try {
        const post = await SocialRepo.getPost(postId);
        if (!post) return;

        // Pick a companion to reply (prefer the post author if they're a companion)
        let comp = companions.find(c => c.id === post.author_id);
        if (!comp) comp = companions[Math.floor(Math.random() * companions.length)];

        const replyText = await generatePersonaCommentReply(comp, post.content_text, userComment);

        // Check if user replied to a specific comment
        let replyToCommentId: string | null = null;
        let replyToName: string | null = null;
        if (replyTo) {
          replyToCommentId = replyTo.id;
          replyToName = replyTo.name;
        }

        await SocialRepo.addComment(
          postId, comp.id, comp.name, comp.avatarUri || '',
          replyText, replyToCommentId, replyToName
        );
        await loadFeed();
      } catch {}
    }, delay);
  }

  // Generate a persona-aware comment reply using LLM
  // 性格从角色卡数据注入，网感由框架硬性约束
  async function generatePersonaCommentReply(comp: any, postContent: string, userComment: string): Promise<string> {
    const fallbackReplies = [
      `哈`, `？`, `就这？`, `可以`, `切`, `哦`, `嗯哼`, `行吧`, `呵`, `绝了`,
    ];

    const apiConfigs = useSettingsStore.getState().apiConfigs;
    const userSignature = useSettingsStore.getState().settings.userSignature || '';
    if (!apiConfigs.llm) return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];

    try {
      const persona = await PersonaEngine.load(comp.id, userSignature);
      if (!persona) return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];

      const conv = await ConversationRepository.getByCompanionId(comp.id);
      const longTermMemory = conv?.longTermMemorySummary || '';
      const systemPrompt = PromptBuilder.buildSystemPrompt(persona, 'chatroom');
      const contextLine = postContent ? `动态内容：「${postContent}」\n` : '';
      const messages = PromptBuilder.buildMessages(
        systemPrompt + `\n\n【当前场景】你在社交空间中回复对方的评论。

【回复行为规范】
1. 字数严格控制在5-12个字，像人类在朋友圈随手回复评论
2. 口语化：碎片表达、语气词、反问、单字都行
3. 禁止长句、禁止逻辑解释、禁止书面语
4. 短句节奏参考（只学节奏，内容用你的人设风格）：
   - 肯定类 → "对啊" / "就是" / "懂行"
   - 反问类 → "真的吗" / "？" / "然后呢"
   - 调侃类 → "就这" / "呵" / "切"
   - 情绪类 → "啊" / "！！" / "哭了"
   - 敷衍类 → "哦" / "嗯" / "行"`,
        longTermMemory, [],
        `${contextLine}对方评论了：「${userComment}」\n用你的人设风格回复这条评论。`
      );
      const llmClient = new LLMClient(apiConfigs.llm);
      const response = await llmClient.chat(messages);
      const cleaned = extractPlainText(response);
      if (cleaned.length > 0 && cleaned.length <= 30) return cleaned;
      if (cleaned.length > 30) return cleaned.slice(0, 15);
      return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    } catch {
      return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    }
  }

  // Generate a persona-aware proactive post using LLM
  async function generatePersonaPost(comp: any, hour: number): Promise<string> {
    const nickname = comp.nicknameForUser || '你';
    const fallbackPool = hour < 12
      ? [`早安～${nickname}今天也要加油哦`, '新的一天，元气满满！']
      : hour < 18
      ? [`今天过得好快啊`, `${nickname}在干嘛呢？`]
      : [`晚上好～${nickname}吃饭了吗？`, '今天好累但很开心'];

    const apiConfigs = useSettingsStore.getState().apiConfigs;
    const userSignature = useSettingsStore.getState().settings.userSignature || '';
    if (!apiConfigs.llm) return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];

    try {
      const persona = await PersonaEngine.load(comp.id, userSignature);
      if (!persona) return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];

      const conv = await ConversationRepository.getByCompanionId(comp.id);
      const longTermMemory = conv?.longTermMemorySummary || '';
      const systemPrompt = PromptBuilder.buildSystemPrompt(persona, 'chatroom');
      const timeHint = hour < 12 ? '早上' : hour < 18 ? '下午' : '晚上';
      const messages = PromptBuilder.buildMessages(
        systemPrompt + '\n\n【当前场景】你想在社交空间发一条动态（类似朋友圈）。保持你的人设，用口语化表达，1-2句话，自然真实。',
        longTermMemory, [],
        `现在是${timeHint}，请发一条自然的动态。`
      );
      const llmClient = new LLMClient(apiConfigs.llm);
      const response = await llmClient.chat(messages);
      const cleaned = extractPlainText(response);
      return cleaned.length > 0 && cleaned.length <= 100 ? cleaned : fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    } catch {
      return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
    }
  }

  // ── Image picker ──
  async function handlePickImages() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true, multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const newUris: string[] = [];
      for (const file of result.assets.slice(0, 9 - composerImages.length)) {
        const dir = (FileSystem.cacheDirectory || '') + 'social/';
        try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
        const ext = file.name?.split('.').pop() || 'jpg';
        const dest = dir + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
        await FileSystem.copyAsync({ from: file.uri, to: dest });
        newUris.push(dest);
      }
      setComposerImages((prev) => [...prev, ...newUris].slice(0, 9));
    } catch {}
  }

  async function handleChangeCover() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true, multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const dir = (FileSystem.cacheDirectory || '') + 'covers/';
      try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'jpg';
      const dest = dir + 'cover_' + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: dest });
      setCoverUri(dest);
      await SettingsRepository.setSetting('space_cover_uri', dest);
    } catch {}
  }

  // ── Recursive comment renderer ──
  function renderComment(c: SocialComment, postId: string, depth: number = 0, repliesMap: Map<string, SocialComment[]>) {
    const replies = repliesMap.get(c.comment_id) || [];
    return (
      <View key={c.comment_id} style={[styles.commentThread, depth > 0 && { marginLeft: Math.min(depth * 16, 64) }]}>
        <TouchableOpacity
          style={styles.commentLine}
          onPress={() => { setCommentingPostId(postId); setReplyTo({ id: c.comment_id, name: c.author_name }); }}
          onLongPress={() => {
            Alert.alert('删除评论', '确定删除这条评论吗？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: async () => {
                const comp = companions.find((co) => co.id === c.author_id);
                await SocialRepo.deleteComment(c.comment_id, comp?.id);
                await loadFeed();
              }},
            ]);
          }}
          activeOpacity={0.6}
        >
          <Text style={styles.cAuthor}>{c.author_name}</Text>
          {c.reply_to_author_name && (
            <View style={styles.replyTagInline}>
              <Ionicons name="return-down-forward" size={11} color="#6C63FF" />
              <Text style={styles.replyNameText}>{c.reply_to_author_name}</Text>
            </View>
          )}
          <Text style={styles.cColon}>: </Text>
          <Text style={styles.cContent}>{c.content}</Text>
        </TouchableOpacity>
        {replies.map((r) => renderComment(r, postId, depth + 1, repliesMap))}
      </View>
    );
  }

  // ── Render post with animation for new posts ──
  function renderPost({ item }: { item: PostWithMeta }) {
    const isNew = item.post_id === newPostId;
    const rootComments = item.comments.filter((c) => !c.reply_to_comment_id);
    const repliesMap = new Map<string, SocialComment[]>();
    for (const c of item.comments) {
      if (c.reply_to_comment_id) {
        const arr = repliesMap.get(c.reply_to_comment_id) || [];
        arr.push(c);
        repliesMap.set(c.reply_to_comment_id, arr);
      }
    }

    const isOwnPost = item.author_id === 'user';

    const card = (
      <TiltCard>
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <Avatar uri={item.author_avatar_uri || null} name={item.author_name} size="sm" />
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{item.author_name}</Text>
            <Text style={styles.timeText}>{formatTime(item.created_at)}</Text>
          </View>
          <TouchableOpacity onPress={() => {
            const authorLabel = isOwnPost ? '你的' : `${item.author_name}的`;
            const memoryNote = item.memory_uuid
              ? `\n\n${item.author_name} 关于这条动态的记忆也将被洗涤。`
              : '';
            Alert.alert(
              '确定删除这条动态吗？',
              `删除后，${authorLabel}这条动态将从空间里彻底消失。${memoryNote}`,
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '删除',
                  style: 'destructive',
                  onPress: async () => {
                    if (item.memory_uuid) {
                      const comp = companions.find((c) => c.id === item.author_id);
                      await SocialRepo.deletePostWithMemory(item.post_id, comp?.id);
                    } else {
                      await SocialRepo.deletePost(item.post_id);
                    }
                    await loadFeed();
                  },
                },
              ]
            );
          }} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color="#B0B0B0" />
          </TouchableOpacity>
        </View>

        {/* Content - tap to view detail */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/post/${item.post_id}`)}>
          {item.content_text ? (
            <Text style={styles.contentText}>{item.content_text}</Text>
          ) : null}
          {item.media_urls.length > 0 && renderImages(item.media_urls)}
        </TouchableOpacity>

        {/* Likes */}
        {item.like_count > 0 && (
          <View style={styles.likesBar}>
            <Ionicons name="heart" size={13} color="#FF4757" />
            <Text style={styles.likesText} numberOfLines={1}>
              {item.liked_names.length <= 3
                ? item.liked_names.join('、')
                : `${item.liked_names.slice(0, 3).join('、')} 等${item.liked_names.length}人`}
            </Text>
          </View>
        )}

        {/* Comments inline - recursive rendering */}
        {item.comments.length > 0 && (
          <View style={styles.commentsBlock}>
            {rootComments.map((c) => renderComment(c, item.post_id, 0, repliesMap))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <LikeButton liked={item.liked_by_me} onPress={() => handleLike(item.post_id)} />
          <TouchableOpacity style={styles.actionBtn} onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCommentingPostId(commentingPostId === item.post_id ? null : item.post_id);
            setReplyTo(null);
          }} activeOpacity={0.5}>
            <Ionicons name="chatbubble-outline" size={17} color="#B0B0B0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleShareToChat(item)} activeOpacity={0.5}>
            <Ionicons name="arrow-redo-outline" size={17} color="#B0B0B0" />
          </TouchableOpacity>
        </View>

        {/* Comment input */}
        {commentingPostId === item.post_id && (
          <View style={styles.cInputArea}>
            {replyTo && (
              <View style={styles.replyTag}>
                <Text style={styles.replyTagText}>回复 {replyTo.name}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons name="close" size={14} color="#A0A0B8" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.cInputRow}>
              <TextInput
                style={styles.cInput}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={replyTo ? `回复 ${replyTo.name}...` : '写评论...'}
                placeholderTextColor="#B0B0B0"
              />
              <TouchableOpacity onPress={handleComment} disabled={!commentText.trim()}>
                <Text style={[styles.cSend, !commentText.trim() && { opacity: 0.3 }]}>发送</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      </TiltCard>
    );

    if (isNew) {
      return (
        <AnimatedPostInsert visible={true} onComplete={() => setNewPostId(null)}>
          {card}
        </AnimatedPostInsert>
      );
    }
    return card;
  }

  function renderImages(urls: string[]) {
    if (urls.length === 1) {
      return (
        <Image source={{ uri: urls[0] }} style={styles.singleImage} resizeMode="cover" />
      );
    }
    const size = (SCREEN_WIDTH - 56) / 3;
    return (
      <View style={styles.gridWrap}>
        {urls.map((uri, i) => (
          <Image key={i} source={{ uri }} style={[styles.gridImg, { width: size, height: size }]} resizeMode="cover" />
        ))}
      </View>
    );
  }

  // ── Parallax ──
  const coverY = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0, COVER_HEIGHT],
    outputRange: [-COVER_HEIGHT / 2, 0, COVER_HEIGHT * 0.3],
    extrapolate: 'clamp',
  });
  const coverScale = scrollY.interpolate({
    inputRange: [-COVER_HEIGHT, 0],
    outputRange: [1.4, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        renderItem={renderPost}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await loadFeed(); setRefreshing(false); }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <ParallaxHeader
              coverUri={coverUri}
              scrollY={scrollY}
              onChangeCover={handleChangeCover}
            />
            {/* Post trigger */}
            <TouchableOpacity style={styles.postTrigger} onPress={() => setShowComposer(true)} activeOpacity={0.7}>
              <Ionicons name="create-outline" size={18} color="#B0B0B0" />
              <Text style={styles.postTriggerText}>分享你的想法...</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonFeed />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="planet-outline" size={44} color="#C0C0C0" />
              <Text style={styles.emptyTitle}>还没有动态</Text>
              <Text style={styles.emptySub}>发布第一条动态吧</Text>
            </View>
          )
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Composer Modal */}
      <Modal visible={showComposer} animationType="slide" onRequestClose={() => setShowComposer(false)}>
        <View style={styles.composer}>
          <View style={styles.composerHead}>
            <TouchableOpacity onPress={() => setShowComposer(false)}>
              <Ionicons name="close" size={24} color="#1A1A2E" />
            </TouchableOpacity>
            <Text style={styles.composerTitle}>发布动态</Text>
            <TouchableOpacity onPress={handlePublish} disabled={!composerText.trim() && composerImages.length === 0}>
              <Text style={[styles.composerSend, (!composerText.trim() && composerImages.length === 0) && { opacity: 0.3 }]}>发布</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.composerInput}
            value={composerText}
            onChangeText={setComposerText}
            placeholder="分享你的想法..."
            placeholderTextColor="#B0B0B0"
            multiline
            autoFocus
          />
          {composerImages.length > 0 && (
            <View style={styles.composerImgs}>
              {composerImages.map((uri, i) => (
                <View key={i} style={styles.composerImgWrap}>
                  <Image source={{ uri }} style={styles.composerImg} />
                  <TouchableOpacity style={styles.composerImgRemove} onPress={() => setComposerImages((p) => p.filter((_, idx) => idx !== i))}>
                    <Ionicons name="close-circle" size={18} color="#FF4757" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <View style={styles.composerActions}>
            <TouchableOpacity style={styles.composerActionBtn} onPress={() => {}}>
              <Ionicons name="happy-outline" size={22} color="#8E8E93" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.composerActionBtn} onPress={handlePickImages}>
              <Ionicons name="image-outline" size={22} color="#6C63FF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 172800000) return '昨天';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F2F5' },

  // ── Cover ──
  cover: { height: COVER_HEIGHT, overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  coverImg: { width: SCREEN_WIDTH, height: COVER_HEIGHT },
  coverPlaceholder: { width: SCREEN_WIDTH, height: COVER_HEIGHT, backgroundColor: '#D8D8E0', alignItems: 'center', justifyContent: 'center' },
  coverHint: { fontSize: 13, color: '#A0A0A0', marginTop: 8 },
  coverGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'transparent',
    // Simulated gradient via overlapping views
  },

  // ── Profile ──
  profileSection: {
    alignItems: 'center', marginTop: -40, marginBottom: 16,
  },
  avatarFloat: {
    borderRadius: 20, borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    backgroundColor: '#fff',
    padding: 3,
  },
  userName: { fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginTop: 10 },
  userBio: { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  // ── Post trigger ──
  postTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.04)',
  },
  postTriggerText: { fontSize: 15, color: '#A0A0B8' },

  // ── Card ──
  card: {
    backgroundColor: '#FFFFFF', marginHorizontal: 14, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 3,
    borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.04)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  authorInfo: { marginLeft: 10, flex: 1 },
  authorName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  timeText: { fontSize: 11, color: '#B0B0B0', marginTop: 2 },
  contentText: { fontSize: 15, lineHeight: 24, color: '#2C2C2E', marginBottom: 12 },

  // ── Images ──
  singleImage: {
    width: SCREEN_WIDTH - 60, height: (SCREEN_WIDTH - 60) * 0.65,
    borderRadius: 10, marginBottom: 12, alignSelf: 'center',
  },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 12 },
  gridImg: { borderRadius: 6 },

  // ── Likes ──
  likesBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF5F5', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8,
    borderWidth: 0.5, borderColor: 'rgba(255,71,87,0.08)',
  },
  likesText: { fontSize: 13, color: '#8E6B8D', flex: 1 },

  // ── Comments ──
  commentsBlock: { backgroundColor: '#F8F8FA', borderRadius: 12, padding: 12, marginBottom: 8 },
  commentThread: { borderLeftWidth: 2, borderLeftColor: 'rgba(108,99,255,0.15)', paddingLeft: 8, marginBottom: 4 },
  commentLine: { paddingVertical: 5, paddingHorizontal: 8, borderRadius: 6, marginBottom: 3, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  cAuthor: { fontSize: 13, fontWeight: '600', color: '#6C63FF' },
  cReply: { fontSize: 13, color: '#8E8E93' },
  cColon: { fontSize: 13, color: '#B0B0B0' },
  cContent: { fontSize: 13, color: '#2C2C2E', flexShrink: 1 },
  replyTagInline: { flexDirection: 'row', alignItems: 'center', gap: 2, marginHorizontal: 4 },
  replyNameText: { fontSize: 12, color: '#6C63FF', fontWeight: '500' },

  // ── Actions ──
  actions: {
    flexDirection: 'row', gap: 28, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F2', marginTop: 4,
    justifyContent: 'center',
  },
  actionBtn: { alignItems: 'center', justifyContent: 'center', padding: 4 },

  // ── Comment input ──
  cInputArea: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F2' },
  replyTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  replyTagText: { fontSize: 12, color: '#6C63FF' },
  cInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cInput: {
    flex: 1, fontSize: 14, backgroundColor: '#F5F5F7', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 8, color: '#1A1A2E',
  },
  cSend: { fontSize: 14, fontWeight: '600', color: '#6C63FF' },

  // ── Empty ──
  empty: { alignItems: 'center', padding: 60 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#8E8E93', marginTop: 6 },

  // ── Composer ──
  composer: { flex: 1, backgroundColor: '#fff' },
  composerHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8EA',
  },
  composerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },
  composerSend: { fontSize: 16, fontWeight: '600', color: '#6C63FF' },
  composerInput: { flex: 1, fontSize: 16, color: '#1A1A2E', padding: 16, textAlignVertical: 'top' },
  composerImgs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  composerImgWrap: { position: 'relative' },
  composerImg: { width: 70, height: 70, borderRadius: 8 },
  composerImgRemove: { position: 'absolute', top: -6, right: -6 },
  composerActions: {
    flexDirection: 'row', gap: 12, padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8EA',
  },
  composerActionBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F5F5F7',
    alignItems: 'center', justifyContent: 'center',
  },
});
