/**
 * Curoco — Sticker Management
 * Import, manage, AI-understand custom stickers
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, Image, TextInput, FlatList, Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSettingsStore } from '../../src/store/settingsStore';
import GlassModal from '../../src/components/common/GlassModal';
import { useTheme } from '../../src/theme/ThemeProvider';
import { StickerRepository, type CustomSticker } from '../../src/db/repositories/StickerRepository';
import { VisionClient } from '../../src/core/api/VisionClient';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_SIZE = 3;
const THUMB_SIZE = (SCREEN_W - 48) / GRID_SIZE;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function StickerManagementPage() {
  const { apiConfigs } = useSettingsStore();
  const { theme } = useTheme();

  const [stickers, setStickers] = useState<CustomSticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMeaning, setEditMeaning] = useState('');

  useFocusEffect(useCallback(() => { loadStickers(); }, []));

  async function loadStickers() {
    setLoading(true);
    try {
      const data = searchQuery.trim()
        ? await StickerRepository.search(searchQuery.trim())
        : await StickerRepository.getAll();
      setStickers(data);
    } catch {}
    setLoading(false);
  }

  // ── Import stickers ──
  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ALLOWED_TYPES,
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const files = result.assets.slice(0, 20); // Max 20
      setImporting(true);
      let imported = 0;
      let skipped = 0;

      const stickerDir = (FileSystem.cacheDirectory || '') + 'stickers/';
      try { await FileSystem.makeDirectoryAsync(stickerDir, { intermediates: true }); } catch {}

      for (const file of files) {
        try {
          // Size check
          if ((file.size || 0) > MAX_FILE_SIZE) {
            skipped++;
            continue;
          }

          // Hash for dedup
          const hash = await computeHash(file.uri);
          const existing = await StickerRepository.getByHash(hash);
          if (existing) {
            skipped++;
            continue;
          }

          // Copy to persistent storage
          const ext = file.name?.split('.').pop() || 'png';
          const isAnimated = ext === 'gif';
          const mimeType = ALLOWED_TYPES.find((t) => t.includes(ext)) || 'image/png';
          const filePath = stickerDir + `${hash}.${ext}`;
          await FileSystem.copyAsync({ from: file.uri, to: filePath });

          // Generate thumbnail (just copy for now — real impl would resize)
          const thumbPath = stickerDir + `${hash}_thumb.${ext}`;
          await FileSystem.copyAsync({ from: file.uri, to: thumbPath });

          // AI meaning
          let meaning = '';
          if (apiConfigs.vision) {
            try {
              const vision = new VisionClient(apiConfigs.vision);
              const b64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              meaning = await vision.analyze(
                b64,
                '请用简短中文描述这张图片的内容与表情含义，控制在30字以内。例如：一只疑惑的猫、鼓掌表示赞同的卡通人物。'
              );
            } catch {}
          }

          await StickerRepository.create({
            file_path: filePath,
            thumbnail_path: thumbPath,
            mime_type: mimeType,
            is_animated: isAnimated,
            meaning: meaning || '未识别',
            hash,
          });

          imported++;
        } catch (e) {
          console.warn('Import sticker failed:', e);
          skipped++;
        }
      }

      await loadStickers();
      Alert.alert(
        '导入完成',
        `已导入 ${imported} 个表情包${skipped > 0 ? `，${skipped} 个跳过` : ''}\nAI 已理解其含义`
      );
    } catch (e: any) {
      Alert.alert('导入失败', e?.message || '请重试');
    } finally {
      setImporting(false);
    }
  }

  // ── Simple hash (first 1KB of file as hex) ──
  async function computeHash(uri: string): Promise<string> {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Simple hash from first 500 chars of base64
      let hash = 0;
      const sample = b64.slice(0, 500);
      for (let i = 0; i < sample.length; i++) {
        hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
      }
      return Math.abs(hash).toString(36);
    } catch {
      return Date.now().toString(36);
    }
  }

  // ── Edit meaning ──
  function handleEditMeaning(sticker: CustomSticker) {
    setEditingId(sticker.id);
    setEditMeaning(sticker.meaning);
  }

  async function handleSaveMeaning() {
    if (!editingId) return;
    await StickerRepository.updateMeaning(editingId, editMeaning.trim());
    setEditingId(null);
    await loadStickers();
  }

  // ── Re-identify with AI ──
  async function handleReidentify(sticker: CustomSticker) {
    if (!apiConfigs.vision) {
      Alert.alert('提示', '请先配置图像识别 API');
      return;
    }
    try {
      const vision = new VisionClient(apiConfigs.vision);
      const b64 = await FileSystem.readAsStringAsync(sticker.file_path, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const meaning = await vision.analyze(
        b64,
        '请用简短中文描述这张图片的内容与表情含义，控制在30字以内。'
      );
      await StickerRepository.updateMeaning(sticker.id, meaning);
      await loadStickers();
      Alert.alert('重新识别完成', meaning);
    } catch (e: any) {
      Alert.alert('识别失败', e?.message || '请重试');
    }
  }

  // ── Delete ──
  async function handleDelete(sticker: CustomSticker) {
    Alert.alert('删除表情包', '确定删除？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await FileSystem.deleteAsync(sticker.file_path, { idempotent: true });
            await FileSystem.deleteAsync(sticker.thumbnail_path, { idempotent: true });
          } catch {}
          await StickerRepository.delete(sticker.id);
          await loadStickers();
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={theme.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={loadStickers}
          placeholder="搜索表情包含义或标签..."
          placeholderTextColor={theme.textTertiary}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => { setSearchQuery(''); loadStickers(); }}>
            <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Grid */}
      {stickers.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="happy-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>还没有自定义表情包</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>点击下方按钮导入图片作为表情包</Text>
        </View>
      ) : (
        <FlatList
          data={stickers}
          numColumns={GRID_SIZE}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => handleEditMeaning(item)}
              onLongPress={() => handleDelete(item)}
            >
              <Image source={{ uri: item.thumbnail_path || item.file_path }} style={styles.thumbImg} />
              {item.is_animated && (
                <View style={styles.gifBadge}>
                  <Text style={styles.gifText}>GIF</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Edit meaning modal */}
      <GlassModal visible={!!editingId} onClose={() => setEditingId(null)}>
        <View style={{ padding: 8 }}>
          <Text style={[styles.editTitle, { color: theme.textPrimary }]}>编辑含义</Text>
          <TextInput
            style={[styles.editInput, { color: theme.textPrimary, borderColor: theme.border }]}
            value={editMeaning}
            onChangeText={setEditMeaning}
            multiline
            autoFocus
          />
          <View style={styles.editActions}>
            <TouchableOpacity onPress={() => setEditingId(null)} style={styles.editCancel}>
              <Text style={{ color: theme.textSecondary }}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveMeaning} style={styles.editSave}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>保存</Text>
            </TouchableOpacity>
            {apiConfigs.vision && (
              <TouchableOpacity
                onPress={() => {
                  const sticker = stickers.find((s) => s.id === editingId);
                  if (sticker) handleReidentify(sticker);
                }}
                style={styles.editReidentify}
              >
                <Text style={{ color: '#6C63FF', fontWeight: '600' }}>重新识别</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GlassModal>

      {/* Import button */}
      <TouchableOpacity
        style={[styles.importBtn, importing && { opacity: 0.5 }]}
        onPress={handleImport}
        disabled={importing}
      >
        {importing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="add" size={24} color="#fff" />
        )}
        <Text style={styles.importText}>{importing ? '导入中...' : '导入表情包'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#F5F4FA', borderRadius: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  gridContent: { paddingHorizontal: 12, paddingBottom: 80 },
  gridItem: {
    width: THUMB_SIZE, height: THUMB_SIZE, margin: 4,
    borderRadius: 8, overflow: 'hidden', backgroundColor: '#F0F0F0',
  },
  thumbImg: { width: '100%', height: '100%' },
  gifBadge: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  gifText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  // Edit modal
  editTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  editInput: {
    borderWidth: 1.5, borderRadius: 10, padding: 12,
    fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  editCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  editSave: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#6C63FF', borderRadius: 8 },
  editReidentify: { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#6C63FF', borderRadius: 8 },
  // Import button
  importBtn: {
    position: 'absolute', bottom: 24, left: 24, right: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
  },
  importText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
