/**
 * Curoco — User Profile Edit
 * Avatar upload + nickname
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import Avatar from '../../src/components/common/Avatar';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function UserProfilePage() {
  const { settings, updateSetting } = useSettingsStore();
  const { theme } = useTheme();
  const [name, setName] = useState(settings.userName || '');
  const [avatarUri, setAvatarUri] = useState(settings.userAvatarUri || '');
  const [signature, setSignature] = useState(settings.userSignature || '');

  useEffect(() => {
    setName(settings.userName || '');
    setAvatarUri(settings.userAvatarUri || '');
    setSignature(settings.userSignature || '');
  }, [settings.userName, settings.userAvatarUri, settings.userSignature]);

  async function handlePickImage() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const size = file.size || 0;

      if (size > MAX_AVATAR_SIZE) {
        Alert.alert('图片太大', `头像需小于 5MB，当前 ${(size / 1024 / 1024).toFixed(1)}MB`);
        return;
      }

      // Copy to persistent cache
      const cacheDir = (FileSystem.cacheDirectory || '') + 'avatars/';
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'jpg';
      const destUri = cacheDir + 'user_' + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: destUri });

      setAvatarUri(destUri);
      Alert.alert('头像已更新', '记得点击保存');
    } catch (e: any) {
      Alert.alert('选择图片失败', e?.message || '请重试');
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('提示', '请输入昵称');
      return;
    }
    await updateSetting('userName', name.trim());
    await updateSetting('userAvatarUri', avatarUri);
    await updateSetting('userSignature', signature.trim());
    Alert.alert('保存成功');
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Avatar uri={null} name={name || '我'} size="xl" />
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        <Text style={[styles.avatarHint, { color: theme.textTertiary }]}>点击更换头像（JPG/PNG/WebP，&lt;5MB）</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>昵称</Text>
        <TextInput
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
          value={name}
          onChangeText={setName}
          placeholder="输入你的昵称"
          placeholderTextColor={theme.textTertiary}
          maxLength={20}
        />
        <Text style={[styles.hint, { color: theme.textTertiary }]}>AI 会用这个称呼来叫你</Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>签名</Text>
        <TextInput
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.bgSecondary }]}
          value={signature}
          onChangeText={setSignature}
          placeholder="写一句话介绍自己..."
          placeholderTextColor={theme.textTertiary}
          maxLength={50}
        />
        <Text style={[styles.hint, { color: theme.textTertiary }]}>会显示在「我的」页面，角色也能看到</Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>保存</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#F8F7FC',
  },
  avatarHint: { fontSize: 12, marginTop: 8 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  hint: { fontSize: 12, marginTop: 4 },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
