/**
 * Curoco — Profile Page (v1.6.1 Redesign)
 * Clean layout: avatar with white ring, glassmorphism stats card, no hard dividers
 */

import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Avatar from '../../src/components/common/Avatar';
import SparkleText from '../../src/components/common/SparkleText';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useSettingsStore } from '../../src/store/settingsStore';
import { SocialRepo } from '../../src/db/repositories/SocialRepositoryNew';
import HabitTracker from '../../src/components/habit/HabitTracker';

interface SocialPost {
  id: string;
  content: string;
  imageUris: string[];
  likeCount: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COVER_HEIGHT = SCREEN_HEIGHT * 0.35;
const AVATAR_SIZE = 96;
const AVATAR_BORDER_WIDTH = 4;

const MORANDI_COLORS = [
  ['#E8D5D0', '#D4B8B0'],
  ['#D5E0D0', '#B8D0B0'],
  ['#D0D5E0', '#B0B8D0'],
  ['#E0D5D0', '#D0B8B0'],
  ['#D5E0E0', '#B0D0D0'],
];

export default function ProfilePage() {
  const router = useRouter();
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { settings, updateSetting } = useSettingsStore();
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [hasError, setHasError] = useState(false);

  // Transparent header: white text + settings button in headerRight
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTintColor: '#fff',
      headerTitleStyle: { fontSize: 18, fontWeight: '700', color: '#fff' },
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          style={{ marginRight: 16 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: 'rgba(0,0,0,0.25)',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="settings-outline" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    loadRecentPosts().catch(() => setHasError(true));
  }, []);

  async function loadRecentPosts() {
    try {
      const posts = await SocialRepo.getFeed(6);
      if (!Array.isArray(posts)) { setRecentPosts([]); return; }
      const parsed = posts.map((p: any) => {
        let imageUris: string[] = [];
        try {
          imageUris = Array.isArray(p.media_urls) ? p.media_urls : (p.media_urls ? JSON.parse(p.media_urls) : []);
        } catch { imageUris = []; }
        return {
          id: p.post_id || p.id || String(Date.now()),
          content: p.content_text || p.content || '',
          imageUris,
          likeCount: p.like_count || 0,
        };
      });
      setRecentPosts(parsed);
    } catch (e) {
      console.warn('Load posts failed:', e);
      setRecentPosts([]);
    }
  }

  async function handlePickCover() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        updateSetting('userCoverUri', result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('提示', '选择图片失败');
    }
  }

  function getMorandiColor(index: number) {
    return MORANDI_COLORS[index % MORANDI_COLORS.length];
  }

  if (hasError) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bgPrimary, alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="person-circle-outline" size={64} color={theme.textTertiary} />
        <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 16 }}>我的</Text>
        <TouchableOpacity onPress={() => { setHasError(false); loadRecentPosts(); }} style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.bgSecondary }}>
          <Text style={{ color: theme.primary }}>点击重试</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginTop: 12 }}>
          <Text style={{ color: theme.textTertiary }}>进入设置</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Top Cover */}
        <TouchableOpacity
          style={styles.coverWrap}
          onPress={handlePickCover}
          activeOpacity={0.9}
        >
          {settings.userCoverUri ? (
            <Image source={{ uri: settings.userCoverUri }} style={styles.coverImage} resizeMode="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: theme.bgSecondary }]}>
              <Ionicons name="image-outline" size={32} color={theme.textTertiary} />
              <Text style={[styles.coverHint, { color: theme.textTertiary }]}>点击更换封面</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Overlap Content Card */}
        <View style={[styles.contentCard, { backgroundColor: theme.bgPrimary }]}>
          {/* Avatar — right-aligned, half on cover, top layer */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarRing, { backgroundColor: theme.bgPrimary }]}>
              <Avatar
                uri={settings.userAvatarUri || null}
                name={settings.userName || '我'}
                size={AVATAR_SIZE}
                shape="rounded"
              />
            </View>
          </View>

          {/* User Signature — below cover, aligned with avatar */}
          {settings.userSignature ? (
            <View style={styles.signatureWrap}>
              <SparkleText text={settings.userSignature} style={[styles.userSignature, { color: theme.textSecondary }]} sparklesCount={6} />
            </View>
          ) : null}

          {/* Photo Wall */}
          {recentPosts.length > 0 && (
            <View style={styles.photoWallSection}>
              <View style={styles.photoWallHeader}>
                <Text style={[styles.photoWallTitle, { color: theme.textPrimary }]}>朋友圈</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/discover')} activeOpacity={0.7}>
                  <Text style={[styles.photoWallMore, { color: theme.textTertiary }]}>查看全部</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.photoWallCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)' }]}>
                <View style={styles.photoGrid}>
                  {recentPosts.slice(0, 4).map((post, index) => (
                    <View key={post.id} style={styles.photoItem}>
                      {post.imageUris && post.imageUris.length > 0 ? (
                        <Image
                          source={{ uri: post.imageUris[0] }}
                          style={styles.photoThumb}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.textThumb, {
                          backgroundColor: getMorandiColor(index)[0],
                          borderColor: getMorandiColor(index)[1],
                        }]}>
                          <Text style={styles.textThumbChar}>
                            {post.content.slice(0, 2)}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Habit Tracker - full width */}
          <HabitTracker theme={theme} />

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverWrap: {
    width: SCREEN_WIDTH,
    height: COVER_HEIGHT,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  coverHint: { fontSize: 13, fontWeight: '500' },
  settingsBtn: { position: 'absolute', top: 48, right: 16 },
  settingsIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  // Content Card
  contentCard: {
    marginTop: -24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2 + 24,
    paddingHorizontal: 20,
    minHeight: SCREEN_HEIGHT * 0.68,
  },
  // Avatar — right-aligned, center at cover/content boundary, half in each
  avatarWrap: {
    position: 'absolute',
    top: -(AVATAR_SIZE / 2 + AVATAR_BORDER_WIDTH + 4),
    right: 28,
    zIndex: 10,
  },
  avatarRing: {
    width: AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2,
    height: AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2,
    borderRadius: (AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2) * 0.2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: '#fff',
    padding: 3,
    overflow: 'hidden',
  },
  // User Info
  signatureWrap: {
    position: 'absolute',
    top: AVATAR_SIZE / 2 + AVATAR_BORDER_WIDTH - 22,
    right: 28 + AVATAR_SIZE + AVATAR_BORDER_WIDTH * 2 + 32,
    maxWidth: SCREEN_WIDTH - 28 - AVATAR_SIZE - AVATAR_BORDER_WIDTH * 2 - 32 - 20,
  },
  userSignature: {
    fontSize: 13, lineHeight: 18, fontStyle: 'italic',
  },
  // Photo Wall
  photoWallSection: { marginBottom: 16 },
  photoWallHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  photoWallTitle: { fontSize: 16, fontWeight: '600' },
  photoWallMore: { fontSize: 13 },
  photoWallCard: {
    borderRadius: 24, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  photoGrid: { flexDirection: 'row', gap: 8 },
  photoItem: { width: 50, height: 50, borderRadius: 12, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  textThumb: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  textThumbChar: { fontSize: 14, fontWeight: '600', color: '#666' },
});
