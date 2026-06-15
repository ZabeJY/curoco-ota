/**
 * Curoco — Voice Library
 * Upload audio → save as cloneable voice → bind to companion
 * MiMo voiceclone model: audio.voice = DataURL of the sample
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useCompanionStore } from '../../src/store/companionStore';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import { useTheme } from '../../src/theme/ThemeProvider';
import { VoiceStore, type ClonedVoice } from '../../src/utils/voiceStore';

const MAX_DURATION_SEC = 60;
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

export default function VoiceClonePage() {
  const { apiConfigs } = useSettingsStore();
  const { companions } = useCompanionStore();
  const { theme } = useTheme();
  const ttsConfig = apiConfigs.tts;

  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiceName, setVoiceName] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; duration: number } | null>(null);
  const [bindTarget, setBindTarget] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(useCallback(() => { loadVoices(); }, []));

  async function loadVoices() {
    setLoading(true);
    setClonedVoices(await VoiceStore.getAll());
    setLoading(false);
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp3'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const size = file.size || 0;
      if (size > MAX_SIZE_BYTES) { Alert.alert('文件太大', '需小于 15MB'); return; }

      const info = await FileSystem.getInfoAsync(file.uri);
      if (!info.exists) { Alert.alert('错误', '无法读取文件'); return; }

      let duration = 0;
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri: file.uri }, { shouldPlay: false });
        const status = await sound.getStatusAsync();
        if (status.isLoaded && status.durationMillis) duration = status.durationMillis / 1000;
        await sound.unloadAsync();
      } catch {}

      if (duration > MAX_DURATION_SEC) { Alert.alert('音频太长', `需小于 60秒，当前 ${duration.toFixed(1)}秒`); return; }

      // Copy to persistent cache
      const cacheDir = (FileSystem.cacheDirectory || '') + 'voice_samples/';
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'mp3';
      const destUri = cacheDir + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: destUri });

      setSelectedFile({ uri: destUri, name: file.name || 'audio.' + ext, duration });
    } catch (e: any) {
      Alert.alert('选择文件失败', e?.message || '请重试');
    }
  }

  async function handleSave() {
    if (!voiceName.trim()) { Alert.alert('提示', '请输入音色名称'); return; }
    if (!selectedFile) { Alert.alert('提示', '请先选择音频文件'); return; }

    setIsSaving(true);
    try {
      // Save to voice library
      const voice: ClonedVoice = {
        id: 'cv_' + Date.now(),
        name: voiceName.trim(),
        voiceId: selectedFile.uri, // Store the file URI as the voice identifier
        createdAt: new Date().toISOString(),
      };
      await VoiceStore.add(voice);
      setClonedVoices((prev) => [voice, ...prev]);

      // If bound to companion, save sample URI and set ttsVoiceId
      if (bindTarget) {
        await CompanionRepository.update(bindTarget, {
          ttsVoiceId: 'clone',
          ttsVoiceSampleUri: selectedFile.uri,
          voiceEnabled: true,
        });
      }

      setVoiceName('');
      setSelectedFile(null);
      setBindTarget(null);
      Alert.alert('✅ 保存成功', `音色「${voice.name}」已添加${bindTarget ? '并绑定到角色' : ''}`);
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请重试');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBind(voice: ClonedVoice, companionId: string | null) {
    if (companionId) {
      await CompanionRepository.update(companionId, {
        ttsVoiceId: 'clone',
        ttsVoiceSampleUri: voice.voiceId, // voiceId stores the file URI
        voiceEnabled: true,
      });
      Alert.alert('已绑定', `已绑定到 ${companions.find((c) => c.id === companionId)?.name || '角色'}`);
    }
  }

  async function handleDelete(voice: ClonedVoice) {
    Alert.alert('删除音色', `确定删除「${voice.name}」？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => setClonedVoices(await VoiceStore.remove(voice.id)) },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>
      {/* TTS status */}
      {ttsConfig ? (
        <View style={[styles.statusCard, { backgroundColor: 'rgba(108,99,255,0.08)' }]}>
          <Ionicons name="checkmark-circle" size={18} color="#6C63FF" />
          <Text style={styles.statusText}>TTS: {ttsConfig.label} · 模型: voiceclone</Text>
        </View>
      ) : (
        <View style={[styles.statusCard, { backgroundColor: 'rgba(255,165,2,0.08)' }]}>
          <Ionicons name="warning" size={18} color="#FFA502" />
          <Text style={[styles.statusText, { color: '#FFA502' }]}>未配置 TTS API</Text>
        </View>
      )}

      {/* Upload form */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>添加克隆音色</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <Text style={[styles.label, { color: theme.textPrimary }]}>音色名称</Text>
        <TextInput
          style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
          value={voiceName}
          onChangeText={setVoiceName}
          placeholder="给这个音色起个名字"
          placeholderTextColor={theme.textTertiary}
        />

        <Text style={[styles.label, { color: theme.textPrimary, marginTop: 16 }]}>绑定到角色</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
          <TouchableOpacity style={[styles.chip, !bindTarget && styles.chipActive]} onPress={() => setBindTarget(null)}>
            <Text style={[styles.chipText, !bindTarget && { color: '#fff' }]}>不绑定</Text>
          </TouchableOpacity>
          {companions.map((c) => (
            <TouchableOpacity key={c.id} style={[styles.chip, bindTarget === c.id && styles.chipActive]} onPress={() => setBindTarget(c.id)}>
              <Text style={[styles.chipText, bindTarget === c.id && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.label, { color: theme.textPrimary }]}>音频样本</Text>
        <Text style={[styles.hint, { color: theme.textTertiary, marginBottom: 8 }]}>MP3 或 WAV · &lt;60秒 · &lt;15MB</Text>

        <TouchableOpacity style={styles.uploadBtn} onPress={handlePickFile} activeOpacity={0.7}>
          <Ionicons name="cloud-upload-outline" size={24} color="#6C63FF" />
          <Text style={styles.uploadText}>选择音频文件</Text>
        </TouchableOpacity>

        {selectedFile && (
          <View style={[styles.fileCard, { backgroundColor: theme.bgPrimary }]}>
            <Ionicons name="musical-note" size={18} color="#6C63FF" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{selectedFile.name}</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{selectedFile.duration > 0 ? selectedFile.duration.toFixed(1) + '秒' : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedFile(null)}>
              <Ionicons name="close-circle" size={18} color="#FF4757" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, (isSaving || !selectedFile || !voiceName.trim()) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={isSaving || !selectedFile || !voiceName.trim()}
        >
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>保存音色</Text>}
        </TouchableOpacity>
      </View>

      {/* Cloned voices list */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>已保存的音色 ({clonedVoices.length})</Text>
      {clonedVoices.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.bgSecondary }]}>
          <Ionicons name="mic-outline" size={32} color={theme.textTertiary} />
          <Text style={{ color: theme.textTertiary, marginTop: 8 }}>还没有克隆音色</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
          {clonedVoices.map((v) => (
            <View key={v.id} style={styles.voiceItem}>
              <View style={styles.voiceIcon}><Ionicons name="mic" size={16} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '500' }}>{v.name}</Text>
                <Text style={{ color: theme.textTertiary, fontSize: 11 }}>
                  {new Date(v.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {/* Bind button */}
              <TouchableOpacity onPress={() => {
                if (companions.length === 0) { Alert.alert('提示', '还没有角色'); return; }
                Alert.alert('绑定到角色', '', [
                  ...companions.map((c) => ({ text: c.name, onPress: () => handleBind(v, c.id) })),
                  { text: '取消', style: 'cancel' as const },
                ]);
              }}>
                <Ionicons name="link-outline" size={18} color="#6C63FF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(v)} style={{ marginLeft: 12 }}>
                <Ionicons name="trash-outline" size={18} color="#FF4757" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.helpCard, { backgroundColor: theme.bgSecondary }]}>
        <Ionicons name="information-circle-outline" size={16} color="#6C63FF" />
        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          克隆音色通过 MiMo 的 voiceclone 模型实现，音频样本在合成时以 DataURL 形式传入。
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 8 },
  statusText: { fontSize: 13, color: '#6C63FF', fontWeight: '500', flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  emptyCard: { alignItems: 'center', padding: 30, borderRadius: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E8E8F0', marginRight: 8 },
  chipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  chipText: { fontSize: 13, color: '#6B6B8D' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 18, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
    borderStyle: 'dashed', backgroundColor: 'rgba(0,0,0,0.02)',
  },
  uploadText: { fontSize: 15, fontWeight: '600', color: '#6C63FF' },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  voiceItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  voiceIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#5856D6', alignItems: 'center', justifyContent: 'center' },
  helpCard: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, marginTop: 16 },
  helpText: { fontSize: 12, lineHeight: 18, flex: 1 },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
