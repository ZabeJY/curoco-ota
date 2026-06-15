/**
 * Curoco — Companion Detail (Redesigned)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CompanionRepository } from '../../../src/db/repositories/CompanionRepository';
import { ConversationRepository } from '../../../src/db/repositories/ConversationRepo';
import { useSettingsStore } from '../../../src/store/settingsStore';
import { useTheme } from '../../../src/theme/ThemeProvider';
import Avatar from '../../../src/components/common/Avatar';
import type { Companion } from '../../../src/types/models';

export default function CompanionDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { apiConfigs } = useSettingsStore();
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    CompanionRepository.getById(id).then(setCompanion).catch(() => setCompanion(null)).finally(() => setLoading(false));
  }, [id]);

  async function handleChat() {
    if (!companion) return;
    let conv = await ConversationRepository.getByCompanionId(companion.id);
    if (!conv) conv = await ConversationRepository.create(companion.id);
    router.push({ pathname: '/chat/[id]', params: { id: conv.id, companionId: companion.id, name: companion.name } });
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;
  if (!companion) return <View style={styles.center}><Text style={{ color: '#6B6B8D' }}>角色不存在</Text></View>;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Avatar uri={companion.avatarUri} name={companion.name} size="xl" />
        <Text style={styles.name}>{companion.name}</Text>
        <Text style={styles.sub}>{companion.relationship} · {companion.age}岁 · {companion.gender === 'male' ? '男' : companion.gender === 'female' ? '女' : '其他'}</Text>
        {companion.nicknameForUser && <Text style={styles.nickname}>称呼你为「{companion.nicknameForUser}」</Text>}
      </View>

      {/* Dual action row — minimal capsule buttons */}
      <View style={styles.dualActions}>
        <TouchableOpacity
          style={styles.capsuleBtn}
          onPress={() => router.push({ pathname: '/chat/search', params: { companionId: companion.id, companionName: companion.name } })}
          activeOpacity={0.7}
        >
          <Ionicons name="search-outline" size={16} color="#6C63FF" />
          <Text style={styles.capsuleBtnText}>查找记录</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.capsuleBtn}
          onPress={() => router.push(`/companion/${companion.id}/edit`)}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={16} color="#6C63FF" />
          <Text style={styles.capsuleBtnText}>编辑全部</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Info label="性格特征" value={companion.personality || '未设置'} />
        <Info label="背景故事" value={companion.backstory || '未设置'} />
        {companion.worldSetting && <Info label="世界观" value={companion.worldSetting} />}
      </View>
      {(companion.speakingStyle || companion.catchphrase || companion.emotionStyle || companion.likes || companion.tabooTopics) && (
        <View style={styles.section}>
          {companion.speakingStyle && <Info label="语言特点" value={companion.speakingStyle} />}
          {companion.catchphrase && <Info label="口头禅" value={companion.catchphrase} />}
          {companion.emotionStyle && <Info label="情感表达" value={companion.emotionStyle} />}
          {companion.likes && <Info label="喜好/兴趣" value={companion.likes} />}
          {companion.tabooTopics && <Info label="禁忌话题" value={companion.tabooTopics} />}
        </View>
      )}
      <View style={styles.section}>
        <Info label="语音消息" value={companion.voiceEnabled ? '已开启' : '未开启'} />
        <Info label="主动消息" value={companion.proactiveMessageEnabled ? '已开启' : '未开启'} />
        <Info label="音色克隆" value={companion.ttsVoiceId ? '已配置' : '未配置'} />
      </View>

      {/* Voice Status */}
      <View style={styles.section}>
        <View style={styles.voiceStatusHeader}>
          <Ionicons
            name={apiConfigs.tts && companion.voiceEnabled && companion.ttsVoiceId ? 'mic-circle' : 'mic-off-circle'}
            size={18}
            color={apiConfigs.tts && companion.voiceEnabled && companion.ttsVoiceId ? '#2ED573' : '#B0B0B0'}
          />
          <Text style={[styles.voiceStatusTitle, { color: apiConfigs.tts && companion.voiceEnabled && companion.ttsVoiceId ? '#2ED573' : '#8E8E93' }]}>
            {apiConfigs.tts && companion.voiceEnabled && companion.ttsVoiceId ? '语音就绪' : '语音未就绪'}
          </Text>
        </View>
        <Info label="TTS 配置" value={apiConfigs.tts ? (apiConfigs.tts.label || '已配置') : '未配置'} />
        <Info label="语音开关" value={companion.voiceEnabled ? '已开启' : '未开启'} />
        <Info label="音色" value={companion.ttsVoiceId === 'clone' ? '克隆音色' : companion.ttsVoiceId || '未设置'} />
        {companion.ttsVoiceId === 'clone' && companion.ttsVoiceSampleUri && (
          <Info label="克隆音色" value="已绑定音频样本" />
        )}
      </View>

      {/* Export */}
      <TouchableOpacity style={styles.exportBtn} onPress={async () => {
        try {
          const { CharacterCardService } = require('../../../src/core/CharacterCardService');
          const filePath = await CharacterCardService.exportCard(companion.id);
          await CharacterCardService.shareCard(filePath);
        } catch (e: any) {
          Alert.alert('导出失败', e?.message || '请重试');
        }
      }}>
        <Ionicons name="share-outline" size={18} color="#6C63FF" />
        <Text style={styles.exportText}>导出角色卡</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={() => {
        Alert.alert('确认删除', `确定要删除 ${companion.name} 吗？`, [
          { text: '取消', style: 'cancel' },
          { text: '删除', style: 'destructive', onPress: async () => { await CompanionRepository.delete(companion.id); router.back(); } },
        ]);
      }}>
        <Ionicons name="trash-outline" size={18} color="#FF4757" /><Text style={styles.deleteText}>删除角色</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', backgroundColor: '#fff', paddingVertical: 24, marginBottom: 12 },
  name: { fontSize: 22, fontWeight: '700', color: '#1A1A2E', marginTop: 12 },
  sub: { fontSize: 14, color: '#6B6B8D', marginTop: 4 },
  nickname: { fontSize: 13, color: '#6C63FF', marginTop: 6 },
  dualActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 24 },
  capsuleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 46, borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  capsuleBtnText: { fontSize: 14, fontWeight: '600', color: '#6C63FF' },
  section: { backgroundColor: '#fff', marginBottom: 8, paddingHorizontal: 16 },
  infoRow: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  infoLabel: { fontSize: 13, color: '#6B6B8D', marginBottom: 4 },
  infoValue: { fontSize: 15, color: '#1A1A2E', lineHeight: 22 },
  voiceStatusHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  voiceStatusTitle: { fontSize: 14, fontWeight: '600' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 16, backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  exportText: { fontSize: 15, fontWeight: '500', color: '#6C63FF' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, marginTop: 12, marginBottom: 40 },
  deleteText: { fontSize: 14, color: '#FF4757' },
});
