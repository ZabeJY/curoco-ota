/**
 * Curoco — Post Detail Screen
 * Full-screen view of a post with comments
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Text, ScrollView, TouchableOpacity,
  TextInput, Alert, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import TiltCard from '../../src/components/common/TiltCard';
import { BlurView } from 'expo-blur';
import Avatar from '../../src/components/common/Avatar';
import { SocialRepo } from '../../src/db/repositories/SocialRepositoryNew';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import { useSettingsStore } from '../../src/store/settingsStore';
import type { SocialComment, PostWithMeta } from '../../src/types/social';
import type { Companion } from '../../src/types/models';

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettingsStore();

  const [post, setPost] = useState<PostWithMeta | null>(null);
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  async function loadData() {
    if (!postId) return;
    try {
      const [postData, comps] = await Promise.all([
        SocialRepo.getPostWithMeta(postId),
        CompanionRepository.getAll(),
      ]);
      setPost(postData);
      setCompanions(comps);
    } catch (e) {
      console.warn('Failed to load post:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleComment() {
    if (!postId || !commentText.trim()) return;
    const content = commentText.trim();
    await SocialRepo.addComment(
      postId, 'user', settings.userName || '我', settings.userAvatarUri || '',
      content, replyTo?.id || null, replyTo?.name || null
    );
    setCommentText('');
    setReplyTo(null);
    await loadData();
  }

  async function handleDeleteComment(commentId: string, authorId: string) {
    const comp = companions.find((c) => c.id === authorId);
    await SocialRepo.deleteComment(commentId, comp?.id);
    await loadData();
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  // Recursive comment renderer
  function renderComment(c: SocialComment, depth: number = 0, repliesMap: Map<string, SocialComment[]>) {
    const replies = repliesMap.get(c.comment_id) || [];
    return (
      <View key={c.comment_id} style={[styles.commentThread, depth > 0 && { marginLeft: Math.min(depth * 16, 64) }]}>
        <TouchableOpacity
          style={styles.commentItem}
          onPress={() => setReplyTo({ id: c.comment_id, name: c.author_name })}
          onLongPress={() => {
            Alert.alert('删除评论', '确定删除这条评论吗？', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => handleDeleteComment(c.comment_id, c.author_id) },
            ]);
          }}
          activeOpacity={0.6}
        >
          <Avatar uri={c.author_avatar_uri || null} name={c.author_name} size="sm" />
          <View style={styles.commentBody}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>{c.author_name}</Text>
              {c.reply_to_author_name && (
                <View style={styles.replyToTag}>
                  <Ionicons name="return-down-forward" size={10} color="#6C63FF" />
                  <Text style={styles.replyToName}>{c.reply_to_author_name}</Text>
                </View>
              )}
            </View>
            <Text style={styles.commentContent}>{c.content}</Text>
            <Text style={styles.commentTime}>{formatTime(c.created_at)}</Text>
          </View>
        </TouchableOpacity>
        {replies.map((r) => renderComment(r, depth + 1, repliesMap))}
      </View>
    );
  }

  if (loading || !post) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  const rootComments = post.comments.filter((c) => !c.reply_to_comment_id);
  const repliesMap = new Map<string, SocialComment[]>();
  for (const c of post.comments) {
    if (c.reply_to_comment_id) {
      const arr = repliesMap.get(c.reply_to_comment_id) || [];
      arr.push(c);
      repliesMap.set(c.reply_to_comment_id, arr);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A2E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>动态详情</Text>
        <View style={styles.backBtn} />
      </View>

      <Animated.ScrollView
        style={[styles.scroll, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Post */}
        <TiltCard>
        <View style={styles.postCard}>
          <View style={styles.postHeader}>
            <Avatar uri={post.author_avatar_uri || null} name={post.author_name} size="md" />
            <View style={styles.postAuthorInfo}>
              <Text style={styles.postAuthorName}>{post.author_name}</Text>
              <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
            </View>
          </View>

          {post.content_text ? (
            <Text style={styles.postContent}>{post.content_text}</Text>
          ) : null}

          {post.media_urls.length > 0 && (
            <View style={styles.postImages}>
              {post.media_urls.map((url, i) => (
                <Avatar key={i} uri={url} name="" size="lg" shape="rounded" />
              ))}
            </View>
          )}

          {/* Stats */}
          <View style={styles.postStats}>
            <View style={styles.statItem}>
              <Ionicons name="heart" size={14} color="#FF4757" />
              <Text style={styles.statText}>{post.like_count}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={14} color="#6C63FF" />
              <Text style={styles.statText}>{post.comment_count}</Text>
            </View>
          </View>
        </View>

        </TiltCard>

        {/* Comments section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsSectionTitle}>评论 ({post.comment_count})</Text>

          {rootComments.length > 0 ? (
            rootComments.map((c) => renderComment(c, 0, repliesMap))
          ) : (
            <Text style={styles.noComments}>暂无评论，快来第一条吧～</Text>
          )}
        </View>
      </Animated.ScrollView>

      {/* Comment input */}
      <View style={styles.inputArea}>
        {replyTo && (
          <View style={styles.replyTag}>
            <Text style={styles.replyTagText}>回复 {replyTo.name}</Text>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={14} color="#A0A0B8" />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={replyTo ? `回复 ${replyTo.name}...` : '写评论...'}
            placeholderTextColor="#B0B0B0"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={handleComment}
            disabled={!commentText.trim()}
          >
            <Text style={styles.sendBtnText}>发送</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F8FA' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, color: '#8E8E93' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8EA',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Post card
  postCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  postAuthorInfo: { flex: 1 },
  postAuthorName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  postTime: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  postContent: { fontSize: 15, color: '#2C2C2E', lineHeight: 22, marginBottom: 12 },
  postImages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  postStats: {
    flexDirection: 'row', gap: 20, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0F0F2',
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, color: '#8E8E93' },

  // Comments section
  commentsSection: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  commentsSectionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', marginBottom: 12 },
  noComments: { fontSize: 14, color: '#B0B0B0', textAlign: 'center', paddingVertical: 20 },

  // Comment thread (recursive)
  commentThread: {
    borderLeftWidth: 2, borderLeftColor: 'rgba(108,99,255,0.15)',
    paddingLeft: 8, marginBottom: 8,
  },
  commentItem: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: '#6C63FF' },
  replyToTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  replyToName: { fontSize: 12, color: '#6C63FF', fontWeight: '500' },
  commentContent: { fontSize: 14, color: '#2C2C2E', lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#B0B0B0', marginTop: 4 },

  // Input area
  inputArea: {
    backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8EA',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 34,
  },
  replyTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6,
    backgroundColor: '#F0EFF8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  replyTagText: { fontSize: 12, color: '#6C63FF', flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, fontSize: 14, backgroundColor: '#F5F5F7', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, color: '#1A1A2E',
  },
  sendBtn: {
    backgroundColor: '#6C63FF', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
